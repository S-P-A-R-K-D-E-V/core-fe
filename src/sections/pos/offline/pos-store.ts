// ----------------------------------------------------------------------
// Kho dữ liệu trên máy của màn bán hàng (POS).
//
// IndexedDB "cici-pos" — ghi hoá đơn với độ bền "strict" (trình duyệt ghi xuống đĩa trước khi báo xong; mặc định của
// Chrome là "relaxed": mất điện có thể mất vài lần ghi cuối). Trình duyệt không mở được IndexedDB (chế độ ẩn danh cũ,
// bị chặn…) → dùng localStorage (`durable = false`, màn hình báo cho thu ngân). Không thêm thư viện: chỉ cần thêm / sửa /
// xoá / đọc hết một kho nhỏ.
// ----------------------------------------------------------------------

export type PosRecord = { id: string };

export interface PosKvStore<T extends PosRecord> {
  /** true = IndexedDB (ghi bền); false = localStorage / bộ nhớ. */
  readonly durable: boolean;
  getAll(): Promise<T[]>;
  put(value: T): Promise<void>;
  remove(id: string): Promise<void>;
}

export const POS_DB_NAME = 'cici-pos';
const POS_DB_VERSION = 1;
export const POS_STORES = ['outbox', 'meta'] as const;
export type PosStoreName = (typeof POS_STORES)[number];

// ---------------------------------------------------------------------- IndexedDB

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(POS_DB_NAME, POS_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        POS_STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        });
      };
      req.onsuccess = () => {
        const db = req.result;
        // Tab khác nâng phiên bản CSDL → đóng để không chặn nó; lần sau mở lại.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB bị chặn bởi tab khác'));
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

function requestToPromise<R>(req: IDBRequest<R>): Promise<R> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Giao dịch IndexedDB bị huỷ'));
  });
}

function writeTx(db: IDBDatabase, name: string): IDBTransaction {
  try {
    // "strict": chỉ báo xong khi đã ghi xuống đĩa — hoá đơn khách đã trả tiền không được mất khi mất điện.
    return db.transaction(name, 'readwrite', { durability: 'strict' } as IDBTransactionOptions);
  } catch {
    return db.transaction(name, 'readwrite');
  }
}

function idbStore<T extends PosRecord>(name: PosStoreName): PosKvStore<T> {
  return {
    durable: true,
    async getAll() {
      const db = await openDb();
      return requestToPromise(db.transaction(name, 'readonly').objectStore(name).getAll()) as Promise<T[]>;
    },
    async put(value) {
      const db = await openDb();
      const tx = writeTx(db, name);
      tx.objectStore(name).put(value);
      await txDone(tx);
    },
    async remove(id) {
      const db = await openDb();
      const tx = writeTx(db, name);
      tx.objectStore(name).delete(id);
      await txDone(tx);
    },
  };
}

// ---------------------------------------------------------------------- localStorage / bộ nhớ

export function localStorageStore<T extends PosRecord>(key: string): PosKvStore<T> {
  const read = (): T[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.id === 'string') : [];
    } catch {
      return [];
    }
  };
  const write = (rows: T[]) => {
    if (rows.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(rows));
  };
  return {
    durable: false,
    async getAll() {
      return read();
    },
    async put(value) {
      write([...read().filter((r) => r.id !== value.id), value]);
    },
    async remove(id) {
      write(read().filter((r) => r.id !== id));
    },
  };
}

export function memoryStore<T extends PosRecord>(initial: T[] = []): PosKvStore<T> {
  let rows = [...initial];
  return {
    durable: false,
    async getAll() {
      return rows.map((r) => ({ ...r }));
    },
    async put(value) {
      rows = [...rows.filter((r) => r.id !== value.id), { ...value }];
    },
    async remove(id) {
      rows = rows.filter((r) => r.id !== id);
    },
  };
}

// ---------------------------------------------------------------------- chọn kho

/** IndexedDB nếu mở được, không thì localStorage (khoá `pos_<tên kho>`). */
export async function openPosStore<T extends PosRecord>(name: PosStoreName): Promise<PosKvStore<T>> {
  if (typeof indexedDB !== 'undefined') {
    try {
      await openDb();
      return idbStore<T>(name);
    } catch (err) {
      console.warn('Không mở được IndexedDB — dùng localStorage cho', name, err);
    }
  }
  return localStorageStore<T>(`pos_${name}`);
}

/** Xin trình duyệt không tự dọn dữ liệu của trang khi thiếu dung lượng (hoá đơn chưa gửi nằm trong đó). */
export function requestPersistentStorage() {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    // trình duyệt cũ — bỏ qua
  }
}
