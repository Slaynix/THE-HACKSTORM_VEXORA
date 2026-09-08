'use strict';

const DepositsService = require('../services/depositsService');

const DepositsController = {
  /**
   * PUT /api/deposits/:id
   */
  async update(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const updated = await DepositsService.update(req.params.id, familyId, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Deposit not found' });
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/deposits/:id
   */
  async delete(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const success = await DepositsService.delete(req.params.id, familyId);
      if (!success) {
        return res.status(404).json({ error: 'Deposit not found' });
      }
      res.json({ message: 'Deposit deleted successfully' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = DepositsController;
