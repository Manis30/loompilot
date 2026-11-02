/**
 * LoomPilot Authentication Cookie Helpers
 * Supports synchronous storage and removal of access tokens and role identifiers across portals.
 */

export function setAuthCookies(token: string, role: string): void {
  if (typeof document === 'undefined') return;

  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
  const sameSite = '; SameSite=Lax';

  document.cookie = `access_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}${sameSite}${secureFlag}`;
  document.cookie = `loompilot_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}${sameSite}${secureFlag}`;
  document.cookie = `loompilot_role=${encodeURIComponent(role)}; path=/; max-age=${maxAge}${sameSite}${secureFlag}`;
}

export function getAuthCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const item of cookies) {
    const trimmed = item.trim();
    if (trimmed.startsWith(`${name}=`)) {
      try {
        return decodeURIComponent(trimmed.slice(name.length + 1));
      } catch {
        return trimmed.slice(name.length + 1);
      }
    }
  }
  return null;
}

export function clearAuthCookies(): void {
  if (typeof document === 'undefined') return;

  const cookieNames = [
    'access_token',
    'loompilot_token',
    'loompilot_role',
    'refreshToken',
    'refreshToken_global',
    'accessToken',
  ];

  const paths = ['/', '/api/v1', '/api/v1/auth', '/api/v1/client/auth'];
  const host = window.location.hostname;
  const domains = ['', host, `.${host}`];

  for (const name of cookieNames) {
    for (const path of paths) {
      for (const domain of domains) {
        const domainAttr = domain ? `; domain=${domain}` : '';
        document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT${domainAttr}; SameSite=Lax`;
      }
    }
  }
}

