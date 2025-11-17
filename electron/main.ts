import  { app, BrowserWindow, screen, dialog, nativeTheme, ipcMain } from "electron";
import { ChildProcess, spawn } from "child_process";
import path from "path";
import { exec } from "child_process";
import util from "util";
const execAsync = util.promisify(exec)

let mainWindow: BrowserWindow | null;
let backendProcess: ChildProcess;

//
// Ensure only one Electron instance runs
//
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

//
// Create the main window
//
function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  nativeTheme.themeSource = 'light'; // Start with light theme by default
  const { width, height } = primaryDisplay.workAreaSize;
  const { width: displayWidth, height: displayHeight } = primaryDisplay.bounds;

  const maxWidth = 600; //  Math.max(displayWidth, 3840);
  const maxHeight = 800; // Math.max(displayHeight, 2160);

  // Icon path - works in both dev and production
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "app", "assets", "icons", "app_icon.ico")
    : path.join(__dirname, "..", "assets", "icons", "app_icon.ico");

  mainWindow = new BrowserWindow({
    width: Math.min(maxWidth, width),
    height: Math.min(maxHeight, height),
    fullscreen: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
    },    
  });

  // Load your frontend
  // mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  if (app.isPackaged) {
  mainWindow.loadFile(path.join(__dirname, "react/index.html"));
} else {
  mainWindow.loadURL("http://localhost:5173");
}

}

//
// Wait for backend health endpoint
//
async function waitForHealth(url: string | URL | Request, timeoutMs = 30000, intervalMs = 300) {
  const start = Date.now();
  while (true) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore until timeout
    }
    if (Date.now() - start >= timeoutMs) {
      throw new Error(`Timeout waiting for health endpoint: ${url}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

//
// Start backend once
//
function startBackend() {
  if (backendProcess && !backendProcess.killed) {
    console.log("Backend already running, skipping spawn");
    return;
  }

  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, "backend.exe")
    : path.join(__dirname, "..","..", "backend", "dist", "backend.exe");

  console.log("Spawning backend...");
  backendProcess = spawn(backendPath, [], {
    cwd: path.dirname(backendPath),
    stdio: "ignore",
    windowsHide: true,
  });
  console.log("Spawned backend with pid:", backendProcess.pid);
}

//
// Stop backend cleanly
//

async function stopBackend() {
  let found;
  do {
    try {
      // Try to kill all backend.exe processes
      await execAsync(`taskkill /IM backend.exe /T /F`);
      console.log("Killed one or more backend.exe processes...");
      found = true;
    } catch (err: any) {
      // taskkill returns error code 128 if no process found
      if (err.code === 128 || /not found/i.test(err.stderr)) {
        console.log("No more backend.exe processes found.");
        found = false;
      } else {
        console.error("Error killing backend.exe:", err);
        found = false;
      }
    }
  } while (found);
}


//
// App lifecycle
//
app.whenReady().then(async () => {
  // Set up IPC listener for theme changes
  ipcMain.on('set-theme', (_event: any, theme: 'light' | 'dark') => {
    nativeTheme.themeSource = theme;
    console.log('Theme changed to:', theme);
  });

  // startBackend();

  try {
    await waitForHealth("http://127.0.0.1:8000/api/health", 100000);
    console.log("✅ Backend is ready, launching window...");
    createWindow();
  } catch (err) {
    console.error("❌ Backend failed to become ready:", err);
    dialog.showErrorBox(
      "Backend Error",
      "Backend failed to start. See console for details."
    );
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", stopBackend);