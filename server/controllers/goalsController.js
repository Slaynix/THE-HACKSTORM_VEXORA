'use strict';

const GoalsService = require('../services/goalsService');
const DepositsService = require('../services/depositsService');
const PredictionService = require('../services/predictionService');
const RecoveryService = require('../services/recoveryService');

const GoalsController = {
  /**
   * GET /api/goals
   */
  async list(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const goals = await GoalsService.listByFamily(familyId);
      res.json(goals);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/goals
   */
  async create(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const userId = req.user?.uid || 'user-patil-1';
      const goal = await GoalsService.create(familyId, userId, req.body);
      res.status(201).json(goal);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/goals/:id
   */
  async getById(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const goal = await GoalsService.getById(req.params.id, familyId);
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      res.json(goal);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/goals/:id
   */
  async update(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const updated = await GoalsService.update(req.params.id, familyId, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/goals/:id
   */
  async delete(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const success = await GoalsService.delete(req.params.id, familyId);
      if (!success) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      res.json({ message: 'Goal deleted successfully' });
    } catch (err) {
      next(err);
    }
  },

  // ── Goal Deposits Sub-routes ────────────────────────────────────────────────

  /**
   * GET /api/goals/:id/deposits
   */
  async listDeposits(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const deposits = await DepositsService.listByGoal(req.params.id, familyId);
      if (deposits === null) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      res.json(deposits);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/goals/:id/deposits
   */
  async addDeposit(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const memberId = req.body.memberId || req.user?.uid || 'mem-1';
      const memberName = req.body.memberName || req.user?.memberName || 'Arun';

      const result = await DepositsService.add(
        req.params.id,
        familyId,
        memberId,
        memberName,
        req.body
      );

      if (!result) {
        return res.status(404).json({ error: 'Goal not found' });
      }

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  // ── Goal Analytics Sub-routes ───────────────────────────────────────────────

  /**
   * GET /api/goals/:id/progress
   */
  async getProgress(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const progress = await PredictionService.getProgress(req.params.id, familyId);
      if (!progress) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      res.json(progress);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/goals/:id/health
   */
  async getHealth(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const health = await PredictionService.getHealth(req.params.id, familyId);
      if (!health) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      res.json(health);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/goals/:id/prediction
   */
  async getPrediction(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const prediction = await PredictionService.getPrediction(req.params.id, familyId);
      if (!prediction) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      res.json(prediction);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/goals/:id/recovery
   */
  async getRecoveryPlan(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const goal = await GoalsService.getById(req.params.id, familyId);
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }

      const deposits = await DepositsService.listByGoal(req.params.id, familyId);
      const plan = RecoveryService.calculatePlanAdjustment(goal, deposits);
      res.json(plan);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/goals/:id/recovery/apply
   */
  async applyRecoveryOption(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const memberId = req.user?.uid || 'mem-1';
      const result = await RecoveryService.applyRecoveryOption(req.params.id, familyId, {
        optionId: req.body.optionId,
        memberId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/goals/check-missed
   */
  async checkMissedSavings(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const notifications = await RecoveryService.checkAndNotifyMissedSavings(familyId);
      res.json({ success: true, count: notifications.length, notifications });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = GoalsController;
