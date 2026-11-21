export type DemoSessionCheck =
  | { status: 'valid'; expiresAt: number }
  | { status: 'anonymous' }
  | { status: 'unavailable' };

/** A stored token alone is not proof of authentication: ask the mock backend. */
export async function verifyDemoSession(
  token: string | null,
  signal?: AbortSignal,
  request: typeof fetch = fetch
): Promise<DemoSessionCheck> {
  if (!token) return { status: 'anonymous' };
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 8000);
  try {
    const response = await request('/api/mock/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) return { status: 'anonymous' };
    if (!response.ok) return { status: 'unavailable' };
    const result = (await response.json()) as { valid?: boolean; expiresAt?: number };
    if (result.valid !== true) return { status: 'anonymous' };
    if (typeof result.expiresAt !== 'number') return { status: 'unavailable' };
    if (result.expiresAt * 1000 <= Date.now()) return { status: 'anonymous' };
    return { status: 'valid', expiresAt: result.expiresAt };
  } catch {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
export function demoLoginLocation(base: string, target: string): string {
  return `${base}/login?next=${encodeURIComponent(target)}`;
}
export function demoReturnLocation(base: string, next: string | null): string {
  if (!next || !next.startsWith(`${base}/`) || /[\r\n\\]/.test(next)) return base;
  try {
    const parsed = new URL(next, 'http://wallet.invalid');
    if (
      parsed.origin !== 'http://wallet.invalid' ||
      !parsed.pathname.startsWith(`${base}/`) ||
      parsed.pathname.replace(/\/+$/, '') === `${base}/login`
    )
      return base;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return base;
  }
}
