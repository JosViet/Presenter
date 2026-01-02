
import React, { useEffect, useState } from 'react';
import { FileSystemService } from '../services/FileSystem';
import { FileReference } from '../services/FileSystem/IFileSystem';

interface ResolvedMediaProps {
    fileRef: FileReference | null;
    relativePath: string;
    type: 'audio' | 'video';
    className?: string;
    // basePath is kept for backward compatibility if fileRef is null (legacy string mode)
    basePath?: string;
}

export const ResolvedMedia: React.FC<ResolvedMediaProps> = ({ fileRef, relativePath, type, className, basePath }) => {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        const load = async () => {
            if (!relativePath) return;

            // Check if absolute HTTP/HTTPS
            if (relativePath.startsWith('http')) {
                setSrc(relativePath);
                return;
            }

            // Clean path
            const cleanPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

            try {
                if (fileRef) {
                    const url = await FileSystemService.resolveRelativeResource(fileRef, cleanPath);
                    if (active) setSrc(url);
                } else if (basePath) {
                    // Fallback Legacy (Electron String Mode)
                    // We can also use FileSystemService with a fake Ref if we wanted, 
                    // but manual string building is faster for legacy sync render
                    const isAbsolute = relativePath.includes(':') || relativePath.startsWith('/');
                    const rawPath = isAbsolute ? relativePath : `${basePath}/${relativePath}`;
                    const sanitized = rawPath.replace(/\\/g, '/');
                    if (active) setSrc(`media:///${sanitized}`);
                }
            } catch (e) {
                console.error("Failed to resolve media:", relativePath, e);
            }
        };

        load();

        return () => { active = false; };
    }, [fileRef, relativePath, basePath]);

    if (!src) return <div className="animate-pulse bg-gray-200 h-10 w-full rounded">Loading media...</div>;

    if (type === 'audio') {
        const ext = relativePath.split('.').pop()?.toLowerCase();
        const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/ogg';
        return (
            <audio controls preload="metadata" className={className}>
                <source src={src} type={mime} />
                Trình duyệt không hỗ trợ.
            </audio>
        );
    } else {
        const ext = relativePath.split('.').pop()?.toLowerCase();
        const mime = ext === 'mp4' ? 'video/mp4' : 'video/webm';
        return (
            <video controls preload="metadata" className={className}>
                <source src={src} type={mime} />
                Trình duyệt không hỗ trợ.
            </video>
        );
    }
};
