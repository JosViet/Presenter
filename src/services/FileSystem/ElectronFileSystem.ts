
import { FileReference, IFileSystem } from './IFileSystem';

export class ElectronFileSystem implements IFileSystem {

    async selectFile(): Promise<FileReference | null> {
        if (!window.electronAPI) throw new Error("Electron API not available");
        const path = await window.electronAPI.openFile();
        if (!path) return null;

        // Extract name
        const name = path.split(/[\\/]/).pop() || 'file';

        return {
            type: 'electron',
            path: path,
            name: name
        };
    }

    async readFile(ref: FileReference): Promise<string> {
        if (ref.type !== 'electron' || !ref.path) throw new Error("Invalid reference for Electron FS");
        return await window.electronAPI.readFile(ref.path);
    }

    watchFile(ref: FileReference, onChange: () => void): () => void {
        if (ref.type !== 'electron' || !ref.path) return () => { };

        const pathToCheck = ref.path;

        // Start watching
        window.electronAPI.watchFile(pathToCheck);

        // Subscribe to global change event
        // Note: This filtering might need refinement if generic 'onFileChanged' emits for all files
        // But currently filtering by string match is the best we can do without modifying preload
        const handle = (changedPath: string) => {
            // Simple normalization for comparison
            const normChanged = changedPath.replace(/\\/g, '/').toLowerCase();
            const normCurrent = pathToCheck.replace(/\\/g, '/').toLowerCase();
            if (normChanged === normCurrent) {
                onChange();
            }
        };

        // There is no efficient 'removeListener' exposed in types that takes a specific wrapper fn
        // except possibly passing the SAME function reference if 'onFileChanged' supports it.
        // Looking at types: onRemoteCommand returns a cleanup fn. onFileChanged returns void.
        // We will assume onFileChanged adds a persistent listener. 
        // For now, we will just start watching. 
        // TODO: Improve ElectronAPI to return cleanup for watchFile or support individual listeners.

        // TEMPORARY HACK: The current API doesn't support unregistering a specific listener easily 
        // without a refactor of the preload script. 
        // For now, we will rely on the app logic to just reload content.

        // Actually, we can hook into the global listener once in the singleton, 
        // but for this class, let's just register.
        window.electronAPI.onFileChanged(handle);

        return () => {
            // Ideally: remove listener
        };
    }

    async resolveRelativeResource(baseRef: FileReference, relativePath: string): Promise<string> {
        if (!baseRef.path) return '';

        // Get directory of base file
        const fullPath = baseRef.path.replace(/\\/g, '/');
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

        // Resolve relative path
        // Simple string concat (node's path.resolve is better but we are in renderer)
        let resolved = `${dir}/${relativePath.replace(/\\/g, '/')}`;

        // Handle .. (simple case)
        // If robust path resolution is needed, we should ask Main process
        // For now, assume simple relative paths for media

        // Protocol for Electron to read local files safely
        return `media:///${resolved}`;
    }
}
