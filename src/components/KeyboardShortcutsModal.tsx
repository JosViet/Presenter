import React from 'react';
import { X, Keyboard } from 'lucide-react';
import clsx from 'clsx';

interface ShortcutItem {
    keys: string[];
    desc: string;
}

interface ShortcutCategory {
    name: string;
    items: ShortcutItem[];
}

const shortcuts: ShortcutCategory[] = [
    {
        name: 'Điều hướng',
        items: [
            { keys: ['←', '→'], desc: 'Chuyển slide trước/sau' },
            { keys: ['Home'], desc: 'Về slide đầu tiên' },
            { keys: ['End'], desc: 'Đến slide cuối cùng' },
            { keys: ['G'], desc: 'Mở tổng quan slides' },
        ]
    },
    {
        name: 'Hiển thị',
        items: [
            { keys: ['R'], desc: 'Hiện/ẩn đáp án' },
            { keys: ['S'], desc: 'Hiện/ẩn lời giải' },
            { keys: ['T'], desc: 'Chuyển đổi theme sáng/tối' },
            { keys: ['Space'], desc: 'Tiến tới bước tiếp theo' },
            { keys: ['↑', 'Backspace'], desc: 'Quay lại bước trước' },
            { keys: ['Shift + Space'], desc: 'Hiện tất cả bước cùng lúc' },
            { keys: ['P'], desc: 'Bật/tắt chế độ tự động reveal' },
        ]
    },
    {
        name: 'Công cụ',
        items: [
            { keys: ['D'], desc: 'Bật/tắt chế độ vẽ' },
            { keys: ['W'], desc: 'Bật/tắt bảng phụ (whiteboard)' },
            { keys: ['L'], desc: 'Bật/tắt con trỏ laser' },
            { keys: ['Esc'], desc: 'Đóng overlay/modal' },
        ]
    },
    {
        name: 'Annotation',
        items: [
            { keys: ['Ctrl', 'Z'], desc: 'Hoàn tác nét vẽ' },
            { keys: ['Ctrl', 'Y'], desc: 'Làm lại nét vẽ' },
            { keys: ['Shift + Kéo'], desc: 'Vẽ hình vuông/tròn hoàn hảo' },
        ]
    },
];

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<Props> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-slate-700 max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                            <Keyboard className="text-indigo-600 dark:text-indigo-400" size={24} />
                        </div>
                        Phím tắt
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Shortcuts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {shortcuts.map((category, idx) => (
                        <div key={idx} className="space-y-3">
                            <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                {category.name}
                            </h3>
                            <div className="space-y-2">
                                {category.items.map((item, itemIdx) => (
                                    <div
                                        key={itemIdx}
                                        className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
                                    >
                                        <span className="text-gray-600 dark:text-gray-300 text-sm">
                                            {item.desc}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {item.keys.map((key, keyIdx) => (
                                                <React.Fragment key={keyIdx}>
                                                    <kbd className={clsx(
                                                        "px-2 py-1 text-xs font-bold rounded border shadow-sm",
                                                        "bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200",
                                                        "border-gray-200 dark:border-slate-600"
                                                    )}>
                                                        {key}
                                                    </kbd>
                                                    {keyIdx < item.keys.length - 1 && (
                                                        <span className="text-gray-400 text-xs">+</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-700 text-center">
                    <p className="text-sm text-gray-400">
                        Nhấn <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600">?</kbd> hoặc <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600">F1</kbd> để mở/đóng
                    </p>
                </div>
            </div>
        </div>
    );
};
