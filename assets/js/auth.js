'use strict';

/** SHA-256 a string, returns lowercase hex */
export async function hashPassword(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Read the current session from localStorage */
export function getSession() {
  try { return JSON.parse(localStorage.getItem('playerSession')) || null; }
  catch { return null; }
}

/** Persist a session object { id, username, role, color } */
export function saveSession(data) {
  localStorage.setItem('playerSession', JSON.stringify(data));
  // Keep legacy isAdmin flag so existing pages keep working
  if (data.role === 'admin') {
    localStorage.setItem('isAdmin', 'true');
  } else {
    localStorage.removeItem('isAdmin');
  }
}

/** Wipe session */
export function clearSession() {
  localStorage.removeItem('playerSession');
  localStorage.removeItem('isAdmin');
}

/**
 * Redirect to login if no session, otherwise return the session.
 * Call at the top of any page that requires authentication.
 */
export function requireLogin() {
  const s = getSession();
  if (!s) { window.location.href = 'login.html'; return null; }
  return s;
}
