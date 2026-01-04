import React from 'react';
import clsx from 'clsx';

interface ToolButtonProps {
    active?: boolean;
    icon: React.ReactNode;
    onClick: () => void;
    title: string;
    disabled?: boolean;
    className?: string; // Added className prop
}

export const ToolButton: React.FC<ToolButtonProps> = ({ active = false, icon, onClick, title, disabled = false, className }) => (
    <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={clsx(
            "p-3.5 rounded-full transition-all duration-300 relative group active:scale-90",
            disabled
                ? "text-white/20 cursor-not-allowed"
                : active
                    ? "bg-white text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                    : "text-white/60 hover:text-white hover:bg-white/10",
            className // Apply custom className
        )}
        title={title}
    >
        {icon}
        {active && !disabled && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]" />}
        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            {title}
        </div>
    </button>
);

