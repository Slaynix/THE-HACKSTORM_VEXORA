'use strict';

const express = require('express');
const router = express.Router();
const FamilyController = require('../controllers/familyController');
const { validateUpdateFamily, validateAddMember } = require('../middleware/validators');

router.get('/',            FamilyController.getFamily);
router.get('/streak',      FamilyController.getStreak);
router.put('/',            validateUpdateFamily, FamilyController.updateFamily);
router.get('/members',     FamilyController.listMembers);
router.post('/members',    validateAddMember, FamilyController.addMember);
router.delete('/members/:id', FamilyController.removeMember);

module.exports = router;
