const express = require('express');
const router = express.Router();
const ticketsController = require('../controllers/ticketsController');

// Упрощенный endpoint для получения доступных билетов
router.get('/available-simple', ticketsController.getAvailableTicketsSimple);

// Упрощенный endpoint для выбора билета
router.post('/:ticketId/select-simple', ticketsController.selectTicketSimple);

// Генерация билетов
router.post('/generate', ticketsController.generateTicketsHandler);

// Получить все билеты
router.get('/', ticketsController.getAllTickets);

// Получить статистику билетов
router.get('/statistics', ticketsController.getTicketsStatistics);

// Получить выбранный билет
router.get('/selected', ticketsController.getSelectedTicket);

// Завершить экзамен
router.post('/complete', ticketsController.completeTicket);

// Завершить все зачеты
router.post('/complete-all', ticketsController.completeAllTickets);

// Удалить билеты
router.delete('/', ticketsController.deleteTickets);

module.exports = router;

