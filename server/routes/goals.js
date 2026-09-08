'use strict';

const express = require('express');
const router = express.Router();
const GoalsController = require('../controllers/goalsController');
const { validateCreateGoal, validateUpdateGoal, validateCreateDeposit } = require('../middleware/validators');

// ── Goals CRUD ────────────────────────────────────────────────────────────────
router.get('/',            GoalsController.list);
router.post('/',           validateCreateGoal, GoalsController.create);
router.get('/:id',         GoalsController.getById);
router.put('/:id',         validateUpdateGoal, GoalsController.update);
router.delete('/:id',      GoalsController.delete);

// ── Deposits for Goal ─────────────────────────────────────────────────────────
router.get('/:id/deposits',  GoalsController.listDeposits);
router.post('/:id/deposits', validateCreateDeposit, GoalsController.addDeposit);

// ── Missed Savings Check ──────────────────────────────────────────────────
router.post('/check-missed',   GoalsController.checkMissedSavings);

// ── Goal Analytics & Recovery ──────────────────────────────────────────────────
router.get('/:id/progress',       GoalsController.getProgress);
router.get('/:id/health',         GoalsController.getHealth);
router.get('/:id/prediction',     GoalsController.getPrediction);
router.get('/:id/recovery',       GoalsController.getRecoveryPlan);
router.post('/:id/recovery/apply', GoalsController.applyRecoveryOption);

module.exports = router;
