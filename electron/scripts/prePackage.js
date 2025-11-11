const { execSync } = require("child_process");
const { existsSync, mkdirSync, copyFileSync } = require("fs");
const { join, resolve } = require("path");

const ROOT_DIR = resolve(__dirname, "../.."); // electronApp root
const BACKEND_DIR = join(ROOT_DIR, "backend");
const BACKEND_DIST = join(BACKEND_DIR, "dist", "backend.exe");
const BACKEND_SRC = join(BACKEND_DIR, "backend.spec");

// Destination inside electron/node_modules/electron/resources
const ELECTRON_RESOURCES = join(ROOT_DIR, "electron", "dist");
const DEST_FILE = join(ELECTRON_RESOURCES, "backend.exe");

function run() {
  console.log(`🔍 Checking for backend binary at: ${BACKEND_DIST}`);

  if (!existsSync(BACKEND_DIST)) {
    console.log("⚠️ Backend binary not found.");

    if (existsSync(BACKEND_SRC)) {
      console.log(`📦 Found backend.spec at ${BACKEND_SRC}`);
      console.log("➡️  Building with PyInstaller...");

      try {
        execSync("pyinstaller backend.spec", {
          cwd: BACKEND_DIR,
          stdio: "inherit",
        });
      } catch (err) {
        console.error("❌ PyInstaller build failed:", err.message);
        process.exit(1);
      }

      if (!existsSync(BACKEND_DIST)) {
        console.error(`❌ ERROR: PyInstaller did not produce ${BACKEND_DIST}`);
        process.exit(1);
      }
      console.log("✅ Successfully built backend.exe");
    } else {
      console.error("❌ ERROR: Neither back.exe nor backend.spec found.");
      process.exit(1);
    }
  } else {
    console.log("✅ Backend binary found.");
  }

  // Ensure resources folder exists
  mkdirSync(ELECTRON_RESOURCES, { recursive: true });

  // Copy backend.exe into electron resources
  copyFileSync(BACKEND_DIST, DEST_FILE);

  if (existsSync(DEST_FILE)) {
    console.log(`✅ backend.exe is now in ${DEST_FILE}`);
  } else {
    console.error(`❌ ERROR: Failed to copy backend.exe to ${DEST_FILE}`);
    process.exit(1);
  }
}

run();