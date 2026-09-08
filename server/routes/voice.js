'use strict';

const express = require('express');
const router = express.Router();
const VoiceController = require('../controllers/voiceController');
const { validateVoiceParse } = require('../middleware/validators');

router.post('/parse', validateVoiceParse, VoiceController.parse);

module.exports = router;
