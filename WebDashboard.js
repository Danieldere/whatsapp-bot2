const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
const fs = require('fs');

class WebDashboard {
    constructor(bot) {
        this.bot = bot;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIO(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.port = process.env.WEB_PORT || 3000;
        this.currentQR = null;
        this.botStatus = 'disconnected';
        this.stats = {
            messages: 0,
            commands: 0,
            uptime: Date.now()
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketEvents();
        this.setupBotEvents();
    }

    setupMiddleware() {
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    setupRoutes() {
        // Main dashboard
        this.app.get('/', (req, res) => {
            res.send(this.getDashboardHTML());
        });

        // API endpoints
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: this.botStatus,
                stats: this.getStats(),
                hasQR: !!this.currentQR
            });
        });

        this.app.get('/api/qr', (req, res) => {
            if (this.currentQR) {
                res.json({ qr: this.currentQR });
            } else {
                res.json({ error: 'No QR code available' });
            }
        });

        this.app.post('/api/restart', (req, res) => {
            this.restartBot();
            res.json({ message: 'Bot restart initiated' });
        });

        this.app.get('/api/logs', (req, res) => {
            const logs = this.getRecentLogs();
            res.json({ logs });
        });
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('🌐 Dashboard client connected');
            
            // Send current status
            socket.emit('status', {
                status: this.botStatus,
                stats: this.getStats()
            });

            // Send QR if available
            if (this.currentQR) {
                socket.emit('qr', this.currentQR);
            }

            socket.on('disconnect', () => {
                console.log('🌐 Dashboard client disconnected');
            });

