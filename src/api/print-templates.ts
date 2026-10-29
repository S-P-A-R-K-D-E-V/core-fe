import axios, { endpoints } from 'src/utils/axios';

import type {
  IPrintTemplate,
  PrintTemplateKind,
  IPrintTemplateList,
  IPrintTemplatePayload,
  IPrintTemplateAssignment,
  IPrintTemplateAssignmentInput,
} from 'src/types/print-template';

// ----------------------------------------------------------------------
// Mẫu in hoá đơn / tem mã. Đọc: mọi nhân viên + máy quầy. Ghi: quyền sales.print-template.manage.
// ----------------------------------------------------------------------

export async function getPrintTemplates(kind?: PrintTemplateKind): Promise<IPrintTemplateList> {
  const response = await axios.get<IPrintTemplateList>(endpoints.printTemplates.list, {
    params: kind ? { kind } : undefined,
  });
  return {
    templates: response.data?.templates ?? [],
    assignments: response.data?.assignments ?? [],
  };
}

export async function getPrintTemplate(id: string): Promise<IPrintTemplate> {
  const response = await axios.get<IPrintTemplate>(endpoints.printTemplates.details(id));
  return response.data;
}

export async function createPrintTemplate(
  kind: PrintTemplateKind,
  payload: IPrintTemplatePayload
): Promise<IPrintTemplate> {
  const response = await axios.post<IPrintTemplate>(endpoints.printTemplates.list, {
    kind,
    ...payload,
  });
  return response.data;
}

export async function updatePrintTemplate(
  id: string,
  payload: IPrintTemplatePayload
): Promise<IPrintTemplate> {
  const response = await axios.put<IPrintTemplate>(endpoints.printTemplates.details(id), payload);
  return response.data;
}

export async function deletePrintTemplate(id: string): Promise<void> {
  await axios.delete(endpoints.printTemplates.details(id));
}

/** Ghi đè cả bảng mẫu đang áp dụng của một loại. */
export async function setPrintTemplateAssignments(
  kind: PrintTemplateKind,
  assignments: IPrintTemplateAssignmentInput[]
): Promise<IPrintTemplateAssignment[]> {
  const response = await axios.put<IPrintTemplateAssignment[]>(
    endpoints.printTemplates.assignments(kind),
    {
      assignments,
    }
  );
  return response.data ?? [];
}
