const { db } = require('../config/database');
const { uuidv4 } = require('../utils/helpers');
const { generateTickets } = require('../utils/ticketGenerator');
const { getConfig } = require('../models/config');

// Получить доступные билеты (упрощенный)
function getAvailableTicketsSimple(req, res) {
  const { group_id, subject_id } = req.query;
  
  if (!group_id || !subject_id) {
    return res.status(400).json({ error: 'Необходимо указать group_id и subject_id' });
  }
  
  db.all(
    'SELECT * FROM tickets WHERE group_id = ? AND subject_id = ? ORDER BY number',
    [group_id, subject_id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const tickets = rows.map(row => {
        const parsed = JSON.parse(row.questions);
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
      res.json(tickets);
    }
  );
}

// Выбрать билет (упрощенный)
function selectTicketSimple(req, res) {
  const { ticketId } = req.params;
  const { group_id, subject_id, student_id, student_name } = req.body;

  if (!group_id || !subject_id) {
    return res.status(400).json({ error: 'Необходимо указать group_id и subject_id' });
  }

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

    if (ticket.group_id !== group_id || ticket.subject_id !== subject_id) {
      return res.status(403).json({ error: 'Этот билет не предназначен для выбранной группы и дисциплины' });
    }

    if (student_id) {
      db.get('SELECT username FROM users WHERE id = ?', [student_id], (err2, student) => {
        if (err2) {
          console.error('Ошибка получения курсанта:', err2);
          return res.status(500).json({ error: 'Ошибка получения курсанта' });
        }
        
        const studentUsername = student ? student.username : null;
        
        db.run(
          'UPDATE tickets SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?',
          [studentUsername, ticketId],
          function(updateErr) {
            if (updateErr) {
              return res.status(500).json({ error: updateErr.message });
            }

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
      db.run(
        'UPDATE tickets SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?',
        [ticketId],
        function(err2) {
          if (err2) {
            return res.status(500).json({ error: err2.message });
          }

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
}

// Генерация билетов
async function generateTicketsHandler(req, res) {
  try {
    const teacherSession = req.body.session || {};
    const subjectId = teacherSession.subject_id || null;
    const groupId = teacherSession.group_id || null;

    if (!subjectId) {
      return res.status(400).json({ error: 'Необходимо выбрать дисциплину для генерации билетов' });
    }

    const requestConfig = req.body.config || {};
    let ticketCount = requestConfig.ticketCount;
    let questionsPerTicket = requestConfig.questionsPerTicket;
    let hasPracticalTasks = requestConfig.hasPracticalTasks !== undefined ? requestConfig.hasPracticalTasks : false;
    let practicalTasksCount = requestConfig.practicalTasksCount || 1;
    let hasSections = requestConfig.hasSections !== undefined ? requestConfig.hasSections : false;
    let sectionBoundary = requestConfig.sectionBoundary || 0;

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
    
    if (hasPracticalTasks && (practicalTasksCount < 1 || practicalTasksCount > 100)) {
      return res.status(400).json({ error: 'Количество практических заданий должно быть от 1 до 100' });
    }
    
    if (hasSections && sectionBoundary < 1) {
      return res.status(400).json({ error: 'Граница между разделами должна быть больше 0' });
    }

    if (ticketCount < 1 || ticketCount > 100) {
      return res.status(400).json({ error: 'Количество билетов должно быть от 1 до 100' });
    }
    if (questionsPerTicket < 1 || questionsPerTicket > 20) {
      return res.status(400).json({ error: 'Количество вопросов в билете должно быть от 1 до 20' });
    }

    db.all('SELECT * FROM questions WHERE subject_id = ?', [subjectId], async (err, questions) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (questions.length === 0) {
        return res.status(400).json({ error: 'Нет загруженных вопросов для выбранной дисциплины' });
      }

      try {
        const tickets = generateTickets(questions, ticketCount, questionsPerTicket, hasPracticalTasks, practicalTasksCount, hasSections, sectionBoundary);

        db.run('DELETE FROM tickets WHERE subject_id = ? AND group_id = ?', [subjectId, groupId], (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const uniqueTickets = [];
          const seenHashes = new Set();
          
          for (const ticket of tickets) {
            if (!seenHashes.has(ticket.hash)) {
              seenHashes.add(ticket.hash);
              uniqueTickets.push(ticket);
            }
          }

          if (uniqueTickets.length === 0) {
            return res.status(400).json({ error: 'Не удалось создать уникальные билеты. Все комбинации дублируются.' });
          }

          const stmt = db.prepare('INSERT INTO tickets (id, number, questions, questions_hash, subject_id, group_id) VALUES (?, ?, ?, ?, ?, ?)');
          let completed = 0;
          const errors = [];
          const insertedHashes = new Set();

          uniqueTickets.forEach((ticket) => {
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
}

// Получить все билеты
function getAllTickets(req, res) {
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
  }
  if (group_id) {
    conditions.push('t.group_id = ?');
    params.push(group_id);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY t.number';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Ошибка при получении билетов:', err.message);
      return res.status(500).json({ error: err.message });
    }
    const tickets = rows.map(row => {
      let parsedQuestions = [];
      try {
        parsedQuestions = JSON.parse(row.questions);
      } catch (e) {
        console.error(`Ошибка парсинга вопросов для билета ${row.id}:`, e);
        parsedQuestions = [];
      }
      return {
        ...row,
        questions: parsedQuestions,
        is_used: row.is_used === 1,
        used_by: row.student_full_name || row.used_by || 'Неизвестно'
      };
    });
    res.json(tickets);
  });
}

// Получить статистику билетов
function getTicketsStatistics(req, res) {
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
      u.username,
      eh.completed_at as completed_at,
      eh.taken_at as selected_at
    FROM tickets t
    LEFT JOIN users u ON t.used_by = u.username
    LEFT JOIN exam_history eh ON t.used_by = eh.username AND t.number = eh.ticket_number AND t.subject_id = (SELECT subject_id FROM subjects WHERE id = ?)
    WHERE t.group_id = ? AND t.subject_id = ?
    ORDER BY t.used_at ASC
  `, [subject_id, group_id, subject_id], (err, rows) => {
    if (err) {
      console.error('Ошибка при получении детальной статистики:', err.message);
      return res.status(500).json({ error: err.message });
    }
    const statistics = rows.map(row => {
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
        username: row.username,
        used_at: row.used_at,
        selected_at: row.selected_at,
        completed_at: row.completed_at,
        questions: questions,
        practicalTask: practicalTask
      };
    });
    res.json(statistics);
  });
}

// Получить выбранный билет
function getSelectedTicket(req, res) {
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: 'Имя пользователя обязательно' });
  }
  
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
      
      db.get(
        'SELECT completed_at FROM exam_history WHERE username = ? AND ticket_number = ?',
        [username, ticket.number],
        (err2, history) => {
          if (err2) {
            return res.status(500).json({ error: err2.message });
          }
          
          let parsedQuestions = [];
          try {
            parsedQuestions = JSON.parse(ticket.questions);
          } catch (e) {
            console.error('Ошибка парсинга вопросов:', e);
          }
          
          res.json({
            id: ticket.id,
            number: ticket.number,
            questions: parsedQuestions,
            used_at: ticket.used_at,
            completed: history && history.completed_at ? true : false,
            completed_at: history ? history.completed_at : null
          });
        }
      );
    }
  );
}

// Завершить экзамен
function completeTicket(req, res) {
  const { username, full_name } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Имя пользователя обязательно' });
  }
  
  db.get('SELECT * FROM tickets WHERE used_by = ?', [username], (err, ticket) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!ticket) {
      return res.status(404).json({ error: 'Билет не найден' });
    }
    
    db.run(
      'UPDATE exam_history SET completed_at = CURRENT_TIMESTAMP WHERE username = ? AND ticket_number = ?',
      [username, ticket.number],
      function(err2) {
        if (err2) {
          return res.status(500).json({ error: err2.message });
        }
        
        if (this.changes === 0) {
          const historyId = uuidv4();
          const parsed = JSON.parse(ticket.questions);
          const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
          const questionsText = questions.map(q => typeof q === 'string' ? q : q.text).join(' | ');
          
          db.run(
            'INSERT INTO exam_history (id, username, ticket_number, questions, completed_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [historyId, username, ticket.number, questionsText],
            (err3) => {
              if (err3) {
                return res.status(500).json({ error: err3.message });
              }
              res.json({ message: 'Сдача зачета/экзамена завершена', completed_at: new Date().toISOString() });
            }
          );
        } else {
          res.json({ message: 'Сдача зачета/экзамена завершена', completed_at: new Date().toISOString() });
        }
      }
    );
  });
}

// Удалить билеты
function deleteTickets(req, res) {
  try {
    const { group_id, subject_id } = req.query;
    
    if (!subject_id) {
      return res.status(400).json({ error: 'Необходимо указать дисциплину' });
    }
    
    let deleteQuery;
    const params = [];
    
    if (group_id) {
      deleteQuery = 'DELETE FROM tickets WHERE subject_id = ? AND (group_id = ? OR group_id IS NULL)';
      params.push(subject_id, group_id);
    } else {
      deleteQuery = 'DELETE FROM tickets WHERE subject_id = ?';
      params.push(subject_id);
    }
    
    db.run(deleteQuery, params, function(err) {
      if (err) {
        console.error('Ошибка при удалении билетов:', err);
        return res.status(500).json({ error: err.message });
      }
      
      res.json({ 
        message: `Удалено ${this.changes} билетов`,
        deleted: this.changes
      });
    });
  } catch (error) {
    console.error('Ошибка при удалении билетов:', error);
    res.status(500).json({ error: error.message });
  }
}

// Завершить все зачеты для группы и дисциплины
function completeAllTickets(req, res) {
  const { group_id, subject_id } = req.body;
  
  if (!group_id || !subject_id) {
    return res.status(400).json({ error: 'Необходимо указать учебную группу и дисциплину' });
  }
  
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
}

module.exports = {
  getAvailableTicketsSimple,
  selectTicketSimple,
  generateTicketsHandler,
  getAllTickets,
  getTicketsStatistics,
  getSelectedTicket,
  completeTicket,
  completeAllTickets,
  deleteTickets
};
