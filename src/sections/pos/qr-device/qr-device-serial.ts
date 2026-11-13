// ----------------------------------------------------------------------
// Web Serial (Chrome / Edge trên máy tính, trang HTTPS): mở cổng COM của máy QR, ghi byte, đọc byte máy gửi về.
// Kiểu tối thiểu khai báo tại đây — dự án chưa cài @types/w3c-web-serial.
// ----------------------------------------------------------------------

export type SerialPortInfoLike = { usbVendorId?: number; usbProductId?: number };

export interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo(): SerialPortInfoLike;
}

export interface SerialLike {
  requestPort(options?: { filters?: SerialPortInfoLike[] }): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
  addEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void;
  removeEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void;
}

export function getSerial(): SerialLike | null {
  if (typeof navigator === 'undefined') return null;
  return ((navigator as unknown as { serial?: SerialLike }).serial ?? null) as SerialLike | null;
}

/** Trình duyệt có Web Serial (Chrome / Edge máy tính, trang HTTPS hoặc localhost). */
export const isWebSerialSupported = () =>
  typeof window !== 'undefined' && window.isSecureContext !== false && getSerial() !== null;

/** Một lần mở cổng: ghi lệnh + vòng đọc dữ liệu máy gửi về. */
export class SerialLink {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  private readLoop: Promise<void> | null = null;

  private closed = false;

  constructor(
    readonly port: SerialPortLike,
    private readonly onData: (bytes: Uint8Array) => void,
    private readonly onLost: (error: unknown) => void
  ) {}

  async open(baudRate: number) {
    await this.port.open({ baudRate });
    this.readLoop = this.runReadLoop();
  }

  /** Đọc đến khi đóng. Lỗi nhẹ (tràn bộ đệm, lỗi khung) thì cổng tạo luồng đọc mới — đọc tiếp; mất cổng thì báo lên. */
  private async runReadLoop() {
    while (!this.closed && this.port.readable) {
      const reader = this.port.readable.getReader();
      this.reader = reader;
      try {
        let done = false;
        while (!done) {
          // eslint-disable-next-line no-await-in-loop
          const chunk = await reader.read();
          done = chunk.done;
          if (chunk.value && chunk.value.length > 0) this.onData(chunk.value);
        }
        return;
      } catch (error) {
        if (!this.closed && !this.port.readable) {
          this.onLost(error);
          return;
        }
      } finally {
        reader.releaseLock();
        this.reader = null;
      }
    }
  }

  async write(bytes: Uint8Array) {
    if (!this.port.writable) throw new Error('Cổng chưa mở hoặc đã mất kết nối');
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  }

  async close() {
    this.closed = true;
    try {
      await this.reader?.cancel();
    } catch {
      // đã huỷ
    }
    try {
      await this.readLoop;
    } catch {
      // bỏ qua
    }
    try {
      await this.port.close();
    } catch {
      // đã đóng / đã rút cáp
    }
  }
}
