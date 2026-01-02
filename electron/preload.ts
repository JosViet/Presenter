import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    compileTikZ: (code: string) => ipcRenderer.invoke('tikz:compile', code),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    setSettings: (settings: any) => ipcRenderer.invoke('settings:set', settings),
    clearTikZCache: () => ipcRenderer.invoke('tikz:clear-cache'),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    exists: (filePath: string) => ipcRenderer.invoke('fs:exists', filePath),
    getPath: (name: string) => ipcRenderer.invoke('app:get-path', name),
    watchFile: (filePath: string) => ipcRenderer.invoke('fs:watch-file', filePath),
    onFileChanged: (callback: (filePath: string) => void) => {
        ipcRenderer.on('fs:file-changed', (_event, filePath) => callback(filePath));
    },
    listSnippets: () => ipcRenderer.invoke('snippets:list'),
    saveSnippet: (name: string, paths: any[]) => ipcRenderer.invoke('snippets:save', name, paths),
    deleteSnippet: (id: string) => ipcRenderer.invoke('snippets:delete', id),
    getSnippet: (id: string) => ipcRenderer.invoke('snippets:get', id),

    // Remote Control
    startRemoteServer: () => ipcRenderer.invoke('remote:start'),
    stopRemoteServer: () => ipcRenderer.invoke('remote:stop'),
    updateRemoteState: (state: any) => ipcRenderer.invoke('remote:update-state', state),
    onRemoteCommand: (callback: (data: any) => void) => {
        const handler = (_event: any, data: any) => callback(data);
        ipcRenderer.on('remote-command', handler);
        return () => ipcRenderer.removeListener('remote-command', handler);
    },
    onCloseRequest: (callback: () => void) => {
        ipcRenderer.on('app-close-request', () => callback());
    },
    removeAllCloseListeners: () => ipcRenderer.removeAllListeners('app-close-request'),
    quitApp: () => ipcRenderer.invoke('app:quit')
});
