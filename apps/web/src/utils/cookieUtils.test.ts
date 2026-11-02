import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setAuthCookies, getAuthCookie, clearAuthCookies } from './cookieUtils';

describe('cookieUtils', () => {
  let cookieStore: string[] = [];

  beforeEach(() => {
    cookieStore = [];
    // Setup mock document.cookie
    (globalThis as any).document = {
      get cookie() {
        return cookieStore.join('; ');
      },
      set cookie(val: string) {
        const [cookiePair] = val.split(';');
        const [name] = cookiePair.split('=');
        // If expired, remove
        if (val.includes('expires=')) {
          cookieStore = cookieStore.filter((c) => !c.startsWith(`${name.trim()}=`));
        } else {
          cookieStore = cookieStore.filter((c) => !c.startsWith(`${name.trim()}=`));
          cookieStore.push(cookiePair.trim());
        }
      },
    };
    (globalThis as any).window = {
      location: { protocol: 'http:', hostname: 'localhost' },
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
    delete (globalThis as any).window;
  });

  it('sets access_token, loompilot_token, and loompilot_role in document.cookie', () => {
    setAuthCookies('test-jwt-token-123', 'admin');

    expect(getAuthCookie('access_token')).toBe('test-jwt-token-123');
    expect(getAuthCookie('loompilot_token')).toBe('test-jwt-token-123');
    expect(getAuthCookie('loompilot_role')).toBe('admin');
  });

  it('correctly sets and retrieves client role', () => {
    setAuthCookies('client-jwt-456', 'client');

    expect(getAuthCookie('access_token')).toBe('client-jwt-456');
    expect(getAuthCookie('loompilot_role')).toBe('client');
  });

  it('clears all authentication cookies upon clearAuthCookies() call', () => {
    setAuthCookies('temp-token', 'supervisor');
    expect(getAuthCookie('loompilot_token')).toBe('temp-token');

    clearAuthCookies();

    expect(getAuthCookie('access_token')).toBeNull();
    expect(getAuthCookie('loompilot_token')).toBeNull();
    expect(getAuthCookie('loompilot_role')).toBeNull();
  });
});
