@echo off
REM Test runner script for ElectronAIChat backend (Windows)

echo ==================================
echo ElectronAIChat Backend Test Suite
echo ==================================
echo.

REM Check if pytest is installed
where pytest >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo pytest not found. Installing test dependencies...
    pip install -r requirements.txt
)

REM Parse command line argument
if "%1"=="unit" (
    echo Running unit tests only...
    pytest tests/unit/ -v --cov=app --cov-report=term-missing
) else if "%1"=="integration" (
    echo Running integration tests only...
    pytest tests/integration/ -v --cov=app --cov-report=term-missing
) else if "%1"=="quick" (
    echo Running quick test no coverage...
    pytest --maxfail=1 --disable-warnings -q
) else if "%1"=="ci" (
    echo Running CI mode maxfail=1, no warnings...
    pytest --maxfail=1 --disable-warnings -q --cov=app
) else if "%1"=="coverage" (
    echo Running tests with HTML coverage report...
    pytest --cov=app --cov-report=html --cov-report=term-missing
    echo.
    echo Coverage report generated at htmlcov\index.html
    start htmlcov\index.html
) else (
    echo Running all tests with coverage...
    pytest -v --cov=app --cov-report=term-missing
)

echo.
echo Tests completed successfully!
