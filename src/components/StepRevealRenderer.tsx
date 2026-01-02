import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { LatexRenderer } from './LatexRenderer';
import { parseLoigiaiSteps } from '../services/parser_presenter';
import clsx from 'clsx';
import { Play, Pause, ChevronRight, ChevronLeft } from 'lucide-react';
import { FileReference } from '../services/FileSystem/IFileSystem';

const SCROLL_DELAY_MS = 200;
const AUTO_REVEAL_DELAYS = [2000, 3000, 5000, 10000]; // 2s, 3s, 5s, 10s

export interface StepRevealRef {
    next: () => boolean; // Returns true if step advanced, false if at end
    prev: () => boolean; // Returns true if stepped back, false if at start
    reset: () => void;
    revealAll: () => void; // Reveal all steps at once
    toggleAutoReveal: () => void; // Toggle auto-reveal mode
    hasSteps: boolean;
    isComplete: boolean; // All steps revealed
    isAutoRevealing: boolean; // Auto-reveal active
}

interface Props {
    content: string;
    isOpen: boolean;
    onFinished?: () => void;
    isActive: boolean; // Is this slide active?
    cachedImages?: Record<string, string>;
    theme?: 'light' | 'sepia' | 'dark';
    basePath?: string;
    macros?: Record<string, string>;
    onZoom?: (content: React.ReactNode) => void;
    fileRef?: FileReference | null;
}

