import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { clearTikZCache, compileTikZ } from './tikz-compiler';
import { RemoteServer } from './remote-server';

// Settings store (simple)
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
let settings = { texBinPath: '' };
if (fs.existsSync(SETTINGS_FILE)) {
    try {
        settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    } catch (e) { console.error(e); }
}

function saveSettings() {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
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
        if (fs.existsSync(p)) {
            settings.texBinPath = p;
            saveSettings();
            break;
        }
    }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

// Register privileged schemes before app is ready
protocol.registerSchemesAsPrivileged([
    { scheme: 'tikz', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } },
    { scheme: 'media', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true, stream: true } }
]);

const createWindow = () => {
    // Create the browser window.
    // Register custom protocol for TikZ images
    protocol.handle('tikz', (request) => {
        const url = request.url.replace('tikz://', '');
        const cacheDir = path.join(app.getPath('userData'), 'tikz_cache');
        // Prevent directory traversal
        const safePath = path.normalize(path.join(cacheDir, url)).replace(/^(\.\.[\/\\])+/, '');
        try {
            return net.fetch(pathToFileURL(safePath).toString());
        } catch (e) {
            console.error("TikZ Protocol Error:", e);
            return new Response("Not found", { status: 404 });
        }
    });

    protocol.handle('media', (request) => {
        try {
            const { pathname } = new URL(request.url);
            // On Windows, the pathname for media:///C:/... might be /C:/... or C:/...
            // We need to ensure we get a valid local path.
            let decodedPath = decodeURIComponent(pathname);
            if (process.platform === 'win32' && decodedPath.startsWith('/')) {
                decodedPath = decodedPath.substring(1);
            }

            const fileUrl = pathToFileURL(path.normalize(decodedPath)).toString();
            return net.fetch(fileUrl);
        } catch (e) {
            console.error("Protocol Error:", e);
            return new Response("File not found", { status: 404 });
        }
    });

    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true // Keep security enabled
        },
    });

    // Load the index.html of the app.
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else if (!app.isPackaged) {
        // Fallback for dev mode without env var
        mainWindow.loadURL('http://localhost:5180');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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

ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers
ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'LaTeX Files', extensions: ['tex'] }]
    });
    if (canceled) {
        return null;
    } else {
        return filePaths[0];
    }
});

ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (canceled) {
        return null;
    } else {
        return filePaths[0];
    }
});

ipcMain.handle('fs:readFile', async (_event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content;
    } catch (error) {
        console.error("Error reading file:", error);
        throw error;
    }
});

ipcMain.handle('tikz:compile', async (_event, code: string, preamble: string = '') => {
    return await compileTikZ(code, settings.texBinPath, preamble);
});

ipcMain.handle('settings:get', () => settings);

ipcMain.handle('settings:set', (_event, newSettings: any) => {
    settings = { ...settings, ...newSettings };
    saveSettings();
    return settings;
});

ipcMain.handle('tikz:clear-cache', async () => {
    return clearTikZCache();
});

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        return true;
    } catch (error) {
        console.error("Error writing file:", error);
        throw error;
    }
});

ipcMain.handle('fs:exists', async (_event, filePath: string) => {
    return fs.existsSync(filePath);
});

ipcMain.handle('app:get-path', (_event, name: any) => {
    return app.getPath(name);
});

// File Watcher for Hot Reloading
let fileWatcher: fs.FSWatcher | null = null;
ipcMain.handle('fs:watch-file', (event, filePath: string) => {
    if (fileWatcher) {
        fileWatcher.close();
    }

    if (!filePath) return;

    fileWatcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
            event.sender.send('fs:file-changed', filePath);
        }
    });
});

// Snippet Management Handlers
const SNIPPETS_DIR = path.join(app.getPath('userData'), 'annotation_snippets');

ipcMain.handle('snippets:list', async () => {
    try {
        if (!fs.existsSync(SNIPPETS_DIR)) {
            fs.mkdirSync(SNIPPETS_DIR, { recursive: true });
            return [];
        }
        const files = fs.readdirSync(SNIPPETS_DIR);
        const snippets = files
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const fullPath = path.join(SNIPPETS_DIR, f);
                const stats = fs.statSync(fullPath);
                const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
                return {
                    id: f.replace('.json', ''),
                    name: content.name || f.replace('.json', ''),
                    date: stats.mtimeMs,
                    path: fullPath
                };
            });
        return snippets.sort((a, b) => b.date - a.date);
    } catch (error) {
        console.error("Error listing snippets:", error);
        return [];
    }
});

ipcMain.handle('snippets:save', async (_event, name: string, paths: any[]) => {
    try {
        if (!fs.existsSync(SNIPPETS_DIR)) {
            fs.mkdirSync(SNIPPETS_DIR, { recursive: true });
        }
        const id = Date.now().toString();
        const filePath = path.join(SNIPPETS_DIR, `${id}.json`);
        const data = { name, paths };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return { id, name, date: Date.now(), path: filePath };
    } catch (error) {
        console.error("Error saving snippet:", error);
        throw error;
    }
});

ipcMain.handle('snippets:delete', async (_event, id: string) => {
    try {
        const filePath = path.join(SNIPPETS_DIR, `${id}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error("Error deleting snippet:", error);
        throw error;
    }
});

ipcMain.handle('snippets:get', async (_event, id: string) => {
    try {
        const filePath = path.join(SNIPPETS_DIR, `${id}.json`);
        if (fs.existsSync(filePath)) {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return content.paths;
        }
        return null;
    } catch (error) {
        console.error("Error getting snippet:", error);
        throw error;
    }
});

// Remote Control Server
let remoteServer: RemoteServer | null = null;

ipcMain.handle('remote:start', async (_event) => {
    if (!remoteServer) {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            remoteServer = new RemoteServer(mainWindow);
        } else {
            throw new Error("Main window not found");
        }
    }
    return await remoteServer.start();
});

ipcMain.handle('remote:stop', () => {
    if (remoteServer) {
        remoteServer.stop();
        remoteServer = null;
    }
});

ipcMain.handle('remote:update-state', (_event, state: any) => {
    if (remoteServer) {
        remoteServer.updateState(state);
    }
});

// Screen capture for remote control click relay
ipcMain.handle('remote:capture-screen', async () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return null;

    try {
        const image = await mainWindow.webContents.capturePage();
        return image.toJPEG(70); // 70% quality for smaller size
    } catch (e) {
        console.error('Screen capture error:', e);
        return null;
    }
});

// Click simulation for remote control
ipcMain.handle('remote:simulate-click', async (_event, x: number, y: number) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return false;

    try {
        // Get window bounds to ensure click is within
        const bounds = mainWindow.getContentBounds();
        const clampedX = Math.max(0, Math.min(x, bounds.width));
        const clampedY = Math.max(0, Math.min(y, bounds.height));

        // Simulate mouse click
        mainWindow.webContents.sendInputEvent({
            type: 'mouseDown',
            x: clampedX,
            y: clampedY,
            button: 'left',
            clickCount: 1
        });

        mainWindow.webContents.sendInputEvent({
            type: 'mouseUp',
            x: clampedX,
            y: clampedY,
            button: 'left',
            clickCount: 1
        });

        return true;
    } catch (e) {
        console.error('Click simulation error:', e);
        return false;
    }
});

// Get window size for coordinate scaling
ipcMain.handle('remote:get-window-size', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return null;

    const bounds = mainWindow.getContentBounds();
    return { width: bounds.width, height: bounds.height };
});
