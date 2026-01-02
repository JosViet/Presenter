
import { FileReference, IFileSystem } from './IFileSystem';

export class WebFileSystem implements IFileSystem {

    async selectFile(): Promise<FileReference | null> {
        if ('showOpenFilePicker' in window) {
            try {
                // @ts-ignore
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'LaTeX Files',
                        accept: { 'text/x-tex': ['.tex'] }
                    }]
                });

                // We assume the user selects a file inside a project folder.
                // However, without showDirectoryPicker first, we cannot easily resolve relative paths 
                // outside this file unless we ask for access to the directory.
                // Recommendation: User should "Open Folder" not "Open File" for full experience.
                // But if they Open File, we try to get the parent handle if possible (not possible standardly).

                return {
                    type: 'web',
                    handle: handle,
                    name: handle.name
                };
            } catch (e) {
                console.warn(e);
                return null; // Cancelled
            }
        }
        alert("Trình duyệt không hỗ trợ File System Access API. Vui lòng dùng Chrome/Edge.");
        return null;
    }

    async selectFolder(): Promise<FileReference | null> {
        if ('showDirectoryPicker' in window) {
            try {
                // @ts-ignore
                const startHandle = await window.showDirectoryPicker();
                // We ask user to pick the main TEX file *inside* this folder?
                // Or we return the folder ref, and App asks user to pick file from list.
                // For simplified 'selectFile' flow from folder:
                // We might need a custom file picker UI on Web.

                // For now, let's assume we return the FOLDER, and the App needs logic to list files.
                // BUT to match 'selectFile' interface, we might need a 2-step process.

                // Let's implement this method as a utility, but the interface requires returning a FileReference to a FILE potentially?
                // Actually IFileSystem interface says 'selectFile' returns a file.
                // 'selectFolder' is separate.

                return {
                    type: 'web',
                    handle: startHandle,
                    name: startHandle.name
                };
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    async readDirectory(ref: FileReference): Promise<FileReference[]> {
        if (!ref.handle || ref.type !== 'web') return [];
        const files: FileReference[] = [];
        try {
            // @ts-ignore
            for await (const entry of ref.handle.values()) {
                if (entry.kind === 'file') {
                    files.push({
                        type: 'web',
                        handle: entry,
                        parentHandle: ref.handle,
                        name: entry.name
                    });
                } else if (entry.kind === 'directory') {
                    // Recurse? Or just list? For now just ignore folders or list them differently?
                    // We only care about .tex files for now
                }
            }
        } catch (e) {
            console.error("Error reading dir", e);
        }
        return files.sort((a, b) => a.name.localeCompare(b.name));
    }

    async readFile(ref: FileReference): Promise<string> {
        if (ref.type !== 'web' || !ref.handle) throw new Error("Invalid web handle");
        const fileStr = await (ref.handle as any).getFile();
        return await fileStr.text();
    }

    watchFile(ref: FileReference, onChange: () => void): () => void {
        // Simple Polling implementation
        if (!ref.handle) return () => { };

        let lastModified = 0;
        let active = true;

        const check = async () => {
            if (!active) return;
            try {
                const file = await (ref.handle as any).getFile();
                if (lastModified === 0) {
                    lastModified = file.lastModified;
                } else if (file.lastModified > lastModified) {
                    lastModified = file.lastModified;
                    onChange();
                }
            } catch (e) { }
            setTimeout(check, 1000);
        };

        check();

        return () => { active = false; };
    }

    async resolveRelativeResource(baseRef: FileReference, relativePath: string): Promise<string> {
        if (!baseRef.parentHandle) {
            console.warn("No parent directory handle. Cannot resolve relative path:", relativePath);
            return '';
        }

        const parts = relativePath.split(/[\\/]/).filter(p => p !== '.' && p !== '');

        let currentHandle = baseRef.parentHandle;

        try {
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (part === '..') {
                    // Not supported easily without retaining hierarchy
                    console.warn("Parent directory traversal (..) not supported yet");
                    return '';
                }
                currentHandle = await currentHandle.getDirectoryHandle(part);
            }

            const fileName = parts[parts.length - 1];
            const fileHandle = await currentHandle.getFileHandle(fileName);
            const fileFn = await fileHandle.getFile();
            return URL.createObjectURL(fileFn);

        } catch (e) {
            console.error("Resource not found:", relativePath, e);
            return '';
        }
    }
}
