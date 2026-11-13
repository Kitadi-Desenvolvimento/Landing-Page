"use client";

const sessionStorageKey = "kitadi_site_analytics_session";

export function getSiteAnalyticsSessionId() {
  try {
    const stored = window.sessionStorage.getItem(sessionStorageKey);
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;

    const sessionId = window.crypto.randomUUID();
    window.sessionStorage.setItem(sessionStorageKey, sessionId);
    return sessionId;
  } catch {
    return null;
  }
}
