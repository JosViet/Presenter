import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface ZoomOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    theme?: 'light' | 'sepia' | 'dark';
}

export const ZoomOverlay: React.FC<ZoomOverlayProps> = ({ isOpen, onClose, children, theme = 'light' }) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    const themeStyles = {
        light: "bg-white/95 text-gray-900",
        sepia: "bg-amber-50/95 text-amber-950",
        dark: "bg-gray-900/95 text-gray-100"
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 backdrop-blur-md animate-in fade-in duration-300">
            {/* Background Overlay - Click to close */}
            <div
                className={clsx("absolute inset-0", themeStyles[theme])}
                onClick={onClose}
            />

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-6xl max-h-full overflow-auto bg-transparent flex flex-col items-center animate-in zoom-in-95 duration-500">
                {/* Header/Toolbar */}
                <div className="absolute top-0 right-0 p-4 flex gap-4">
                    <button
                        onClick={onClose}
                        className="p-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all hover:rotate-90 active:scale-95"
                        title="Đóng (Esc)"
                    >
                        <X size={32} strokeWidth={3} />
                    </button>
                </div>

                {/* Main Content */}
                <div className="w-full flex justify-center py-12 px-4 select-none">
                    <div className="bg-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-sm border border-white/10 min-w-[300px] flex justify-center">
                        {children}
                    </div>
                </div>

                <div className="mt-4 text-sm opacity-50 font-medium italic">
                    Nhấp vào vùng trống hoặc nhấn Esc để thoát chế độ phóng đại
                </div>
            </div>
        </div>
    );
};
