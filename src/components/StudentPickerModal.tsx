import React, { useState, useEffect, useRef } from 'react';
import { X, Shuffle, UserCheck, Play, Sparkles } from 'lucide-react';
import { useStudentList, Student } from '../hooks/useStudentList';
import { ChasePicker } from './games/ChasePicker';
import clsx from 'clsx';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (students: Student[]) => void;
    autoStart?: 'random' | 'chase' | null; // Auto-trigger mode from Remote
}

type PickerMode = 'manual' | 'random' | 'chase';

export const StudentPickerModal: React.FC<Props> = ({ isOpen, onClose, onSelect, autoStart }) => {
    const { students, activeClass } = useStudentList();

    const [mode, setMode] = useState<PickerMode>('random');
    const [count, setCount] = useState(1);
    const [manualSelected, setManualSelected] = useState<string[]>([]);

    // Slot machine state
    const [isSpinning, setIsSpinning] = useState(false);
    const [spinningNames, setSpinningNames] = useState<string[]>([]);
    const [winners, setWinners] = useState<Student[]>([]);
    const [showWinners, setShowWinners] = useState(false);

    const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        };
    }, []);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setMode('random'); // Reset mode to default
            setIsSpinning(false);
            setWinners([]);
            setShowWinners(false);
            setManualSelected([]);
            if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        }
    }, [isOpen]);

    // Auto-start from Remote command
    useEffect(() => {
        if (isOpen && autoStart && students.length > 0) {
            if (autoStart === 'chase') {
                setMode('chase');
            } else if (autoStart === 'random') {
                // Auto-trigger spin after short delay for UI to render
                setTimeout(() => startSlotMachine(), 100);
            }
        }
    }, [isOpen, autoStart, students.length]);

    if (!isOpen) return null;

    const toggleManualSelect = (studentId: string) => {
        setManualSelected(prev =>
            prev.includes(studentId)
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    const handleManualConfirm = () => {
        const selected = students.filter(s => manualSelected.includes(s.id));
        if (selected.length > 0) {
            setWinners(selected);
            setShowWinners(true);
            onSelect(selected);
        }
    };

    const startSlotMachine = () => {
        if (students.length === 0) return;

        setIsSpinning(true);
        setShowWinners(false);
        setWinners([]);

        // Initialize spinning names
        const initialNames = Array(count).fill('').map(() =>
            students[Math.floor(Math.random() * students.length)].name
        );
        setSpinningNames(initialNames);

        // Spinning animation
        let spinCount = 0;
        const maxSpins = 30 + Math.floor(Math.random() * 20);

        spinIntervalRef.current = setInterval(() => {
            spinCount++;

            // Speed decreases as we approach the end
            const newNames = Array(count).fill('').map(() =>
                students[Math.floor(Math.random() * students.length)].name
            );
            setSpinningNames(newNames);

            if (spinCount >= maxSpins) {
                if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

                // Select actual winners
                const shuffled = [...students].sort(() => Math.random() - 0.5);
                const selectedWinners = shuffled.slice(0, Math.min(count, students.length));

                setSpinningNames(selectedWinners.map(s => s.name));
                setWinners(selectedWinners);
                setIsSpinning(false);
                setShowWinners(true);

                // Notify parent
                onSelect(selectedWinners);
            }
        }, 100 - Math.min(spinCount * 2, 80)); // Starts fast, slows down
    };

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 rounded-3xl w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative p-6 text-center">
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full blur-3xl opacity-30" />
                    <h2 className="text-3xl font-extrabold text-white flex items-center justify-center gap-3 relative z-10">
                        <Sparkles className="text-yellow-400" size={32} />
                        Chọn Học Sinh
                        <Sparkles className="text-yellow-400" size={32} />
                    </h2>
                    {activeClass && (
                        <p className="text-purple-200 mt-2">{activeClass.name} - {students.length} học sinh</p>
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-3 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors z-20"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Mode Selector */}
                <div className="px-6 pb-4">
                    <div className="flex gap-2 bg-black/20 rounded-2xl p-1">
                        <button
                            onClick={() => setMode('random')}
                            className={clsx(
                                "flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                                mode === 'random'
                                    ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black"
                                    : "text-white/60 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <Shuffle size={20} /> Random
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={clsx(
                                "flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                                mode === 'manual'
                                    ? "bg-gradient-to-r from-emerald-400 to-teal-500 text-black"
                                    : "text-white/60 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <UserCheck size={20} /> Thủ công
                        </button>
                        <button
                            onClick={() => setMode('chase')}
                            className={clsx(
                                "flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                                mode === 'chase'
                                    ? "bg-gradient-to-r from-red-500 to-orange-500 text-white"
                                    : "text-white/60 hover:text-white hover:bg-white/5"
                            )}
                        >
                            🚔 Đuổi bắt
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 pb-6">
                    {mode === 'random' ? (
                        <div className="space-y-6">
                            {/* Count Selector */}
                            <div className="text-center">
                                <label className="block text-white/60 text-sm mb-3">Số học sinh cần chọn</label>
                                <div className="flex justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setCount(n)}
                                            disabled={isSpinning}
                                            className={clsx(
                                                "w-12 h-12 rounded-xl font-bold text-lg transition-all",
                                                count === n
                                                    ? "bg-yellow-400 text-black scale-110"
                                                    : "bg-white/10 text-white hover:bg-white/20",
                                                isSpinning && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Slot Machine Display */}
                            <div className="bg-black/30 rounded-2xl p-6 border-2 border-yellow-500/30">
                                <div className="flex flex-wrap justify-center gap-3">
                                    {(showWinners ? winners.map(w => w.name) : spinningNames.length > 0 ? spinningNames : Array(count).fill('???')).map((name, idx) => (
                                        <div
                                            key={idx}
                                            className={clsx(
                                                "px-6 py-4 rounded-xl font-bold text-xl transition-all min-w-[120px] text-center",
                                                showWinners
                                                    ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black animate-pulse"
                                                    : isSpinning
                                                        ? "bg-white/20 text-white"
                                                        : "bg-white/10 text-white/40"
                                            )}
                                        >
                                            {name}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Spin Button */}
                            <button
                                onClick={startSlotMachine}
                                disabled={isSpinning || students.length === 0}
                                className={clsx(
                                    "w-full py-4 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition-all",
                                    isSpinning
                                        ? "bg-gray-600 text-gray-300 cursor-wait"
                                        : "bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:scale-[1.02] active:scale-[0.98]"
                                )}
                            >
                                {isSpinning ? (
                                    <>
                                        <div className="w-6 h-6 border-3 border-black/30 border-t-black rounded-full animate-spin" />
                                        Đang quay...
                                    </>
                                ) : (
                                    <>
                                        <Play size={24} /> BẮT ĐẦU QUAY
                                    </>
                                )}
                            </button>
                        </div>
                    ) : mode === 'manual' ? (
                        /* Manual Mode */
                        <div className="space-y-4">
                            <p className="text-white/60 text-sm text-center">Chọn học sinh xung phong:</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                                {students.map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => toggleManualSelect(student.id)}
                                        className={clsx(
                                            "p-3 rounded-xl font-medium transition-all text-left",
                                            manualSelected.includes(student.id)
                                                ? "bg-emerald-500 text-white"
                                                : "bg-white/10 text-white/80 hover:bg-white/20"
                                        )}
                                    >
                                        <span className="text-white/40 mr-2">{student.index}.</span>
                                        {student.name}
                                    </button>
                                ))}
                            </div>

                            {manualSelected.length > 0 && (
                                <button
                                    onClick={handleManualConfirm}
                                    className="w-full py-4 rounded-2xl font-bold text-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-black flex items-center justify-center gap-3"
                                >
                                    <UserCheck size={24} /> Xác nhận ({manualSelected.length} HS)
                                </button>
                            )}
                        </div>
                    ) : mode === 'chase' ? (
                        /* Chase Mode */
                        <ChasePicker
                            students={students}
                            onComplete={(winner) => {
                                setWinners([winner]);
                                setShowWinners(true);
                                setMode('random'); // Switch back to show results
                                onSelect([winner]);
                            }}
                            onCancel={onClose}
                        />
                    ) : null}
                </div>

                {/* Winner Display */}
                {showWinners && winners.length > 0 && (
                    <div className="p-6 bg-black/30 border-t border-white/10">
                        <div className="text-center">
                            <p className="text-yellow-400 font-bold text-lg mb-2">🎉 Kết quả 🎉</p>
                            <div className="flex flex-wrap justify-center gap-2 mb-4">
                                {winners.map(w => (
                                    <span key={w.id} className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-full">
                                        {w.name}
                                    </span>
                                ))}
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white font-medium rounded-full transition-all"
                            >
                                Đóng ✓
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
