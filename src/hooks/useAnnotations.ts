import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAnnotationsOptions {
    texPath: string;
}

export function useAnnotations({ texPath }: UseAnnotationsOptions) {
    const [annotations, setAnnotations] = useState<Record<number, any[]>>({});
    const [whiteboardPaths, setWhiteboardPaths] = useState<any[]>([]);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    const annotationsLoadedRef = useRef<string | null>(null);
    const annotationsRef = useRef<Record<number, any[]>>({});
    const whiteboardRef = useRef<any[]>([]);
    const texPathRef = useRef<string>('');

    // Helper functions
    const getAnnotationPath = useCallback(async (path: string) => {
        if (!path) return '';
        const userDataPath = await window.electronAPI.getPath('userData');
        const safeName = btoa(path).replace(/[/+=]/g, '_');
        return `${userDataPath}/annotations/${safeName}.json`;
    }, []);

    const getWhiteboardPath = useCallback(async (path: string) => {
        if (!path) return '';
        const userDataPath = await window.electronAPI.getPath('userData');
        const safeName = btoa(path).replace(/[/+=]/g, '_');
        return `${userDataPath}/annotations/${safeName}_whiteboard.json`;
    }, []);

    // Load annotations when texPath changes
    useEffect(() => {
        const loadAnnotations = async () => {
            if (!texPath) {
                setAnnotations({});
                return;
            }

            const annotationFile = await getAnnotationPath(texPath);
            const exists = await window.electronAPI.exists(annotationFile);

            if (exists) {
                try {
                    const content = await window.electronAPI.readFile(annotationFile);
                    const data = JSON.parse(content);
                    setAnnotations(data || {});
                    annotationsLoadedRef.current = texPath;
                } catch (e) {
                    console.error("Failed to load annotations:", e);
                    setAnnotations({});
                }
            } else {
                setAnnotations({});
                annotationsLoadedRef.current = texPath;
            }
        };

        loadAnnotations();
    }, [texPath, getAnnotationPath]);

    // Load whiteboard when texPath changes
    useEffect(() => {
        const loadWhiteboard = async () => {
            if (!texPath) {
                setWhiteboardPaths([]);
                return;
            }
            const wbFile = await getWhiteboardPath(texPath);
            const exists = await window.electronAPI.exists(wbFile);
            if (exists) {
                try {
                    const content = await window.electronAPI.readFile(wbFile);
                    const data = JSON.parse(content);
                    setWhiteboardPaths(Array.isArray(data) ? data : []);
                } catch (e) {
                    console.error("Failed to load whiteboard:", e);
                    setWhiteboardPaths([]);
                }
            }
        };
        loadWhiteboard();
    }, [texPath, getWhiteboardPath]);

    // Sync state to refs for event handlers
    useEffect(() => {
        annotationsRef.current = annotations;
        whiteboardRef.current = whiteboardPaths;
        texPathRef.current = texPath;
    }, [annotations, whiteboardPaths, texPath]);

    // Auto-save with debounce (2 seconds after last change)
    useEffect(() => {
        if (!texPath) return;

        const hasContent = Object.values(annotations).some(paths => paths && paths.length > 0)
            || whiteboardPaths.length > 0;
        if (!hasContent) return;

        const saveTimer = setTimeout(async () => {
            try {
                const annotationFile = await getAnnotationPath(texPath);
                await window.electronAPI.writeFile(annotationFile, JSON.stringify(annotations));

                const wbFile = await getWhiteboardPath(texPath);
                await window.electronAPI.writeFile(wbFile, JSON.stringify(whiteboardPaths));

                console.log('[Auto-save] Annotations saved');
            } catch (e) {
                console.error('[Auto-save] Failed:', e);
            }
        }, 2000); // 2 second debounce

        return () => clearTimeout(saveTimer);
    }, [annotations, whiteboardPaths, texPath, getAnnotationPath, getWhiteboardPath]);

    // Handle App Exit Request
    useEffect(() => {
        const handleClose = async () => {
            let needsSave = false;

            const currentAnnotations = annotationsRef.current;
            const currentWhiteboard = whiteboardRef.current;
            const currentTexPath = texPathRef.current;

            if (Object.keys(currentAnnotations).length > 0) {
                if (Object.values(currentAnnotations).some(paths => paths && paths.length > 0)) needsSave = true;
            }
            if (currentWhiteboard.length > 0) needsSave = true;

            if (!needsSave && currentTexPath) {
                const annFile = await getAnnotationPath(currentTexPath);
                const wbFile = await getWhiteboardPath(currentTexPath);
                const annExists = await window.electronAPI.exists(annFile);
                const wbExists = await window.electronAPI.exists(wbFile);

                if (annExists || wbExists) needsSave = true;
            }

            if (needsSave) {
                setShowExitConfirm(true);
            } else {
                window.electronAPI.quitApp();
            }
        };

        window.electronAPI.removeAllCloseListeners();
        window.electronAPI.onCloseRequest(handleClose);

        return () => {
            window.electronAPI.removeAllCloseListeners();
        };
    }, [getAnnotationPath, getWhiteboardPath]);

    const handleSaveAndQuit = useCallback(async () => {
        if (texPath) {
            try {
                const annotationFile = await getAnnotationPath(texPath);
                await window.electronAPI.writeFile(annotationFile, JSON.stringify(annotations));

                const wbFile = await getWhiteboardPath(texPath);
                await window.electronAPI.writeFile(wbFile, JSON.stringify(whiteboardPaths));
            } catch (e) {
                console.error("Failed to save annotations:", e);
            }
        }
        window.electronAPI.quitApp();
    }, [texPath, annotations, whiteboardPaths, getAnnotationPath, getWhiteboardPath]);

    const handleQuitWithoutSaving = useCallback(() => {
        window.electronAPI.quitApp();
    }, []);

    const updateAnnotation = useCallback((slideIdx: number, paths: any[]) => {
        setAnnotations(prev => ({
            ...prev,
            [slideIdx]: paths,
        }));
    }, []);

    return {
        annotations,
        setAnnotations,
        whiteboardPaths,
        setWhiteboardPaths,
        showExitConfirm,
        setShowExitConfirm,
        handleSaveAndQuit,
        handleQuitWithoutSaving,
        updateAnnotation,
    };
}
