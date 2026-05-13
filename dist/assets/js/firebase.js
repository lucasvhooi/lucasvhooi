import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
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
export const db          = getDatabase(firebaseApp);
export const storage     = getStorage(firebaseApp);
export const auth        = getAuth(firebaseApp);

// App Check loaded dynamically so a failure can't crash this module.
import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js")
  .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider("6LfVwegsAAAAAFRwgrQVA5cqRRsFX_j2gOjt26bz"),
      isTokenAutoRefreshEnabled: true
    });
  })
  .catch(() => {});
