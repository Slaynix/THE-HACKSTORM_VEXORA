'use strict';

const SyncService = require('../services/syncService');

const SyncController = {
  /**
   * POST /api/sync
   */
  async sync(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const userId = req.user?.uid || 'user-patil-1';
      const { operations } = req.body;

      const result = await SyncService.processBatch(familyId, userId, operations || []);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = SyncController;
