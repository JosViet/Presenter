import React, { useEffect, useState } from 'react';
import { X, Smartphone, Wifi, StopCircle, RefreshCw, Lock } from 'lucide-react';
import QRCode from 'qrcode';

interface RemoteControlModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RemoteControlModal: React.FC<RemoteControlModalProps> = ({ isOpen, onClose }) => {
    const [serverInfo, setServerInfo] = useState<{ ip: string, port: number, url: string, pin: string } | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && !serverInfo) {
            startServer();
        }
    }, [isOpen]);

    const startServer = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const info = await window.electronAPI.startRemoteServer();
            setServerInfo(info);
            const qr = await QRCode.toDataURL(info.url, { width: 300, margin: 2, color: { dark: '#4F46E5', light: '#FFFFFF' } });
            setQrDataUrl(qr);
        } catch (err: any) {
            setError(err.message || 'Failed to start server');
        } finally {
            setIsLoading(false);
        }
    };

    const stopServer = async () => {
        try {
            await window.electronAPI.stopRemoteServer();
            setServerInfo(null);
            setQrDataUrl(null);
        } catch (err) {
            console.error(err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-indigo-600 p-6 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <Smartphone size={28} />
                        <div>
                            <h2 className="text-xl font-bold">Điều khiển từ xa</h2>
                            <p className="text-indigo-200 text-xs">Quét mã để kết nối</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {serverInfo && (
                            <button
                                onClick={stopServer}
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
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center gap-4 text-indigo-600">
                            <RefreshCw className="animate-spin" size={40} />
                            <p>Đang khởi động máy chủ...</p>
                        </div>
                    ) : error ? (
                        <div className="py-8 text-red-600">
                            <p className="font-bold mb-2">Lỗi khởi động:</p>
                            <p className="text-sm">{error}</p>
                            <button
                                onClick={startServer}
                                className="mt-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-medium"
                            >
                                Thử lại
                            </button>
                        </div>
                    ) : serverInfo ? (
                        <>
                            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-inner mb-4">
                                {qrDataUrl ? (
                                    <img src={qrDataUrl} alt="QR Code" className="w-52 h-52 object-contain" />
                                ) : (
                                    <div className="w-52 h-52 bg-gray-100 animate-pulse rounded-lg" />
                                )}
                            </div>

                            {/* PIN Display */}
                            <div className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 mb-4 text-white">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Lock size={18} />
                                    <span className="text-sm font-medium">Mã PIN kết nối</span>
                                </div>
                                <div className="flex justify-center gap-2">
                                    {(serverInfo.pin || '0000').split('').map((digit, i) => (
                                        <span key={i} className="w-12 h-14 flex items-center justify-center bg-white/20 rounded-lg text-2xl font-bold border-2 border-white/30">
                                            {digit}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-indigo-200 text-xs mt-2">Nhập mã này trên điện thoại</p>
                            </div>

                            <div className="w-full bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4">
                                <div className="flex items-center justify-center gap-2 text-indigo-800 font-bold mb-1">
                                    <Wifi size={16} />
                                    <span className="text-sm">Chung mạng Wifi</span>
                                </div>
                                <p className="text-indigo-600/80 text-xs">
                                    Điện thoại và Máy tính phải kết nối cùng 1 mạng.
                                </p>
                            </div>

                            <div className="text-left w-full space-y-1">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Địa chỉ thủ công:</p>
                                <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg font-mono text-sm text-gray-700 select-all">
                                    {serverInfo.url}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-8 text-gray-500">
                            <p>Server đã tắt.</p>
                            <button
                                onClick={startServer}
                                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200"
                            >
                                Bật lại Remote
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
