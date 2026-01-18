const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const questionsController = require('../controllers/questionsController');

// Настройка multer для загрузки файлов
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });

// Загрузка вопросов из файла
router.post('/upload', upload.single('file'), questionsController.uploadQuestions);

// Получить все вопросы
router.get('/', questionsController.getQuestions);

// Удалить все вопросы
router.delete('/', questionsController.deleteQuestions);

module.exports = router;



