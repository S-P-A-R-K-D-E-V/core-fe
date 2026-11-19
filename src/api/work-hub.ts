import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Trung tâm việc (T2): việc giao một người + vệ sinh gộp theo ca, cùng cột với bảng việc agent. Máy chủ lọc theo quyền người
// xem (hr.task.manage thấy mọi người, còn lại chỉ việc của mình; vệ sinh cần cleaning.read). Thao tác vẫn gọi API riêng
// từng nguồn (work-tasks/…, cleaning/tasks/…).
// ----------------------------------------------------------------------

export type WorkHubKind = 'work' | 'cleaning';

export interface IWorkHubItem {
  kind: WorkHubKind;
  /** work: id việc; cleaning: "yyyy-MM-dd|Morning". */
  id: string;
  /** CV-xxxxxx / VS-ddMM-S. */
  code: string;
  title: string;
  subtitle: string | null;
  /** Cùng tên cột bảng agent: queued / running / waiting / done / ended. */
  column: 'queued' | 'running' | 'waiting' | 'done' | 'ended';
  /** work: Assigned / Submitted / Approved / Rejected / Cancelled; cleaning: pending / review / passed / failed / missed. */
  status: string;
  statusLabel: string;
  assigneeId: string | null;
  /** work: người được giao; cleaning: người trong ca (ca chưa xong). */
  assigneeName: string | null;
  createdAt: string;
  dueAt: string | null;
  finishedAt: string | null;
  sortAt: string;
  overdue: boolean;
  photoCount: number;
  date: string | null;
  block: string | null;
  total: number;
  pending: number;
  done: number;
  passed: number;
  failed: number;
}

const POLL_MS = 60_000;

export const workHubItemsKey = (days: number) => `/work-hub/items?days=${days}`;

/** Việc giao + vệ sinh N ngày gần nhất (việc giao chưa xong luôn có). Hỏi lại mỗi phút (chưa có hub trực tiếp). */
export function useWorkHubItems(days = 7, enabled = true) {
  const { data, isLoading, error, mutate } = useSWR<IWorkHubItem[]>(
    enabled ? workHubItemsKey(days) : null,
    fetcher,
    { refreshInterval: POLL_MS, keepPreviousData: true }
  );
  return useMemo(
    () => ({ items: data ?? [], loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}
