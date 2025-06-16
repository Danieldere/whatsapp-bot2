// MultiUserManager.js - New file to handle multiple bot instances
const { Client, LocalAuth } = require('whatsapp-web.js');
const EnhancedWhatsAppBot = require('./index');
const path = require('path');
const fs = require('fs');

// =====================================================
// MultiUserManager.js - Manages multiple bot instances
// =====================================================

class MultiUserManager {
    constructor() {
        this.instances = new Map(); // sessionId -> instance data
        this.sessionDir = path.join(__dirname, '.sessions');
        this.webDashboard = null;
        this.ensureSessionDir();
    }

    ensureSessionDir() {
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
        }
    }

    setWebDashboard(dashboard) {
        this.webDashboard = dashboard;
    }

    // Create a new bot instance for a user
    async createBotInstance(sessionId) {
        if (this.instances.has(sessionId)) {
            return this.instances.get(sessionId);
        }

        try {
            console.log(`🆕 Creating new bot instance for session: ${sessionId}`);
            
            const sessionPath = path.join(this.sessionDir, sessionId);
            
            // Create bot instance with unique session
            const bot = new EnhancedWhatsAppBot({
                sessionId: sessionId,
                authStrategy: new LocalAuth({
                    clientId: sessionId,
                    dataPath: sessionPath
                }),
                webDashboard: this.webDashboard
            });

            // Store instance data
            const instanceData = {
                bot: bot,
                status: 'initializing',
                createdAt: Date.now(),
                lastActivity: Date.now(),
                currentQR: null
            };

            this.instances.set(sessionId, instanceData);

            // Set up event handlers to track instance state
            this.setupInstanceEventHandlers(sessionId, bot, instanceData);

            console.log(`✅ Bot instance created for session: ${sessionId}`);
            return instanceData;

        } catch (error) {
            console.error('❌ Error creating bot instance:', error);
            throw error;
        }
    }

    setupInstanceEventHandlers(sessionId, bot, instanceData) {
        // Update instance status based on bot events
        bot.client.on('qr', async (qr) => {
            const qrData = await require('qrcode').toDataURL(qr, {
                width: 300,
                margin: 2,
                color: { dark: '#000000', light: '#FFFFFF' }
            });
            
            instanceData.currentQR = qrData;
            instanceData.status = 'waiting_qr';
            instanceData.lastActivity = Date.now();
        });

        bot.client.on('ready', () => {
            instanceData.status = 'connected';
            instanceData.currentQR = null;
            instanceData.lastActivity = Date.now();
        });

        bot.client.on('disconnected', () => {
            instanceData.status = 'disconnected';
            instanceData.currentQR = null;
            instanceData.lastActivity = Date.now();
        });

        bot.client.on('auth_failure', () => {
            instanceData.status = 'auth_failed';
            instanceData.lastActivity = Date.now();
        });

        // Update activity on any message
        bot.client.on('message_create', () => {
            instanceData.lastActivity = Date.now();
        });
    }

    // Get or create bot instance
    async getBotInstance(sessionId) {
        if (!this.instances.has(sessionId)) {
            return await this.createBotInstance(sessionId);
        }
        
        const instance = this.instances.get(sessionId);
        instance.lastActivity = Date.now();
        return instance;
    }

    // Remove bot instance
    async removeBotInstance(sessionId) {
        if (this.instances.has(sessionId)) {
            const instance = this.instances.get(sessionId);
            
            try {
                if (instance.bot) {
                    await instance.bot.destroy();
                }
            } catch (error) {
                console.error('❌ Error stopping bot instance:', error);
            }

            this.instances.delete(sessionId);
            console.log(`🗑️ Removed bot instance: ${sessionId}`);

            // Clean up session directory
            try {
                const sessionPath = path.join(this.sessionDir, sessionId);
                if (fs.existsSync(sessionPath)) {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                }
            } catch (error) {
                console.error('❌ Error cleaning up session directory:', error);
            }
        }
    }

    // List all active instances
    getActiveInstances() {
        const instances = [];
        
        for (const [sessionId, instance] of this.instances.entries()) {
            instances.push({
                sessionId: sessionId,
                status: instance.status,
                createdAt: instance.createdAt,
                lastActivity: instance.lastActivity,
                uptime: Date.now() - instance.createdAt,
                hasQR: !!instance.currentQR
            });
        }
        
        return instances;
    }

    // Clean up inactive instances (older than 2 hours)
    async cleanupInactiveInstances() {
        const now = Date.now();
        const maxInactiveTime = 2 * 60 * 60 * 1000; // 2 hours

        console.log('🧹 Running cleanup of inactive instances...');

        for (const [sessionId, instance] of this.instances.entries()) {
            if (now - instance.lastActivity > maxInactiveTime) {
                console.log(`🧹 Cleaning up inactive instance: ${sessionId}`);
                await this.removeBotInstance(sessionId);
            }
        }
    }

    // Get instance count
    getInstanceCount() {
        return this.instances.size;
    }

    // Get specific instance
    getInstance(sessionId) {
        return this.instances.get(sessionId);
    }

    // Update instance activity
    updateInstanceActivity(sessionId) {
        const instance = this.instances.get(sessionId);
        if (instance) {
            instance.lastActivity = Date.now();
        }
    }
}

// =====================================================
// Main Application Entry Point
// =====================================================

const MultiUserWebDashboard = require('./MultiUserWebDashboard');

// Initialize multi-user system
console.log('🚀 Starting Multi-User WhatsApp Bot System...');

const multiUserManager = new MultiUserManager();
const dashboard = new MultiUserWebDashboard(multiUserManager);

// Link dashboard to manager
multiUserManager.setWebDashboard(dashboard);

// Start the dashboard
dashboard.start();

console.log('✅ Multi-User WhatsApp Bot System Started!');
console.log(`📱 Visit http://localhost:${process.env.WEB_PORT || 3000} to create sessions`);
console.log('🔗 Each user can create their own WhatsApp session');
console.log('📊 Monitor all sessions from the main dashboard');

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down Multi-User WhatsApp Bot System...');
    
    // Stop all instances
    const instances = multiUserManager.getActiveInstances();
    console.log(`🛑 Stopping ${instances.length} active sessions...`);
    
    for (const instance of instances) {
        await multiUserManager.removeBotInstance(instance.sessionId);
    }
    
    dashboard.stop();
    console.log('✅ Shutdown complete!');
    process.exit(0);
});

// Export for use as module
module.exports = {
    EnhancedWhatsAppBot,
    MultiUserManager,
    MultiUserWebDashboard
};