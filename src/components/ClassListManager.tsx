import React, { useState, useRef } from 'react';
import { X, Upload, Users, Trash2, Plus, UserPlus, FileSpreadsheet } from 'lucide-react';
import { useStudentList } from '../hooks/useStudentList';
import clsx from 'clsx';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const ClassListManager: React.FC<Props> = ({ isOpen, onClose }) => {
    const {
        classLists,
        activeClass,
        activeClassId,
        students,
        setActiveClassId,
        createClassFromText,
        createClassFromExcel,
        deleteClass,
        deleteStudent,
        addStudent,
    } = useStudentList();

    const [mode, setMode] = useState<'list' | 'add'>('list');
    const [inputMode, setInputMode] = useState<'paste' | 'excel'>('paste');
    const [className, setClassName] = useState('');
    const [pasteText, setPasteText] = useState('');
    const [newStudentName, setNewStudentName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleCreateFromPaste = () => {
        if (!className.trim() || !pasteText.trim()) return;
        createClassFromText(className.trim(), pasteText);
        setClassName('');
        setPasteText('');
        setMode('list');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !className.trim()) return;

        try {
            // Using xlsx library dynamically
            const XLSX = await import('xlsx');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            createClassFromExcel(className.trim(), rows);
            setClassName('');
            setMode('list');
        } catch (error) {
            console.error('Failed to read Excel file:', error);
            alert('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.');
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleAddStudent = () => {
        if (newStudentName.trim()) {
            addStudent(newStudentName.trim());
            setNewStudentName('');
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-xl">
                            <Users className="text-indigo-600" size={24} />
                        </div>
                        Quản lý Danh sách Lớp
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {mode === 'list' ? (
                        <>
                            {/* Class Selector */}
                            {classLists.length > 0 && (
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Chọn lớp</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {classLists.map((cls) => (
                                            <button
                                                key={cls.id}
                                                onClick={() => setActiveClassId(cls.id)}
                                                className={clsx(
                                                    "px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2",
                                                    activeClassId === cls.id
                                                        ? "bg-indigo-600 text-white"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                )}
                                            >
                                                {cls.name}
                                                <span className="text-xs opacity-70">({cls.students.length})</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Current Class Students */}
                            {activeClass ? (
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-gray-800">
                                            {activeClass.name} - {students.length} học sinh
                                        </h3>
                                        <button
                                            onClick={() => deleteClass(activeClass.id)}
                                            className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                                        >
                                            <Trash2 size={14} /> Xóa lớp
                                        </button>
                                    </div>

                                    {/* Add Student */}
                                    <div className="flex gap-2 mb-4">
                                        <input
                                            type="text"
                                            value={newStudentName}
                                            onChange={(e) => setNewStudentName(e.target.value)}
                                            placeholder="Thêm học sinh mới..."
                                            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                                        />
                                        <button
                                            onClick={handleAddStudent}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                                        >
                                            <UserPlus size={18} /> Thêm
                                        </button>
                                    </div>

                                    {/* Student List */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                                        {students.map((student) => (
                                            <div
                                                key={student.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group"
                                            >
                                                <span className="text-sm">
                                                    <span className="text-gray-400 mr-2">{student.index}.</span>
                                                    {student.name}
                                                </span>
                                                <button
                                                    onClick={() => deleteStudent(student.id)}
                                                    className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400">
                                    <Users size={48} className="mx-auto mb-4 opacity-30" />
                                    <p>Chưa có danh sách lớp nào.</p>
                                    <p className="text-sm">Nhấn "Thêm lớp mới" để bắt đầu.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Add New Class Form */
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Tên lớp</label>
                                <input
                                    type="text"
                                    value={className}
                                    onChange={(e) => setClassName(e.target.value)}
                                    placeholder="Ví dụ: 10A1, 9B2..."
                                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
                                />
                            </div>

                            {/* Input Mode Toggle */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setInputMode('paste')}
                                    className={clsx(
                                        "flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                                        inputMode === 'paste'
                                            ? "bg-indigo-600 text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    )}
                                >
                                    <Upload size={18} /> Dán danh sách
                                </button>
                                <button
                                    onClick={() => setInputMode('excel')}
                                    className={clsx(
                                        "flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                                        inputMode === 'excel'
                                            ? "bg-emerald-600 text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    )}
                                >
                                    <FileSpreadsheet size={18} /> Import Excel
                                </button>
                            </div>

                            {inputMode === 'paste' ? (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Danh sách học sinh (mỗi dòng = 1 học sinh)
                                    </label>
                                    <textarea
                                        value={pasteText}
                                        onChange={(e) => setPasteText(e.target.value)}
                                        placeholder="Nguyễn Văn A&#10;Trần Thị B&#10;Lê Văn C&#10;..."
                                        rows={8}
                                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Số học sinh: {pasteText.split('\n').filter(l => l.trim()).length}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        File Excel (.xlsx)
                                    </label>
                                    <p className="text-xs text-gray-500 mb-3">
                                        Tên học sinh ở cột B, bỏ qua dòng header đầu tiên
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleFileUpload}
                                        className="w-full px-4 py-3 border-2 border-dashed rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-between">
                    {mode === 'list' ? (
                        <>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 text-gray-600 hover:bg-gray-200 rounded-xl font-medium"
                            >
                                Đóng
                            </button>
                            <button
                                onClick={() => setMode('add')}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2"
                            >
                                <Plus size={20} /> Thêm lớp mới
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setMode('list')}
                                className="px-6 py-3 text-gray-600 hover:bg-gray-200 rounded-xl font-medium"
                            >
                                Quay lại
                            </button>
                            {inputMode === 'paste' && (
                                <button
                                    onClick={handleCreateFromPaste}
                                    disabled={!className.trim() || !pasteText.trim()}
                                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Tạo lớp
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
