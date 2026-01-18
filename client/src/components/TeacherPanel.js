import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TeacherPanel.css';

const API_URL = process.env.REACT_APP_API_URL || '/api';

function TeacherPanel() {
  const [questions, setQuestions] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [statistics, setStatistics] = useState({ total: 0, used: 0, available: 0 });
  const [history, setHistory] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [groupStudents, setGroupStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [config, setConfig] = useState({ ticketCount: 20, questionsPerTicket: 3 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('questions');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateSubjectModal, setShowCreateSubjectModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [newSubject, setNewSubject] = useState({ name: '', type: 'exam', description: '' });

  useEffect(() => {
    loadGroups();
    loadSubjects();
    loadConfig();
  }, []);

  // Проверяем сохраненные выборы после загрузки групп и дисциплин
  useEffect(() => {
    if (groups.length > 0 && subjects.length > 0) {
      const savedGroup = localStorage.getItem('exam_selected_group');
      const savedSubject = localStorage.getItem('exam_selected_subject');
      
      // Проверяем, что сохраненная группа существует
      if (savedGroup) {
        const groupExists = groups.some(g => g.id === savedGroup);
        if (!groupExists) {
          console.warn('Сохраненная группа не найдена, очищаем localStorage');
          localStorage.removeItem('exam_selected_group');
          localStorage.removeItem('exam_selected_subject');
          return;
        }
      }
      
      // Проверяем, что сохраненная дисциплина существует
      if (savedSubject) {
        const subjectExists = subjects.some(s => s.id === savedSubject);
        if (!subjectExists) {
          console.warn('Сохраненная дисциплина не найдена, очищаем localStorage');
          localStorage.removeItem('exam_selected_group');
          localStorage.removeItem('exam_selected_subject');
          return;
        }
      }
      
      // Устанавливаем выбор только если оба существуют
      if (savedGroup && savedSubject) {
        setSelectedGroup(savedGroup);
        setSelectedSubject(savedSubject);
      }
    }
  }, [groups, subjects]);

  useEffect(() => {
    if (selectedGroup && selectedSubject) {
      loadQuestions();
      loadTickets();
      loadStatistics();
      loadHistory();
      loadGroupStudentsWithStatus();
    } else {
      setTickets([]);
      setQuestions([]);
      setHistory([]);
      setStatistics({ total: 0, used: 0, available: 0 });
      setGroupStudents([]);
    }
  }, [selectedGroup, selectedSubject]);

  const handleGroupSubjectSelect = (groupId, subjectId) => {
    setSelectedGroup(groupId);
    setSelectedSubject(subjectId);
    localStorage.setItem('exam_selected_group', groupId);
    localStorage.setItem('exam_selected_subject', subjectId);
    showMessage('Группа и дисциплина выбраны');
  };

  const loadSubjects = async () => {
    try {
      const response = await axios.get(`${API_URL}/subjects`);
      setSubjects(response.data || []);
    } catch (error) {
      showMessage('Ошибка загрузки дисциплин', 'error');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name || !newGroup.name.trim()) {
      showMessage('Название группы обязательно', 'error');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/groups`, {
        name: newGroup.name.trim(),
        description: newGroup.description || ''
      });
      setNewGroup({ name: '', description: '' });
      setShowCreateGroupModal(false);
      loadGroups();
      showMessage('Группа успешно создана');
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка создания группы', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubject.name || !newSubject.name.trim()) {
      showMessage('Название дисциплины обязательно', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/subjects`, {
        name: newSubject.name.trim(),
        type: newSubject.type,
        description: newSubject.description || ''
      });
      setNewSubject({ name: '', type: 'exam', description: '' });
      setShowCreateSubjectModal(false);
      loadSubjects();
      // Автоматически выбираем созданную дисциплину
      setSelectedSubject(response.data.id);
      localStorage.setItem('exam_selected_subject', response.data.id);
      showMessage('Дисциплина успешно создана');
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка создания дисциплины', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroup && selectedSubject) {
      loadQuestions();
      loadTickets();
      loadStatistics();
      loadHistory();
      loadGroupStudentsWithStatus();
    } else {
      // При сбросе выбора очищаем все данные
      setTickets([]);
      setQuestions([]);
      setHistory([]);
      setStatistics({ total: 0, used: 0, available: 0 });
      setGroupStudents([]);
    }
  }, [selectedGroup, selectedSubject]);

  // Загружаем данные курсантов при переключении на вкладку "Курсанты"
  useEffect(() => {
    if (activeTab === 'students') {
      if (selectedGroup && selectedSubject) {
        loadGroupStudentsWithStatus();
      } else if (selectedGroup) {
        // Если выбрана группа, но нет дисциплины, загружаем обычный список
        loadGroupStudents(selectedGroup);
      }
    }
  }, [activeTab, selectedGroup, selectedSubject]);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupStudents(selectedGroup);
    } else {
      setGroupStudents([]);
    }
  }, [selectedGroup]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(''), 3000);
  };

  const loadQuestions = async () => {
    if (!selectedSubject) {
      setQuestions([]);
      return;
    }
    
    try {
      const response = await axios.get(`${API_URL}/questions`, {
        params: { subject_id: selectedSubject }
      });
      setQuestions(response.data);
    } catch (error) {
      showMessage('Ошибка загрузки вопросов', 'error');
    }
  };

  const loadTickets = async () => {
    if (!selectedGroup || !selectedSubject) {
      setTickets([]);
      return;
    }
    
    try {
      const response = await axios.get(`${API_URL}/tickets`, {
        params: {
          group_id: selectedGroup,
          subject_id: selectedSubject
        }
      });
      setTickets(response.data);
      loadGroupStudentsWithStatus();
    } catch (error) {
      showMessage('Ошибка загрузки билетов', 'error');
    }
  };

  const loadStatistics = async () => {
    if (!selectedGroup || !selectedSubject) {
      setStatistics({ total: 0, used: 0, available: 0 });
      return;
    }
    
    try {
      const response = await axios.get(`${API_URL}/statistics`, {
        params: {
          group_id: selectedGroup,
          subject_id: selectedSubject
        }
      });
      console.log('Статистика загружена:', response.data);
      setStatistics(response.data || { total: 0, used: 0, available: 0 });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      showMessage('Ошибка загрузки статистики: ' + (error.response?.data?.error || error.message), 'error');
      setStatistics({ total: 0, used: 0, available: 0 });
    }
  };

  const loadHistory = async () => {
    if (!selectedGroup || !selectedSubject) {
      setHistory([]);
      return;
    }
    
    try {
      // Загружаем детальную статистику, которая содержит историю для выбранной группы и дисциплины
      const response = await axios.get(`${API_URL}/tickets/statistics`, {
        params: {
          group_id: selectedGroup,
          subject_id: selectedSubject
        }
      });
      console.log('История загружена:', response.data);
      
      // Преобразуем данные статистики в формат истории
      const historyData = response.data.map(stat => ({
        id: stat.ticket_id || stat.ticket_number,
        username: stat.username,
        student_name: stat.student_name,
        display_name: stat.student_name,
        full_name: stat.student_name,
        ticket_number: stat.ticket_number,
        questions: stat.questions ? stat.questions.map(q => q.text || q).join(' | ') : '',
        taken_at: stat.selected_at,
        used_at: stat.selected_at,
        completed_at: stat.completed_at,
        practicalTask: stat.practicalTask
      }));
      
      setHistory(historyData);
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
      showMessage('Ошибка загрузки истории: ' + (error.response?.data?.error || error.message), 'error');
      setHistory([]);
    }
  };


  const loadGroups = async () => {
    try {
      const response = await axios.get(`${API_URL}/groups`);
      setGroups(response.data);
    } catch (error) {
      showMessage('Ошибка загрузки учебных групп', 'error');
    }
  };

  const loadGroupStudents = async (groupId) => {
    try {
      const response = await axios.get(`${API_URL}/groups/${groupId}/students`);
      setGroupStudents(response.data);
    } catch (error) {
      showMessage('Ошибка загрузки курсантов учебной группы', 'error');
    }
  };

  const loadGroupStudentsWithStatus = async () => {
    if (!selectedGroup || !selectedSubject) {
      setGroupStudents([]);
      setLoadingStudents(false);
      return;
    }
    
    setLoadingStudents(true);
    try {
      const response = await axios.get(`${API_URL}/groups/${selectedGroup}/students-with-status`, {
        params: { subject_id: selectedSubject }
      });
      setGroupStudents(response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки курсантов со статусом:', error);
      try {
        await loadGroupStudents(selectedGroup);
      } catch (err) {
        console.error('Ошибка загрузки курсантов:', err);
        setGroupStudents([]);
      }
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/config`);
      setConfig(response.data);
    } catch (error) {
      showMessage('Ошибка загрузки конфигурации', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      showMessage('Пожалуйста, загрузите TXT файл', 'error');
      return;
    }

    if (!selectedSubject) {
      showMessage('Сначала выберите дисциплину', 'error');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject_id', selectedSubject);

    try {
      await axios.post(`${API_URL}/questions/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      loadQuestions();
      showMessage('Вопросы успешно загружены');
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка загрузки файла', 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleDeleteQuestions = async () => {
    if (!selectedSubject) {
      showMessage('Сначала выберите дисциплину', 'error');
      return;
    }

    if (!window.confirm('Удалить все вопросы для этой дисциплины? Это также удалит все билеты.')) return;

    try {
      await axios.delete(`${API_URL}/questions`, {
        params: { subject_id: selectedSubject }
      });
      loadQuestions();
      loadTickets();
      showMessage('Вопросы для дисциплины удалены');
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка удаления', 'error');
    }
  };

  const handleConfigChange = (field, value) => {
    setConfig({ ...config, [field]: parseInt(value) || 0 });
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/config`, config);
      showMessage('Конфигурация сохранена');
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка сохранения', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTickets = async () => {
    if (!selectedGroup || !selectedSubject) {
      showMessage('Сначала выберите группу и дисциплину', 'error');
      return;
    }

    // Валидация конфигурации
    if (config.ticketCount < 1 || config.ticketCount > 100) {
      showMessage('Количество билетов должно быть от 1 до 100', 'error');
      return;
    }
    if (config.questionsPerTicket < 1 || config.questionsPerTicket > 20) {
      showMessage('Количество вопросов в билете должно быть от 1 до 20', 'error');
      return;
    }

    if (!window.confirm('Сгенерировать новые билеты? Старые билеты будут удалены.')) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/tickets/generate`, {
        session: {
          group_id: selectedGroup,
          subject_id: selectedSubject
        },
        config: {
          ticketCount: config.ticketCount,
          questionsPerTicket: config.questionsPerTicket
        }
      });
      loadTickets();
      loadStatistics();
      showMessage('Билеты успешно сгенерированы');
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка генерации билетов', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllTickets = async () => {
    if (!selectedGroup || !selectedSubject) {
      showMessage('Необходимо выбрать группу и дисциплину', 'error');
      return;
    }

    if (!window.confirm('Вы уверены, что хотите удалить все билеты для текущей учебной группы и дисциплины? Это действие нельзя отменить.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.delete(`${API_URL}/tickets`, {
        params: {
          group_id: selectedGroup,
          subject_id: selectedSubject
        }
      });
      await loadTickets();
      await loadStatistics();
      showMessage(response.data.message || 'Все билеты успешно удалены');
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка удаления билетов', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Сбросить всю статистику и освободить все билеты?')) return;

    try {
      await axios.post(`${API_URL}/reset`);
      loadTickets();
      loadStatistics();
      loadHistory();
      showMessage('Статистика сброшена');
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка сброса', 'error');
    }
  };

  const handleCompleteExam = async (item) => {
    const displayName = item.display_name || item.full_name || item.student_name || 'Неизвестно';
    const username = item.username; // Используем для API, но не показываем пользователю
    
    if (!username) {
      showMessage('Ошибка: не удалось определить курсанта', 'error');
      return;
    }
    
    if (!window.confirm(`Завершить сдачу зачета/экзамена для курсанта ${displayName}?`)) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/tickets/complete`, {
        username: username
      });
      loadHistory();
      loadGroupStudentsWithStatus(); // Обновляем список курсантов со статусом
      showMessage(`Сдача зачета/экзамена для ${displayName} завершена`);
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка завершения сдачи', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAllExams = async () => {
    if (!selectedGroup || !selectedSubject) {
      showMessage('Необходимо выбрать учебную группу и дисциплину', 'error');
      return;
    }

    const groupName = groups.find(g => g.id === selectedGroup)?.name || 'группы';
    const subjectName = subjects.find(s => s.id === selectedSubject)?.name || 'дисциплины';
    
    if (!window.confirm(`Завершить все незавершенные зачеты для учебной группы "${groupName}" и дисциплины "${subjectName}"? После завершения статистика будет очищена.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/tickets/complete-all`, {
        group_id: selectedGroup,
        subject_id: selectedSubject
      });
      
      try {
        await axios.post(`${API_URL}/reset`, {
          group_id: selectedGroup,
          subject_id: selectedSubject
        });
      } catch (resetError) {
        console.error('Ошибка при сбросе статистики:', resetError);
      }
      
      loadTickets();
      loadStatistics();
      loadHistory();
      loadGroupStudentsWithStatus();
      
      showMessage(response.data.message || `Завершено ${response.data.completed} зачетов. Статистика очищена.`);
    } catch (error) {
      console.error('Ошибка завершения зачетов:', error);
      showMessage(error.response?.data?.error || 'Ошибка завершения зачетов', 'error');
    } finally {
      setLoading(false);
    }
  };

  const currentSubject = subjects.find(s => s.id === selectedSubject);
  const currentGroup = groups.find(g => g.id === selectedGroup);
  
  return (
    <div className="teacher-panel">
      <div className="session-info">
        <div className="session-badge">
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div>
                <label style={{ marginRight: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>Группа:</label>
                <select
                  value={selectedGroup || ''}
                  onChange={(e) => {
                    const groupId = e.target.value || null;
                    setSelectedGroup(groupId);
                    if (groupId) {
                      localStorage.setItem('exam_selected_group', groupId);
                    } else {
                      localStorage.removeItem('exam_selected_group');
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '2px solid rgba(129, 140, 248, 0.3)',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#ffffff',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">-- Выберите группу --</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name} {group.description ? `(${group.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '2px solid rgba(129, 140, 248, 0.5)',
                  background: 'rgba(129, 140, 248, 0.2)',
                  color: '#818cf8',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(129, 140, 248, 0.3)';
                  e.target.style.borderColor = 'rgba(129, 140, 248, 0.8)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(129, 140, 248, 0.2)';
                  e.target.style.borderColor = 'rgba(129, 140, 248, 0.5)';
                }}
                title="Создать новую группу"
              >
                + Группа
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div>
                <label style={{ marginRight: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>Дисциплина:</label>
                <select
                  value={selectedSubject || ''}
                  onChange={(e) => {
                    const subjectId = e.target.value || null;
                    setSelectedSubject(subjectId);
                    if (subjectId) {
                      localStorage.setItem('exam_selected_subject', subjectId);
                    } else {
                      localStorage.removeItem('exam_selected_subject');
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '2px solid rgba(129, 140, 248, 0.3)',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#ffffff',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">-- Выберите дисциплину --</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.type === 'exam' ? 'Экзамен' : 'Зачет'})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowCreateSubjectModal(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '2px solid rgba(129, 140, 248, 0.5)',
                  background: 'rgba(129, 140, 248, 0.2)',
                  color: '#818cf8',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(129, 140, 248, 0.3)';
                  e.target.style.borderColor = 'rgba(129, 140, 248, 0.8)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(129, 140, 248, 0.2)';
                  e.target.style.borderColor = 'rgba(129, 140, 248, 0.5)';
                }}
                title="Создать новую дисциплину"
              >
                + Дисциплина
              </button>
            </div>
            {currentSubject && (
              <span className="session-type">
                ({currentSubject.type === 'exam' ? 'Экзамен' : 'Зачет'})
              </span>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="tabs">
        <button
          className={activeTab === 'questions' ? 'active' : ''}
          onClick={() => setActiveTab('questions')}
        >
          📝 Вопросы
        </button>
        <button
          className={activeTab === 'tickets' ? 'active' : ''}
          onClick={() => setActiveTab('tickets')}
        >
          🎫 Билеты
        </button>
        <button
          className={activeTab === 'students' ? 'active' : ''}
          onClick={() => setActiveTab('students')}
        >
          👥 Курсанты
        </button>
        <button
          className={activeTab === 'statistics' ? 'active' : ''}
          onClick={() => setActiveTab('statistics')}
        >
          📊 Статистика
        </button>
      </div>

      {activeTab === 'questions' && (
        <div className="tab-content">
          {!selectedSubject ? (
            <section className="card">
              <div className="warning-message">
                <p>⚠️ Для работы с вопросами необходимо выбрать дисциплину</p>
              </div>
            </section>
          ) : (
            <section className="card">
              <h2>Управление вопросами</h2>
              {currentSubject && (
                <p className="subject-info">
                  Дисциплина: <strong>{currentSubject.name}</strong> ({currentSubject.type === 'exam' ? 'Экзамен' : 'Зачет'})
                </p>
              )}
            <div className="upload-section">
              <label className="file-upload-label">
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="file-input"
                />
                <span className="file-upload-button">
                  {loading ? 'Загрузка...' : '📁 Загрузить вопросы из TXT файла'}
                </span>
              </label>
              <p className="help-text">
                Загрузите TXT файл, где каждый вопрос находится на отдельной строке.<br/>
                Формат файла: просто список вопросов, по одному на строку. Дополнительные данные не требуются.
              </p>
            </div>

            <div className="questions-actions">
              <button
                onClick={handleDeleteQuestions}
                className="btn btn-danger"
                disabled={questions.length === 0}
              >
                🗑️ Удалить все вопросы
              </button>
            </div>

            <div className="questions-count">
              Загружено вопросов: <strong>{questions.length}</strong>
            </div>

            {questions.length > 0 && (
              <div className="questions-list">
                <h3>Список вопросов:</h3>
                <ul>
                  {questions.map((q, index) => (
                    <li key={q.id}>
                      <span className="question-number">{index + 1}.</span>
                      {q.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            </section>
          )}

          <section className="card">
            <h2>Конфигурация экзамена</h2>
            <div className="config-form">
              <div className="config-item">
                <label>Количество билетов (1-100):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={config.ticketCount}
                  onChange={(e) => handleConfigChange('ticketCount', e.target.value)}
                />
              </div>
              <div className="config-item">
                <label>Вопросов в билете (1-20):</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={config.questionsPerTicket}
                  onChange={(e) => handleConfigChange('questionsPerTicket', e.target.value)}
                />
              </div>
              <button
                onClick={handleSaveConfig}
                className="btn btn-primary"
                disabled={loading}
              >
                💾 Сохранить конфигурацию
              </button>
            </div>

            <div className="generate-section">
              <button
                onClick={handleGenerateTickets}
                className="btn btn-success"
                disabled={loading || questions.length === 0 || !selectedGroup || !selectedSubject}
              >
                🎲 Сгенерировать билеты
              </button>
              {(!selectedGroup || !selectedSubject) && (
                <p className="help-text">Для генерации билетов необходимо выбрать группу и дисциплину</p>
              )}
              <p className="help-text">
                Билеты будут сгенерированы с уникальными комбинациями вопросов
              </p>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="tab-content">
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Список билетов ({tickets.length})</h2>
              {tickets.length > 0 && selectedGroup && selectedSubject && (
                <button
                  onClick={handleDeleteAllTickets}
                  className="btn btn-danger"
                  disabled={loading}
                  style={{ marginLeft: 'auto' }}
                >
                  🗑️ Удалить все билеты
                </button>
              )}
            </div>
            {tickets.length > 0 ? (
              <div className="tickets-grid">
                {tickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className={`ticket-card ${ticket.is_used ? 'used' : 'available'}`}
                  >
                    <div className="ticket-header">
                      <span className="ticket-number">Билет №{ticket.number}</span>
                      <span className="ticket-status">
                        {ticket.is_used ? '✅ Использован' : '🆕 Доступен'}
                      </span>
                    </div>
                    <div className="ticket-questions">
                      <strong>Вопросы:</strong>
                      <ul>
                        {ticket.questions.map((q, idx) => (
                          <li key={idx}>{q.text}</li>
                        ))}
                      </ul>
                    </div>
                    {ticket.is_used && ticket.used_by && (
                      <div className="ticket-used-by">
                        Использован: {ticket.used_by}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Билеты не сгенерированы</p>
            )}
          </section>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="tab-content">
          {!selectedGroup ? (
            <section className="card">
              <div className="warning-message">
                <p>⚠️ Для просмотра списка курсантов необходимо выбрать учебную группу</p>
              </div>
            </section>
          ) : selectedGroup && selectedSubject ? (
            <section className="card students-list-card">
              <h2>Список курсантов учебной группы "{currentGroup?.name || ''}"</h2>
              {currentSubject && (
                <p className="subject-info" style={{ marginBottom: '20px' }}>
                  Дисциплина: <strong>{currentSubject.name}</strong>
                </p>
              )}
              {loadingStudents ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p>Загрузка данных курсантов...</p>
                </div>
              ) : groupStudents.length > 0 ? (
                <div className="students-table-wrapper">
                  <table className="students-status-table">
                    <thead>
                      <tr>
                        <th>ФИО</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStudents.map(student => (
                        <tr key={student.id}>
                          <td><strong>{student.full_name || '-'}</strong></td>
                          <td>
                            {student.status === 'completed' ? (
                              <span className="status-badge completed">✅ Завершено</span>
                            ) : student.status === 'in_progress' ? (
                              <span className="status-badge in-progress">⏳ В процессе</span>
                            ) : (
                              <span className="status-badge not-started">🆕 Не начато</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p>В этой учебной группе нет курсантов</p>
                </div>
              )}
            </section>
          ) : selectedGroup ? (
            <section className="card students-list-card">
              <h2>Список курсантов учебной группы</h2>
              {loadingStudents ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p>Загрузка данных курсантов...</p>
                </div>
              ) : groupStudents.length > 0 ? (
                <div className="students-table-wrapper">
                  <table className="students-status-table">
                    <thead>
                      <tr>
                        <th>ФИО</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStudents.map(student => (
                        <tr key={student.id}>
                          <td><strong>{student.full_name || '-'}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p>В этой учебной группе нет курсантов</p>
                </div>
              )}
            </section>
          ) : null}
        </div>
      )}

      {activeTab === 'statistics' && (
        <div className="tab-content">
          <section className="card">
            <h2>Статистика</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{statistics.total}</div>
                <div className="stat-label">Всего билетов</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{statistics.used}</div>
                <div className="stat-label">Использовано</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{statistics.available}</div>
                <div className="stat-label">Доступно</div>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="btn btn-warning"
            >
              🔄 Сбросить статистику
            </button>
          </section>

          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>История сдачи экзамена</h2>
              {selectedGroup && selectedSubject && (
                <button
                  onClick={handleCompleteAllExams}
                  className="btn btn-primary"
                  disabled={loading}
                  title="Завершить все незавершенные зачеты для текущей группы и дисциплины"
                >
                  ✅ Окончить зачет
                </button>
              )}
            </div>
            {history.length > 0 ? (
              <div className="history-table">
                <table>
                  <thead>
                    <tr>
                      <th>Курсант</th>
                      <th>Билет</th>
                      <th>Вопросы</th>
                      <th>Время выбора</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(item => {
                      const isCompleted = item.completed_at !== null && item.completed_at !== undefined;
                      const questions = item.questions ? item.questions.split(' | ') : [];
                      return (
                        <tr key={item.id}>
                          <td><strong>{item.display_name || item.full_name || item.student_name || 'Неизвестно'}</strong></td>
                          <td>№{item.ticket_number || 'N/A'}</td>
                          <td className="questions-cell">
                            {questions.length > 0 ? (
                              questions.map((q, idx) => (
                                <div key={idx}>{idx + 1}. {q}</div>
                              ))
                            ) : (
                              <span>Вопросы не указаны</span>
                            )}
                          </td>
                          <td>{item.taken_at ? new Date(item.taken_at).toLocaleString('ru-RU') : 'Не указано'}</td>
                          <td>
                            {isCompleted ? (
                              <span className="status-badge completed">
                                ✅ Завершено
                              </span>
                            ) : (
                              <span className="status-badge in-progress">
                                ⏳ В процессе
                              </span>
                            )}
                          </td>
                          <td>
                            {!isCompleted && (
                              <button
                                onClick={() => handleCompleteExam(item)}
                                className="btn-complete-exam"
                                title="Завершить сдачу"
                              >
                                Завершить
                              </button>
                            )}
                            {isCompleted && item.completed_at && (
                              <span className="completion-time">
                                {new Date(item.completed_at).toLocaleString('ru-RU')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">История пуста</p>
            )}
          </section>
        </div>
      )}

      {/* Модальное окно создания группы */}
      {showCreateGroupModal && (
        <div className="modal-overlay" onClick={() => setShowCreateGroupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Создать новую группу</h2>
              <button className="modal-close" onClick={() => setShowCreateGroupModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Название группы:</label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  placeholder="Например: 237"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '2px solid rgba(129, 140, 248, 0.3)',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#ffffff',
                    fontSize: '1rem',
                    marginTop: '8px'
                  }}
                />
              </div>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Описание (необязательно):</label>
                <input
                  type="text"
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  placeholder="Описание группы"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '2px solid rgba(129, 140, 248, 0.3)',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#ffffff',
                    fontSize: '1rem',
                    marginTop: '8px'
                  }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateGroupModal(false)} className="btn btn-secondary">
                Отмена
              </button>
              <button onClick={handleCreateGroup} className="btn btn-primary" disabled={loading || !newGroup.name.trim()}>
                {loading ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания дисциплины */}
      {showCreateSubjectModal && (
        <div className="modal-overlay" onClick={() => setShowCreateSubjectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Создать новую дисциплину</h2>
              <button className="modal-close" onClick={() => setShowCreateSubjectModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Название дисциплины:</label>
                <input
                  type="text"
                  value={newSubject.name}
                  onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                  placeholder="Например: Математика"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '2px solid rgba(129, 140, 248, 0.3)',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#ffffff',
                    fontSize: '1rem',
                    marginTop: '8px'
                  }}
                />
              </div>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Тип:</label>
                <select
                  value={newSubject.type}
                  onChange={(e) => setNewSubject({ ...newSubject, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '2px solid rgba(129, 140, 248, 0.3)',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#ffffff',
                    fontSize: '1rem',
                    marginTop: '8px'
                  }}
                >
                  <option value="exam">Экзамен</option>
                  <option value="test">Зачет</option>
                </select>
              </div>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Описание (необязательно):</label>
                <input
                  type="text"
                  value={newSubject.description}
                  onChange={(e) => setNewSubject({ ...newSubject, description: e.target.value })}
                  placeholder="Описание дисциплины"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '2px solid rgba(129, 140, 248, 0.3)',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#ffffff',
                    fontSize: '1rem',
                    marginTop: '8px'
                  }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateSubjectModal(false)} className="btn btn-secondary">
                Отмена
              </button>
              <button onClick={handleCreateSubject} className="btn btn-primary" disabled={loading || !newSubject.name.trim()}>
                {loading ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherPanel;
