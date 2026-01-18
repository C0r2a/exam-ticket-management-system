const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { db, initializeDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Путь к собранному клиенту
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
const indexHtmlPath = path.join(clientBuildPath, 'index.html');
const ticketsPagePath = path.join(__dirname, 'public', 'index.html');

// Проверка готовности build
const isBuildReady = fs.existsSync(clientBuildPath) && fs.existsSync(indexHtmlPath);

// Импорт маршрутов
const ticketsRoutes = require('./routes/tickets');
const questionsRoutes = require('./routes/questions');
const groupsRoutes = require('./routes/groups');
const usersRoutes = require('./routes/users');
const subjectsRoutes = require('./routes/subjects');
const configRoutes = require('./routes/config');
const statisticsRoutes = require('./routes/statistics');
const resetRoutes = require('./routes/reset');
const studentsRoutes = require('./routes/students');

// Подключение маршрутов
app.use('/api/tickets', ticketsRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/reset', resetRoutes);
app.use('/api/students', studentsRoutes);

// История сдачи (для обратной совместимости)
app.get('/api/history', require('./controllers/statisticsController').getHistory);

// Полный сброс всех данных (для обратной совместимости)
app.delete('/api/reset-all', require('./controllers/resetController').resetAll);

// Обработка статических файлов для панели преподавателя
app.use('/teacher', express.static(path.join(__dirname, 'public')));

// Главная страница (панель преподавателя на порту 8000)
app.get('/', (req, res) => {
  if (fs.existsSync(ticketsPagePath)) {
    res.sendFile(ticketsPagePath);
  } else {
    res.status(404).send('Страница не найдена');
  }
});

if (isBuildReady) {
  // Обслуживание статических файлов (CSS, JS, изображения, шрифты)
  app.use(express.static(clientBuildPath));
  
  // Обработка всех остальных маршрутов - отправка index.html (для React Router)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && req.path !== '/') {
      res.sendFile(indexHtmlPath);
    } else if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
} else {
  // В режиме разработки, если build не готов, показываем информационную страницу
  app.get('/info', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Сервер экзаменационных билетов</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0e27;
            min-height: 100vh;
            color: #e0e7ff;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            max-width: 900px;
            width: 100%;
            text-align: center;
          }
          h1 { font-size: 2.5rem; margin-bottom: 20px; }
          .status { font-size: 1.2rem; color: #4ade80; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎓 Сервер экзаменационных билетов</h1>
          <p class="status">✅ Сервер работает на порту ${PORT}</p>
          <p style="margin-top: 20px;">Клиентское приложение: <a href="http://localhost:3000" style="color: #818cf8;">http://localhost:3000</a></p>
        </div>
      </body>
      </html>
    `);
  });
  
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.redirect('/');
  });
}

// Инициализация базы данных и запуск сервера
let dbReady = false;

initializeDatabase().then(() => {
  // Очистка дубликатов билетов при старте
  db.run(`
    DELETE FROM tickets 
    WHERE id NOT IN (
      SELECT MIN(id) 
      FROM tickets 
      GROUP BY questions_hash, subject_id, group_id
    )
  `, (err) => {
    if (err) {
      console.error('Ошибка при удалении дубликатов билетов:', err.message);
    } else {
      console.log('Проверка дубликатов билетов завершена');
    }
    dbReady = true;
  });
  
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    if (isBuildReady) {
      console.log('✅ Статические файлы обслуживаются из client/build');
    } else {
      console.log('⚠️  Режим разработки: client/build не найден');
    }
  });
}).catch((err) => {
  console.error('Ошибка при инициализации базы данных:', err);
  process.exit(1);
});

// Экспорт для тестирования
module.exports = app;

