'use strict';

const express = require('express');
const router = express.Router();
const DepositsController = require('../controllers/depositsController');

router.put('/:id',    DepositsController.update);
router.delete('/:id', DepositsController.delete);

module.exports = router;
