const { db } = require('../config/database');

// Получить учет курсантов (кто какой билет выбрал)
function getAccounting(req, res) {
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
    const formatted = rows.map(row => {
      let questions = [];
      try {
        const parsed = JSON.parse(row.questions);
        if (Array.isArray(parsed)) {
          questions = parsed;
        } else {
          questions = parsed.questions || [];
        }
      } catch (e) {
        questions = row.history_questions ? row.history_questions.split(' | ') : [];
      }
      
      return {
        username: row.username,
        ticket_number: row.ticket_number,
        used_at: row.used_at,
        questions: questions
      };
    });
    res.json(formatted);
  });
}

module.exports = {
  getAccounting
};



