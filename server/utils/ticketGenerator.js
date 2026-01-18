// Генерация хэша для комбинации вопросов
function generateQuestionsHash(questionIds) {
  return questionIds.sort().join(',');
}

// Генерация билетов
function generateTickets(questions, ticketCount, questionsPerTicket, hasPracticalTasks = false, practicalTasksCount = 1, hasSections = false, sectionBoundary = 0) {
  const tickets = [];
  const usedHashes = new Set();
  
  if (questions.length < questionsPerTicket) {
    throw new Error('Недостаточно вопросов для создания билетов');
  }

  // Если используются разделы, разделяем вопросы на два раздела
  let section1 = [];
  let section2 = [];
  
  if (hasSections && sectionBoundary > 0) {
    // Раздел 1: вопросы с question_number от 1 до sectionBoundary
    section1 = questions.filter(q => q.question_number && q.question_number >= 1 && q.question_number <= sectionBoundary);
    // Раздел 2: вопросы с question_number от sectionBoundary + 1 до максимального
    section2 = questions.filter(q => q.question_number && q.question_number > sectionBoundary);
    
    // Перемешиваем каждый раздел отдельно
    section1 = section1.sort(() => 0.5 - Math.random());
    section2 = section2.sort(() => 0.5 - Math.random());
    
    // Проверяем, что в каждом разделе достаточно вопросов
    const minQuestionsPerSection = Math.ceil(questionsPerTicket / 2);
    if (section1.length < minQuestionsPerSection) {
      throw new Error(`Недостаточно вопросов в разделе 1 (нужно минимум ${minQuestionsPerSection}, есть ${section1.length})`);
    }
    if (section2.length < minQuestionsPerSection) {
      throw new Error(`Недостаточно вопросов в разделе 2 (нужно минимум ${minQuestionsPerSection}, есть ${section2.length})`);
    }
  } else {
    // Если разделы не используются, перемешиваем все вопросы вместе
    section1 = [...questions].sort(() => 0.5 - Math.random());
    section2 = section1; // Используем тот же список
  }
  
  const maxAttempts = ticketCount * 100; // Максимальное количество попыток
  let attempts = 0;
  let section1Index = 0; // Индекс для циклического прохода по разделу 1
  let section2Index = 0; // Индекс для циклического прохода по разделу 2

  while (tickets.length < ticketCount && attempts < maxAttempts) {
    attempts++;
    
    // Выбираем вопросы из разделов по очереди
    const selectedQuestions = [];
    for (let i = 0; i < questionsPerTicket; i++) {
      if (hasSections && sectionBoundary > 0) {
        // Чередуем разделы: четные индексы (0, 2, 4...) - раздел 1, нечетные (1, 3, 5...) - раздел 2
        if (i % 2 === 0) {
          // Четный индекс - берем из раздела 1
          const question = section1[section1Index % section1.length];
          selectedQuestions.push(question);
          section1Index++;
        } else {
          // Нечетный индекс - берем из раздела 2
          const question = section2[section2Index % section2.length];
          selectedQuestions.push(question);
          section2Index++;
        }
      } else {
        // Если разделы не используются, берем из общего списка
        const question = section1[section1Index % section1.length];
        selectedQuestions.push(question);
        section1Index++;
      }
    }
    
    const questionIds = selectedQuestions.map(q => q.id).sort(); // Сортируем для консистентности хеша
    const hash = generateQuestionsHash(questionIds);

    // Проверка уникальности
    if (!usedHashes.has(hash)) {
      usedHashes.add(hash);
      
      // Генерируем практическое задание, если включено
      let practicalTask = null;
      if (hasPracticalTasks && practicalTasksCount > 0) {
        const taskNumber = Math.floor(Math.random() * practicalTasksCount) + 1;
        practicalTask = {
          number: taskNumber,
          text: `Практическое задание №${taskNumber}`
        };
      }
      
      tickets.push({
        number: tickets.length + 1,
        questions: selectedQuestions,
        practicalTask: practicalTask,
        hash
      });
    }
  }

  if (tickets.length < ticketCount) {
    throw new Error(`Не удалось сгенерировать ${ticketCount} уникальных билетов. Сгенерировано: ${tickets.length}`);
  }

  // Сортируем билеты по номеру для фиксированного порядка
  return tickets.sort((a, b) => a.number - b.number);
}

module.exports = {
  generateTickets,
  generateQuestionsHash
};



