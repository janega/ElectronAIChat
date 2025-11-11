export interface IElectronAPI {
    openConfig: () => Promise<void>;
    openChat: () => Promise<void>;
    setTheme: (theme: 'light' | 'dark') => void;
}

declare global {
    interface Window {
        electron: IElectronAPI;
    }
}