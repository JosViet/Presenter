import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Student } from '../../hooks/useStudentList';
import { X } from 'lucide-react';

// --- SOUND ASSETS ---
const SOUNDS = {
    bgm: '/games/chase/sound/background music.mp3',
    footsteps: '/games/chase/sound/footsteps.mp3',
    start: '/games/chase/sound/whoosh.mp3',
    catch: '/games/chase/sound/panic.mp3',
    tick: '/games/chase/sound/timer_countdown-345137.mp3',
};

interface Props {
    students: Student[];
    onComplete: (winner: Student) => void;
    onCancel: () => void;
}

// --- ROBOT HUNT CONSTANTS (Corrected 1:1) ---
const GAME_CONSTANTS = {
    // Physics (Pixels per frame)
    BASE_RUNNER_SPEED: 4.5,     // Matched original
    ROBOT_START_SPEED: 4.0,     // Matched original
    ROBOT_ACCELERATION: 0.015,  // Matched original

    // Duration: Randomized in logic

    // Dynamic Mechanics
    SPEED_CHANGE_CHANCE: 0.02,
    MIN_SPEED_MULT: 0.7,
    MAX_SPEED_MULT: 1.3,
    PANIC_SPEED_MULT: 1.6,
    PANIC_CHANCE: 0.05,

    // Distances (Pixels)
    STALK_DISTANCE: 220, // Reduced to match original
    DANGER_ZONE: 250,
    CATCH_RADIUS: 50,
    MIN_START_DISTANCE: 400, // Clump start
    MAX_START_DISTANCE: 800, // Clump end

    // Rendering
    PIXELS_TO_PERCENT: 0.076, // 100% / 1300 width
    TEACHER_SCREEN_X: 18,

    // Lane Logic
    LANE_CHANGE_CHANCE: 0.01,
    LANE_LERP_FACTOR: 0.02,
};

// --- TYPES ---
interface Robot {
    distance: number; // World distance (pixels)
    speed: number;
    acceleration: number;
    yRatio: number;   // 0-1 (Vertical position)
}

interface Runner {
    id: string;
    student: Student;
    distance: number; // World distance (pixels)

    // Physics
    currentSpeedMultiplier: number;
    targetSpeedMultiplier: number;

    // Display
    yRatio: number;       // Current lane (0-1)
    targetYRatio: number; // Target lane

    caught: boolean;
    catchTime?: number; // Frame count when caught
    variant: 'boy' | 'girl'; // Random gender for visual variety
}

const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

// Asset paths
const ASSETS = {
    background: '/games/chase/hallway%20background.png',
    teacher: {
        idle: '/games/chase/teacher-idle.png',
        running: '/games/chase/teacher-running.png',
        sprinting: '/games/chase/teacher-sprinting.png',
        caught: '/games/chase/teacher-caught.png',
    },
    student: {
        idle: '/games/chase/student-idle.png',
        running: '/games/chase/student-running.png',
        panic: '/games/chase/student-panic%20running.png',
        scared: '/games/chase/student-scared.png',
        caught: '/games/chase/student-caught.png',
    },
    // NEW FEMALE ASSETS
    student1: {
        idle: '/games/chase/student1-idle.png',
        running: '/games/chase/student1-running.png',
        panic: '/games/chase/student1-panic%20running.png',
        scared: '/games/chase/student1-scared.png',
        caught: '/games/chase/student1-caught.png',
    },
    effects: {
        dust: '/games/chase/dust%20cloud%20effect.png',
        speed: '/games/chase/speed%20effect%20lines.png',
        impact: '/games/chase/impact%20effect.png',
    },
};

