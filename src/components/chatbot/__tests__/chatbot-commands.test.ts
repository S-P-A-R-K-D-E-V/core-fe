import { it, expect, describe } from 'vitest';

import {
  commandsFor,
  findCommand,
  commandUsage,
  expandCommand,
  filterCommands,
  foldDiacritics,
  parseSlashInput,
} from 'src/components/chatbot/chatbot-commands';

// ----------------------------------------------------------------------
// Lệnh gõ nhanh "/…": lọc (không phân biệt hoa thường / dấu, khớp cả tên tắt và mô tả), đổi lệnh thành
// câu hỏi (có / không có tham số), phạm vi theo đối tượng, lệnh lạ → null.
// ----------------------------------------------------------------------

const names = (input: string, audience: 'admin' | 'staff' | 'customer') =>
  filterCommands(input, audience).map((c) => c.name);

describe('foldDiacritics', () => {
  it('bỏ dấu tiếng Việt và đưa về chữ thường', () => {
    expect(foldDiacritics('Đi Trễ')).toBe('di tre');
    expect(foldDiacritics('LƯƠNG tháng Này')).toBe('luong thang nay');
    expect(foldDiacritics('doanhthu')).toBe('doanhthu');
  });
});

describe('parseSlashInput', () => {
  it('trả null khi không bắt đầu bằng "/"', () => {
    expect(parseSlashInput('xin chào')).toBeNull();
    expect(parseSlashInput('')).toBeNull();
  });

  it('tách tên lệnh và tham số', () => {
    expect(parseSlashInput('/')).toEqual({ token: '', arg: '', hasArg: false });
    expect(parseSlashInput('/doanh')).toEqual({ token: 'doanh', arg: '', hasArg: false });
    expect(parseSlashInput('/doanhthu ')).toEqual({ token: 'doanhthu', arg: '', hasArg: true });
    expect(parseSlashInput('/doanhthu  tuần trước ')).toEqual({
      token: 'doanhthu',
      arg: 'tuần trước',
      hasArg: true,
    });
  });
});

describe('filterCommands', () => {
  it('không phải lệnh → danh sách rỗng', () => {
    expect(filterCommands('doanh thu hôm nay', 'admin')).toEqual([]);
    expect(filterCommands('', 'admin')).toEqual([]);
  });

  it('"/" liệt kê toàn bộ lệnh của đối tượng (lệnh câu hỏi + lệnh cục bộ)', () => {
    expect(names('/', 'admin')).toEqual(commandsFor('admin').map((c) => c.name));
    expect(names('/', 'admin')).toEqual([
      'doanhthu',
      'banchay',
      'tonkho',
      'kiemquay',
      'calam',
      'ditre',
      'luong',
      'dangkyca',
      'congno',
      'chiphi',
      'moi',
      'morong',
      'phien',
      'trogiup',
    ]);
    expect(names('/', 'staff')).toEqual([
      'lichlam',
      'luong',
      'dangkyca',
      'doica',
      'catrong',
      'moi',
      'morong',
      'phien',
      'trogiup',
    ]);
    expect(names('/', 'customer')).toEqual([
      'sanpham',
      'conhang',
      'diachi',
      'moi',
      'morong',
      'phien',
      'trogiup',
    ]);
  });

  it('lọc theo tiền tố tên lệnh, không phân biệt hoa thường', () => {
    expect(names('/doanh', 'admin')).toEqual(['doanhthu']);
    expect(names('/DOANH', 'admin')).toEqual(['doanhthu']);
    expect(names('/mo', 'admin').slice(0, 2)).toEqual(['moi', 'morong']);
  });

  it('gõ có dấu vẫn khớp tên lệnh không dấu', () => {
    expect(names('/lương', 'admin')[0]).toBe('luong');
    expect(names('/tồn', 'admin')).toContain('tonkho');
    expect(names('/trễ', 'admin')).toContain('ditre');
  });

  it('khớp cả tên tắt (alias)', () => {
    expect(names('/new', 'customer')).toEqual(['moi']);
    expect(names('/expand', 'staff')).toEqual(['morong']);
    expect(names('/help', 'admin')).toEqual(['trogiup']);
  });

  it('khớp theo tên hiển thị / mô tả', () => {
    // "quầy" nằm trong mô tả của /kiemquay; "nợ" trong tên hiển thị của /congno.
    expect(names('/quầy', 'admin')).toContain('kiemquay');
    expect(names('/sao', 'admin')).toContain('phien'); // "Sao chép mã phiên"
    expect(names('/noibat', 'customer')).toContain('sanpham'); // "…sản phẩm nổi bật"
  });

  it('tên khớp chính xác đứng trước các kết quả khớp lỏng hơn', () => {
    expect(names('/luong', 'admin')[0]).toBe('luong');
    expect(names('/moi', 'admin')[0]).toBe('moi');
  });

  it('bộ gõ Telex nuốt phím (ditre → dỉte, morong → mỏong) vẫn tìm ra lệnh', () => {
    expect(names('/dỉte', 'admin')).toContain('ditre');
    expect(names('/mỏong', 'admin')).toContain('morong');
    expect(names('/cảtong', 'staff')).toContain('catrong');
  });

  it('chỉ trả lệnh của đúng đối tượng', () => {
    expect(names('/doanhthu', 'staff')).toEqual([]);
    expect(names('/doanhthu', 'customer')).toEqual([]);
    expect(names('/lichlam', 'admin')).toEqual([]);
    expect(names('/diachi', 'admin')).toEqual([]);
    // "sản phẩm" có trong mô tả của /banchay (quản trị) nhưng lệnh /sanpham của khách thì không lộ ra.
    expect(names('/sanpham', 'admin')).toEqual(['banchay']);
  });

  it('đang gõ tham số → chỉ còn lệnh có tên đúng bằng chữ đã gõ', () => {
    expect(names('/doanhthu tuần trước', 'admin')).toEqual(['doanhthu']);
    expect(names('/doanh tuần trước', 'admin')).toEqual([]);
    expect(names('/new ', 'admin')).toEqual(['moi']);
  });

  it('không có lệnh nào khớp → rỗng', () => {
    expect(names('/xyzabc', 'admin')).toEqual([]);
    expect(names('/dashboard/pos', 'admin')).toEqual([]);
  });
});

