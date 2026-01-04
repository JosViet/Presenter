import React, { useEffect, useState } from 'react';
import { QuestionNode } from '../shared/types';
import { TikZEmbed, getTikZCacheKey, getFromCache, TIKZ_LIBRARIES } from './TikZEmbed';

interface TikZPreloaderProps {
    questions: QuestionNode[];
    onProgress?: (total: number, remaining: number) => void;
}

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

        const missing: string[] = [];

        uniqueBlocks.forEach(block => {
            // Prepend libraries to match what LatexRenderer sends to TikZEmbed
            const enrichedBlock = `${TIKZ_LIBRARIES}\n${block}`;

            const key = getTikZCacheKey(enrichedBlock);

            // Check using shared cache helper
            if (!getFromCache(key)) {
                // Queue the ENRICHED block so TikZEmbed renders and saves with the CORRECT key
                missing.push(enrichedBlock);
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

    const handleRenderComplete = () => {
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
                key={getTikZCacheKey(currentCode)} // Force remount for new code
                code={currentCode}
                onRender={handleRenderComplete}
            />
        </div>
    );
};
