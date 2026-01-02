import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Clock } from 'lucide-react';
import { sounds } from '../utils/sound';
import clsx from 'clsx';

export const ClassroomTimer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [timeLeft, setTimeLeft] = useState(300); // Default 5 mins
    const [isActive, setIsActive] = useState(false);
    const [totalTime, setTotalTime] = useState(300);

    useEffect(() => {
        let interval: any = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isActive) {
            setIsActive(false);
            sounds.playCorrect(); // Reuse sound or add alert sound
            alert("Hết giờ làm bài!");
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    const toggle = () => {
        sounds.playClick();
        setIsActive(!isActive);
    }

    const reset = (seconds?: number) => {
        sounds.playClick();
        setIsActive(false);
        const newTime = seconds || totalTime;
        setTimeLeft(newTime);
        setTotalTime(newTime);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = ((totalTime - timeLeft) / totalTime) * 100;

    return (
        <div className="fixed top-20 right-6 z-[150] bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-64 animate-in slide-in-from-right-10">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <Clock size={20} />
                    <span>Thời gian làm bài</span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-400">
                    <X size={20} />
                </button>
            </div>

            <div className="relative h-2 bg-gray-100 rounded-full mb-6 overflow-hidden">
                <div
                    className={clsx("absolute left-0 top-0 h-full transition-all duration-1000", timeLeft < 30 ? "bg-red-500" : "bg-indigo-500")}
                    style={{ width: `${100 - progress}%` }}
                />
            </div>

            <div className={clsx(
                "text-5xl font-black text-center mb-6 font-mono tracking-tighter",
                timeLeft < 30 && isActive ? "text-red-600 animate-pulse" : "text-gray-800"
            )}>
                {formatTime(timeLeft)}
            </div>

            <div className="grid grid-cols-4 gap-2 mb-6">
                {[1, 2, 5, 10].map(m => (
                    <button
                        key={m}
                        onClick={() => reset(m * 60)}
                        className="py-1 text-xs font-bold border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                    >
                        {m}m
                    </button>
                ))}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={toggle}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all",
                        isActive ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                    )}
                >
                    {isActive ? <Pause size={20} /> : <Play size={20} />}
                    {isActive ? 'Tạm dừng' : 'Bắt đầu'}
                </button>
                <button
                    onClick={() => reset()}
                    className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                    title="Reset"
                >
                    <RotateCcw size={20} />
                </button>
            </div>
        </div>
    );
};
