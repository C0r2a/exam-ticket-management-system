const { db } = require('../config/database');
const { uuidv4 } = require('../utils/helpers');
const fs = require('fs');

// Загрузка вопросов из файла
function uploadQuestions(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  const { subject_id } = req.body;
  
  if (!subject_id) {
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
    fileContent = fs.readFileSync(req.file.path, 'utf8');
  } catch (readError) {
    try {
      fileContent = fs.readFileSync(req.file.path, 'latin1');
    } catch (e) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Ошибка чтения файла. Убедитесь, что файл в кодировке UTF-8 или ANSI.' });
    }
  }

  const lines = fileContent.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    if (fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Ошибка удаления файла:', e);
      }
    }
    return res.status(400).json({ error: 'Файл пуст или не содержит вопросов' });
  }

  db.run('DELETE FROM questions WHERE subject_id = ?', [subject_id], (err) => {
    if (err) {
      if (fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('Ошибка удаления файла:', e);
        }
      }
      return res.status(500).json({ error: err.message });
    }

    const stmt = db.prepare('INSERT INTO questions (id, text, subject_id, question_number) VALUES (?, ?, ?, ?)');
    let completed = 0;
    const errors = [];

    lines.forEach((line, index) => {
      const questionId = uuidv4();
      const questionNumber = index + 1;
      
      stmt.run([questionId, line, subject_id, questionNumber], (err) => {
        if (err) {
          errors.push(`Вопрос ${questionNumber}: ${err.message}`);
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
            res.status(500).json({ 
              error: `Ошибки при загрузке: ${errors.join('; ')}`,
              loaded: lines.length - errors.length,
              errors: errors.length
            });
          } else {
            res.json({ 
              message: `Успешно загружено ${lines.length} вопросов`,
              count: lines.length
            });
          }
        }
      });
    });
  });
}

// Получить все вопросы
function getQuestions(req, res) {
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
}

// Удалить все вопросы
function deleteQuestions(req, res) {
  const { subject_id } = req.query;
  
  if (!subject_id) {
    return res.status(400).json({ error: 'Необходимо указать subject_id' });
  }
  
  db.run('DELETE FROM questions WHERE subject_id = ?', [subject_id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: `Удалено ${this.changes} вопросов` });
  });
}

module.exports = {
  uploadQuestions,
  getQuestions,
  deleteQuestions
};



