const { db } = require('../config/database');

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

module.exports = {
  getConfig,
  setConfig
};



