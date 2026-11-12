import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
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
import { deleteOwnProfile, saveNewMember, updateMember } from './api.js';

// Phones and emails shouldn't stay on a shared device after logging out or deleting an account.
async function clearLocalDataAndReload() {
  await terminate(db);
  await clearIndexedDbPersistence(db).catch(() => {});
  window.location.reload();
}

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading, null = signed out
  const [member, setMember] = useState(undefined); // undefined = still loading, null = no doc
  const [banned, setBanned] = useState(undefined); // undefined = still loading
  const [isAdmin, setIsAdmin] = useState(false);
  const signingUp = useRef(false);
  const deleting = useRef(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Wait until we know the user isn't removed: the rules refuse a removed person's reads,
  // and a refused listener stops for good, so it has to start again after a ban is lifted.
  useEffect(() => {
    if (!user || banned !== false) {
      setMember(undefined);
      return undefined;
    }
    return onSnapshot(
      doc(db, 'members', user.uid),
      (snap) => {
        // A missing doc in the cache proves nothing, so wait for the server's answer.
        // While deleting an account, the profile goes before the login does. Don't flash the "finish your profile" screen.
        if (!snap.exists() && (snap.metadata.fromCache || signingUp.current || deleting.current)) return;
        const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        setMember(data);
        // After a verified email change, the Auth email is newer than the profile. Catch up here.
        if (data && user.email && data.email !== user.email) {
          updateMember(user.uid, { email: user.email }).catch(() => {});
        }
      },
      (error) => console.error(error),
    );
  }, [user, banned]);

  // Admins live in admins/{uid}, set up in the Firebase console. Bans live in bans/{uid}.
  useEffect(() => {
    if (!user) {
      setBanned(undefined);
      setIsAdmin(false);
      return undefined;
    }
    const stopBan = onSnapshot(
      doc(db, 'bans', user.uid),
      (snap) => setBanned(snap.exists()),
      (error) => {
        console.error(error);
        setBanned(false);
      },
    );
    const stopAdmin = onSnapshot(
      doc(db, 'admins', user.uid),
      (snap) => setIsAdmin(snap.exists()),
      // A removed person can't read this, and that's fine: they aren't an admin.
      () => setIsAdmin(false),
    );
    return () => {
      stopBan();
      stopAdmin();
    };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      member,
      banned,
      isAdmin,
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
        await clearLocalDataAndReload();
      },
      // Permanently deletes the signed-in person's profile and login. Asks for the password first:
      // Firebase needs a recent login to delete one, and it stops a borrowed, unlocked device doing it.
      async deleteAccount(password, unfinishedTaskIds) {
        const current = auth.currentUser;
        await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
        deleting.current = true;
        let profileGone = false;
        try {
          await deleteOwnProfile(current.uid, unfinishedTaskIds);
          profileGone = true;
          await deleteUser(current);
        } catch (e) {
          deleting.current = false;
          // If the profile went but the login didn't, show the "finish your profile" screen rather than a stale page.
          if (profileGone) setMember(null);
          throw e;
        }
        await clearLocalDataAndReload();
      },
    }),
    [user, member, banned, isAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
