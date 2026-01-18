@echo off
chcp 65001 >nul
echo ========================================
echo   Подготовка проекта для автономного развертывания
echo ========================================
echo.

cd /d "%~dp0\.."

echo [1/4] Проверка установки Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не установлен!
    echo Установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js установлен

echo.
echo [2/4] Установка зависимостей...
call npm install
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить зависимости сервера!
    pause
    exit /b 1
)

cd client
call npm install
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить зависимости клиента!
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Зависимости установлены

echo.
echo [3/4] Сборка клиента...
call npm run build
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось собрать клиент!
    pause
    exit /b 1
)
echo [OK] Клиент собран

echo.
echo [4/4] Проверка структуры проекта...
if not exist "client\build" (
    echo [ОШИБКА] Папка client\build не найдена!
    pause
    exit /b 1
)
if not exist "node_modules" (
    echo [ОШИБКА] Папка node_modules не найдена!
    pause
    exit /b 1
)
if not exist "client\node_modules" (
    echo [ОШИБКА] Папка client\node_modules не найдена!
    pause
    exit /b 1
)
echo [OK] Структура проекта корректна

echo.
echo ========================================
echo   ✅ Проект готов к переносу!
echo ========================================
echo.
echo Что нужно скопировать:
echo   - Всю папку проекта (включая node_modules)
echo   - Или только исходные файлы + client\build (см. OFFLINE_DEPLOYMENT.md)
echo.
echo Размер проекта:
for /f "tokens=3" %%a in ('dir /s /-c ^| find "bytes"') do set size=%%a
echo   - С node_modules: ~300-500 МБ
echo   - Без node_modules: ~50-100 МБ
echo.
echo Инструкции по развертыванию см. в файле OFFLINE_DEPLOYMENT.md
echo.
pause


