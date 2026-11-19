import type { IAgentTask, IAgentUsageRow } from 'src/api/agent-center';

import { it, expect, describe } from 'vitest';

import {
  canStop,
  decideDrop,
  stepLabel,
  upsertTask,
  isDraggable,
  describeCron,
  planProgress,
  shortTokens,
  CRON_PRESETS,
  taskElapsedMs,
  formatDuration,
  columnOfStatus,
  buildBoard,
  filterTasks,
  taskCode,
  foldText,
  usageChartData,
  groupTasksByColumn,
  usageTotalsByAgent,
  taskSourceMeta,
  taskStatusMeta,
  childrenWaitLabel,
} from '../agent-center-utils';

// ----------------------------------------------------------------------
// Trung tâm Agent: cột theo trạng thái, kéo thả được phép, tiến độ kế hoạch, cron.
// ----------------------------------------------------------------------

function task(over: Partial<IAgentTask> = {}): IAgentTask {
  return {
    id: 't1',
    agentId: 'a1',
    agentName: 'Phân tích',
    title: 'Báo cáo sáng',
    instruction: 'Làm báo cáo',
    source: 'schedule',
    sourceRef: null,
    parentTaskId: null,
    status: 'queued',
    plan: null,
    currentStepIndex: null,
    currentStepLabel: null,
    result: null,
    error: null,
    pendingActionId: null,
    createdByUserId: null,
    createdByName: null,
    createdAt: '2026-11-18T00:00:00Z',
    startedAt: null,
    finishedAt: null,
    stopRequested: false,
    inputTokens: 0,
    outputTokens: 0,
    toolCalls: 0,
    ...over,
  };
}

describe('columnOfStatus', () => {
  it.each([
    ['queued', 'queued'],
    ['running', 'running'],
    ['waiting_approval', 'waiting'],
    ['waiting_human', 'waiting'],
    ['done', 'done'],
    ['waiting_children', 'running'],
    ['failed', 'ended'],
    ['stopped', 'ended'],
    ['cancelled', 'ended'],
    ['la-lam', 'queued'],
  ])('%s → %s', (status, col) => {
    expect(columnOfStatus(status)).toBe(col);
  });
});

describe('decideDrop — chỉ cho kéo có nghĩa', () => {
  it('Lỗi / Đã dừng → Chờ chạy = chạy lại (failed, stopped)', () => {
    expect(decideDrop('ended', 'queued', 'failed')).toEqual({ kind: 'retry' });
    expect(decideDrop('ended', 'queued', 'stopped')).toEqual({ kind: 'retry' });
  });

  it('việc đã huỷ không chạy lại được', () => {
    expect(decideDrop('ended', 'queued', 'cancelled').kind).toBe('reject');
  });

  it('Chờ chạy → Lỗi / Đã dừng = huỷ', () => {
    expect(decideDrop('queued', 'ended', 'queued')).toEqual({ kind: 'cancel' });
  });

  it('thả lại cột cũ → không làm gì', () => {
    expect(decideDrop('queued', 'queued', 'queued')).toEqual({ kind: 'none' });
  });

  it.each([
    ['queued', 'running'],
    ['queued', 'done'],
    ['ended', 'done'],
    ['ended', 'running'],
    ['running', 'ended'],
    ['done', 'queued'],
    ['waiting', 'queued'],
    ['running', 'queued'],
  ] as const)('%s → %s bị từ chối', (from, to) => {
    const d = decideDrop(from, to, from === 'ended' ? 'failed' : 'queued');
    expect(d.kind).toBe('reject');
    if (d.kind === 'reject') expect(d.message).toBeTruthy();
  });

  it('chỉ thẻ chờ chạy / lỗi / đã dừng kéo được', () => {
    expect(isDraggable('queued')).toBe(true);
    expect(isDraggable('failed')).toBe(true);
    expect(isDraggable('stopped')).toBe(true);
    expect(isDraggable('cancelled')).toBe(false);
    expect(isDraggable('running')).toBe(false);
    expect(isDraggable('done')).toBe(false);
  });

  it('nút Dừng cho việc chưa kết thúc', () => {
    expect(['queued', 'running', 'waiting_approval', 'waiting_human'].every(canStop)).toBe(true);
    expect(['done', 'failed', 'stopped', 'cancelled'].some(canStop)).toBe(false);
  });
});

