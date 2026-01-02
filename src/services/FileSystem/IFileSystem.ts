
export interface FileReference {
    type: 'electron' | 'web';
    // For Electron, this is the absolute path
    path?: string;
    // For Web, this is the FileSystemFileHandle
    handle?: any; // FileSystemFileHandle
    // For Web, we need the parent directory handle to resolve relative paths
    parentHandle?: any; // FileSystemDirectoryHandle
    name: string;
}

export interface IFileSystem {
    /**
     * Trigger a file picker to select a .tex file
     */
    selectFile(): Promise<FileReference | null>;

    /**
     * Select a folder (for Web mode mostly, but can be used in Electron)
     */
    selectFolder?(): Promise<FileReference | null>;

    /**
     * Read text content of a file
     */
    readFile(ref: FileReference): Promise<string>;

    /**
     * List files in a directory (for selecting file after opening folder)
     */
    readDirectory?(ref: FileReference): Promise<FileReference[]>;

    /**
     * Watch a file for changes. Returns a cleanup function.
     */
    watchFile(ref: FileReference, onChange: () => void): () => void;

    /**
     * Resolve a relative path (e.g. images/fig1.png) from the base file.
     * Returns a URL string that can be used in <img src="..." />
     * - Electron: Returns "media:///C:/path/to/images/fig1.png" or "file:///..."
     * - Web: Returns "blob:http://..."
     */
    resolveRelativeResource(baseRef: FileReference, relativePath: string): Promise<string>;
}
