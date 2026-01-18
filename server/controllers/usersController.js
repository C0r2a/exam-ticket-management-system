const { db } = require('../config/database');
const { uuidv4, generateUsername, generatePassword } = require('../utils/helpers');
const fs = require('fs');

// Создать пользователя (курсанта)
function createUser(req, res) {
  const { username, password, role, full_name, group_id } = req.body;
  
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Логин, пароль и роль обязательны' });
  }

  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'Роль должна быть student или teacher' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }

    if (group_id) {
      db.get('SELECT * FROM groups WHERE id = ?', [group_id], (err2, group) => {
        if (err2) {
          return res.status(500).json({ error: err2.message });
        }
        if (!group) {
          return res.status(400).json({ error: 'Учебная группа не найдена' });
        }

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
}

// Импорт курсантов из файла
function importUsers(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  const { group_id } = req.body;

  try {
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

        const promises = lines.map((line, index) => {
          return new Promise((resolve) => {
            try {
              let fullName, role, targetGroupId, groupName = null;
              
              if (group_id) {
                fullName = line;
                role = 'student';
                targetGroupId = group_id;
              } else {
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

              let username = generateUsername(fullName, role, index);
              let counter = 1;
              while (usedUsernames.has(username)) {
                username = `${generateUsername(fullName, role, index)}${counter}`;
                counter++;
              }
              usedUsernames.add(username);

              const password = generatePassword(8);
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
}

module.exports = {
  createUser,
  importUsers
};



