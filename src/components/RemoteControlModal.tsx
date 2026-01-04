import React, { useEffect, useState } from 'react';
import { X, Smartphone, Wifi, StopCircle, RefreshCw, Lock, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';
import { useRemoteControl } from '../contexts/RemoteControlContext';

interface RemoteControlModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RemoteControlModal: React.FC<RemoteControlModalProps> = ({ isOpen, onClose }) => {
    // New Hook Use
    const { startHost, stopHost, session, status } = useRemoteControl();

    // UI Local State
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial Start
    useEffect(() => {
        if (isOpen && !session && status.state === 'DISCONNECTED') {
            handleStart();
        }
    }, [isOpen]);

    // QR Generation when session changes
    useEffect(() => {
        if (session) {
            QRCode.toDataURL(session.url, { width: 300, margin: 2, color: { dark: '#4F46E5', light: '#FFFFFF' } })
                .then(setQrDataUrl)
                .catch(err => console.error('QR Error', err));
        } else {
            setQrDataUrl(null);
        }
    }, [session]);

    const handleStart = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await startHost();
        } catch (err: any) {
            setError(err.message || 'Failed to start remote service');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStop = () => {
        stopHost();
    };

    if (!isOpen) return null;

    if (!isOpen) return null;

    const deviceName = status.state === 'CONNECTED' && status.deviceName;

    return (
        <div className="absolute inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-indigo-600 p-6 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <Smartphone size={28} />
                        <div>
                            <h2 className="text-xl font-bold">Điều khiển từ xa</h2>
                            <p className="text-indigo-200 text-xs">Beta Version (Interaction Proxy)</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {session && (
                            <button
                                onClick={handleStop}
                                className="p-2 hover:bg-white/10 rounded-full text-red-200 hover:text-red-100 transition-colors"
                                title="Tắt Server"
                            >
                                <StopCircle size={20} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 flex flex-col items-center text-center">
                    {/* Status: Loading */}
                    {isLoading && (
                        <div className="py-12 flex flex-col items-center gap-4 text-indigo-600">
                            <RefreshCw className="animate-spin" size={40} />
                            <p>Đang tạo phòng kết nối...</p>
                        </div>
                    )}

                    {/* Status: Error */}
                    {!isLoading && error && (
                        <div className="py-8 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                                <AlertTriangle className="text-red-600" size={32} />
                            </div>
                            <p className="font-bold text-red-600 mb-2">Không thể tạo phòng</p>
                            <p className="text-sm text-gray-500 mb-6">{error}</p>
                            <button
                                onClick={handleStart}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                            >
                                Thử lại
                            </button>
                        </div>
                    )}


                    {/* Status: Active Session (Ready or Connected) */}
                    {!isLoading && !error && session && (
                        <>
                            {/* Connected Banner */}
                            {deviceName && (
                                <div className="w-full bg-green-100 border border-green-200 text-green-700 p-3 rounded-xl mb-6 animate-in slide-in-from-top-4">
                                    <div className="flex items-center justify-center gap-2 font-bold">
                                        <Smartphone size={18} />
                                        <span>Đã kết nối</span>
                                    </div>
                                    <p className="text-xs opacity-80 mt-1">Thiết bị: {deviceName}</p>
                                </div>
                            )}

                            {/* QR Code */}
                            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-inner mb-6 relative">
                                {qrDataUrl ? (
                                    <img
                                        src={qrDataUrl}
                                        alt="QR Code"
                                        className={`w-52 h-52 object-contain transition-opacity duration-300 ${deviceName ? 'opacity-25 blur-sm' : 'opacity-100'}`}
                                    />
                                ) : (
                                    <div className="w-52 h-52 bg-gray-100 animate-pulse rounded-lg" />
                                )}

                                {/* Overlay when connected */}
                                {deviceName && (
                                    <div className="absolute inset-0 flex items-center justify-center flex-col text-indigo-900">
                                        <Lock size={32} className="mb-2 text-indigo-600" />
                                        <span className="font-bold text-sm">Session Locked</span>
                                    </div>
                                )}
                            </div>

                            {/* PIN Display */}
                            <div className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 mb-4 text-white hover:scale-[1.02] transition-transform">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Lock size={18} />
                                    <span className="text-sm font-medium">Mã PIN bảo mật</span>
                                </div>
                                <div className="flex justify-center gap-2">
                                    {(session.pin).split('').map((digit, i) => (
                                        <span key={i} className="w-12 h-14 flex items-center justify-center bg-white/20 rounded-lg text-2xl font-bold border-2 border-white/30 backdrop-blur-sm">
                                            {digit}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-indigo-200 text-xs mt-2">Nhập mã này trên điện thoại để xác thực</p>
                            </div>

                            {/* Network Warning for PeerJS */}
                            <div className="w-full text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <p>⚠️ <b>Lưu ý mạng:</b> Nếu điện thoại không thể vào đường dẫn, hãy tắt Wifi và dùng 4G để thử lại (WebRTC có thể bị chặn bởi tường lửa trường học).</p>
                            </div>

                            {/* Manual URL */}
                            <div className="mt-4 text-[10px] text-gray-400 font-mono break-all">
                                {session.url}
                            </div>
                        </>
                    )}

                    {/* Status: Disconnected (Start Button) */}
                    {!isLoading && !error && !session && (
                        <div className="py-8 text-gray-500">
                            <div className="mb-6 opacity-50">
                                <Wifi size={64} className="mx-auto text-gray-300" />
                            </div>
                            <p>Server đang tắt</p>
                            <button
                                onClick={handleStart}
                                className="mt-6 px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 transition-all hover:translate-y-[-2px]"
                            >
                                Bật Remote
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
