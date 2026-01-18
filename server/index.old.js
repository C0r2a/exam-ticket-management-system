    const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Путь к собранному клиенту
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');

// Настройка multer для загрузки файлов
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });

// Инициализация базы данных
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Авторизация больше не используется

// Создание таблиц
db.serialize(() => {
  // Таблица вопросов
  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    subject_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  )`);

  // Таблица билетов
  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    questions TEXT NOT NULL,
    questions_hash TEXT NOT NULL,
    is_used INTEGER DEFAULT 0,
    used_by TEXT,
    used_at DATETIME,
    subject_id TEXT,
    group_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(questions_hash, subject_id, group_id)
  )`);

  // Таблица истории сдачи
  db.run(`CREATE TABLE IF NOT EXISTS exam_history (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    ticket_number INTEGER NOT NULL,
    questions TEXT NOT NULL,
    taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  )`);

  // Таблица конфигурации
  db.run(`CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  // Таблица учебных групп
  db.run(`CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица пользователей (курсантов и преподавателей)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    full_name TEXT,
    group_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id)
  )`);

  // Таблица дисциплин
  db.run(`CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица связи учебных групп и дисциплин (какая учебная группа сдает какую дисциплину)
  db.run(`CREATE TABLE IF NOT EXISTS group_subjects (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    teacher_username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    UNIQUE(group_id, subject_id, teacher_username)
  )`);

  // Миграция: добавляем subject_id в таблицу questions, если колонки нет
  db.all("PRAGMA table_info(questions)", (err, columns) => {
    if (err) {
      console.error('Ошибка при проверке структуры таблицы questions:', err.message);
      return;
    }
    
    const hasSubjectId = columns.some(col => col.name === 'subject_id');
    if (!hasSubjectId) {
      db.run(`ALTER TABLE questions ADD COLUMN subject_id TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Ошибка при добавлении колонки subject_id:', alterErr.message);
        } else {
          console.log('Колонка subject_id успешно добавлена в таблицу questions');
        }
      });
    }
  });

  // Миграция: добавляем question_number в таблицу questions, если колонки нет
  db.all("PRAGMA table_info(questions)", (pragmaErr, columns) => {
    if (pragmaErr) {
      console.error('Ошибка при проверке структуры таблицы questions:', pragmaErr);
    } else {
      const hasQuestionNumber = columns.some(col => col.name === 'question_number');
      if (!hasQuestionNumber) {
        db.run(`ALTER TABLE questions ADD COLUMN question_number INTEGER`, (alterErr) => {
          if (alterErr) {
            console.error('Ошибка при добавлении колонки question_number:', alterErr.message);
          } else {
            console.log('Колонка question_number успешно добавлена в таблицу questions');
          }
        });
      }
    }
  });

  // Миграция: добавляем completed_at в таблицу exam_history, если колонки нет
  db.all("PRAGMA table_info(exam_history)", (err, columns) => {
    if (err) {
      console.error('Ошибка при проверке структуры таблицы exam_history:', err.message);
      return;
    }
    
    const hasCompletedAt = columns.some(col => col.name === 'completed_at');
    if (!hasCompletedAt) {
      db.run(`ALTER TABLE exam_history ADD COLUMN completed_at DATETIME`, (alterErr) => {
        if (alterErr) {
          console.error('Ошибка при добавлении колонки completed_at:', alterErr.message);
        } else {
          console.log('Колонка completed_at успешно добавлена в таблицу exam_history');
        }
      });
    }
    
    // Миграция: добавляем username, если колонки нет (для старых баз данных)
    const hasUsername = columns.some(col => col.name === 'username');
    const hasStudentName = columns.some(col => col.name === 'student_name');
    
    if (!hasUsername) {
      if (hasStudentName) {
        // Копируем данные из student_name в username
        db.run(`ALTER TABLE exam_history ADD COLUMN username TEXT`, (alterErr) => {
          if (alterErr) {
            console.error('Ошибка при добавлении колонки username:', alterErr.message);
          } else {
            console.log('Колонка username успешно добавлена в таблицу exam_history');
            // Копируем данные из student_name в username
            db.run(`UPDATE exam_history SET username = student_name WHERE username IS NULL`, (updateErr) => {
              if (updateErr) {
                console.error('Ошибка при копировании данных в username:', updateErr.message);
              } else {
                console.log('Данные успешно скопированы из student_name в username');
              }
            });
          }
        });
      } else {
        // Если нет ни username, ни student_name, просто добавляем колонку
        db.run(`ALTER TABLE exam_history ADD COLUMN username TEXT`, (alterErr) => {
          if (alterErr) {
            console.error('Ошибка при добавлении колонки username:', alterErr.message);
          } else {
            console.log('Колонка username успешно добавлена в таблицу exam_history');
          }
        });
      }
    }
    
    // Если есть старая колонка student_name с NOT NULL, делаем её nullable или удаляем
    if (hasStudentName && hasUsername) {
      // Проверяем, есть ли NOT NULL constraint на student_name
      // SQLite не поддерживает изменение NOT NULL напрямую, но мы можем обновить данные
      db.run(`UPDATE exam_history SET student_name = username WHERE student_name IS NULL OR student_name = ''`, (updateErr) => {
        if (updateErr) {
          console.error('Ошибка при обновлении student_name:', updateErr.message);
        } else {
          console.log('Данные в student_name обновлены из username');
        }
      });
    }
  });

  // Миграция: добавляем subject_id и group_id в таблицу tickets, если колонок нет
  db.all("PRAGMA table_info(tickets)", (err, columns) => {
    if (err) {
      console.error('Ошибка при проверке структуры таблицы tickets:', err.message);
      return;
    }
    
    const hasSubjectId = columns.some(col => col.name === 'subject_id');
    const hasGroupId = columns.some(col => col.name === 'group_id');
    
    if (!hasSubjectId) {
      db.run(`ALTER TABLE tickets ADD COLUMN subject_id TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Ошибка при добавлении колонки subject_id в tickets:', alterErr.message);
        } else {
          console.log('Колонка subject_id успешно добавлена в таблицу tickets');
        }
      });
    }
    
    if (!hasGroupId) {
      db.run(`ALTER TABLE tickets ADD COLUMN group_id TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Ошибка при добавлении колонки group_id в tickets:', alterErr.message);
        } else {
          console.log('Колонка group_id успешно добавлена в таблицу tickets');
        }
      });
    }
  });

  // Очистка дубликатов билетов при старте (на случай если они уже есть)
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
  });
});

// Функция для получения конфигурации
function getConfig(key, defaultValue) {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM config WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? JSON.parse(row.value) : defaultValue);
    });
  });
}

// Функция для сохранения конфигурации
function setConfig(key, value) {
  return new Promise((resolve, reject) => {
    const valueStr = JSON.stringify(value);
    db.run(
      'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      [key, valueStr],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

// Генерация хэша для комбинации вопросов
function generateQuestionsHash(questionIds) {
  return questionIds.sort().join(',');
}

// Генерация билетов
function generateTickets(questions, ticketCount, questionsPerTicket, hasPracticalTasks = false, practicalTasksCount = 1, hasSections = false, sectionBoundary = 0) {
  const tickets = [];
  const usedHashes = new Set();
  
  if (questions.length < questionsPerTicket) {
    throw new Error('Недостаточно вопросов для создания билетов');
  }

  // Если используются разделы, разделяем вопросы на два раздела
  let section1 = [];
  let section2 = [];
  
  if (hasSections && sectionBoundary > 0) {
    // Раздел 1: вопросы с question_number от 1 до sectionBoundary
    section1 = questions.filter(q => q.question_number && q.question_number >= 1 && q.question_number <= sectionBoundary);
    // Раздел 2: вопросы с question_number от sectionBoundary + 1 до максимального
    section2 = questions.filter(q => q.question_number && q.question_number > sectionBoundary);
    
    // Перемешиваем каждый раздел отдельно
    section1 = section1.sort(() => 0.5 - Math.random());
    section2 = section2.sort(() => 0.5 - Math.random());
    
    // Проверяем, что в каждом разделе достаточно вопросов
    const minQuestionsPerSection = Math.ceil(questionsPerTicket / 2);
    if (section1.length < minQuestionsPerSection) {
      throw new Error(`Недостаточно вопросов в разделе 1 (нужно минимум ${minQuestionsPerSection}, есть ${section1.length})`);
    }
    if (section2.length < minQuestionsPerSection) {
      throw new Error(`Недостаточно вопросов в разделе 2 (нужно минимум ${minQuestionsPerSection}, есть ${section2.length})`);
    }
  } else {
    // Если разделы не используются, перемешиваем все вопросы вместе
    section1 = [...questions].sort(() => 0.5 - Math.random());
    section2 = section1; // Используем тот же список
  }
  
  const maxAttempts = ticketCount * 100; // Максимальное количество попыток
  let attempts = 0;
  let section1Index = 0; // Индекс для циклического прохода по разделу 1
  let section2Index = 0; // Индекс для циклического прохода по разделу 2

  while (tickets.length < ticketCount && attempts < maxAttempts) {
    attempts++;
    
    // Выбираем вопросы из разделов по очереди
    const selectedQuestions = [];
    for (let i = 0; i < questionsPerTicket; i++) {
      if (hasSections && sectionBoundary > 0) {
        // Чередуем разделы: четные индексы (0, 2, 4...) - раздел 1, нечетные (1, 3, 5...) - раздел 2
        if (i % 2 === 0) {
          // Четный индекс - берем из раздела 1
          const question = section1[section1Index % section1.length];
          selectedQuestions.push(question);
          section1Index++;
        } else {
          // Нечетный индекс - берем из раздела 2
          const question = section2[section2Index % section2.length];
          selectedQuestions.push(question);
          section2Index++;
        }
      } else {
        // Если разделы не используются, берем из общего списка
        const question = section1[section1Index % section1.length];
        selectedQuestions.push(question);
        section1Index++;
      }
    }
    
    const questionIds = selectedQuestions.map(q => q.id).sort(); // Сортируем для консистентности хеша
    const hash = generateQuestionsHash(questionIds);

    // Проверка уникальности
    if (!usedHashes.has(hash)) {
      usedHashes.add(hash);
      
      // Генерируем практическое задание, если включено
      let practicalTask = null;
      if (hasPracticalTasks && practicalTasksCount > 0) {
        const taskNumber = Math.floor(Math.random() * practicalTasksCount) + 1;
        practicalTask = {
          number: taskNumber,
          text: `Практическое задание №${taskNumber}`
        };
      }
      
      tickets.push({
        number: tickets.length + 1,
        questions: selectedQuestions,
        practicalTask: practicalTask,
        hash
      });
    }
  }

  if (tickets.length < ticketCount) {
    throw new Error(`Не удалось сгенерировать ${ticketCount} уникальных билетов. Сгенерировано: ${tickets.length}`);
  }

  // Сортируем билеты по номеру для фиксированного порядка
  return tickets.sort((a, b) => a.number - b.number);
}

// API Routes

// Упрощенный endpoint для получения доступных билетов (без авторизации)
app.get('/api/tickets/available-simple', (req, res) => {
  const { group_id, subject_id } = req.query;
  
  if (!group_id || !subject_id) {
    return res.status(400).json({ error: 'Необходимо указать group_id и subject_id' });
  }
  
  // Получаем ВСЕ билеты для этой учебной группы и дисциплины (и использованные, и нет)
  // Сортируем по номеру для фиксированного порядка
  db.all(
    'SELECT * FROM tickets WHERE group_id = ? AND subject_id = ? ORDER BY number',
    [group_id, subject_id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const tickets = rows.map(row => {
        const parsed = JSON.parse(row.questions);
        // Поддержка старого формата (только массив вопросов) и нового (объект с questions и practicalTask)
        const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
        const practicalTask = Array.isArray(parsed) ? null : (parsed.practicalTask || null);
        
        return {
          id: row.id,
          number: row.number,
          questions: questions,
          practicalTask: practicalTask,
          is_used: row.is_used === 1,
          used_at: row.used_at || null
        };
      });
      // НЕ перемешиваем - билеты в фиксированном порядке
      res.json(tickets);
    }
  );
});

// Упрощенный endpoint для выбора билета (без авторизации)
app.post('/api/tickets/:ticketId/select-simple', (req, res) => {
  const { ticketId } = req.params;
  const { group_id, subject_id, student_id, student_name } = req.body;

  if (!group_id || !subject_id) {
    return res.status(400).json({ error: 'Необходимо указать group_id и subject_id' });
  }

  // Проверяем, не использован ли билет
  db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!ticket) {
      return res.status(404).json({ error: 'Билет не найден' });
    }

    if (ticket.is_used === 1) {
      return res.status(400).json({ error: 'Этот билет уже использован' });
    }

    // Проверяем, что билет принадлежит правильной учебной группе и дисциплине
    if (ticket.group_id !== group_id || ticket.subject_id !== subject_id) {
      return res.status(403).json({ error: 'Этот билет не предназначен для выбранной группы и дисциплины' });
    }

    // Получаем username курсанта, если указан student_id
    if (student_id) {
      db.get('SELECT username FROM users WHERE id = ?', [student_id], (err2, student) => {
        if (err2) {
          console.error('Ошибка получения курсанта:', err2);
          return res.status(500).json({ error: 'Ошибка получения курсанта' });
        }
        
        const studentUsername = student ? student.username : null;
        
        // Помечаем билет как использованный с информацией о курсанте
        db.run(
          'UPDATE tickets SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?',
          [studentUsername, ticketId],
          function(updateErr) {
            if (updateErr) {
              return res.status(500).json({ error: updateErr.message });
            }

            // Сохраняем в историю
            const historyId = uuidv4();
            const parsed = JSON.parse(ticket.questions);
            const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
            const practicalTask = Array.isArray(parsed) ? null : (parsed.practicalTask || null);
            let questionsText = questions.map(q => typeof q === 'string' ? q : q.text).join(' | ');
            if (practicalTask) {
              questionsText += (questionsText ? ' | ' : '') + practicalTask.text;
            }
            
            db.run(
              'INSERT INTO exam_history (id, username, ticket_number, questions, taken_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
              [historyId, studentUsername, ticket.number, questionsText],
              (err3) => {
                if (err3) {
                  console.error('Ошибка сохранения в историю:', err3);
                }
                
                // Извлекаем практическое задание, если есть
                const practicalTask = Array.isArray(parsed) ? null : (parsed.practicalTask || null);
                
                res.json({
                  success: true,
                  ticket: {
                    id: ticket.id,
                    number: ticket.number,
                    questions: questions,
                    practicalTask: practicalTask
                  }
                });
              }
            );
          }
        );
      });
    } else {
      // Старый формат без курсанта
      db.run(
        'UPDATE tickets SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?',
        [ticketId],
        function(err2) {
          if (err2) {
            return res.status(500).json({ error: err2.message });
          }

          // Сохраняем в историю
          const historyId = uuidv4();
          const parsed = JSON.parse(ticket.questions);
          const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
          const practicalTask = Array.isArray(parsed) ? null : (parsed.practicalTask || null);
          let questionsText = questions.map(q => typeof q === 'string' ? q : q.text).join(' | ');
          if (practicalTask) {
            questionsText += (questionsText ? ' | ' : '') + practicalTask.text;
          }
          
          db.run(
            'INSERT INTO exam_history (id, ticket_number, questions, taken_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [historyId, ticket.number, questionsText],
            (err3) => {
              if (err3) {
                console.error('Ошибка сохранения в историю:', err3);
              }
              
              // Извлекаем практическое задание, если есть
              const practicalTask = Array.isArray(parsed) ? null : (parsed.practicalTask || null);
              
              res.json({
                success: true,
                ticket: {
                  id: ticket.id,
                  number: ticket.number,
                  questions: questions,
                  practicalTask: practicalTask
                }
              });
            }
          );
        }
      );
    }
  });
});

// Загрузка вопросов из файла
app.post('/api/questions/upload', upload.single('file'), (req, res) => {
  console.log('=== Загрузка файла вопросов ===');
  console.log('Файл:', req.file ? req.file.originalname : 'нет файла');
  console.log('Путь к файлу:', req.file ? req.file.path : 'нет пути');
  console.log('Данные формы:', req.body);
  
  if (!req.file) {
    console.error('Ошибка: файл не загружен');
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  const { subject_id } = req.body;
  console.log('Subject ID:', subject_id);
  
  if (!subject_id) {
    console.error('Ошибка: subject_id отсутствует');
    if (fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Ошибка удаления файла:', e);
      }
    }
    return res.status(400).json({ error: 'ID дисциплины обязателен. Убедитесь, что дисциплина создана.' });
  }

  let fileContent;
  try {
    console.log('Чтение файла:', req.file.path);
    fileContent = fs.readFileSync(req.file.path, 'utf8');
    console.log('Размер файла:', fileContent.length, 'символов');
  } catch (readError) {
    console.error('Ошибка чтения файла:', readError);
    if (fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Ошибка удаления файла:', e);
      }
    }
    return res.status(500).json({ error: `Ошибка чтения файла: ${readError.message}` });
  }

  try {
    // Читаем файл построчно - каждая строка это отдельный вопрос
    // Формат файла: просто список вопросов, по одному на строку
    // subject_id передается отдельно через FormData, не извлекается из файла
    const lines = fileContent.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    console.log('Найдено строк:', lines.length);

    if (lines.length === 0) {
      console.error('Ошибка: файл пуст');
      if (fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('Ошибка удаления файла:', e);
        }
      }
      return res.status(400).json({ error: 'Файл пуст или не содержит вопросов' });
    }

    // Удаляем старые вопросы для этой дисциплины
    console.log('Удаление старых вопросов для subject_id:', subject_id);
    db.run('DELETE FROM questions WHERE subject_id = ?', [subject_id], (err) => {
      if (err) {
        console.error('Ошибка удаления старых вопросов:', err);
        if (fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {
            console.error('Ошибка удаления файла:', e);
          }
        }
        return res.status(500).json({ error: `Ошибка базы данных при удалении: ${err.message}` });
      }

      console.log('Добавление новых вопросов...');
      // Добавляем новые вопросы с порядковым номером из файла
      const stmt = db.prepare('INSERT INTO questions (id, text, subject_id, question_number) VALUES (?, ?, ?, ?)');
      let completed = 0;
      const errors = [];

      if (lines.length === 0) {
        stmt.finalize();
        if (fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {
            console.error('Ошибка удаления файла:', e);
          }
        }
        return res.status(400).json({ error: 'Нет вопросов для загрузки' });
      }

      lines.forEach((line, index) => {
        const id = uuidv4();
        const questionNumber = index + 1; // Порядковый номер из файла (начиная с 1)
        stmt.run([id, line, subject_id, questionNumber], (err) => {
          if (err) {
            console.error(`Ошибка при добавлении вопроса ${index + 1}:`, err);
            errors.push(`Строка ${index + 1}: ${err.message}`);
          }
          completed++;
          
          if (completed === lines.length) {
            stmt.finalize();
            if (fs.existsSync(req.file.path)) {
              try {
                fs.unlinkSync(req.file.path);
              } catch (e) {
                console.error('Ошибка удаления файла:', e);
              }
            }
            
            if (errors.length > 0) {
              console.error('Ошибки при загрузке:', errors);
              res.status(500).json({ error: `Ошибки при загрузке: ${errors.join('; ')}` });
            } else {
              console.log('Успешно загружено вопросов:', lines.length);
              res.json({ message: `Загружено ${lines.length} вопросов` });
            }
          }
        });
      });
    });
  } catch (error) {
    console.error('Ошибка обработки файла:', error);
    console.error('Stack trace:', error.stack);
    if (fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Ошибка удаления файла:', e);
      }
    }
    res.status(500).json({ error: `Ошибка обработки файла: ${error.message}` });
  }
});

// Получить все вопросы (с фильтрацией по дисциплине)
app.get('/api/questions', (req, res) => {
  const { subject_id } = req.query;
  
  let query = 'SELECT * FROM questions';
  const params = [];
  
  if (subject_id) {
    query += ' WHERE subject_id = ?';
    params.push(subject_id);
  }
  
  query += ' ORDER BY question_number, created_at';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Удалить вопросы (для конкретной дисциплины или все)
app.delete('/api/questions', (req, res) => {
  // Используем query параметры вместо body для DELETE запроса
  const { subject_id } = req.query || req.body;
  
  let deleteQuestionsQuery = 'DELETE FROM questions';
  let deleteTicketsQuery = 'DELETE FROM tickets';
  const params = [];
  
  if (subject_id) {
    deleteQuestionsQuery += ' WHERE subject_id = ?';
    deleteTicketsQuery += ' WHERE subject_id = ?';
    params.push(subject_id);
  }
  
  db.run(deleteQuestionsQuery, params, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Также удаляем билеты для этой дисциплины
    db.run(deleteTicketsQuery, params, (err2) => {
      if (err2) {
        return res.status(500).json({ error: err2.message });
      }
      const message = subject_id 
        ? 'Вопросы и билеты для дисциплины удалены'
        : 'Все вопросы и билеты удалены';
      res.json({ message });
    });
  });
});

// Получить конфигурацию
app.get('/api/config', async (req, res) => {
  try {
    const ticketCount = await getConfig('ticketCount', 20);
    const questionsPerTicket = await getConfig('questionsPerTicket', 3);
    const hasPracticalTasks = await getConfig('hasPracticalTasks', false);
    const practicalTasksCount = await getConfig('practicalTasksCount', 1);
    const hasSections = await getConfig('hasSections', false);
    const sectionBoundary = await getConfig('sectionBoundary', 0);
    res.json({ 
      ticketCount, 
      questionsPerTicket,
      hasPracticalTasks: hasPracticalTasks === true || hasPracticalTasks === 'true',
      practicalTasksCount: parseInt(practicalTasksCount) || 1,
      hasSections: hasSections === true || hasSections === 'true',
      sectionBoundary: parseInt(sectionBoundary) || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Сохранить конфигурацию
app.post('/api/config', async (req, res) => {
  const { ticketCount, questionsPerTicket, hasPracticalTasks, practicalTasksCount, hasSections, sectionBoundary } = req.body;
  
  if (ticketCount < 1 || ticketCount > 100) {
    return res.status(400).json({ error: 'Количество билетов должно быть от 1 до 100' });
  }
  
  if (questionsPerTicket < 1 || questionsPerTicket > 20) {
    return res.status(400).json({ error: 'Количество вопросов в билете должно быть от 1 до 20' });
  }
  
  if (hasPracticalTasks && (practicalTasksCount < 1 || practicalTasksCount > 100)) {
    return res.status(400).json({ error: 'Количество практических заданий должно быть от 1 до 100' });
  }

  if (hasSections && sectionBoundary < 1) {
    return res.status(400).json({ error: 'Граница между разделами должна быть больше 0' });
  }

  try {
    await setConfig('ticketCount', ticketCount);
    await setConfig('questionsPerTicket', questionsPerTicket);
    await setConfig('hasPracticalTasks', hasPracticalTasks || false);
    await setConfig('practicalTasksCount', practicalTasksCount || 1);
    await setConfig('hasSections', hasSections || false);
    await setConfig('sectionBoundary', sectionBoundary || 0);
    res.json({ message: 'Конфигурация сохранена' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Генерация билетов
app.post('/api/tickets/generate', async (req, res) => {
  try {
    // Получаем текущую сессию преподавателя (учебную группу и дисциплину)
    const teacherSession = req.body.session || {};
    const subjectId = teacherSession.subject_id || null;
    const groupId = teacherSession.group_id || null;

    if (!subjectId) {
      return res.status(400).json({ error: 'Необходимо выбрать дисциплину для генерации билетов' });
    }

    // Получаем конфигурацию из запроса или из базы данных
    const requestConfig = req.body.config || {};
    let ticketCount = requestConfig.ticketCount;
    let questionsPerTicket = requestConfig.questionsPerTicket;
    let hasPracticalTasks = requestConfig.hasPracticalTasks !== undefined ? requestConfig.hasPracticalTasks : false;
    let practicalTasksCount = requestConfig.practicalTasksCount || 1;
    let hasSections = requestConfig.hasSections !== undefined ? requestConfig.hasSections : false;
    let sectionBoundary = requestConfig.sectionBoundary || 0;

    // Если конфигурация не передана, используем сохраненную в базе
    if (!ticketCount) {
      ticketCount = await getConfig('ticketCount', 20);
    }
    if (!questionsPerTicket) {
      questionsPerTicket = await getConfig('questionsPerTicket', 3);
    }
    if (requestConfig.hasPracticalTasks === undefined) {
      const savedHasPractical = await getConfig('hasPracticalTasks', false);
      hasPracticalTasks = savedHasPractical === true || savedHasPractical === 'true';
    }
    if (!requestConfig.practicalTasksCount) {
      practicalTasksCount = await getConfig('practicalTasksCount', 1);
    }
    if (requestConfig.hasSections === undefined) {
      const savedHasSections = await getConfig('hasSections', false);
      hasSections = savedHasSections === true || savedHasSections === 'true';
    }
    if (!requestConfig.sectionBoundary) {
      sectionBoundary = await getConfig('sectionBoundary', 0);
    }
    
    // Валидация практических заданий
    if (hasPracticalTasks && (practicalTasksCount < 1 || practicalTasksCount > 100)) {
      return res.status(400).json({ error: 'Количество практических заданий должно быть от 1 до 100' });
    }
    
    // Валидация разделов
    if (hasSections && sectionBoundary < 1) {
      return res.status(400).json({ error: 'Граница между разделами должна быть больше 0' });
    }

    // Валидация конфигурации
    if (ticketCount < 1 || ticketCount > 100) {
      return res.status(400).json({ error: 'Количество билетов должно быть от 1 до 100' });
    }
    if (questionsPerTicket < 1 || questionsPerTicket > 20) {
      return res.status(400).json({ error: 'Количество вопросов в билете должно быть от 1 до 20' });
    }

    // Получаем вопросы для выбранной дисциплины
    db.all('SELECT * FROM questions WHERE subject_id = ?', [subjectId], async (err, questions) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (questions.length === 0) {
        return res.status(400).json({ error: 'Нет загруженных вопросов для выбранной дисциплины' });
      }

      if (!subjectId) {
        return res.status(400).json({ error: 'Необходимо выбрать дисциплину для генерации билетов' });
      }

      // Генерируем билеты
      try {
        const tickets = generateTickets(questions, ticketCount, questionsPerTicket, hasPracticalTasks, practicalTasksCount, hasSections, sectionBoundary);

        // Сначала удаляем старые билеты для этой учебной группы и дисциплины
        // Важно: всегда удаляем билеты для конкретной комбинации subject_id и group_id
        db.run('DELETE FROM tickets WHERE subject_id = ? AND group_id = ?', [subjectId, groupId], (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          // Фильтруем билеты, убирая дубликаты в текущей генерации
          // Сохраняем исходный порядок билетов (они уже отсортированы по номеру)
          const uniqueTickets = [];
          const seenHashes = new Set();
          
          for (const ticket of tickets) {
            if (!seenHashes.has(ticket.hash)) {
              seenHashes.add(ticket.hash);
              uniqueTickets.push(ticket); // Сохраняем исходный номер билета
            }
          }

          if (uniqueTickets.length === 0) {
            return res.status(400).json({ error: 'Не удалось создать уникальные билеты. Все комбинации дублируются.' });
          }

          // Сохраняем новые билеты
          const stmt = db.prepare('INSERT INTO tickets (id, number, questions, questions_hash, subject_id, group_id) VALUES (?, ?, ?, ?, ?, ?)');
          let completed = 0;
          const errors = [];
          const insertedHashes = new Set(); // Дополнительная проверка перед вставкой

          uniqueTickets.forEach((ticket) => {
            // Дополнительная проверка на дубликаты перед вставкой
            if (insertedHashes.has(ticket.hash)) {
              errors.push(`Билет ${ticket.number}: дубликат комбинации вопросов (пропущен)`);
              completed++;
              if (completed === uniqueTickets.length) {
                stmt.finalize();
                if (errors.length > 0) {
                  res.status(500).json({ error: errors.join('; ') });
                } else {
                  res.json({ 
                    message: `Сгенерировано ${uniqueTickets.length} уникальных билетов`,
                    total: tickets.length,
                    unique: uniqueTickets.length,
                    duplicates: tickets.length - uniqueTickets.length
                  });
                }
              }
              return;
            }

            insertedHashes.add(ticket.hash);
            const id = uuidv4();
            // Включаем практическое задание в JSON вместе с вопросами
            const ticketData = {
              questions: ticket.questions,
              practicalTask: ticket.practicalTask || null
            };
            const questionsJson = JSON.stringify(ticketData);
            
            stmt.run([id, ticket.number, questionsJson, ticket.hash, subjectId, groupId], (err) => {
              if (err) {
                if (err.message.includes('UNIQUE constraint')) {
                  errors.push(`Билет ${ticket.number}: дубликат комбинации вопросов (нарушение UNIQUE constraint)`);
                } else {
                  errors.push(`Билет ${ticket.number}: ${err.message}`);
                }
              }
              completed++;
              
              if (completed === uniqueTickets.length) {
                stmt.finalize();
                if (errors.length > 0) {
                  res.status(500).json({ error: errors.join('; ') });
                } else {
                  res.json({ 
                    message: `Сгенерировано ${uniqueTickets.length} уникальных билетов`,
                    total: tickets.length,
                    unique: uniqueTickets.length,
                    duplicates: tickets.length - uniqueTickets.length
                  });
                }
              }
            });
          });
        });
      } catch (genError) {
        res.status(400).json({ error: genError.message });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить все билеты (с фильтрацией по учебной группе и дисциплине, если указаны)
app.get('/api/tickets', (req, res) => {
  const { group_id, subject_id } = req.query;
  
  let query = `
    SELECT 
      t.*,
      u.full_name as student_full_name
    FROM tickets t
    LEFT JOIN users u ON t.used_by = u.username
  `;
  const params = [];
  const conditions = [];
  
  if (subject_id) {
    conditions.push('t.subject_id = ?');
    params.push(subject_id);
    
    if (group_id) {
      conditions.push('t.group_id = ?');
      params.push(group_id);
    }
  } else if (group_id) {
    conditions.push('t.group_id = ?');
    params.push(group_id);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY t.number';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const tickets = rows.map(row => ({
      ...row,
      questions: JSON.parse(row.questions),
      is_used: row.is_used === 1,
      used_by: row.student_full_name || row.used_by || null
    }));
    res.json(tickets);
  });
});

// Получить выбранный билет курсанта
app.get('/api/tickets/selected', (req, res) => {
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: 'Имя пользователя обязательно' });
  }
  
  // Получаем билет, выбранный этим курсантом
  db.get(
    'SELECT * FROM tickets WHERE used_by = ? AND is_used = 1',
    [username],
    (err, ticket) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!ticket) {
        return res.json(null);
      }
      
      // Проверяем, завершил ли курсант сдачу
      db.get(
        'SELECT completed_at FROM exam_history WHERE username = ? AND ticket_number = ?',
        [username, ticket.number],
        (err2, history) => {
          if (err2) {
            return res.status(500).json({ error: err2.message });
          }
          
          res.json({
            id: ticket.id,
            number: ticket.number,
            questions: JSON.parse(ticket.questions),
            used_at: ticket.used_at,
            completed: history && history.completed_at ? true : false,
            completed_at: history ? history.completed_at : null
          });
        }
      );
    }
  );
});

// Завершить сдачу зачета/экзамена
app.post('/api/tickets/complete', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Имя пользователя обязательно' });
  }
  
  // Получаем билет курсанта
  db.get(
    'SELECT * FROM tickets WHERE used_by = ? AND is_used = 1',
    [username],
    (err, ticket) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!ticket) {
        return res.status(404).json({ error: 'Билет не найден' });
      }
      
      // Обновляем запись в истории, отмечая завершение
      db.run(
        'UPDATE exam_history SET completed_at = CURRENT_TIMESTAMP WHERE username = ? AND ticket_number = ?',
        [username, ticket.number],
        function(err2) {
          if (err2) {
            return res.status(500).json({ error: err2.message });
          }
          
          if (this.changes === 0) {
            // Если записи в истории нет, создаем её
            const historyId = uuidv4();
            const questions = JSON.parse(ticket.questions);
            const questionsText = questions.map(q => q.text).join(' | ');
            
            // Проверяем структуру таблицы для определения нужных колонок
            db.all("PRAGMA table_info(exam_history)", (pragmaErr, pragmaCols) => {
              if (pragmaErr) {
                return res.status(500).json({ error: pragmaErr.message });
              }
              
              const hasStudentName = pragmaCols.some(col => col.name === 'student_name');
              const hasUsername = pragmaCols.some(col => col.name === 'username');
              
              let insertQuery, insertParams;
              
              if (hasStudentName && hasUsername) {
                // Если есть обе колонки, заполняем обе
                insertQuery = 'INSERT INTO exam_history (id, username, student_name, ticket_number, questions, completed_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)';
                insertParams = [historyId, username, username, ticket.number, questionsText];
              } else if (hasStudentName && !hasUsername) {
                // Если есть только student_name
                insertQuery = 'INSERT INTO exam_history (id, student_name, ticket_number, questions, completed_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)';
                insertParams = [historyId, username, ticket.number, questionsText];
              } else {
                // Если есть только username или обе колонки отсутствуют
                insertQuery = 'INSERT INTO exam_history (id, username, ticket_number, questions, completed_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)';
                insertParams = [historyId, username, ticket.number, questionsText];
              }
              
              db.run(insertQuery, insertParams, (err3) => {
                if (err3) {
                  return res.status(500).json({ error: err3.message });
                }
                res.json({ message: 'Сдача зачета/экзамена завершена', completed_at: new Date().toISOString() });
              });
            });
          } else {
            res.json({ message: 'Сдача зачета/экзамена завершена', completed_at: new Date().toISOString() });
          }
        }
      );
    }
  );
});

// Завершить все незавершенные зачеты для учебной группы и дисциплины
app.post('/api/tickets/complete-all', (req, res) => {
  const { group_id, subject_id } = req.body;
  
  if (!group_id || !subject_id) {
    return res.status(400).json({ error: 'Необходимо указать учебную группу и дисциплину' });
  }
  
  // Получаем всех курсантов учебной группы, у которых есть незавершенные зачеты
  db.all(`
    SELECT DISTINCT h.username, u.full_name
    FROM exam_history h
    JOIN users u ON h.username = u.username
    JOIN tickets t ON t.used_by = h.username AND t.number = h.ticket_number
    WHERE u.group_id = ? 
      AND t.subject_id = ?
      AND (h.completed_at IS NULL OR h.completed_at = '')
      AND h.username IS NOT NULL
  `, [group_id, subject_id], (err, students) => {
    if (err) {
      console.error('Ошибка при получении списка курсантов:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (students.length === 0) {
      return res.json({ 
        message: 'Нет незавершенных зачетов для завершения',
        completed: 0
      });
    }
    
    // Завершаем зачеты для всех найденных курсантов
    let completed = 0;
    let errors = [];
    
    const updatePromises = students.map((student) => {
      return new Promise((resolve) => {
        db.run(
          'UPDATE exam_history SET completed_at = CURRENT_TIMESTAMP WHERE username = ? AND completed_at IS NULL',
          [student.username],
          function(updateErr) {
            if (updateErr) {
              errors.push(`Ошибка для ${student.username}: ${updateErr.message}`);
            } else {
              completed += this.changes;
            }
            resolve();
          }
        );
      });
    });
    
    Promise.all(updatePromises).then(() => {
      console.log(`Завершено зачетов: ${completed} из ${students.length}`);
      res.json({ 
        message: `Завершено ${completed} зачетов из ${students.length}`,
        completed: completed,
        total: students.length,
        errors: errors.length > 0 ? errors : undefined
      });
    }).catch((promiseErr) => {
      console.error('Ошибка при завершении зачетов:', promiseErr);
      res.status(500).json({ error: 'Ошибка при завершении зачетов' });
    });
  });
});

// Получить доступные билеты (не использованные)
app.get('/api/tickets/available', (req, res) => {
  const { username } = req.query;
  
  // Получаем учебную группу курсанта
  db.get('SELECT group_id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!user || !user.group_id) {
      return res.status(400).json({ error: 'Курсант не привязан к учебной группе' });
    }
    
    // Получаем активную сессию для этой учебной группы (самую последнюю)
    db.get(
      `SELECT subject_id FROM group_subjects WHERE group_id = ? ORDER BY created_at DESC LIMIT 1`,
      [user.group_id],
      (err2, session) => {
        if (err2) {
          return res.status(500).json({ error: err2.message });
        }
        
        if (!session || !session.subject_id) {
          // Нет активной сессии - зачет завершен, билеты нельзя выбирать
          return res.status(403).json({ 
            error: 'Зачет завершен. Выбор билетов больше недоступен.',
            examCompleted: true
          });
        }
        
        // Получаем билеты для этой учебной группы и дисциплины (только не использованные)
        // Важно: проверяем, что group_id точно совпадает (не NULL и не другая учебная группа)
        db.all(
          'SELECT * FROM tickets WHERE is_used = 0 AND group_id = ? AND subject_id = ? ORDER BY number',
          [user.group_id, session.subject_id],
          (err3, rows) => {
            if (err3) {
              return res.status(500).json({ error: err3.message });
            }
            const tickets = rows.map(row => ({
              id: row.id,
              number: row.number,
              questions: JSON.parse(row.questions)
            }));
            // Перемешиваем для случайности
            const shuffled = tickets.sort(() => 0.5 - Math.random());
            res.json(shuffled);
          }
        );
      }
    );
  });
});

// Выбрать билет (курсант)
app.post('/api/tickets/:ticketId/select', (req, res) => {
  const { ticketId } = req.params;
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Имя пользователя обязательно' });
  }

  // Проверяем, есть ли активная сессия для учебной группы курсанта
  db.get('SELECT group_id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!user || !user.group_id) {
      return res.status(400).json({ error: 'Курсант не привязан к учебной группе' });
    }
    
    // Проверяем наличие активной сессии
    db.get(
      `SELECT subject_id FROM group_subjects WHERE group_id = ? ORDER BY created_at DESC LIMIT 1`,
      [user.group_id],
      (err2, session) => {
        if (err2) {
          return res.status(500).json({ error: err2.message });
        }
        
        if (!session || !session.subject_id) {
          // Нет активной сессии - зачет завершен
          return res.status(403).json({ 
            error: 'Зачет завершен. Выбор билетов больше недоступен.',
            examCompleted: true
          });
        }

        // Проверяем, не использован ли билет
        db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err3, ticket) => {
          if (err3) {
            return res.status(500).json({ error: err3.message });
          }

          if (!ticket) {
            return res.status(404).json({ error: 'Билет не найден' });
          }

          if (ticket.is_used === 1) {
            return res.status(400).json({ error: 'Этот билет уже использован' });
          }

          // Проверяем, что билет принадлежит правильной учебной группе и дисциплине
          if (ticket.group_id !== user.group_id || ticket.subject_id !== session.subject_id) {
            return res.status(403).json({ error: 'Этот билет не предназначен для вашей учебной группы' });
          }

          // Проверяем, не выбрал ли уже этот курсант билет
          db.get('SELECT * FROM tickets WHERE used_by = ? AND is_used = 1', [username], (err4, existingTicket) => {
            if (err4) {
              return res.status(500).json({ error: err4.message });
            }

            if (existingTicket) {
              return res.status(400).json({ error: 'Вы уже выбрали билет. Один курсант может выбрать только один билет.' });
            }

            // Помечаем билет как использованный
            db.run(
              'UPDATE tickets SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?',
              [username, ticketId],
              function(err5) {
                if (err5) {
                  return res.status(500).json({ error: err5.message });
                }

                // Сохраняем в историю
                const historyId = uuidv4();
                const questions = JSON.parse(ticket.questions);
                const questionsText = questions.map(q => q.text).join(' | ');
                
                // Проверяем структуру таблицы для определения нужных колонок
                db.all("PRAGMA table_info(exam_history)", (pragmaErr, pragmaCols) => {
                  if (pragmaErr) {
                    console.error('Ошибка проверки структуры таблицы:', pragmaErr);
                    return;
                  }
                  
                  const hasStudentName = pragmaCols.some(col => col.name === 'student_name');
                  const hasUsername = pragmaCols.some(col => col.name === 'username');
                  
                  let insertQuery, insertParams;
                  
                  if (hasStudentName && hasUsername) {
                    // Если есть обе колонки, заполняем обе
                    insertQuery = 'INSERT INTO exam_history (id, username, student_name, ticket_number, questions) VALUES (?, ?, ?, ?, ?)';
                    insertParams = [historyId, username, username, ticket.number, questionsText];
                  } else if (hasStudentName && !hasUsername) {
                    // Если есть только student_name
                    insertQuery = 'INSERT INTO exam_history (id, student_name, ticket_number, questions) VALUES (?, ?, ?, ?)';
                    insertParams = [historyId, username, ticket.number, questionsText];
                  } else {
                    // Если есть только username или обе колонки отсутствуют
                    insertQuery = 'INSERT INTO exam_history (id, username, ticket_number, questions) VALUES (?, ?, ?, ?)';
                    insertParams = [historyId, username, ticket.number, questionsText];
                  }
                  
                  db.run(insertQuery, insertParams, (err6) => {
                    if (err6) {
                      console.error('Ошибка сохранения истории:', err6);
                      return res.status(500).json({ error: 'Ошибка сохранения истории' });
                    }
                    
                    res.json({ 
                      success: true, 
                      ticket: {
                        id: ticket.id,
                        number: ticket.number,
                        questions: questions
                      }
                    });
                  });
                });
              }
            );
          });
        });
      });
    });
  });

// Получить статистику
app.get('/api/statistics', (req, res) => {
  const { group_id, subject_id } = req.query;
  
  // Формируем запрос с фильтрацией по учебной группе и дисциплине, если они указаны
  let query = 'SELECT COUNT(*) as total, SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used FROM tickets WHERE 1=1';
  const params = [];
  
  if (subject_id) {
    query += ' AND subject_id = ?';
    params.push(subject_id);
  }
  
  if (group_id) {
    query += ' AND group_id = ?';
    params.push(group_id);
  }
  
  db.get(query, params, (err, stats) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const total = stats.total || 0;
    const used = stats.used || 0;
    const available = total - used;

    res.json({
      total,
      used,
      available
    });
  });
});

// Получить историю сдачи
app.get('/api/history', (req, res) => {
  db.all(`
    SELECT 
      h.*,
      u.full_name,
      u.username
    FROM exam_history h
    LEFT JOIN users u ON h.username = u.username
    ORDER BY h.taken_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('Ошибка при получении истории:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('Найдено записей в истории:', rows.length);
    // Для обратной совместимости, если есть старые записи с student_name
    const formattedRows = rows.map(row => ({
      ...row,
      student_name: row.full_name || row.username || row.student_name || 'Неизвестно',
      completed_at: row.completed_at || null,
      username: row.username || row.student_name || 'Неизвестно',
      display_name: row.full_name || row.username || row.student_name || 'Неизвестно'
    }));
    console.log('Отформатированные записи:', formattedRows.length);
    res.json(formattedRows);
  });
});

