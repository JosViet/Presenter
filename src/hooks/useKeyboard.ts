import { useEffect } from 'react';
import { sounds } from '../utils/sound';

interface KeyboardCallbacks {
    nextSlide: () => void;
    prevSlide: () => void;
    goToSlide: (idx: number) => void;
    totalSlides: number;
    checkResult: () => void;
    showResult: boolean;
    setShowResult: (val: boolean | ((prev: boolean) => boolean)) => void;
    showSolution: boolean;
    setShowSolution: (val: boolean | ((prev: boolean) => boolean)) => void;
    isLaserEnabled: boolean;
    setIsLaserEnabled: (val: boolean | ((prev: boolean) => boolean)) => void;
    showTimer: boolean;
    setShowTimer: (val: boolean | ((prev: boolean) => boolean)) => void;
    isWhiteboard: boolean;
    setIsWhiteboard: (val: boolean | ((prev: boolean) => boolean)) => void;
    isDrawing: boolean;
    setIsDrawing: (val: boolean | ((prev: boolean) => boolean)) => void;
    setShowShortcuts: (val: boolean | ((prev: boolean) => boolean)) => void;
    setShowOverview: (val: boolean | ((prev: boolean) => boolean)) => void;
    toggleTheme: () => void;
    solutionRef: React.RefObject<{
        next: () => boolean;
        prev: () => boolean;
        revealAll: () => void;
        toggleAutoReveal: () => void;
        isComplete: boolean;
        isAutoRevealing: boolean;
    } | null>;
}

export function useKeyboard(callbacks: KeyboardCallbacks) {
    const {
        nextSlide,
        prevSlide,
        goToSlide,
        totalSlides,
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
    } = callbacks;

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            // Check if user is typing in an input field - skip most shortcuts
            const activeElement = document.activeElement;
            const isTyping = activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement ||
                activeElement?.getAttribute('contenteditable') === 'true';

            // Allow Escape and some navigation keys even when typing
            if (isTyping && e.key !== 'Escape' && e.key !== 'F1') {
                return; // Don't intercept keyboard when typing
            }

            // Keyboard shortcuts help (? or F1)
            if (e.key === '?' || e.key === 'F1') {
                e.preventDefault();
                setShowShortcuts(prev => !prev);
                return;
            }

            // Navigation
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === 'Home') { goToSlide(0); sounds.playClick(); }
            if (e.key === 'End') { goToSlide(totalSlides - 1); sounds.playClick(); }

            // Toggle overview
            if (e.key.toLowerCase() === 'g') setShowOverview(prev => !prev);

            // Toggle result/solution
            if (e.key.toLowerCase() === 'r') setShowResult(prev => !prev);
            if (e.key.toLowerCase() === 's') setShowSolution(prev => !prev);

            // Theme toggle
            if (e.key.toLowerCase() === 't' && !e.ctrlKey) toggleTheme();

            // Tools toggle
            if (e.key.toLowerCase() === 'l') setIsLaserEnabled(prev => !prev);
            if (e.key.toLowerCase() === 'd') setIsDrawing(prev => !prev);

            // Escape - close overlays
            if (e.key === 'Escape') {
                setShowShortcuts(false);
                setShowOverview(false);
                if (isDrawing) setIsDrawing(false);
                if (isWhiteboard) { setIsWhiteboard(false); setIsDrawing(false); }
            }

            // Whiteboard toggle
            if (e.key.toLowerCase() === 'w') {
                setIsWhiteboard(prev => {
                    const newState = !prev;
                    setIsDrawing(newState);
                    return newState;
                });
            }

            // P key - toggle auto-reveal mode
            if (e.key.toLowerCase() === 'p' && showSolution) {
                e.preventDefault();
                solutionRef.current?.toggleAutoReveal();
                sounds.playClick();
                return;
            }

            // ArrowUp / Backspace - go back one step in solution
            if ((e.key === 'ArrowUp' || e.key === 'Backspace') && showSolution) {
                if (solutionRef.current?.prev()) {
                    e.preventDefault();
                    sounds.playClick();
                    return;
                }
            }

            // Shift+Space - reveal all steps at once
            if (e.key === ' ' && e.shiftKey && showSolution) {
                e.preventDefault();
                solutionRef.current?.revealAll();
                sounds.playReveal();
                return;
            }

            // Space key - main interaction
            if (e.key === ' ' && !e.shiftKey) {
                e.preventDefault();
                if (!showResult) {
                    checkResult();
                } else if (!showSolution) {
                    setShowSolution(true);
                    sounds.playReveal();
                } else {
                    // If auto-revealing, stop it first
                    if (solutionRef.current?.isAutoRevealing) {
                        solutionRef.current?.toggleAutoReveal();
                        sounds.playClick();
                        return;
                    }
                    // Try next step in solution
                    if (solutionRef.current?.next()) {
                        sounds.playClick();
                        return;
                    }
                    // Else next slide
                    nextSlide();
                }
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [
        nextSlide,
        prevSlide,
        goToSlide,
        totalSlides,
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
    ]);
}


