import { useState, useEffect, useRef } from 'react';
import { StepRevealRenderer } from './components/StepRevealRenderer';
import { useTheme, useAnnotations, useSlides, useKeyboard, useAnswerTracking } from './hooks';
import { LatexRenderer } from './components/LatexRenderer';
import { AnnotationLayer } from './components/AnnotationLayer';
import { RemoteControlModal } from './components/RemoteControlModal';
import { TikZPreloader } from './components/TikZPreloader';
import { LaserPointer } from './components/LaserPointer';
import { ClassroomTimer } from './components/ClassroomTimer';
import { ZoomOverlay } from './components/ZoomOverlay';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ClassListManager } from './components/ClassListManager';
import { StudentPickerModal } from './components/StudentPickerModal';
import { SelectedStudentsPopup } from './components/SelectedStudentsPopup';
import { StudentAnswerOverlay } from './components/StudentAnswerOverlay';
import { Student, useStudentList } from './hooks/useStudentList';
import { ChevronLeft, ChevronRight, Palette, FileText, Bookmark, AlertCircle, Eye, EyeOff, Lightbulb, CheckCircle2, LayoutGrid, X, Settings, PenTool, MousePointer2, Timer, Presentation, Save, Smartphone, Users, Dices, FolderOpen } from 'lucide-react';
import clsx from 'clsx';
import { sounds } from './utils/sound';
import { LatexSettingsModal } from './components/LatexSettingsModalNew';
import { LatexConfigService } from './services/LatexConfig';

