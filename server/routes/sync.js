'use strict';

const express = require('express');
const router = express.Router();
const SyncController = require('../controllers/syncController');

router.post('/', SyncController.sync);

module.exports = router;