describe('A2 — việc chờ việc con, nguồn nhóm quản trị', () => {
  it('waiting_children: nhãn "Chờ việc con", nằm cột Đang chạy, dừng được, không huỷ / chạy lại / kéo', () => {
    expect(taskStatusMeta('waiting_children').label).toBe('Chờ việc con');
    expect(columnOfStatus('waiting_children')).toBe('running');
    expect(canStop('waiting_children')).toBe(true);
    expect(isDraggable('waiting_children')).toBe(false);
    expect(decideDrop('running', 'ended', 'waiting_children').kind).toBe('reject');
    expect(decideDrop('running', 'queued', 'waiting_children').kind).toBe('reject');
  });

  it('bảng: việc chờ việc con xếp chung cột Đang chạy với việc đang chạy', () => {
    const cols = groupTasksByColumn([
      task({ id: 'p', status: 'waiting_children', childrenTotal: 3, childrenDone: 1 }),
      task({ id: 'c', status: 'running', parentTaskId: 'p' }),
    ]);
    expect(cols.running.map((t) => t.id).sort()).toEqual(['c', 'p']);
    expect(cols.queued).toEqual([]);
  });

  it('nhãn "Chờ {done}/{total} việc con"', () => {
    expect(
      childrenWaitLabel({ status: 'waiting_children', childrenTotal: 3, childrenDone: 1 })
    ).toBe('Chờ 1/3 việc con');
    // máy chủ chưa gửi số → nhãn chung; số lệch → kẹp trong 0..total
    expect(childrenWaitLabel({ status: 'waiting_children' })).toBe('Chờ việc con');
    expect(
      childrenWaitLabel({ status: 'waiting_children', childrenTotal: 2, childrenDone: 5 })
    ).toBe('Chờ 2/2 việc con');
    expect(childrenWaitLabel({ status: 'running', childrenTotal: 2, childrenDone: 1 })).toBeNull();
  });

  it('nguồn chat → "Nhóm quản trị"', () => {
    expect(taskSourceMeta('chat').label).toBe('Nhóm quản trị');
    expect(taskSourceMeta('la-lam').label).toBe('la-lam');
  });
});

