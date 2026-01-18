const express = require('express');
const router = express.Router();
const studentsController = require('../controllers/studentsController');

// Получить учет курсантов
router.get('/accounting', studentsController.getAccounting);

module.exports = router;