function App() {
  // === HOOKS ===
  const { theme, toggleTheme, themeStyle } = useTheme();

  // Initialize Dynamic LaTeX Config
  useEffect(() => {
    LatexConfigService.init();
  }, []);

  // === SLIDES (from hook) ===
  const {
    questions, fileTitle, currentIdx, showResult, showSolution,
    userSelections, texPath, macros, basePath,
    solutionRef, setShowResult, setShowSolution, setUserSelections,
    loadTexFile, handleOpenFile, handleOpenFolder, nextSlide, prevSlide, goToSlide,
    handleSelectOption, checkResult, fileRef
  } = useSlides();

  // === STUDENT LIST (for remote manual selection) ===
  const { students: allStudents } = useStudentList();

  // === UI STATE ===  
  const [showOverview, setShowOverview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLaserEnabled, setIsLaserEnabled] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [isWhiteboard, setIsWhiteboard] = useState(false);

  // === ANNOTATIONS (from hook) ===
  const {
    annotations, setAnnotations,
    whiteboardPaths, setWhiteboardPaths,
    showExitConfirm, setShowExitConfirm,
    handleSaveAndQuit, handleQuitWithoutSaving
  } = useAnnotations({ texPath });

  // === ZOOM STATE ===
  const [zoomedContent, setZoomedContent] = useState<React.ReactNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // === SWIPE GESTURES (Tablet UX) ===
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 150; // Increased from 50 for larger tablets

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isSwipeLeft = distance > minSwipeDistance;
    const isSwipeRight = distance < -minSwipeDistance;

    if (isSwipeLeft) {
      if (!isDrawing && !isLaserEnabled && !showOverview) nextSlide();
    }
    if (isSwipeRight) {
      if (!isDrawing && !isLaserEnabled && !showOverview) prevSlide();
    }
  };

  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showClassManager, setShowClassManager] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerAutoStart, setPickerAutoStart] = useState<'random' | 'chase' | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  // Answer tracking for classroom games
  const { setAnswer, saveAnswerWithResult, answerHistory, exportToCSV, clearHistory } = useAnswerTracking();

  // Auto-clear prompt when opening new file
  useEffect(() => {
    const currentFileName = (questions[0] as any)?.source || (questions[0] as any)?.question_type || null;
    if (currentFileName && lastFileName && currentFileName !== lastFileName && answerHistory.length > 0) {
      if (window.confirm(`Bạn đang mở file mới. Xóa lịch sử trả lời cũ (${answerHistory.length} entries)?`)) {
        clearHistory();
      }
    }
    setLastFileName(currentFileName);
  }, [questions]);

  // Save answer results when showResult becomes true
  useEffect(() => {
    if (showResult && selectedStudents.length > 0 && Object.keys(studentAnswers).length > 0) {
      const q = questions[currentIdx];
      if (!q) return;

      // Check if this is a TrueFalse question (has multiple options, each with isCorrect)
      const isTrueFalse = q.question_type?.includes('dung_sai') && (q.options?.length ?? 0) > 0;

      if (isTrueFalse && q.options) {
        // TrueFalse: Parse each student's comma-separated answers and compare with each statement
        const correctPattern = q.options.map((o: any) => o.isCorrect ? 'Đ' : 'S');

        selectedStudents.forEach(student => {
          const answerStr = studentAnswers[student.id] || '';
          const studentAnswersArr = answerStr.split(',').map(a => a.trim());

          // Compare each statement and save separately
          correctPattern.forEach((correct: string, idx: number) => {
            const studentAns = studentAnswersArr[idx] || '';
            if (studentAns) {
              // Save each statement as separate entry with unique questionIdx
              saveAnswerWithResult(
                student.id,
                student.name,
                studentAns,
                correct,  // 'Đ' or 'S'
                currentIdx + (idx * 0.01) // Use decimal to differentiate statements within same question
              );
            }
          });
        });
      } else {
        // MCQ / Short Answer: Single answer comparison
        const correctAns = q?.options?.find((o: any) => o.isCorrect)?.id
          || q?.short_answer
          || q?.correct_answer;
        if (correctAns) {
          selectedStudents.forEach(student => {
            const answer = studentAnswers[student.id];
            if (answer) {
              saveAnswerWithResult(student.id, student.name, answer, String(correctAns), currentIdx);
            }
          });
        }
      }
    }
  }, [showResult]); // Only run when showResult changes

  // Determine answerMode for Remote
  const getAnswerMode = () => {
    const q = questions[currentIdx];
    if (!q) return 'essay';
    if (q.question_type?.includes('dung_sai')) return 'truefalse';
    if (q.options && q.options.length > 0) return 'mcq';
    if (q.short_answer || q.question_type?.includes('dien_so') || q.question_type?.includes('tra_loi_ngan')) return 'shortanswer';
    return 'essay';
  };

  // Sync State to Remote Server
  useEffect(() => {
    const q = questions[currentIdx];
    if (!q) return;

    const payload = {
      type: q.question_type,
      options: q.options || [],
      hasShortAnswer: q.question_type === 'tra_loi_ngan',
      idx: currentIdx,
      total: questions.length,
      // New: Student-related state
      answerMode: getAnswerMode(),
      selectedStudents: selectedStudents.map(s => ({ id: s.id, name: s.name })),
      activeStudentId,
      studentAnswers,
      trueFalseCount: q.options?.length || 4,
      // For manual selection on Remote
      allStudents: allStudents.map(s => ({ id: s.id, name: s.name })),
    };

    window.electronAPI.updateRemoteState(payload).catch(console.error);

  }, [currentIdx, questions, userSelections, selectedStudents, activeStudentId, studentAnswers, allStudents]);

  // Handle Remote Commands
  useEffect(() => {
    return window.electronAPI.onRemoteCommand((cmd: any) => {
      const { action, value } = cmd;
      if (action === 'next') nextSlide();
      if (action === 'prev') prevSlide();
      if (action === 'toggle-result') setShowResult(prev => !prev);
      if (action === 'toggle-solution') setShowSolution(prev => !prev);

      if (action === 'select-option') {
        const type = questions[currentIdx]?.question_type;
        handleSelectOption(currentIdx, value, type);
      }

      if (action === 'submit-answer') {
        setUserSelections(prev => ({
          ...prev,
          [currentIdx]: [value]
        }));
      }

      if (action === 'scroll') {
        if (containerRef.current) {
          containerRef.current.scrollBy({ top: value, behavior: 'smooth' });
        }
      }

      // New: Student-related commands
      if (action === 'select-student') {
        setActiveStudentId(value);
      }

      if (action === 'grade-essay') {
        const { studentId, grade } = value as { studentId: string; grade: string };
        setStudentAnswers(prev => ({ ...prev, [studentId]: grade }));
        // Also save via hook
        const student = selectedStudents.find(s => s.id === studentId);
        if (student) {
          setAnswer(studentId, grade);
          if (grade === 'Đúng' || grade === 'Sai') {
            saveAnswerWithResult(studentId, student.name, grade, 'Đúng', currentIdx);
          }
        }
      }

      if (action === 'toggle-truefalse') {
        const { studentId, index, answer } = value as { studentId: string; index: number; answer: string };
        const current = (studentAnswers[studentId] || '').split(',');
        while (current.length <= index) current.push('');
        current[index] = current[index] === answer ? '' : answer;
        const newAnswer = current.join(',');
        setStudentAnswers(prev => ({ ...prev, [studentId]: newAnswer }));
        setAnswer(studentId, newAnswer);
      }

      if (action === 'open-picker') {
        setPickerAutoStart(null);
        setShowPicker(true);
      }

      if (action === 'start-random') {
        setPickerAutoStart('random');
        setShowPicker(true);
      }

      if (action === 'start-chase') {
        setPickerAutoStart('chase');
        setShowPicker(true);
      }

      if (action === 'pick-random') {
        // Alias for start-random (backward compat)
        setPickerAutoStart('random');
        setShowPicker(true);
      }

      if (action === 'close-modal') {
        setShowPicker(false);
        setPickerAutoStart(null);
      }

      if (action === 'clear-students') {
        setSelectedStudents([]);
        setStudentAnswers({});
        setActiveStudentId(null);
      }

      if (action === 'manual-select') {
        // value is array of student IDs
        const ids = value as string[];
        const selected = allStudents.filter(s => ids.includes(s.id));
        setSelectedStudents(selected);
        setStudentAnswers({});
        if (selected.length === 1) {
          setActiveStudentId(selected[0].id);
        }
      }
    });
  }, [currentIdx, questions, showSolution, showResult, selectedStudents, allStudents, studentAnswers]);

  // TikZ is now rendered client-side via TikZJax in TikZEmbed.tsx
  // No Electron/MiKTeX compilation needed

  // toggleTheme and themeStyle now provided by useTheme hook


  // handleSelectOption, checkResult now provided by useSlides hook


  // No resize handler needed for fluid layout

  // loadTexFile, handleOpenFile now provided by useSlides hook


  // === ANNOTATION PERSISTENCE is now handled by useAnnotations hook ===


  // Hot Reloading effect
  useEffect(() => {
    if (texPath) {
      window.electronAPI.watchFile(texPath);
    }
  }, [texPath]);

  useEffect(() => {
    const handleFileChanged = (changedPath: string) => {
      if (changedPath === texPath) {
        loadTexFile(changedPath, true); // Silent reload
      }
    };
    window.electronAPI.onFileChanged(handleFileChanged);
  }, [texPath]);

  // nextSlide, prevSlide now provided by useSlides hook


  // Keyboard handling via hook
  useKeyboard({
    nextSlide,
    prevSlide,
    goToSlide,
    totalSlides: questions.length,
    checkResult,
    showResult,
    setShowResult,
    showSolution,
    setShowSolution,
    isLaserEnabled,
    setIsLaserEnabled,
    showTimer,
    setShowTimer,
    isWhiteboard,
    setIsWhiteboard,
    isDrawing,
    setIsDrawing,
    setShowShortcuts,
    setShowOverview,
    toggleTheme,
    solutionRef,
  });

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-gray-600">
        <div className="flex gap-6">
          <button
            onClick={handleOpenFile}
            className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:scale-105"
          >
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
              <FileText size={40} />
            </div>
            <span className="text-xl font-bold">Mở Đề Thi (.tex)</span>
            <span className="text-sm text-gray-400">File đơn lẻ</span>
          </button>

          <button
            onClick={handleOpenFolder}
            className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:scale-105"
          >
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
              <FolderOpen size={40} />
            </div>
            <span className="text-xl font-bold">Mở Thư Mục</span>
            <span className="text-sm text-gray-400">Dự án (Web/PWA)</span>
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];

  return (
    <div
      className={clsx("relative w-full h-full overflow-hidden", themeStyle.bg, theme === 'dark' && "dark")}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className={clsx("w-full h-full flex flex-col shadow-2xl relative transition-colors duration-300", themeStyle.bg)}
      >
        {/* Header */}
        <div className={clsx("h-16 px-6 border-b flex items-center justify-between shrink-0 transition-colors duration-300", themeStyle.headerBg, themeStyle.headerText, "border-opacity-10 border-gray-500")}>
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              {fileTitle && <div className="text-sm font-semibold opacity-50 uppercase tracking-widest"><LatexRenderer content={fileTitle} theme={theme} macros={macros} fileRef={fileRef} /></div>}

              {/* ID / Counter Badge */}
              {(() => {
                const qType = q.question_type as any;
                const nonQuestionTypes = ['title_slide', 'dang_toan', 'ly_thuyet_dinh_nghia', 'ly_thuyet_luu_y', 'ly_thuyet_nhan_xet', 'vi_du'];

                if (nonQuestionTypes.includes(qType)) return null;

                const questionCountBefore = questions.slice(0, currentIdx + 1).filter(item => !nonQuestionTypes.includes(item.question_type as any)).length;
                const totalQuestions = questions.filter(item => !nonQuestionTypes.includes(item.question_type as any)).length;

                const displayCurrent = questionCountBefore;
                const displayTotal = totalQuestions;

                return (
                  <div className="flex items-baseline gap-1">
                    <span className={clsx("text-2xl font-bold font-monaspace", theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600')}>
                      Câu {displayCurrent}
                    </span>
                    <span className={clsx("text-xl opacity-60 font-medium", themeStyle.text)}>
                      / {displayTotal}
                    </span>
                  </div>
                );
              })()
              }
            </div>

            {q.metadata && (
              <span className={clsx("hidden md:inline-block px-3 py-1 rounded-full text-xs font-medium border",
                theme === 'dark' ? "bg-gray-800 border-gray-700 text-gray-400" : "bg-gray-100 border-gray-200 text-gray-500"
              )}>
                {q.metadata.muc_do_ten} / {q.metadata.phan_mon_ten}
              </span>
            )}



            {/* Question Type Badge */}
            {(() => {
              const typeMap: Record<string, string> = {
                'trac_nghiem_mot_dap_an': 'Trắc Nghiệm',
                'trac_nghiem_dung_sai': 'Đúng / Sai',
                'tra_loi_ngan': 'Trả Lời Ngắn',
                'tu_luan': 'Tự Luận'
              };
              const label = typeMap[q.question_type as string];
              if (!label) return null;
              return (
                <span className={clsx("ml-2 inline-block px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider",
                  theme === 'dark' ? "bg-indigo-900/40 border-indigo-700 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-700"
                )}>
                  {label}
                </span>
              );
            })()}

          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className={clsx("p-2 rounded-full transition-colors", theme === 'dark' ? "hover:bg-gray-700 text-amber-400" : "hover:bg-gray-100 text-gray-500")} title="Đổi giao diện">
              <Palette size={20} />
            </button>

            {/* Navigation Controls */}
            <div className={clsx("flex items-center gap-1 rounded-lg p-1 mx-2", theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100')}>
              <button
                onClick={prevSlide}
                className={clsx("p-1.5 rounded-md disabled:opacity-30 transition-all", theme === 'dark' ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-700 hover:bg-white hover:shadow-sm')}
                disabled={currentIdx === 0}
                title="Câu trước"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextSlide}
                className={clsx("p-1.5 rounded-md disabled:opacity-30 transition-all", theme === 'dark' ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-700 hover:bg-white hover:shadow-sm')}
                disabled={currentIdx === questions.length - 1}
                title="Câu sau"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <button
              onClick={() => { sounds.playClick(); setShowOverview(true); }}
              className={clsx("p-2 rounded-full transition-colors", theme === 'dark' ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-500")}
              title="Tổng quan toàn bộ slide"
            >
              <LayoutGrid size={20} />
            </button>

            <div className="h-6 w-px bg-gray-300 mx-1 opacity-50"></div>

            {/* Only show Tools for Questions */}
            {true && (
              <>
                <button
                  onClick={() => { sounds.playClick(); setShowResult(!showResult); }}
                  className={clsx("px-4 py-2 rounded-lg flex items-center gap-2 transition-colors", showResult ? (theme === 'dark' ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-50 text-indigo-600") : (theme === 'dark' ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"))}>
                  {showResult ? <Eye size={20} /> : <EyeOff size={20} />}
                  <span>Đáp Án</span>
                </button>
                <button
                  onClick={() => { showSolution ? sounds.playClick() : sounds.playReveal(); setShowSolution(!showSolution); }}
                  className={clsx("px-4 py-2 rounded-lg flex items-center gap-2 transition-colors", showSolution ? (theme === 'dark' ? "bg-amber-900/50 text-amber-300" : "bg-amber-50 text-amber-600") : (theme === 'dark' ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"))}>
                  <Lightbulb size={20} />
                  <span>Lời Giải</span>
                </button>
              </>
            )}

            <div className="h-6 w-px bg-gray-300 mx-1 opacity-50"></div>

            <button onClick={handleOpenFile} className={clsx("px-4 py-2 rounded-lg flex items-center gap-2", theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100')}>
              <FileText size={20} />
              <span>Mở File</span>
            </button>

            <button onClick={() => setShowSettings(true)} className={clsx("p-2 ml-2 rounded-lg flex items-center justify-center transition-colors", theme === 'dark' ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100")} title="Cài đặt">
              <Settings size={20} />
            </button>
            <button onClick={() => setIsDrawing(prev => !prev)} className={clsx("p-2 ml-2 rounded-lg flex items-center justify-center transition-colors", isDrawing && !isWhiteboard ? "bg-indigo-100 text-indigo-600" : (theme === 'dark' ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"))} title="Chế độ Vẽ (Annotation)">
              <PenTool size={20} />
            </button>

            <button
              onClick={() => {
                const newState = !isWhiteboard;
                setIsWhiteboard(newState);
                setIsDrawing(newState); // Always enable drawing when opening whiteboard
              }}
              className={clsx("p-2 ml-2 rounded-lg flex items-center justify-center transition-colors", isWhiteboard ? "bg-emerald-100 text-emerald-600" : (theme === 'dark' ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"))}
              title="Bảng phụ (Whiteboard)"
            >
              <Presentation size={20} />
            </button>

            <button onClick={() => setIsLaserEnabled(prev => !prev)} className={clsx("p-2 ml-2 rounded-lg flex items-center justify-center transition-colors", isLaserEnabled ? "bg-red-100 text-red-600 shadow-inner" : (theme === 'dark' ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"))} title="Con trỏ Laser (L)">
              <MousePointer2 size={20} />
            </button>

            <button onClick={() => setShowTimer(prev => !prev)} className={clsx("p-2 ml-2 rounded-lg flex items-center justify-center transition-colors", showTimer ? "bg-amber-100 text-amber-600" : (theme === 'dark' ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"))} title="Đồng hồ đếm ngược">
              <Timer size={20} />
            </button>
            <button onClick={() => setShowRemoteModal(true)} className={clsx("p-2 ml-2 rounded-lg flex items-center justify-center transition-colors", showRemoteModal ? "bg-indigo-100 text-indigo-600" : (theme === 'dark' ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"))} title="Điều khiển từ xa">
              <Smartphone size={20} />
            </button>
            <button onClick={() => setShowClassManager(true)} className={clsx("p-2 ml-2 rounded-lg flex items-center justify-center transition-colors", showClassManager ? "bg-purple-100 text-purple-600" : (theme === 'dark' ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"))} title="Quản lý danh sách lớp">
              <Users size={20} />
            </button>
            <button onClick={() => setShowPicker(true)} className={clsx("p-2 ml-2 rounded-lg flex items-center justify-center transition-colors", showPicker ? "bg-orange-100 text-orange-600" : (theme === 'dark' ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"))} title="Chọn học sinh ngẫu nhiên">
              <Dices size={20} />
            </button>
          </div>
        </div>


        {/* Content Body */}
        <div className="flex-1 w-full h-full flex flex-col relative min-h-0">
          {/* Question Card - Now Full Screen Slide */}
          <div ref={containerRef} className={clsx("w-full h-full flex flex-col overflow-y-auto transition-colors duration-300", themeStyle.bg)}>
            <div className="relative min-h-full flex flex-col p-6">
              <div className={clsx("text-lg md:text-xl lg:text-2xl leading-relaxed font-medium shrink-0 transition-colors duration-300", themeStyle.text)}>
                {(() => {
                  if (!q) {
                    return (
                      <div className="flex flex-col items-center justify-center p-12 text-center opacity-60">
                        <FileText size={48} className="mb-4 text-gray-400" />
                        <p className="text-xl">Vui lòng mở file tài liệu (.tex) để bắt đầu</p>
                      </div>
                    );
                  }
                  const content = q.content || '';
                  // Handle Theory/Dang Blocks specifically
                  const qType = q.question_type as any; // Cast to allow new theory types
                  const isDark = theme === 'dark';

                  // Title Slide
                  if (qType === 'title_slide') {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-center animate-in zoom-in-95 duration-700">
                        <div className={clsx("mb-8 px-6 py-2 rounded-full uppercase tracking-widest text-sm font-semibold border",
                          isDark ? "bg-indigo-900/30 text-indigo-300 border-indigo-700" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                        )}>
                          Bài Giảng
                        </div>
                        <h1 className={clsx("text-5xl md:text-7xl font-extrabold max-w-4xl leading-tight mb-12 drop-shadow-sm",
                          isDark ? "text-indigo-300" : "text-indigo-700"
                        )}>
                          <LatexRenderer content={q.content} theme={theme} macros={macros} fileRef={fileRef} />
                        </h1>
                        <div className={clsx("text-2xl font-light italic opacity-70", themeStyle.text)}>
                          VietLMS Presenter
                        </div>
                      </div>
                    )
                  }

                  {/* Background Preloader */ }
                  {
                    questions.length > 0 && (
                      <TikZPreloader questions={questions} />
                    )
                  }

                  return (
                    <>
                      {/* Source Tags */}
                      {(q as any).tags && (q as any).tags.length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {(q as any).tags.map((tag: string, idx: number) => (
                            <span key={idx} className={clsx("inline-block px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm",
                              theme === 'dark' ? "bg-amber-900/30 text-amber-500 border border-amber-800" : "bg-amber-50 text-amber-700 border border-amber-200"
                            )}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {(() => {
                        if (qType === 'dang_toan') {
                          // const isDark = theme === 'dark'; // Already defined above
                          return (
                            <div className={clsx(
                              "rounded-xl overflow-hidden shadow-lg border mb-8 transition-transform hover:scale-[1.01] duration-500",
                              isDark ? "bg-slate-800 border-indigo-500/50 shadow-indigo-900/40" : "bg-white border-blue-100 shadow-blue-200/50"
                            )}>
                              <div className={clsx(
                                "px-6 py-3 flex items-center gap-3 border-b",
                                isDark ? "bg-indigo-900/50 border-indigo-500/50" : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100"
                              )}>
                                <div className={clsx("p-2 rounded-lg", isDark ? "bg-indigo-500/30 text-indigo-200" : "bg-blue-100 text-blue-600")}>
                                  <Bookmark size={24} />
                                </div>
                                <div className={clsx("font-bold text-xl tracking-wide uppercase", isDark ? "text-blue-200" : "text-blue-800")}>
                                  <span className="mr-2">Dạng {(q as any).dangIndex}:</span>
                                  <span className="inline-block"><LatexRenderer content={q.short_answer || 'Tổng Quát'} theme={theme} macros={macros} fileRef={fileRef} /></span>
                                </div>
                              </div>
                              <div className="p-6">
                                <LatexRenderer content={content} theme={theme} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />
                              </div>
                            </div>
                          );
                        }
                        if (qType === 'ly_thuyet_dinh_nghia') {
                          const isDark = theme === 'dark';
                          return (
                            <div className={clsx(
                              "relative p-8 rounded-2xl border mb-8 transition-all duration-300",
                              isDark ? "bg-amber-900/30 border-amber-600/50" : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
                            )}>
                              {!isDark && (
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                  <FileText size={120} className="text-amber-900" />
                                </div>
                              )}

                              <div className="flex items-center gap-3 mb-4">
                                <div className={clsx("h-8 w-1 rounded-full", isDark ? "bg-amber-500" : "bg-amber-400")} />
                                <span className={clsx("font-extrabold text-lg uppercase tracking-wider", isDark ? "text-amber-400" : "text-amber-700")}>
                                  Định Nghĩa
                                </span>
                              </div>

                              <div className={clsx("pl-2", isDark ? "text-amber-100" : "text-gray-800")}>
                                <LatexRenderer content={content} theme={theme} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />
                              </div>
                            </div>
                          );
                        }
                        if (qType === 'ly_thuyet_luu_y') {
                          const isDark = theme === 'dark';
                          return (
                            <div className={clsx(
                              "flex gap-4 p-6 rounded-xl border mb-6",
                              isDark ? "bg-red-900/40 border-red-500/50" : "bg-red-50/50 border-red-100"
                            )}>
                              <div className="shrink-0 pt-1">
                                <div className={clsx("p-2 rounded-lg", isDark ? "bg-red-500/30 text-red-300" : "bg-red-100 text-red-600")}>
                                  <AlertCircle size={24} />
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className={clsx("font-bold text-lg mb-2", isDark ? "text-red-300" : "text-red-700")}>Lưu ý</div>
                                <div className={isDark ? "text-red-100" : "text-gray-700"}>
                                  <LatexRenderer content={content} theme={theme} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />
                                </div>
                              </div>
                            </div>
                          );
                        }
                        if (qType === 'ly_thuyet_nhan_xet') {
                          const isDark = theme === 'dark';
                          return (
                            <div className={clsx(
                              "group relative p-6 rounded-xl border mb-6 transition-all hover:shadow-md",
                              isDark ? "bg-slate-800 border-slate-600" : "bg-white border-gray-200"
                            )}>
                              <div className={clsx(
                                "absolute top-6 left-0 w-1 h-8 rounded-r-full transition-all group-hover:h-12 duration-300",
                                isDark ? "bg-emerald-500" : "bg-emerald-400"
                              )} />
                              <div className="pl-4">
                                <div className={clsx("font-bold mb-2 flex items-center gap-2", isDark ? "text-emerald-400" : "text-emerald-700")}>
                                  <span>Nhận xét</span>
                                </div>
                                <LatexRenderer content={content} theme={theme} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />
                              </div>
                            </div>
                          );
                        }
                        if (qType === 'ly_thuyet_tom_tat') {
                          const isDark = theme === 'dark';
                          return (
                            <div className={clsx(
                              "relative p-8 rounded-2xl border mb-8 transition-all duration-300",
                              isDark ? "bg-gray-800 border-gray-600" : "bg-gray-50 border-gray-200"
                            )}>
                              <div className="flex items-center gap-3 mb-4">
                                <div className={clsx("h-8 w-1 rounded-full", "bg-gray-400")} />
                                <span className={clsx("font-extrabold text-lg uppercase tracking-wider", isDark ? "text-gray-300" : "text-gray-600")}>
                                  Tóm Tắt
                                </span>
                              </div>
                              <div className={clsx("pl-2", isDark ? "text-gray-300" : "text-gray-700")}>
                                <LatexRenderer content={content} theme={theme} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />
                              </div>
                            </div>
                          );
                        }

                        if (qType === 'vi_du') {
                          const isDark = theme === 'dark';
                          return (
                            <div className={clsx(
                              "mb-8 p-1 rounded-2xl bg-gradient-to-r",
                              isDark ? "from-indigo-900 via-purple-900 to-indigo-900" : "from-indigo-50 via-purple-50 to-indigo-50"
                            )}>
                              <div className={clsx(
                                "h-full w-full rounded-xl p-6",
                                isDark ? "bg-slate-900" : "bg-white"
                              )}>
                                <div className="flex items-center gap-3 mb-4">
                                  <span className={clsx(
                                    "px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm",
                                    isDark ? "bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/50" : "bg-indigo-600 text-white"
                                  )}>
                                    VÍ DỤ MINH HỌA
                                  </span>
                                  <div className={clsx("h-px flex-1", isDark ? "bg-indigo-800" : "bg-indigo-100")} />
                                </div>
                                <LatexRenderer content={content} theme={theme} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />
                              </div>



                            </div>
                          );
                        }

                        // Match [Trích ...] at the start of the string
                        const match = content.match(/^\[(Trích[^\]]+)\]\s*/i);

                        if (match) {
                          const citation = match[1];
                          const mainContent = content.substring(match[0].length);
                          return (
                            <>
                              <div className="mb-3">
                                <span className="inline-block px-3 py-1 rounded-md bg-amber-100 text-amber-800 text-base md:text-lg font-semibold border border-amber-200">
                                  {citation}
                                </span>
                              </div>
                              <LatexRenderer content={mainContent} theme={theme} basePath={basePath} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />
                            </>
                          );
                        }

                        // Fallback Default
                        return <LatexRenderer content={content} theme={theme} basePath={basePath} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />;
                      })()}
                    </>
                  );
                })()}
              </div>

              {/* Options / Input Area */}
              {q.question_type === 'tra_loi_ngan' ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center mt-8 pb-8">
                  <div className="w-full max-w-2xl">
                    <label className="block text-xl font-medium text-gray-700 mb-4">Nhập câu trả lời của bạn:</label>
                    <div className="relative">
                      {(() => {
                        const currentVal = userSelections[currentIdx]?.[0] || '';

                        const normalizeAnswer = (val: string) => {
                          return val.toString()
                            .replace(/\$/g, '')       // Remove Math delimiters
                            .replace(/\{,\}/g, ',')   // Replace LaTeX {,} with ,
                            .replace(/\s+/g, '')      // Remove whitespace for flexible matching
                            .toLowerCase();
                        };

                        const correctRaw = (q.short_answer || q.correct_answer || '').toString();
                        const isCorrect = normalizeAnswer(currentVal) === normalizeAnswer(correctRaw);

                        let inputClass = clsx(themeStyle.optionBg, themeStyle.text, themeStyle.optionBorder, "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 placeholder-gray-400");

                        if (showResult) {
                          inputClass = isCorrect ? "border-green-500 bg-green-50 text-green-900" : "border-red-500 bg-red-50 text-red-900";
                        }

                        return (
                          <input
                            type="text"
                            className={clsx(
                              "w-full p-6 text-3xl font-mono text-center border-4 rounded-2xl outline-none transition-all shadow-sm",
                              inputClass
                            )}
                            placeholder="Nhập số hoặc văn bản..."
                            readOnly={showResult}
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUserSelections(prev => ({
                                ...prev,
                                [currentIdx]: [val]
                              }));
                            }}
                          />
                        );
                      })()}

                      {showResult && (
                        <div className="absolute top-full left-0 w-full mt-4 text-center animate-in fade-in slide-in-from-top-2">
                          <div className="inline-block px-6 py-3 bg-green-100 text-green-800 rounded-xl border border-green-200 shadow-sm">
                            <span className="font-bold text-lg">Đáp án đúng: </span>
                            <span className="font-mono text-2xl font-bold ml-2">
                              <LatexRenderer content={q.short_answer || q.correct_answer || '...'} theme={theme} basePath={basePath} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : q.options ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8 pb-8">
                  {q.options.map((opt: any, idx: number) => {
                    const isCorrect = opt.isCorrect;
                    const show = showResult;
                    const currentSelections = userSelections[currentIdx] || [];
                    const isSelected = currentSelections.includes(opt.id);

                    // Styling Logic
                    let containerClass = clsx(themeStyle.optionBg, themeStyle.optionBorder, themeStyle.text, themeStyle.hoverOption, "cursor-pointer");
                    let circleClass = clsx(theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600');

                    if (show) {
                      if (isCorrect) {
                        if (isSelected) {
                          containerClass = "border-green-500 bg-green-100 text-green-900";
                          circleClass = "bg-green-500 text-white";
                        } else {
                          containerClass = "border-green-400 border-dashed bg-green-50/50 text-green-800";
                          circleClass = "bg-white border-2 border-green-500 text-green-600";
                        }
                      } else if (isSelected) {
                        containerClass = "border-red-500 bg-red-100 text-red-900";
                        circleClass = "bg-red-500 text-white";
                      } else {
                        containerClass = clsx("opacity-40", themeStyle.optionBg, themeStyle.optionBorder);
                      }
                    } else if (isSelected) {
                      containerClass = "border-indigo-600 bg-indigo-50 text-indigo-900";
                      circleClass = "bg-indigo-600 text-white";
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          // If there's an active student waiting for answer, assign it
                          if (activeStudentId && selectedStudents.length > 0) {
                            setStudentAnswers(prev => ({ ...prev, [activeStudentId]: opt.id }));
                            setAnswer(activeStudentId, opt.id);
                            setActiveStudentId(null); // Clear selection after assignment
                          }
                          // Also handle normal option selection
                          if (!show) handleSelectOption(currentIdx, opt.id, q.question_type);
                        }}
                        className={clsx(
                          "relative p-4 rounded-xl border-2 transition-all flex items-start gap-3 text-base md:text-lg lg:text-xl group",
                          containerClass,
                          activeStudentId && "cursor-pointer ring-2 ring-yellow-400/50 hover:ring-yellow-400"
                        )}
                      >
                        <span className={clsx(
                          "w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full font-bold flex-shrink-0 transition-colors text-lg md:text-xl",
                          circleClass
                        )}>
                          {opt.id}
                        </span>
                        <div className="pt-0.5 flex-1">
                          <LatexRenderer content={opt.content} theme={theme} basePath={basePath} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />
                        </div>
                        {/* Student avatars for this option */}
                        <StudentAnswerOverlay
                          students={selectedStudents}
                          studentAnswers={studentAnswers}
                          optionId={opt.id}
                        />
                        {show && isCorrect && (
                          <div className="absolute top-1/2 right-4 -translate-y-1/2 text-green-600 animate-in zoom-in fade-in duration-300">
                            <CheckCircle2 size={32} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* Universal Inline Explanation (Theme-aware) */}
              {showSolution && q.explanation && (
                <div className={clsx(
                  "mt-8 p-8 rounded-2xl animate-in fade-in slide-in-from-top-4 shadow-sm border-2",
                  theme === 'dark' ? "bg-slate-800 border-indigo-500/50" : "bg-amber-50 border-amber-200"
                )}>
                  <div className={clsx(
                    "flex items-center gap-2 font-bold text-2xl mb-4",
                    theme === 'dark' ? "text-indigo-300" : "text-amber-800"
                  )}>
                    <Lightbulb size={32} /> Lời giải chi tiết
                  </div>
                  <div className={clsx("text-xl leading-relaxed", theme === 'dark' ? "text-gray-200" : "text-gray-800")}>
                    <StepRevealRenderer ref={solutionRef} content={q.explanation} isOpen={showSolution} isActive={true} theme={theme} basePath={basePath} macros={macros} onZoom={setZoomedContent} fileRef={fileRef} />
                  </div>
                </div>
              )}
              <AnnotationLayer
                isActive={isDrawing}
                onClose={() => { setIsDrawing(false); setIsWhiteboard(false); }}
                isWhiteboard={isWhiteboard}
                slideId={currentIdx}
                initialPaths={isWhiteboard ? whiteboardPaths : annotations[currentIdx]}
                onStroke={(paths) => {
                  if (isWhiteboard) {
                    setWhiteboardPaths(paths);
                  } else {
                    setAnnotations(prev => ({ ...prev, [currentIdx]: paths }));
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Global Overlays */}
        <LaserPointer enabled={isLaserEnabled} />
        {showTimer && <ClassroomTimer onClose={() => setShowTimer(false)} />}
        <RemoteControlModal isOpen={showRemoteModal} onClose={() => setShowRemoteModal(false)} />
        <ZoomOverlay isOpen={!!zoomedContent} onClose={() => setZoomedContent(null)} theme={themeStyle as any}>
          {zoomedContent}
        </ZoomOverlay>
        <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        <ClassListManager isOpen={showClassManager} onClose={() => setShowClassManager(false)} />
        <StudentPickerModal
          isOpen={showPicker}
          onClose={() => { setShowPicker(false); setPickerAutoStart(null); }}
          onSelect={(newStudents) => {
            setSelectedStudents(prev => {
              const prevIds = new Set(prev.map(s => s.id));
              const uniqueNew = newStudents.filter(s => !prevIds.has(s.id));
              return [...prev, ...uniqueNew];
            });
          }}
          autoStart={pickerAutoStart}
        />
        <SelectedStudentsPopup
          students={selectedStudents}
          studentAnswers={studentAnswers}
          activeStudentId={activeStudentId}
          answerMode={(() => {
            const q = questions[currentIdx];
            if (!q) return 'essay';
            // Check TrueFalse FIRST (before MCQ) because TrueFalse also has options
            if (q.question_type?.includes('dung_sai')) return 'truefalse';
            if (q.options && q.options.length > 0) return 'mcq';
            if (q.short_answer || q.question_type?.includes('dien_so') || q.question_type?.includes('tra_loi_ngan')) return 'shortanswer';
            return 'essay'; // Default for theory, examples, and any other slides
          })()}
          correctAnswer={questions[currentIdx]?.options?.find((o: any) => o.isCorrect)?.id || questions[currentIdx]?.correct_answer}
          showResult={showResult}
          studentStats={(() => {
            // Calculate running stats per student from answer history
            const stats: Record<string, { total: number; correct: number; wrong: number }> = {};
            answerHistory.forEach(a => {
              if (!stats[a.studentId]) {
                stats[a.studentId] = { total: 0, correct: 0, wrong: 0 };
              }
              stats[a.studentId].total++;
              if (a.isCorrect) stats[a.studentId].correct++;
              else stats[a.studentId].wrong++;
            });
            return stats;
          })()}
          onSelectStudent={setActiveStudentId}
          onSetAnswer={(studentId, answer) => {
            setStudentAnswers(prev => ({ ...prev, [studentId]: answer }));
            setAnswer(studentId, answer);

            // For essay mode (manual ✓/✗), save directly to history
            const student = selectedStudents.find(s => s.id === studentId);
            if (student && (answer === 'Đúng' || answer === 'Sai')) {
              // For essay/theory: 'Đúng' means correct, 'Sai' means wrong
              // To mark correctly: when 'Đúng', correctAnswer='Đúng' so isCorrect=true
              // When 'Sai', correctAnswer='Đúng' so isCorrect=false (mismatch)
              saveAnswerWithResult(studentId, student.name, answer, 'Đúng', currentIdx);
            }
          }}
          historyCount={answerHistory.length}
          onExport={exportToCSV}
          onClearHistory={clearHistory}
          onClose={() => { setSelectedStudents([]); setStudentAnswers({}); setActiveStudentId(null); }}
        />
      </div>


      {/* Settings Modal */}
      {/* Settings Modal */}
      <LatexSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)}>
        {/* TikZ rendered via TikZJax - no MiKTeX settings needed */}
      </LatexSettingsModal>



      {/* Overview Modal Overlay */}
      {
        showOverview && (
          <div className="absolute inset-0 z-[100] bg-slate-900/80 backdrop-blur-xl flex flex-col animate-in fade-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="h-20 px-8 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500 rounded-xl text-white shadow-lg">
                  <LayoutGrid size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Tổng quan bài giảng</h2>
                  <p className="text-white/50 text-sm">Chọn slide để di chuyển nhanh ({questions.length} slide)</p>
                </div>
              </div>
              <button
                onClick={() => setShowOverview(false)}
                className="p-3 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-all hover:rotate-90 duration-300"
                title="Đóng"
              >
                <X size={32} />
              </button>
            </div>

            {/* Modal Grid content */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {questions.map((item, idx) => {
                  const isCurrent = idx === currentIdx;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        goToSlide(idx);
                        setShowOverview(false);
                        sounds.playClick();
                      }}
                      className={clsx(
                        "group cursor-pointer aspect-video rounded-2xl border-2 p-5 transition-all flex flex-col justify-between relative overflow-hidden active:scale-95",
                        isCurrent
                          ? "bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/40 scale-105 z-10"
                          : "bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className={clsx("text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest",
                            isCurrent ? "bg-white text-indigo-700" : "bg-white/10 text-white/50"
                          )}>
                            {(() => {
                              const qType = item.question_type as any;
                              if (qType === 'title_slide') return 'Tiêu đề';
                              if (qType === 'dang_toan') return 'Dạng Toán';
                              if (qType.startsWith('ly_thuyet')) return 'Lý thuyết';
                              if (qType === 'vi_du') return 'Ví dụ';
                              return 'Bài tập';
                            })()}
                          </span>
                          <span className={clsx("text-xs font-bold", isCurrent ? "text-indigo-200" : "text-white/20")}>
                            #{idx + 1}
                          </span>
                        </div>

                        <div className={clsx("text-sm line-clamp-3 font-medium leading-relaxed",
                          isCurrent ? "text-white" : "text-white/70 group-hover:text-white"
                        )}>
                          {(item.content || '').replace(/\\/g, '').substring(0, 120)}
                        </div>
                      </div>

                      {/* Bottom indicator */}
                      <div className="mt-4 flex items-center justify-between opacity-40 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1">
                          {[1, 2, 3].map(i => <div key={i} className={clsx("w-1 h-1 rounded-full", isCurrent ? "bg-white" : "bg-white/30")} />)}
                        </div>
                        {isCurrent && <FileText size={16} className="text-white" />}
                      </div>

                      {/* Ripple effect overlay */}
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div >
        )
      }

      {/* Exit Confirmation Modal */}
      {
        showExitConfirm && (
          <div className="absolute inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                  <Save size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Lưu ghi chú?</h2>
                <p className="text-gray-500">
                  Bạn có muốn lưu lại các hình vẽ và ghi chú trên slide trước khi thoát không?
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveAndQuit}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                  Lưu & Thoát
                </button>
                <button
                  onClick={handleQuitWithoutSaving}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Không lưu
                </button>
              </div>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full mt-3 py-3 text-gray-400 font-semibold hover:text-gray-600 text-sm"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default App;