            socket.on('requestRestart', () => {
                this.restartBot();
            });
        });
    }

    setupBotEvents() {
        // QR Code event
        this.bot.client.on('qr', async (qr) => {
            try {
                this.currentQR = await QRCode.toDataURL(qr, {
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                
                this.botStatus = 'waiting_qr';
                
                // Broadcast to all connected clients
                this.io.emit('qr', this.currentQR);
                this.io.emit('status', {
                    status: this.botStatus,
                    stats: this.getStats()
                });

                console.log('🌐 QR Code available at: http://localhost:' + this.port);
            } catch (error) {
                console.error('❌ Error generating QR code:', error);
            }
        });

        // Ready event
        this.bot.client.on('ready', () => {
            this.currentQR = null;
            this.botStatus = 'connected';
            
            this.io.emit('status', {
                status: this.botStatus,
                stats: this.getStats(),
                user: this.bot.client.info
            });
            
            this.io.emit('connected', {
                user: this.bot.client.info.pushname,
                number: this.bot.client.info.wid.user
            });

            console.log('🌐 Bot connected - Dashboard updated');
        });

        // Disconnected event
        this.bot.client.on('disconnected', (reason) => {
            this.botStatus = 'disconnected';
            this.currentQR = null;
            
            this.io.emit('status', {
                status: this.botStatus,
                stats: this.getStats()
            });
            
            this.io.emit('disconnected', { reason });
        });

        // Message events for stats
        this.bot.client.on('message_create', () => {
            this.stats.messages++;
            this.updateDashboardStats();
        });
    }

    getDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced WhatsApp Bot Dashboard</title>
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

        .header p {
            font-size: 1.2em;
            opacity: 0.9;
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

        .logs-section {
            grid-column: 1 / -1;
            max-height: 300px;
            overflow-y: auto;
        }

        .log-entry {
            background: #f8f9fa;
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            font-family: monospace;
            font-size: 0.9em;
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Enhanced WhatsApp Bot Dashboard</h1>
            <p>Professional WhatsApp Automation Control Panel</p>
        </div>

        <div class="dashboard">
            <div class="card qr-section">
                <h2>📱 WhatsApp Connection</h2>
                <div class="qr-container" id="qrContainer">
                    <div class="loading"></div>
                    <p>Initializing bot connection...</p>
                </div>
                <button class="btn btn-danger" onclick="restartBot()">🔄 Restart Bot</button>
            </div>

            <div class="card status-section">
                <h2>📊 Bot Status</h2>
                <div class="status-indicator status-disconnected" id="statusIndicator">
                    Disconnected
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
                        <div class="stat-label">Status</div>
                    </div>
                </div>
            </div>

            <div class="card instructions">
                <h3>📋 How to Connect WhatsApp</h3>
                <ol>
                    <li>Open <strong>WhatsApp</strong> on your phone</li>
                    <li>Go to <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                    <li>Tap <strong>"Link a Device"</strong></li>
                    <li>Scan the QR code that appears above</li>
                    <li>Your bot will be connected and ready!</li>
                </ol>
                <p><strong>Note:</strong> Keep this page open during the connection process.</p>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        let currentStatus = 'disconnected';

        // Socket event listeners
        socket.on('qr', (qrData) => {
            displayQR(qrData);
        });

        socket.on('status', (data) => {
            updateStatus(data);
        });

        socket.on('connected', (data) => {
            showConnectedMessage(data);
        });

        socket.on('disconnected', (data) => {
            showDisconnectedMessage(data);
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
                document.getElementById('messagesCount').textContent = data.stats.messages || 0;
                document.getElementById('commandsCount').textContent = data.stats.commands || 0;
                document.getElementById('uptimeDisplay').textContent = formatUptime(data.stats.uptime);
            }

            document.getElementById('statusTime').textContent = new Date().toLocaleTimeString();
        }

        function showConnectedMessage(data) {
            const container = document.getElementById('qrContainer');
            container.innerHTML = \`
                <div style="text-align: center;">
                    <div style="font-size: 4em; margin-bottom: 20px;">✅</div>
                    <h3 style="color: #4caf50; margin-bottom: 10px;">Connected Successfully!</h3>
                    <p><strong>User:</strong> \${data.user}</p>
                    <p><strong>Number:</strong> +\${data.number}</p>
                    <p style="margin-top: 15px; color: #666;">
                        Your WhatsApp bot is now active and ready to use!
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

        function formatStatus(status) {
            const statusMap = {
                'disconnected': 'Disconnected',
                'waiting_qr': 'Waiting for QR Scan',
                'connected': 'Connected'
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
            if (confirm('Are you sure you want to restart the bot? This will disconnect all active sessions.')) {
                fetch('/api/restart', { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        alert('Bot restart initiated. Please wait...');
                        location.reload();
                    })
                    .catch(error => {
                        alert('Error restarting bot: ' + error.message);
                    });
            }
        }

        // Update stats every 30 seconds
        setInterval(() => {
            fetch('/api/status')
                .then(response => response.json())
                .then(data => {
                    updateStatus(data);
                });
        }, 30000);
    </script>
</body>
</html>`;
    }

    getStats() {
        return {
            messages: this.bot.stats?.messagesReceived || this.stats.messages,
            commands: this.bot.stats?.commandsUsed || this.stats.commands,
            uptime: this.stats.uptime
        };
    }

    updateDashboardStats() {
        this.io.emit('stats', this.getStats());
    }

    restartBot() {
        console.log('🔄 Bot restart requested from dashboard');
        this.io.emit('status', { status: 'restarting' });
        
        setTimeout(() => {
            this.bot.client.destroy();
            setTimeout(() => {
                this.bot.client.initialize();
            }, 2000);
        }, 1000);
    }

    getRecentLogs() {
        // Implementation for getting recent logs
        return [
            { time: new Date().toISOString(), message: 'Bot started' },
            { time: new Date().toISOString(), message: 'Waiting for QR scan' }
        ];
    }

    start() {
        this.server.listen(this.port, () => {
            console.log('🌐 Web Dashboard started!');
            console.log(`📱 QR Code available at: http://localhost:${this.port}`);
            console.log(`🔗 Or access remotely at: http://YOUR_SERVER_IP:${this.port}`);
        });
    }

    stop() {
        this.server.close();
    }
}

module.exports = WebDashboard;