import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Màn hình khách ở quầy — slide quảng cáo (core-be CustomerDisplayController). Ảnh / video PUT thẳng lên kho file bằng
// URL ký sẵn (không đi qua API), slide lưu object key; hiển thị qua /media/<key> (getStorageUrl).

/** url: chỉ có trong phản hồi — link tải có chữ ký (24 giờ), không gửi lên khi lưu. */
export type CustomerDisplaySlideDto = { key: string; kind: 'image' | 'video'; title?: string | null; url?: string | null };

export type CustomerDisplayConfigDto = {
  branchId: string | null;
  intervalSeconds: number;
  slides: CustomerDisplaySlideDto[];
  isBranchOverride: boolean;
};

export async function getCustomerDisplayConfig(branchId?: string | null): Promise<CustomerDisplayConfigDto> {
  const res = await axios.get<CustomerDisplayConfigDto>(endpoints.customerDisplay.config, {
    params: branchId ? { branchId } : undefined,
  });
  return res.data;
}

export async function getCustomerDisplaySettings(): Promise<CustomerDisplayConfigDto[]> {
  const res = await axios.get<CustomerDisplayConfigDto[]>(endpoints.customerDisplay.settings);
  return res.data;
}

export async function saveCustomerDisplaySettings(body: {
  branchId: string | null;
  intervalSeconds: number;
  slides: CustomerDisplaySlideDto[];
}): Promise<CustomerDisplayConfigDto> {
  const res = await axios.put<CustomerDisplayConfigDto>(endpoints.customerDisplay.settings, body);
  return res.data;
}

export async function deleteCustomerDisplayBranch(branchId: string): Promise<void> {
  await axios.delete(endpoints.customerDisplay.branchSettings(branchId));
}

type Presigned = { objectKey: string; uploadUrl: string; kind: 'image' | 'video' };

/** Tải ảnh / video lên kho file, trả slide (key + loại) để thêm vào danh sách. */
export async function uploadCustomerDisplayMedia(files: File[]): Promise<CustomerDisplaySlideDto[]> {
  const res = await axios.post<Presigned[]>(endpoints.customerDisplay.presign, {
    files: files.map((f) => ({ fileName: f.name, contentType: f.type, sizeBytes: f.size })),
  });
  await Promise.all(
    res.data.map(async (p, i) => {
      const put = await fetch(p.uploadUrl, { method: 'PUT', body: files[i], headers: { 'Content-Type': files[i].type } });
      if (!put.ok) throw new Error(`Tải "${files[i].name}" lên không được (${put.status}).`);
    })
  );
  return res.data.map((p) => ({ key: p.objectKey, kind: p.kind, title: null }));
}
