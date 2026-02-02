# Script para verificar diferencias de funcionalidades entre main y develop en Interview.jsx
# Execute: .\verify_interview_features.ps1

Write-Host "=== Verificación de Funcionalidades: Interview.jsx ===" -ForegroundColor Cyan
Write-Host ""

# Verificar rama actual
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Rama actual: $currentBranch" -ForegroundColor Yellow
Write-Host ""

# Lista de funcionalidades clave a verificar
$features = @(
    "tutorialVideoUrl",
    "retakeUsed", 
    "selectedLanguage",
    "showSummary",
    "showRetakeReason",
    "showSatisfactionSurvey",
    "getDefaultQuestions",
    "fetchTutorialVideoUrl",
    "satisfactionRating",
    "retakeReasonText",
    "readyToSubmit",
    "application/status"
)

Write-Host "=== Verificando funcionalidades en DEVELOP ===" -ForegroundColor Green
Write-Host ""

$developFile = "frontend/src/pages/Interview.jsx"
if (Test-Path $developFile) {
    $developContent = Get-Content $developFile -Raw
    foreach ($feature in $features) {
        if ($developContent -match $feature) {
            Write-Host "  ✓ $feature encontrado" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $feature NO encontrado" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  ✗ Archivo no encontrado: $developFile" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Comparación con MAIN ===" -ForegroundColor Cyan
Write-Host ""

# Ver diferencias específicas
Write-Host "Funcionalidades en MAIN pero NO en DEVELOP:" -ForegroundColor Yellow
git diff main develop -- frontend/src/pages/Interview.jsx | Select-String -Pattern "^\-.*(tutorialVideoUrl|retakeUsed|selectedLanguage|showSummary|showRetakeReason|showSatisfactionSurvey|getDefaultQuestions|fetchTutorialVideoUrl)" | Select-Object -First 20

Write-Host ""
Write-Host "Funcionalidades en DEVELOP pero NO en MAIN:" -ForegroundColor Yellow  
git diff main develop -- frontend/src/pages/Interview.jsx | Select-String -Pattern "^\+.*(application/status|step1Completed)" | Select-Object -First 10

Write-Host ""
Write-Host "=== Estadísticas de diferencias ===" -ForegroundColor Cyan
git diff main develop -- frontend/src/pages/Interview.jsx --stat

Write-Host ""
Write-Host "=== Resumen ===" -ForegroundColor Cyan
Write-Host "Si ves funcionalidades listadas como 'NO encontrado', necesitas integrarlas."
Write-Host "Si el diff muestra muchas líneas con '-', significa que main tiene código que develop no tiene."
