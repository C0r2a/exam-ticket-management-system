const express = require('express');
const router = express.Router();
const subjectsController = require('../controllers/subjectsController');

// Получить все дисциплины
router.get('/', subjectsController.getAllSubjects);

// Создать дисциплину
router.post('/', subjectsController.createSubject);

// Удалить дисциплину
router.delete('/:id', subjectsController.deleteSubject);

module.exports = router;



