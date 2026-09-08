'use strict';

const VoiceService = require('../services/voiceService');

const VoiceController = {
  /**
   * POST /api/voice/parse
   */
  async parse(req, res, next) {
    try {
      const { transcript } = req.body;
      const familyId = req.user?.familyId || 'fam-patil-1';

      const result = await VoiceService.parseVoiceCommand(transcript, familyId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = VoiceController;
