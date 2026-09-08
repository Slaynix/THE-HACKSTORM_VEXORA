'use strict';

const express = require('express');
const router = express.Router();
const NotificationsController = require('../controllers/notificationsController');

router.get('/',         NotificationsController.list);
router.put('/:id/read', NotificationsController.markAsRead);

module.exports = router;
