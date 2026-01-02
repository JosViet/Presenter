import React, { useRef, useState, useEffect } from 'react';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import {
    Eraser, Trash2, X, LayoutGrid, MousePointer2,
    Square, Circle, Minus, ArrowRight, Highlighter, Type, Triangle, Undo2, Redo2
} from 'lucide-react';
import { ShapeGenerator, Point } from '../services/shape_recognizer';
import { SnippetGallery } from './SnippetGallery';
import { ShapePreviewOverlay, ToolType } from './ShapePreviewOverlay';
import { ToolButton } from './ToolButton';
import clsx from 'clsx';

interface Props {
    isActive: boolean;
    onClose: () => void;
    initialPaths?: any[];
    onStroke?: (paths: any[]) => void;
    isWhiteboard?: boolean;
    slideId?: string | number;
}



export const AnnotationLayer: React.FC<Props> = ({ isActive, onClose, initialPaths, onStroke, isWhiteboard, slideId }) => {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const lastContextRef = useRef<string>("");
    const lastSerializedRef = useRef<string>("");

    // Performance Optimization: Cache paths locally to avoid expensive export calls
    const pathsRef = useRef<any[]>(initialPaths || []);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup debounce timer on unmount to prevent memory leak
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    // State
    const [tool, setTool] = useState<ToolType>('pen');
    const [color, setColor] = useState('#ef4444');
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [isWidthMenuOpen, setIsWidthMenuOpen] = useState(false);

    // Undo/Redo State
    const [historyStack, setHistoryStack] = useState<any[][]>([]);
    const [futureStack, setFutureStack] = useState<any[][]>([]);

    // Save current state to history before changes
    const saveToHistory = (currentPaths: any[]) => {
        setHistoryStack(h => [...h.slice(-19), [...currentPaths]]); // Keep last 20 states
        setFutureStack([]); // Clear redo stack on new action
    };

    // Undo function
    const undo = () => {
        if (historyStack.length === 0) return;
        const prevPaths = historyStack[historyStack.length - 1];
        setFutureStack(f => [...f, [...pathsRef.current]]);
        setHistoryStack(h => h.slice(0, -1));
        canvasRef.current?.clearCanvas();
        if (prevPaths.length > 0) {
            canvasRef.current?.loadPaths(prevPaths);
        }
        pathsRef.current = prevPaths;
        notifyParent(prevPaths);
    };

    // Redo function
    const redo = () => {
        if (futureStack.length === 0) return;
        const nextPaths = futureStack[futureStack.length - 1];
        setHistoryStack(h => [...h, [...pathsRef.current]]);
        setFutureStack(f => f.slice(0, -1));
        canvasRef.current?.clearCanvas();
        if (nextPaths.length > 0) {
            canvasRef.current?.loadPaths(nextPaths);
        }
        pathsRef.current = nextPaths;
        notifyParent(nextPaths);
    };

    // Keyboard shortcuts for Undo/Redo
    useEffect(() => {
        if (!isActive) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    undo();
                } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                    e.preventDefault();
                    redo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, historyStack, futureStack]);

    // Sync from parent
    useEffect(() => {
        const currentContext = `${slideId}-${isWhiteboard}`;

        // Helper to sanitize and repair paths (Fixes the freeze caused by invalid drawMode)
        const loadSafePaths = (paths: any[]) => {
            if (!paths || !Array.isArray(paths)) return;

            const safePaths = paths.map(p => {
                // Heuristic: If it has color and width but drawMode is false (or missing), it's likely a bug-induced "invisible" shape.
                // We force drawMode = true for anything that looks like a stroke.
                // Erasers usually have specific properties or we can just reset everything to draw first to recover data.
                const isLikelyEraser = p.strokeWidth > 20 && (p.strokeColor === '#000000' || p.strokeColor === 'transparent');

                return {
                    ...p,
                    drawMode: p.drawMode === undefined ? true : (isLikelyEraser ? p.drawMode : true),
                    paths: Array.isArray(p.paths) ? p.paths : []
                };
            }).filter(p => p.paths.length > 0);

            try {
                pathsRef.current = safePaths; // Sync local cache
                canvasRef.current?.loadPaths(safePaths);
            } catch (err) {
                console.error("Failed to load paths:", err);
            }
        };

        // Only reload if the context (Slide/Whiteboard) changes. 
        // We ignore 'initialPaths' changes because they are mostly just echoes of our own drawing.
        if (currentContext !== lastContextRef.current) {
            lastContextRef.current = currentContext;

            // Sync the serialized ref so we don't accidentally re-trigger
            lastSerializedRef.current = JSON.stringify(initialPaths || []);

            if (initialPaths && initialPaths.length > 0) {
                loadSafePaths(initialPaths);
            } else {
                canvasRef.current?.clearCanvas();
            }
        }
    }, [slideId, isWhiteboard]); // CRITICAL FIX: Removed initialPaths from dependency to stop infinite load loop

    const debouncedNotifyParent = (p: any[]) => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            notifyParent(p);
        }, 500); // 500ms debounce
    };

    const notifyParent = async (forcedPaths?: any[]) => {
        try {
            const p = forcedPaths || await canvasRef.current?.exportPaths() || [];
            lastSerializedRef.current = JSON.stringify(p);
            if (onStroke) onStroke(p);
        } catch (e) {
            console.error("Failed to export paths:", e);
        }
    };

    const handleStroke = async () => {
        // Save current state to history before the new stroke is added
        saveToHistory([...pathsRef.current]);
        // Small delay to let canvas update, then notify
        setTimeout(async () => {
            const paths = await canvasRef.current?.exportPaths() || [];
            pathsRef.current = paths;
            notifyParent(paths);
        }, 50);
    };

    // Shape Drawing Logic (Real-time)
    const onPointerDown = (e: React.PointerEvent) => {
        if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const start = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        // Use custom event for high-performance preview (avoids React re-renders)
        const event = new CustomEvent('shape-start', { detail: { start, tool, color, strokeWidth } });
        window.dispatchEvent(event);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        let current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        // Shift Key Constraint (Perfect Square/Circle)
        if (e.shiftKey) {
            // We need the start point to calculate constraint. 
            // Since we don't store "start" in React state for performance, we can't easily do it here 
            // WITHOUT converting this component to track "start" state or listening to the event detail.
            // HOWEVER, the ShapePreviewOverlay handles the rendering. We should pass the modifier key state to it.
            // Actually, let's just pass the raw current point and let the "logic" layer handle it?
            // No, the logic layer is `onCommit`. The interactive part is `ShapePreviewOverlay`.
            // Let's pass `originalEvent` or just the shiftKey boolean.
        }

        // Better approach: Pass the modifier state
        const event = new CustomEvent('shape-move', { detail: { current, shiftKey: e.shiftKey } });
        window.dispatchEvent(event);
    };

    const onPointerUp = async (e: React.PointerEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const endPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        const event = new CustomEvent('shape-end', { detail: { end: endPos, shiftKey: e.shiftKey } });
        window.dispatchEvent(event);
    };

    // This is the listener that actually commits the shape to the canvas
    const commitShape = async (start: Point, end: Point, activeTool: ToolType, shiftKey?: boolean) => {
        if (!canvasRef.current) return;

        // Apply Constraint if Shift is held
        let finalEnd = end;
        if (shiftKey && (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'triangle')) {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            finalEnd = {
                x: start.x + (dx > 0 ? side : -side),
                y: start.y + (dy > 0 ? side : -side)
            };
        }

        let shapePoints: Point[] = [];
        if (activeTool === 'line') shapePoints = ShapeGenerator.generateLine(start, finalEnd);
        else if (activeTool === 'circle') shapePoints = ShapeGenerator.generateEllipse(start, finalEnd);
        else if (activeTool === 'rectangle') shapePoints = ShapeGenerator.generateRectangle(start, finalEnd);
        else if (activeTool === 'arrow') shapePoints = ShapeGenerator.generateArrow(start, finalEnd);
        else if (activeTool === 'triangle') shapePoints = ShapeGenerator.generateTriangle(start, finalEnd);

        if (shapePoints.length > 0) {
            // OPTIMIZATION: Use local cache instead of awaiting exportPaths()
            const currentPaths = pathsRef.current;

            const newPath = {
                paths: shapePoints,
                strokeColor: color,
                strokeWidth: strokeWidth,
                drawMode: true, // IMPORTANT: Must be true for visible strokes
                startTimestamp: Date.now(),
                endTimestamp: Date.now()
            };

            const updatedPaths = [...currentPaths, newPath];
            pathsRef.current = updatedPaths; // Update cache immediately

            // Immediately load to canvas (DOM update)
            canvasRef.current?.loadPaths(updatedPaths);

            // Debounce the expensive parent state update
            debouncedNotifyParent(updatedPaths);
        }
    };

    return (
        <div className={clsx(
            "absolute inset-0 z-[100] transition-all duration-500 overflow-hidden",
            isActive ? "pointer-events-auto" : "pointer-events-none",
            isWhiteboard ? (isActive ? "bg-[#0f172a] opacity-100" : "bg-transparent opacity-0") : "bg-transparent"
        )}>
            {/* Whiteboard Header */}
            {isWhiteboard && isActive && (
                <div className="absolute top-8 left-10 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <Type size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-emerald-500/50 uppercase tracking-widest leading-none mb-1">Interactive</div>
                            <div className="text-lg font-bold text-white tracking-tight">Bảng Phụ Kỹ Thuật Số</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Shape Drawing Interaction Layer */}
            {(tool !== 'pen' && tool !== 'highlighter' && tool !== 'eraser') && isActive && (
                <div
                    className="absolute inset-0 z-[104] cursor-crosshair"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                />
            )}

            {/* Fast Native Preview Overlay (High Performance) */}
            <ShapePreviewOverlay onCommit={commitShape} />

            {/* Canvas */}
            <ReactSketchCanvas
                ref={canvasRef}
                strokeWidth={strokeWidth}
                strokeColor={tool === 'highlighter' ? color + '44' : color}
                canvasColor="transparent"
                eraserWidth={24}
                style={{ border: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
                allowOnlyPointerType={'all'}
                onStroke={handleStroke}
            />

            {/* PRO TOOLBAR (iPadOS Style) */}
            {isActive && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center gap-4 animate-in slide-in-from-bottom-12 duration-500 ease-out">

                    {/* Floating Settings Island */}
                    <div className="flex items-center gap-6 px-8 py-3 bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-3xl">

                        {/* Quick Colors */}
                        <div className="flex items-center gap-3 pr-6 border-r border-slate-200">
                            {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ffffff', '#000000'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className={clsx(
                                        "w-7 h-7 rounded-full transition-all duration-300 ring-2",
                                        color === c ? "ring-indigo-500 scale-125 shadow-lg" : "ring-transparent hover:scale-110"
                                    )}
                                    style={{ backgroundColor: c, border: c === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                                />
                            ))}
                        </div>

                        {/* Stroke Width Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setIsWidthMenuOpen(!isWidthMenuOpen)}
                                className="flex flex-col items-center justify-center gap-1 hover:bg-slate-100 p-2 rounded-xl transition-colors min-w-[48px]"
                            >
                                <div className="bg-slate-800 rounded-full" style={{ width: strokeWidth * 2, height: strokeWidth * 2 }} />
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{strokeWidth}px</span>
                            </button>

                            {isWidthMenuOpen && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-2 bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col gap-1 animate-in zoom-in-90 origin-bottom">
                                    {[2, 4, 8, 12].map(w => (
                                        <button
                                            key={w}
                                            onClick={() => { setStrokeWidth(w); setIsWidthMenuOpen(false); }}
                                            className={clsx(
                                                "w-12 h-12 flex items-center justify-center rounded-xl transition-all",
                                                strokeWidth === w ? "bg-indigo-50 text-indigo-600" : "hover:bg-slate-50 text-slate-400"
                                            )}
                                        >
                                            <div className="bg-current rounded-full" style={{ width: w, height: w }} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Toolbar Island */}
                    <div className="flex items-center gap-2 p-2 bg-slate-900/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2.5rem] border border-white/10">

                        {/* Drawing Tools */}
                        <div className="flex items-center gap-1.5 px-2 border-r border-white/10">
                            <ToolButton active={tool === 'pen'} icon={<MousePointer2 size={22} />} onClick={() => { setTool('pen'); canvasRef.current?.eraseMode(false); }} title="Bút kỹ thuật" />
                            <ToolButton active={tool === 'highlighter'} icon={<Highlighter size={22} />} onClick={() => { setTool('highlighter'); canvasRef.current?.eraseMode(false); }} title="Bút dạ quang" />
                            <ToolButton active={tool === 'eraser'} icon={<Eraser size={22} />} onClick={() => { setTool('eraser'); canvasRef.current?.eraseMode(true); }} title="Tẩy" />
                        </div>

                        {/* Geometric Tools */}
                        <div className="flex items-center gap-1.5 px-2 border-r border-white/10">
                            <ToolButton active={tool === 'line'} icon={<Minus size={22} className="-rotate-45" />} onClick={() => setTool('line')} title="Đường thẳng" />
                            <ToolButton active={tool === 'circle'} icon={<Circle size={22} />} onClick={() => setTool('circle')} title="Hình tròn/Ellipse (Giữ Shift để vẽ hình tròn hoàn hảo)" />
                            <ToolButton active={tool === 'rectangle'} icon={<Square size={22} />} onClick={() => setTool('rectangle')} title="Hình chữ nhật (Giữ Shift để vẽ hình vuông)" />
                            <ToolButton active={tool === 'triangle'} icon={<Triangle size={22} />} onClick={() => setTool('triangle')} title="Hình tam giác (Giữ Shift để vẽ tam giác đều)" />
                            <ToolButton active={tool === 'arrow'} icon={<ArrowRight size={22} />} onClick={() => setTool('arrow')} title="Mũi tên" />
                        </div>

                        {/* Management Tools */}
                        <div className="flex items-center gap-1.5 px-2">
                            <ToolButton
                                icon={<Undo2 size={22} />}
                                onClick={undo}
                                disabled={historyStack.length === 0}
                                title="Hoàn tác (Ctrl+Z)"
                            />
                            <ToolButton
                                icon={<Redo2 size={22} />}
                                onClick={redo}
                                disabled={futureStack.length === 0}
                                title="Làm lại (Ctrl+Y)"
                            />
                            <div className="w-px h-6 bg-white/10 mx-1" />
                            <button
                                onClick={() => {
                                    if (confirm("Xóa toàn bộ bản vẽ?")) {
                                        canvasRef.current?.clearCanvas();
                                        setTimeout(() => notifyParent([]), 50);
                                    }
                                }}
                                className="p-3.5 text-red-400 hover:bg-red-500/20 rounded-full transition-all active:scale-90"
                                title="Làm sạch bảng"
                            >
                                <Trash2 size={22} />
                            </button>
                            <button
                                onClick={() => setIsGalleryOpen(true)}
                                className="p-3.5 text-emerald-400 hover:bg-emerald-500/20 rounded-full transition-all active:scale-90"
                                title="Thư viện hình"
                            >
                                <LayoutGrid size={22} />
                            </button>
                            <div className="w-px h-6 bg-white/10 mx-1" />
                            <button
                                onClick={onClose}
                                className="p-3.5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
                            >
                                <X size={22} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <SnippetGallery
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
                onSelect={async (paths) => {
                    const current = pathsRef.current; // Use cache
                    const updated = [...current, ...paths];
                    pathsRef.current = updated;
                    canvasRef.current?.loadPaths(updated);
                    debouncedNotifyParent(updated);
                }}
                onSaveCurrent={async (name) => {
                    const current = await canvasRef.current?.exportPaths() || [];
                    if (current.length === 0) throw new Error("Không có bản vẽ nào để lưu");
                    await window.electronAPI.saveSnippet(name, current);
                }}
            />
        </div>
    );
};
