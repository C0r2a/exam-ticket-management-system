const { db } = require('../config/database');

// Сброс статистики
function resetStatistics(req, res) {
  const { group_id, subject_id } = req.body;
  
  if (group_id && subject_id) {
    db.run(
      'UPDATE tickets SET is_used = 0, used_by = NULL, used_at = NULL WHERE group_id = ? AND subject_id = ?',
      [group_id, subject_id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
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
            }
            res.json({ message: 'Статистика сброшена для учебной группы и дисциплины' });
          }
        );
      }
    );
  } else {
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
}

// Полный сброс всех данных
function resetAll(req, res) {
  console.log('Выполняется полный сброс всех данных...');
  
  // Отключаем проверку внешних ключей для удаления
  db.run('PRAGMA foreign_keys = OFF', (pragmaErr) => {
    if (pragmaErr) {
      console.error('Ошибка при отключении foreign_keys:', pragmaErr);
    }
    
    db.serialize(() => {
      db.run('DELETE FROM exam_history', (err) => {
        if (err) {
          console.error('Ошибка при удалении истории:', err);
          db.run('PRAGMA foreign_keys = ON');
          return res.status(500).json({ error: 'Ошибка при удалении истории: ' + err.message });
        }
        console.log('История экзаменов удалена');
        
        db.run('DELETE FROM tickets', (err) => {
          if (err) {
            console.error('Ошибка при удалении билетов:', err);
            db.run('PRAGMA foreign_keys = ON');
            return res.status(500).json({ error: 'Ошибка при удалении билетов: ' + err.message });
          }
          console.log('Билеты удалены');
          
          db.run('DELETE FROM questions', (err) => {
            if (err) {
              console.error('Ошибка при удалении вопросов:', err);
              db.run('PRAGMA foreign_keys = ON');
              return res.status(500).json({ error: 'Ошибка при удалении вопросов: ' + err.message });
            }
            console.log('Вопросы удалены');
            
            db.run("DELETE FROM users WHERE role = 'student'", (err) => {
              if (err) {
                console.error('Ошибка при удалении студентов:', err);
                db.run('PRAGMA foreign_keys = ON');
                return res.status(500).json({ error: 'Ошибка при удалении студентов: ' + err.message });
              }
              console.log('Студенты удалены');
              
              db.run('DELETE FROM groups', (err) => {
                if (err) {
                  console.error('Ошибка при удалении групп:', err);
                  db.run('PRAGMA foreign_keys = ON');
                  return res.status(500).json({ error: 'Ошибка при удалении групп: ' + err.message });
                }
                console.log('Группы удалены');
                
                db.run('DELETE FROM subjects', (err) => {
                  if (err) {
                    console.error('Ошибка при удалении дисциплин:', err);
                    db.run('PRAGMA foreign_keys = ON');
                    return res.status(500).json({ error: 'Ошибка при удалении дисциплин: ' + err.message });
                  }
                  console.log('Дисциплины удалены');
                  
                  db.run('DELETE FROM config', (err) => {
                    if (err) {
                      console.error('Ошибка при удалении конфигурации:', err);
                      db.run('PRAGMA foreign_keys = ON');
                      return res.status(500).json({ error: 'Ошибка при удалении конфигурации: ' + err.message });
                    }
                    console.log('Конфигурация удалена');
                    
                    console.log('Все данные успешно удалены');
                    
                    // Включаем обратно проверку внешних ключей
                    db.run('PRAGMA foreign_keys = ON', (err) => {
                      if (err) {
                        console.error('Ошибка при включении foreign_keys:', err);
                      }
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
  });
}

module.exports = {
  resetStatistics,  
  resetAll
};
