import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, onValue, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBmkZQqvBouJV3bXQDakaBHPAn32WzL1sY",
  authDomain: "sistemahorario-5e4bc.firebaseapp.com",
  projectId: "sistemahorario-5e4bc",
  storageBucket: "sistemahorario-5e4bc.firebasestorage.app",
  messagingSenderId: "620934500570",
  appId: "1:620934500570:web:6018c270872c1f3da4d5e3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export { signInWithEmailAndPassword, signOut, onAuthStateChanged, ref, onValue, set };
