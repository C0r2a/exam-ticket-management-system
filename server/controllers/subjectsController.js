const { db } = require('../config/database');
const { uuidv4 } = require('../utils/helpers');

// Получить все дисциплины
function getAllSubjects(req, res) {
  db.all('SELECT * FROM subjects ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
}

// Создать дисциплину (или получить существующую)
function createSubject(req, res) {
  const { name, type, description } = req.body;
  
  if (!name || !type) {
    return res.status(400).json({ error: 'Название и тип дисциплины обязательны' });
  }

  if (!['exam', 'test'].includes(type)) {
    return res.status(400).json({ error: 'Тип должен быть exam (экзамен) или test (зачет)' });
  }

  db.get('SELECT * FROM subjects WHERE name = ?', [name], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existing) {
      return res.json({ 
        id: existing.id, 
        name: existing.name, 
        type: existing.type, 
        description: existing.description || '' 
      });
    }

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
}

// Удалить дисциплину
function deleteSubject(req, res) {
  const { id } = req.params;
  
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
}

module.exports = {
  getAllSubjects,
  createSubject,
  deleteSubject
};



