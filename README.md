# MyApp

A minimal example showing how to build a desktop app using **Electron** for the frontend and **Python (FastAPI)** for the backend.

## Build Instructions

### 1. Backend (Python)
```bash
cd backend
pip install -r requirements.txt pyinstaller
pyinstaller --onefile backend.py
```
Then move the resulting `dist/backend.exe` into `electron/dist/backend.exe`.

### 2. Electron App
```bash
cd electron
npm install
npm run package
```

This will build an installer for Windows that includes both Electron and your Python backend.
• 	: runs Vite dev server for your React UI ().
• 	: builds React into .
• 	: compiles your Electron main process and launches it.
• 	: runs both React dev server and Electron together.
• 	: builds both React and Electron for production.
