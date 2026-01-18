# Скрипт для автоматического запуска сервера и клиента
# Использование: .\start-all.ps1

$ErrorActionPreference = "Stop"

# Переход в корень проекта
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Запуск приложения экзаменационных билетов" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка Node.js
Write-Host "Проверка установки Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js установлен: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ОШИБКА] Node.js не установлен!" -ForegroundColor Red
    Write-Host "Установите Node.js с https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

# Проверка порта 8000
Write-Host "Проверка порта 8000..." -ForegroundColor Yellow
$port8000 = netstat -ano | Select-String ":8000" | Select-String "LISTENING"
if ($port8000) {
    Write-Host "[ВНИМАНИЕ] Порт 8000 уже занят!" -ForegroundColor Yellow
    Write-Host "Попытка завершить процесс..." -ForegroundColor Yellow
    $port8000 | ForEach-Object {
        $pid = ($_ -split '\s+')[-1]
        if ($pid -match '^\d+$') {
            try {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "✓ Процесс $pid завершен" -ForegroundColor Green
            } catch {
                Write-Host "⚠ Не удалось завершить процесс $pid" -ForegroundColor Yellow
            }
        }
    }
    Start-Sleep -Seconds 2
}

# Запуск сервера в отдельном окне
Write-Host "Запуск сервера в отдельном окне..." -ForegroundColor Yellow
$serverPath = Join-Path $PSScriptRoot "server"
$projectRoot = Split-Path -Parent $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; npm start" -WindowStyle Normal

Start-Sleep -Seconds 3

# Проверка, что сервер запустился
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/groups" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✓ Сервер успешно запущен (статус: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "⚠ Сервер еще запускается, подождите несколько секунд..." -ForegroundColor Yellow
}

# Запуск клиента
Write-Host ""
Write-Host "Запуск клиента..." -ForegroundColor Yellow
Write-Host "Клиент будет доступен на http://localhost:3000" -ForegroundColor Cyan
Write-Host "Сервер доступен на http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Для остановки закройте окно сервера и нажмите Ctrl+C здесь" -ForegroundColor Yellow
Write-Host ""

npm run client




