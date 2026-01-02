import http from 'http';
import os from 'os';
import crypto from 'crypto';
import { BrowserWindow } from 'electron';

export class RemoteServer {
    private server: http.Server | null = null;
    private port = 3000;
    private mainWindow: BrowserWindow;
    private currentState: any = { type: 'unknown', options: null, hasShortAnswer: false };

    // Authentication
    private pin: string = '';
    private authToken: string = '';
    private authenticatedClients: Set<string> = new Set();

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
        this.generateCredentials();
    }

    private generateCredentials() {
        // Generate 4-digit PIN
        this.pin = Math.floor(1000 + Math.random() * 9000).toString();
        // Generate secure token
        this.authToken = crypto.randomBytes(32).toString('hex');
        this.authenticatedClients.clear();
    }

    getPin(): string {
        return this.pin;
    }

    private getClientId(req: http.IncomingMessage): string {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = typeof forwarded === 'string' ? forwarded : req.socket.remoteAddress || '';
        return ip;
    }

    private isAuthenticated(req: http.IncomingMessage): boolean {
        // Check Authorization header for token
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader === `Bearer ${this.authToken}`) {
            return true;
        }

        // Check query param 'token' for image requests
        try {
            // content-type might not be set for get, just parsing url
            // We need a base for relative URLs
            const url = new URL(req.url || '', 'http://localhost');
            if (url.searchParams.get('token') === this.authToken) {
                return true;
            }
        } catch (e) { }

        // Check if client IP is in authenticated set
        return this.authenticatedClients.has(this.getClientId(req));
    }

    start(): Promise<{ ip: string; port: number; url: string; pin: string }> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                const ip = this.getLocalIP();
                resolve({ ip, port: this.port, url: `http://${ip}:${this.port}`, pin: this.pin });
                return;
            }

            // Regenerate credentials on each start
            this.generateCredentials();

            this.server = http.createServer(async (req, res) => {
                // Enable CORS
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

                if (req.method === 'OPTIONS') {
                    res.writeHead(200);
                    res.end();
                    return;
                }

                const url = new URL(req.url || '', 'http://localhost');
                const pathname = url.pathname;

                if (pathname === '/' && req.method === 'GET') {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(this.getClickRelayHTML());
                    return;
                }

                // Authentication endpoint - verify PIN
                if (pathname === '/api/auth' && req.method === 'POST') {
                    let body = '';
                    req.on('data', chunk => { body += chunk.toString(); });
                    req.on('end', () => {
                        try {
                            const { pin } = JSON.parse(body);
                            if (pin === this.pin) {
                                this.authenticatedClients.add(this.getClientId(req));
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true, token: this.authToken }));
                            } else {
                                res.writeHead(401, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Invalid PIN' }));
                            }
                        } catch (e) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ error: 'Invalid JSON' }));
                        }
                    });
                    return;
                }

                // Protected endpoints - require authentication
                if (pathname === '/api/state' && req.method === 'GET') {
                    if (!this.isAuthenticated(req)) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Authentication required' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(this.currentState));
                    return;
                }

                if (pathname === '/api/command' && req.method === 'POST') {
                    if (!this.isAuthenticated(req)) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Authentication required' }));
                        return;
                    }
                    let body = '';
                    req.on('data', chunk => { body += chunk.toString(); });
                    req.on('end', () => {
                        try {
                            const data = JSON.parse(body);
                            this.mainWindow.webContents.send('remote-command', data);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        } catch (e) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ error: 'Invalid JSON' }));
                        }
                    });
                    return;
                }

                // Screen capture endpoint for click relay mode
                if (pathname === '/api/screen' && req.method === 'GET') {
                    if (!this.isAuthenticated(req)) {
                        res.writeHead(401);
                        res.end('Unauthorized');
                        return;
                    }

                    try {
                        const image = await this.mainWindow.webContents.capturePage();
                        const jpegBuffer = image.toJPEG(60); // 60% quality for faster transfer
                        res.writeHead(200, {
                            'Content-Type': 'image/jpeg',
                            'Cache-Control': 'no-cache, no-store, must-revalidate'
                        });
                        res.end(jpegBuffer);
                    } catch (e) {
                        console.error('Screen capture error:', e);
                        res.writeHead(500);
                        res.end('Capture failed');
                    }
                    return;
                }

                // Click simulation endpoint for click relay mode
                if (pathname === '/api/click' && req.method === 'POST') {
                    if (!this.isAuthenticated(req)) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Authentication required' }));
                        return;
                    }

                    let body = '';
                    req.on('data', chunk => { body += chunk.toString(); });
                    req.on('end', async () => {
                        try {
                            const { x, y, clientWidth, clientHeight } = JSON.parse(body);

                            // Get actual window size and scale coordinates
                            const bounds = this.mainWindow.getContentBounds();
                            const scaleX = bounds.width / clientWidth;
                            const scaleY = bounds.height / clientHeight;
                            const actualX = Math.round(x * scaleX);
                            const actualY = Math.round(y * scaleY);

                            // Simulate click
                            this.mainWindow.webContents.sendInputEvent({
                                type: 'mouseDown',
                                x: actualX,
                                y: actualY,
                                button: 'left',
                                clickCount: 1
                            });

                            this.mainWindow.webContents.sendInputEvent({
                                type: 'mouseUp',
                                x: actualX,
                                y: actualY,
                                button: 'left',
                                clickCount: 1
                            });

                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, actualX, actualY }));
                        } catch (e) {
                            console.error('Click simulation error:', e);
                            res.writeHead(400);
                            res.end(JSON.stringify({ error: 'Invalid request' }));
                        }
                    });
                    return;
                }

                // Text input endpoint
                if (pathname === '/api/type' && req.method === 'POST') {
                    if (!this.isAuthenticated(req)) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Authentication required' }));
                        return;
                    }

                    let body = '';
                    req.on('data', chunk => { body += chunk.toString(); });
                    req.on('end', async () => {
                        try {
                            const { text } = JSON.parse(body);
                            if (text) {
                                // Insert text into focused element
                                this.mainWindow.webContents.insertText(text);
                            }
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        } catch (e) {
                            console.error('Type error:', e);
                            res.writeHead(400);
                            res.end(JSON.stringify({ error: 'Invalid request' }));
                        }
                    });
                    return;
                }

                res.writeHead(404);
                res.end('Not Found');
            });

            // Try port 3000, if taken try random
            this.server.listen(this.port, '0.0.0.0', () => {
                const ip = this.getLocalIP();
                console.log(`Remote Server running at http://${ip}:${this.port} with PIN: ${this.pin}`);
                resolve({ ip, port: this.port, url: `http://${ip}:${this.port}`, pin: this.pin });
            });

            this.server.on('error', (e: any) => {
                if (e.code === 'EADDRINUSE') {
                    console.log('Port 3000 in use, trying random port...');
                    this.server?.listen(0, '0.0.0.0', () => {
                        const addr = this.server?.address() as any;
                        this.port = addr.port;
                        const ip = this.getLocalIP();
                        resolve({ ip, port: this.port, url: `http://${ip}:${this.port}`, pin: this.pin });
                    });
                } else {
                    reject(e);
                }
            });
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            // Clear all auth state
            this.authenticatedClients.clear();
            this.authToken = '';
            this.pin = '';
        }
    }

    updateState(state: any) {
        this.currentState = state;
    }

    private getLocalIP(): string {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]!) {
                if ('IPv4' !== iface.family || iface.internal) {
                    continue; // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                }
                return iface.address;
            }
        }
        return '127.0.0.1';
    }


    private getClickRelayHTML() {
        return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>VietLMS Mirror</title>
    <style>
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { 
            margin: 0; 
            padding: 0;
            background: #0F172A; 
            color: white;
            font-family: system-ui, sans-serif;
            height: 100dvh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            touch-action: none;
        }
        .header {
            padding: 8px 16px;
            background: #1E293B;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.9rem;
            z-index: 10;
        }
        .status { display: flex; align-items: center; gap: 8px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; }
        .dot.connected { background: #22c55e; }
        
        .auth-screen {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .auth-title { font-size: 1.5rem; margin-bottom: 20px; }
        .pin-row { display: flex; gap: 10px; margin-bottom: 20px; }
        .pin-input { 
            width: 50px; height: 60px; 
            text-align: center; font-size: 1.8rem; 
            border: 2px solid #334155; border-radius: 8px;
            background: #1E293B; color: white;
        }
        .pin-input:focus { border-color: #4F46E5; outline: none; }
        .auth-btn {
            padding: 16px 40px;
            font-size: 1.1rem;
            border: none; border-radius: 8px;
            background: #4F46E5; color: white;
            cursor: pointer;
        }
        .auth-btn:disabled { opacity: 0.5; }
        .error { color: #ef4444; margin-top: 10px; }

        .screen-container {
            flex: 1;
            display: none;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }
        #screen {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            cursor: pointer;
        }
        .click-indicator {
            position: absolute;
            width: 40px; height: 40px;
            border: 3px solid #facc15;
            border-radius: 50%;
            pointer-events: none;
            animation: ripple 0.5s ease-out forwards;
            transform: translate(-50%, -50%);
        }
        @keyframes ripple {
            0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }

        /* Keyboard Modal */
        .modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.8);
            display: none; align-items: center; justify-content: center;
            z-index: 100;
        }
        .modal-overlay.open { display: flex; }
        .keyboard-modal {
            background: #1E293B; padding: 20px; border-radius: 12px;
            width: 90%; max-width: 400px;
            display: flex; flex-direction: column; gap: 16px;
        }
        .modal-title { font-size: 1.2rem; font-weight: bold; text-align: center; }
        .input-wrapper { display: flex; gap: 8px; }
        .text-input {
            flex: 1; padding: 12px; font-size: 1.2rem;
            background: #0F172A; border: 1px solid #334155;
            border-radius: 8px; color: white;
        }
        .send-btn {
            padding: 12px 24px; background: #22c55e;
            border: none; border-radius: 8px; color: white; font-weight: bold;
            font-size: 1rem;
        }
        .close-btn {
            position: absolute; top: 16px; right: 16px; 
            background: none; border: none; color: #94a3b8; font-size: 1.5rem;
        }
        .header-btn {
            background: #334155; border: none; border-radius: 6px;
            color: white; padding: 6px 12px; font-size: 1.2rem;
        }
        .row-btns { display: flex; gap: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="status">
            <div id="dot" class="dot"></div>
            <span id="statusText">Chưa kết nối</span>
        </div>
        <div class="row-btns">
            <button class="header-btn" onclick="toggleKeyboard()" title="Mở bàn phím">⌨️</button>
        </div>
    </div>

    <!-- Auth Screen -->
    <div id="authScreen" class="auth-screen">
        <div class="auth-title">🔐 Nhập mã PIN</div>
        <div class="pin-row">
            <input type="tel" maxlength="1" class="pin-input" id="p1" autofocus>
            <input type="tel" maxlength="1" class="pin-input" id="p2">
            <input type="tel" maxlength="1" class="pin-input" id="p3">
            <input type="tel" maxlength="1" class="pin-input" id="p4">
        </div>
        <button class="auth-btn" onclick="authenticate()">Kết nối</button>
        <div id="error" class="error"></div>
    </div>

    <!-- Main Screen -->
    <div id="screenContainer" class="screen-container">
        <img id="screen" src="" alt="Screen">
    </div>

    <!-- Input Modal -->
    <div id="keyboardModal" class="modal-overlay">
        <div class="keyboard-modal">
            <div style="display:flex; justify-content:space-between; align-items:center">
                <span class="modal-title">Nhập nội dung</span>
                <button onclick="toggleKeyboard()" style="background:none; border:none; color:white; font-size:1.5rem">&times;</button>
            </div>
            <div class="input-wrapper">
                <input type="text" id="remoteInput" class="text-input" placeholder="Nhập đáp án..." inputmode="decimal" autocomplete="off">
                <button class="send-btn" onclick="sendText()">Gửi</button>
            </div>
            <div style="font-size: 0.9rem; color: #94a3b8; text-align: center;">
                Bàn phím số tự động mở
            </div>
        </div>
    </div>

    <script>
        let authToken = localStorage.getItem('authToken') || '';
        const dot = document.getElementById('dot');
        const statusText = document.getElementById('statusText');
        const authScreen = document.getElementById('authScreen');
        const screenContainer = document.getElementById('screenContainer');
        const screenImg = document.getElementById('screen');
        const keyboardModal = document.getElementById('keyboardModal');
        const remoteInput = document.getElementById('remoteInput');
        let refreshInterval = null;

        // PIN input auto-focus
        document.querySelectorAll('.pin-input').forEach((input, i, inputs) => {
            input.addEventListener('input', () => {
                if (input.value && i < inputs.length - 1) {
                    inputs[i + 1].focus();
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && i > 0) {
                    inputs[i - 1].focus();
                }
            });
        });

        function toggleKeyboard() {
            const isOpen = keyboardModal.classList.contains('open');
            if (isOpen) {
                keyboardModal.classList.remove('open');
                remoteInput.blur();
            } else {
                keyboardModal.classList.add('open');
                remoteInput.value = '';
                // Delay focus to ensure visibility
                setTimeout(() => remoteInput.focus(), 100);
            }
        }

        async function sendText() {
            const text = remoteInput.value;
            if (!text) return;

            // Visual feedback
            const btn = document.querySelector('.send-btn');
            const originalText = btn.textContent;
            btn.textContent = '⏳';
            
            try {
                await fetch('/api/type', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
                    body: JSON.stringify({ text })
                });
                remoteInput.value = '';
                toggleKeyboard(); // Close after send
            } catch (e) {
                console.error(e);
            } finally {
                btn.textContent = originalText;
            }
        }

        // Send on Enter key in input
        remoteInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendText();
        });

        async function authenticate() {
            const pin = ['p1','p2','p3','p4'].map(id => document.getElementById(id).value).join('');
            if (pin.length !== 4) {
                document.getElementById('error').textContent = 'Nhập đủ 4 số';
                return;
            }
            try {
                const res = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin })
                });
                const data = await res.json();
                if (data.success) {
                    authToken = data.token;
                    localStorage.setItem('authToken', authToken);
                    startMirror();
                } else {
                    document.getElementById('error').textContent = 'Mã PIN sai';
                }
            } catch (e) {
                document.getElementById('error').textContent = 'Lỗi kết nối';
            }
        }

        function startMirror() {
            authScreen.style.display = 'none';
            screenContainer.style.display = 'flex';
            dot.classList.add('connected');
            statusText.textContent = 'Đã kết nối';

            // Start refreshing screen
            refreshScreen();
            refreshInterval = setInterval(refreshScreen, 150); // 150ms = ~6 FPS
        }

        function refreshScreen() {
            const newImg = new Image();
            newImg.onload = () => {
                screenImg.src = newImg.src;
            };
            newImg.onerror = () => {
                dot.classList.remove('connected');
                statusText.textContent = 'Mất kết nối';
            };
            newImg.src = '/api/screen?t=' + Date.now() + '&token=' + authToken;
        }

        // Handle touch/click on screen
        screenImg.addEventListener('click', handleClick);
        
        // Touch handling for Swipe vs Click
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        
        screenImg.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling
            const t = e.touches[0];
            touchStartX = t.clientX;
            touchStartY = t.clientY;
            touchStartTime = Date.now();
        }, { passive: false });

        screenImg.addEventListener('touchend', (e) => {
            e.preventDefault();
            const t = e.changedTouches[0];
            const diffX = t.clientX - touchStartX;
            const diffY = t.clientY - touchStartY;
            const duration = Date.now() - touchStartTime;

            // Swipe detection (threshold 50px)
            if (Math.abs(diffX) > 50 || Math.abs(diffY) > 50) {
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    // Horizontal swipe
                    if (diffX > 0) {
                        sendAction('prev');
                    } else {
                        sendAction('next');
                    }
                } else {
                    // Vertical swipe
                    // Swipe UP (diffY < 0) -> Scroll Down (positive)
                    // Swipe DOWN (diffY > 0) -> Scroll Up (negative)
                    const scrollAmount = 300;
                    if (diffY < 0) {
                        sendScroll(scrollAmount);
                    } else {
                        sendScroll(-scrollAmount);
                    }
                }
            } else if (duration < 300 && Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
                // Tap (treat as click)
                const rect = screenImg.getBoundingClientRect();
                const x = t.clientX - rect.left;
                const y = t.clientY - rect.top;
                sendClick(x, y, rect.width, rect.height, t.clientX, t.clientY);
            }
        });

        function handleClick(e) {
            // Only handle mouse clicks (ignore simulated clicks from touch if any)
            const rect = screenImg.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            sendClick(x, y, rect.width, rect.height, e.clientX, e.clientY);
        }

        async function sendScroll(amount) {
            // Visual feedback
            const status = document.getElementById('statusText');
            status.textContent = amount > 0 ? 'Scroll ⬇️' : '⬆️ Scroll';
            status.style.color = '#facc15';
            setTimeout(() => {
                status.textContent = 'Đã kết nối';
                status.style.color = 'white';
            }, 500);

            try {
                await fetch('/api/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
                    body: JSON.stringify({ action: 'scroll', value: amount })
                });
            } catch (e) {}
        }

        async function sendAction(action) {
             // Visual feedback for swipe
             const status = document.getElementById('statusText');
             status.textContent = action === 'next' ? 'Next ➡️' : '⬅️ Prev';
             status.style.color = '#facc15';
             setTimeout(() => {
                 status.textContent = 'Đã kết nối';
                 status.style.color = 'white';
             }, 500);

             try {
                await fetch('/api/command', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + authToken
                    },
                    body: JSON.stringify({ action: action })
                });
            } catch (e) {}
        }

        async function sendClick(x, y, clientWidth, clientHeight, screenX, screenY) {
            // Show click indicator
            const indicator = document.createElement('div');
            indicator.className = 'click-indicator';
            indicator.style.left = screenX + 'px';
            indicator.style.top = screenY + 'px';
            document.body.appendChild(indicator);
            setTimeout(() => indicator.remove(), 500);

            try {
                await fetch('/api/click', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + authToken
                    },
                    body: JSON.stringify({ x, y, clientWidth, clientHeight })
                });
                // Refresh immediately after click
                setTimeout(refreshScreen, 50);
            } catch (e) {
                console.error('Click error:', e);
            }
        }

        // Check if already authenticated
        if (authToken) {
            fetch('/api/state', { headers: { 'Authorization': 'Bearer ' + authToken } })
                .then(res => {
                    if (res.ok) startMirror();
                })
                .catch(() => {});
        }
    </script>
</body>
</html>
        `;
    }
}