export const ChasePicker: React.FC<Props> = ({ students, onComplete, onCancel }) => {
    // --- STATE ---
    const [gameState, setGameState] = useState<'ready' | 'running' | 'ending' | 'finished'>('ready');
    const [countdown, setCountdown] = useState(3);
    const [showCountdown, setShowCountdown] = useState(false);

    // Use REFS for game loop to avoid re-renders
    const robotRef = useRef<Robot>({
        distance: 0,
        speed: GAME_CONSTANTS.ROBOT_START_SPEED,
        acceleration: 0,
        yRatio: 0.5,
    });

    const runnersRef = useRef<Runner[]>([]);

    // Render state
    const [, setRenderTrigger] = useState(0);
    const [winner, setWinner] = useState<Student | null>(null);

    const requestRef = useRef<number>();
    const frameCountRef = useRef(0);
    const timeElapsedRef = useRef(0);
    // Randomize duration per game (Total 13-20s -> Stalk 11-18s + ~2s Catch)
    const chaseDurationRef = useRef(0);

    // Race condition prevention
    const winnerFoundRef = useRef(false);

    // --- INITIALIZATION ---
    const initGame = useCallback(() => {
        // Randomize chase duration: 11s to 18s (frames)
        chaseDurationRef.current = 60 * (11 + Math.random() * 7);

        runnersRef.current = students.map((s) => {
            // Spawn randomly in the start zone (Clumped)
            const startDist = GAME_CONSTANTS.MIN_START_DISTANCE +
                Math.random() * (GAME_CONSTANTS.MAX_START_DISTANCE - GAME_CONSTANTS.MIN_START_DISTANCE);

            return {
                id: s.id,
                student: s,
                distance: startDist,
                currentSpeedMultiplier: 1.0,
                targetSpeedMultiplier: 1.0,
                yRatio: 0.2 + Math.random() * 0.6, // Random vertical start (0.2-0.8)
                targetYRatio: 0.5,
                caught: false,
                variant: Math.random() > 0.5 ? 'boy' : 'girl' // Randomly assign gender
            };
        });

        robotRef.current = {
            distance: 0,
            speed: GAME_CONSTANTS.ROBOT_START_SPEED,
            acceleration: 0,
            yRatio: 0.5,
        };

        frameCountRef.current = 0;
        timeElapsedRef.current = 0;
        winnerFoundRef.current = false; // Reset winner flag
        setWinner(null);
        setGameState('ready');
        setRenderTrigger(prev => prev + 1);
    }, [students]);

    useEffect(() => {
        initGame();
    }, [initGame]);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Audio Helper
    const playSound = (sound: string, loop = false, volume = 0.5) => {
        try {
            const audio = new Audio(sound);
            audio.loop = loop;
            audio.volume = volume;
            audio.play().catch(e => console.warn("Audio play failed", e));
            return audio;
        } catch (e) {
            console.warn("Audio init failed", e);
            return null;
        }
    };

    // BGM Management
    useEffect(() => {
        if (gameState === 'running') {
            audioRef.current = playSound(SOUNDS.bgm, true, 0.4);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        }
        return () => {
            if (audioRef.current) audioRef.current.pause();
        };
    }, [gameState]);

    // --- GAME LOOP ---
    const update = useCallback(() => {
        if (gameState !== 'running' && gameState !== 'ending') return;

        frameCountRef.current++;
        timeElapsedRef.current++;

        const robot = robotRef.current;
        const runners = runnersRef.current; // Directly mutate refs for performance

        // 1. Identify Closest Runner
        const activeRunners = runners.filter(r => !r.caught);

        // Note: Filter is fine, but we need sorted for logic
        const sortedRunners = activeRunners.sort((a, b) => a.distance - b.distance);
        const closestRunner = sortedRunners[0];

        // 2. ROBOT CONTROL
        if (gameState === 'ending') {
            // Stop robot smoothly
            robot.speed = lerp(robot.speed, 0, 0.1);
            robot.distance += robot.speed;
        } else {
            // Use RANDOM DURATION from Ref
            const isTimerExpired = timeElapsedRef.current >= chaseDurationRef.current;

            if (isTimerExpired) {
                robot.acceleration += GAME_CONSTANTS.ROBOT_ACCELERATION;
                robot.speed += robot.acceleration;
            } else {
                const breathing = Math.sin(frameCountRef.current * 0.05) * 50;
                const desiredDist = closestRunner ? (closestRunner.distance - GAME_CONSTANTS.STALK_DISTANCE + breathing) : robot.distance;
                const distError = desiredDist - robot.distance;
                // Matches original kP 0.05
                robot.speed = GAME_CONSTANTS.BASE_RUNNER_SPEED + (distError * 0.05);
                robot.speed = Math.max(0, robot.speed);
            }

            robot.distance += robot.speed;

            if (closestRunner) {
                robot.yRatio = lerp(robot.yRatio, closestRunner.yRatio, 0.05);
            }
        }

        // 3. RUNNER UPDATE
        // Use a for-loop for direct mutation (matching original logic style)
        for (let i = 0; i < runners.length; i++) {
            const runner = runners[i];

            if (runner.caught) continue;

            // If ending, non-caught runners just keep running off screen!
            if (gameState === 'ending') {
                runner.distance += GAME_CONSTANTS.BASE_RUNNER_SPEED * 1.5;
                continue;
            }

            // SPEED LOGIC
            if (Math.random() < GAME_CONSTANTS.SPEED_CHANGE_CHANCE) {
                runner.targetSpeedMultiplier = GAME_CONSTANTS.MIN_SPEED_MULT +
                    Math.random() * (GAME_CONSTANTS.MAX_SPEED_MULT - GAME_CONSTANTS.MIN_SPEED_MULT);
            }

            const distToRobot = runner.distance - robot.distance;
            if (distToRobot < GAME_CONSTANTS.DANGER_ZONE) {
                if (Math.random() < GAME_CONSTANTS.PANIC_CHANCE) {
                    runner.targetSpeedMultiplier = GAME_CONSTANTS.PANIC_SPEED_MULT;
                }
            }

            runner.currentSpeedMultiplier = lerp(runner.currentSpeedMultiplier, runner.targetSpeedMultiplier, 0.05);

            // LANE / DODGE LOGIC
            if (Math.random() < GAME_CONSTANTS.LANE_CHANGE_CHANCE) {
                const isThreatened = distToRobot < GAME_CONSTANTS.DANGER_ZONE * 2.5;
                if (isThreatened) {
                    const robotY = robot.yRatio;
                    let direction = runner.yRatio >= robotY ? 1 : -1;
                    if ((direction === -1 && runner.yRatio < 0.2) || (direction === 1 && runner.yRatio > 0.8)) {
                        direction = -direction;
                    }
                    const magnitude = 0.2 + Math.random() * 0.3;
                    runner.targetYRatio = Math.max(0.1, Math.min(0.9, runner.yRatio + (direction * magnitude)));
                } else {
                    runner.targetYRatio = 0.1 + Math.random() * 0.8;
                }
            }
            runner.yRatio = lerp(runner.yRatio, runner.targetYRatio, GAME_CONSTANTS.LANE_LERP_FACTOR);

            // MOVE
            runner.distance += GAME_CONSTANTS.BASE_RUNNER_SPEED * runner.currentSpeedMultiplier;

            // CATCH CHECK
            if (gameState === 'running'
                && !winnerFoundRef.current // Critical check to prevent multi-catch
                && timeElapsedRef.current >= chaseDurationRef.current
                && distToRobot <= GAME_CONSTANTS.CATCH_RADIUS
            ) {
                winnerFoundRef.current = true; // Lock immediately
                runner.caught = true;
                runner.catchTime = frameCountRef.current;

                // Play Sound
                playSound(SOUNDS.catch);

                setWinner(runner.student);
                setGameState('ending');
                break;
            }
        }

        // 60FPS Render
        setRenderTrigger(prev => prev + 1);
        requestRef.current = requestAnimationFrame(update);
    }, [gameState]);

    useEffect(() => {
        if (gameState === 'running' || gameState === 'ending') {
            requestRef.current = requestAnimationFrame(update);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [gameState, update]);

    // --- HANDLERS ---
    const startGame = () => {
        setShowCountdown(true);
        setCountdown(3);
        const countdownAudio = playSound(SOUNDS.tick); // Play ONCE and capture

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setShowCountdown(false);
                    setGameState('running');

                    // Stop countdown audio strictly
                    if (countdownAudio) {
                        countdownAudio.pause();
                        countdownAudio.currentTime = 0;
                    }

                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // Trigger Whistle on Start Countdown finish
    useEffect(() => {
        if (gameState === 'running' && !showCountdown) {
            playSound(SOUNDS.start);
        }
    }, [gameState, showCountdown]);

    // Trigger Cheer on Winner Display
    useEffect(() => {
        // No specific cheer sound yet, maybe re-use start/whoosh or just silence?
        // User didn't provide 'cheer' explicitly, so removing placeholder.
        // if ((gameState === 'finished' || gameState === 'ending') && winner) { ... }
    }, [gameState, winner]);

    const handleConfirm = () => {
        if (winner) onComplete(winner);
    };

    // --- RENDER HELPERS ---
    const getScreenX = (worldDist: number) => {
        const robotDist = robotRef.current.distance;
        const relativePixels = worldDist - robotDist;
        return GAME_CONSTANTS.TEACHER_SCREEN_X + (relativePixels * GAME_CONSTANTS.PIXELS_TO_PERCENT);
    };

    const robot = robotRef.current;

    return (
        <div className="fixed inset-0 z-[300] bg-black overflow-hidden font-sans">
            {/* BACKGROUND */}
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: `url(${ASSETS.background})`,
                    backgroundPositionX: `${-robot.distance * 0.5}px`,
                    backgroundRepeat: 'repeat-x',
                }}
            />
            <div className="absolute inset-0 bg-black/20" />

            {/* UI */}
            <div className="absolute top-4 left-4 z-40 text-white">
                <h1 className="text-4xl font-black drop-shadow-lg">🚔 ĐUỔI BẮT</h1>
                <p className="text-xl opacity-90">{students.length} học sinh đang chạy trốn...</p>
            </div>

            <button
                onClick={onCancel}
                className="absolute top-4 right-4 z-[500] p-3 bg-black/50 hover:bg-black/70 rounded-full text-white"
            >
                <X size={24} />
            </button>

            {/* GAME WORLD (z 0-150) */}
            <div className="absolute inset-0">
                {/* TEACHER */}
                <div
                    className="absolute transition-none will-change-transform"
                    style={{
                        left: `${GAME_CONSTANTS.TEACHER_SCREEN_X}%`,
                        bottom: `${15 + robot.yRatio * 20}%`,
                        width: '11rem',
                        transform: 'translate(-50%, 0)',
                        zIndex: Math.floor((1 - robot.yRatio) * 100)
                    }}
                >
                    <img
                        src={(gameState === 'finished' || gameState === 'ending') ? ASSETS.teacher.caught : ASSETS.teacher.sprinting}
                        alt="Teacher"
                        className="w-full object-contain drop-shadow-2xl"
                    />
                    {gameState === 'running' && (
                        <img src={ASSETS.effects.dust} className="absolute -left-8 bottom-0 w-16 opacity-60" style={{ transform: 'scaleX(-1)' }} />
                    )}
                </div>

                {/* STUDENTS */}
                {[...runnersRef.current]
                    .sort((a, b) => b.yRatio - a.yRatio)
                    .map(runner => {
                        const screenX = getScreenX(runner.distance);
                        if (screenX < -10 || screenX > 110) return null; // Optimization

                        const isLastPlace = !runner.caught && runner === runnersRef.current.filter(r => !r.caught).sort((a, b) => a.distance - b.distance)[0];

                        // VISUAL NORMALIZATION:
                        // - Caught sprite is tall/large -> Reduce to 6rem
                        // - Panic sprite (Last Place) is small/padded -> Increase to 9rem
                        // - Normal Running -> Reduce to 7rem
                        let visualWidth = '7rem';
                        let visualLeft = `${screenX}%`;
                        let visualBottom = `${15 + runner.yRatio * 20}%`; // Default runner Y
                        let visualZIndex = Math.floor((1 - runner.yRatio) * 100);

                        if (runner.caught) {
                            visualWidth = '6rem';
                            // ALIGNMENT FIX (23.5% + Teacher Y)
                            visualLeft = '23.5%';
                            visualBottom = `${15 + robot.yRatio * 20}%`;
                            visualZIndex = Math.floor((1 - robot.yRatio) * 100) + 10;
                        }
                        else if (isLastPlace) visualWidth = '9rem';

                        // FEMALE SIZE ADJUSTMENT: Reduce by 1rem ONLY if caught
                        if (runner.variant === 'girl' && runner.caught) {
                            visualWidth = '5rem';
                        }

                        const assetSource = runner.variant === 'girl' ? ASSETS.student1 : ASSETS.student;

                        return (
                            <div
                                key={runner.id}
                                className="absolute transition-none will-change-transform"
                                style={{
                                    left: visualLeft,
                                    bottom: visualBottom,
                                    width: visualWidth,
                                    transform: 'translate(-50%, 0)',
                                    zIndex: visualZIndex
                                }}
                            >
                                <img
                                    src={runner.caught ? assetSource.caught :
                                        isLastPlace ? assetSource.panic : assetSource.running}
                                    alt="Student"
                                    className="w-full object-contain drop-shadow-xl"
                                />

                                {/* Name Tag */}
                                <div className={`
                                    absolute -top-8 left-1/2 -translate-x-1/2 
                                    px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap shadow-md
                                    ${runner.caught ? 'bg-red-500 text-white animate-bounce' :
                                        isLastPlace ? 'bg-yellow-400 text-black scale-110' : 'bg-white/90 text-gray-800'}
                                `}>
                                    {runner.student.name}
                                </div>

                                {/* Speed Lines */}
                                {gameState === 'running' && !runner.caught && (
                                    <img
                                        src={ASSETS.effects.speed}
                                        className="absolute -left-12 top-1/2 -translate-y-1/2 w-16 opacity-40"
                                        style={{ transform: 'scaleX(-1)' }}
                                    />
                                )}
                            </div>
                        );
                    })}
            </div>

            {/* COUNTDOWN */}
            {showCountdown && (
                <div className="absolute inset-0 flex items-center justify-center z-[400] bg-black/40">
                    <div className="text-[12rem] font-black text-white animate-bounce drop-shadow-2xl">
                        {countdown}
                    </div>
                </div>
            )}

            {/* START UI */}
            {gameState === 'ready' && !showCountdown && (
                <div className="absolute inset-0 flex items-center justify-center z-[400]">
                    <button
                        onClick={startGame}
                        className="px-12 py-6 bg-gradient-to-r from-red-600 to-orange-500 text-white text-3xl font-black rounded-2xl shadow-xl hover:scale-105 transition-transform"
                    >
                        BẮT ĐẦU ĐUỔI! 🚔
                    </button>
                    <div className="absolute bottom-10 text-white/80 text-lg bg-black/50 px-6 py-2 rounded-full">
                        Thầy giáo sẽ đuổi theo! Ai chạy chậm nhất sẽ bị bắt!
                    </div>
                </div>
            )}

            {/* WINNER UI */}
            {(gameState === 'finished' || gameState === 'ending') && winner && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[400] animate-in slide-in-from-top duration-500">
                    <div className="bg-white p-6 rounded-3xl shadow-2xl border-4 border-yellow-400 text-center">
                        <div className="text-xl font-bold text-gray-500 mb-1">BẮT ĐƯỢC!</div>
                        <div className="text-4xl font-black text-red-600 mb-4">{winner.name}</div>
                        <div className="flex gap-3 justify-center">
                            <button onClick={initGame} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold">
                                🔄 Chơi lại
                            </button>
                            <button onClick={handleConfirm} className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold shadow-lg">
                                ✓ Chọn em này
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChasePicker;
