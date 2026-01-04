import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Peer, { DataConnection } from 'peerjs';
import { RemoteCommand, RemoteEvent } from '../services/RemoteControl/types';
import { ArrowLeft, Lock, MousePointer2, RefreshCw, Smartphone } from 'lucide-react';
import { useGesture } from '@use-gesture/react';

export const RemoteController = () => {
    const [searchParams] = useSearchParams();
    const hostId = searchParams.get('id');

    const [status, setStatus] = useState<'INIT' | 'CONNECTING' | 'AUTH' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('INIT');
    const [pin, setPin] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Peer Refs
    const peerRef = useRef<Peer | null>(null);
    const connRef = useRef<DataConnection | null>(null);
    const reconnectTimerRef = useRef<any>(null);

    useEffect(() => {
        if (hostId) {
            connectToHost();
        } else {
            setStatus('ERROR');
            setErrorMsg('Missing Host ID in URL');
        }

        return () => {
            cleanup();
        };
    }, [hostId]);

    const cleanup = () => {
        if (connRef.current) connRef.current.close();
        if (peerRef.current) peerRef.current.destroy();
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };

    const connectToHost = () => {
        setStatus('CONNECTING');
        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', (myId) => {
            console.log('My Peer ID:', myId);
            const conn = peer.connect(hostId!, { serialization: 'json' }); // Use JSON for lighter payload
            setupConnection(conn);
        });

        peer.on('error', (err) => {
            console.error('Peer Error:', err);
            handleDisconnect('Connection Failed: ' + err.type);
        });
    };

    const setupConnection = (conn: DataConnection) => {
        connRef.current = conn;

        conn.on('open', () => {
            console.log('Connected to Host. Waiting for Auth...');
            setStatus('AUTH');
            // If we had a stored PIN, we could auto-submit here
        });

        conn.on('data', (data: any) => {
            if (data?.type === 'AUTH_OK') {
                setStatus('CONNECTED');
            } else if (data?.type === 'AUTH_FAIL') {
                setStatus('AUTH'); // Go back to PIN screen
                setErrorMsg('Sai mã PIN. Vui lòng thử lại.');
                setPin('');
            } else if (data?.type === 'ERROR') {
                handleDisconnect(data.message || 'Error from Host');
            }
        });

        conn.on('close', () => {
            handleDisconnect('Host closed connection');
        });

        conn.on('error', () => {
            handleDisconnect('Network Error');
        });
    };

    const handleDisconnect = (reason: string) => {
        setStatus('DISCONNECTED');
        setErrorMsg(reason);
        connRef.current = null;
    };

    const submitPin = () => {
        if (connRef.current && status === 'AUTH') {
            connRef.current.send({ type: 'AUTH', pin, device: platformDetector() });
        }
    };

    // --- INTERACTION LOGIC (Interaction Mirror) ---

    const sendEvent = (event: RemoteEvent) => {
        if (connRef.current && status === 'CONNECTED') {
            const cmd: RemoteCommand = {
                version: 1,
                id: Math.random().toString(36).substr(2, 9),
                payload: event
            };
            connRef.current.send(cmd);
            triggerHaptic();
        }
    };

    const triggerHaptic = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(10);
        }
    };

    // Gesture Handling
    const bind = useGesture({
        onDrag: ({ swipe: [swipeX, swipeY] }) => {
            if (swipeX === 1) sendEvent({ type: 'GESTURE', kind: 'SWIPE', direction: 'RIGHT', velocity: 1 });
            if (swipeX === -1) sendEvent({ type: 'GESTURE', kind: 'SWIPE', direction: 'LEFT', velocity: 1 });
            if (swipeY === -1) sendEvent({ type: 'GESTURE', kind: 'SWIPE', direction: 'UP', velocity: 1 });
        },
        onClick: () => {
            // Calculate percentage relative to screen for "Tap"
            // For now just basic Tap
            // sendEvent({ type: 'GESTURE', kind: 'TAP', x: 0, y: 0 });
        }
    });

    const platformDetector = () => {
        const ua = navigator.userAgent;
        if (/android/i.test(ua)) return 'Android Phone';
        if (/ipad|iphone|ipod/i.test(ua)) return 'iPhone';
        return 'Web Client';
    };

    // --- RENDER ---

    if (status === 'ERROR' || status === 'DISCONNECTED') {
        return (
            <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
                <Smartphone className="text-gray-600 mb-4" size={48} />
                <h2 className="text-xl font-bold mb-2">Ngắt kết nối</h2>
                <p className="text-gray-400 mb-6">{errorMsg}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-indigo-600 rounded-xl font-bold active:scale-95 transition-transform"
                >
                    Kết nối lại
                </button>
            </div>
        );
    }

    if (status === 'AUTH') {
        return (
            <div className="h-screen bg-indigo-900 text-white flex flex-col items-center justify-center p-6">
                <Lock className="text-indigo-400 mb-4" size={48} />
                <h2 className="text-xl font-bold mb-6">Nhập mã PIN</h2>

                <div className="flex gap-2 mb-8">
                    {/* Pseudo Input Display */}
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-3xl font-bold ${pin.length > i ? 'bg-white text-indigo-900 border-white' : 'border-indigo-700 text-transparent'
                            }`}>
                            {pin[i] || '•'}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-4 w-full max-w-[300px]">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => {
                                if (pin.length < 4) {
                                    const next = pin + num;
                                    setPin(next);
                                }
                            }}
                            className="h-16 rounded-2xl bg-white/10 text-2xl font-bold active:bg-white/30 transition-colors"
                        >
                            {num}
                        </button>
                    ))}
                    <div /> {/* Spacer */}
                    <button
                        onClick={() => {
                            if (pin.length < 4) {
                                const next = pin + '0';
                                setPin(next);
                            }
                        }}
                        className="h-16 rounded-2xl bg-white/10 text-2xl font-bold active:bg-white/30 transition-colors"
                    >
                        0
                    </button>
                    <button
                        onClick={() => setPin(pin.slice(0, -1))}
                        className="h-16 rounded-2xl bg-transparent text-indigo-300 active:bg-white/10 transition-colors flex items-center justify-center"
                    >
                        <ArrowLeft />
                    </button>
                </div>

                <div className="mt-8 w-full max-w-[300px]">
                    <button
                        disabled={pin.length !== 4}
                        onClick={submitPin}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${pin.length === 4 ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        Kết nối
                    </button>
                    {errorMsg && <p className="text-red-400 text-sm font-medium mt-4 text-center">{errorMsg}</p>}
                </div>
            </div>
        );
    }

    if (status === 'CONNECTING' || status === 'INIT') {
        return (
            <div className="h-screen bg-indigo-950 text-white flex flex-col items-center justify-center gap-4">
                <RefreshCw className="animate-spin text-indigo-400" size={32} />
                <p>Đang kết nối...</p>
            </div>
        );
    }

    // CONNECTED (Touchpad Mode)
    return (
        <div {...bind()} className="h-screen w-screen bg-gray-900 text-white overflow-hidden touch-none relative select-none">
            {/* Background Hint */}
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-10 pointer-events-none">
                <MousePointer2 size={120} />
                <p className="mt-4 font-bold text-2xl">Touchpad Area</p>
                <p className="mt-2 text-sm">Swipe Left/Right to change slide</p>
                <p className="mt-1 text-sm">Tap to click</p>
            </div>

            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-mono opacity-70">CONNECTED</span>
                </div>
                <button className="p-2 bg-white/10 rounded-full" onClick={() => sendEvent({ type: 'GESTURE', kind: 'SWIPE', direction: 'UP', velocity: 1 })}>
                    <Lock size={16} />
                </button>
            </div>

            {/* Laser Button (Floating) */}
            <button
                className="absolute bottom-8 right-8 w-16 h-16 bg-red-500 rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform"
                onTouchStart={() => navigator.vibrate?.(50)}
                onClick={() => sendEvent({ type: 'SET_TOOL', tool: 'LASER' })} // Or dedicated action
            >
                <div className="w-4 h-4 bg-white rounded-full" />
            </button>
        </div>
    );
};
