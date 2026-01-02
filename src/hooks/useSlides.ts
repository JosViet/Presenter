import { useState, useCallback, useRef } from 'react';
import { parseTexFile } from '../services/parser_presenter';
import { QuestionNode } from '../shared/types';
import { sounds } from '../utils/sound';
import { StepRevealRef } from '../components/StepRevealRenderer';
import { FileSystemService } from '../services/FileSystem';
import { FileReference } from '../services/FileSystem/IFileSystem';

export function useSlides() {
    const [questions, setQuestions] = useState<QuestionNode[]>([]);
    const [fileTitle, setFileTitle] = useState<string>('');
    const [currentIdx, setCurrentIdx] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [showSolution, setShowSolution] = useState(false);
    const [userSelections, setUserSelections] = useState<Record<number, string[]>>({});
    const [texPath, setTexPath] = useState('');
    const [fileRef, setFileRef] = useState<FileReference | null>(null);
    const [macros, setMacros] = useState<Record<string, string>>({});
    const [rawPreamble, setRawPreamble] = useState('');

    const solutionRef = useRef<StepRevealRef>(null);

    const currentQuestion = questions[currentIdx];
    // Base path logic for Web needs FileRef to resolve
    const basePath = texPath ? texPath.substring(0, texPath.lastIndexOf('\\')) : '';

    const loadTexFile = useCallback(async (refOrPath: string | FileReference, silent = false) => {
        try {
            let ref: FileReference;

            if (typeof refOrPath === 'string') {
                // Legacy / Electron path string
                ref = { type: 'electron', path: refOrPath, name: refOrPath };
            } else {
                ref = refOrPath;
            }

            const content = await FileSystemService.readFile(ref);
            const { questions: parsedQuestions, title, macros: parsedMacros, rawPreamble: parsedPreamble } = parseTexFile(content);

            setMacros(parsedMacros || {});
            setRawPreamble(parsedPreamble || '');

            if (parsedQuestions.length > 0) {
                // Pre-calculate Dang Index
                let dangCounter = 0;
                parsedQuestions.forEach(q => {
                    if ((q.question_type as any) === 'dang_toan') {
                        dangCounter++;
                        (q as any).dangIndex = dangCounter;
                    }
                });

                if (title) {
                    parsedQuestions.unshift({
                        question_type: 'title_slide',
                        content: title,
                        classificationId: 'TITLE',
                        options: [],
                        metadata: null
                    } as any);
                }

                setQuestions(parsedQuestions);
                setFileTitle(title || '');
                setTexPath(ref.path || ref.name); // Store path for Electron or Name for Web
                setFileRef(ref);

                FileSystemService.watchFile(ref, () => {
                    // Reload on change
                    // Ideally we debounce and call loadTexFile(ref, true)
                    console.log("File changed, reloading...");
                    loadTexFile(ref, true);
                });

                if (!silent) {
                    setCurrentIdx(0);
                    setShowResult(false);
                    setShowSolution(false);
                    setUserSelections({});
                }
            } else if (!silent) {
                alert('Không tìm thấy câu hỏi nào trong file này!');
            }
        } catch (error) {
            console.error("Error loading TeX file:", error);
            if (!silent) alert('Lỗi khi đọc file TeX!');
        }
    }, []);

    const handleOpenFile = useCallback(async () => {
        sounds.playClick();
        const ref = await FileSystemService.selectFile();
        if (ref) {
            await loadTexFile(ref);
        }
    }, [loadTexFile]);

    const handleOpenFolder = useCallback(async () => {
        sounds.playClick();
        const folderRef = await FileSystemService.selectFolder();
        if (folderRef) {
            const files = await FileSystemService.readDirectory(folderRef);
            // Filter for .tex files
            const texFiles = files.filter(f => f.name.endsWith('.tex'));

            if (texFiles.length === 0) {
                alert("Không tìm thấy file .tex nào trong thư mục này!");
            } else if (texFiles.length === 1) {
                // Auto-load if only one
                await loadTexFile(texFiles[0]);
            } else {
                // TODO: Better UI for picking file
                // For now, load Main.tex if exists, else first one
                const main = texFiles.find(f => f.name.toLowerCase() === 'main.tex') || texFiles[0];
                if (main) await loadTexFile(main);
            }
        }
    }, [loadTexFile]);

    const nextSlide = useCallback(() => {
        // Check if solution is showing, try to advance step
        if (showSolution && solutionRef.current?.next()) {
            return;
        }

        if (currentIdx < questions.length - 1) {
            sounds.playClick();
            setCurrentIdx(c => c + 1);
            setShowResult(false);
            setShowSolution(false);
        }
    }, [currentIdx, questions.length, showSolution]);

    const prevSlide = useCallback(() => {
        if (currentIdx > 0) {
            sounds.playClick();
            setCurrentIdx(c => c - 1);
            setShowResult(false);
            setShowSolution(false);
        }
    }, [currentIdx]);

    const goToSlide = useCallback((idx: number) => {
        if (idx >= 0 && idx < questions.length) {
            sounds.playClick();
            setCurrentIdx(idx);
            setShowResult(false);
            setShowSolution(false);
        }
    }, [questions.length]);

    const handleSelectOption = useCallback((qIdx: number, optId: string, type: string) => {
        sounds.playClick();
        setUserSelections(prev => {
            const current = prev[qIdx] || [];

            if (type === 'trac_nghiem_dung_sai') {
                if (current.includes(optId)) {
                    return { ...prev, [qIdx]: current.filter(id => id !== optId) };
                } else {
                    return { ...prev, [qIdx]: [...current, optId] };
                }
            } else {
                return { ...prev, [qIdx]: current.includes(optId) ? [] : [optId] };
            }
        });
    }, []);

    const checkResult = useCallback(() => {
        if (showResult) {
            setShowResult(false);
            sounds.playClick();
            return;
        }

        const q = questions[currentIdx];
        const selections = userSelections[currentIdx] || [];
        let isCorrect = false;

        if (q.question_type === 'tra_loi_ngan') {
            const correctVal = (q.short_answer || q.correct_answer || '').toString().trim().toLowerCase();
            const userVal = (selections[0] || '').trim().toLowerCase();
            isCorrect = correctVal === userVal;
        } else {
            const correctIds = q.options?.filter((o: any) => o.isCorrect).map((o: any) => o.id) || [];
            const selSet = new Set(selections);
            const corSet = new Set(correctIds);

            if (selSet.size === corSet.size && [...selSet].every(s => corSet.has(s))) {
                isCorrect = true;
            }
        }

        if (isCorrect) {
            sounds.playCorrect();
        } else {
            sounds.playWrong();
        }
        setShowResult(true);
    }, [showResult, questions, currentIdx, userSelections]);

    const toggleSolution = useCallback(() => {
        showSolution ? sounds.playClick() : sounds.playReveal();
        setShowSolution(prev => !prev);
    }, [showSolution]);

    const toggleResult = useCallback(() => {
        sounds.playClick();
        setShowResult(prev => !prev);
    }, []);

    return {
        // State
        questions,
        fileTitle,
        currentIdx,
        showResult,
        showSolution,
        userSelections,
        texPath,
        fileRef, // Expose File Reference
        macros,
        rawPreamble,
        basePath,
        currentQuestion,
        solutionRef,

        // Setters
        setShowResult,
        setShowSolution,
        setUserSelections,
        setTexPath,

        // Actions
        loadTexFile,
        handleOpenFile,
        handleOpenFolder,
        nextSlide,
        prevSlide,
        goToSlide,
        handleSelectOption,
        checkResult,
        toggleSolution,
        toggleResult,
    };
}
