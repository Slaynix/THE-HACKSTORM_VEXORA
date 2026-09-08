'use strict';

const { getFirestore } = require('../config/firebase');
const GoalsService = require('./goalsService');
const DepositsService = require('./depositsService');

const SyncService = {
  /**
   * Process a batch of offline operations idempotently against Firestore.
   *
   * @param {string} familyId
   * @param {string} userId
   * @param {Array<Object>} operations
   * @returns {Promise<Object>}
   */
  async processBatch(familyId, userId, operations = []) {
    const db = getFirestore();
    const results = [];
    let appliedCount = 0;

    for (const op of operations) {
      try {
        const { type, data = {}, localId } = op;
        let outcome = { localId, type, status: 'SKIPPED' };

        switch (type) {
          case 'CREATE_GOAL': {
            let existing = null;
            if (data.clientTxnId) {
              const snap = await db.collection('goals').where('clientTxnId', '==', data.clientTxnId).get();
              if (!snap.empty) existing = snap.docs[0];
            } else if (data.id) {
              const snap = await db.collection('goals').doc(data.id).get();
              if (snap.exists) existing = snap;
            }
            if (!existing) {
              const created = await GoalsService.create(familyId, userId, data);
              outcome = { localId, serverId: created.id, type, status: 'APPLIED' };
              appliedCount++;
            } else {
              outcome = { localId, serverId: existing.id, type, status: 'EXISTS' };
            }
            break;
          }

          case 'UPDATE_GOAL': {
            if (data.id) {
              const updated = await GoalsService.update(data.id, familyId, data);
              outcome = { localId, serverId: data.id, type, status: updated ? 'APPLIED' : 'NOT_FOUND' };
              if (updated) appliedCount++;
            }
            break;
          }

          case 'DELETE_GOAL': {
            if (data.id) {
              const deleted = await GoalsService.delete(data.id, familyId);
              outcome = { localId, serverId: data.id, type, status: deleted ? 'APPLIED' : 'NOT_FOUND' };
              if (deleted) appliedCount++;
            }
            break;
          }

          case 'ADD_DEPOSIT': {
            let existing = null;
            if (data.clientTxnId) {
              const snap = await db.collection('deposits').where('clientTxnId', '==', data.clientTxnId).get();
              if (!snap.empty) existing = snap.docs[0];
            } else if (data.id) {
              const snap = await db.collection('deposits').doc(data.id).get();
              if (snap.exists) existing = snap;
            }

            if (!existing && data.goalId && Number(data.amount) > 0) {
              const added = await DepositsService.add(
                data.goalId,
                familyId,
                data.memberId || userId,
                data.memberName || 'Family Member',
                data
              );
              outcome = { localId, serverId: added?.deposit?.id, type, status: 'APPLIED' };
              appliedCount++;
            } else {
              outcome = { localId, serverId: existing?.id, type, status: 'EXISTS' };
            }
            break;
          }

          case 'UPDATE_DEPOSIT': {
            if (data.id) {
              const updated = await DepositsService.update(data.id, familyId, data);
              outcome = { localId, serverId: data.id, type, status: updated ? 'APPLIED' : 'NOT_FOUND' };
              if (updated) appliedCount++;
            }
            break;
          }

          case 'DELETE_DEPOSIT': {
            if (data.id) {
              const deleted = await DepositsService.delete(data.id, familyId);
              outcome = { localId, serverId: data.id, type, status: deleted ? 'APPLIED' : 'NOT_FOUND' };
              if (deleted) appliedCount++;
            }
            break;
          }

          default:
            outcome = { localId, type, status: 'UNKNOWN_OPERATION' };
        }

        results.push(outcome);
      } catch (err) {
        results.push({ localId: op.localId, type: op.type, status: 'FAILED', error: err.message });
      }
    }

    // Retrieve fresh snapshot from Firestore
    const latestGoals = await GoalsService.listByFamily(familyId);
    const depositsSnap = await db.collection('deposits').where('familyId', '==', familyId).get();
    const latestDeposits = [];
    depositsSnap.forEach(doc => latestDeposits.push({ id: doc.id, ...doc.data() }));

    return {
      success: true,
      serverTimestamp: new Date().toISOString(),
      appliedCount,
      operationsProcessed: operations.length,
      results,
      syncState: {
        goals: latestGoals,
        deposits: latestDeposits,
      },
    };
  },
};

module.exports = SyncService;
