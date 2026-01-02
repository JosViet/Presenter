import React, { useState, useEffect } from 'react';

export const LaserPointer: React.FC<{ enabled: boolean }> = ({ enabled }) => {
    const [pos, setPos] = useState({ x: -100, y: -100 });

    useEffect(() => {
        if (!enabled) return;

        const handleMouseMove = (e: MouseEvent) => {
            setPos({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);

        // Hide default cursor globally when laser is active
        document.body.style.cursor = 'none';

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.body.style.cursor = 'default';
        };
    }, [enabled]);

    if (!enabled) return null;

    return (
        <div
            className="fixed inset-0 pointer-events-none z-[200]"
            style={{ cursor: 'none' }}
        >
            <div
                className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                    left: pos.x,
                    top: pos.y,
                    background: 'radial-gradient(circle, rgba(239,68,68,1) 0%, rgba(239,68,68,0.4) 40%, rgba(239,68,68,0) 70%)',
                    boxShadow: '0 0 15px rgba(239,68,68,0.8)',
                }}
            />
            {/* Visual core */}
            <div
                className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full shadow-sm"
                style={{ left: pos.x, top: pos.y }}
            />
        </div>
    );
};
