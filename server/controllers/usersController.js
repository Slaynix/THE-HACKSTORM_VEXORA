'use strict';

// Stub controllers — real business logic wired in Phase 2
const UsersController = {
  getMe:    async (req, res) => res.json({ uid: req.uid }),
  updateMe: async (_req, res) => res.json({}),
};

module.exports = UsersController;
