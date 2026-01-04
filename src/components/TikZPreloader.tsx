import React, { useEffect, useState, useMemo } from 'react';
import { QuestionNode } from '../shared/types';
import { TikZEmbed } from './TikZEmbed';

interface TikZPreloaderProps {
    questions: QuestionNode[];
    onProgress?: (total: number, remaining: number) => void;
}

// Helper to hash (must match TikZEmbed's hash)
const hashCode = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'tikz_' + Math.abs(hash).toString(36);
};

const CACHE_PREFIX = 'tikz_cache:';

export const TikZPreloader: React.FC<TikZPreloaderProps> = ({ questions, onProgress }) => {
    const [queue, setQueue] = useState<string[]>([]);
    const [currentCode, setCurrentCode] = useState<string | null>(null);

    // 1. Extract and Filter TikZ blocks on Mount / Question Change
    useEffect(() => {
        const uniqueBlocks = new Set<string>();
        const tikzRegex = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g;

        questions.forEach(q => {
            // Scan content/explanation/options
            const texts = [q.content, q.explanation, q.latex_block, q.short_answer];
            if (q.options) q.options.forEach(o => texts.push(o.content));

            texts.forEach(text => {
                if (!text) return;
                const matches = text.match(tikzRegex);
                if (matches) {
                    matches.forEach(m => uniqueBlocks.add(m));
                }
            });
        });

        // Filter out already cached items
        const missing: string[] = [];
        uniqueBlocks.forEach(block => {
            // Clean Vietnamese tones same as TikZEmbed if needed, 
            // but TikZEmbed does it internally before hashing.
            // Wait, TikZEmbed sanitizes BEFORE hashing. 
            // We need to match that logic to check cache accurately or just let TikZEmbed handle the check?
            // "TikZEmbed" component checks cache on mount.
            // If we re-implement the check here we need the exact sanitize logic.
            // BUT, simply passing it to a TikZEmbed instance that has logic "If in cache, do nothing" is easier?
            // No, because we want to only mount ONE at a time. We need to know if it's done.
            // So we MUST duplicate the cache check logic: Sanitize -> Hash -> Check Storage.

            const sanitized = removeVietnameseTones(block);
            const key = CACHE_PREFIX + hashCode(sanitized);
            if (!localStorage.getItem(key)) {
                missing.push(block);
            }
        });

        console.log(`[TikZPreloader] Found ${uniqueBlocks.size} blocks. Missing from cache: ${missing.length}`);
        setQueue(missing);
        if (onProgress) onProgress(missing.length, missing.length);

    }, [questions]);

    // 2. Process Queue
    useEffect(() => {
        if (!currentCode && queue.length > 0) {
            const next = queue[0];
            setCurrentCode(next);
        }
    }, [queue, currentCode]);

    const handleRenderComplete = (svg: string) => {
        console.log('[TikZPreloader] Pre-rendered 1 item.');
        // Remove current from queue
        setQueue(prev => {
            const next = prev.slice(1);
            if (onProgress) onProgress(prev.length + 1, next.length);
            return next;
        });
        setCurrentCode(null); // Trigger next effect
    };

    if (!currentCode) return null;

    return (
        <div style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'hidden', width: '1px', height: '1px', overflow: 'hidden' }}>
            <TikZEmbed
                key={hashCode(removeVietnameseTones(currentCode))} // Force remount for new code
                code={currentCode}
                onRender={handleRenderComplete}
            />
        </div>
    );
};

// Utilities (Copied from TikZEmbed to ensure consistency)
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
