import React, { createContext, useContext, useEffect, useState } from 'react';
import { IRemoteService, HostSession, RemoteConnectionStatus, RemoteCommand } from '../services/RemoteControl/types';
import { PeerJSService } from '../services/RemoteControl/PeerJSService';

// Electron service adapter would be imported here if/when moved to unified interface
// For now, we only use PeerJS for the Web version as per plan.

interface RemoteControlContextType {
    service: IRemoteService | null;
    session: HostSession | null;
    status: RemoteConnectionStatus;
    startHost: () => Promise<void>;
    stopHost: () => void;
    lastCommand: RemoteCommand | null;
}

const RemoteControlContext = createContext<RemoteControlContextType | null>(null);

export const RemoteControlProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [service] = useState<IRemoteService>(() => new PeerJSService());
    const [session, setSession] = useState<HostSession | null>(null);
    const [status, setStatus] = useState<RemoteConnectionStatus>({ state: 'DISCONNECTED' });
    const [lastCommand, setLastCommand] = useState<RemoteCommand | null>(null);

    useEffect(() => {
        // Subscribe to status changes
        const unsubStatus = service.onStatusChange((newStatus) => {
            setStatus(newStatus);
            if (newStatus.state === 'DISCONNECTED') {
                setSession(null);
            }
        });

        // Subscribe to commands
        const unsubCommand = service.onCommand((cmd) => {
            console.log('[Remote] Command received:', cmd);
            setLastCommand(cmd);
            // In a real app, we might dispatch to a global event bus or Redux here
            // For now, consumers (App.tsx / AnnotationLayer) will listen to 'lastCommand' changes
            // OR we can expose an event emitter from Context. 
            // Better: Dispatch a CustomEvent on window for loose coupling with non-React parts?
            // "Interaction Mirror" pattern suggests direct mapping.
            // Using window event for broad broadcast:
            window.dispatchEvent(new CustomEvent('remote-command', { detail: cmd }));
        });

        return () => {
            unsubStatus();
            unsubCommand();
            service.stopHost();
        };
    }, [service]);

    const startHost = async () => {
        try {
            const sess = await service.startHost();
            setSession(sess);
        } catch (err) {
            console.error('Failed to start host:', err);
            // Status is already updated by service
        }
    };

    const stopHost = () => {
        service.stopHost();
    };

    return (
        <RemoteControlContext.Provider value={{
            service,
            session,
            status,
            startHost,
            stopHost,
            lastCommand
        }}>
            {children}
        </RemoteControlContext.Provider>
    );
};

export const useRemoteControl = () => {
    const context = useContext(RemoteControlContext);
    if (!context) throw new Error('useRemoteControl must be used within RemoteControlProvider');
    return context;
};
