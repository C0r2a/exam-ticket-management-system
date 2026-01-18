const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const usersController = require('../controllers/usersController');

// Настройка multer для загрузки файлов
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });

// Создать пользователя
router.post('/', usersController.createUser);

// Импорт курсантов из файла
router.post('/import', upload.single('file'), usersController.importUsers);

module.exports = router;



