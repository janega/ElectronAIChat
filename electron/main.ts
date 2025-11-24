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
async function waitForHealth(url: string | URL | Request, timeoutMs = 30000, intervalMs = 500) {
  const start = Date.now();
  let attempts = 0;
  
  console.log(`⏳ Waiting for backend to start (timeout: ${timeoutMs/1000}s)...`);
  console.log(`   Note: First startup may take longer (database initialization, model loading)`);
  
  while (true) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`✅ Backend health check passed after ${elapsed}s (${attempts + 1} attempts)`);
        
        // Check for startup warnings
        try {
          const healthData = await res.json();
          const startupValidation = healthData?.components?.startup_validation;
          
          if (startupValidation && !startupValidation.passed) {
            console.warn('⚠️ Backend started with warnings:');
            startupValidation.warnings.forEach((warning: any) => {
              console.warn(`  • [${warning.component}] ${warning.message}`);
              console.warn(`    → ${warning.suggestion}`);
            });
            
            // Show dialog to user (non-blocking)
            const warningMessages = startupValidation.warnings
              .map((w: any) => `• ${w.message}\n  → ${w.suggestion}`)
              .join('\n\n');
            
            dialog.showMessageBox({
              type: 'warning',
              title: 'Backend Configuration Warning',
              message: 'Backend started but some components have issues:',
              detail: warningMessages,
              buttons: ['Continue Anyway', 'Quit'],
              defaultId: 0,
              cancelId: 1
            }).then(result => {
              if (result.response === 1) {
                app.quit();
              }
            });
          }
        } catch (parseError) {
          console.warn('Could not parse health check response for warnings:', parseError);
        }
        
        return;
      }
    } catch {
      attempts++;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      
      // Log progress every 5 seconds with elapsed time
      if (elapsed > 0 && elapsed % 5 === 0 && attempts % 10 === 0) {
        console.log(`⏳ Still waiting... ${elapsed}s elapsed (${attempts} attempts)`);
      }
    }
    
    if (Date.now() - start >= timeoutMs) {
      throw new Error(`Timeout waiting for health endpoint after ${attempts} attempts (${timeoutMs}ms)`);
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

  console.log("Spawning backend:", backendPath);
  backendProcess = spawn(backendPath, [], {
    cwd: path.dirname(backendPath),
    stdio: "ignore",
    windowsHide: true,
  });
  console.log("Spawned backend with pid:", backendProcess.pid);

  // Monitor backend process for crashes
  backendProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Backend exited with code ${code}, signal ${signal}`);
      dialog.showErrorBox(
        'Backend Crashed',
        `The backend process exited unexpectedly (code ${code}). Please restart the application.`
      );
    }
  });

  backendProcess.on('error', (err) => {
    console.error('❌ Backend spawn error:', err);
    dialog.showErrorBox(
      'Backend Error',
      `Failed to start backend: ${err.message}`
    );
  });
}

//
// Stop backend cleanly
//

async function stopBackend() {
  console.log("Stopping backend gracefully...");
  
  // First try graceful shutdown (without /F flag)
  try {
    await execAsync(`taskkill /IM backend.exe /T`);
    console.log("Sent shutdown signal to backend.exe");
    
    // Wait up to 5 seconds for graceful shutdown
    const maxWait = 5000;
    const startTime = Date.now();
    let processExists = true;
    
    while (processExists && (Date.now() - startTime) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        // Check if process still exists
        await execAsync(`tasklist /FI "IMAGENAME eq backend.exe"`);
        // If we get here, process might still exist (tasklist doesn't error)
        // Check the output more carefully
        const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq backend.exe" /NH`);
        processExists = stdout.includes("backend.exe");
      } catch {
        processExists = false;
      }
    }
    
    if (!processExists) {
      console.log("✅ Backend stopped gracefully");
      return;
    } else {
      console.warn("⚠️ Backend didn't stop gracefully, forcing shutdown...");
    }
  } catch (err: any) {
    if (err.code === 128 || /not found/i.test(err.stderr)) {
      console.log("No backend.exe process found");
      return;
    }
    console.warn("Graceful shutdown failed, trying force kill...", err.message);
  }
  
  // Force kill if graceful shutdown failed
  let found;
  do {
    try {
      await execAsync(`taskkill /IM backend.exe /T /F`);
      console.log("Force killed backend.exe");
      found = true;
    } catch (err: any) {
      if (err.code === 128 || /not found/i.test(err.stderr)) {
        console.log("No more backend.exe processes found");
        found = false;
      } else {
        console.error("Error force killing backend.exe:", err);
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

  console.log('🔍 Environment check:', {
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    execPath: process.execPath,
    cwd: process.cwd()
  });

  if (app.isPackaged){  
    // Production: Start backend and wait for health check
    console.log('📦 Running in PACKAGED mode');
    startBackend();
    
    try {
      await waitForHealth("http://127.0.0.1:8000/api/health", 30000);
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
  } else {
    // Development: Assume backend is manually started, launch window immediately
    console.log("🔧 Running in DEVELOPMENT mode: Skipping backend startup (start manually)");
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", stopBackend);