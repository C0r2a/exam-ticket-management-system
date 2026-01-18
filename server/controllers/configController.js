const { getConfig, setConfig } = require('../models/config');

// Получить конфигурацию
async function getConfigHandler(req, res) {
  try {
    const ticketCount = await getConfig('ticketCount', 20);
    const questionsPerTicket = await getConfig('questionsPerTicket', 3);
    const hasPracticalTasks = await getConfig('hasPracticalTasks', false);
    const practicalTasksCount = await getConfig('practicalTasksCount', 1);
    const hasSections = await getConfig('hasSections', false);
    const sectionBoundary = await getConfig('sectionBoundary', 0);
    res.json({ 
      ticketCount, 
      questionsPerTicket,
      hasPracticalTasks: hasPracticalTasks === true || hasPracticalTasks === 'true',
      practicalTasksCount: parseInt(practicalTasksCount) || 1,
      hasSections: hasSections === true || hasSections === 'true',
      sectionBoundary: parseInt(sectionBoundary) || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Сохранить конфигурацию
async function setConfigHandler(req, res) {
  const { ticketCount, questionsPerTicket, hasPracticalTasks, practicalTasksCount, hasSections, sectionBoundary } = req.body;
  
  if (ticketCount < 1 || ticketCount > 100) {
    return res.status(400).json({ error: 'Количество билетов должно быть от 1 до 100' });
  }
  
  if (questionsPerTicket < 1 || questionsPerTicket > 20) {
    return res.status(400).json({ error: 'Количество вопросов в билете должно быть от 1 до 20' });
  }
  
  if (hasPracticalTasks && (practicalTasksCount < 1 || practicalTasksCount > 100)) {
    return res.status(400).json({ error: 'Количество практических заданий должно быть от 1 до 100' });
  }

  if (hasSections && sectionBoundary < 1) {
    return res.status(400).json({ error: 'Граница между разделами должна быть больше 0' });
  }

  try {
    await setConfig('ticketCount', ticketCount);
    await setConfig('questionsPerTicket', questionsPerTicket);
    await setConfig('hasPracticalTasks', hasPracticalTasks || false);
    await setConfig('practicalTasksCount', practicalTasksCount || 1);
    await setConfig('hasSections', hasSections || false);
    await setConfig('sectionBoundary', sectionBoundary || 0);
    res.json({ message: 'Конфигурация сохранена' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getConfigHandler,
  setConfigHandler
};