// Удаление всех билетов для текущей сессии преподавателя
app.delete('/api/tickets', (req, res) => {
  try {
    // Используем query параметры вместо body для DELETE запросов
    const { group_id, subject_id } = req.query;
    
    if (!subject_id) {
      return res.status(400).json({ error: 'Необходимо указать дисциплину' });
    }
    
    // Удаляем билеты с учетом NULL значений в group_id
    let deleteQuery;
    const params = [];
    
    if (group_id) {
      // Если указана учебная группа, удаляем билеты для этой учебной группы и дисциплины
      // Также удаляем билеты с NULL group_id для этой дисциплины (старые билеты)
      deleteQuery = 'DELETE FROM tickets WHERE subject_id = ? AND (group_id = ? OR group_id IS NULL)';
      params.push(subject_id, group_id);
    } else {
      // Если учебная группа не указана, удаляем все билеты для этой дисциплины
      deleteQuery = 'DELETE FROM tickets WHERE subject_id = ?';
      params.push(subject_id);
    }
    
    console.log('Выполняется удаление билетов:', deleteQuery, params);
    
    db.run(deleteQuery, params, function(err) {
      if (err) {
        console.error('Ошибка при удалении билетов:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log(`Удалено билетов: ${this.changes}`);
      res.json({ 
        message: `Удалено ${this.changes} билетов`,
        deleted: this.changes
      });
    });
  } catch (error) {
    console.error('Ошибка при удалении билетов:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить учет курсантов (кто какой билет выбрал)
app.get('/api/students/accounting', (req, res) => {
  db.all(`
    SELECT 
      t.used_by as username,
      t.number as ticket_number,
      t.used_at,
      t.questions,
      h.questions as history_questions
    FROM tickets t
    LEFT JOIN exam_history h ON t.used_by = h.username AND t.number = h.ticket_number
    WHERE t.is_used = 1
    ORDER BY t.used_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const formatted = rows.map(row => ({
      username: row.username,
      ticket_number: row.ticket_number,
      used_at: row.used_at,
      questions: row.history_questions ? row.history_questions.split(' | ') : []
    }));
    res.json(formatted);
  });
});

// Получить статистику по билетам для группы и дисциплины
app.get('/api/tickets/statistics', (req, res) => {
  const { group_id, subject_id } = req.query;
  
  if (!group_id || !subject_id) {
    return res.status(400).json({ error: 'Необходимо указать group_id и subject_id' });
  }
  
  db.all(`
    SELECT 
      t.id as ticket_id,
      t.number as ticket_number,
      t.used_at,
      t.used_by,
      t.questions,
      u.id as student_id,
      u.full_name as student_name,
      u.username
    FROM tickets t
    LEFT JOIN users u ON t.used_by = u.username
    WHERE t.group_id = ? AND t.subject_id = ? AND t.is_used = 1
    ORDER BY t.used_at ASC
  `, [group_id, subject_id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const statistics = rows.map(row => {
      // Парсим вопросы из JSON
      let questions = [];
      let practicalTask = null;
      try {
        const parsed = JSON.parse(row.questions);
        if (Array.isArray(parsed)) {
          questions = parsed;
        } else {
          questions = parsed.questions || [];
          practicalTask = parsed.practicalTask || null;
        }
      } catch (e) {
        console.error('Ошибка парсинга вопросов:', e);
      }
      
      return {
        ticket_id: row.ticket_id,
        ticket_number: row.ticket_number,
        student_id: row.student_id,
        student_name: row.student_name || 'Неизвестно',
        used_at: row.used_at,
        questions: questions,
        practicalTask: practicalTask
      };
    });
    
    res.json(statistics);
  });
});

// Сбросить статистику
app.post('/api/reset', (req, res) => {
  const { group_id, subject_id } = req.body;
  
  // Если указаны group_id и subject_id, сбрасываем статистику только для этой учебной группы и дисциплины
  if (group_id && subject_id) {
    // Освобождаем билеты для этой учебной группы и дисциплины
    db.run(
      'UPDATE tickets SET is_used = 0, used_by = NULL, used_at = NULL WHERE group_id = ? AND subject_id = ?',
      [group_id, subject_id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Удаляем историю для этой учебной группы и дисциплины
        // Используем JOIN для более точного удаления
        db.run(
          `DELETE FROM exam_history 
           WHERE username IN (
             SELECT u.username 
             FROM users u
             JOIN tickets t ON t.used_by = u.username
             WHERE u.group_id = ? AND t.subject_id = ?
           )`,
          [group_id, subject_id],
          (err2) => {
            if (err2) {
              console.error('Ошибка при удалении истории:', err2);
              // Продолжаем выполнение даже если удаление истории не удалось
            }
            res.json({ message: 'Статистика сброшена для учебной группы и дисциплины' });
          }
        );
      }
    );
  } else {
    // Глобальный сброс (для обратной совместимости)
    db.run('UPDATE tickets SET is_used = 0, used_by = NULL, used_at = NULL', (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.run('DELETE FROM exam_history', (err2) => {
        if (err2) {
          return res.status(500).json({ error: err2.message });
        }
        res.json({ message: 'Статистика сброшена' });
      });
    });
  }
});

// Полный сброс всех данных
app.delete('/api/reset-all', (req, res) => {
  console.log('Выполняется полный сброс всех данных...');
  
  // Удаляем все данные в правильном порядке (с учетом внешних ключей)
  db.serialize(() => {
    // 1. Удаляем историю экзаменов
    db.run('DELETE FROM exam_history', (err) => {
      if (err) {
        console.error('Ошибка при удалении истории:', err);
        return res.status(500).json({ error: 'Ошибка при удалении истории: ' + err.message });
      }
      console.log('История экзаменов удалена');
      
      // 2. Удаляем билеты
      db.run('DELETE FROM tickets', (err) => {
        if (err) {
          console.error('Ошибка при удалении билетов:', err);
          return res.status(500).json({ error: 'Ошибка при удалении билетов: ' + err.message });
        }
        console.log('Билеты удалены');
        
        // 3. Удаляем вопросы
        db.run('DELETE FROM questions', (err) => {
          if (err) {
            console.error('Ошибка при удалении вопросов:', err);
            return res.status(500).json({ error: 'Ошибка при удалении вопросов: ' + err.message });
          }
          console.log('Вопросы удалены');
          
          // 4. Удаляем пользователей (студентов)
          db.run("DELETE FROM users WHERE role = 'student'", (err) => {
            if (err) {
              console.error('Ошибка при удалении студентов:', err);
              return res.status(500).json({ error: 'Ошибка при удалении студентов: ' + err.message });
            }
            console.log('Студенты удалены');
            
            // 5. Удаляем группы
            db.run('DELETE FROM groups', (err) => {
              if (err) {
                console.error('Ошибка при удалении групп:', err);
                return res.status(500).json({ error: 'Ошибка при удалении групп: ' + err.message });
              }
              console.log('Группы удалены');
              
              // 6. Удаляем дисциплины
              db.run('DELETE FROM subjects', (err) => {
                if (err) {
                  console.error('Ошибка при удалении дисциплин:', err);
                  return res.status(500).json({ error: 'Ошибка при удалении дисциплин: ' + err.message });
                }
                console.log('Дисциплины удалены');
                
                // 7. Удаляем конфигурацию
                db.run('DELETE FROM config', (err) => {
                  if (err) {
                    console.error('Ошибка при удалении конфигурации:', err);
                    return res.status(500).json({ error: 'Ошибка при удалении конфигурации: ' + err.message });
                  }
                  console.log('Конфигурация удалена');
                  
                  console.log('Все данные успешно удалены');
                  res.json({ message: 'Все данные успешно удалены' });
                });
              });
            });
          });
        });
      });
    });
  });
});

// ========== API для управления учебными группами ==========

// Получить все учебные группы
app.get('/api/groups', (req, res) => {
  db.all('SELECT * FROM groups ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Создать учебную группу (или получить существующую)
app.post('/api/groups', (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Название учебной группы обязательно' });
  }

  // Сначала проверяем, существует ли группа с таким названием
  db.get('SELECT * FROM groups WHERE name = ?', [name], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existing) {
      // Возвращаем существующую группу
      return res.json({ 
        id: existing.id, 
        name: existing.name, 
        description: existing.description || '' 
      });
    }

    // Создаем новую группу
    const id = uuidv4();
    db.run(
      'INSERT INTO groups (id, name, description) VALUES (?, ?, ?)',
      [id, name, description || ''],
      function(err2) {
        if (err2) {
          return res.status(500).json({ error: err2.message });
        }
        res.json({ id, name, description: description || '' });
      }
    );
  });
});

// Удалить учебную группу
app.delete('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  
  // Проверяем, есть ли курсанты в учебной группе
  db.get('SELECT COUNT(*) as count FROM users WHERE group_id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (row.count > 0) {
      return res.status(400).json({ error: 'Нельзя удалить учебную группу, в которой есть курсанты' });
    }

    db.run('DELETE FROM groups WHERE id = ?', [id], function(err2) {
      if (err2) {
        return res.status(500).json({ error: err2.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Учебная группа не найдена' });
      }
      res.json({ message: 'Учебная группа удалена' });
    });
  });
});

// ========== API для управления пользователями (только для курсантов) ==========

// Создать пользователя (курсанта)
app.post('/api/users', (req, res) => {
  const { username, password, role, full_name, group_id } = req.body;
  
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Логин, пароль и роль обязательны' });
  }

  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'Роль должна быть student или teacher' });
  }

  // Проверяем, существует ли пользователь с таким логином
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }

    // Проверяем, существует ли группа (если указана)
    if (group_id) {
      db.get('SELECT * FROM groups WHERE id = ?', [group_id], (err2, group) => {
        if (err2) {
          return res.status(500).json({ error: err2.message });
        }
        if (!group) {
          return res.status(400).json({ error: 'Учебная группа не найдена' });
        }

        // Создаем пользователя
        const userId = uuidv4();
        db.run(
          'INSERT INTO users (id, username, password, role, full_name, group_id) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, username, password, role, full_name || '', group_id],
          function(err3) {
            if (err3) {
              return res.status(500).json({ error: err3.message });
            }
            res.json({ 
              id: userId, 
              username, 
              role, 
              full_name: full_name || '', 
              group_id 
            });
          }
        );
      });
    } else {
      // Создаем пользователя без группы
      const userId = uuidv4();
      db.run(
        'INSERT INTO users (id, username, password, role, full_name, group_id) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, username, password, role, full_name || '', null],
        function(err3) {
          if (err3) {
            return res.status(500).json({ error: err3.message });
          }
          res.json({ 
            id: userId, 
            username, 
            role, 
            full_name: full_name || '', 
            group_id: null 
          });
        }
      );
    }
  });
});

// Получить курсантов учебной группы
app.get('/api/groups/:groupId/students', (req, res) => {
  const { groupId } = req.params;
  
  db.all(
    'SELECT * FROM users WHERE group_id = ? AND role = ? ORDER BY username',
    [groupId, 'student'],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Получить курсантов учебной группы со статусом выполнения зачета
app.get('/api/groups/:groupId/students-with-status', (req, res) => {
  const { groupId } = req.params;
  const { subject_id } = req.query;
  
  if (!subject_id) {
    return res.status(400).json({ error: 'Необходимо указать subject_id' });
  }
  
  // Получаем всех курсантов группы (роль может быть 'student' или 'kursant')
  db.all(
    `SELECT u.*, 
     (SELECT COUNT(*) FROM tickets t 
      WHERE t.used_by = u.username 
      AND t.subject_id = ? 
      AND t.is_used = 1) as has_ticket,
     (SELECT h.completed_at FROM exam_history h
      JOIN tickets t ON t.used_by = h.username AND t.number = h.ticket_number
      WHERE h.username = u.username 
      AND t.subject_id = ?
      AND h.completed_at IS NOT NULL
      LIMIT 1) as completed_at
     FROM users u 
     WHERE u.group_id = ? AND (u.role = 'student' OR u.role = 'kursant')
     ORDER BY u.username`,
    [subject_id, subject_id, groupId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Форматируем результат
      const students = rows.map(row => ({
        id: row.id,
        username: row.username,
        password: row.password,
        full_name: row.full_name || row.display_name || '-',
        has_ticket: row.has_ticket > 0,
        completed_at: row.completed_at,
        status: row.completed_at ? 'completed' : (row.has_ticket > 0 ? 'in_progress' : 'not_started')
      }));
      
      res.json(students);
    }
  );
});

// ========== API для управления дисциплинами ==========

// Получить все дисциплины
app.get('/api/subjects', (req, res) => {
  db.all('SELECT * FROM subjects ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Создать дисциплину (или получить существующую)
app.post('/api/subjects', (req, res) => {
  const { name, type, description } = req.body;
  
  if (!name || !type) {
    return res.status(400).json({ error: 'Название и тип дисциплины обязательны' });
  }

  if (!['exam', 'test'].includes(type)) {
    return res.status(400).json({ error: 'Тип должен быть exam (экзамен) или test (зачет)' });
  }

  // Сначала проверяем, существует ли дисциплина с таким названием
  db.get('SELECT * FROM subjects WHERE name = ?', [name], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existing) {
      // Возвращаем существующую дисциплину
      return res.json({ 
        id: existing.id, 
        name: existing.name, 
        type: existing.type, 
        description: existing.description || '' 
      });
    }

    // Создаем новую дисциплину
    const id = uuidv4();
    db.run(
      'INSERT INTO subjects (id, name, type, description) VALUES (?, ?, ?, ?)',
      [id, name, type, description || ''],
      function(err2) {
        if (err2) {
          return res.status(500).json({ error: err2.message });
        }
        res.json({ id, name, type, description: description || '' });
      }
    );
  });
});

// Удалить дисциплину
app.delete('/api/subjects/:id', (req, res) => {
  const { id } = req.params;
  
  // Проверяем, есть ли билеты для этой дисциплины
  db.get('SELECT COUNT(*) as count FROM tickets WHERE subject_id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (row.count > 0) {
      return res.status(400).json({ error: 'Нельзя удалить дисциплину, для которой есть билеты' });
    }
    
    db.run('DELETE FROM subjects WHERE id = ?', [id], function(err2) {
      if (err2) {
        return res.status(500).json({ error: err2.message });
      }
      res.json({ message: 'Дисциплина удалена' });
    });
  });
});

// Endpoints для сессий преподавателя удалены - больше не используются (авторизация убрана)

// Генерация логина из имени
function generateUsername(fullName, role, index) {
  if (!fullName || fullName.trim() === '') {
    return `${role}${index + 1}`;
  }
  
  // Убираем все нелатинские символы и транслитерируем
  const transliterate = (str) => {
    const map = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    return str.toLowerCase().split('').map(char => map[char] || char).join('').replace(/[^a-z0-9]/g, '');
  };
  
  const parts = fullName.trim().split(/\s+/).filter(p => p.length > 0);
  if (parts.length >= 2) {
    const first = transliterate(parts[0]);
    const second = transliterate(parts[1]);
    return `${first}${second.charAt(0)}${index + 1}`;
  } else if (parts.length === 1) {
    return `${transliterate(parts[0])}${index + 1}`;
  } else {
    return `${role}${index + 1}`;
  }
}

// Генерация пароля
function generatePassword(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Импорт курсантов из файла (только для создания записей курсантов)
app.post('/api/users/import', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  const { group_id } = req.body; // Если передан group_id, все курсанты будут добавлены в эту группу

  try {
    let fileContent;
    try {
      // Пытаемся прочитать файл в UTF-8
      fileContent = fs.readFileSync(req.file.path, 'utf8');
    } catch (readError) {
      // Если не получилось, пробуем другие кодировки
      try {
        fileContent = fs.readFileSync(req.file.path, 'latin1');
      } catch (e) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Ошибка чтения файла. Убедитесь, что файл в кодировке UTF-8 или ANSI.' });
      }
    }
    
    const lines = fileContent.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));

    if (lines.length === 0) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Файл пуст или не содержит данных' });
    }

    const results = {
      created: [],
      errors: [],
      total: lines.length
    };

    const usedUsernames = new Set();
    
    // Получаем существующие логины
    db.all('SELECT username FROM users', (err, existingUsers) => {
      if (err) {
        console.error('Ошибка при получении существующих пользователей:', err);
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ error: `Ошибка базы данных: ${err.message}` });
      }

      if (existingUsers && Array.isArray(existingUsers)) {
        existingUsers.forEach(u => {
          if (u && u.username) {
            usedUsernames.add(u.username);
          }
        });
      }

      // Получаем все учебные группы для маппинга (если group_id не указан)
      db.all('SELECT * FROM groups', (err2, allGroups) => {
        if (err2) {
          console.error('Ошибка при получении групп:', err2);
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(500).json({ error: `Ошибка базы данных: ${err2.message}` });
        }

        const groupMap = {};
        if (allGroups && Array.isArray(allGroups)) {
          allGroups.forEach(g => {
            if (g && g.name && g.id) {
              groupMap[g.name.toLowerCase()] = g.id;
            }
          });
        }

        // Обрабатываем все строки асинхронно
        const promises = lines.map((line, index) => {
          return new Promise((resolve) => {
            try {
              let fullName, role, targetGroupId, groupName = null;
              
              // Если передан group_id, то формат упрощенный: просто ФИО
              if (group_id) {
                fullName = line;
                role = 'student';
                targetGroupId = group_id;
              } else {
                // Старый формат: ФИО, роль, учебная группа (опционально)
                const parts = line.split(',').map(p => p.trim());
                
                if (parts.length < 2) {
                  results.errors.push({
                    line: index + 1,
                    error: 'Неверный формат строки. Ожидается: ФИО, роль [, группа]'
                  });
                  return resolve();
                }

                fullName = parts[0];
                role = parts[1].toLowerCase();
                groupName = parts[2] || '';

                if (!['student', 'teacher'].includes(role)) {
                  results.errors.push({
                    line: index + 1,
                    error: `Неверная роль: ${role}. Допустимы: student, teacher`
                  });
                  return resolve();
                }

                // Находим учебную группу
                targetGroupId = null;
                if (groupName && groupMap[groupName.toLowerCase()]) {
                  targetGroupId = groupMap[groupName.toLowerCase()];
                }
              }

              if (!fullName || fullName.trim() === '') {
                results.errors.push({
                  line: index + 1,
                  error: 'ФИО не может быть пустым'
                });
                return resolve();
              }

              // Генерируем уникальный логин
              let username = generateUsername(fullName, role, index);
              let counter = 1;
              while (usedUsernames.has(username)) {
                username = `${generateUsername(fullName, role, index)}${counter}`;
                counter++;
              }
              usedUsernames.add(username);

              // Генерируем пароль
              const password = generatePassword(8);

              // Создаем пользователя
              const userId = uuidv4();
              db.run(
                'INSERT INTO users (id, username, password, role, full_name, group_id) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, username, password, role, fullName, targetGroupId],
                function(err3) {
                  if (err3) {
                    console.error(`Ошибка при создании пользователя на строке ${index + 1}:`, err3);
                    results.errors.push({
                      line: index + 1,
                      error: err3.message || 'Ошибка базы данных'
                    });
                  } else {
                    results.created.push({
                      username,
                      password,
                      full_name: fullName,
                      role,
                      group: groupName || null
                    });
                  }
                  resolve();
                }
              );
            } catch (error) {
              console.error(`Ошибка обработки строки ${index + 1}:`, error);
              results.errors.push({
                line: index + 1,
                error: error.message || 'Неизвестная ошибка'
              });
              resolve();
            }
          });
        });

        // Ждем завершения всех операций
        Promise.all(promises).then(() => {
          if (fs.existsSync(req.file.path)) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
              console.error('Ошибка удаления временного файла:', unlinkError);
            }
          }
          res.json({
            message: `Обработано ${lines.length} строк`,
            created: results.created.length,
            errors: results.errors.length,
            details: results
          });
        }).catch((error) => {
          console.error('Ошибка при обработке импорта:', error);
          if (fs.existsSync(req.file.path)) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
              console.error('Ошибка удаления временного файла:', unlinkError);
            }
          }
          res.status(500).json({ error: error.message || 'Ошибка при обработке импорта' });
        });
      });
    });
  } catch (error) {
    console.error('Критическая ошибка при импорте курсантов:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Ошибка удаления временного файла:', unlinkError);
      }
    }
    res.status(500).json({ error: error.message || 'Критическая ошибка при импорте' });
  }
});

// Обслуживание статических файлов и SPA маршрутизация (должно быть после всех API маршрутов)
const indexHtmlPath = path.join(clientBuildPath, 'index.html');
const isBuildReady = fs.existsSync(clientBuildPath) && fs.existsSync(indexHtmlPath);

// Путь к странице билетов и статистики
const ticketsPagePath = path.join(__dirname, 'public', 'index.html');

// Обслуживание страницы билетов и статистики на корневом пути
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
    // Если это не API запрос и не корневой путь, отдаем React приложение
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
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0e27;
            background-image: 
              radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.1), transparent),
              radial-gradient(2px 2px at 60px 70px, rgba(255,255,255,0.08), transparent),
              radial-gradient(1px 1px at 50px 50px, rgba(255,255,255,0.06), transparent),
              linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1629 100%);
            background-size: 200% 200%, 200% 200%, 200% 200%, 100% 100%;
            min-height: 100vh;
            color: #e0e7ff;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
            overflow-x: hidden;
          }
          
          body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at 20% 50%, rgba(37, 99, 235, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 80%, rgba(129, 140, 248, 0.1) 0%, transparent 50%);
            pointer-events: none;
            z-index: 0;
          }
          
          .container {
            max-width: 900px;
            width: 100%;
            z-index: 1;
            position: relative;
          }
          
          .header {
            text-align: center;
            margin-bottom: 50px;
            animation: fadeInDown 0.8s ease-out;
          }
          
          .logo {
            font-size: 4rem;
            margin-bottom: 20px;
            background: linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #60a5fa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            filter: drop-shadow(0 0 20px rgba(129, 140, 248, 0.5));
            animation: glow 3s ease-in-out infinite alternate;
          }
          
          @keyframes glow {
            from { filter: drop-shadow(0 0 10px rgba(129, 140, 248, 0.5)); }
            to { filter: drop-shadow(0 0 30px rgba(129, 140, 248, 0.8)); }
          }
          
          h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 15px;
            background: linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #60a5fa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .subtitle {
            font-size: 1.2rem;
            color: #a5b4fc;
            opacity: 0.9;
          }
          
          .status-card {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 2px solid rgba(99, 102, 241, 0.3);
            border-radius: 20px;
            padding: 40px;
            margin-bottom: 30px;
            box-shadow: 
              0 8px 32px rgba(0, 0, 0, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 0 40px rgba(99, 102, 241, 0.2);
            animation: fadeInUp 0.8s ease-out 0.2s both;
          }
          
          .status-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 25px;
          }
          
          .status-indicator {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #4ade80;
            box-shadow: 0 0 20px rgba(74, 222, 128, 0.6);
            animation: pulse 2s ease-in-out infinite;
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
          }
          
          .status-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #e0e7ff;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 25px;
          }
          
          .info-item {
            padding: 20px;
            background: rgba(30, 41, 59, 0.5);
            border-radius: 12px;
            border: 1px solid rgba(99, 102, 241, 0.2);
            transition: all 0.3s ease;
          }
          
          .info-item:hover {
            background: rgba(30, 41, 59, 0.7);
            border-color: rgba(99, 102, 241, 0.4);
            transform: translateY(-2px);
          }
          
          .info-label {
            font-size: 0.85rem;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          
          .info-value {
            font-size: 1.3rem;
            font-weight: 600;
            color: #e0e7ff;
            word-break: break-all;
          }
          
          .actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 30px;
          }
          
          .action-card {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(20px) saturate(180%);
            border: 2px solid rgba(99, 102, 241, 0.3);
            border-radius: 16px;
            padding: 30px;
            text-align: center;
            transition: all 0.3s ease;
            cursor: pointer;
            text-decoration: none;
            color: inherit;
            display: block;
            animation: fadeInUp 0.8s ease-out 0.4s both;
          }
          
          .action-card:hover {
            transform: translateY(-5px);
            border-color: rgba(129, 140, 248, 0.6);
            box-shadow: 0 12px 40px rgba(99, 102, 241, 0.3);
          }
          
          .action-icon {
            font-size: 3rem;
            margin-bottom: 15px;
          }
          
          .action-title {
            font-size: 1.3rem;
            font-weight: 600;
            margin-bottom: 10px;
            color: #e0e7ff;
          }
          
          .action-desc {
            font-size: 0.95rem;
            color: #94a3b8;
            line-height: 1.6;
          }
          
          .api-endpoints {
            margin-top: 30px;
            padding-top: 30px;
            border-top: 1px solid rgba(99, 102, 241, 0.2);
          }
          
          .api-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 20px;
            color: #c7d2fe;
          }
          
          .endpoint-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          
          .endpoint {
            padding: 12px 16px;
            background: rgba(30, 41, 59, 0.4);
            border-radius: 8px;
            border-left: 3px solid #6366f1;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            color: #c7d2fe;
            transition: all 0.2s ease;
          }
          
          .endpoint:hover {
            background: rgba(30, 41, 59, 0.6);
            border-left-color: #818cf8;
          }
          
          .method {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.75rem;
            margin-right: 10px;
          }
          
          .method.get { background: #4ade80; color: #064e3b; }
          .method.post { background: #60a5fa; color: #1e3a8a; }
          .method.put { background: #fbbf24; color: #78350f; }
          .method.delete { background: #f87171; color: #7f1d1d; }
          
          @keyframes fadeInDown {
            from {
              opacity: 0;
              transform: translateY(-30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @media (max-width: 768px) {
            h1 { font-size: 2rem; }
            .logo { font-size: 3rem; }
            .status-card { padding: 25px; }
            .info-grid { grid-template-columns: 1fr; }
            .actions { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎓</div>
            <h1>Сервер экзаменационных билетов</h1>
            <p class="subtitle">API сервер для системы управления экзаменационными билетами</p>
          </div>
          
          <div class="status-card">
            <div class="status-header">
              <div class="status-indicator"></div>
              <div class="status-title">Сервер работает</div>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Порт</div>
                <div class="info-value">${PORT}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Режим</div>
                <div class="info-value">Разработка</div>
              </div>
              <div class="info-item">
                <div class="info-label">База данных</div>
                <div class="info-value">SQLite</div>
              </div>
              <div class="info-item">
                <div class="info-label">Статус</div>
                <div class="info-value">✅ Активен</div>
              </div>
            </div>
            
            <div class="actions">
              <a href="http://localhost:3000" class="action-card" target="_blank">
                <div class="action-icon">🚀</div>
                <div class="action-title">Клиентское приложение</div>
                <div class="action-desc">Открыть интерфейс на порту 3000</div>
              </a>
              <a href="/api/groups" class="action-card">
                <div class="action-icon">📊</div>
                <div class="action-title">API Endpoints</div>
                <div class="action-desc">Просмотр доступных API</div>
              </a>
            </div>
            
            <div class="api-endpoints">
              <div class="api-title">Основные API endpoints:</div>
              <div class="endpoint-list">
                <div class="endpoint"><span class="method get">GET</span>/api/groups</div>
                <div class="endpoint"><span class="method get">GET</span>/api/subjects</div>
                <div class="endpoint"><span class="method get">GET</span>/api/tickets</div>
                <div class="endpoint"><span class="method get">GET</span>/api/statistics</div>
                <div class="endpoint"><span class="method get">GET</span>/api/history</div>
                <div class="endpoint"><span class="method post">POST</span>/api/questions/upload</div>
                <div class="endpoint"><span class="method post">POST</span>/api/tickets/generate</div>
                <div class="endpoint"><span class="method post">POST</span>/api/tickets/:ticketId/select-simple</div>
                <div class="endpoint"><span class="method delete">DELETE</span>/api/reset-all</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  });
  
  // Для всех остальных маршрутов (кроме API и корневого)
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Редирект на главную страницу
    res.redirect('/');
  });
}

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  if (isBuildReady) {
    console.log('✅ Статические файлы обслуживаются из client/build');
  } else {
    console.log('⚠️  Сборка клиента не найдена. Запустите "npm run build" для production режима.');
    console.log('   Или используйте режим разработки: "npm run dev" и "npm run client"');
  }
});
