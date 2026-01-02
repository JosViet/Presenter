import React, { useState } from 'react';
import { X, Check, XIcon, Send, RotateCcw, Download, Database, Trash2 } from 'lucide-react';
import { Student } from '../hooks/useStudentList';
import clsx from 'clsx';

export type AnswerMode = 'mcq' | 'truefalse' | 'shortanswer' | 'essay';

interface StudentStats {
    total: number;
    correct: number;
    wrong: number;
}

interface Props {
    students: Student[];
    studentAnswers: Record<string, string>; // studentId -> answer (for TF: comma-separated like "Đ,S,Đ,S")
    activeStudentId: string | null;
    answerMode: AnswerMode;
    trueFalseCount?: number; // Number of statements for TrueFalse questions (default 4)
    historyCount?: number; // Total answer history count
    correctAnswer?: string; // The correct answer for comparison
    showResult?: boolean; // Whether to show correct/wrong comparison
    studentStats?: Record<string, StudentStats>; // Running stats per student
    onSelectStudent: (studentId: string | null) => void;
    onSetAnswer: (studentId: string, answer: string) => void;
    onExport?: () => void; // Export history to CSV
    onClearHistory?: () => void; // Clear answer history
    onClose: () => void;
}

const TF_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * Compact floating panel showing selected students with different answer input modes
 */
