import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './TicketSelection.css';

const API_URL = process.env.REACT_APP_API_URL || '/api';

function TicketSelection() {
  const [availableTickets, setAvailableTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [flippedCards, setFlippedCards] = useState(new Set());
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectName, setSubjectName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [students, setStudents] = useState([]);
  const [currentStudent, setCurrentStudent] = useState(null);
  const [statistics, setStatistics] = useState([]);
  const [showStatistics, setShowStatistics] = useState(false);

  useEffect(() => {
    // Загружаем сохраненные данные из настройки
    const saved = localStorage.getItem('exam_setup');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.groupId && data.subjectId) {
          // Проверяем существование группы и дисциплины через API
          Promise.all([
            axios.get(`${API_URL}/groups`).catch(() => ({ data: [] })),
            axios.get(`${API_URL}/subjects`).catch(() => ({ data: [] }))
          ]).then(([groupsRes, subjectsRes]) => {
            const groups = groupsRes.data || [];
            const subjects = subjectsRes.data || [];
            
            const groupExists = groups.some(g => g.id === data.groupId);
            const subjectExists = subjects.some(s => s.id === data.subjectId);
            
            if (groupExists && subjectExists) {
              setSelectedGroup(data.groupId);
              setSelectedSubject(data.subjectId);
              setSubjectName(data.subjectName || '');
              setGroupName(data.groupName || '');
            } else {
              console.warn('Сохраненная группа или дисциплина не найдена, очищаем данные');
              localStorage.removeItem('exam_setup');
              localStorage.removeItem('exam_selected_group');
              localStorage.removeItem('exam_selected_subject');
            }
          });
        }
      } catch (e) {
        console.error('Ошибка загрузки данных:', e);
      }
    } else {
      // Также проверяем старый формат для обратной совместимости
      const savedGroup = localStorage.getItem('exam_selected_group');
      const savedSubject = localStorage.getItem('exam_selected_subject');
      if (savedGroup && savedSubject) {
        // Проверяем существование группы и дисциплины через API
        Promise.all([
          axios.get(`${API_URL}/groups`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/subjects`).catch(() => ({ data: [] }))
        ]).then(([groupsRes, subjectsRes]) => {
          const groups = groupsRes.data || [];
          const subjects = subjectsRes.data || [];
          
          const groupExists = groups.some(g => g.id === savedGroup);
          const subjectExists = subjects.some(s => s.id === savedSubject);
          
          if (groupExists && subjectExists) {
            setSelectedGroup(savedGroup);
            setSelectedSubject(savedSubject);
          } else {
            console.warn('Сохраненная группа или дисциплина не найдена, очищаем localStorage');
            localStorage.removeItem('exam_selected_group');
            localStorage.removeItem('exam_selected_subject');
          }
        });
      }
    }
  }, []);

  const loadStatistics = useCallback(async () => {
    if (!selectedGroup || !selectedSubject) return [];
    try {
      const response = await axios.get(`${API_URL}/tickets/statistics`, {
        params: {
          group_id: selectedGroup,
          subject_id: selectedSubject
        }
      });
      setStatistics(response.data);
      
      // Проверяем, все ли курсанты получили билеты
      if (students.length > 0 && response.data.length === students.length) {
        setShowStatistics(true);
        setCurrentStudent(null);
      }
      
      return response.data;
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      return [];
    }
  }, [selectedGroup, selectedSubject, students.length]);

  const loadStudents = useCallback(async () => {
    if (!selectedGroup) return;
    try {
      const response = await axios.get(`${API_URL}/groups/${selectedGroup}/students`);
      setStudents(response.data);
      // Проверяем, все ли курсанты получили билеты
      const stats = await loadStatistics();
      const studentsWithoutTickets = response.data.filter(student => 
        !stats.some(stat => stat.student_id === student.id)
      );
      
      // Если все курсанты получили билеты, показываем статистику
      if (studentsWithoutTickets.length === 0 && response.data.length > 0) {
        setShowStatistics(true);
        setCurrentStudent(null);
      } else if (studentsWithoutTickets.length > 0 && !currentStudent) {
        // Автоматически выбираем первого курсанта без билета, только если еще никто не выбран
        setCurrentStudent(studentsWithoutTickets[0]);
      } else if (currentStudent) {
        // Проверяем, есть ли у текущего выбранного курсанта билет
        const currentStudentHasTicket = stats.some(stat => stat.student_id === currentStudent.id);
        if (currentStudentHasTicket && studentsWithoutTickets.length > 0) {
          // Если у текущего курсанта уже есть билет, выбираем первого без билета
          setCurrentStudent(studentsWithoutTickets[0]);
        } else if (currentStudentHasTicket && studentsWithoutTickets.length === 0) {
          // Все получили билеты
          setShowStatistics(true);
          setCurrentStudent(null);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки курсантов:', error);
      if (error.response?.status === 404) {
        // Группа не найдена - очищаем выбор
        setError('Учебная группа не найдена. Пожалуйста, начните настройку заново.');
        setSelectedGroup(null);
        setSelectedSubject(null);
        localStorage.removeItem('exam_setup');
        localStorage.removeItem('exam_selected_group');
        localStorage.removeItem('exam_selected_subject');
      } else {
        setError(error.response?.data?.error || 'Ошибка загрузки курсантов');
      }
      setStudents([]);
    }
  }, [selectedGroup, loadStatistics, currentStudent]);

  const loadAvailableTickets = useCallback(async () => {
    if (!selectedGroup || !selectedSubject) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`${API_URL}/tickets/available-simple`, {
        params: {
          group_id: selectedGroup,
          subject_id: selectedSubject
        }
      });
      
      // Перемешиваем билеты один раз при загрузке
      const shuffled = [...response.data].sort(() => Math.random() - 0.5);
      
      // Сохраняем порядок в localStorage для фиксации
      const shuffleKey = `ticket_order_${selectedGroup}_${selectedSubject}`;
      const savedOrder = localStorage.getItem(shuffleKey);
      
      if (savedOrder) {
        // Восстанавливаем сохраненный порядок
        try {
          const order = JSON.parse(savedOrder);
          const orderedTickets = order.map(id => 
            shuffled.find(t => t.id === id) || response.data.find(t => t.id === id)
          ).filter(Boolean);
          // Добавляем новые билеты, которых не было в сохраненном порядке
          const existingIds = new Set(order);
          const newTickets = shuffled.filter(t => !existingIds.has(t.id));
          setAvailableTickets([...orderedTickets, ...newTickets]);
        } catch (e) {
          // Если не удалось восстановить, используем перемешанный порядок
          setAvailableTickets(shuffled);
          localStorage.setItem(shuffleKey, JSON.stringify(shuffled.map(t => t.id)));
        }
      } else {
        // Первая загрузка - сохраняем перемешанный порядок
        setAvailableTickets(shuffled);
        localStorage.setItem(shuffleKey, JSON.stringify(shuffled.map(t => t.id)));
      }
      
      if (response.data.length === 0) {
        setError('Билеты еще не сгенерированы. Перейдите в режим "Настройка" для генерации билетов.');
      }
      
      // Проверяем сохраненный билет после загрузки
      const selectedTicketKey = `selected_ticket_${selectedGroup}_${selectedSubject}`;
      const savedTicket = localStorage.getItem(selectedTicketKey);
      if (savedTicket) {
        try {
          const savedTicketData = JSON.parse(savedTicket);
          // Проверяем, что билет существует в загруженных билетах (используем исходные данные)
          const ticketExists = response.data.some(t => t.id === savedTicketData.id);
          if (ticketExists) {
            // Находим актуальные данные билета
            const currentTicket = response.data.find(t => t.id === savedTicketData.id);
            if (currentTicket && currentTicket.is_used) {
              // Обновляем состояние выбранного билета актуальными данными
              setSelectedTicket({
                ...savedTicketData,
                ...currentTicket,
                number: currentTicket.number || savedTicketData.number, // Приоритет отдаем currentTicket
                questions: savedTicketData.questions || currentTicket.questions
              });
            } else {
              // Билет не помечен как использованный, возможно был сброшен
              localStorage.removeItem(selectedTicketKey);
              setSelectedTicket(null);
            }
          } else {
            // Билет не найден, очищаем сохраненный
            localStorage.removeItem(selectedTicketKey);
            setSelectedTicket(null);
          }
        } catch (e) {
          console.error('Ошибка проверки сохраненного билета:', e);
          localStorage.removeItem(selectedTicketKey);
        }
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка загрузки билетов');
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, selectedSubject]);

  useEffect(() => {
    if (selectedGroup && selectedSubject) {
      loadAvailableTickets();
      loadStudents();
      loadStatistics();
    } else {
      setAvailableTickets([]);
      setStudents([]);
    }
  }, [selectedGroup, selectedSubject, loadAvailableTickets, loadStudents, loadStatistics]);

  const handleCompleteExam = async () => {
    if (!selectedGroup || !selectedSubject) {
      setError('Настройка не завершена');
      return;
    }

    if (!window.confirm('Завершить зачет для всей группы и сбросить все данные? После этого все данные будут удалены, и можно будет начать заново.')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Сначала завершаем зачет
      await axios.post(`${API_URL}/tickets/complete-all`, {
        group_id: selectedGroup,
        subject_id: selectedSubject
      });
      
      // Затем сбрасываем все данные
      await axios.delete(`${API_URL}/reset-all`);
      
      // Очищаем localStorage
      localStorage.removeItem('exam_setup');
      localStorage.removeItem('exam_mode');
      localStorage.removeItem('exam_selected_group');
      localStorage.removeItem('exam_selected_subject');
      
      // Очищаем сохраненные порядки билетов и выбранные билеты
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('ticket_order_') || key.startsWith('selected_ticket_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Сбрасываем состояние компонента
      setAvailableTickets([]);
      setSelectedTicket(null);
      setStatistics([]);
      setShowStatistics(false);
      setCurrentStudent(null);
      setStudents([]);
      setSelectedGroup(null);
      setSelectedSubject(null);
      setSubjectName('');
      setGroupName('');
      
      // Показываем сообщение об успехе
      alert('✅ Зачет успешно завершен, все данные сброшены. Можно начать заново.');
      
      // Перезагружаем страницу для полного сброса
      window.location.reload();
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Ошибка завершения зачета и сброса данных';
      if (err.response?.status === 503) {
        setError('База данных еще не готова. Подождите несколько секунд и попробуйте снова.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (ticket) => {
    // Нельзя выбрать уже использованный билет
    if (ticket.is_used) {
      return;
    }

    // Нельзя выбрать новый билет, если уже выбран другой
    if (selectedTicket && selectedTicket.id !== ticket.id) {
      return;
    }

    // Анимация переворота
    setFlippedCards(prev => new Set([...prev, ticket.id]));
    
    setTimeout(() => {
      handleSelectTicket(ticket);
    }, 300);
  };

  const handleSelectTicket = async (ticket) => {
    if (!selectedGroup || !selectedSubject) {
      setError('Настройка не завершена');
      return;
    }

    if (!currentStudent) {
      setError('Сначала выберите курсанта');
      return;
    }

    setLoading(true);
    setError('');

    // Нельзя выбрать уже использованный билет
    if (ticket.is_used) {
      setError('Этот билет уже выбран');
      setFlippedCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticket.id);
        return newSet;
      });
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/tickets/${ticket.id}/select-simple`, {
        group_id: selectedGroup,
        subject_id: selectedSubject,
        student_id: currentStudent.id,
        student_name: currentStudent.full_name
      });

      // Обновляем выбранный билет, гарантируя что number берется из response
      const updatedTicket = {
        ...ticket,
        is_used: true,
        ...response.data.ticket,
        number: response.data.ticket.number || ticket.number // Приоритет отдаем response
      };
      setSelectedTicket(updatedTicket);
      
      // Сохраняем выбранный билет в localStorage с правильным номером
      if (selectedGroup && selectedSubject) {
        const selectedTicketKey = `selected_ticket_${selectedGroup}_${selectedSubject}`;
        localStorage.setItem(selectedTicketKey, JSON.stringify(updatedTicket));
      }
      
      // Обновляем список билетов, чтобы пометить выбранный
      setAvailableTickets(prev => {
        const updated = prev.map(t => t.id === ticket.id ? { ...t, is_used: true } : t);
        const shuffleKey = `ticket_order_${selectedGroup}_${selectedSubject}`;
        localStorage.setItem(shuffleKey, JSON.stringify(updated.map(t => t.id)));
        return updated;
      });
      
      // Обновляем статистику
      await loadStatistics();
      
      // Проверяем, все ли курсанты получили билеты
      const stats = await loadStatistics();
      const studentsWithoutTickets = students.filter(student => 
        !stats.some(stat => stat.student_id === student.id)
      );
      
      if (studentsWithoutTickets.length === 0) {
        // Все курсанты получили билеты
        setShowStatistics(true);
        setCurrentStudent(null);
      } else {
        // Оставляем текущего курсанта выбранным, если у него еще нет билета
        // Или выбираем первого без билета, если текущий уже получил билет
        const currentStudentHasTicket = stats.some(stat => stat.student_id === currentStudent.id);
        if (currentStudentHasTicket) {
          setCurrentStudent(studentsWithoutTickets[0]);
        }
        // Иначе оставляем текущего курсанта выбранным для возможности выбрать еще билет
      }
      
      setShowModal(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка выбора билета');
      setFlippedCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticket.id);
        return newSet;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };


  if (!selectedGroup || !selectedSubject) {
    return (
      <div className="student-panel">
        <div className="warning-message" style={{ 
          padding: '40px', 
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '12px'
        }}>
          <p>⚠️ Настройка не завершена</p>
          <p style={{ marginTop: '20px', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            Перейдите в режим "Настройка" для настройки экзамена
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-panel">
      <div className="selection-header">
        <h2>Выбор билета</h2>
        <div className="exam-info" style={{ 
          marginBottom: '20px', 
          padding: '20px', 
          background: 'rgba(15, 23, 42, 0.6)', 
          borderRadius: '12px',
          textAlign: 'center',
          maxWidth: '800px',
          margin: '0 auto 20px auto'
        }}>
          <p style={{ color: '#e0e7ff', fontSize: '1.1rem', margin: '5px 0' }}>
            <strong style={{ color: '#818cf8' }}>Дисциплина:</strong> {subjectName}
          </p>
          <p style={{ color: '#e0e7ff', fontSize: '1.1rem', margin: '5px 0' }}>
            <strong style={{ color: '#818cf8' }}>Группа:</strong> {groupName}
          </p>
          {!showStatistics && (
            <div style={{ 
              marginTop: '20px', 
              padding: '20px', 
              background: 'rgba(15, 23, 42, 0.8)', 
              borderRadius: '12px',
              border: '2px solid rgba(129, 140, 248, 0.3)',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>
              <label style={{ 
                display: 'block', 
                color: '#818cf8', 
                marginBottom: '10px', 
                fontSize: '1.1rem',
                fontWeight: '600'
              }}>
                Выберите курсанта для выбора билета:
              </label>
              <select
                value={currentStudent ? currentStudent.id : ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (selectedId) {
                    const selected = students.find(s => s.id === selectedId);
                    if (selected) {
                      setCurrentStudent(selected);
                      setSelectedTicket(null);
                      setFlippedCards(new Set());
                      setError('');
                    }
                  } else {
                    setCurrentStudent(null);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '2px solid rgba(129, 140, 248, 0.4)',
                  borderRadius: '8px',
                  color: '#e0e7ff',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontFamily: 'Montserrat, sans-serif',
                  outline: 'none',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(129, 140, 248, 0.8)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(129, 140, 248, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(129, 140, 248, 0.4)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="">-- Выберите курсанта --</option>
                {students.map(student => {
                  const hasTicket = statistics.some(stat => stat.student_id === student.id);
                  return (
                    <option
                      key={student.id}
                      value={student.id}
                      disabled={hasTicket}
                      style={{
                        background: hasTicket ? 'rgba(148, 163, 184, 0.2)' : 'rgba(15, 23, 42, 0.9)',
                        color: hasTicket ? '#94a3b8' : '#e0e7ff'
                      }}
                    >
                      {hasTicket 
                        ? `✓ ${student.full_name || 'Неизвестно'} (билет выбран)`
                        : `🎓 ${student.full_name || 'Неизвестно'}`
                      }
                    </option>
                  );
                })}
              </select>
              {currentStudent && (
                <div style={{ 
                  marginTop: '15px', 
                  padding: '12px', 
                  background: 'rgba(129, 140, 248, 0.3)', 
                  borderRadius: '8px',
                  border: '2px solid rgba(129, 140, 248, 0.5)',
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#e0e7ff', fontSize: '1.1rem', margin: 0, fontWeight: 'bold' }}>
                    Выбран: <span style={{ color: '#818cf8' }}>{currentStudent.full_name || 'Неизвестно'}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ 
          padding: '15px', 
          background: 'rgba(239, 68, 68, 0.2)', 
          border: '1px solid rgba(239, 68, 68, 0.5)', 
          borderRadius: '8px',
          marginBottom: '20px',
          color: '#fca5a5'
        }}>
          {error}
        </div>
      )}

      {showStatistics ? (
        <div className="statistics-container" style={{
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '16px',
          padding: '30px',
          marginTop: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: '#818cf8', margin: 0, fontSize: '1.5rem' }}>
              📊 Статистика выбора билетов
            </h3>
            <button
              onClick={handleCompleteExam}
              className="btn btn-success"
              disabled={loading}
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                fontWeight: '600',
                background: 'linear-gradient(135deg, rgba(34, 211, 153, 0.8), rgba(16, 185, 129, 0.8))',
                color: '#ffffff',
                border: '2px solid rgba(34, 211, 153, 0.5)',
                borderRadius: '12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                opacity: loading ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.background = 'linear-gradient(135deg, rgba(34, 211, 153, 1), rgba(16, 185, 129, 1))';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(34, 211, 153, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.background = 'linear-gradient(135deg, rgba(34, 211, 153, 0.8), rgba(16, 185, 129, 0.8))';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }
              }}
            >
              {loading ? '⏳ Завершение...' : '✅ Закончить зачет'}
            </button>
          </div>
          <div className="statistics-table-wrapper" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(129, 140, 248, 0.3)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#818cf8' }}>№</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#818cf8' }}>Курсант</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#818cf8' }}>Билет</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#818cf8' }}>Вопросы</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#818cf8' }}>Время получения</th>
                </tr>
              </thead>
              <tbody>
                {statistics.map((stat, index) => (
                  <tr key={stat.ticket_id} style={{ borderBottom: '1px solid rgba(129, 140, 248, 0.1)' }}>
                    <td style={{ padding: '12px', color: '#e0e7ff' }}>{index + 1}</td>
                    <td style={{ padding: '12px', color: '#e0e7ff' }}>{stat.student_name}</td>
                    <td style={{ padding: '12px', color: '#e0e7ff', fontWeight: 'bold' }}>№{stat.ticket_number}</td>
                    <td style={{ padding: '12px', color: '#e0e7ff' }}>
                      {stat.questions && stat.questions.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '20px', listStyle: 'disc' }}>
                          {stat.questions.map((q, qIdx) => {
                            const questionText = typeof q === 'string' ? q : q.text;
                            const questionNumber = typeof q === 'object' && q.question_number ? q.question_number : null;
                            return (
                              <li key={qIdx} style={{ marginBottom: '5px' }}>
                                {questionNumber ? (
                                  <span>
                                    <strong style={{ color: '#818cf8' }}>Вопрос №{questionNumber}:</strong> {questionText}
                                  </span>
                                ) : (
                                  questionText
                                )}
                              </li>
                            );
                          })}
                          {stat.practicalTask && (
                            <li style={{ marginTop: '8px', color: '#818cf8', fontWeight: 'bold' }}>
                              {stat.practicalTask.text || `Практическое задание №${stat.practicalTask.number}`}
                            </li>
                          )}
                        </ul>
                      ) : (
                        <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', color: '#e0e7ff' }}>
                      {stat.used_at ? new Date(stat.used_at).toLocaleString('ru-RU') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !selectedTicket && (
        <>
          {loading ? (
            <div className="loading-message">
              <p>Загрузка билетов...</p>
            </div>
          ) : (
            <>
              {currentStudent && (
                <p className="instruction-text">
                  Курсант <strong style={{ color: '#818cf8' }}>{currentStudent.full_name || 'Неизвестно'}</strong> выбирает билет. Выберите один из доступных билетов ниже.
                </p>
              )}
              {!currentStudent && (
                <p className="instruction-text">
                  Выберите курсанта из списка выше, затем выберите билет. После выбора билет будет закреплен за курсантом.
                </p>
              )}
              
              {availableTickets.length === 0 ? (
                <div className="no-tickets">
                  <p>Билеты еще не сгенерированы. Перейдите в режим "Настройка" для генерации билетов.</p>
                </div>
              ) : (
                <div className="tickets-grid">
                  {availableTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className={`ticket-card ${flippedCards.has(ticket.id) ? 'flipped' : ''} ${ticket.is_used ? 'used' : ''} ${selectedTicket && selectedTicket.id === ticket.id ? 'selected' : ''}`}
                      onClick={() => handleCardClick(ticket)}
                      style={{
                        cursor: ticket.is_used ? 'not-allowed' : 'pointer',
                        opacity: ticket.is_used ? 0.6 : 1
                      }}
                    >
                      <div className="card-inner">
                        <div className="card-front">
                          {ticket.is_used ? (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '3rem', marginBottom: '15px', color: '#34d399' }}>✓</div>
                              <div className="card-hint" style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Выбран</div>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>🎫</div>
                              <div className="card-hint" style={{ fontSize: '1rem' }}>Нажмите для выбора</div>
                            </div>
                          )}
                        </div>
                        <div className="card-back">
                          <div className="card-loading">Выбор...</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {showModal && selectedTicket && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Билет выбран</h2>
            </div>
            <div className="modal-body">
              <div className="ticket-info">
                <h3>Билет №{selectedTicket.number || '?'}</h3>
                <div className="questions-list">
                  <strong>Вопросы:</strong>
                  <ul>
                    {selectedTicket.questions.map((q, idx) => {
                      const questionText = typeof q === 'string' ? q : q.text;
                      const questionNumber = typeof q === 'object' && q.question_number ? q.question_number : null;
                      return (
                        <li key={idx}>
                          {questionNumber ? (
                            <span>
                              <strong style={{ color: '#818cf8' }}>Вопрос №{questionNumber}:</strong> {questionText}
                            </span>
                          ) : (
                            questionText
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {selectedTicket.practicalTask && (
                    <div style={{ 
                      marginTop: '20px', 
                      padding: '15px', 
                      background: 'rgba(129, 140, 248, 0.2)', 
                      borderRadius: '8px',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      maxWidth: '100%'
                    }}>
                      <strong style={{ color: '#818cf8', display: 'block', marginBottom: '10px' }}>Практическое задание:</strong>
                      <p style={{ 
                        margin: 0, 
                        color: '#e0e7ff',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        lineHeight: '1.5'
                      }}>
                        {selectedTicket.practicalTask.text || `Практическое задание №${selectedTicket.practicalTask.number}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => {
                  setSelectedTicket(null);
                  setFlippedCards(new Set());
                  setShowModal(false);
                  // Удаляем сохраненный билет из localStorage
                  if (selectedGroup && selectedSubject) {
                    const selectedTicketKey = `selected_ticket_${selectedGroup}_${selectedSubject}`;
                    localStorage.removeItem(selectedTicketKey);
                  }
                }} 
                className="btn btn-primary"
              >
                Начать подготовку
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketSelection;