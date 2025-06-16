// =====================================================
// UPDATED WebDashboard.js - Multi-User Support
// =====================================================

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
const fs = require('fs');

class MultiUserWebDashboard {
    constructor(multiUserManager) {
        this.multiUserManager = multiUserManager;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIO(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.port = process.env.WEB_PORT || 3000;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketEvents();
        
        // Cleanup inactive instances every 30 minutes
        setInterval(() => {
            this.multiUserManager.cleanupInactiveInstances();
        }, 30 * 60 * 1000);
    }

    setupMiddleware() {
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    setupRoutes() {
        // Main multi-user dashboard
        this.app.get('/', (req, res) => {
            res.send(this.getMultiUserDashboardHTML());
        });

        // Session-specific dashboard
        this.app.get('/session/:sessionId', (req, res) => {
            res.send(this.getSessionDashboardHTML(req.params.sessionId));
        });

        // API endpoints
        this.app.post('/api/create-session', async (req, res) => {
            try {
                const sessionId = this.generateSessionId();
                await this.multiUserManager.createBotInstance(sessionId);
                
                res.json({ 
                    success: true, 
                    sessionId: sessionId,
                    dashboardUrl: `/session/${sessionId}`
                });
            } catch (error) {
                res.json({ success: false, error: error.message });
            }
        });

        this.app.get('/api/sessions', (req, res) => {
            const instances = this.multiUserManager.getActiveInstances();
            res.json({ sessions: instances });
        });

        this.app.get('/api/session/:sessionId/status', async (req, res) => {
            try {
                const instance = await this.multiUserManager.getBotInstance(req.params.sessionId);
                res.json({
                    status: instance.status,
                    stats: instance.bot ? instance.bot.stats : {},
                    hasQR: !!instance.currentQR
                });
            } catch (error) {
                res.json({ error: 'Session not found' });
            }
        });

        this.app.get('/api/session/:sessionId/qr', async (req, res) => {
            try {
                const instance = await this.multiUserManager.getBotInstance(req.params.sessionId);
                if (instance.currentQR) {
                    res.json({ qr: instance.currentQR });
                } else {
                    res.json({ error: 'No QR code available' });
                }
            } catch (error) {
                res.json({ error: 'Session not found' });
            }
        });

        this.app.post('/api/session/:sessionId/restart', async (req, res) => {
            try {
                const instance = await this.multiUserManager.getBotInstance(req.params.sessionId);
                if (instance.bot && instance.bot.client) {
                    this.restartBotInstance(instance.bot);
                    res.json({ message: 'Bot restart initiated' });
                } else {
                    res.json({ error: 'Bot not available' });
                }
            } catch (error) {
                res.json({ error: 'Failed to restart bot' });
            }
        });

        this.app.delete('/api/session/:sessionId', async (req, res) => {
            try {
                await this.multiUserManager.removeBotInstance(req.params.sessionId);
                res.json({ message: 'Session deleted successfully' });
            } catch (error) {
                res.json({ error: 'Failed to delete session' });
            }
        });
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('🌐 Dashboard client connected');
            
            socket.on('join-session', async (sessionId) => {
                socket.join(sessionId);
                console.log(`📱 Client joined session: ${sessionId}`);
                
                try {
                    const instance = await this.multiUserManager.getBotInstance(sessionId);
                    socket.emit('session-status', {
                        status: instance.status,
                        stats: instance.bot ? instance.bot.stats : {}
                    });

                    if (instance.currentQR) {
                        socket.emit('qr', instance.currentQR);
                    }
                } catch (error) {
                    socket.emit('error', { message: 'Session not found' });
                }
            });

            socket.on('request-restart', async (sessionId) => {
                try {
                    const instance = await this.multiUserManager.getBotInstance(sessionId);
                    if (instance.bot) {
                        this.restartBotInstance(instance.bot);
                    }
                } catch (error) {
                    socket.emit('error', { message: 'Failed to restart bot' });
                }
            });

            socket.on('disconnect', () => {
                console.log('🌐 Dashboard client disconnected');
            });
        });
    }