describe('expandCommand', () => {
  it('lệnh cục bộ → { kind: "local" } (tên, tên tắt, hoa thường đều được)', () => {
    expect(expandCommand('/moi', 'admin')).toEqual({ kind: 'local', id: 'new-session' });
    expect(expandCommand('/new', 'customer')).toEqual({ kind: 'local', id: 'new-session' });
    expect(expandCommand('/MOI', 'staff')).toEqual({ kind: 'local', id: 'new-session' });
    expect(expandCommand('/morong', 'admin')).toEqual({ kind: 'local', id: 'toggle-expand' });
    expect(expandCommand('/expand', 'admin')).toEqual({ kind: 'local', id: 'toggle-expand' });
    expect(expandCommand('/phien', 'admin')).toEqual({ kind: 'local', id: 'copy-session' });
    expect(expandCommand('/trogiup', 'admin')).toEqual({ kind: 'local', id: 'help' });
    expect(expandCommand('/help', 'admin')).toEqual({ kind: 'local', id: 'help' });
  });

  it('lệnh câu hỏi không có tham số → câu hỏi mặc định', () => {
    const text = (input: string) => {
      const result = expandCommand(input, 'admin');
      return result?.kind === 'prompt' ? result.text : null;
    };
    expect(text('/doanhthu')).toBe('Doanh thu hôm nay của cửa hàng là bao nhiêu?');
    expect(text('/banchay')).toBe('Top sản phẩm bán chạy 7 ngày qua?');
    expect(text('/tonkho')).toBe('Những sản phẩm nào sắp hết hàng?');
    expect(text('/kiemquay')).toBe(
      'Tình hình quầy tiền hôm nay: tiền bán hàng, thu chi, số dư dự kiến và chênh lệch?'
    );
    expect(text('/calam')).toBe('Hôm nay những ai làm ca nào?');
    expect(text('/ditre')).toBe('Ai đi trễ nhiều nhất tháng này?');
    expect(text('/luong')).toBe('Kỳ lương tháng này đã chốt chưa, tổng quỹ lương bao nhiêu?');
    expect(text('/dangkyca')).toBe(
      'Tình hình đăng ký ca tuần tới thế nào, còn ca nào thiếu người?'
    );
    expect(text('/congno')).toBe('Khách nào đang nợ nhiều nhất?');
    expect(text('/chiphi')).toBe('Chi phí tháng này gồm những khoản nào?');
  });

  it('lệnh câu hỏi có tham số → tham số được đặt vào câu', () => {
    const text = (input: string) => {
      const result = expandCommand(input, 'admin');
      return result?.kind === 'prompt' ? result.text : null;
    };
    expect(text('/doanhthu tuần trước')).toBe('Doanh thu tuần trước của cửa hàng là bao nhiêu?');
    expect(text('/banchay tháng 9')).toBe('Top sản phẩm bán chạy tháng 9?');
    expect(text('/tonkho kẹp tóc nơ')).toBe('Tồn kho của kẹp tóc nơ?');
    expect(text('/kiemquay hôm qua')).toBe(
      'Tình hình quầy tiền hôm qua: tiền bán hàng, thu chi, số dư dự kiến và chênh lệch?'
    );
    // Tham số đứng đầu câu → viết hoa chữ đầu.
    expect(text('/calam ngày mai')).toBe('Ngày mai những ai làm ca nào?');
    expect(text('/ditre tuần này')).toBe('Ai đi trễ nhiều nhất tuần này?');
    expect(text('/luong tháng 9')).toBe('Kỳ lương tháng 9 đã chốt chưa, tổng quỹ lương bao nhiêu?');
    expect(text('/chiphi quý 3')).toBe('Chi phí quý 3 gồm những khoản nào?');
  });

  it('khoảng trắng thừa quanh tham số được bỏ', () => {
    expect(expandCommand('  /doanhthu    hôm qua   ', 'admin')).toEqual({
      kind: 'prompt',
      text: 'Doanh thu hôm qua của cửa hàng là bao nhiêu?',
    });
  });

  it('lệnh không khai báo tham số mà vẫn gõ thêm chữ → nối vào sau câu hỏi', () => {
    expect(expandCommand('/congno chỉ tính tháng này', 'admin')).toEqual({
      kind: 'prompt',
      text: 'Khách nào đang nợ nhiều nhất? chỉ tính tháng này',
    });
  });

  it('cùng tên lệnh nhưng mỗi đối tượng một câu hỏi', () => {
    expect(expandCommand('/luong', 'staff')).toEqual({
      kind: 'prompt',
      text: 'Lương tháng này của tôi tạm tính bao nhiêu?',
    });
    expect(expandCommand('/luong tháng 9', 'staff')).toEqual({
      kind: 'prompt',
      text: 'Lương tháng 9 của tôi tạm tính bao nhiêu?',
    });
    expect(expandCommand('/dangkyca', 'staff')).toEqual({
      kind: 'prompt',
      text: 'Tôi muốn đăng ký ca tuần sau, còn những ca nào?',
    });
  });

  it('lệnh của nhân viên', () => {
    const text = (input: string) => {
      const result = expandCommand(input, 'staff');
      return result?.kind === 'prompt' ? result.text : null;
    };
    expect(text('/lichlam')).toBe('Lịch làm của tôi tuần này?');
    expect(text('/lichlam tuần sau')).toBe('Lịch làm của tôi tuần sau?');
    expect(text('/doica')).toBe('Tôi muốn đổi ca, cần làm thế nào?');
    expect(text('/catrong')).toBe('Có ca nào đang cần người nhận không?');
  });

  it('lệnh của khách', () => {
    const text = (input: string) => {
      const result = expandCommand(input, 'customer');
      return result?.kind === 'prompt' ? result.text : null;
    };
    expect(text('/sanpham')).toBe('Cửa hàng có những sản phẩm nào nổi bật?');
    expect(text('/sanpham kẹp tóc')).toBe('Cửa hàng có những sản phẩm nào về kẹp tóc?');
    expect(text('/conhang')).toBe('Tôi muốn hỏi một sản phẩm còn hàng không');
    expect(text('/conhang băng đô nhung')).toBe('Sản phẩm băng đô nhung còn hàng không?');
    expect(text('/diachi')).toBe('Địa chỉ và giờ mở cửa của cửa hàng?');
  });

  it('lệnh của đối tượng khác → null (gửi nguyên văn)', () => {
    expect(expandCommand('/doanhthu', 'staff')).toBeNull();
    expect(expandCommand('/doanhthu', 'customer')).toBeNull();
    expect(expandCommand('/lichlam', 'customer')).toBeNull();
    expect(expandCommand('/sanpham', 'admin')).toBeNull();
  });

  it('không phải lệnh / lệnh lạ / gõ dở tên lệnh → null', () => {
    expect(expandCommand('doanh thu hôm nay', 'admin')).toBeNull();
    expect(expandCommand('/', 'admin')).toBeNull();
    expect(expandCommand('/khongco', 'admin')).toBeNull();
    expect(expandCommand('/doanh', 'admin')).toBeNull();
    expect(expandCommand('/dashboard/pos/report', 'admin')).toBeNull();
  });
});

describe('findCommand / commandUsage', () => {
  it('tìm lệnh theo tên đúng và dựng cách gõ', () => {
    const command = findCommand('/doanhthu tuần trước', 'admin');
    expect(command?.name).toBe('doanhthu');
    expect(command && commandUsage(command)).toBe('/doanhthu [khoảng thời gian]');

    const local = findCommand('/new', 'staff');
    expect(local?.kind).toBe('local');
    expect(local && commandUsage(local)).toBe('/moi');
  });
});
