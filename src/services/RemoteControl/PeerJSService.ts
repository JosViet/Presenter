import Peer, { DataConnection } from 'peerjs';
import { HostSession, IRemoteService, RemoteCommand, RemoteConnectionStatus } from './types';

export class PeerJSService implements IRemoteService {
    private peer: Peer | null = null;
    private conn: DataConnection | null = null;
    private statusListeners: Array<(status: RemoteConnectionStatus) => void> = [];
    private commandListeners: Array<(cmd: RemoteCommand) => void> = [];

    private currentPin: string | null = null;
    private expiryTimer: any = null;
    private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 mins

    constructor() {
        // Auto-cleanup on unload
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => this.stopHost());
        }
    }

    async startHost(): Promise<HostSession> {
        this.stopHost(); // Ensure clean slate
        this.updateStatus({ state: 'CONNECTING' });

        this.currentPin = this.generatePin();
        const peerId = 'vlms-' + Math.random().toString(36).substr(2, 9);

        return new Promise((resolve, reject) => {
            this.peer = new Peer(peerId, {
                debug: 1,
            });

            this.peer.on('open', (id) => {
                const session: HostSession = {
                    id,
                    pin: this.currentPin!,
                    url: `${window.location.origin}/remote?id=${id}`,
                    expiry: Date.now() + this.INACTIVITY_TIMEOUT
                };
                // Initial status: Ready but no client
                this.updateStatus({ state: 'CONNECTED' }); // Host is connected to Broker
                this.resetExpiry();
                resolve(session);
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Error:', err);
                this.updateStatus({ state: 'DISCONNECTED', reason: 'Broker connection failed' });
                reject(err);
            });
        });
    }

    private handleIncomingConnection(conn: DataConnection) {
        // Session Lock: Reject if already connected
        if (this.conn && this.conn.open) {
            conn.send({ type: 'ERROR', message: 'BUSY_SESSION' });
            setTimeout(() => conn.close(), 500);
            return;
        }

        conn.on('open', () => {
            // connection established, wait for AUTH
        });

        conn.on('data', (data: any) => {
            // Handshake Protocol
            if (data?.type === 'AUTH') {
                if (data.pin === this.currentPin) {
                    this.conn = conn;
                    this.conn.send({ type: 'AUTH_OK' });
                    this.updateStatus({ state: 'CONNECTED', deviceName: data.device || 'Remote' });
                    this.resetExpiry();
                } else {
                    conn.send({ type: 'AUTH_FAIL' });
                    setTimeout(() => conn.close(), 500);
                }
                return;
            }

            // Command Handling
            if (this.conn === conn && data?.version === 1) {
                this.resetExpiry(); // Activity = alive
                this.notifyCommands(data as RemoteCommand);
            }
        });

        conn.on('close', () => {
            if (this.conn === conn) {
                this.conn = null;
                this.updateStatus({ state: 'CONNECTED' }); // Fallback to "Ready for new client"
                // Or "DISCONNECTED" if we want to force re-scan? 
                // Plan says: "Graceful Exit -> Client shows Session Ended". 
                // For Host: It stays ready for reconnection.
            }
        });

        conn.on('error', (err) => {
            console.error('Connection Error:', err);
            if (this.conn === conn) {
                this.updateStatus({ state: 'DISCONNECTED', reason: 'Client dropped' });
                this.conn = null;
            }
        });
    }

    stopHost(): void {
        this.peer?.destroy();
        this.peer = null;
        this.conn = null;
        this.currentPin = null;
        if (this.expiryTimer) clearTimeout(this.expiryTimer);
        this.updateStatus({ state: 'DISCONNECTED' });
    }

    onCommand(callback: (cmd: RemoteCommand) => void): () => void {
        this.commandListeners.push(callback);
        return () => {
            this.commandListeners = this.commandListeners.filter(cb => cb !== callback);
        };
    }

    onStatusChange(callback: (status: RemoteConnectionStatus) => void): () => void {
        this.statusListeners.push(callback);
        return () => {
            this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
        };
    }

    getCapabilities() {
        return ['LASER', 'SWIPE', 'DRAWING', 'TEXT_INPUT'] as any[];
    }

    // --- Helpers ---

    private updateStatus(status: RemoteConnectionStatus) {
        this.statusListeners.forEach(cb => cb(status));
    }

    private notifyCommands(cmd: RemoteCommand) {
        this.commandListeners.forEach(cb => cb(cmd));
    }

    private generatePin(): string {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    private resetExpiry() {
        if (this.expiryTimer) clearTimeout(this.expiryTimer);
        this.expiryTimer = setTimeout(() => {
            console.log('Session Expired due to inactivity');
            this.stopHost();
        }, this.INACTIVITY_TIMEOUT);
    }
}
