"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const url_1 = require("url");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const tikz_compiler_1 = require("./tikz-compiler");
const remote_server_1 = require("./remote-server");
// Settings store (simple)
const SETTINGS_FILE = path_1.default.join(electron_1.app.getPath('userData'), 'settings.json');
let settings = { texBinPath: '' };
if (fs_1.default.existsSync(SETTINGS_FILE)) {
    try {
        settings = JSON.parse(fs_1.default.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
    catch (e) {
        console.error(e);
    }
}
function saveSettings() {
    fs_1.default.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}
// Auto-detect MiKTeX
if (!settings.texBinPath) {
    const commonPaths = [
        'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64',
        'C:\\Program Files (x86)\\MiKTeX\\miktex\\bin',
        'C:\\texlive\\2024\\bin\\windows',
        'C:\\texlive\\2023\\bin\\windows'
    ];
    for (const p of commonPaths) {
        if (fs_1.default.existsSync(p)) {
            settings.texBinPath = p;
            saveSettings();
            break;
        }
    }
}
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
// Register privileged schemes before app is ready
electron_1.protocol.registerSchemesAsPrivileged([
    { scheme: 'tikz', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } },
    { scheme: 'media', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true, stream: true } }
]);
const createWindow = () => {
    // Create the browser window.
    // Register custom protocol for TikZ images
    electron_1.protocol.handle('tikz', (request) => {
        const url = request.url.replace('tikz://', '');
        const cacheDir = path_1.default.join(electron_1.app.getPath('userData'), 'tikz_cache');
        // Prevent directory traversal
        const safePath = path_1.default.normalize(path_1.default.join(cacheDir, url)).replace(/^(\.\.[\/\\])+/, '');
        try {
            return electron_1.net.fetch((0, url_1.pathToFileURL)(safePath).toString());
        }
        catch (e) {
            console.error("TikZ Protocol Error:", e);
            return new Response("Not found", { status: 404 });
        }
    });
    electron_1.protocol.handle('media', (request) => {
        try {
            const { pathname } = new URL(request.url);
            // On Windows, the pathname for media:///C:/... might be /C:/... or C:/...
            // We need to ensure we get a valid local path.
            let decodedPath = decodeURIComponent(pathname);
            if (process.platform === 'win32' && decodedPath.startsWith('/')) {
                decodedPath = decodedPath.substring(1);
            }
            const fileUrl = (0, url_1.pathToFileURL)(path_1.default.normalize(decodedPath)).toString();
            return electron_1.net.fetch(fileUrl);
        }
        catch (e) {
            console.error("Protocol Error:", e);
            return new Response("File not found", { status: 404 });
        }
    });
    const mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true // Keep security enabled
        },
    });
    // Load the index.html of the app.
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else if (!electron_1.app.isPackaged) {
        // Fallback for dev mode without env var
        mainWindow.loadURL('http://localhost:5180');
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
    mainWindow.setMenuBarVisibility(false);
    // Handle close event to allow for saving check
    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            mainWindow.webContents.send('app-close-request');
        }
    });
};
let isQuitting = false;
electron_1.ipcMain.handle('app:quit', () => {
    isQuitting = true;
    electron_1.app.quit();
});
electron_1.app.on('ready', createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// IPC Handlers
electron_1.ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await electron_1.dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'LaTeX Files', extensions: ['tex'] }]
    });
    if (canceled) {
        return null;
    }
    else {
        return filePaths[0];
    }
});
electron_1.ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await electron_1.dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (canceled) {
        return null;
    }
    else {
        return filePaths[0];
    }
});
electron_1.ipcMain.handle('fs:readFile', async (_event, filePath) => {
    try {
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        return content;
    }
    catch (error) {
        console.error("Error reading file:", error);
        throw error;
    }
});
electron_1.ipcMain.handle('tikz:compile', async (_event, code, preamble = '') => {
    return await (0, tikz_compiler_1.compileTikZ)(code, settings.texBinPath, preamble);
});
electron_1.ipcMain.handle('settings:get', () => settings);
electron_1.ipcMain.handle('settings:set', (_event, newSettings) => {
    settings = { ...settings, ...newSettings };
    saveSettings();
    return settings;
});
electron_1.ipcMain.handle('tikz:clear-cache', async () => {
    return (0, tikz_compiler_1.clearTikZCache)();
});
electron_1.ipcMain.handle('fs:writeFile', async (_event, filePath, content) => {
    try {
        const dir = path_1.default.dirname(filePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(filePath, content, 'utf-8');
        return true;
    }
    catch (error) {
        console.error("Error writing file:", error);
        throw error;
    }
});
electron_1.ipcMain.handle('fs:exists', async (_event, filePath) => {
    return fs_1.default.existsSync(filePath);
});
electron_1.ipcMain.handle('app:get-path', (_event, name) => {
    return electron_1.app.getPath(name);
});
// File Watcher for Hot Reloading
let fileWatcher = null;
electron_1.ipcMain.handle('fs:watch-file', (event, filePath) => {
    if (fileWatcher) {
        fileWatcher.close();
    }
    if (!filePath)
        return;
    fileWatcher = fs_1.default.watch(filePath, (eventType) => {
        if (eventType === 'change') {
            event.sender.send('fs:file-changed', filePath);
        }
    });
});
// Snippet Management Handlers
const SNIPPETS_DIR = path_1.default.join(electron_1.app.getPath('userData'), 'annotation_snippets');
electron_1.ipcMain.handle('snippets:list', async () => {
    try {
        if (!fs_1.default.existsSync(SNIPPETS_DIR)) {
            fs_1.default.mkdirSync(SNIPPETS_DIR, { recursive: true });
            return [];
        }
        const files = fs_1.default.readdirSync(SNIPPETS_DIR);
        const snippets = files
            .filter(f => f.endsWith('.json'))
            .map(f => {
            const fullPath = path_1.default.join(SNIPPETS_DIR, f);
            const stats = fs_1.default.statSync(fullPath);
            const content = JSON.parse(fs_1.default.readFileSync(fullPath, 'utf-8'));
            return {
                id: f.replace('.json', ''),
                name: content.name || f.replace('.json', ''),
                date: stats.mtimeMs,
                path: fullPath
            };
        });
        return snippets.sort((a, b) => b.date - a.date);
    }
    catch (error) {
        console.error("Error listing snippets:", error);
        return [];
    }
});
electron_1.ipcMain.handle('snippets:save', async (_event, name, paths) => {
    try {
        if (!fs_1.default.existsSync(SNIPPETS_DIR)) {
            fs_1.default.mkdirSync(SNIPPETS_DIR, { recursive: true });
        }
        const id = Date.now().toString();
        const filePath = path_1.default.join(SNIPPETS_DIR, `${id}.json`);
        const data = { name, paths };
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return { id, name, date: Date.now(), path: filePath };
    }
    catch (error) {
        console.error("Error saving snippet:", error);
        throw error;
    }
});
electron_1.ipcMain.handle('snippets:delete', async (_event, id) => {
    try {
        const filePath = path_1.default.join(SNIPPETS_DIR, `${id}.json`);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
            return true;
        }
        return false;
    }
    catch (error) {
        console.error("Error deleting snippet:", error);
        throw error;
    }
});
electron_1.ipcMain.handle('snippets:get', async (_event, id) => {
    try {
        const filePath = path_1.default.join(SNIPPETS_DIR, `${id}.json`);
        if (fs_1.default.existsSync(filePath)) {
            const content = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
            return content.paths;
        }
        return null;
    }
    catch (error) {
        console.error("Error getting snippet:", error);
        throw error;
    }
});
// Remote Control Server
let remoteServer = null;
electron_1.ipcMain.handle('remote:start', async (_event) => {
    if (!remoteServer) {
        const mainWindow = electron_1.BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            remoteServer = new remote_server_1.RemoteServer(mainWindow);
        }
        else {
            throw new Error("Main window not found");
        }
    }
    return await remoteServer.start();
});
electron_1.ipcMain.handle('remote:stop', () => {
    if (remoteServer) {
        remoteServer.stop();
        remoteServer = null;
    }
});
electron_1.ipcMain.handle('remote:update-state', (_event, state) => {
    if (remoteServer) {
        remoteServer.updateState(state);
    }
});