    // Emit events to specific session
    emitToSession(sessionId, event, data) {
        this.io.to(sessionId).emit(event, data);
    }

    // Update QR for specific session
    updateSessionQR(sessionId, qrData) {
        this.emitToSession(sessionId, 'qr', qrData);
    }

    // Update status for specific session
    updateSessionStatus(sessionId, statusData) {
        this.emitToSession(sessionId, 'session-status', statusData);
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    restartBotInstance(bot) {
        console.log('🔄 Bot restart requested from dashboard');
        
        setTimeout(() => {
            if (bot.client) {
                bot.client.destroy();
                setTimeout(() => {
                    bot.client.initialize();
                }, 2000);
            }
        }, 1000);
    }

    getMultiUserDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-User WhatsApp Bot Dashboard</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .card {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 20px;
            transition: transform 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
        }

        .create-session {
            text-align: center;
            margin-bottom: 30px;
        }

        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1.1em;
            transition: background 0.3s ease;
            margin: 10px;
            text-decoration: none;
            display: inline-block;
        }

        .btn:hover {
            background: #5a67d8;
        }

        .btn-success {
            background: #4caf50;
        }

        .btn-success:hover {
            background: #45a049;
        }

        .btn-danger {
            background: #ff6b6b;
        }

        .btn-danger:hover {
            background: #ff5252;
        }

        .btn-small {
            padding: 8px 16px;
            font-size: 0.9em;
        }

        .sessions-list {
            display: grid;
            gap: 20px;
        }

        .session-item {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.3s ease;
        }

        .session-item:hover {
            background: #e9ecef;
        }

        .session-info h3 {
            margin-bottom: 10px;
            color: #333;
            font-size: 1.2em;
        }

        .session-status {
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.8em;
            margin-bottom: 5px;
            display: inline-block;
        }

