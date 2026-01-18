const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// Получить конфигурацию
router.get('/', configController.getConfigHandler);

// Сохранить конфигурацию
router.post('/', configController.setConfigHandler);

module.exports = router;



