'use strict';

import { auth }                from "./firebase.js";
import { signOut as _signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

/** SHA-256 a string — kept for the inventory password-change flow */
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
  if (data.role === 'admin') {
    localStorage.setItem('isAdmin', 'true');
  } else {
    localStorage.removeItem('isAdmin');
  }
}

/** Wipe local session */
export function clearSession() {
  localStorage.removeItem('playerSession');
  localStorage.removeItem('isAdmin');
}

/** Sign out of Firebase Auth and wipe the local session */
export async function signOutUser() {
  clearSession();
  try { await _signOut(auth); } catch (_) {}
}

/** Redirect to login if no session, otherwise return the session */
export function requireLogin() {
  const s = getSession();
  if (!s) { window.location.href = 'login.html'; return null; }
  return s;
}
