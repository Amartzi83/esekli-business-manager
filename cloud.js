// The connection to Firebase: sign-in, the shared business account, invite links and live data.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {
  browserLocalPersistence, createUserWithEmailAndPassword, getRedirectResult, GoogleAuthProvider, initializeAuth, onAuthStateChanged,
  browserPopupRedirectResolver, indexedDBLocalPersistence, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut as authSignOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {
  arrayRemove, arrayUnion, clearIndexedDbPersistence, collection, deleteDoc, deleteField, doc, getDoc, getDocs, initializeFirestore, onSnapshot,
  persistentLocalCache, persistentMultipleTabManager, query, serverTimestamp, setDoc, terminate, Timestamp, updateDoc, where, writeBatch
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js?v=19';
import { createSync, docIdFor } from './sync.js?v=19';

const SYNCED = [
  { id:'tasks', key:'esekli-tasks-v1', kind:'list' },
  { id:'visits', key:'esekli-garden-visits-v2', kind:'list' },
  { id:'calendar', key:'esekli-calendar-v1', kind:'list' },
  { id:'shopping', key:'esekli-shopping-v1', kind:'list' },
  { id:'reminders', key:'esekli-reminders-v1', kind:'list' },
  { id:'customers', key:'esekli-customers-v1', kind:'list' },
  { id:'workday', key:'esekli-workday-v1', kind:'object' }
];
const ACCOUNT_KEY = 'esekli-account';
const INVITE_DAYS = 7;
const MAX_PHOTO_CHARS = 900000;
const PHOTO_PATTERN = /^data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+$/;
const toast = message => window.showToast?.(message);

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, { persistence:[indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver:browserPopupRedirectResolver });
const db = initializeFirestore(app, { localCache:persistentLocalCache({ tabManager:persistentMultipleTabManager() }) });
// Identifies this open copy of the app, so its own writes are not applied twice when they come back.
const clientId = crypto.randomUUID();

let workspaceId = null;
let sync = null;
const unsubscribers = [];

const workspaceRef = id => doc(db, 'workspaces', id);
const userRef = uid => doc(db, 'users', uid);
const inviteRef = (id, token) => doc(db, 'workspaces', id, 'invites', token);

function wipeLocalData() {
  SYNCED.forEach(item => localStorage.removeItem(item.key));
  localStorage.removeItem('esekli-last-export');
  localStorage.removeItem(ACCOUNT_KEY);
  indexedDB.deleteDatabase('esekli-history');
  indexedDB.deleteDatabase('esekli-garden-photos');
}

function shrinkPhoto(data) {
  if (data.length <= MAX_PHOTO_CHARS) return Promise.resolve(data);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      let scale = Math.sqrt(MAX_PHOTO_CHARS / data.length) * .9;
      let result = data;
      for (let attempt = 0; attempt < 5 && result.length > MAX_PHOTO_CHARS; attempt++) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        result = canvas.toDataURL('image/jpeg', .72);
        scale *= .8;
      }
      resolve(result);
    };
    image.onerror = reject;
    image.src = data;
  });
}

const friendlyError = () => toast('השמירה לענן נכשלה. בדקו את החיבור ונסו שוב.');

// What the rest of the app talks to once a business is open.
function publishBridge() {
  window.esekliCloud = {
    push:(key, raw) => sync.push(key, raw),
    flush:() => Promise.race([sync.flush(), new Promise(resolve => setTimeout(resolve, 1500))]),
    async photo(op, photo) {
      const ref = doc(db, 'workspaces', workspaceId, 'photos', encodeURIComponent(photo.id));
      try {
        if (op === 'delete') { await deleteDoc(ref); return; }
        const data = await shrinkPhoto(photo.data);
        await setDoc(ref, { id:photo.id, visitId:photo.visitId, data, createdAt:photo.createdAt || Date.now(), updatedBy:auth.currentUser.uid, client:clientId });
      } catch { toast('שמירת התמונה בענן נכשלה.'); }
    }
  };
  window.addEventListener('pagehide', () => sync.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sync.flush(); });
}

