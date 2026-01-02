"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    openFile: () => electron_1.ipcRenderer.invoke('dialog:openFile'),
    openDirectory: () => electron_1.ipcRenderer.invoke('dialog:openDirectory'),
    readFile: (filePath) => electron_1.ipcRenderer.invoke('fs:readFile', filePath),
    compileTikZ: (code) => electron_1.ipcRenderer.invoke('tikz:compile', code),
    getSettings: () => electron_1.ipcRenderer.invoke('settings:get'),
    setSettings: (settings) => electron_1.ipcRenderer.invoke('settings:set', settings),
    clearTikZCache: () => electron_1.ipcRenderer.invoke('tikz:clear-cache'),
    writeFile: (filePath, content) => electron_1.ipcRenderer.invoke('fs:writeFile', filePath, content),
    exists: (filePath) => electron_1.ipcRenderer.invoke('fs:exists', filePath),
    getPath: (name) => electron_1.ipcRenderer.invoke('app:get-path', name),
    watchFile: (filePath) => electron_1.ipcRenderer.invoke('fs:watch-file', filePath),
    onFileChanged: (callback) => {
        electron_1.ipcRenderer.on('fs:file-changed', (_event, filePath) => callback(filePath));
    },
    listSnippets: () => electron_1.ipcRenderer.invoke('snippets:list'),
    saveSnippet: (name, paths) => electron_1.ipcRenderer.invoke('snippets:save', name, paths),
    deleteSnippet: (id) => electron_1.ipcRenderer.invoke('snippets:delete', id),
    getSnippet: (id) => electron_1.ipcRenderer.invoke('snippets:get', id),
    // Remote Control
    startRemoteServer: () => electron_1.ipcRenderer.invoke('remote:start'),
    stopRemoteServer: () => electron_1.ipcRenderer.invoke('remote:stop'),
    updateRemoteState: (state) => electron_1.ipcRenderer.invoke('remote:update-state', state),
    onRemoteCommand: (callback) => {
        const handler = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('remote-command', handler);
        return () => electron_1.ipcRenderer.removeListener('remote-command', handler);
    },
    onCloseRequest: (callback) => {
        electron_1.ipcRenderer.on('app-close-request', () => callback());
    },
    removeAllCloseListeners: () => electron_1.ipcRenderer.removeAllListeners('app-close-request'),
    quitApp: () => electron_1.ipcRenderer.invoke('app:quit')
});