describe('bảng việc', () => {
  it('nhóm theo cột, lọc theo agent, mới trước', () => {
    const tasks = [
      task({ id: 'a', status: 'failed', createdAt: '2026-11-18T01:00:00Z' }),
      task({ id: 'b', status: 'cancelled', createdAt: '2026-11-18T03:00:00Z' }),
      task({ id: 'c', status: 'running', agentId: 'a2' }),
      task({ id: 'd', status: 'queued' }),
    ];
    const all = groupTasksByColumn(tasks);
    expect(all.ended.map((t) => t.id)).toEqual(['b', 'a']);
    expect(all.running.map((t) => t.id)).toEqual(['c']);
    const onlyA1 = groupTasksByColumn(tasks, 'a1');
    expect(onlyA1.running).toEqual([]);
    expect(onlyA1.queued.map((t) => t.id)).toEqual(['d']);
  });

  it('mã việc AG- + 6 ký tự, tìm không dấu theo tên / mã / agent; việc tin khách chỉ hiện khi lỗi / chờ người', () => {
    expect(taskCode('3f2a9c1e-0000-0000-0000-000000000000')).toBe('AG-3F2A9C');
    expect(foldText('Trả lời ĐƠN')).toBe('tra loi don');
    const tasks = [
      task({ id: '3f2a9c1e-1', title: 'Báo cáo sáng' }),
      task({
        id: 'aa',
        title: 'Trả lời Lan',
        source: 'event',
        sourceRef: 'conv:x:1',
        status: 'done',
      }),
      task({
        id: 'bb',
        title: 'Trả lời Mai',
        source: 'event',
        sourceRef: 'conv:x:2',
        status: 'failed',
      }),
      task({
        id: 'cc',
        title: 'Thẩm định',
        source: 'event',
        sourceRef: 'assess:1',
        agentName: 'CEO',
      }),
    ];
    expect(filterTasks(tasks, {}).map((t) => t.id)).toEqual(['3f2a9c1e-1', 'bb', 'cc']);
    expect(filterTasks(tasks, { q: 'bao cao' }).map((t) => t.id)).toEqual(['3f2a9c1e-1']);
    expect(filterTasks(tasks, { q: 'ag-3f2a' }).map((t) => t.id)).toEqual(['3f2a9c1e-1']);
    expect(filterTasks(tasks, { q: 'ceo' }).map((t) => t.id)).toEqual(['cc']);
    expect(filterTasks(tasks, { source: 'schedule' }).map((t) => t.id)).toEqual(['3f2a9c1e-1']);
  });

  it('buildBoard: cột Xong chỉ hôm nay, Lỗi từ đầu hôm qua; "Đang phải làm" bỏ việc huỷ', () => {
    const now = new Date(2026, 10, 19, 15, 0).getTime();
    const at = (d: number, h: number) => new Date(2026, 10, d, h, 0).toISOString();
    const tasks = [
      task({ id: 'd1', status: 'done', finishedAt: at(19, 9) }),
      task({ id: 'd0', status: 'done', finishedAt: at(18, 23) }),
      task({ id: 'f1', status: 'failed', finishedAt: at(18, 8) }),
      task({ id: 'f0', status: 'failed', finishedAt: at(17, 23) }),
      task({ id: 'x', status: 'cancelled', finishedAt: at(19, 10) }),
      task({ id: 'w', status: 'waiting_human' }),
    ];
    const active = buildBoard(tasks, 'active', now);
    expect(active.columns.done.map((t) => t.id)).toEqual(['d1']);
    expect(active.olderDone).toBe(1);
    expect(active.columns.ended.map((t) => t.id)).toEqual(['f1']);
    expect(active.olderEnded).toBe(1);
    expect(active.columns.waiting.map((t) => t.id)).toEqual(['w']);
    const all = buildBoard(tasks, 'all', now);
    expect(all.columns.ended.map((t) => t.id)).toEqual(['x', 'f1']);
  });

  it('upsertTask: thay đúng việc, việc mới lên đầu', () => {
    const list = [task({ id: 'x' }), task({ id: 'y' })];
    expect(upsertTask(list, task({ id: 'y', status: 'running' }))[1].status).toBe('running');
    expect(upsertTask(list, task({ id: 'z' })).map((t) => t.id)).toEqual(['z', 'x', 'y']);
    expect(upsertTask(undefined, task({ id: 'z' }))).toHaveLength(1);
  });
});

