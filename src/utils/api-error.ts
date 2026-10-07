// ----------------------------------------------------------------------
// axios (src/utils/axios.ts) reject bằng BODY của response, không phải AxiosError. Body có thể là:
//  - ValidationProblem: { title, errors: { [mã lỗi]: [mô tả] } }  (ErrorOr lỗi Validation)
//  - Problem:           { title: mô tả, status }                  (ErrorOr lỗi khác)
//  - { message }                                                  (BadRequest tự viết)
// ----------------------------------------------------------------------

export function apiErrorMessage(err: any, fallback: string): string {
  if (!err) return fallback;
  // Đường không được proxy sang BE (next.config.mjs BACKEND_API_PREFIXES) → body là trang HTML của Next: không in ra
  // toast.
  if (typeof err === 'string') return /^\s*</.test(err) ? fallback : err;

  if (err.errors && typeof err.errors === 'object') {
    const first = Object.values(err.errors as Record<string, unknown>).flat()[0];
    if (typeof first === 'string' && first) return first;
  }

  return err.message || err.detail || err.title || fallback;
}

// Mã lỗi máy đọc được (vd. 'Auth.ProviderAlreadyLinked') nằm ở chỗ khác nhau tuỳ dạng body:
//  - Problem (ErrorOr Conflict/NotFound…): errorCodes: ['Mã.Lỗi']   (CoreCmsProblemDetailsFactory)
//  - ValidationProblem:                    khoá của errors: { 'Mã.Lỗi': [...] }
//  - { error: 'Mã.Lỗi', message }          (403 tự viết, vd. Kiểm quầy)
export function hasApiErrorCode(err: any, code: string): boolean {
  if (!err || typeof err !== 'object') return false;
  if (Array.isArray(err.errorCodes) && err.errorCodes.includes(code)) return true;
  if (
    err.errors &&
    typeof err.errors === 'object' &&
    !Array.isArray(err.errors) &&
    code in err.errors
  ) {
    return true;
  }
  return err.error === code || err.code === code;
}
