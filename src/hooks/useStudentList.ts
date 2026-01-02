import { useState, useEffect, useCallback } from 'react';

export interface Student {
    id: string;
    name: string;
    index: number;
}

export interface ClassList {
    id: string;
    name: string;
    students: Student[];
    createdAt: Date;
}

const STORAGE_KEY = 'vietlms_class_lists';
const ACTIVE_CLASS_KEY = 'vietlms_active_class';

export function useStudentList() {
    const [classLists, setClassLists] = useState<ClassList[]>([]);
    const [activeClassId, setActiveClassId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setClassLists(parsed);
            }
            const activeId = localStorage.getItem(ACTIVE_CLASS_KEY);
            if (activeId) {
                setActiveClassId(activeId);
            }
        } catch (e) {
            console.error('Failed to load class lists:', e);
        }
        setIsLoaded(true);
    }, []);

    // Persist to localStorage when data changes
    useEffect(() => {
        if (!isLoaded) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(classLists));
            if (activeClassId) {
                localStorage.setItem(ACTIVE_CLASS_KEY, activeClassId);
            }
        } catch (e) {
            console.error('Failed to save class lists:', e);
        }
    }, [classLists, activeClassId, isLoaded]);

    // Get current active class
    const activeClass = classLists.find(c => c.id === activeClassId) || null;
    const students = activeClass?.students || [];

    // Create new class from text (paste mode)
    const createClassFromText = useCallback((className: string, text: string) => {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const newStudents: Student[] = lines.map((name, idx) => ({
            id: `${Date.now()}-${idx}`,
            name,
            index: idx + 1,
        }));

        const newClass: ClassList = {
            id: `class-${Date.now()}`,
            name: className,
            students: newStudents,
            createdAt: new Date(),
        };

        setClassLists(prev => [...prev, newClass]);
        setActiveClassId(newClass.id);
        return newClass;
    }, []);

    // Create new class from Excel data (column B, skip header)
    const createClassFromExcel = useCallback((className: string, rows: string[][]) => {
        // Skip header row (index 0), get column B (index 1)
        const names = rows.slice(1)
            .map(row => row[1]?.trim() || '')
            .filter(name => name.length > 0);

        const newStudents: Student[] = names.map((name, idx) => ({
            id: `${Date.now()}-${idx}`,
            name,
            index: idx + 1,
        }));

        const newClass: ClassList = {
            id: `class-${Date.now()}`,
            name: className,
            students: newStudents,
            createdAt: new Date(),
        };

        setClassLists(prev => [...prev, newClass]);
        setActiveClassId(newClass.id);
        return newClass;
    }, []);

    // Delete a class
    const deleteClass = useCallback((classId: string) => {
        setClassLists(prev => prev.filter(c => c.id !== classId));
        if (activeClassId === classId) {
            setActiveClassId(null);
        }
    }, [activeClassId]);

    // Delete a student from active class
    const deleteStudent = useCallback((studentId: string) => {
        if (!activeClassId) return;
        setClassLists(prev => prev.map(c => {
            if (c.id !== activeClassId) return c;
            return {
                ...c,
                students: c.students
                    .filter(s => s.id !== studentId)
                    .map((s, idx) => ({ ...s, index: idx + 1 })),
            };
        }));
    }, [activeClassId]);

    // Add student to active class
    const addStudent = useCallback((name: string) => {
        if (!activeClassId || !name.trim()) return;
        setClassLists(prev => prev.map(c => {
            if (c.id !== activeClassId) return c;
            return {
                ...c,
                students: [
                    ...c.students,
                    {
                        id: `${Date.now()}`,
                        name: name.trim(),
                        index: c.students.length + 1,
                    },
                ],
            };
        }));
    }, [activeClassId]);

    // Get random students
    const getRandomStudents = useCallback((count: number): Student[] => {
        if (students.length === 0) return [];
        const shuffled = [...students].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, students.length));
    }, [students]);

    return {
        classLists,
        activeClass,
        activeClassId,
        students,
        isLoaded,
        setActiveClassId,
        createClassFromText,
        createClassFromExcel,
        deleteClass,
        deleteStudent,
        addStudent,
        getRandomStudents,
    };
}