describe('kế hoạch / tiến độ / nhãn bước', () => {
  const plan = [
    { title: 'Đọc doanh thu', status: 'done' as const },
    { title: 'Bỏ qua', status: 'skipped' as const },
    { title: 'Tra tồn kho', status: 'in_progress' as const },
    { title: 'Gửi báo cáo', status: 'pending' as const },
  ];

  it('done + skipped tính là xong', () => {
    expect(planProgress(plan)).toEqual({ done: 2, total: 4, percent: 50 });
    expect(planProgress(null)).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it('ưu tiên nhãn máy chủ, không có thì dựng từ kế hoạch', () => {
    expect(
      stepLabel({ currentStepLabel: 'Bước 3/5 — đang tra tồn kho', currentStepIndex: 2, plan })
    ).toBe('Bước 3/5 — đang tra tồn kho');
    expect(stepLabel({ currentStepLabel: null, currentStepIndex: 2, plan })).toBe(
      'Bước 3/4 — Tra tồn kho'
    );
    expect(stepLabel({ currentStepLabel: '  ', currentStepIndex: null, plan })).toBeNull();
    expect(stepLabel({ currentStepLabel: null, currentStepIndex: 9, plan })).toBeNull();
  });
});

describe('thời gian / token', () => {
  it('formatDuration', () => {
    expect(formatDuration(450)).toBe('450 ms');
    expect(formatDuration(45_000)).toBe('45 giây');
    expect(formatDuration(192_000)).toBe('3 phút 12 giây');
    expect(formatDuration(120_000)).toBe('2 phút');
    expect(formatDuration(3_900_000)).toBe('1 giờ 5 phút');
    expect(formatDuration(null)).toBe('—');
  });

  it('taskElapsedMs: đang chạy tính tới bây giờ, xong tính tới lúc kết thúc', () => {
    const now = new Date('2026-11-18T00:01:00Z').getTime();
    expect(taskElapsedMs({ startedAt: '2026-11-18T00:00:00Z', finishedAt: null }, now)).toBe(
      60_000
    );
    expect(
      taskElapsedMs({ startedAt: '2026-11-18T00:00:00Z', finishedAt: '2026-11-18T00:00:30Z' }, now)
    ).toBe(30_000);
    expect(taskElapsedMs({ startedAt: null, finishedAt: null }, now)).toBeNull();
  });

  it('shortTokens', () => {
    expect(shortTokens(950)).toBe('950');
    expect(shortTokens(1234)).toBe('1,2k');
    expect(shortTokens(2_500_000)).toBe('2,5tr');
    expect(shortTokens(null)).toBe('0');
  });
});

describe('cron', () => {
  it('mẫu có sẵn đọc được', () => {
    expect(CRON_PRESETS.map((p) => p.cron)).toEqual(['30 7 * * *', '0 8 * * 1', '0 * * * *']);
    expect(describeCron('30 7 * * *')).toEqual({ ok: true, text: 'Hằng ngày lúc 07:30' });
    expect(describeCron('0 8 * * 1')).toEqual({ ok: true, text: 'Thứ 2 hằng tuần lúc 08:00' });
    expect(describeCron('0 * * * *')).toEqual({ ok: true, text: 'Mỗi giờ (đầu giờ)' });
  });

  it('các dạng thường gặp khác', () => {
    expect(describeCron('*/15 * * * *')).toEqual({ ok: true, text: 'Mỗi 15 phút' });
    expect(describeCron('0 9 * * 1-5')).toEqual({
      ok: true,
      text: 'Thứ 2 đến Thứ 6 hằng tuần lúc 09:00',
    });
    expect(describeCron('0 8,17 * * *')).toEqual({ ok: true, text: 'Hằng ngày lúc 08:00, 17:00' });
    expect(describeCron('0 6 1 * *')).toEqual({ ok: true, text: 'Ngày 1 hằng tháng lúc 06:00' });
    expect(describeCron('0 22 * * 0')).toEqual({
      ok: true,
      text: 'Chủ nhật hằng tuần lúc 22:00',
    });
  });

  it.each([
    '',
    '* * * *',
    '60 7 * * *',
    '0 24 * * *',
    '0 7 32 * *',
    'a b c d e',
    '0 7 * * 8',
    '*/0 * * * *',
  ])('"%s" sai', (expr) => {
    expect(describeCron(expr).ok).toBe(false);
  });
});

describe('chi phí', () => {
  const rows: IAgentUsageRow[] = [
    {
      date: '2026-11-17',
      agentId: 'a1',
      agentName: 'Phân tích',
      inputTokens: 100,
      outputTokens: 20,
      tasks: 1,
    },
    {
      date: '2026-11-18',
      agentId: 'a1',
      agentName: 'Phân tích',
      inputTokens: 50,
      outputTokens: 10,
      tasks: 2,
    },
    {
      date: '2026-11-18',
      agentId: 'a2',
      agentName: 'CSKH',
      inputTokens: 1000,
      outputTokens: 0,
      tasks: 3,
    },
    {
      date: '2026-10-01',
      agentId: 'a2',
      agentName: 'CSKH',
      inputTokens: 9,
      outputTokens: 9,
      tasks: 9,
    },
  ];

  it('biểu đồ: đủ mọi ngày, bỏ ngày ngoài khoảng', () => {
    const { dates, series } = usageChartData(rows, 3, new Date(2026, 10, 18));
    expect(dates).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
    expect(series).toEqual([
      { name: 'CSKH', data: [0, 0, 1000] },
      { name: 'Phân tích', data: [0, 120, 60] },
    ]);
  });

  it('tổng theo agent, nhiều token trước', () => {
    const totals = usageTotalsByAgent(rows);
    expect(totals.map((t) => t.agentId)).toEqual(['a2', 'a1']);
    expect(totals[1]).toMatchObject({ inputTokens: 150, outputTokens: 30, tasks: 3 });
  });
});
