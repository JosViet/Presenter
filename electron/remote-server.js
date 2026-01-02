"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteServer = void 0;
const http_1 = __importDefault(require("http"));
const os_1 = __importDefault(require("os"));
class RemoteServer {
    constructor(mainWindow) {
        this.server = null;
        this.port = 3000;
        this.currentState = { type: 'unknown', options: null, hasShortAnswer: false };
        this.mainWindow = mainWindow;
    }
    start() {
        return new Promise((resolve, reject) => {
            if (this.server) {
                const ip = this.getLocalIP();
                resolve({ ip, port: this.port, url: `http://${ip}:${this.port}` });
                return;
            }
            this.server = http_1.default.createServer((req, res) => {
                // Enable CORS
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                if (req.method === 'OPTIONS') {
                    res.writeHead(200);
                    res.end();
                    return;
                }
                if (req.url === '/' && req.method === 'GET') {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(this.getMobileClientHTML());
                    return;
                }
                if (req.url === '/api/state' && req.method === 'GET') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(this.currentState));
                    return;
                }
                if (req.url === '/api/command' && req.method === 'POST') {
                    let body = '';
                    req.on('data', chunk => { body += chunk.toString(); });
                    req.on('end', () => {
                        try {
                            const data = JSON.parse(body);
                            this.mainWindow.webContents.send('remote-command', data);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        }
                        catch (e) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ error: 'Invalid JSON' }));
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
                console.log(`Remote Server running at http://${ip}:${this.port}`);
                resolve({ ip, port: this.port, url: `http://${ip}:${this.port}` });
            });
            this.server.on('error', (e) => {
                if (e.code === 'EADDRINUSE') {
                    console.log('Port 3000 in use, trying random port...');
                    this.server?.listen(0, '0.0.0.0', () => {
                        const addr = this.server?.address();
                        this.port = addr.port;
                        const ip = this.getLocalIP();
                        resolve({ ip, port: this.port, url: `http://${ip}:${this.port}` });
                    });
                }
                else {
                    reject(e);
                }
            });
        });
    }
    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
    updateState(state) {
        this.currentState = state;
    }
    getLocalIP() {
        const interfaces = os_1.default.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if ('IPv4' !== iface.family || iface.internal) {
                    continue; // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                }
                return iface.address;
            }
        }
        return '127.0.0.1';
    }
    getMobileClientHTML() {
        return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>VietLMS Remote</title>
    <style>
        :root { --primary: #4F46E5; --bg: #0F172A; --surface: #1E293B; --text: #F8FAFC; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); height: 100dvh; display: flex; flex-direction: column; overflow: hidden; user-select: none; }
        
        .header { padding: 12px; text-align: center; font-weight: bold; background: var(--surface); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); font-size: 1.1rem; flex-shrink: 0; z-index: 10; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #ef4444; }
        
        .main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; overflow-y: auto; position: relative; }
        
        /* Interactive Area (MCQ) */
        .interactive-area { width: 100%; max-width: 500px; display: flex; flex-direction: column; gap: 12px; transition: all 0.3s; }
        .mcq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .mcq-btn { padding: 24px; font-size: 1.6rem; border-radius: 16px; border: 2px solid #334155; background: var(--surface); color: white; transition: all 0.1s; font-weight: bold; }
        .mcq-btn:active { transform: scale(0.96); }
        .mcq-btn.selected { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 15px rgba(79, 70, 229, 0.4); }
        
        .input-group { display: flex; gap: 8px; flex-direction: column; }
        .input-field { padding: 16px; border-radius: 12px; border: 2px solid #334155; background: var(--surface); color: white; font-size: 1.2rem; text-align: center; outline: none; }
        .input-field:focus { border-color: var(--primary); }
        
        /* Control Panel */
        .controls { 
            background: rgba(15, 23, 42, 0.95); 
            backdrop-filter: blur(10px);
            border-top: 1px solid #334155;
            padding: 16px; 
            padding-bottom: max(16px, env(safe-area-inset-bottom));
            display: flex; flex-direction: column; gap: 12px;
            flex-shrink: 0;
        }
        
        .grid-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .btn { border: none; border-radius: 12px; padding: 0; height: 56px; font-size: 1rem; font-weight: 600; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.1s; }
        .btn:active { transform: scale(0.96); opacity: 0.9; }
        
        .btn-nav { background: var(--surface); border: 1px solid #475569; font-size: 1.5rem; }
        .btn-action { color: #fff; }
        .btn-scroll { background: #334155; color: #cbd5e1; }

        .empty-state { opacity: 0.4; text-align: center; font-size: 0.9rem; padding: 20px; border: 2px dashed #334155; border-radius: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <div id="status-dot" class="status-dot"></div>
        <div id="status">Đang kết nối...</div>
    </div>
    
    <div class="main">
        <div id="interactive-container" class="interactive-area">
            <!-- Dynamic Content -->
        </div>
    </div>

    <div class="controls">
        <!-- Navigation -->
        <div class="grid-row">
            <button class="btn btn-nav" onclick="send('prev')">⬅️ Trước</button>
            <button class="btn btn-nav" onclick="send('next')">Tiếp ➡️</button>
        </div>
        
        <!-- Actions -->
        <div class="grid-row">
            <button class="btn btn-action" style="background:#3b82f6" onclick="send('toggle-result')">👁️ Đáp án</button>
            <button class="btn btn-action" style="background:#f59e0b" onclick="send('toggle-solution')">💡 Lời giải</button>
        </div>
        
        <!-- Scroll -->
        <div class="grid-row">
             <button class="btn btn-scroll" onclick="send('scroll', -200)">⬆️ Cuộn Lên</button>
             <button class="btn btn-scroll" onclick="send('scroll', 200)">⬇️ Cuộn Xuống</button>
        </div>
    </div>

    <script>
        const container = document.getElementById('interactive-container');
        const statusEl = document.getElementById('status');
        const statusDot = document.getElementById('status-dot');
        let currentState = {};

        async function send(action, value) {
            if (navigator.vibrate) navigator.vibrate(40);
            try {
                await fetch('/api/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, value })
                });
            } catch (e) {
                updateStatus(false);
            }
        }
        
        function updateStatus(connected) {
            if (connected) {
                statusEl.innerText = "Đã kết nối";
                statusDot.style.background = "#10b981";
                statusDot.style.boxShadow = "0 0 10px #10b981";
            } else {
                statusEl.innerText = "Mất kết nối!";
                statusDot.style.background = "#ef4444";
                statusDot.style.boxShadow = "none";
            }
        }

        function renderMCQ(options) {
            if (!options || options.length === 0) return '';
            return \`<div class="mcq-grid">
                \${options.map(opt => \`<button class="mcq-btn" onclick="send('select-option', '\${opt.id}')">\${opt.id}</button>\`).join('')}
            </div>\`;
        }

        function renderShortAnswer() {
            return \`<div class="input-group">
                <input type="text" id="short-ans" class="input-field" placeholder="Nhập đáp án...">
                <button class="btn btn-action" style="background:#10B981; margin-top:8px" onclick="submitShort()">Gửi Đáp Án</button>
            </div>\`;
        }
        
        window.submitShort = () => {
            const val = document.getElementById('short-ans').value;
            if(val) send('submit-answer', val);
        }

        async function syncState() {
            try {
                const res = await fetch('/api/state');
                const state = await res.json();
                updateStatus(true);
                
                // Only re-render if type changed
                if (JSON.stringify(state) !== JSON.stringify(currentState)) {
                    currentState = state;
                    
                    if (state.type === 'tra_loi_ngan') {
                        container.innerHTML = renderShortAnswer();
                    } else if (state.options && state.options.length > 0) {
                        container.innerHTML = renderMCQ(state.options);
                    } else {
                         container.innerHTML = \`<div class="empty-state">
                            <div style="font-size:2rem; margin-bottom:8px">📱</div>
                            Điều khiển slide đang chọn
                         </div>\`;
                    }
                }
            } catch (e) {
                updateStatus(false);
            }
        }

        setInterval(syncState, 1000);
        syncState();
    </script>
</body>
</html>
        `;
    }
}
exports.RemoteServer = RemoteServer;