export const StepRevealRenderer = forwardRef<StepRevealRef, Props>(({ content, isOpen, isActive, cachedImages, theme, basePath, macros = {}, onZoom, fileRef }, ref) => {
    const [steps, setSteps] = useState<string[]>([]);
    const [visibleCount, setVisibleCount] = useState(0);
    const stepRefs = React.useRef<(HTMLDivElement | null)[]>([]);

    // Auto-reveal state
    const [isAutoRevealing, setIsAutoRevealing] = useState(false);
    const [autoRevealDelay, setAutoRevealDelay] = useState(3000); // Default 3s
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        // Parse steps when content changes
        setSteps(parseLoigiaiSteps(content));
        setVisibleCount(0); // Reset
        stepRefs.current = []; // Reset refs
        setIsAutoRevealing(false); // Stop auto-reveal on content change
    }, [content]);

    // Auto-reveal timer effect
    useEffect(() => {
        if (!isAutoRevealing || !isOpen || visibleCount >= steps.length) {
            setCountdown(0);
            return;
        }

        // Start countdown
        setCountdown(autoRevealDelay);

        const countdownInterval = setInterval(() => {
            setCountdown(prev => Math.max(0, prev - 100));
        }, 100);

        const revealTimer = setTimeout(() => {
            setVisibleCount(v => Math.min(v + 1, steps.length));
        }, autoRevealDelay);

        return () => {
            clearTimeout(revealTimer);
            clearInterval(countdownInterval);
        };
    }, [isAutoRevealing, isOpen, visibleCount, steps.length, autoRevealDelay]);

    // Stop auto-reveal when complete
    useEffect(() => {
        if (visibleCount >= steps.length && isAutoRevealing) {
            setIsAutoRevealing(false);
        }
    }, [visibleCount, steps.length, isAutoRevealing]);

    // Auto-scroll when new step is revealed
    useEffect(() => {
        if (visibleCount > 0 && isActive && isOpen) {
            const currentIdx = visibleCount - 1;
            const element = stepRefs.current[currentIdx];
            if (element) {
                setTimeout(() => {
                    if (element) {
                        const rect = element.getBoundingClientRect();
                        const isOutOfView = rect.bottom > window.innerHeight || rect.top < 0;

                        if (isOutOfView) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }
                }, SCROLL_DELAY_MS);
            }
        }
    }, [visibleCount, isActive, isOpen, steps]);

    const toggleAutoReveal = useCallback(() => {
        setIsAutoRevealing(prev => !prev);
    }, []);

    const cycleDelay = useCallback(() => {
        setAutoRevealDelay(prev => {
            const currentIndex = AUTO_REVEAL_DELAYS.indexOf(prev);
            return AUTO_REVEAL_DELAYS[(currentIndex + 1) % AUTO_REVEAL_DELAYS.length];
        });
    }, []);

    useImperativeHandle(ref, () => ({
        next: () => {
            setIsAutoRevealing(false); // Stop auto-reveal on manual action
            if (visibleCount < steps.length) {
                setVisibleCount(v => v + 1);
                return true;
            }
            return false;
        },
        prev: () => {
            setIsAutoRevealing(false); // Stop auto-reveal on manual action
            if (visibleCount > 0) {
                setVisibleCount(v => v - 1);
                return true;
            }
            return false;
        },
        reset: () => {
            setVisibleCount(0);
            setIsAutoRevealing(false);
        },
        revealAll: () => {
            setVisibleCount(steps.length);
            setIsAutoRevealing(false);
        },
        toggleAutoReveal,
        hasSteps: steps.length > 0,
        isComplete: visibleCount >= steps.length,
        isAutoRevealing
    }));


    if (!isOpen) return null;

    const totalSteps = steps.length;
    const progressPercent = totalSteps > 0 ? (visibleCount / totalSteps) * 100 : 0;
    const countdownPercent = autoRevealDelay > 0 ? (countdown / autoRevealDelay) * 100 : 0;

    return (
        <div className="space-y-4">
            {/* Step Counter & Progress Bar & Auto-Reveal Controls */}
            {totalSteps > 1 && (
                <div className="flex items-center gap-3 mb-2">
                    <span className={clsx(
                        "text-xs font-medium px-2 py-1 rounded-full",
                        theme === 'dark' ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700"
                    )}>
                        Bước {visibleCount}/{totalSteps}
                    </span>

                    {/* Progress Bar with Countdown */}
                    <div className={clsx(
                        "flex-1 h-1.5 rounded-full overflow-hidden relative",
                        theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                    )}>
                        {/* Main progress */}
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out absolute left-0"
                            style={{ width: `${progressPercent}%` }}
                        />
                        {/* Countdown overlay */}
                        {isAutoRevealing && visibleCount < totalSteps && (
                            <div
                                className="h-full bg-amber-400/50 absolute transition-all duration-100"
                                style={{
                                    left: `${progressPercent}%`,
                                    width: `${(100 - progressPercent) * (1 - countdownPercent / 100)}%`
                                }}
                            />
                        )}
                    </div>

                    {/* Auto-Reveal Controls */}
                    <div className="flex items-center gap-1">
                        {/* Delay Toggle */}
                        <button
                            onClick={cycleDelay}
                            className={clsx(
                                "text-xs px-2 py-1 rounded-md transition-colors",
                                theme === 'dark'
                                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                            title="Đổi thời gian chờ"
                        >
                            {autoRevealDelay / 1000}s
                        </button>

                        {/* Play/Pause Button */}
                        <button
                            onClick={toggleAutoReveal}
                            disabled={visibleCount >= totalSteps}
                            className={clsx(
                                "p-1.5 rounded-md transition-all",
                                isAutoRevealing
                                    ? "bg-amber-500 text-white hover:bg-amber-600"
                                    : theme === 'dark'
                                        ? "bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800"
                                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
                                visibleCount >= totalSteps && "opacity-50 cursor-not-allowed"
                            )}
                            title={isAutoRevealing ? "Tạm dừng (P)" : "Tự động (P)"}
                        >
                            {isAutoRevealing ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Manual Step Navigation (visible when not auto-revealing) */}
            {totalSteps > 1 && !isAutoRevealing && visibleCount > 0 && visibleCount < totalSteps && (
                <div className="flex justify-center gap-2 mb-2">
                    <button
                        onClick={() => setVisibleCount(v => Math.max(0, v - 1))}
                        className={clsx(
                            "flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-colors",
                            theme === 'dark'
                                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        <ChevronLeft size={14} /> Lùi
                    </button>
                    <button
                        onClick={() => setVisibleCount(v => Math.min(v + 1, totalSteps))}
                        className={clsx(
                            "flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-colors",
                            theme === 'dark'
                                ? "bg-indigo-900/50 text-indigo-300 hover:bg-indigo-800"
                                : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        )}
                    >
                        Tiến <ChevronRight size={14} />
                    </button>
                </div>
            )}

            {/* Steps */}
            {steps.slice(0, visibleCount).map((step, idx) => {
                const isCurrentStep = idx === visibleCount - 1;
                return (
                    <div
                        key={idx}
                        ref={(el) => { stepRefs.current[idx] = el; }}
                        className={clsx(
                            "transition-all ease-out pl-4 border-l-2",
                            isCurrentStep
                                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-r-lg py-2 pr-2"
                                : "border-indigo-300 dark:border-indigo-700",
                            "animate-in fade-in slide-in-from-bottom-4 fill-mode-forwards"
                        )}
                        style={{ animationDuration: '500ms', animationDelay: `${idx * 50}ms` }}
                    >
                        <LatexRenderer content={step} cachedImages={cachedImages} theme={theme} basePath={basePath} macros={macros} onZoom={onZoom} fileRef={fileRef} />
                    </div>
                );
            })}

            {/* Continue Prompt */}
            {visibleCount < steps.length && visibleCount === 0 && (
                <div className="text-center mt-8 pb-4">
                    <button
                        onClick={() => setVisibleCount(v => v + 1)}
                        className={clsx(
                            "text-xs animate-pulse hover:text-indigo-600 transition-colors cursor-pointer flex flex-col items-center gap-1 mx-auto",
                            theme === 'dark' ? "text-indigo-400/70" : "text-indigo-500/70"
                        )}
                    >
                        <span>⬇️</span>
                        <span>SPACE: tiếp tục • P: tự động • Shift+Space: hiện tất cả</span>
                    </button>
                </div>
            )}

            {/* Auto-Reveal Active Indicator */}
            {isAutoRevealing && visibleCount < totalSteps && (
                <div className={clsx(
                    "text-center text-xs py-2 rounded-lg animate-pulse",
                    theme === 'dark' ? "text-amber-400 bg-amber-900/20" : "text-amber-600 bg-amber-50"
                )}>
                    ▶ Đang tự động hiện... (nhấn P hoặc Space để dừng)
                </div>
            )}

            {/* Completion Indicator */}
            {visibleCount === steps.length && steps.length > 0 && (
                <div className={clsx(
                    "text-center text-xs py-2 rounded-lg",
                    theme === 'dark' ? "text-emerald-400 bg-emerald-900/20" : "text-emerald-600 bg-emerald-50"
                )}>
                    ✓ Hoàn thành lời giải ({totalSteps} bước)
                </div>
            )}
        </div>
    );
});


