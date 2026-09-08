'use strict';

const { getFirestore } = require('../config/firebase');

const StreakService = require('./streakService');

const FamilyService = {
  /**
   * Get family details by ID with aggregated counts, total saved, and saving streak.
   * @param {string} familyId
   * @returns {Promise<Object|null>}
   */
  async getFamily(familyId) {
    const db = getFirestore();
    const familySnap = await db.collection('families').doc(familyId).get();

    if (!familySnap.exists) return null;
    const familyData = familySnap.data();

    // Query members count
    const membersSnap = await db.collection('familyMembers').where('familyId', '==', familyId).get();
    let memberCount = membersSnap.size;

    // Also check legacy members collection if familyMembers empty
    if (memberCount === 0) {
      const legacySnap = await db.collection('members').where('familyId', '==', familyId).get();
      memberCount = legacySnap.size;
    }

    // Query goals for total saved and count
    const goalsSnap = await db.collection('goals').where('familyId', '==', familyId).get();
    let totalSaved = 0;
    goalsSnap.forEach((g) => {
      totalSaved += Number(g.data().savedAmount) || 0;
    });

    const streak = await StreakService.getStreak(familyId);

    return {
      id: familySnap.id,
      ...familyData,
      memberCount,
      goalCount: goalsSnap.size,
      totalSaved,
      streak,
    };
  },

  /**
   * Update family settings (name, preferredLanguage).
   * @param {string} familyId
   * @param {Object} updates
   * @returns {Promise<Object|null>}
   */
  async updateFamily(familyId, updates) {
    const db = getFirestore();
    const familyRef = db.collection('families').doc(familyId);
    const snap = await familyRef.get();

    if (!snap.exists) return null;

    const payload = { updatedAt: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.preferredLanguage !== undefined) payload.preferredLanguage = updates.preferredLanguage;

    await familyRef.update(payload);
    const updatedSnap = await familyRef.get();
    return { id: familyId, ...updatedSnap.data() };
  },

  /**
   * List all members of a family.
   * @param {string} familyId
   * @returns {Promise<Array>}
   */
  async listMembers(familyId) {
    const db = getFirestore();
    let snapshot = await db.collection('familyMembers').where('familyId', '==', familyId).get();

    if (snapshot.empty) {
      snapshot = await db.collection('members').where('familyId', '==', familyId).get();
    }

    const members = [];
    snapshot.forEach((doc) => {
      members.push({ id: doc.id, ...doc.data() });
    });

    return members;
  },

  /**
   * Add a new member to a family.
   * @param {string} familyId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async addMember(familyId, data) {
    const db = getFirestore();
    const now = new Date().toISOString();

    const memberDoc = {
      familyId,
      uid: data.uid || '',
      name: data.name.trim(),
      role: data.role ? data.role.trim() : 'Family Member',
      phone: data.phone ? data.phone.trim() : '',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('familyMembers').add(memberDoc);
    return { id: docRef.id, ...memberDoc };
  },

  /**
   * Remove a member from a family.
   * @param {string} memberId
   * @param {string} familyId
   * @returns {Promise<boolean>}
   */
  async removeMember(memberId, familyId) {
    const db = getFirestore();

    // Check familyMembers first
    let docRef = db.collection('familyMembers').doc(memberId);
    let snap = await docRef.get();

    if (!snap.exists) {
      // Fallback to legacy members collection
      docRef = db.collection('members').doc(memberId);
      snap = await docRef.get();
    }

    if (!snap.exists) return false;
    if (snap.data().familyId !== familyId) return false;

    await docRef.delete();
    return true;
  },
};

module.exports = FamilyService;
