export interface ElectronAPI {
    openFile: () => Promise<string | null>;
    openDirectory: () => Promise<string | null>;
    readFile: (path: string) => Promise<string>;
    compileTikZ: (code: string) => Promise<{ success: boolean; svgPath?: string; error?: string }>;
    getSettings: () => Promise<any>;
    setSettings: (settings: any) => Promise<any>;
    clearTikZCache: () => Promise<void>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    exists: (filePath: string) => Promise<boolean>;
    getPath: (name: string) => Promise<string>;
    watchFile: (filePath: string) => Promise<void>;
    onFileChanged: (callback: (filePath: string) => void) => void;
    listSnippets: () => Promise<any[]>;
    saveSnippet: (name: string, paths: any[]) => Promise<any>;
    deleteSnippet: (id: string) => Promise<boolean>;
    getSnippet: (id: string) => Promise<any[]>;

    // Remote Control
    startRemoteServer: () => Promise<{ ip: string; port: number; url: string; pin: string }>;
    stopRemoteServer: () => Promise<void>;
    updateRemoteState: (state: any) => Promise<void>;
    onRemoteCommand: (callback: (data: any) => void) => () => void;

    onCloseRequest: (callback: () => void) => void;
    removeAllCloseListeners: () => void;
    quitApp: () => Promise<void>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
