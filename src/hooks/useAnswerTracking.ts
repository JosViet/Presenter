import { useState, useCallback } from 'react';
import { Student } from './useStudentList';

export type QuestionType = 'mcq' | 'truefalse' | 'shortanswer';

export interface StudentAnswer {
    studentId: string;
    studentName: string;
    questionIdx: number;
    questionType: QuestionType;
    selectedAnswer: string;  // 'A'|'B'|'C'|'D' for MCQ, 'Đúng'|'Sai' for TF, free text for short
    correctAnswer?: string;
    isCorrect?: boolean;
    timestamp: Date;
}

export interface AnswerSession {
    students: Student[];
    questionIdx: number;
    questionType: QuestionType;
    answers: Map<string, string>; // studentId -> answer
}

const HISTORY_KEY = 'vietlms_answer_history';

export function useAnswerTracking() {
    const [currentSession, setCurrentSession] = useState<AnswerSession | null>(null);
    const [answerHistory, setAnswerHistory] = useState<StudentAnswer[]>(() => {
        try {
            const stored = localStorage.getItem(HISTORY_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // Start a new answer session with selected students
    const startSession = useCallback((
        students: Student[],
        questionIdx: number,
        questionType: QuestionType = 'mcq'
    ) => {
        setCurrentSession({
            students,
            questionIdx,
            questionType,
            answers: new Map(),
        });
    }, []);

    // Set answer for a student in current session
    const setAnswer = useCallback((studentId: string, answer: string) => {
        setCurrentSession(prev => {
            if (!prev) return prev;
            const newAnswers = new Map(prev.answers);
            newAnswers.set(studentId, answer);
            return { ...prev, answers: newAnswers };
        });
    }, []);

    // Save a single answer with correct/wrong result to history
    const saveAnswerWithResult = useCallback((
        studentId: string,
        studentName: string,
        selectedAnswer: string,
        correctAnswer: string,
        questionIdx: number
    ) => {
        // Normalize for comparison - strip LaTeX delimiters and common formatting
        const normalizeAnswer = (s: string) => {
            return s
                .trim()
                .replace(/^\$+|\$+$/g, '') // Remove $ delimiters
                .replace(/^\\\[|\\\]$/g, '') // Remove \[ \] delimiters
                .replace(/\\text\{([^}]*)\}/g, '$1') // Extract text from \text{}
                .replace(/\{,\}/g, ',') // Convert LaTeX {,} to , (European decimal)
                .replace(/\\,/g, '') // Remove thin spaces
                .replace(/\s+/g, '') // Remove all whitespace
                .toLowerCase();
        };
        const normalizedSelected = normalizeAnswer(selectedAnswer);
        const normalizedCorrect = normalizeAnswer(correctAnswer);
        const isCorrect = normalizedSelected === normalizedCorrect;
        const newEntry: StudentAnswer = {
            studentId,
            studentName,
            questionIdx,
            questionType: 'mcq',
            selectedAnswer,
            correctAnswer,
            isCorrect,
            timestamp: new Date(),
        };

        setAnswerHistory(prev => {
            // Check if this student+question already exists to avoid duplicates
            const exists = prev.some(a =>
                a.studentId === studentId &&
                a.questionIdx === questionIdx &&
                a.selectedAnswer === selectedAnswer
            );
            if (exists) return prev;

            const newHistory = [...prev, newEntry];
            try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
            } catch (e) {
                console.error('Failed to save answer history:', e);
            }
            return newHistory;
        });
    }, []);

    // Get current answer for a student
    const getAnswer = useCallback((studentId: string): string | undefined => {
        return currentSession?.answers.get(studentId);
    }, [currentSession]);

    // Submit all answers and compare with correct answer
    const submitAnswers = useCallback((correctAnswer: string) => {
        if (!currentSession) return;

        const newEntries: StudentAnswer[] = currentSession.students.map(student => {
            const selectedAnswer = currentSession.answers.get(student.id) || '';
            const isCorrect = selectedAnswer.toLowerCase() === correctAnswer.toLowerCase();
            return {
                studentId: student.id,
                studentName: student.name,
                questionIdx: currentSession.questionIdx,
                questionType: currentSession.questionType,
                selectedAnswer,
                correctAnswer,
                isCorrect,
                timestamp: new Date(),
            };
        });

        const newHistory = [...answerHistory, ...newEntries];
        setAnswerHistory(newHistory);

        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
        } catch (e) {
            console.error('Failed to save answer history:', e);
        }

        return newEntries;
    }, [currentSession, answerHistory]);

    // Clear current session
    const clearSession = useCallback(() => {
        setCurrentSession(null);
    }, []);

    // Get history for a specific student
    const getStudentHistory = useCallback((studentId: string) => {
        return answerHistory.filter(a => a.studentId === studentId);
    }, [answerHistory]);

    // Get summary stats
    const getStudentStats = useCallback((studentId: string) => {
        const history = answerHistory.filter(a => a.studentId === studentId);
        const correct = history.filter(a => a.isCorrect).length;
        return {
            total: history.length,
            correct,
            wrong: history.length - correct,
            accuracy: history.length > 0 ? Math.round((correct / history.length) * 100) : 0,
        };
    }, [answerHistory]);

    // Clear all history
    const clearHistory = useCallback(() => {
        setAnswerHistory([]);
        localStorage.removeItem(HISTORY_KEY);
    }, []);

    // Export history to CSV
    const exportToCSV = useCallback(() => {
        const headers = ['Họ tên', 'Câu hỏi', 'Loại', 'Đáp án chọn', 'Đáp án đúng', 'Kết quả', 'Thời gian'];
        const rows = answerHistory.map(a => [
            a.studentName,
            a.questionIdx + 1,
            a.questionType === 'mcq' ? 'Trắc nghiệm' : a.questionType === 'truefalse' ? 'Đúng/Sai' : 'Trả lời ngắn',
            a.selectedAnswer,
            a.correctAnswer || '',
            a.isCorrect ? 'Đúng' : 'Sai',
            new Date(a.timestamp).toLocaleString('vi-VN'),
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.join(','))
            .join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `answer_history_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }, [answerHistory]);

    return {
        currentSession,
        answerHistory,
        startSession,
        setAnswer,
        saveAnswerWithResult,
        getAnswer,
        submitAnswers,
        clearSession,
        getStudentHistory,
        getStudentStats,
        clearHistory,
        exportToCSV,
    };
}
