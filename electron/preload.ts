// import { contextBridge, ipcRenderer } from 'electron';
// import { IElectronAPI } from '../electron/src/types/electron';

// // Expose navigation functions to renderer
// const electronAPI: IElectronAPI = {
//     openConfig: () => ipcRenderer.invoke('open-config'),
//     openChat: () => ipcRenderer.invoke('open-chat'),
//     setTheme: (theme: 'light' | 'dark') => ipcRenderer.send('set-theme', theme),
// };

// contextBridge.exposeInMainWorld('electron', electronAPI);

// // Listen for navigation events
// ipcRenderer.on('navigate', (_, path: string) => {
//     window.location.hash = path;
// });

// contextBridge.exposeInMainWorld('electron', {
//   setTheme: (theme: 'light' | 'dark') => {
//     ipcRenderer.send('set-theme', theme);
//   },
// });