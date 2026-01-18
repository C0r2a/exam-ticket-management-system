const { db } = require('../config/database');
const { uuidv4 } = require('../utils/helpers');

// Получить все учебные группы
function getAllGroups(req, res) {
  db.all('SELECT * FROM groups ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
}

// Создать учебную группу (или получить существующую)
function createGroup(req, res) {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Название учебной группы обязательно' });
  }

  db.get('SELECT * FROM groups WHERE name = ?', [name], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existing) {
      return res.json({ 
        id: existing.id, 
        name: existing.name, 
        description: existing.description || '' 
      });
    }

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
}

// Удалить учебную группу
function deleteGroup(req, res) {
  const { id } = req.params;
  
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
}

// Получить курсантов учебной группы
function getGroupStudents(req, res) {
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
}

// Получить курсантов учебной группы со статусом
function getGroupStudentsWithStatus(req, res) {
  const { groupId } = req.params;
  const { subject_id } = req.query;
  
  if (!subject_id) {
    return res.status(400).json({ error: 'Необходимо указать subject_id' });
  }
  
  db.all(
    'SELECT * FROM users WHERE group_id = ? AND role = ? ORDER BY username',
    [groupId, 'student'],
    (err, students) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.all(
        'SELECT * FROM tickets WHERE group_id = ? AND subject_id = ? AND is_used = 1',
        [groupId, subject_id],
        (err2, usedTickets) => {
          if (err2) {
            return res.status(500).json({ error: err2.message });
          }
          
          const studentsWithStatus = students.map(student => {
            const hasTicket = usedTickets.some(ticket => ticket.used_by === student.username);
            return {
              ...student,
              has_ticket: hasTicket,
              ticket_number: hasTicket ? usedTickets.find(t => t.used_by === student.username)?.number : null
            };
          });
          
          res.json(studentsWithStatus);
        }
      );
    }
  );
}

module.exports = {
  getAllGroups,
  createGroup,
  deleteGroup,
  getGroupStudents,
  getGroupStudentsWithStatus
};



