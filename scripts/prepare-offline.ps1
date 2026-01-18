# Подготовка проекта для автономного развертывания

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Подготовка проекта для автономного развертывания" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

# Проверка Node.js
Write-Host "[1/4] Проверка установки Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js установлен: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ОШИБКА] Node.js не установлен!" -ForegroundColor Red
    Write-Host "Установите Node.js с https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Установка зависимостей сервера
Write-Host ""
Write-Host "[2/4] Установка зависимостей..." -ForegroundColor Yellow
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка установки зависимостей сервера"
    }
    
    Set-Location client
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка установки зависимостей клиента"
    }
    Set-Location ..
    
    Write-Host "[OK] Зависимости установлены" -ForegroundColor Green
} catch {
    Write-Host "[ОШИБКА] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Сборка клиента
Write-Host ""
Write-Host "[3/4] Сборка клиента..." -ForegroundColor Yellow
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка сборки клиента"
    }
    Write-Host "[OK] Клиент собран" -ForegroundColor Green
} catch {
    Write-Host "[ОШИБКА] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Проверка структуры
Write-Host ""
Write-Host "[4/4] Проверка структуры проекта..." -ForegroundColor Yellow
$checks = @(
    @{Path = "client\build"; Name = "client\build"},
    @{Path = "node_modules"; Name = "node_modules"},
    @{Path = "client\node_modules"; Name = "client\node_modules"}
)

$allOk = $true
foreach ($check in $checks) {
    if (Test-Path $check.Path) {
        Write-Host "[OK] $($check.Name) найден" -ForegroundColor Green
    } else {
        Write-Host "[ОШИБКА] $($check.Name) не найден!" -ForegroundColor Red
        $allOk = $false
    }
}

if (-not $allOk) {
    exit 1
}

# Подсчет размера
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ Проект готов к переносу!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Что нужно скопировать:" -ForegroundColor Yellow
Write-Host "  - Всю папку проекта (включая node_modules)" -ForegroundColor White
Write-Host "  - Или только исходные файлы + client\build (см. OFFLINE_DEPLOYMENT.md)" -ForegroundColor White
Write-Host ""
Write-Host "Размер проекта:" -ForegroundColor Yellow
Write-Host "  - С node_modules: ~300-500 МБ" -ForegroundColor White
Write-Host "  - Без node_modules: ~50-100 МБ" -ForegroundColor White
Write-Host ""
Write-Host "Инструкции по развертыванию см. в файле OFFLINE_DEPLOYMENT.md" -ForegroundColor Cyan
Write-Host ""


