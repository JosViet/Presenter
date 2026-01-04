/**
 * Browser-compatible implementation of ElectronAPI
 * Uses localStorage, IndexedDB, and HTML5 File API as fallbacks
 */

import { ElectronAPI } from '../types.d';

// Storage keys
const STORAGE_PREFIX = 'vietlms-presenter:';
const FILES_KEY = STORAGE_PREFIX + 'files';
const SETTINGS_KEY = STORAGE_PREFIX + 'settings';
const SNIPPETS_KEY = STORAGE_PREFIX + 'snippets';

// Helper: Get virtual file system from localStorage
function getFileSystem(): Record<string, string> {
    try {
        return JSON.parse(localStorage.getItem(FILES_KEY) || '{}');
    } catch {
        return {};
    }
}

function saveFileSystem(fs: Record<string, string>) {
    localStorage.setItem(FILES_KEY, JSON.stringify(fs));
}

// File input element for file picker
let fileInput: HTMLInputElement | null = null;
let folderInput: HTMLInputElement | null = null;

function createFileInput(): HTMLInputElement {
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.tex,.txt';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }
    return fileInput;
}

function createFolderInput(): HTMLInputElement {
    if (!folderInput) {
        folderInput = document.createElement('input');
        folderInput.type = 'file';
        folderInput.setAttribute('webkitdirectory', '');
        folderInput.style.display = 'none';
        document.body.appendChild(folderInput);
    }
    return folderInput;
}

// Current file reference for browser mode
// File reference stored in virtual FS

export const browserAPI: ElectronAPI = {
    // File operations
    openFile: () => new Promise((resolve) => {
        const input = createFileInput();
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const content = await file.text();
                const path = `/browser/${file.name}`;

                // Store in virtual FS
                const fs = getFileSystem();
                fs[path] = content;
                saveFileSystem(fs);

                resolve(path);
            } else {
                resolve(null);
            }
            input.value = '';
        };
        input.click();
    }),

    openDirectory: () => new Promise((resolve) => {
        const input = createFolderInput();
        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                const fs = getFileSystem();
                const basePath = `/browser/folder`;

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const content = await file.text();
                    const relativePath = file.webkitRelativePath || file.name;
                    fs[`${basePath}/${relativePath}`] = content;
                }
                saveFileSystem(fs);
                resolve(basePath);
            } else {
                resolve(null);
            }
            input.value = '';
        };
        input.click();
    }),

    readFile: async (path: string) => {
        const fs = getFileSystem();
        if (fs[path]) {
            return fs[path];
        }
        throw new Error(`File not found: ${path}`);
    },

    writeFile: async (filePath: string, content: string) => {
        const fs = getFileSystem();
        fs[filePath] = content;
        saveFileSystem(fs);
        return true;
    },

    exists: async (filePath: string) => {
        const fs = getFileSystem();
        return filePath in fs;
    },

    getPath: async (name: string) => {
        // Return virtual paths for browser mode
        if (name === 'userData') return '/browser/userData';
        if (name === 'documents') return '/browser/documents';
        return `/browser/${name}`;
    },

    // File watching (no-op in browser)
    watchFile: async () => {
        console.log('[Browser] watchFile: Not supported in browser mode');
    },

    onFileChanged: () => {
        console.log('[Browser] onFileChanged: Not supported in browser mode');
    },

    // Settings
    getSettings: async () => {
        try {
            return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        } catch {
            return {};
        }
    },

    setSettings: async (settings: any) => {
        const current = await browserAPI.getSettings();
        const merged = { ...current, ...settings };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        return merged;
    },

    // TikZ - handled by TikZJax, these are no-ops
    compileTikZ: async () => {
        console.log('[Browser] TikZ is rendered via TikZJax');
        return { success: false, error: 'Use TikZJax in browser mode' };
    },

    clearTikZCache: async () => {
        console.log('[Browser] clearTikZCache: TikZJax handles caching');
    },

    // Snippets
    listSnippets: async () => {
        try {
            return JSON.parse(localStorage.getItem(SNIPPETS_KEY) || '[]');
        } catch {
            return [];
        }
    },

    saveSnippet: async (name: string, paths: any[]) => {
        const snippets = await browserAPI.listSnippets();
        const id = Date.now().toString();
        const snippet = { id, name, paths, createdAt: new Date().toISOString() };
        snippets.push(snippet);
        localStorage.setItem(SNIPPETS_KEY, JSON.stringify(snippets));
        return snippet;
    },

    deleteSnippet: async (id: string) => {
        const snippets = await browserAPI.listSnippets();
        const filtered = snippets.filter((s: any) => s.id !== id);
        localStorage.setItem(SNIPPETS_KEY, JSON.stringify(filtered));
        return true;
    },

    getSnippet: async (id: string) => {
        const snippets = await browserAPI.listSnippets();
        const snippet = snippets.find((s: any) => s.id === id);
        return snippet?.paths || [];
    },

    // Remote Control - not available in browser
    startRemoteServer: async () => {
        console.warn('[Browser] Remote control not available in browser mode');
        throw new Error("Tính năng này cần gọi Server nội bộ nên chỉ hoạt động trên bản Desktop (Windows/Mac). Vui lòng tải ứng dụng về máy.");
    },

    stopRemoteServer: async () => {
        console.log('[Browser] stopRemoteServer: Not available');
    },

    updateRemoteState: async () => {
        // No-op in browser
    },

    onRemoteCommand: () => {
        // Return cleanup function
        return () => { };
    },

    // App lifecycle
    onCloseRequest: () => {
        // Browser handles this via beforeunload
        window.addEventListener('beforeunload', (e) => {
            e.preventDefault();
            e.returnValue = '';
        });
    },

    removeAllCloseListeners: () => {
        // No-op
    },

    quitApp: async () => {
        window.close();
    }
};

// Export for injection
export function injectBrowserAPI() {
    if (!(window as any).electronAPI) {
        console.log('[VietLMS] Running in browser mode - using localStorage for persistence');
        (window as any).electronAPI = browserAPI;
    }
}
