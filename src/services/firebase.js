import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, onValue, set } from "firebase/database";

// Configuración Firebase leída desde variables de entorno (.env.local) en build.
// Si falta alguna, el SDK lanza un error claro al inicializar.
// Nota: la apiKey web de Firebase no es secreta por diseño; la seguridad real
// la imponen las reglas de Auth + RTDB (ver Fase 2).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Aviso temprano si el .env no está completo (fail-closed).
for (const [k, v] of Object.entries(firebaseConfig)) {
  if (!v) {
    console.error(`[firebase] Falta variable de entorno para ${k}. Revisa .env.local`);
  }
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export { signInWithEmailAndPassword, signOut, onAuthStateChanged, ref, onValue, set };