export const cloud = {
  // Sign-in
  onUser:callback => onAuthStateChanged(auth, callback),
  currentUser:() => auth.currentUser,
  redirectResult:() => getRedirectResult(auth),
  signIn:(email, password) => signInWithEmailAndPassword(auth, email, password),
  async signUp(name, email, password) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName:name });
    return user;
  },
  resetPassword:email => sendPasswordResetEmail(auth, email),
  async google() {
    const provider = new GoogleAuthProvider();
    const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (installed) return signInWithRedirect(auth, provider);
    try { return await signInWithPopup(auth, provider); }
    catch (error) {
      if (error.code === 'auth/popup-blocked') return signInWithRedirect(auth, provider);
      throw error;
    }
  },
  async signOut() {
    await window.esekliCloud?.flush();
    unsubscribers.splice(0).forEach(stop => stop());
    await authSignOut(auth);
    wipeLocalData();
    try { await terminate(db); await clearIndexedDbPersistence(db); } catch {}
    location.replace(location.pathname);
  },

  // The business account
  async profile(uid) {
    const snapshot = await getDoc(userRef(uid));
    return snapshot.exists() ? snapshot.data() : {};
  },
  async createWorkspace(name) {
    const user = auth.currentUser;
    const ref = doc(collection(db, 'workspaces'));
    const batch = writeBatch(db);
    batch.set(ref, { name, ownerId:user.uid, memberIds:[user.uid], members:{ [user.uid]:{ name:user.displayName || '', email:user.email || '', role:'owner', joinedAt:Date.now() } }, createdAt:serverTimestamp() });
    batch.set(userRef(user.uid), { workspaceId:ref.id, email:user.email || '' }, { merge:true });
    await batch.commit();
    return ref.id;
  },
  async workspace(id) {
    const snapshot = await getDoc(workspaceRef(id));
    return snapshot.exists() ? { id, ...snapshot.data() } : null;
  },
  forgetWorkspace:uid => setDoc(userRef(uid), { workspaceId:null }, { merge:true }),
  watchWorkspace(id, callback) {
    const stop = onSnapshot(workspaceRef(id), snapshot => callback(snapshot.exists() ? { id, ...snapshot.data() } : null), () => location.reload());
    unsubscribers.push(stop);
  },
  renameWorkspace:(id, name) => updateDoc(workspaceRef(id), { name }),
  removeMember:(id, uid) => updateDoc(workspaceRef(id), { memberIds:arrayRemove(uid), [`members.${uid}`]:deleteField() }),
  async leaveWorkspace(id) {
    const uid = auth.currentUser.uid;
    const batch = writeBatch(db);
    batch.update(workspaceRef(id), { memberIds:arrayRemove(uid), [`members.${uid}`]:deleteField() });
    batch.set(userRef(uid), { workspaceId:null }, { merge:true });
    await batch.commit();
    wipeLocalData();
    location.replace(location.pathname);
  },

  // Invite links: secret, single use and valid for a limited time.
  async createInvite(id, workspaceName) {
    const user = auth.currentUser;
    const token = [...crypto.getRandomValues(new Uint8Array(24))].map(value => value.toString(16).padStart(2, '0')).join('');
    await setDoc(inviteRef(id, token), {
      workspaceName, createdBy:user.uid, createdByName:user.displayName || user.email || '',
      expiresAt:Timestamp.fromMillis(Date.now() + INVITE_DAYS * 86400000), usedBy:null, usedAt:null, createdAt:serverTimestamp()
    });
    return `${location.origin}/?invite=${id}.${token}`;
  },
  async openInvites(id) {
    const snapshot = await getDocs(query(collection(db, 'workspaces', id, 'invites'), where('usedBy', '==', null)));
    return snapshot.docs.map(item => ({ token:item.id, ...item.data() })).filter(item => item.expiresAt.toMillis() > Date.now());
  },
  cancelInvite:(id, token) => deleteDoc(inviteRef(id, token)),
  async readInvite(id, token) {
    const snapshot = await getDoc(inviteRef(id, token));
    if (!snapshot.exists()) return { status:'missing' };
    const invite = snapshot.data();
    if (invite.usedBy) return { status:'used' };
    if (invite.expiresAt.toMillis() < Date.now()) return { status:'expired' };
    return { status:'valid', ...invite };
  },
  async acceptInvite(id, token) {
    const user = auth.currentUser;
    const batch = writeBatch(db);
    batch.update(workspaceRef(id), {
      memberIds:arrayUnion(user.uid), joinToken:token,
      [`members.${user.uid}`]:{ name:user.displayName || '', email:user.email || '', role:'member', joinedAt:Date.now() }
    });
    batch.update(inviteRef(id, token), { usedBy:user.uid, usedAt:serverTimestamp() });
    batch.set(userRef(user.uid), { workspaceId:id, email:user.email || '' }, { merge:true });
    await batch.commit();
  },

  // Opens a business: brings its data onto this device before the screens load.
  open(id) {
    const marker = `${auth.currentUser.uid}:${id}`;
    if (localStorage.getItem(ACCOUNT_KEY) !== marker) wipeLocalData();
    localStorage.setItem(ACCOUNT_KEY, marker);
    workspaceId = id;
    sync = createSync({
      collections:SYNCED,
      commit(writes) {
        const batch = writeBatch(db);
        writes.forEach(write => {
          const ref = doc(db, 'workspaces', id, 'items', docIdFor(write.collection, write.id));
          if (write.op === 'delete') batch.delete(ref);
          else batch.set(ref, { c:write.collection, id:write.id, data:write.json, updatedAt:serverTimestamp(), updatedBy:auth.currentUser.uid, client:clientId });
        });
        return batch.commit();
      },
      setLocal:(key, raw) => { if (raw == null) localStorage.removeItem(key); else localStorage.setItem(key, raw); },
      onRemote:(key, raw) => window.esekliStore?.receiveRemote(key, raw),
      onError:friendlyError
    });
    publishBridge();
    return new Promise((resolve, reject) => {
      let first = true;
      const stop = onSnapshot(collection(db, 'workspaces', id, 'items'), snapshot => {
        sync.applyChanges(snapshot.docChanges().map(change => {
          const data = change.doc.data();
          return { type:change.type, collection:data.c, id:data.id, json:data.data, mine:data.client === clientId };
        }));
        if (first) { first = false; resolve(); }
      }, error => { if (first) { first = false; reject(error); } else location.reload(); });
      unsubscribers.push(stop);
    });
  },
  startPhotos() {
    const stop = onSnapshot(collection(db, 'workspaces', workspaceId, 'photos'), snapshot => {
      snapshot.docChanges().forEach(change => {
        const photo = change.doc.data();
        if (photo.client === clientId) return;
        if (change.type === 'removed') { window.esekliStore?.receivePhoto('delete', photo); return; }
        // Photos are placed into pages as image sources, so only real image data is accepted.
        if (typeof photo.id === 'string' && typeof photo.visitId === 'string' && PHOTO_PATTERN.test(photo.data || '')) {
          window.esekliStore?.receivePhoto('put', { id:photo.id, visitId:photo.visitId, data:photo.data, createdAt:photo.createdAt });
        }
      });
    }, () => {});
    unsubscribers.push(stop);
  }
};
