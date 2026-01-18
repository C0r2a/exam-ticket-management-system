const express = require('express');
const router = express.Router();
const groupsController = require('../controllers/groupsController');

// Получить все учебные группы
router.get('/', groupsController.getAllGroups);

// Создать учебную группу
router.post('/', groupsController.createGroup);

// Удалить учебную группу
router.delete('/:id', groupsController.deleteGroup);

// Получить курсантов учебной группы
router.get('/:groupId/students', groupsController.getGroupStudents);

// Получить курсантов учебной группы со статусом
router.get('/:groupId/students-with-status', groupsController.getGroupStudentsWithStatus);

module.exports = router;



