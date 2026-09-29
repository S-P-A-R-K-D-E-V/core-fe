// ----------------------------------------------------------------------
// axios (src/utils/axios.ts) reject bằng BODY của response, không phải AxiosError. Body có thể là:
//  - ValidationProblem: { title, errors: { [mã lỗi]: [mô tả] } }  (ErrorOr lỗi Validation)
//  - Problem:           { title: mô tả, status }                  (ErrorOr lỗi khác)
//  - { message }                                                  (BadRequest tự viết)
// ----------------------------------------------------------------------

export function apiErrorMessage(err: any, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  if (err.errors && typeof err.errors === 'object') {
    const first = Object.values(err.errors as Record<string, unknown>).flat()[0];
    if (typeof first === 'string' && first) return first;
  }

  return err.message || err.detail || err.title || fallback;
}
