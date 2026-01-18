@echo off
chcp 65001 >nul
echo ========================================
echo   Запуск сервера экзаменационных билетов
echo ========================================
echo.

cd /d "%~dp0\.."

echo Проверка установки Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не установлен!
    echo Установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo Проверка порта 8000...
netstat -ano | findstr :8000 >nul 2>&1
if %errorlevel% equ 0 (
    echo [ВНИМАНИЕ] Порт 8000 уже занят!
    echo Попытка завершить процесс...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

echo Запуск сервера...
echo Сервер будет доступен на http://localhost:8000
echo.
echo Для остановки нажмите Ctrl+C
echo.

npm start

if %errorlevel% neq 0 (
    echo.
    echo [ОШИБКА] Не удалось запустить сервер!
    echo Проверьте, что все зависимости установлены: npm install
    pause
)




