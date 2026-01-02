import React, { useEffect, useState } from 'react';
import { X, Trash2, Plus, Search, Calendar, FileText, Image as ImageIcon } from 'lucide-react';

interface Snippet {
    id: string;
    name: string;
    date: number;
    path: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (paths: any[]) => void;
    onSaveCurrent: (name: string) => Promise<void>;
}

export const SnippetGallery: React.FC<Props> = ({ isOpen, onClose, onSelect, onSaveCurrent }) => {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [search, setSearch] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [newName, setNewName] = useState("");
    const [loading, setLoading] = useState(false);

    const loadSnippets = async () => {
        setLoading(true);
        try {
            const list = await window.electronAPI.listSnippets();
            setSnippets(list);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadSnippets();
            setSearch("");
            setIsSaving(false);
            setNewName("");
        }
    }, [isOpen]);

    const handleSave = async () => {
        if (!newName.trim()) return;
        setLoading(true);
        try {
            await onSaveCurrent(newName.trim());
            await loadSnippets();
            setIsSaving(false);
            setNewName("");
        } catch (error) {
            alert("Lỗi khi lưu hình: " + error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Bạn có chắc chắn muốn xóa hình này?")) return;
        setLoading(true);
        try {
            await window.electronAPI.deleteSnippet(id);
            await loadSnippets();
        } catch (error) {
            alert("Lỗi khi xóa hình");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (id: string) => {
        setLoading(true);
        try {
            const paths = await window.electronAPI.getSnippet(id);
            if (paths) {
                onSelect(paths);
                onClose();
            }
        } catch (error) {
            alert("Lỗi khi tải hình");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filtered = snippets.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />

            <div className="relative bg-white w-full max-w-3xl max-h-[85vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-8 border-b flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Thư viện hình vẽ</h2>
                        <p className="text-slate-500 font-medium">Kho tài nguyên hình học cá nhân của bạn</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all active:scale-95">
                        <X size={28} className="text-slate-600" />
                    </button>
                </div>

                {/* Search & Actions Area */}
                <div className="px-8 py-6 bg-white flex items-center gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm hình vẽ (ví dụ: Hình chóp, lăng trụ...)"
                            className="w-full pl-12 pr-6 py-3.5 bg-slate-100 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-500/50 outline-none transition-all font-medium"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setIsSaving(true)}
                        className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 shrink-0"
                    >
                        <Plus size={20} />
                        Lưu hình hiện tại
                    </button>
                </div>

                {/* Save Form (Overlay inside content) */}
                {isSaving && (
                    <div className="mx-8 mb-6 p-6 bg-indigo-600 rounded-2xl animate-in slide-in-from-top-4 shadow-xl shadow-indigo-100">
                        <div className="text-white mb-4 font-bold flex items-center gap-2">
                            <FileText size={18} /> Đặt tên cho hình vẽ mới
                        </div>
                        <div className="flex gap-3">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Nhập tên gợi nhớ..."
                                className="flex-1 px-5 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/50 rounded-xl outline-none focus:bg-white/20 transition-all font-bold"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSave()}
                            />
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="px-6 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:bg-slate-100 transition-all shadow-md"
                            >
                                Lưu ngay
                            </button>
                            <button
                                onClick={() => setIsSaving(false)}
                                className="px-6 py-3 bg-white/20 text-white rounded-xl font-bold hover:bg-white/30 transition-all"
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                )}

                {/* Grid Content */}
                <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                    {loading && snippets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <p className="font-bold text-slate-500 tracking-widest uppercase text-xs">Đang đồng bộ thư viện...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                            <ImageIcon size={80} className="mb-6 opacity-10" />
                            <p className="font-bold uppercase tracking-[0.2em] text-sm mb-2">Trống</p>
                            <p className="text-sm font-medium text-slate-400">Chưa có hình vẽ nào phù hợp với tìm kiếm của bạn</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filtered.map(snippet => (
                                <div
                                    key={snippet.id}
                                    onClick={() => handleSelect(snippet.id)}
                                    className="group bg-slate-50 p-5 rounded-[1.5rem] border-2 border-transparent hover:border-indigo-500/30 hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer relative"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h3 className="font-bold text-slate-800 truncate text-lg group-hover:text-indigo-600 transition-colors">{snippet.name}</h3>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                                                <Calendar size={12} />
                                                {new Date(snippet.date).toLocaleDateString('vi-VN')}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(e, snippet.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                                            title="Xóa hình"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    {/* Preview Box */}
                                    <div className="aspect-[4/3] bg-white rounded-2xl border border-slate-100 flex items-center justify-center shadow-inner group-hover:bg-slate-50 transition-colors">
                                        <div className="flex flex-col items-center gap-2 opacity-20 group-hover:opacity-40 transition-opacity">
                                            <ImageIcon size={32} className="text-slate-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sketch Snippet</span>
                                        </div>
                                    </div>

                                    {/* Decorative Tag */}
                                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-slate-200 group-hover:bg-indigo-400 transition-colors" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
