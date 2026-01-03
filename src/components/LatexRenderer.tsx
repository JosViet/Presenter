import React from 'react';
import { TikZEmbed } from './TikZEmbed';
import { ResolvedMedia } from './ResolvedMedia';
import { FileReference } from '../services/FileSystem/IFileSystem';
import clsx from 'clsx';
import { splitByTopLevelItem } from '../services/parser_presenter';
import { renderMath, parseSemantics } from '../utils/latexUtils';

interface LatexRendererProps {
    content?: string;
    className?: string;
    cachedImages?: Record<string, string>;
    inline?: boolean;
    onInteract?: (text: string) => void;
    onRenderSvg?: (source: string, svg: string) => void;
    theme?: 'light' | 'sepia' | 'dark';
    basePath?: string;
    macros?: Record<string, string>;
    onZoom?: (content: React.ReactNode) => void;
    fileRef?: FileReference | null;
}

export const LatexRenderer: React.FC<LatexRendererProps> = ({
    content = '',
    className = '',
    cachedImages,
    inline = false,
    onInteract,
    onRenderSvg,
    theme = 'light',
    basePath = '',
    macros = {},
    onZoom,
    fileRef = null
}) => {
    if (!content) return null;
    const semanticParts = parseSemantics(content);

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (onInteract) {
            let text = window.getSelection()?.toString().trim();
            if (!text && e.target instanceof HTMLElement) text = e.target.innerText;
            if (text) onInteract(text);
        }
    };

    return (
        <div className={`latex-content ${className} ${inline ? 'inline-block' : 'block'}`} onDoubleClick={handleDoubleClick}>
            {semanticParts.map((part: any, pIdx: number) => {
                if (typeof part === 'string') {
                    const tikzRegex = /(\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\})/g;
                    const subParts = part.split(tikzRegex);
                    return (
                        <React.Fragment key={pIdx}>
                            {subParts.map((sub, sIdx) => {
                                if (sub && sub.trim().startsWith('\\begin{tikzpicture}')) {
                                    // Try robust lookup (handle newline/trim differences)
                                    const cachedSvg = cachedImages && (
                                        cachedImages[sub.replace(/\s+/g, ' ').trim()]
                                    );

                                    if (cachedSvg) {
                                        return (
                                            <div
                                                key={`${pIdx}-${sIdx}`}
                                                className={clsx(
                                                    "my-4 flex justify-center animate-in fade-in duration-500 cursor-zoom-in hover:brightness-110 active:scale-95 transition-all",
                                                    theme === 'dark' && "tikz-dark-invert"
                                                )}
                                                style={{ zoom: 1.6 }}
                                                dangerouslySetInnerHTML={{ __html: cachedSvg }}
                                                onClick={() => onZoom?.(<div style={{ zoom: 2.2 }} dangerouslySetInnerHTML={{ __html: cachedSvg }} />)}
                                            />
                                        );
                                    }

                                    // DEBUGGING CACHE MISS

                                    const libraries = '\\usetikzlibrary{arrows,calc,intersections,shapes.geometric,patterns,positioning,angles,quotes,3d}';
                                    const enrichedPart = `${libraries}\n${sub}`;

                                    return (
                                        <div
                                            key={`${pIdx}-${sIdx}`}
                                            className={clsx(
                                                "w-full my-4 overflow-visible cursor-zoom-in hover:brightness-110 active:scale-95 transition-all",
                                                theme === 'dark' && "tikz-dark-invert"
                                            )}
                                            style={{ zoom: 1.6 }}
                                        >
                                            <TikZEmbed code={enrichedPart} onRender={(svg) => onRenderSvg?.(sub, svg)} />
                                        </div>
                                    );
                                } else if (sub) {
                                    const hasTabular = sub.includes('\\begin{tabular}');
                                    return (
                                        <span
                                            key={`${pIdx}-${sIdx}`}
                                            className={clsx(hasTabular && "cursor-zoom-in hover:bg-black/5 rounded-lg transition-colors p-1 inline-block")}
                                            dangerouslySetInnerHTML={{ __html: renderMath(sub, macros) }}
                                            onClick={() => {
                                                if (hasTabular) {
                                                    onZoom?.(<div className="text-4xl p-8" dangerouslySetInnerHTML={{ __html: renderMath(sub, macros) }} />);
                                                }
                                            }}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </React.Fragment>
                    );
                } else if (part.type === 'multicols') {
                    return (
                        <div key={pIdx} className="my-4" style={{ columnCount: part.cols, columnGap: '1.5rem' }}>
                            <LatexRenderer content={part.content} cachedImages={cachedImages} theme={theme} onInteract={onInteract} basePath={basePath} macros={macros} onZoom={onZoom} fileRef={fileRef} />
                        </div>
                    );
                } else if (part.type === 'enumerate') {
                    const trimmed = part.opt.trim();
                    const listStyle = trimmed === 'a)' || trimmed === 'A)' || trimmed === '1)' || trimmed === 'i)' || trimmed === 'lower-alpha'
                        ? (trimmed.startsWith('a') || trimmed === 'lower-alpha' ? 'lower-alpha' : trimmed.startsWith('A') ? 'upper-alpha' : trimmed.startsWith('i') ? 'lower-roman' : 'decimal')
                        : 'decimal';

                    const rawItems = splitByTopLevelItem(part.content);
                    const items = rawItems.filter(it => it.trim().startsWith('\\item'));
                    const preamble = rawItems.find(it => !it.trim().startsWith('\\item')) || "";

                    let startVal = 1;
                    const setCounterMatch = preamble.match(/\\setcounter\{enumi\}\{(\d+)\}/);
                    if (setCounterMatch) {
                        // \setcounter{enumi}{k} means the previous item was k. The next item is k+1.
                        // So start attribute should be k+1.
                        startVal = parseInt(setCounterMatch[1], 10) + 1;
                    }

                    return (
                        <ol key={pIdx} className="ml-6 space-y-2 list-custom" style={{ listStyleType: listStyle }} start={startVal}>
                            {items.map((item: string, idx: number) => {
                                const content = item.replace(/^\s*\\item(\s*\[[^\]]*\])?\s*/, '');
                                return (
                                    <li key={idx} className="pl-1" style={{ breakInside: 'avoid' }}>
                                        <LatexRenderer content={content} cachedImages={cachedImages} theme={theme} onInteract={onInteract} basePath={basePath} macros={macros} onZoom={onZoom} fileRef={fileRef} />
                                    </li>
                                );
                            })}
                        </ol>
                    );
                } else if (part.type === 'itemize') {
                    const items = splitByTopLevelItem(part.content).filter(it => it.trim().startsWith('\\item'));
                    return (
                        <ul key={pIdx} className="ml-6 space-y-2 list-disc" >
                            {items.map((item: string, idx: number) => {
                                const content = item.replace(/^\s*\\item(\s*\[[^\]]*\])?\s*/, '');
                                return (
                                    <li key={idx} className="pl-1" style={{ breakInside: 'avoid' }}>
                                        <LatexRenderer content={content} cachedImages={cachedImages} theme={theme} onInteract={onInteract} basePath={basePath} macros={macros} fileRef={fileRef} />
                                    </li>
                                );
                            })}
                        </ul>
                    );
                } else if (part.type === 'immini') {
                    return (
                        <div key={pIdx} className="my-4 flex flex-col md:flex-row gap-6 items-start">
                            <div className="flex-1 min-w-0">
                                <LatexRenderer content={part.content} cachedImages={cachedImages} theme={theme} onInteract={onInteract} basePath={basePath} macros={macros} onZoom={onZoom} fileRef={fileRef} />
                            </div>
                            <div className="shrink-0">
                                <LatexRenderer content={part.image} cachedImages={cachedImages} theme={theme} onInteract={onInteract} basePath={basePath} macros={macros} onZoom={onZoom} fileRef={fileRef} />
                            </div>
                        </div>
                    );
                } else if (part.type === 'audio') {
                    return (
                        <div key={pIdx} className="my-6 p-4 bg-indigo-50/50 rounded-2xl flex items-center gap-4 border border-indigo-100/50">
                            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                <span className="text-xs uppercase font-bold tracking-tighter">Audio</span>
                            </div>
                            <ResolvedMedia
                                type="audio"
                                relativePath={part.path || ''}
                                fileRef={fileRef}
                                basePath={basePath}
                                className="h-10 grow"
                            />
                        </div>
                    );
                } else if (part.type === 'video') {
                    return (
                        <div key={pIdx} className="my-8 flex justify-center">
                            <div className="w-full max-w-2xl aspect-video bg-black rounded-2xl shadow-2xl overflow-hidden border-4 border-white dark:border-gray-800">
                                <ResolvedMedia
                                    type="video"
                                    relativePath={part.path || ''}
                                    fileRef={fileRef}
                                    basePath={basePath}
                                    className="w-full h-full"
                                />
                            </div>
                        </div>
                    );
                } else {
                    return null; // Should not happen if all types are handled
                }
            })}
        </div>
    );
};
