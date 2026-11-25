import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

/**
 * Config dari .env.local (lihat .env.example). Tanpa VITE_FIREBASE_PROJECT_ID,
 * atau dengan VITE_USE_EMULATOR=true (npm run dev:emulator), aplikasi memakai
 * emulator dengan project demo-freelance, jadi tidak mungkin menyentuh data asli.
 */
const env = import.meta.env;
const realProjectId: string | undefined = env.VITE_FIREBASE_PROJECT_ID || undefined;

export const USE_EMULATOR = env.VITE_USE_EMULATOR === "true" || !realProjectId;

const app = initializeApp(
  USE_EMULATOR
    ? { apiKey: "demo-key", authDomain: "demo-freelance.firebaseapp.com", projectId: "demo-freelance" }
    : {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: realProjectId,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      },
);

/** Offline persistence menyala (PLAN §8), aman dipakai di banyak tab. */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);

if (USE_EMULATOR) {
  // Hostname halaman, supaya HP di Wi-Fi yang sama mencapai emulator di laptop.
  // Port sama dengan firebase.json (bukan 8080/9099 supaya tidak bentrok dengan repo kasir).
  const host = window.location.hostname;
  connectFirestoreEmulator(db, host, 8180);
  connectAuthEmulator(auth, `http://${host}:9199`, { disableWarnings: true });
}
