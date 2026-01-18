const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Инициализация таблиц
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Таблица вопросов
      db.run(`CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        subject_id TEXT,
        question_number INTEGER,
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

      // Таблица связи учебных групп и дисциплин
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

      // Выполнение миграций
      runMigrations().then(() => {
        resolve();
      }).catch((err) => {
        console.error('Ошибка при выполнении миграций:', err);
        reject(err);
      });
    });
  });
}

// Выполнение миграций
function runMigrations() {
  return new Promise((resolve) => {
    let migrationsCompleted = 0;
    const totalMigrations = 6;

    const checkComplete = () => {
      migrationsCompleted++;
      if (migrationsCompleted === totalMigrations) {
        resolve();
      }
    };

    // Миграция 1: добавляем subject_id в таблицу questions, если колонки нет
    db.all("PRAGMA table_info(questions)", (err, columns) => {
      if (err) {
        console.error('Ошибка при проверке структуры таблицы questions:', err.message);
        checkComplete();
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
          checkComplete();
        });
      } else {
        checkComplete();
      }
    });

    // Миграция 2: добавляем question_number в таблицу questions, если колонки нет
    db.all("PRAGMA table_info(questions)", (pragmaErr, columns) => {
      if (pragmaErr) {
        console.error('Ошибка при проверке структуры таблицы questions:', pragmaErr);
        checkComplete();
        return;
      }
      
      const hasQuestionNumber = columns.some(col => col.name === 'question_number');
      if (!hasQuestionNumber) {
        db.run(`ALTER TABLE questions ADD COLUMN question_number INTEGER`, (alterErr) => {
          if (alterErr) {
            console.error('Ошибка при добавлении колонки question_number:', alterErr.message);
          } else {
            console.log('Колонка question_number успешно добавлена в таблицу questions');
          }
          checkComplete();
        });
      } else {
        checkComplete();
      }
    });

    // Миграция 3: добавляем completed_at в таблицу exam_history, если колонки нет
    db.all("PRAGMA table_info(exam_history)", (err, columns) => {
      if (err) {
        console.error('Ошибка при проверке структуры таблицы exam_history:', err.message);
        checkComplete();
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
          checkComplete();
        });
      } else {
        checkComplete();
      }
    });

    // Миграция 4: добавляем username в таблицу exam_history, если колонки нет
    db.all("PRAGMA table_info(exam_history)", (err, columns) => {
      if (err) {
        console.error('Ошибка при проверке структуры таблицы exam_history:', err.message);
        checkComplete();
        return;
      }
      
      const hasUsername = columns.some(col => col.name === 'username');
      const hasStudentName = columns.some(col => col.name === 'student_name');
      
      if (!hasUsername) {
        if (hasStudentName) {
          db.run(`ALTER TABLE exam_history ADD COLUMN username TEXT`, (alterErr) => {
            if (alterErr) {
              console.error('Ошибка при добавлении колонки username:', alterErr.message);
              checkComplete();
            } else {
              console.log('Колонка username успешно добавлена в таблицу exam_history');
              db.run(`UPDATE exam_history SET username = student_name WHERE username IS NULL`, (updateErr) => {
                if (updateErr) {
                  console.error('Ошибка при копировании данных в username:', updateErr.message);
                } else {
                  console.log('Данные успешно скопированы из student_name в username');
                }
                checkComplete();
              });
            }
          });
        } else {
          db.run(`ALTER TABLE exam_history ADD COLUMN username TEXT`, (alterErr) => {
            if (alterErr) {
              console.error('Ошибка при добавлении колонки username:', alterErr.message);
            } else {
              console.log('Колонка username успешно добавлена в таблицу exam_history');
            }
            checkComplete();
          });
        }
      } else {
        checkComplete();
      }
    });

    // Миграция 5: добавляем subject_id в таблицу tickets, если колонки нет
    db.all("PRAGMA table_info(tickets)", (err, columns) => {
      if (err) {
        console.error('Ошибка при проверке структуры таблицы tickets:', err.message);
        checkComplete();
        return;
      }
      
      const hasSubjectId = columns.some(col => col.name === 'subject_id');
      if (!hasSubjectId) {
        db.run(`ALTER TABLE tickets ADD COLUMN subject_id TEXT`, (alterErr) => {
          if (alterErr) {
            console.error('Ошибка при добавлении колонки subject_id в tickets:', alterErr.message);
          } else {
            console.log('Колонка subject_id успешно добавлена в таблицу tickets');
          }
          checkComplete();
        });
      } else {
        checkComplete();
      }
    });

    // Миграция 6: добавляем group_id в таблицу tickets, если колонки нет
    db.all("PRAGMA table_info(tickets)", (err, columns) => {
      if (err) {
        console.error('Ошибка при проверке структуры таблицы tickets:', err.message);
        checkComplete();
        return;
      }
      
      const hasGroupId = columns.some(col => col.name === 'group_id');
      if (!hasGroupId) {
        db.run(`ALTER TABLE tickets ADD COLUMN group_id TEXT`, (alterErr) => {
          if (alterErr) {
            console.error('Ошибка при добавлении колонки group_id в tickets:', alterErr.message);
          } else {
            console.log('Колонка group_id успешно добавлена в таблицу tickets');
          }
          checkComplete();
        });
      } else {
        checkComplete();
      }
    });
  });
}

module.exports = {
  db,
  initializeDatabase
};
