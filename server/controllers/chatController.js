'use strict';

const ChatService = require('../services/chatService');
const { getFirestore } = require('../config/firebase');

const ChatController = {
  /**
   * POST /api/chat
   * Process a text or voice message from the user.
   */
  async handleChat(req, res, next) {
    try {
      const { message, inputMode = 'text', conversationId, appLanguage = 'en' } = req.body;
      const familyId = req.user?.familyId || 'fam-patil-1';
      const memberId = req.user?.memberId || req.user?.uid || 'user-patil-1';
      const memberName = req.user?.name || req.user?.displayName || 'Arun Patil';

      const convId = conversationId || `conv-${familyId}-${Date.now()}`;

      const result = await ChatService.processMessage({
        message,
        inputMode,
        conversationId: convId,
        familyId,
        memberId,
        memberName,
        appLanguage,
      });

      return res.status(200).json({
        conversationId: convId,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/chat/confirm
   * Explicitly confirm a deposit from the assistant card.
   */
  async confirmDeposit(req, res, next) {
    try {
      const { goalId, amount, clientTxnId, appLanguage = 'en' } = req.body;
      const familyId = req.user?.familyId || 'fam-patil-1';
      const memberId = req.user?.memberId || req.user?.uid || 'user-patil-1';
      const memberName = req.user?.name || req.user?.displayName || 'Arun Patil';

      const result = await ChatService.confirmDeposit({
        goalId,
        amount: Number(amount),
        familyId,
        memberId,
        memberName,
        clientTxnId,
        appLanguage,
      });

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/chat/history
   * Retrieve recent conversation messages for a conversation ID.
   */
  async getHistory(req, res, next) {
    try {
      const { conversationId } = req.query;
      if (!conversationId) {
        return res.status(400).json({ error: 'conversationId query param is required' });
      }

      const db = getFirestore();
      const messages = [];
      const snap = await db.collection('chatMessages')
        .where('conversationId', '==', conversationId)
        .orderBy('createdAt', 'asc')
        .limit(50)
        .get();

      snap.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));

      return res.status(200).json({ messages });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ChatController;
