export interface IRemoteService {
    /** Start hosting a session. Returns session info (PIN, ID) */
    startHost(): Promise<HostSession>;

    /** Stop the current session */
    stopHost(): void;

    /** Subscribe to incoming commands/events from the remote */
    onCommand(callback: (cmd: RemoteCommand) => void): () => void;

    /** Subscribe to connection status changes */
    onStatusChange(callback: (status: RemoteConnectionStatus) => void): () => void;

    /** Get supported capabilities of this transport/platform */
    getCapabilities(): RemoteCapability[];
}

export type RemoteConnectionStatus =
    | { state: 'DISCONNECTED'; reason?: string }
    | { state: 'CONNECTING' }
    | { state: 'CONNECTED'; deviceName?: string };

export type HostSession = {
    id: string; // PeerID or IP:Port
    pin: string;
    url: string;
    expiry?: number; // Timestamp
};

export type RemoteCapability = 'LASER' | 'SWIPE' | 'DRAWING' | 'TEXT_INPUT';

export type RemoteCommand = {
    version: 1;
    id: string; // UUID
    payload: RemoteEvent;
};

// INTERACTION MIRROR PROTOCOL
export type RemoteEvent =
    // Navigation & Shortcuts
    | { type: 'GESTURE'; kind: 'SWIPE'; direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'; velocity: number }
    | { type: 'GESTURE'; kind: 'TAP'; x: number; y: number } // Percentage 0-1

    // Pointer / Cursor Mirroring
    | { type: 'CURSOR'; x: number; y: number; phase: 'START' | 'MOVE' | 'END' }

    // Realtime Drawing
    | { type: 'DRAWING'; points: Array<{ x: number, y: number }>; isFinished: boolean }

    // Text Input
    | { type: 'INPUT'; text: string; isCommit: boolean }

    // Mode Switching Request (e.g., User switches tool on remote)
    | { type: 'SET_TOOL'; tool: 'POINTER' | 'PEN' | 'ERASER' | 'LASER' };
