#!/bin/bash
# Test runner script for ElectronAIChat backend

set -e  # Exit on error

echo "=================================="
echo "ElectronAIChat Backend Test Suite"
echo "=================================="
echo ""

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    echo "❌ pytest not found. Installing test dependencies..."
    pip install -r requirements.txt
fi

# Default: run all tests with coverage
if [ "$1" == "unit" ]; then
    echo "Running unit tests only..."
    pytest tests/unit/ -v --cov=app --cov-report=term-missing
elif [ "$1" == "integration" ]; then
    echo "Running integration tests only..."
    pytest tests/integration/ -v --cov=app --cov-report=term-missing
elif [ "$1" == "quick" ]; then
    echo "Running quick test (no coverage)..."
    pytest --maxfail=1 --disable-warnings -q
elif [ "$1" == "ci" ]; then
    echo "Running CI mode (maxfail=1, no warnings)..."
    pytest --maxfail=1 --disable-warnings -q --cov=app
elif [ "$1" == "coverage" ]; then
    echo "Running tests with HTML coverage report..."
    pytest --cov=app --cov-report=html --cov-report=term-missing
    echo ""
    echo "✅ Coverage report generated at htmlcov/index.html"
else
    echo "Running all tests with coverage..."
    pytest -v --cov=app --cov-report=term-missing
fi

echo ""
echo "✅ Tests completed successfully!"
