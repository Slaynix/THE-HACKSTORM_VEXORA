'use strict';

const { getFirebaseAdmin, getFirestore } = require('../config/firebase');

const AuthService = {
  /**
   * Register a new family and primary admin user in Firestore.
   * Also creates user in Firebase Auth if credentials are supplied.
   *
   * @param {Object} params
   * @param {string} params.familyName
   * @param {string} params.memberName
   * @param {string} [params.email]
   * @param {string} [params.phoneNumber]
   * @param {string} [params.preferredLanguage]
   * @param {string} [params.password]
   * @returns {Promise<Object>}
   */
  async register({ familyName, memberName, email = '', phoneNumber = '', preferredLanguage = 'en', password = '' }) {
    const db = getFirestore();
    const now = new Date().toISOString();
    const cleanFamilyName = familyName.trim();
    const cleanMemberName = memberName.trim();

    let uid = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // If real Firebase Auth is configured and email/password provided, create Auth user
    const hasCredentials = !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    );

    if (hasCredentials && email) {
      try {
        const admin = getFirebaseAdmin();
        const userRecord = await admin.auth().createUser({
          email,
          ...(password ? { password } : {}),
          displayName: cleanMemberName,
          ...(phoneNumber ? { phoneNumber } : {}),
        });
        uid = userRecord.uid;
      } catch (err) {
        // If user already exists in Auth, retrieve existing uid
        if (err.code === 'auth/email-already-exists') {
          const admin = getFirebaseAdmin();
          const existing = await admin.auth().getUserByEmail(email);
          uid = existing.uid;
        } else {
          console.warn('[authService.register] Auth createUser warning:', err.message);
        }
      }
    }

    // 1. Create Family doc in Firestore
    const familyRef = db.collection('families').doc();
    const familyData = {
      name: cleanFamilyName,
      preferredLanguage: preferredLanguage || 'en',
      createdAt: now,
      updatedAt: now,
    };
    await familyRef.set(familyData);
    const familyId = familyRef.id;

    // 2. Create User doc in Firestore
    const userRef = db.collection('users').doc(uid);
    const userData = {
      email: email || '',
      phoneNumber: phoneNumber || '',
      familyId,
      memberName: cleanMemberName,
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    };
    await userRef.set(userData);

    // 3. Create FamilyMember doc in Firestore (id keyed for easy rule check: familyId_uid)
    const memberDocId = `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const memberRef = db.collection('familyMembers').doc(memberDocId);
    const memberData = {
      familyId,
      uid,
      name: cleanMemberName,
      role: 'Head of Family',
      phone: phoneNumber || '',
      createdAt: now,
      updatedAt: now,
    };
    await memberRef.set(memberData);

    // Generate token
    let token = `mock-token-${uid}`;
    if (hasCredentials) {
      try {
        const admin = getFirebaseAdmin();
        token = await admin.auth().createCustomToken(uid, { familyId, role: 'admin' });
      } catch (tokenErr) {
        console.warn('[authService.register] Token creation fallback:', tokenErr.message);
      }
    }

    return {
      message: 'Account created successfully',
      token,
      user: { id: uid, ...userData },
      family: { id: familyId, ...familyData },
      member: { id: memberDocId, ...memberData },
    };
  },

  /**
   * Login user via email, phone, or familyId.
   *
   * @param {Object} params
   * @param {string} [params.email]
   * @param {string} [params.phoneNumber]
   * @param {string} [params.familyId]
   * @returns {Promise<Object|null>}
   */
  async login({ email, phoneNumber, familyId }) {
    const db = getFirestore();
    let userDoc = null;

    if (familyId) {
      const snap = await db.collection('users').where('familyId', '==', familyId).limit(1).get();
      if (!snap.empty) userDoc = snap.docs[0];
    } else if (email) {
      const snap = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!snap.empty) userDoc = snap.docs[0];
    } else if (phoneNumber) {
      const snap = await db.collection('users').where('phoneNumber', '==', phoneNumber).limit(1).get();
      if (!snap.empty) userDoc = snap.docs[0];
    } else {
      const snap = await db.collection('users').limit(1).get();
      if (!snap.empty) userDoc = snap.docs[0];
    }

    if (!userDoc) return null;

    const userData = userDoc.data();
    const uid = userDoc.id;

    // Fetch Family
    let familyData = null;
    if (userData.familyId) {
      const famSnap = await db.collection('families').doc(userData.familyId).get();
      if (famSnap.exists) {
        familyData = { id: famSnap.id, ...famSnap.data() };
      }
    }

    // Generate token
    let token = `mock-token-${uid}`;
    const hasCredentials = !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    );

    if (hasCredentials) {
      try {
        const admin = getFirebaseAdmin();
        token = await admin.auth().createCustomToken(uid, { familyId: userData.familyId, role: userData.role || 'member' });
      } catch (_) {}
    }

    return {
      message: 'Login successful',
      token,
      user: { id: uid, ...userData },
      family: familyData,
    };
  },

  /**
   * Google Sign-In handler: provisions or fetches account for Google authenticated users.
   *
   * @param {Object} params
   * @param {string} [params.idToken]
   * @param {string} params.email
   * @param {string} [params.displayName]
   * @param {string} [params.photoUrl]
   * @param {string} [params.googleUid]
   * @returns {Promise<Object>}
   */
  async googleLogin({ idToken, email, displayName, photoUrl, googleUid }) {
    const db = getFirestore();
    const now = new Date().toISOString();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (displayName || (cleanEmail ? cleanEmail.split('@')[0] : 'Sanchay User')).trim();
    let uid = googleUid || `google-${Date.now()}`;

    // Verify token with Firebase Admin if real credentials are present
    const hasCredentials = !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    );

    if (hasCredentials && idToken && idToken.length > 50) {
      try {
        const admin = getFirebaseAdmin();
        const decoded = await admin.auth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch (e) {
        console.warn('[authService.googleLogin] Google token verify notice:', e.message);
      }
    }

    // Check if user document already exists in Firestore
    let userDoc = null;
    if (uid) {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) userDoc = doc;
    }
    if (!userDoc && cleanEmail) {
      const snap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
      if (!snap.empty) {
        userDoc = snap.docs[0];
        uid = userDoc.id;
      }
    }

    let familyId;
    let userData;
    let familyData;

    if (userDoc) {
      userData = userDoc.data();
      familyId = userData.familyId;
      if (familyId) {
        const famSnap = await db.collection('families').doc(familyId).get();
        if (famSnap.exists) {
          familyData = { id: famSnap.id, ...famSnap.data() };
        }
      }
    } else {
      // Find default family or create a family for this user
      const existingFamSnap = await db.collection('families').limit(1).get();
      if (!existingFamSnap.empty) {
        familyId = existingFamSnap.docs[0].id;
        familyData = { id: familyId, ...existingFamSnap.docs[0].data() };
      } else {
        const newFamRef = db.collection('families').doc();
        familyData = {
          name: `${cleanName}'s Family`,
          preferredLanguage: 'en',
          createdAt: now,
          updatedAt: now,
        };
        await newFamRef.set(familyData);
        familyId = newFamRef.id;
      }

      userData = {
        email: cleanEmail,
        phoneNumber: '',
        familyId,
        memberName: cleanName,
        photoUrl: photoUrl || '',
        role: 'member',
        provider: 'google',
        createdAt: now,
        updatedAt: now,
      };
      await db.collection('users').doc(uid).set(userData);

      // Create FamilyMember entry
      const memRef = db.collection('familyMembers').doc(`mem-${uid}`);
      await memRef.set({
        familyId,
        uid,
        name: cleanName,
        role: 'Family Member',
        phone: '',
        createdAt: now,
        updatedAt: now,
      });
    }

    let token = idToken || `google-token-${uid}`;

    return {
      message: 'Google Sign-In successful',
      token,
      user: { id: uid, ...userData },
      family: familyData,
    };
  },
};

module.exports = AuthService;
