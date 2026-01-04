import React, { useRef, useState, useEffect } from 'react';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import {
    Eraser, Trash2, X, MousePointer2,
    Square, Circle, Minus, ArrowRight, Highlighter, Type, Undo2
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

            {/* PRO TOOLBAR - VERTICAL RIGHT SIDE */}
            {isActive && (
                <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[110] flex flex-row-reverse items-start gap-4 animate-in slide-in-from-right-12 duration-500 ease-out">

                    {/* Main Toolbar Strip */}
                    <div className="flex flex-col items-center gap-2 p-2 bg-slate-900/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem] border border-white/10 transition-all">

                        {/* Toggle Collapse Button (Optional if list is long) */}
                        {/* Drawing Tools */}
                        <div className="flex flex-col items-center gap-1.5 py-1 border-b border-white/10 w-full">
                            <ToolButton active={tool === 'pen'} icon={<MousePointer2 size={20} />} onClick={() => { setTool('pen'); canvasRef.current?.eraseMode(false); }} title="Bút kỹ thuật" />
                            <ToolButton active={tool === 'highlighter'} icon={<Highlighter size={20} />} onClick={() => { setTool('highlighter'); canvasRef.current?.eraseMode(false); }} title="Bút dạ quang" />
                            <ToolButton active={tool === 'eraser'} icon={<Eraser size={20} />} onClick={() => { setTool('eraser'); canvasRef.current?.eraseMode(true); }} title="Tẩy" />
                        </div>

                        {/* Geometric Tools */}
                        <div className="flex flex-col items-center gap-1.5 py-1 border-b border-white/10 w-full">
                            <ToolButton active={tool === 'line'} icon={<Minus size={20} className="-rotate-45" />} onClick={() => setTool('line')} title="Đường thẳng" />
                            <ToolButton active={tool === 'circle'} icon={<Circle size={20} />} onClick={() => setTool('circle')} title="Hình tròn" />
                            <ToolButton active={tool === 'rectangle'} icon={<Square size={20} />} onClick={() => setTool('rectangle')} title="Hình chữ nhật" />
                            {/* Hidden less used shapes to save space or put in 'More' */}
                            <ToolButton active={tool === 'arrow'} icon={<ArrowRight size={20} />} onClick={() => setTool('arrow')} title="Mũi tên" />
                        </div>

                        {/* Colors & Width Trigger */}
                        <div className="flex flex-col items-center gap-1.5 py-1 w-full">
                            <button
                                onClick={() => setIsWidthMenuOpen(!isWidthMenuOpen)}
                                className="flex items-center justify-center p-2 rounded-xl transition-colors hover:bg-white/10 relative group"
                                title="Độ dày & Màu sắc"
                            >
                                <div className="w-5 h-5 rounded-full ring-2 ring-white/30" style={{ backgroundColor: color }}>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-white rounded-full shadow-sm" style={{ width: Math.max(4, strokeWidth / 1.5), height: Math.max(4, strokeWidth / 1.5) }} />
                                    </div>
                                </div>
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col items-center gap-1.5 py-1 w-full border-t border-white/10 pt-2">
                            <ToolButton icon={<Undo2 size={20} />} onClick={undo} disabled={historyStack.length === 0} title="Hoàn tác" />
                            <ToolButton icon={<Trash2 size={20} />} onClick={() => { if (confirm("Xóa bảng?")) { canvasRef.current?.clearCanvas(); setTimeout(() => notifyParent([]), 50); } }} title="Xóa hết" className="text-red-400 hover:bg-red-500/20" />
                            <button onClick={onClose} className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all mt-1">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Popover Settings (Colors & Width) - Shows when clicking the color dot */}
                    {isWidthMenuOpen && (
                        <div className="flex flex-col gap-4 p-4 bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl animate-in fade-in slide-in-from-right-8 mr-2">
                            <div className="grid grid-cols-2 gap-2">
                                {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ffffff', '#000000'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={clsx(
                                            "w-8 h-8 rounded-full ring-2 transition-all",
                                            color === c ? "ring-indigo-500 scale-110 shadow-lg" : "ring-transparent group-hover:scale-105"
                                        )}
                                        style={{ backgroundColor: c, border: c === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                                    />
                                ))}
                            </div>
                            <div className="h-px bg-slate-200" />
                            <div className="flex flex-col gap-2">
                                {[2, 4, 8, 12, 16].map(w => (
                                    <button
                                        key={w}
                                        onClick={() => setStrokeWidth(w)}
                                        className={clsx(
                                            "flex items-center gap-3 p-1.5 rounded-lg transition-all",
                                            strokeWidth === w ? "bg-indigo-50 text-indigo-600" : "hover:bg-slate-50 text-slate-500"
                                        )}
                                    >
                                        <div className="bg-current rounded-full" style={{ width: w, height: w }} />
                                        <span className="text-xs font-bold">{w}px</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
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
