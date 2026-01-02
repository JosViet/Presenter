import React, { useState, useEffect } from 'react';
import { LatexConfigService, LatexConfig, ReplacementRule } from '../services/LatexConfig';

interface LatexSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
}

export const LatexSettingsModal: React.FC<LatexSettingsModalProps> = ({ isOpen, onClose, children }) => {
    const [config, setConfig] = useState<LatexConfig>({ replacements: [], macros: {} });
    const [editingRule, setEditingRule] = useState<ReplacementRule | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    // Form state
    const [pattern, setPattern] = useState('');
    const [replacement, setReplacement] = useState('');
    const [description, setDescription] = useState('');
    const [numArgs, setNumArgs] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setConfig(LatexConfigService.getConfig());
        }
    }, [isOpen]);

    const handleSaveRule = async () => {
        if (!pattern || !replacement) return;

        const newRule: ReplacementRule = {
            pattern,
            replacement,
            description,
            flags: 'g',
            numArgs: numArgs > 0 ? numArgs : undefined
        };

        let newReplacements = [...config.replacements];
        if (editingRule) { // Editing existing
            newReplacements = newReplacements.map(r => r === editingRule ? newRule : r);
        } else { // Adding new
            newReplacements.push(newRule);
        }

        const newConfig = { ...config, replacements: newReplacements };
        await LatexConfigService.saveConfig(newConfig);
        setConfig(newConfig);
        resetForm();
    };

    const handleDeleteRule = async (rule: ReplacementRule) => {
        if (!confirm('Bạn có chắc muốn xóa quy tắc này?')) return;
        const newReplacements = config.replacements.filter(r => r !== rule);
        const newConfig = { ...config, replacements: newReplacements };
        await LatexConfigService.saveConfig(newConfig);
        setConfig(newConfig);
    };

    const startEdit = (rule: ReplacementRule) => {
        setEditingRule(rule);
        setPattern(rule.pattern);
        setReplacement(rule.replacement);
        setDescription(rule.description || '');
        setNumArgs(rule.numArgs || 0);
        setIsAdding(true);
    };

    const resetForm = () => {
        setEditingRule(null);
        setPattern('');
        setReplacement('');
        setDescription('');
        setNumArgs(0);
        setIsAdding(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col pt-0 overflow-hidden border border-slate-200 dark:border-slate-700">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">⚙️</span> Cấu hình LaTeX
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Intro */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-lg text-sm border border-blue-100 dark:border-blue-800">
                        <p><strong>Tính năng thay thế lệnh:</strong> Giúp bạn tự động sửa các lệnh LaTeX lạ hoặc lỗi khi chuyển máy.</p>
                        <p className="mt-1 opacity-75">Ví dụ: Pattern: <code>\\bluetext</code> ➝ Replacement: <code>{'\\textcolor{blue}'}</code></p>
                    </div>

                    {/* Rule List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-lg dark:text-white">Danh sách quy tắc ({config.replacements.length})</h3>
                            {!isAdding && (
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 shadow-sm transition-all"
                                >
                                    <span>➕</span> Thêm quy tắc mới
                                </button>
                            )}
                        </div>

                        {isAdding && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 border border-indigo-200 dark:border-indigo-900 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold uppercase text-slate-500">Pattern (Lệnh gốc)</label>
                                        <input
                                            className="w-full p-2 border rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white font-mono text-sm"
                                            placeholder="VD: \\heva"
                                            value={pattern}
                                            onChange={e => setPattern(e.target.value)}
                                        />
                                        <p className="text-[10px] text-slate-400">Nhớ dùng <code>\\</code> để escape dấu backslash.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold uppercase text-slate-500">Replacement (Thay thế)</label>
                                        <input
                                            className="w-full p-2 border rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white font-mono text-sm"
                                            placeholder="VD: \\begin{cases} #1 \end{cases}"
                                            value={replacement}
                                            onChange={e => setReplacement(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="col-span-1 space-y-1">
                                        <label className="text-xs font-semibold uppercase text-slate-500">Tham số (Args)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="9"
                                            className="w-full p-2 border rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white text-sm"
                                            value={numArgs}
                                            onChange={e => setNumArgs(parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-xs font-semibold uppercase text-slate-500">Mô tả (Tùy chọn)</label>
                                        <input
                                            className="w-full p-2 border rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white text-sm"
                                            placeholder="Giải thích quy tắc này làm gì..."
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                        />
                                    </div>
                                </div>
                                {numArgs > 0 && (
                                    <p className="text-[10px] text-indigo-500 italic">
                                        Chế độ Macro: Dùng <code>#1</code>, <code>#2</code>... trong Replacement để chèn tham số.
                                    </p>
                                )}
                                <div className="flex justify-end gap-2 pt-2">
                                    <button onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded dark:text-slate-300 dark:hover:bg-slate-700">Hủy</button>
                                    <button
                                        onClick={handleSaveRule}
                                        disabled={!pattern || !replacement}
                                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {editingRule ? 'Cập nhật' : 'Lưu quy tắc'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold w-1/4">Pattern</th>
                                        <th className="px-4 py-3 font-semibold w-1/4">Replacement</th>
                                        <th className="px-4 py-3 font-semibold w-1/3">Mô tả</th>
                                        <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {config.replacements.map((rule, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 truncate max-w-[150px]" title={rule.pattern}>{rule.pattern}</td>
                                            <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400 truncate max-w-[150px]" title={rule.replacement}>{rule.replacement}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                {rule.description || '-'}
                                                {rule.numArgs ? <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 text-xs font-bold">{rule.numArgs} args</span> : null}
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-2">
                                                <button onClick={() => startEdit(rule)} className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded">✏️</button>
                                                <button onClick={() => handleDeleteRule(rule)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded">🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {config.replacements.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                                                Chưa có quy tắc nào.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Advanced Tools Section (Children) */}
                        {children && (
                            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="font-semibold text-lg dark:text-white mb-4">Công cụ nâng cao</h3>
                                {children}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-right">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg transition-colors">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};
