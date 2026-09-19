// =============================================================
// FIREBASE CONFIGURATION
// Replace the placeholder values below with your actual
// Firebase project config from:
// Firebase Console → Project Settings → Your apps → SDK setup
// =============================================================

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyCqwdwxpR8X9qqCCG696m2jiQ0qHzdznk0",
  authDomain: "study-time-tracker-321c4.firebaseapp.com",
  projectId: "study-time-tracker-321c4",
  storageBucket: "study-time-tracker-321c4.firebasestorage.app",
  messagingSenderId: "271980708508",
  appId: "1:271980708508:web:9c9788fe706185339e2359",
}

const app = initializeApp(firebaseConfig)

/** Firestore database instance */
export const db = getFirestore(app)

/** Firebase Auth instance */
export const auth = getAuth(app)

/** Google Auth Provider */
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

/** Firebase Storage instance - lazy getter to avoid bloating initial bundle */
let _storage = null
export async function getStorageInstance() {
  if (!_storage) {
    const { getStorage } = await import('firebase/storage')
    _storage = getStorage(app)
  }
  return _storage
}

export default app

// =============================================================
// FIRESTORE SECURITY RULES
// Paste these rules in Firebase Console → Firestore → Rules
// =============================================================
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection: each user can only read/write their own doc
    match /users/{userId} {
      allow read: if true;
      allow create: if request.resource.data.name == userId;
      allow update, delete: if resource.data.name == userId;
    }

    // Sessions collection: users can only write sessions with their own userName
    match /sessions/{sessionId} {
      allow read: if true;
      allow create: if request.resource.data.userName is string
                    && request.resource.data.userName.size() > 0;
      allow update, delete: if resource.data.userName == request.resource.data.userName;
    }
  }
}
*/

// =============================================================
// FIREBASE STORAGE SECURITY RULES
// Paste these rules in Firebase Console → Storage → Rules
//
// NOTE: Since this app uses name-based auth (no Firebase Auth),
// true per-user enforcement on Storage is not possible at the
// rules level without Firebase Auth tokens. The rule below
// allows read/write only under the screenshots/ path. This is
// a known limitation of name-based auth — treat it as a
// development/demo setup. For production, integrate Firebase
// Authentication for proper security.
// =============================================================
/*
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow read/write only under the screenshots directory
    match /screenshots/{userName}/{allPaths=**} {
      allow read: if true;
      allow write: if true; // In production: use Firebase Auth to restrict per userName
    }
    // Deny everything else
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
*/
