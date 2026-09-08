'use strict';

const NotificationService = require('../services/notificationService');

const NotificationsController = {
  /**
   * GET /api/notifications
   */
  async list(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const notifications = await NotificationService.listByFamily(familyId);
      res.json(notifications);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/notifications/:id/read
   */
  async markAsRead(req, res, next) {
    try {
      const familyId = req.user?.familyId || 'fam-patil-1';
      const updated = await NotificationService.markAsRead(req.params.id, familyId);
      if (!updated) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = NotificationsController;
