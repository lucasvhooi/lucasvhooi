import { initializeApp }                                  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js";
import { getDatabase }   from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getStorage }    from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBN3EEY-s7AcqF6juJomaG9IhDbikZO-X4",
  authDomain:        "essolis-4ecf2.firebaseapp.com",
  databaseURL:       "https://essolis-4ecf2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "essolis-4ecf2",
  storageBucket:     "essolis-4ecf2.firebasestorage.app",
  messagingSenderId: "363379348199",
  appId:             "1:363379348199:web:c718cc4404398c2fda4842",
  measurementId:     "G-2D5TWN81PW"
};

export const firebaseApp = initializeApp(firebaseConfig);

// ── App Check (abuse protection) ────────────────────────────────────────────
// Attaches an attestation token to every DB/Storage request, so scripted /
// non-browser clients can be blocked once enforcement is turned on in the
// Firebase console. Must be initialized before db/storage/auth are used.
// On localhost we enable a debug token so `npm run dev` keeps working — the
// token is printed to the browser console; register it under App Check → Apps →
// Manage debug tokens. NEVER enable the debug flag on the production domain.
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
export const appCheck = initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider("6Lf30jMtAAAAAGO-5Np5IFQjWi9V8KrLthg-rAHd"),
  isTokenAutoRefresh: true,
});

export const db      = getDatabase(firebaseApp);
export const storage = getStorage(firebaseApp);
export const auth    = getAuth(firebaseApp);
