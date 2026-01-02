import React, { useRef, useEffect, useState } from 'react';

interface TikZEmbedProps {
    code: string;
    className?: string;
    onRender?: (svg: string) => void;
}

// Simple hash function for cache key
const hashCode = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'tikz_' + Math.abs(hash).toString(36);
};

// Cache helpers
const CACHE_PREFIX = 'tikz_cache:';
const getFromCache = (key: string): string | null => {
    try {
        return localStorage.getItem(CACHE_PREFIX + key);
    } catch {
        return null;
    }
};
const saveToCache = (key: string, svg: string) => {
    try {
        localStorage.setItem(CACHE_PREFIX + key, svg);
    } catch (e) {
        console.warn('[TikZ Cache] Storage full, clearing old entries');
        // Clear oldest entries if storage is full
        const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
        if (keys.length > 50) {
            keys.slice(0, 20).forEach(k => localStorage.removeItem(k));
        }
    }
};

const removeVietnameseTones = (str: string) => {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
    return str;
}

export const TikZEmbed: React.FC<TikZEmbedProps> = ({ code, className, onRender }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [renderedSvg, setRenderedSvg] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(150);
    const instanceId = useRef(Math.random().toString(36).substr(2, 9)).current;
    const [error, setError] = useState<string | null>(null);
    const timeoutRef = useRef<any>(null);

    const sanitizedCode = removeVietnameseTones(code);
    const cacheKey = hashCode(sanitizedCode);

    // Check cache on mount
    useEffect(() => {
        const cached = getFromCache(cacheKey);
        if (cached) {
            console.log('[TikZ Cache] HIT:', cacheKey);
            setRenderedSvg(cached);
            if (onRender) onRender(cached);
        } else {
            console.log('[TikZ Cache] MISS:', cacheKey);
            setIsVisible(true);
        }
    }, [cacheKey]);

    // Reset when code changes
    useEffect(() => {
        const cached = getFromCache(cacheKey);
        if (!cached) {
            setRenderedSvg(null);
            setError(null);
        }
    }, [sanitizedCode, cacheKey]);

    useEffect(() => {
        if (isVisible && !renderedSvg && !error) {
            timeoutRef.current = setTimeout(() => {
                if (!renderedSvg) {
                    setError("Rendering timed out (30s) - Complexity or Network issue.");
                }
            }, 30000);
        }
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [isVisible, renderedSvg, error]);

    const handleRetry = () => {
        setError(null);
        setRenderedSvg(null);
    };

    // Use LOCAL ASSETS from /tikzjax public folder
    // Note: In Electron/Vite, 'public' folder contents are served at root '/'
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" type="text/css" href="/tikzjax/fonts.css">
    <script>
        const _originalBtoa = window.btoa;
        window.btoa = function(str) {
            try { return _originalBtoa(str); } catch (e) { return _originalBtoa(unescape(encodeURIComponent(str))); }
        };
    </script>
    <script src="/tikzjax/tikzjax.js"></script>
    <style>
        body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; overflow: visible; box-sizing: border-box; }
        svg { width: auto; max-width: 100%; overflow: visible; }
    </style>
</head>
<body>
    <script type="text/tikz">
        ${sanitizedCode}
    </script>
    <script>
        const observer = new MutationObserver((mutations) => {
            const svg = document.querySelector('svg');
            if (svg) {
                const rect = svg.getBoundingClientRect();
                window.parent.postMessage({ 
                    type: 'TIKZ_RENDERED', 
                    id: '${instanceId}',
                    height: rect.height + 40,
                    svg: svg.outerHTML 
                }, '*');
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    </script>
</body>
</html>
    `;

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'TIKZ_RENDERED' && event.data.id === instanceId) {
                setHeight(event.data.height);
                let svgContent = event.data.svg;

                svgContent = svgContent.replace(
                    /<svg([^>]*)>/i,
                    (_: string, attributes: string) => {
                        let cleanAttrs = attributes.replace(/style="[^"]*"/gi, '');
                        // Force SVG to fit within parent container (contain)
                        return `<svg ${cleanAttrs} style="display: block; margin: 0 auto; max-width: 100%; max-height: 100%; width: auto; height: auto; overflow: visible;">`;
                    }
                );

                const scopeSvgIds = (content: string, suffix: string) => {
                    const idRegex = /id="([^"]+)"/g;
                    let match;
                    const ids = new Set<string>();
                    while ((match = idRegex.exec(content)) !== null) ids.add(match[1]);

                    let scoped = content;
                    ids.forEach(id => {
                        const newId = `${id}_${suffix}`;
                        scoped = scoped.split(`id="${id}"`).join(`id="${newId}"`);
                        scoped = scoped.split(`url(#${id})`).join(`url(#${newId})`);
                        scoped = scoped.split(`xlink:href="#${id}"`).join(`xlink:href="#${newId}"`);
                        scoped = scoped.split(`href="#${id}"`).join(`href="#${newId}"`);
                    });
                    return scoped;
                };

                svgContent = scopeSvgIds(svgContent, instanceId);
                setRenderedSvg(svgContent);
                // Save to cache
                saveToCache(cacheKey, svgContent);
                console.log('[TikZ Cache] SAVED:', cacheKey);
                if (onRender) onRender(svgContent);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [instanceId, onRender, cacheKey]);

    return (
        <div ref={containerRef} className={`my-4 flex justify-center min-h-[100px] w-full overflow-visible ${className || ''}`}>
            {!isVisible ? (
                <div className="flex items-center justify-center text-gray-400 bg-gray-50 border border-dashed rounded w-full h-32 animate-pulse">Loading Diagram...</div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center text-red-500 bg-red-50 border border-red-200 rounded w-full h-auto p-4 gap-2">
                    <span className="text-sm font-medium">⚠️ {error}</span>
                    <button onClick={handleRetry} className="px-3 py-1 bg-white border border-red-300 rounded text-xs font-bold text-red-600 hover:bg-red-50">Thử lại</button>
                    <details className="w-full mt-2"><summary className="text-xs text-gray-400 cursor-pointer">Xem mã nguồn</summary><pre className="text-[10px] bg-gray-100 p-2 rounded mt-1 overflow-x-auto">{code}</pre></details>
                </div>
            ) : renderedSvg ? (
                <div className="w-full h-full flex justify-center items-center" dangerouslySetInnerHTML={{ __html: renderedSvg }} style={{ transition: 'all 0.3s', maxWidth: '100%', overflow: 'visible' }} />
            ) : (
                <iframe title="TikZ Generator" srcDoc={htmlContent} style={{ border: 'none', width: '100%', height: `${height}px`, transition: 'height 0.3s ease' }} sandbox="allow-scripts" />
            )}
        </div>
    );
};
