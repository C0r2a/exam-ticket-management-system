@echo off
chcp 65001 >nul
echo ========================================
echo   ������ ���������� ��������������� �������
echo ========================================
echo.

REM ������� � ������ �������
cd /d "%~dp0\.."

echo ������� ����������: %cd%
echo.

echo �������� ��������� Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [������] Node.js �� ����������!
    echo ���������� Node.js � https://nodejs.org/
    pause
    exit /b 1
)

echo �������� ����� 8000...
netstat -ano | findstr :8000 >nul 2>&1
if %errorlevel% equ 0 (
    echo [��������] ���� 8000 ��� �����!
    echo ������� ��������� �������...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

echo ������ ������� � ��������� ����...
start "������ (���� 8000)" cmd /k "cd /d %cd% && npm start"

timeout /t 3 /nobreak >nul

echo ������ �������...
echo ������ ����� �������� �� http://localhost:3000
echo ������ �������� �� http://localhost:8000
echo.
echo ��� ��������� �������� ��� ���� ��� ������� Ctrl+C
echo.

cd client
npm start
