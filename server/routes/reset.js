const express = require('express');
const router = express.Router();
const resetController = require('../controllers/resetController');

// Сброс статистики
router.post('/', resetController.resetStatistics);

// Полный сброс всех данных
router.delete('/all', resetController.resetAll);

module.exports = router;



