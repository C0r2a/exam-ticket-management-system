const { db } = require('../config/database');

// Получить статистику
function getStatistics(req, res) {
  const { group_id, subject_id } = req.query;
  
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
}

// Получить историю сдачи
function getHistory(req, res) {
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
    
    const formattedRows = rows.map(row => ({
      ...row,
      student_name: row.full_name || row.username || row.student_name || 'Неизвестно',
      completed_at: row.completed_at || null,
      username: row.username || row.student_name || 'Неизвестно',
      display_name: row.full_name || row.username || row.student_name || 'Неизвестно'
    }));
    
    res.json(formattedRows);
  });
}

module.exports = {
  getStatistics,
  getHistory
};



