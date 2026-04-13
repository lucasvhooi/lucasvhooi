import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDatabase }   from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const firebaseConfig = {
  apiKey:            "AIzaSyA5ZZtiseeYEjOytjVnBcZkDW7oELEYRqQ",
  authDomain:        "dedikkednd.firebaseapp.com",
  databaseURL:       "https://dedikkednd-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "dedikkednd",
  storageBucket:     "dedikkednd.firebasestorage.app",
  messagingSenderId: "621891313165",
  appId:             "1:621891313165:web:15e3f2ce3be42a75a7bf44"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db          = getDatabase(firebaseApp);
