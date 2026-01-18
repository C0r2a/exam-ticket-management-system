import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './SetupWizard.css';

const API_URL = process.env.REACT_APP_API_URL || '/api';

function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Данные для настройки
  const [subjectName, setSubjectName] = useState('');
  const [subjectType, setSubjectType] = useState('exam');
  const [subjectId, setSubjectId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState(null);
  const [students, setStudents] = useState([]);
  const [newStudent, setNewStudent] = useState({ full_name: '' });
  const [config, setConfig] = useState({ 
    ticketCount: 20, 
    questionsPerTicket: 2,
    hasPracticalTasks: true,
    practicalTasksCount: 1,
    hasSections: false,
    sectionBoundary: 0
  });
  const [ticketsGenerated, setTicketsGenerated] = useState(false);
  const [ticketsExist, setTicketsExist] = useState(false);

  useEffect(() => {
    // Загружаем сохраненные данные
    const saved = localStorage.getItem('exam_setup');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.subjectId) {
          setSubjectId(data.subjectId);
          setSubjectName(data.subjectName || '');
          setSubjectType(data.subjectType || 'exam');
          // Загружаем название из API, если не сохранено
          if (!data.subjectName) {
            axios.get(`${API_URL}/subjects`).then(res => {
              const subject = res.data.find(s => s.id === data.subjectId);
              if (subject) {
                setSubjectName(subject.name);
                setSubjectType(subject.type);
              }
            }).catch(() => {});
          }
          setStep(2); // Переходим к вопросам
        }
        if (data.groupId) {
          setGroupId(data.groupId);
          setGroupName(data.groupName || '');
          // Загружаем название из API, если не сохранено
          if (!data.groupName) {
            axios.get(`${API_URL}/groups`).then(res => {
              const group = res.data.find(g => g.id === data.groupId);
              if (group) {
                setGroupName(group.name);
              }
            }).catch(() => {});
          }
          if (data.subjectId) {
            setStep(4); // Переходим к курсантам
          } else {
            setStep(3); // Переходим к созданию группы
          }
        }
        if (data.config) {
          setConfig({
            ticketCount: data.config.ticketCount || 20,
            questionsPerTicket: data.config.questionsPerTicket || 2,
            hasPracticalTasks: data.config.hasPracticalTasks !== undefined ? data.config.hasPracticalTasks : true,
            practicalTasksCount: data.config.practicalTasksCount || 1,
            hasSections: data.config.hasSections || false,
            sectionBoundary: data.config.sectionBoundary || 0
          });
        }
        if (data.ticketsGenerated) {
          setTicketsGenerated(true);
          setStep(7); // Переходим к финальному шагу
        }
      } catch (e) {
        console.error('Ошибка загрузки сохраненных данных:', e);
      }
    }
  }, []);

  const saveProgress = useCallback(() => {
    localStorage.setItem('exam_setup', JSON.stringify({
      subjectId,
      subjectName,
      subjectType,
      groupId,
      groupName,
      config,
      ticketsGenerated
    }));
    // Также сохраняем для обратной совместимости
    if (groupId) {
      localStorage.setItem('exam_selected_group', groupId);
    }
    if (subjectId) {
      localStorage.setItem('exam_selected_subject', subjectId);
    }
  }, [subjectId, subjectName, subjectType, groupId, groupName, config, ticketsGenerated]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(''), 3000);
  };

  // Полный сброс всех данных
  const handleResetAll = async () => {
    if (!window.confirm('Вы уверены, что хотите сбросить все данные? Это действие нельзя отменить!')) {
      return;
    }

    setLoading(true);
    try {
      // Удаляем все данные из базы
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
      
      // Сбрасываем все состояние
      setStep(1);
      setSubjectName('');
      setSubjectType('exam');
      setSubjectId(null);
      setQuestions([]);
      setGroupName('');
      setGroupId(null);
      setStudents([]);
      setNewStudent({ full_name: '' });
      setConfig({ 
        ticketCount: 20, 
        questionsPerTicket: 2,
        hasPracticalTasks: true,
        practicalTasksCount: 1,
        hasSections: false,
        sectionBoundary: 0
      });
      setTicketsGenerated(false);
      
      showMessage('Все данные успешно сброшены', 'success');
      
      // Перезагружаем страницу через небольшую задержку
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Ошибка сброса:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Ошибка сброса данных';
      if (error.response?.status === 503) {
        showMessage('База данных еще не готова. Подождите несколько секунд и попробуйте снова.', 'error');
      } else {
        showMessage(errorMessage, 'error');
      }
      setLoading(false);
    }
  };

  // Шаг 1: Ввод данных дисциплины (без создания в БД)
  const handleNextToQuestions = () => {
    if (!subjectName.trim()) {
      showMessage('Введите название дисциплины', 'error');
      return;
    }
    setSubjectName(subjectName.trim());
    saveProgress();
    setStep(2);
  };

  // Шаг 2: Загрузка вопросов (создаем дисциплину автоматически при первой загрузке)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      showMessage('Пожалуйста, загрузите TXT файл', 'error');
      return;
    }

    if (!subjectName.trim()) {
      showMessage('Сначала введите название дисциплины', 'error');
      return;
    }

    setLoading(true);
    
    try {
      let currentSubjectId = subjectId;
      
      // Создаем дисциплину, если еще не создана
      if (!currentSubjectId) {
        try {
          // Сначала пытаемся найти существующую дисциплину
          const existingSubjects = await axios.get(`${API_URL}/subjects`);
          const existing = existingSubjects.data.find(s => s.name === subjectName.trim());
          
          if (existing) {
            // Используем существующую дисциплину
            currentSubjectId = existing.id;
            setSubjectId(currentSubjectId);
            saveProgress();
          } else {
            // Создаем новую дисциплину
            const subjectResponse = await axios.post(`${API_URL}/subjects`, {
              name: subjectName.trim(),
              type: subjectType,
              description: ''
            });
            currentSubjectId = subjectResponse.data.id;
            setSubjectId(currentSubjectId);
            saveProgress();
          }
        } catch (subjectError) {
          console.error('Ошибка создания/поиска дисциплины:', subjectError);
          const errorMsg = subjectError.response?.data?.error || subjectError.message || 'Ошибка создания дисциплины';
          showMessage(errorMsg, 'error');
          setLoading(false);
          e.target.value = '';
          return;
        }
      }

      if (!currentSubjectId) {
        showMessage('Не удалось получить ID дисциплины', 'error');
        setLoading(false);
        e.target.value = '';
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('subject_id', currentSubjectId);

      await axios.post(`${API_URL}/questions/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Загружаем вопросы с правильным ID (передаем currentSubjectId напрямую)
      await loadQuestions(currentSubjectId);
      showMessage('Вопросы успешно загружены');
    } catch (error) {
      console.error('Ошибка загрузки файла:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Ошибка загрузки файла';
      showMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const loadQuestions = useCallback(async (overrideSubjectId = null) => {
    const idToUse = overrideSubjectId || subjectId;
    if (!idToUse) return;
    try {
      const response = await axios.get(`${API_URL}/questions`, {
        params: { subject_id: idToUse }
      });
      setQuestions(response.data);
    } catch (error) {
      showMessage('Ошибка загрузки вопросов', 'error');
    }
  }, [subjectId]);

  useEffect(() => {
    if (step === 2 && subjectId) {
      loadQuestions();
    }
  }, [step, subjectId, loadQuestions]);

  // Шаг 3: Ввод данных группы (без создания в БД)
  const handleNextToStudents = () => {
    if (!groupName.trim()) {
      showMessage('Введите название группы', 'error');
      return;
    }
    setGroupName(groupName.trim());
    saveProgress();
    setStep(4);
  };

  // Шаг 4: Добавление курсантов
  const loadStudents = useCallback(async () => {
    if (!groupId) return;
    try {
      const response = await axios.get(`${API_URL}/groups/${groupId}/students`);
      setStudents(response.data);
    } catch (error) {
      showMessage('Ошибка загрузки курсантов', 'error');
    }
  }, [groupId]);

  useEffect(() => {
    if (step === 4) {
      // Если группа еще не создана, но название есть, создаем её
      if (!groupId && groupName.trim()) {
        const createGroup = async () => {
          try {
            const groupResponse = await axios.post(`${API_URL}/groups`, {
              name: groupName.trim(),
              description: ''
            });
            setGroupId(groupResponse.data.id);
            saveProgress();
            loadStudents();
          } catch (error) {
            console.error('Ошибка создания группы:', error);
          }
        };
        createGroup();
      } else if (groupId) {
        loadStudents();
      }
    }
  }, [step, groupId, groupName, loadStudents, saveProgress]);

  const handleAddStudent = async () => {
    if (!newStudent.full_name.trim()) {
      showMessage('Введите ФИО курсанта', 'error');
      return;
    }

    if (!groupName.trim()) {
      showMessage('Сначала введите название группы', 'error');
      return;
    }

    setLoading(true);
    try {
      let currentGroupId = groupId;
      
      // Создаем группу, если еще не создана
      if (!currentGroupId) {
        try {
          const groupResponse = await axios.post(`${API_URL}/groups`, {
            name: groupName.trim(),
            description: ''
          });
          currentGroupId = groupResponse.data.id;
          setGroupId(currentGroupId);
          saveProgress();
        } catch (groupError) {
          console.error('Ошибка создания группы:', groupError);
          showMessage(groupError.response?.data?.error || 'Ошибка создания группы', 'error');
          setLoading(false);
          return;
        }
      }

      if (!currentGroupId) {
        showMessage('Не удалось получить ID группы', 'error');
        setLoading(false);
        return;
      }

      // Генерируем логин и пароль автоматически
      const username = generateUsername(newStudent.full_name);
      const password = generatePassword(8);

      await axios.post(`${API_URL}/users`, {
        username,
        password,
        role: 'student',
        full_name: newStudent.full_name.trim(),
        group_id: currentGroupId
      });
      
      setNewStudent({ full_name: '' });
      loadStudents();
      showMessage('Курсант добавлен');
    } catch (error) {
      console.error('Ошибка добавления курсанта:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Ошибка добавления курсанта';
      showMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportStudents = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      showMessage('Пожалуйста, загрузите TXT файл', 'error');
      return;
    }

    if (!groupName.trim()) {
      showMessage('Сначала введите название группы', 'error');
      return;
    }

    setLoading(true);
    try {
      // Создаем группу, если еще не создана
      if (!groupId) {
        const groupResponse = await axios.post(`${API_URL}/groups`, {
          name: groupName.trim(),
          description: ''
        });
        setGroupId(groupResponse.data.id);
        saveProgress();
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('group_id', groupId);

      const response = await axios.post(`${API_URL}/users/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      loadStudents();
      // Сервер возвращает created и errors как числа, а массивы в details
      const successCount = response.data.created || (response.data.details?.created?.length || 0);
      const errorCount = response.data.errors || (response.data.details?.errors?.length || 0);
      if (errorCount > 0) {
        showMessage(`Импортировано ${successCount} курсантов. Ошибок: ${errorCount}`, 'error');
      } else {
        showMessage(`Успешно импортировано ${successCount} курсантов`);
      }
    } catch (error) {
      console.error('Ошибка импорта:', error);
      showMessage(error.response?.data?.error || 'Ошибка импорта курсантов', 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const generateUsername = (fullName) => {
    const parts = fullName.toLowerCase().split(' ').filter(p => p);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1]).substring(0, 10) + Math.floor(Math.random() * 100);
    }
    return parts[0].substring(0, 10) + Math.floor(Math.random() * 1000);
  };

  const generatePassword = (length = 8) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Проверка наличия билетов в базе данных
  const checkTicketsExist = useCallback(async () => {
    if (!subjectId || !groupId) return false;
    try {
      const response = await axios.get(`${API_URL}/tickets`, {
        params: {
          group_id: groupId,
          subject_id: subjectId
        }
      });
      return response.data && response.data.length > 0;
    } catch (error) {
      console.error('Ошибка проверки билетов:', error);
      return false;
    }
  }, [subjectId, groupId]);

  // Проверяем наличие билетов при переходе на шаг 6
  useEffect(() => {
    if (step === 6 && subjectId && groupId) {
      checkTicketsExist().then(exist => {
        setTicketsExist(exist);
        if (exist) {
          setTicketsGenerated(true);
        }
      });
    }
  }, [step, subjectId, groupId, checkTicketsExist]);

  // Шаг 5: Конфигурация билетов
  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/config`, config);
      saveProgress();
      setStep(6);
      showMessage('Конфигурация сохранена');
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка сохранения', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Шаг 6: Генерация билетов (создаем дисциплину и группу, если еще не созданы)
  const handleGenerateTickets = async () => {
    if (!subjectName.trim() || !groupName.trim()) {
      showMessage('Необходимо завершить предыдущие шаги', 'error');
      return;
    }

    if (questions.length === 0) {
      showMessage('Сначала загрузите вопросы', 'error');
      return;
    }

    if (!window.confirm('Сгенерировать билеты? Старые билеты будут удалены.')) return;

    setLoading(true);
    try {
      // Создаем дисциплину, если еще не создана
      if (!subjectId) {
        const subjectResponse = await axios.post(`${API_URL}/subjects`, {
          name: subjectName.trim(),
          type: subjectType,
          description: ''
        });
        setSubjectId(subjectResponse.data.id);
      }

      // Создаем группу, если еще не создана
      if (!groupId) {
        const groupResponse = await axios.post(`${API_URL}/groups`, {
          name: groupName.trim(),
          description: ''
        });
        setGroupId(groupResponse.data.id);
      }

      // Сохраняем прогресс перед генерацией
      saveProgress();

      await axios.post(`${API_URL}/tickets/generate`, {
        session: {
          group_id: groupId,
          subject_id: subjectId
        },
        config: {
          ticketCount: config.ticketCount,
          questionsPerTicket: config.questionsPerTicket,
          hasPracticalTasks: config.hasPracticalTasks || false,
          practicalTasksCount: config.practicalTasksCount || 1,
          hasSections: config.hasSections || false,
          sectionBoundary: config.sectionBoundary || 0
        }
      });
      setTicketsGenerated(true);
      saveProgress();
      showMessage('Билеты успешно сгенерированы');
    } catch (error) {
      showMessage(error.response?.data?.error || 'Ошибка генерации билетов', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = () => {
    // Сохраняем данные для режима сдачи
    localStorage.setItem('exam_selected_group', groupId);
    localStorage.setItem('exam_selected_subject', subjectId);
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <div className="setup-wizard">
      <div className="wizard-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0 }}>Настройка экзамена</h1>
          <button
            onClick={handleResetAll}
            className="btn btn-danger"
            disabled={loading}
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '2px solid rgba(239, 68, 68, 0.5)',
              color: '#fca5a5',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                e.target.style.borderColor = 'rgba(239, 68, 68, 0.7)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
              }
            }}
            title="Сбросить все данные и начать заново"
          >
            🔄 Сбросить все
          </button>
        </div>
        <div className="wizard-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`} title="1. Дисциплина">1. Дисциплина</div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`} title="2. Вопросы">2. Вопросы</div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`} title="3. Группа">3. Группа</div>
          <div className={`progress-step ${step >= 4 ? 'active' : ''}`} title="4. Курсанты">4. Курсанты</div>
          <div className={`progress-step ${step >= 5 ? 'active' : ''}`} title="5. Конфигурация">5. Конфиг</div>
          <div className={`progress-step ${step >= 6 ? 'active' : ''}`} title="6. Билеты">6. Билеты</div>
          <div className={`progress-step ${step >= 7 ? 'active' : ''}`} title="7. Готово">7. Готово</div>
        </div>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="wizard-content">
        {/* Шаг 1: Дисциплина */}
        {step === 1 && (
          <div className="wizard-step">
            <h2>Шаг 1: Ввод данных дисциплины</h2>
            <div className="form-group">
              <label>Название дисциплины:</label>
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Например: Математика"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Тип:</label>
              <select
                value={subjectType}
                onChange={(e) => setSubjectType(e.target.value)}
                className="form-input"
              >
                <option value="exam">Экзамен</option>
                <option value="test">Зачет</option>
              </select>
            </div>
            <button
              onClick={handleNextToQuestions}
              className="btn btn-primary"
              disabled={!subjectName.trim()}
            >
              Продолжить
            </button>
          </div>
        )}

        {/* Шаг 2: Вопросы */}
        {step === 2 && (
          <div className="wizard-step">
            <h2>Шаг 2: Загрузка вопросов</h2>
            <p className="step-info">Дисциплина: <strong>{subjectName}</strong></p>
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
                Загрузите TXT файл, где каждый вопрос находится на отдельной строке.
              </p>
            </div>
            {questions.length > 0 && (
              <div className="questions-preview">
                <p>Загружено вопросов: <strong>{questions.length}</strong></p>
                <button
                  onClick={() => setStep(3)}
                  className="btn btn-primary"
                >
                  Продолжить
                </button>
              </div>
            )}
          </div>
        )}

        {/* Шаг 3: Группа */}
        {step === 3 && (
          <div className="wizard-step">
            <h2>Шаг 3: Ввод данных группы</h2>
            <div className="form-group">
              <label>Название группы:</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Например: Группа 1"
                className="form-input"
              />
            </div>
            <button
              onClick={handleNextToStudents}
              className="btn btn-primary"
              disabled={!groupName.trim()}
            >
              Продолжить
            </button>
          </div>
        )}

        {/* Шаг 4: Курсанты */}
        {step === 4 && (
          <div className="wizard-step">
            <h2>Шаг 4: Добавление курсантов</h2>
            <p className="step-info">Группа: <strong>{groupName}</strong></p>
            <div className="add-student-form">
              <div className="form-row" style={{ display: 'flex', gap: '15px', alignItems: 'end' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>ФИО курсанта:</label>
                  <input
                    type="text"
                    value={newStudent.full_name}
                    onChange={(e) => setNewStudent({ full_name: e.target.value })}
                    placeholder="Иванов Иван Иванович"
                    className="form-input"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newStudent.full_name.trim()) {
                        handleAddStudent();
                      }
                    }}
                  />
                </div>
                <button
                  onClick={handleAddStudent}
                  className="btn btn-primary"
                  disabled={loading || !newStudent.full_name.trim()}
                >
                  {loading ? 'Добавление...' : 'Добавить'}
                </button>
              </div>
              <p className="help-text" style={{ marginTop: '10px', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                Логин и пароль будут сгенерированы автоматически
              </p>
              
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(129, 140, 248, 0.3)' }}>
                <label className="file-upload-label" style={{ display: 'block' }}>
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleImportStudents}
                    disabled={loading}
                    className="file-input"
                  />
                  <span className="file-upload-button" style={{ display: 'inline-block' }}>
                    {loading ? 'Импорт...' : '📁 Импорт курсантов из TXT файла'}
                  </span>
                </label>
                <p className="help-text" style={{ marginTop: '10px', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                  Формат файла: каждая строка содержит ФИО курсанта. Например:<br/>
                  <code style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                    Иванов Иван Иванович<br/>
                    Петров Петр Петрович<br/>
                    Сидоров Сидор Сидорович
                  </code>
                </p>
              </div>
            </div>
            {students.length > 0 && (
              <div className="students-list">
                <h3>Список курсантов ({students.length}):</h3>
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>ФИО</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id}>
                        <td>{student.full_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              onClick={() => setStep(5)}
              className="btn btn-primary"
              disabled={students.length === 0}
            >
              Продолжить ({students.length} курсантов)
            </button>
          </div>
        )}

        {/* Шаг 5: Конфигурация */}
        {step === 5 && (
          <div className="wizard-step">
            <h2>Шаг 5: Конфигурация билетов</h2>
            <div className="config-form">
              <div className="form-group">
                <label>Количество билетов (1-100):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={config.ticketCount}
                  onChange={(e) => setConfig({ ...config, ticketCount: parseInt(e.target.value) || 0 })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Количество теоретических вопросов (1-20):</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={config.questionsPerTicket}
                  onChange={(e) => setConfig({ ...config, questionsPerTicket: parseInt(e.target.value) || 0 })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={config.hasPracticalTasks || false}
                    onChange={(e) => setConfig({ 
                      ...config, 
                      hasPracticalTasks: e.target.checked,
                      practicalTasksCount: e.target.checked ? (config.practicalTasksCount || 1) : 0
                    })}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <span>Есть ли практические задания</span>
                </label>
              </div>
              {config.hasPracticalTasks && (
                <div className="form-group">
                  <label>Количество практических заданий (1-100):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.practicalTasksCount || 1}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= 1 && value <= 100) {
                        setConfig({ 
                          ...config, 
                          practicalTasksCount: value 
                        });
                      }
                    }}
                    className="form-input"
                  />
                  <p className="help-text" style={{ marginTop: '5px', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    В каждом билете будет случайно выбрано одно практическое задание от 1 до {config.practicalTasksCount || 1}
                  </p>
                </div>
              )}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={config.hasSections || false}
                    onChange={(e) => setConfig({ 
                      ...config, 
                      hasSections: e.target.checked,
                      sectionBoundary: e.target.checked ? (config.sectionBoundary || 1) : 0
                    })}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <span>Использовать разделы вопросов</span>
                </label>
              </div>
              {config.hasSections && (
                <div className="form-group">
                  <label>Граница между разделами (n):</label>
                  <input
                    type="number"
                    min="1"
                    value={config.sectionBoundary || 1}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= 1) {
                        setConfig({ 
                          ...config, 
                          sectionBoundary: value 
                        });
                      }
                    }}
                    className="form-input"
                  />
                  <p className="help-text" style={{ marginTop: '5px', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    Раздел 1: вопросы 1 - {config.sectionBoundary || 1}<br/>
                    Раздел 2: вопросы {(config.sectionBoundary || 1) + 1} - {questions.length || '?'}<br/>
                    В билете: 1-й вопрос из раздела 1, 2-й вопрос из раздела 2, и так далее по циклу
                  </p>
                </div>
              )}
              <button
                onClick={handleSaveConfig}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Сохранение...' : 'Сохранить и продолжить'}
              </button>
            </div>
          </div>
        )}

        {/* Шаг 6: Генерация билетов */}
        {step === 6 && (
          <div className="wizard-step">
            <h2>Шаг 6: Генерация билетов</h2>
            <div className="generate-info">
              <p>Дисциплина: <strong>{subjectName}</strong></p>
              <p>Группа: <strong>{groupName}</strong></p>
              <p>Вопросов загружено: <strong>{questions.length}</strong></p>
              <p>Количество билетов: <strong>{config.ticketCount}</strong></p>
              <p>Вопросов в билете: <strong>{config.questionsPerTicket}</strong></p>
              {config.hasPracticalTasks && (
                <p>Практических заданий: <strong>{config.practicalTasksCount}</strong></p>
              )}
              {config.hasSections && (
                <>
                  <p>Разделы вопросов: <strong>Включены</strong></p>
                  <p>Раздел 1: вопросы <strong>1 - {config.sectionBoundary || 1}</strong></p>
                  <p>Раздел 2: вопросы <strong>{(config.sectionBoundary || 1) + 1} - {questions.length}</strong></p>
                </>
              )}
            </div>
            {!ticketsGenerated && !ticketsExist ? (
              <button
                onClick={handleGenerateTickets}
                className="btn btn-success"
                disabled={loading || questions.length === 0}
              >
                {loading ? 'Генерация...' : '🎲 Сгенерировать билеты'}
              </button>
            ) : (
              <div>
                <div style={{ 
                  padding: '20px', 
                  background: 'rgba(34, 211, 153, 0.1)', 
                  borderRadius: '8px',
                  marginBottom: '20px',
                  border: '2px solid rgba(34, 211, 153, 0.3)'
                }}>
                  <p style={{ color: '#34d399', fontSize: '1.1rem', margin: 0 }}>
                    ✅ Билеты {ticketsGenerated ? 'успешно сгенерированы' : 'уже существуют'}!
                  </p>
                </div>
                <button
                  onClick={() => setStep(7)}
                  className="btn btn-success btn-large"
                >
                  ➡️ Продолжить
                </button>
              </div>
            )}
          </div>
        )}

        {/* Шаг 7: Готово */}
        {step === 7 && (
          <div className="wizard-step">
            <h2>✅ Настройка завершена!</h2>
            <div className="completion-info">
              <p>Дисциплина: <strong>{subjectName}</strong></p>
              <p>Группа: <strong>{groupName}</strong></p>
              <p>Курсантов: <strong>{students.length}</strong></p>
              <p>Билетов сгенерировано: <strong>{config.ticketCount}</strong></p>
            </div>
            <button
              onClick={handleStartExam}
              className="btn btn-success btn-large"
            >
              🎓 Начать экзамен
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetupWizard;
