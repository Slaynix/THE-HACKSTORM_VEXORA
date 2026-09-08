'use strict';

const AuthService = require('../services/authService');

const AuthController = {
  /**
   * POST /api/auth/register
   * Creates a new family, admin user, and member in Firestore.
   */
  async register(req, res, next) {
    try {
      const { familyName, memberName, email, phoneNumber, preferredLanguage, password } = req.body;

      if (!familyName || !memberName) {
        return res.status(400).json({ error: 'Family name and member name are required' });
      }

      const result = await AuthService.register({
        familyName,
        memberName,
        email,
        phoneNumber,
        preferredLanguage,
        password,
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/login
   * Authenticates user and fetches profile & family from Firestore.
   */
  async login(req, res, next) {
    try {
      const { email, phoneNumber, familyId } = req.body;
      const result = await AuthService.login({ email, phoneNumber, familyId });

      if (!result) {
        return res.status(404).json({ error: 'User account not found' });
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/logout
   */
  async logout(_req, res) {
    res.json({ message: 'Logged out successfully' });
  },
};

module.exports = AuthController;

