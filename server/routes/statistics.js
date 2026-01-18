const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');

// Получить статистику
router.get('/', statisticsController.getStatistics);

// Получить историю сдачи
router.get('/history', statisticsController.getHistory);

module.exports = router;



