import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { clearIndexedDbPersistence, doc, onSnapshot, terminate } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { saveNewMember, updateMember } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading, null = signed out
  const [member, setMember] = useState(undefined); // undefined = still loading, null = no doc
  const signingUp = useRef(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setMember(undefined);
      return undefined;
    }
    return onSnapshot(
      doc(db, 'members', user.uid),
      (snap) => {
        // A missing doc in the cache proves nothing, so wait for the server's answer.
        if (!snap.exists() && (snap.metadata.fromCache || signingUp.current)) return;
        const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        setMember(data);
        // After a verified email change, the Auth email is newer than the profile. Catch up here.
        if (data && user.email && data.email !== user.email) {
          updateMember(user.uid, { email: user.email }).catch(() => {});
        }
      },
      (error) => console.error(error),
    );
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      member,
      async logIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signUp({ name, phone, email, password }) {
        signingUp.current = true;
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await saveNewMember(cred.user.uid, { name, phone, email: cred.user.email });
        } finally {
          signingUp.current = false;
        }
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email);
      },
      // Returns 'updated', or 'verification-sent' when the project requires the new address to be confirmed first.
      async changeEmail(email, password) {
        const current = auth.currentUser;
        if (password) {
          await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
        }
        try {
          await updateEmail(current, email);
          await current.getIdToken(true);
          return 'updated';
        } catch (e) {
          if (e.code !== 'auth/operation-not-allowed') throw e;
          await verifyBeforeUpdateEmail(current, email);
          return 'verification-sent';
        }
      },
      async logOut() {
        await signOut(auth);
        // Phones and emails shouldn't stay on a shared device after logging out.
        await terminate(db);
        await clearIndexedDbPersistence(db).catch(() => {});
        window.location.reload();
      },
    }),
    [user, member],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
