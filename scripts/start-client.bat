@echo off
chcp 65001 >nul
echo ========================================
echo   Запуск клиента экзаменационных билетов
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

echo Запуск клиента...
echo Клиент будет доступен на http://localhost:3000
echo.
echo Для остановки нажмите Ctrl+C
echo.

npm run client

if %errorlevel% neq 0 (
    echo.
    echo [ОШИБКА] Не удалось запустить клиент!
    echo Проверьте, что все зависимости установлены: npm install
    pause
)




