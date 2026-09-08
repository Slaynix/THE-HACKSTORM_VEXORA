'use strict';

const { getFirestore } = require('../config/firebase');

const NotificationService = {
  /**
   * List notifications for a family, sorted by date desc.
   * @param {string} familyId
   * @returns {Promise<Array>}
   */
  async listByFamily(familyId) {
    const db = getFirestore();
    const snapshot = await db.collection('notifications').where('familyId', '==', familyId).get();
    const notifications = [];

    snapshot.forEach((doc) => {
      notifications.push({ id: doc.id, ...doc.data() });
    });

    return notifications.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  },

  /**
   * Mark a notification as read.
   * @param {string} id
   * @param {string} familyId
   * @returns {Promise<Object|null>}
   */
  async markAsRead(id, familyId) {
    const db = getFirestore();
    const docRef = db.collection('notifications').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) return null;
    if (familyId && snap.data().familyId !== familyId) return null;

    const now = new Date().toISOString();
    await docRef.update({ read: true, updatedAt: now });

    const updated = await docRef.get();
    return { id, ...updated.data() };
  },

  /**
   * Create a new notification in Firestore.
   * @param {string} familyId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createNotification(familyId, data) {
    const db = getFirestore();
    const now = new Date().toISOString();

    const notifDoc = {
      familyId,
      type: data.type || 'reminder',
      title: data.title,
      body: data.body,
      dedupKey: data.dedupKey || null,
      read: false,
      date: data.date || now,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('notifications').add(notifDoc);
    return { id: docRef.id, ...notifDoc };
  },
};

module.exports = NotificationService;
