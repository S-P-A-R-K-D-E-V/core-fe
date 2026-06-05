// Build a displayable URL from a storage path or legacy full URL.
// objectKey: "avatars/userId/timestamp.jpg"  → "/media/avatars/userId/timestamp.jpg"
// Legacy full URL (http/https): returned as-is (backward compat with old DB entries)
export function getStorageUrl(path?: string | null): string {
  if (!path) return '';
  // Already an absolute URL (Google, legacy R2 full URL, etc.) → use as-is
  if (path.startsWith('http')) return path;
  // Already converted to proxy path → use as-is (prevent double /media/media/)
  if (path.startsWith('/media/')) return path;
  // HOST_API is empty in production; relative URL routes via nginx → Next.js rewrite → core-api
  const base = (process.env.NEXT_PUBLIC_HOST_API ?? '').replace(/\/$/, '');
  return `${base}/media/${path}`;
}
