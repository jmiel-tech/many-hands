import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase.config.js';

const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

export const isConfigured = useEmulator || !firebaseConfig.apiKey.startsWith('YOUR_');

let auth = null;
let db = null;

if (isConfigured) {
  const app = initializeApp(
    useEmulator ? { apiKey: 'demo', projectId: 'demo-many-hands', appId: 'demo' } : firebaseConfig,
  );
  auth = getAuth(app);
  // Keeps the last-seen data on the device so the app still shows it when offline.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

export { auth, db };
