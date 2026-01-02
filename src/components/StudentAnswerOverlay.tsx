import React from 'react';
import { Student } from '../hooks/useStudentList';

interface Props {
    students: Student[];
    studentAnswers: Record<string, string>; // studentId -> answer (A/B/C/D)
    optionId: string; // A, B, C, D
}

/**
 * Renders student avatars inside an answer option box
 * Shows all students who have selected this particular option
 */
export const StudentAnswerOverlay: React.FC<Props> = ({
    students,
    studentAnswers,
    optionId
}) => {
    // Find students who selected this option
    const studentsWithThisAnswer = students.filter(
        student => studentAnswers[student.id] === optionId
    );

    if (studentsWithThisAnswer.length === 0) return null;

    return (
        <div className="absolute top-1 right-1 flex -space-x-2 z-10">
            {studentsWithThisAnswer.slice(0, 5).map((student, idx) => (
                <div
                    key={student.id}
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs border-2 border-white shadow-md animate-in zoom-in duration-200"
                    style={{
                        zIndex: studentsWithThisAnswer.length - idx,
                        animationDelay: `${idx * 50}ms`
                    }}
                    title={student.name}
                >
                    {student.name.charAt(0).toUpperCase()}
                </div>
            ))}
            {studentsWithThisAnswer.length > 5 && (
                <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs border-2 border-white shadow-md">
                    +{studentsWithThisAnswer.length - 5}
                </div>
            )}
        </div>
    );
};
