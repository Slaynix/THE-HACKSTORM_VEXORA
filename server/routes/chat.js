'use strict';

const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chatController');
const { validateChatMessage, validateChatConfirm } = require('../middleware/validators');

// POST /api/chat — Process text or voice conversational message
router.post('/', validateChatMessage, ChatController.handleChat);

// POST /api/chat/confirm — Explicitly confirm a deposit from an assistant confirmation card
router.post('/confirm', validateChatConfirm, ChatController.confirmDeposit);

// GET /api/chat/history — Fetch session conversation history
router.get('/history', ChatController.getHistory);

module.exports = router;
