
import { ElectronFileSystem } from './ElectronFileSystem';
import { WebFileSystem } from './WebFileSystem';
import { IFileSystem, FileReference } from './IFileSystem';

class FileSystemServiceImplementation implements IFileSystem {
    private impl: IFileSystem;
    private isElectron: boolean;

    constructor() {
        this.isElectron = !!(window as any).electronAPI;
        this.impl = this.isElectron ? new ElectronFileSystem() : new WebFileSystem();
        console.log(`[FileSystem] Initialized in ${this.isElectron ? 'ELECTRON' : 'WEB'} mode.`);
    }

    async selectFile(): Promise<FileReference | null> {
        return this.impl.selectFile();
    }

    async selectFolder(): Promise<FileReference | null> {
        // Electron API might not have selectFolder exposed in the interface I defined earlier
        // but let's assume implementation has it or we default to null
        if (this.impl.selectFolder) {
            return this.impl.selectFolder();
        }
        return null;
    }

    async readFile(ref: FileReference): Promise<string> {
        return this.impl.readFile(ref);
    }

    async readDirectory(ref: FileReference): Promise<FileReference[]> {
        if (this.impl.readDirectory) {
            return this.impl.readDirectory(ref);
        }
        return [];
    }

    watchFile(ref: FileReference, onChange: () => void): () => void {
        return this.impl.watchFile(ref, onChange);
    }

    async resolveRelativeResource(baseRef: FileReference, relativePath: string): Promise<string> {
        return this.impl.resolveRelativeResource(baseRef, relativePath);
    }

    isElectronEnv() {
        return this.isElectron;
    }
}

export const FileSystemService = new FileSystemServiceImplementation();