export const SelectedStudentsPopup: React.FC<Props> = ({
    students,
    studentAnswers,
    activeStudentId,
    answerMode,
    trueFalseCount = 4,
    historyCount = 0,
    correctAnswer,
    showResult = false,
    studentStats = {},
    onSelectStudent,
    onSetAnswer,
    onExport,
    onClearHistory,
    onClose
}) => {
    const [shortAnswerInputs, setShortAnswerInputs] = useState<Record<string, string>>({});

    if (students.length === 0) return null;

    // Check if student's answer is correct (for MCQ, ShortAnswer, Essay only - not TrueFalse)
    const isAnswerCorrect = (answer: string): boolean | null => {
        // TrueFalse has multiple statements, each with its own result - don't show single indicator
        if (answerMode === 'truefalse') return null;
        if (!showResult || !correctAnswer || !answer) return null;
        return answer.trim() === correctAnswer.trim();
    };

    const getModeLabel = () => {
        switch (answerMode) {
            case 'mcq': return 'Click HS → Click đáp án trên slide';
            case 'truefalse': return `Chọn Đ/S cho ${trueFalseCount} mệnh đề`;
            case 'shortanswer': return 'Nhập câu trả lời ngắn';
            case 'essay': return 'Chấm ✓ đúng / ✗ sai';
        }
    };

    const handleShortAnswerSubmit = (studentId: string) => {
        const answer = shortAnswerInputs[studentId]?.trim();
        if (answer) {
            onSetAnswer(studentId, answer);
        }
    };

    // Parse TrueFalse answers: "Đ,S,Đ,S" -> ['Đ', 'S', 'Đ', 'S']
    const parseTFAnswers = (answer: string): string[] => {
        if (!answer) return [];
        return answer.split(',');
    };

    // Toggle TrueFalse answer for a specific statement
    const toggleTFAnswer = (studentId: string, statementIdx: number, value: 'Đ' | 'S') => {
        const current = parseTFAnswers(studentAnswers[studentId] || '');
        // Ensure array is long enough
        while (current.length <= statementIdx) current.push('');

        // Toggle: if same value, clear it; otherwise set
        current[statementIdx] = current[statementIdx] === value ? '' : value;

        onSetAnswer(studentId, current.join(','));
    };

    // Clear all TF answers for a student
    const clearTFAnswers = (studentId: string) => {
        onSetAnswer(studentId, '');
    };

    return (
        <div className="fixed bottom-4 left-4 z-[150] animate-in slide-in-from-left duration-300">
            <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/10 p-3 min-w-[280px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-xs text-yellow-400 font-medium">
                        {getModeLabel()}
                    </p>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Student List */}
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                    {students.map(student => {
                        const answer = studentAnswers[student.id] || '';
                        const isActive = activeStudentId === student.id;
                        const shortInput = shortAnswerInputs[student.id] || '';
                        const tfAnswers = parseTFAnswers(answer);

                        return (
                            <div
                                key={student.id}
                                className={clsx(
                                    "px-3 py-2 rounded-xl transition-all",
                                    isActive
                                        ? "bg-yellow-500 text-black"
                                        : "bg-white/5 text-white"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    {/* Avatar with result indicator */}
                                    <div className="relative">
                                        <button
                                            onClick={() => answerMode === 'mcq' && onSelectStudent(isActive ? null : student.id)}
                                            className={clsx(
                                                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all flex-shrink-0",
                                                // Show result colors when revealed
                                                showResult && answer && isAnswerCorrect(answer) === true && "bg-gradient-to-br from-green-400 to-emerald-600 text-white ring-2 ring-green-300",
                                                showResult && answer && isAnswerCorrect(answer) === false && "bg-gradient-to-br from-red-400 to-red-600 text-white ring-2 ring-red-300",
                                                // Normal colors when not revealed
                                                (!showResult || !answer) && answer && "bg-gradient-to-br from-green-400 to-emerald-600 text-white",
                                                !answer && "bg-gradient-to-br from-indigo-500 to-purple-600 text-white",
                                                answerMode === 'mcq' && !showResult && "cursor-pointer hover:scale-110"
                                            )}
                                        >
                                            {student.name.charAt(0).toUpperCase()}
                                        </button>
                                        {/* Result badge */}
                                        {showResult && answer && isAnswerCorrect(answer) !== null && (
                                            <div className={clsx(
                                                "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs",
                                                isAnswerCorrect(answer) ? "bg-green-500" : "bg-red-500"
                                            )}>
                                                {isAnswerCorrect(answer) ? <Check size={10} strokeWidth={3} /> : <XIcon size={10} strokeWidth={3} />}
                                            </div>
                                        )}
                                    </div>

                                    {/* Name + Score */}
                                    <div className="flex-1 flex items-center gap-2">
                                        <span className={clsx(
                                            "text-sm font-medium",
                                            isActive ? "text-black" : "text-white",
                                            showResult && answer && isAnswerCorrect(answer) === true && "text-green-400",
                                            showResult && answer && isAnswerCorrect(answer) === false && "text-red-400"
                                        )}>
                                            {student.name.split(' ').slice(-2).join(' ')}
                                        </span>
                                        {/* Running score badges */}
                                        {studentStats[student.id] && (studentStats[student.id].correct > 0 || studentStats[student.id].wrong > 0) && (
                                            <div className="flex items-center gap-1 text-xs">
                                                {studentStats[student.id].correct > 0 && (
                                                    <span className="flex items-center gap-0.5 text-emerald-400">
                                                        <Check size={10} />
                                                        <span>{studentStats[student.id].correct}</span>
                                                    </span>
                                                )}
                                                {studentStats[student.id].wrong > 0 && (
                                                    <span className="flex items-center gap-0.5 text-red-400">
                                                        <XIcon size={10} />
                                                        <span>{studentStats[student.id].wrong}</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* MCQ Mode */}
                                    {answerMode === 'mcq' && (
                                        <>
                                            {answer && (
                                                <span className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs bg-emerald-500 text-white">
                                                    {answer}
                                                </span>
                                            )}
                                            {isActive && !answer && (
                                                <span className="text-xs text-black/60 animate-pulse">
                                                    Chọn đáp án...
                                                </span>
                                            )}
                                        </>
                                    )}

                                    {/* Essay Mode */}
                                    {answerMode === 'essay' && (
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => onSetAnswer(student.id, 'Đúng')}
                                                className={clsx(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                                    answer === 'Đúng'
                                                        ? "bg-emerald-500 text-white scale-110"
                                                        : "bg-white/10 text-emerald-400 hover:bg-emerald-500/30"
                                                )}
                                            >
                                                <Check size={16} strokeWidth={3} />
                                            </button>
                                            <button
                                                onClick={() => onSetAnswer(student.id, 'Sai')}
                                                className={clsx(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                                    answer === 'Sai'
                                                        ? "bg-red-500 text-white scale-110"
                                                        : "bg-white/10 text-red-400 hover:bg-red-500/30"
                                                )}
                                            >
                                                <XIcon size={16} strokeWidth={3} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Short Answer Mode */}
                                    {answerMode === 'shortanswer' && (
                                        <div className="flex-1 flex gap-1">
                                            {answer ? (
                                                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-medium truncate max-w-[100px]" title={answer}>
                                                    {answer}
                                                </span>
                                            ) : (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={shortInput}
                                                        onChange={(e) => setShortAnswerInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                                                        placeholder="Đáp án..."
                                                        className="flex-1 px-2 py-1 rounded-lg bg-white/10 text-white placeholder-white/40 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 min-w-0"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleShortAnswerSubmit(student.id)}
                                                    />
                                                    <button
                                                        onClick={() => handleShortAnswerSubmit(student.id)}
                                                        className="p-1 rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 transition-colors"
                                                    >
                                                        <Send size={12} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* TrueFalse Mode: Multiple statements grid */}
                                {answerMode === 'truefalse' && (
                                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                                        {Array.from({ length: trueFalseCount }).map((_, idx) => (
                                            <div key={idx} className="flex items-center gap-0.5 bg-white/5 rounded-lg p-1">
                                                <span className="text-xs text-white/60 w-4 text-center">{TF_LABELS[idx]}</span>
                                                <button
                                                    onClick={() => toggleTFAnswer(student.id, idx, 'Đ')}
                                                    className={clsx(
                                                        "w-6 h-6 rounded text-xs font-bold transition-all",
                                                        tfAnswers[idx] === 'Đ'
                                                            ? "bg-emerald-500 text-white"
                                                            : "bg-white/10 text-emerald-400 hover:bg-emerald-500/30"
                                                    )}
                                                >
                                                    Đ
                                                </button>
                                                <button
                                                    onClick={() => toggleTFAnswer(student.id, idx, 'S')}
                                                    className={clsx(
                                                        "w-6 h-6 rounded text-xs font-bold transition-all",
                                                        tfAnswers[idx] === 'S'
                                                            ? "bg-red-500 text-white"
                                                            : "bg-white/10 text-red-400 hover:bg-red-500/30"
                                                    )}
                                                >
                                                    S
                                                </button>
                                            </div>
                                        ))}
                                        {tfAnswers.some(a => a) && (
                                            <button
                                                onClick={() => clearTFAnswers(student.id)}
                                                className="p-1 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
                                                title="Xóa tất cả"
                                            >
                                                <RotateCcw size={12} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer with Export button */}
                {(historyCount > 0 || onExport || onClearHistory) && (
                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-white/50">
                            <Database size={12} />
                            <span>{historyCount} lượt trả lời</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {onClearHistory && historyCount > 0 && (
                                <button
                                    onClick={() => {
                                        if (window.confirm('Xóa toàn bộ lịch sử trả lời?')) {
                                            onClearHistory();
                                        }
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                    title="Xóa lịch sử"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                            {onExport && (
                                <button
                                    onClick={onExport}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                                >
                                    <Download size={12} />
                                    Export CSV
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