        .status-connected { background: #4caf50; color: white; }
        .status-disconnected { background: #ff6b6b; color: white; }
        .status-waiting_qr { background: #ffa726; color: white; }
        .status-initializing { background: #9e9e9e; color: white; }

        .session-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .stat-card {
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            transition: transform 0.3s ease;
        }

        .stat-card:hover {
            transform: scale(1.05);
        }

        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }

        .stat-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .instructions {
            background: #e8f5e8;
            border-left: 4px solid #4caf50;
            padding: 20px;
            border-radius: 0 10px 10px 0;
            margin-top: 20px;
        }

        .instructions h3 {
            color: #2e7d32;
            margin-bottom: 15px;
        }

        .instructions ol {
            margin-left: 20px;
            color: #424242;
        }

        .instructions li {
            margin: 8px 0;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .empty-state h3 {
            margin-bottom: 15px;
            color: #333;
        }

        @media (max-width: 768px) {
            .session-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 15px;
            }

            .session-actions {
                width: 100%;
                justify-content: center;
            }

            .stats {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Multi-User WhatsApp Bot System</h1>
            <p>Connect and manage multiple WhatsApp accounts simultaneously</p>
        </div>

        <div class="card create-session">
            <h2>🆕 Create New WhatsApp Session</h2>
            <p>Start a new WhatsApp bot instance for your account. Each session is completely isolated.</p>
            <button class="btn" onclick="createNewSession()">
                📱 Create New WhatsApp Session
            </button>
        </div>

        <div class="card">
            <h2>📊 Active Sessions</h2>
            <div id="sessionsList" class="sessions-list">
                <div class="loading">
                    <p>🔄 Loading sessions...</p>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>📈 System Statistics</h2>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number" id="totalSessions">0</div>
                    <div class="stat-label">Total Sessions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="activeSessions">0</div>
                    <div class="stat-label">Active Sessions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="connectedSessions">0</div>
                    <div class="stat-label">Connected Sessions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="uptimeDisplay">--</div>
                    <div class="stat-label">System Uptime</div>
                </div>
            </div>
        </div>

        <div class="card instructions">
            <h3>📋 How to Use Multi-User System</h3>
            <ol>
                <li><strong>Create Session:</strong> Click "Create New WhatsApp Session" to start a new bot instance</li>
                <li><strong>Access Dashboard:</strong> Each session gets its own dashboard URL that you can bookmark</li>
                <li><strong>Scan QR Code:</strong> Use WhatsApp on your phone to scan the QR code in your session dashboard</li>
                <li><strong>Multiple Users:</strong> Each person can create their own session and connect their WhatsApp</li>
                <li><strong>Manage Sessions:</strong> View, monitor, and delete sessions from this main dashboard</li>
                <li><strong>Session Isolation:</strong> Each session is completely separate with its own data and commands</li>
            </ol>
            <p><strong>💡 Tip:</strong> Sessions automatically clean up after 2 hours of inactivity to save resources.</p>
        </div>
    </div>

    <script>
        const socket = io();
        const systemStartTime = Date.now();

        async function createNewSession() {
            try {
                const button = event.target;
                button.disabled = true;
                button.textContent = '🔄 Creating Session...';

                const response = await fetch('/api/create-session', {
                    method: 'POST'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Open in new tab
                    window.open(data.dashboardUrl, '_blank');
                    // Refresh the list
                    setTimeout(loadSessions, 1000);
                } else {
                    alert('Failed to create session: ' + data.error);
                }
            } catch (error) {
                alert('Error creating session: ' + error.message);
            } finally {
                const button = event.target;
                button.disabled = false;
                button.textContent = '📱 Create New WhatsApp Session';
            }
        }

        async function loadSessions() {
            try {
                const response = await fetch('/api/sessions');
                const data = await response.json();
                
                displaySessions(data.sessions);
                updateStats(data.sessions);
            } catch (error) {
                console.error('Error loading sessions:', error);
                document.getElementById('sessionsList').innerHTML = 
                    '<div class="empty-state"><h3>❌ Error Loading Sessions</h3><p>Please refresh the page to try again.</p></div>';
            }
        }

        function displaySessions(sessions) {
            const container = document.getElementById('sessionsList');
            
            if (sessions.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <h3>🌟 No Active Sessions</h3>
                        <p>Create your first WhatsApp session to get started!</p>
                        <p>Each session allows one WhatsApp account to connect and use the bot.</p>
                    </div>
                \`;
                return;
            }

            container.innerHTML = sessions.map(session => \`
                <div class="session-item">
                    <div class="session-info">
                        <h3>📱 \${session.sessionId}</h3>
                        <div class="session-status status-\${session.status}">\${formatStatus(session.status)}</div>
                        <small>📅 Created: \${new Date(session.createdAt).toLocaleString()}</small><br>
                        <small>⏱️ Last Activity: \${new Date(session.lastActivity).toLocaleString()}</small><br>
                        <small>🕐 Uptime: \${formatUptime(session.uptime)}</small>
                    </div>
                    <div class="session-actions">
                        <button class="btn btn-small btn-success" onclick="openSession('\${session.sessionId}')">
                            🖥️ Open Dashboard
                        </button>
                        <button class="btn btn-small" onclick="restartSession('\${session.sessionId}')">
                            🔄 Restart
                        </button>
                        <button class="btn btn-small btn-danger" onclick="deleteSession('\${session.sessionId}')">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            \`).join('');
        }

        function updateStats(sessions) {
            document.getElementById('totalSessions').textContent = sessions.length;
            document.getElementById('activeSessions').textContent = 
                sessions.filter(s => s.status !== 'disconnected').length;
            document.getElementById('connectedSessions').textContent = 
                sessions.filter(s => s.status === 'connected').length;
            
            // Update system uptime
            const systemUptime = Date.now() - systemStartTime;
            document.getElementById('uptimeDisplay').textContent = formatUptime(systemUptime);
        }

        function formatStatus(status) {
            const statusMap = {
                'connected': 'Connected',
                'disconnected': 'Disconnected',
                'waiting_qr': 'Waiting for QR',
                'initializing': 'Initializing'
            };
            return statusMap[status] || status;
        }

        function formatUptime(milliseconds) {
            const seconds = Math.floor(milliseconds / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 0) return \`\${days}d \${hours % 24}h\`;
            if (hours > 0) return \`\${hours}h \${minutes % 60}m\`;
            if (minutes > 0) return \`\${minutes}m\`;
            return \`\${seconds}s\`;
        }

        function openSession(sessionId) {
            window.open(\`/session/\${sessionId}\`, '_blank');
        }

        async function restartSession(sessionId) {
            if (confirm('Are you sure you want to restart this session? It will disconnect and reconnect.')) {
                try {
                    const response = await fetch(\`/api/session/\${sessionId}/restart\`, {
                        method: 'POST'
                    });
                    
                    const data = await response.json();
                    
                    if (data.message) {
                        alert('Session restart initiated!');
                        setTimeout(loadSessions, 2000);
                    } else {
                        alert('Failed to restart session: ' + data.error);
                    }
                } catch (error) {
                    alert('Error restarting session: ' + error.message);
                }
            }
        }

        async function deleteSession(sessionId) {
            if (confirm('Are you sure you want to delete this session? This will permanently disconnect the WhatsApp account and remove all session data.')) {
                try {
                    const response = await fetch(\`/api/session/\${sessionId}\`, {
                        method: 'DELETE'
                    });
                    
                    const data = await response.json();
                    
                    if (data.message) {
                        alert('Session deleted successfully!');
                        loadSessions(); // Refresh the list
                    } else {
                        alert('Failed to delete session: ' + data.error);
                    }
                } catch (error) {
                    alert('Error deleting session: ' + error.message);
                }
            }
        }

        // Load sessions on page load
        loadSessions();

        // Refresh sessions every 15 seconds
        setInterval(loadSessions, 15000);

        // Update system uptime every second
        setInterval(() => {
            const systemUptime = Date.now() - systemStartTime;
            document.getElementById('uptimeDisplay').textContent = formatUptime(systemUptime);
        }, 1000);
    </script>
</body>
</html>`;
    }

    getSessionDashboardHTML(sessionId) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot - Session ${sessionId}</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .session-info {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            text-align: center;
        }

        .session-info h3 {
            margin-bottom: 5px;
        }

        .dashboard {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }

        .card {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
        }

        .qr-section {
            text-align: center;
        }

        .qr-container {
            background: #f8f9fa;
            border: 3px dashed #dee2e6;
            border-radius: 10px;
            padding: 30px;
            margin: 20px 0;
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }

        .qr-code {
            max-width: 100%;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        .status-section {
            text-align: center;
        }

        .status-indicator {
            display: inline-block;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            margin: 10px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .status-disconnected {
            background: #ff6b6b;
            color: white;
        }

        .status-waiting_qr {
            background: #ffa726;
            color: white;
        }

        .status-connected {
            background: #4caf50;
            color: white;
        }

        .status-initializing {
            background: #9e9e9e;
            color: white;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .stat-item {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }

        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }

        .stat-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }

        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1em;
            transition: background 0.3s ease;
            margin: 10px;
            text-decoration: none;
            display: inline-block;
        }

        .btn:hover {
            background: #5a67d8;
        }

        .btn-danger {
            background: #ff6b6b;
        }

        .btn-danger:hover {
            background: #ff5252;
        }

        .btn-secondary {
            background: #6c757d;
        }

        .btn-secondary:hover {
            background: #5a6268;
        }

        .instructions {
            grid-column: 1 / -1;
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 20px;
            border-radius: 0 10px 10px 0;
        }

        .instructions h3 {
            color: #1976d2;
            margin-bottom: 10px;
        }

        .instructions ol {
            margin-left: 20px;
        }

        .instructions li {
            margin: 5px 0;
        }

        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
            
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        .pulse {
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .back-link {
            color: white;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            margin-bottom: 20px;
            padding: 10px 20px;
            background: rgba(255,255,255,0.1);
            border-radius: 25px;
            transition: background 0.3s ease;
        }

        .back-link:hover {
            background: rgba(255,255,255,0.2);
        }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-link">← Back to Main Dashboard</a>
        
        <div class="header">
            <h1>🤖 WhatsApp Bot Session</h1>
            <div class="session-info">
                <h3>Session ID: ${sessionId}</h3>
                <p>Your personal WhatsApp bot dashboard</p>
            </div>
        </div>

        <div class="dashboard">
            <div class="card qr-section">
                <h2>📱 WhatsApp Connection</h2>
                <div class="qr-container" id="qrContainer">
                    <div class="loading"></div>
                    <p>Initializing connection...</p>
                </div>
                <button class="btn btn-danger" onclick="restartBot()">🔄 Restart Bot</button>
                <a href="/" class="btn btn-secondary">🏠 Main Dashboard</a>
            </div>

            <div class="card status-section">
                <h2>📊 Bot Status</h2>
                <div class="status-indicator status-disconnected" id="statusIndicator">
                    Initializing
                </div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-number" id="messagesCount">0</div>
                        <div class="stat-label">Messages</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="commandsCount">0</div>
                        <div class="stat-label">Commands</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="uptimeDisplay">0m</div>
                        <div class="stat-label">Uptime</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="statusTime">--</div>
                        <div class="stat-label">Last Update</div>
                    </div>
                </div>
            </div>

            <div class="card instructions">
                <h3>📋 How to Connect Your WhatsApp</h3>
                <ol>
                    <li>Open <strong>WhatsApp</strong> on your phone</li>
                    <li>Go to <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                    <li>Tap <strong>"Link a Device"</strong></li>
                    <li>Scan the QR code that appears above</li>
                    <li>Your bot will be connected and ready!</li>
                </ol>
                <p><strong>Note:</strong> This session is unique to you. Keep this page bookmarked for easy access.</p>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        const sessionId = '${sessionId}';
        let currentStatus = 'initializing';

        // Join this specific session
        socket.emit('join-session', sessionId);

        // Socket event listeners
        socket.on('qr', (qrData) => {
            displayQR(qrData);
        });

        socket.on('session-status', (data) => {
            updateStatus(data);
        });

        socket.on('connected', (data) => {
            showConnectedMessage(data);
        });

        socket.on('disconnected', (data) => {
            showDisconnectedMessage(data);
        });

        socket.on('error', (data) => {
            showError(data.message);
        });

        function displayQR(qrData) {
            const container = document.getElementById('qrContainer');
            container.innerHTML = \`
                <img src="\${qrData}" alt="WhatsApp QR Code" class="qr-code pulse">
                <p style="margin-top: 15px; color: #666;">
                    <strong>📱 Scan this QR code with WhatsApp</strong><br>
                    Settings → Linked Devices → Link a Device
                </p>
            \`;
        }

        function updateStatus(data) {
            currentStatus = data.status;
            const indicator = document.getElementById('statusIndicator');
            
            // Update status indicator
            indicator.className = 'status-indicator status-' + data.status;
            indicator.textContent = formatStatus(data.status);
            
            // Update stats
            if (data.stats) {
                document.getElementById('messagesCount').textContent = data.stats.messagesReceived || 0;
                document.getElementById('commandsCount').textContent = data.stats.commandsUsed || 0;
                document.getElementById('uptimeDisplay').textContent = formatUptime(data.stats.startTime);
            }

            document.getElementById('statusTime').textContent = new Date().toLocaleTimeString();
        }

        function showConnectedMessage(data) {
            const container = document.getElementById('qrContainer');
            container.innerHTML = \`
                <div style="text-align: center;">
                    <div style="font-size: 4em; margin-bottom: 20px;">✅</div>
                    <h3 style="color: #4caf50; margin-bottom: 10px;">Connected Successfully!</h3>
                    <p><strong>User:</strong> \${data.user || 'Unknown'}</p>
                    <p><strong>Number:</strong> +\${data.number || 'Unknown'}</p>
                    <p style="margin-top: 15px; color: #666;">
                        Your WhatsApp bot is now active and ready to use!<br>
                        Try sending <code>!menu</code> to your WhatsApp to see available commands.
                    </p>
                </div>
            \`;
        }

        function showDisconnectedMessage(data) {
            const container = document.getElementById('qrContainer');
            container.innerHTML = \`
                <div style="text-align: center;">
                    <div style="font-size: 4em; margin-bottom: 20px;">❌</div>
                    <h3 style="color: #ff6b6b; margin-bottom: 10px;">Disconnected</h3>
                    <p>Reason: \${data.reason || 'Unknown'}</p>
                    <p style="margin-top: 15px; color: #666;">
                        Please restart the bot to reconnect.
                    </p>
                </div>
            \`;
        }

        function showError(message) {
            const container = document.getElementById('qrContainer');
            container.innerHTML = \`
                <div style="text-align: center;">
                    <div style="font-size: 4em; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: #ff6b6b; margin-bottom: 10px;">Error</h3>
                    <p>\${message}</p>
                    <p style="margin-top: 15px; color: #666;">
                        Please try refreshing the page or restart the session.
                    </p>
                </div>
            \`;
        }

        function formatStatus(status) {
            const statusMap = {
                'disconnected': 'Disconnected',
                'waiting_qr': 'Waiting for QR Scan',
                'connected': 'Connected',
                'initializing': 'Initializing'
            };
            return statusMap[status] || status;
        }

        function formatUptime(startTime) {
            if (!startTime) return '0m';
            
            const uptime = Date.now() - startTime;
            const minutes = Math.floor(uptime / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 0) return days + 'd';
            if (hours > 0) return hours + 'h';
            return minutes + 'm';
        }

        function restartBot() {
            if (confirm('Are you sure you want to restart the bot? This will disconnect your current WhatsApp session.')) {
                fetch(\`/api/session/\${sessionId}/restart\`, { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.message) {
                            alert('Bot restart initiated. Please wait for reconnection...');
                            // Update UI to show restarting state
                            document.getElementById('qrContainer').innerHTML = \`
                                <div style="text-align: center;">
                                    <div class="loading"></div>
                                    <p>Restarting bot... Please wait.</p>
                                </div>
                            \`;
                        } else {
                            alert('Error restarting bot: ' + (data.error || 'Unknown error'));
                        }
                    })
                    .catch(error => {
                        alert('Error restarting bot: ' + error.message);
                    });
            }
        }

        // Update stats periodically
        setInterval(() => {
            fetch(\`/api/session/\${sessionId}/status\`)
                .then(response => response.json())
                .then(data => {
                    if (!data.error) {
                        updateStatus(data);
                    }
                })
                .catch(error => {
                    console.error('Error fetching status:', error);
                });
        }, 30000);

        // Initial status check
        setTimeout(() => {
            fetch(\`/api/session/\${sessionId}/status\`)
                .then(response => response.json())
                .then(data => {
                    if (!data.error) {
                        updateStatus(data);
                    }
                });
        }, 1000);
    </script>
</body>
</html>`;
    }

    start() {
        this.server.listen(this.port, () => {
            console.log('🌐 Multi-User Dashboard started!');
            console.log(`📱 Main Dashboard: http://localhost:${this.port}`);
            console.log(`🔗 Create and manage multiple WhatsApp sessions`);
        });
    }

    stop() {
        this.server.close();
    }
}

module.exports = MultiUserWebDashboard;