'use strict';

const FamilyService = require('../services/familyService');

const StreakService = require('../services/streakService');

const FamilyController = {
  /**
   * GET /api/family
   */
  async getFamily(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const family = await FamilyService.getFamily(familyId);
      if (!family) {
        return res.status(404).json({ error: 'Family not found' });
      }
      res.json(family);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/family/streak
   */
  async getStreak(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const streak = await StreakService.getStreak(familyId);
      res.json(streak);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/family
   */
  async updateFamily(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const updated = await FamilyService.updateFamily(familyId, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Family not found' });
      }
      res.json({ message: 'Family settings updated', family: updated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/family/members
   */
  async listMembers(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const members = await FamilyService.listMembers(familyId);
      res.json(members);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/family/members
   */
  async addMember(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const newMember = await FamilyService.addMember(familyId, req.body);
      res.status(201).json({ message: 'Member added successfully', member: newMember });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/family/members/:id
   */
  async removeMember(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const memberId = req.params.id;
      const success = await FamilyService.removeMember(memberId, familyId);
      if (!success) {
        return res.status(404).json({ error: 'Member not found or unauthorized' });
      }
      res.json({ message: 'Member removed successfully' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = FamilyController;
