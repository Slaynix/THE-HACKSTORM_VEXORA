'use strict';

const express = require('express');
const router = express.Router();
const { getFirestore } = require('../config/firebase');

router.get('/me', async (req, res, next) => {
  try {
    const db = getFirestore();
    const doc = await db.collection('users').doc(req.uid).get();
    if (doc.exists) {
      return res.json({ id: doc.id, ...doc.data() });
    }
    res.json(req.user);
  } catch (err) {
    next(err);
  }
});

router.put('/me', async (req, res, next) => {
  try {
    const db = getFirestore();
    const userRef = db.collection('users').doc(req.uid);
    const updates = { ...req.body, updatedAt: new Date().toISOString() };

    // Prevent tampering with immutable fields
    delete updates.id;
    delete updates.uid;
    delete updates.createdAt;
    delete updates.familyId;

    await userRef.set(updates, { merge: true });
    const snap = await userRef.get();
    res.json({ id: req.uid, ...snap.data() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

