import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import SetupWizard from './components/SetupWizard';
import TicketSelection from './components/TicketSelection';

const API_URL = process.env.REACT_APP_API_URL || '/api';

function App() {
  // Инициализируем состояние с проверкой сохраненных данных
  const [mode, setMode] = useState('setup');
  const [setupComplete, setSetupComplete] = useState(false);
  const [checking, setChecking] = useState(true);

  // Проверяем состояние экзамена при загрузке
  useEffect(() => {
    const checkExamState = async () => {
      try {
        const saved = localStorage.getItem('exam_setup');
        if (saved) {
          try {
            const data = JSON.parse(saved);
            if (data.ticketsGenerated && data.groupId && data.subjectId) {
              // Проверяем, что билеты действительно существуют в базе
              try {
                // Проверяем все билеты (не только доступные)
                const ticketsResponse = await axios.get(`${API_URL}/tickets`, {
                  params: {
                    group_id: data.groupId,
                    subject_id: data.subjectId
                  }
                });
                
                // Если есть билеты (даже если все использованы), экзамен начат
                if (ticketsResponse.data && ticketsResponse.data.length > 0) {
                  setSetupComplete(true);
                  // Если экзамен начат (билеты сгенерированы), автоматически переключаемся в режим 'exam'
                  // если пользователь явно не выбрал режим 'setup'
                  const savedMode = localStorage.getItem('exam_mode');
                  // Если режим не был явно установлен в 'setup', используем 'exam'
                  setMode(savedMode === 'setup' ? 'setup' : 'exam');
                } else {
                  // Билетов нет - возможно они были удалены, но настройка завершена
                  setSetupComplete(true);
                  const savedMode = localStorage.getItem('exam_mode');
                  setMode(savedMode || 'setup');
                }
              } catch (ticketsError) {
                // Ошибка при проверке билетов - возможно сервер не запущен
                // Но настройка завершена, поэтому показываем режим настройки
                console.warn('Не удалось проверить билеты:', ticketsError);
                setSetupComplete(true);
                // Если сервер недоступен, но настройка была завершена, 
                // предполагаем что экзамен может быть начат
                const savedMode = localStorage.getItem('exam_mode');
                // По умолчанию используем 'exam' если настройка завершена
                setMode(savedMode || 'exam');
              }
            } else {
              // Настройка не завершена
              setSetupComplete(false);
              setMode('setup');
            }
          } catch (e) {
            console.error('Ошибка проверки настройки:', e);
            setSetupComplete(false);
            setMode('setup');
          }
        } else {
          // Нет сохраненных данных
          setSetupComplete(false);
          setMode('setup');
        }
      } catch (error) {
        console.error('Ошибка проверки состояния экзамена:', error);
        setSetupComplete(false);
        setMode('setup');
      } finally {
        setChecking(false);
      }
    };

    checkExamState();
  }, []);

  // Сохраняем режим при изменении
  useEffect(() => {
    if (!checking) {
      localStorage.setItem('exam_mode', mode);
    }
  }, [mode, checking]);

  const handleSetupComplete = () => {
    setSetupComplete(true);
    setMode('exam');
    localStorage.setItem('exam_mode', 'exam');
  };

  if (checking) {
    return (
      <div className="App">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          color: '#e0e7ff'
        }}>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="header-left">
            <img 
              src="/images/logo.png" 
              alt="Логотип" 
              className="header-logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <h1>Система управления экзаменационными билетами</h1>
          </div>
          {setupComplete && (
            <div className="mode-switcher">
              <button 
                className={`mode-btn ${mode === 'setup' ? 'active' : ''}`}
                onClick={() => setMode('setup')}
              >
                ⚙️ Настройка
              </button>
              <button 
                className={`mode-btn ${mode === 'exam' ? 'active' : ''}`}
                onClick={() => setMode('exam')}
              >
                🎓 Сдача
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="App-main">
        {mode === 'setup' ? (
          <SetupWizard onComplete={handleSetupComplete} />
        ) : (
          <TicketSelection />
        )}
      </main>
    </div>
  );
}

export default App; 