import React, { useEffect, useState } from 'react';
import { Point } from '../services/shape_recognizer';

type ToolType = 'pen' | 'highlighter' | 'eraser' | 'line' | 'circle' | 'rectangle' | 'arrow' | 'triangle';

interface ShapePreviewOverlayProps {
    onCommit: (start: Point, end: Point, tool: ToolType, shiftKey?: boolean) => void;
}

/**
 * ShapePreviewOverlay handles the high-performance drawing preview
 * by using its own state and event listeners to avoid re-rendering
 * the entire parent component.
 */
export const ShapePreviewOverlay: React.FC<ShapePreviewOverlayProps> = ({ onCommit }) => {
    const [preview, setPreview] = useState<{
        start: Point;
        current: Point;
        tool: ToolType;
        color: string;
        strokeWidth: number;
        shiftKey?: boolean;
    } | null>(null);

    useEffect(() => {
        const handleStart = (e: any) => setPreview({ ...e.detail, current: e.detail.start });
        const handleMove = (e: any) => setPreview(prev => prev ? { ...prev, current: e.detail.current, shiftKey: e.detail.shiftKey } : null);
        const handleEnd = (e: any) => {
            setPreview(prev => {
                if (prev) onCommit(prev.start, e.detail.end, prev.tool, e.detail.shiftKey);
                return null;
            });
        };

        window.addEventListener('shape-start', handleStart);
        window.addEventListener('shape-move', handleMove);
        window.addEventListener('shape-end', handleEnd);
        return () => {
            window.removeEventListener('shape-start', handleStart);
            window.removeEventListener('shape-move', handleMove);
            window.removeEventListener('shape-end', handleEnd);
        };
    }, [onCommit]);

    if (!preview) return null;
    let { start, current, tool, color, strokeWidth, shiftKey } = preview;

    // Apply Shift Constraint for visual feedback
    if (shiftKey && (tool === 'rectangle' || tool === 'circle' || tool === 'triangle')) {
        const dx = current.x - start.x;
        const dy = current.y - start.y;
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        current = {
            x: start.x + (dx > 0 ? side : -side),
            y: start.y + (dy > 0 ? side : -side)
        };
    }

    const strokeProps = {
        stroke: color,
        strokeWidth: strokeWidth,
        fill: "none",
        strokeDasharray: "4 4"
    };

    let shape: React.ReactNode = null;
    if (tool === 'line') {
        shape = <line x1={start.x} y1={start.y} x2={current.x} y2={current.y} {...strokeProps} />;
    } else if (tool === 'circle') {
        const cx = (start.x + current.x) / 2;
        const cy = (start.y + current.y) / 2;
        const rx = Math.abs(current.x - start.x) / 2;
        const ry = Math.abs(current.y - start.y) / 2;
        shape = <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...strokeProps} />;
    } else if (tool === 'rectangle') {
        const x = Math.min(start.x, current.x);
        const y = Math.min(start.y, current.y);
        const w = Math.abs(current.x - start.x);
        const h = Math.abs(current.y - start.y);
        shape = <rect x={x} y={y} width={w} height={h} {...strokeProps} />;
    } else if (tool === 'arrow') {
        const dx = current.x - start.x;
        const dy = current.y - start.y;
        const angle = Math.atan2(dy, dx);
        const headLength = 15;
        const headAngle = Math.PI / 7;
        shape = (
            <g {...strokeProps}>
                <line x1={start.x} y1={start.y} x2={current.x} y2={current.y} />
                <line x1={current.x} y1={current.y} x2={current.x - headLength * Math.cos(angle - headAngle)} y2={current.y - headLength * Math.sin(angle - headAngle)} />
                <line x1={current.x} y1={current.y} x2={current.x - headLength * Math.cos(angle + headAngle)} y2={current.y - headLength * Math.sin(angle + headAngle)} />
            </g>
        );
    } else if (tool === 'triangle') {
        const topX = (start.x + current.x) / 2;
        const topY = Math.min(start.y, current.y);
        const bottomY = Math.max(start.y, current.y);
        const leftX = Math.min(start.x, current.x);
        const rightX = Math.max(start.x, current.x);
        shape = (
            <path
                d={`M${topX},${topY} L${rightX},${bottomY} L${leftX},${bottomY} Z`}
                {...strokeProps}
            />
        );
    }

    return (
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-[120]">
            {shape}
        </svg>
    );
};

export type { ToolType };
