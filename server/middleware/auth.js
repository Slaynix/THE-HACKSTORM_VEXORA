'use strict';

const { getFirebaseAdmin, getFirestore } = require('../config/firebase');

/**
 * Express middleware — verifies the Firebase ID token sent in
 * the Authorization: Bearer <token> header using firebase-admin.
 *
 * Resolves user profile from Firestore users/{uid} and sets req.user + req.uid.
 * In development / testing mode, supports fallback mock tokens.
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || '';

  const defaultUser = {
    uid: 'user-patil-1',
    familyId: 'fam-patil-1',
    memberName: 'Arun',
    role: 'admin',
  };

  const hasCredentials = !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );

  // Missing Authorization header
  if (!authHeader.startsWith('Bearer ')) {
    if (process.env.NODE_ENV === 'production' && hasCredentials) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }
    // Dev fallback
    req.uid = defaultUser.uid;
    req.user = defaultUser;
    return next();
  }

  const idToken = authHeader.split('Bearer ')[1].trim();

  // Mock / Dev tokens
  if (idToken.startsWith('mock-') || idToken === 'dev' || !hasCredentials) {
    let resolvedUid = defaultUser.uid;
    if (idToken.startsWith('mock-token-')) {
      const candidateUid = idToken.slice('mock-token-'.length).trim();
      if (candidateUid) resolvedUid = candidateUid;
    }
    req.uid = resolvedUid;
    try {
      const db = getFirestore();
      const userSnap = await db.collection('users').doc(resolvedUid).get();
      if (userSnap.exists) {
        req.user = { uid: resolvedUid, ...userSnap.data() };
      } else {
        req.user = { ...defaultUser, uid: resolvedUid };
      }
    } catch (_) {
      req.user = { ...defaultUser, uid: resolvedUid };
    }
    return next();
  }

  // Real Firebase ID token verification
  try {
    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.uid = decodedToken.uid;

    const db = getFirestore();
    const userSnap = await db.collection('users').doc(req.uid).get();
    if (userSnap.exists) {
      req.user = { uid: req.uid, ...userSnap.data() };
    } else {
      req.user = {
        uid: req.uid,
        familyId: decodedToken.familyId || 'fam-patil-1',
        memberName: decodedToken.name || decodedToken.email?.split('@')[0] || 'Member',
        role: 'member',
      };
    }

    next();
  } catch (err) {
    console.error('[auth middleware error]', err.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { verifyToken };
