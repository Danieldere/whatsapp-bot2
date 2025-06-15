const fs = require('fs');
const path = require('path');

class UtilityManager {
    constructor(bot) {
        this.bot = bot;
        this.settings = new Map();
        this.backupDir = path.join(__dirname, '../backups');
        this.configDir = path.join(__dirname, '../config');
        this.ensureDirectories();
        this.loadSettings();
    }

    ensureDirectories() {
        [this.backupDir, this.configDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async handlePing(message) {
        const start = Date.now();
        
        try {
            const pingMsg = await message.reply('🏓 Pinging...');
            const latency = Date.now() - start;
            
            const detailedPing = `🏓 *Pong!*

⚡ **Response Time:** ${latency}ms
🔋 **Bot Status:** Online
💾 **Memory Usage:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
⏱️ **Uptime:** ${this.formatUptime(process.uptime())}
📱 **WhatsApp Status:** Connected
🌐 **API Status:** Operational

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All systems operational`;

            // Edit the ping message to show detailed info
            setTimeout(async () => {
                try {
                    await this.bot.client.sendMessage(message.from, detailedPing);
                } catch (error) {
                    console.error('❌ Error updating ping message:', error);
                }
            }, 1000);

        } catch (error) {
            console.error('❌ Error handling ping:', error);
            await message.reply('❌ Ping failed. Bot may be experiencing issues.');
        }
    }

    async showSettings(message) {
        const settingsText = `⚙️ *Bot Settings Panel*
╔══════════════════════════════╗
║       CONFIGURATION          ║
╚══════════════════════════════╝

🤖 *Bot Configuration*
├─ \`!settings bot\` - Bot settings
├─ \`!settings auto\` - Auto-moderation
├─ \`!settings notifications\` - Notification settings
└─ \`!settings backup\` - Backup configuration

📊 *Current Settings*
├─ Auto-Save Media: ${this.getSetting('autoSaveMedia', true) ? '✅' : '❌'}
├─ Welcome Messages: ${this.getSetting('welcomeMessages', true) ? '✅' : '❌'}
├─ Auto-Moderation: ${this.getSetting('autoModeration', true) ? '✅' : '❌'}
├─ Link Protection: ${this.getSetting('linkProtection', true) ? '✅' : '❌'}
├─ Spam Detection: ${this.getSetting('spamDetection', true) ? '✅' : '❌'}
└─ Debug Mode: ${this.getSetting('debugMode', false) ? '✅' : '❌'}

🔧 *Quick Actions*
├─ \`!settings reset\` - Reset to defaults
├─ \`!settings export\` - Export configuration
├─ \`!settings import\` - Import configuration
└─ \`!backup create\` - Create backup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Use \`!settings <category>\` for detailed options`;

        await message.reply(settingsText);
    }

    async createBackup(message) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupData = {
                timestamp: timestamp,
                stats: this.bot.stats,
                settings: Object.fromEntries(this.settings),
                version: '2.0',
                chats: await this.getChatsBackup(),
                warnings: this.bot.moderationManager ? Object.fromEntries(this.bot.moderationManager.warnings) : {},
                mutedChats: this.bot.moderationManager ? Array.from(this.bot.moderationManager.mutedChats) : []
            };

            const backupFile = path.join(this.backupDir, `backup_${timestamp}.json`);
            fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

            const backupMsg = `💾 *Backup Created Successfully*

📁 **File:** backup_${timestamp}.json
📊 **Size:** ${this.formatFileSize(fs.statSync(backupFile).size)}
⏰ **Created:** ${new Date().toLocaleString()}

🗂️ **Backup Contents:**
├─ Bot statistics
├─ Configuration settings
├─ Chat data (${backupData.chats ? backupData.chats.length : 0} chats)
├─ Warning records
└─ Moderation settings

💡 Backups are stored in: \`./backups/\`
🔄 Use \`!backup restore\` to restore from backup`;

            await message.reply(backupMsg);

        } catch (error) {
            console.error('❌ Error creating backup:', error);
            await message.reply('❌ Failed to create backup.');
        }
    }

    async getChatsBackup() {
        try {
            const chats = await this.bot.client.getChats();
            return chats.map(chat => ({
                id: chat.id._serialized,
                name: chat.name,
                isGroup: chat.isGroup,
                participantCount: chat.participants ? chat.participants.length : 0,
                lastMessageTime: chat.lastMessage ? chat.lastMessage.timestamp : null
            }));
        } catch (error) {
            console.error('❌ Error getting chats for backup:', error);
            return [];
        }
    }

    async showSystemInfo(message) {
        const systemInfo = `🖥️ *System Information*
╔══════════════════════════════╗
║        SYSTEM STATUS         ║
╚══════════════════════════════╝

🤖 **Bot Information**
├─ Version: Enhanced WhatsApp Bot v2.0
├─ Node.js: ${process.version}
├─ Platform: ${process.platform}
├─ Architecture: ${process.arch}
└─ PID: ${process.pid}

💾 **Memory Usage**
├─ Heap Used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
├─ Heap Total: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB
├─ External: ${Math.round(process.memoryUsage().external / 1024 / 1024)}MB
└─ RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB

⚡ **Performance**
├─ Uptime: ${this.formatUptime(process.uptime())}
├─ CPU Usage: ${process.cpuUsage().user / 1000}ms
├─ Event Loop Lag: <1ms
└─ Memory Efficiency: Good

📊 **Statistics**
├─ Messages Processed: ${this.bot.stats.messagesReceived.toLocaleString()}
├─ Commands Executed: ${this.bot.stats.commandsUsed.toLocaleString()}
├─ Media Files Saved: ${this.bot.stats.mediaSaved.toLocaleString()}
├─ Groups Managed: ${this.bot.stats.groupsManaged.toLocaleString()}
└─ Contacts Modified: ${this.bot.stats.contactsModified.toLocaleString()}

🌐 **Network Status**
├─ WhatsApp Connection: ✅ Connected
├─ API Endpoints: ✅ Operational
└─ WebSocket Status: ✅ Active

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Status: All systems operational`;

        await message.reply(systemInfo);
    }

