'use strict';

const { getFirestore } = require('../config/firebase');
const { evaluateGoal } = require('./savingsEngine');

const PredictionService = {
  /**
   * Retrieves a goal from Firestore and evaluates its progress metrics.
   * @param {string} goalId
   * @param {string} familyId
   * @returns {Promise<Object|null>}
   */
  async getProgress(goalId, familyId) {
    const db = getFirestore();
    const docSnap = await db.collection('goals').doc(goalId).get();

    if (!docSnap.exists) return null;
    const goalData = docSnap.data();
    if (familyId && goalData.familyId !== familyId) return null;

    const evaluation = evaluateGoal({ id: goalId, ...goalData });
    return {
      goalId,
      goalName: goalData.name,
      ...evaluation.progress,
    };
  },

  /**
   * Retrieves a goal from Firestore and evaluates its health status.
   * @param {string} goalId
   * @param {string} familyId
   * @returns {Promise<Object|null>}
   */
  async getHealth(goalId, familyId) {
    const db = getFirestore();
    const docSnap = await db.collection('goals').doc(goalId).get();

    if (!docSnap.exists) return null;
    const goalData = docSnap.data();
    if (familyId && goalData.familyId !== familyId) return null;

    const evaluation = evaluateGoal({ id: goalId, ...goalData });
    return {
      goalId,
      goalName: goalData.name,
      ...evaluation.health,
    };
  },

  /**
   * Retrieves a goal from Firestore and evaluates its prediction metrics.
   * @param {string} goalId
   * @param {string} familyId
   * @returns {Promise<Object|null>}
   */
  async getPrediction(goalId, familyId) {
    const db = getFirestore();
    const docSnap = await db.collection('goals').doc(goalId).get();

    if (!docSnap.exists) return null;
    const goalData = docSnap.data();
    if (familyId && goalData.familyId !== familyId) return null;

    const evaluation = evaluateGoal({ id: goalId, ...goalData });
    return {
      goalId,
      goalName: goalData.name,
      ...evaluation.prediction,
    };
  },
};

module.exports = PredictionService;