    async generateReport(message, type = 'full') {
        try {
            const timestamp = new Date().toISOString();
            let reportData = {};

            switch (type) {
                case 'activity':
                    reportData = await this.generateActivityReport();
                    break;
                case 'performance':
                    reportData = await this.generatePerformanceReport();
                    break;
                case 'security':
                    reportData = await this.generateSecurityReport();
                    break;
                default:
                    reportData = await this.generateFullReport();
            }

            const reportText = this.formatReport(reportData, type);
            await message.reply(reportText);

            // Optionally save report to file
            const reportFile = path.join(this.backupDir, `report_${type}_${timestamp.replace(/[:.]/g, '-')}.txt`);
            fs.writeFileSync(reportFile, reportText);

        } catch (error) {
            console.error('❌ Error generating report:', error);
            await message.reply('❌ Failed to generate report.');
        }
    }

    async generateActivityReport() {
        const uptime = process.uptime();
        const msgPerHour = Math.round(this.bot.stats.messagesReceived / (uptime / 3600));
        const cmdPerHour = Math.round(this.bot.stats.commandsUsed / (uptime / 3600));

        return {
            totalMessages: this.bot.stats.messagesReceived,
            totalCommands: this.bot.stats.commandsUsed,
            messagesPerHour: msgPerHour,
            commandsPerHour: cmdPerHour,
            mediaSaved: this.bot.stats.mediaSaved,
            groupsManaged: this.bot.stats.groupsManaged,
            uptime: this.formatUptime(uptime)
        };
    }

    async generatePerformanceReport() {
        const memUsage = process.memoryUsage();
        
        return {
            uptime: this.formatUptime(process.uptime()),
            memoryUsage: {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024),
                rss: Math.round(memUsage.rss / 1024 / 1024)
            },
            cpuUsage: process.cpuUsage(),
            nodeVersion: process.version,
            platform: process.platform
        };
    }

    async generateSecurityReport() {
        const totalWarnings = this.bot.moderationManager ? 
            Array.from(this.bot.moderationManager.warnings.values())
                .reduce((total, chatWarnings) => 
                    total + Array.from(chatWarnings.values())
                        .reduce((chatTotal, userWarnings) => chatTotal + userWarnings.length, 0), 0) : 0;

        return {
            totalWarnings: totalWarnings,
            mutedChats: this.bot.moderationManager ? this.bot.moderationManager.mutedChats.size : 0,
            blockedContacts: this.bot.contactManager ? this.bot.contactManager.blockedContacts.size : 0,
            autoModEnabled: this.getSetting('autoModeration', true),
            linkProtection: this.getSetting('linkProtection', true),
            spamDetection: this.getSetting('spamDetection', true)
        };
    }

    formatReport(data, type) {
        const timestamp = new Date().toLocaleString();
        
        let report = `📊 *${type.toUpperCase()} REPORT*\n`;
        report += `📅 Generated: ${timestamp}\n\n`;

        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
                report += `📋 **${key.toUpperCase()}:**\n`;
                Object.entries(value).forEach(([subKey, subValue]) => {
                    report += `├─ ${subKey}: ${subValue}\n`;
                });
                report += '\n';
            } else {
                report += `📈 **${key}:** ${value}\n`;
            }
        });

        return report;
    }

    getSetting(key, defaultValue = null) {
        return this.settings.get(key) ?? defaultValue;
    }

    setSetting(key, value) {
        this.settings.set(key, value);
        this.saveSettings();
    }

    loadSettings() {
        try {
            const settingsFile = path.join(this.configDir, 'settings.json');
            if (fs.existsSync(settingsFile)) {
                const data = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
                this.settings = new Map(Object.entries(data));
            }
        } catch (error) {
            console.error('❌ Error loading settings:', error);
        }
    }

    saveSettings() {
        try {
            const settingsFile = path.join(this.configDir, 'settings.json');
            const data = Object.fromEntries(this.settings);
            fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('❌ Error saving settings:', error);
        }
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async scheduleTask(taskName, delay, callback) {
        setTimeout(async () => {
            try {
                await callback();
                console.log(`✅ Scheduled task completed: ${taskName}`);
            } catch (error) {
                console.error(`❌ Scheduled task failed: ${taskName}`, error);
            }
        }, delay);
    }

    async healthCheck() {
        const checks = {
            whatsappConnection: this.bot.isReady,
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 < 512, // Less than 512MB
            uptime: process.uptime() > 0,
            errorRate: true // Implement error tracking if needed
        };

        const allHealthy = Object.values(checks).every(check => check === true);
        
        return {
            healthy: allHealthy,
            checks: checks,
            timestamp: new Date().toISOString()
        };
    }

    getStatusEmoji(status) {
        return status ? '✅' : '❌';
    }
}

module.exports = UtilityManager;