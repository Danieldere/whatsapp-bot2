const { Client, LocalAuth, MessageMedia, Location, Poll, Contact } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const WebDashboard = require('./WebDashboard'); // Import web dashboard

// Import feature modules
const MediaHandler = require('./modules/MediaHandler');
const GroupManager = require('./modules/GroupManager');
const ContactManager = require('./modules/ContactManager');
const MessageManager = require('./modules/MessageManager');
const ModerationManager = require('./modules/ModerationManager');
const UtilityManager = require('./modules/UtilityManager');

class EnhancedWhatsAppBot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-blink-features=AutomationControlled',
                    '--no-default-browser-check',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-sync',
                    '--disable-translate',
                    '--hide-scrollbars',
                    '--mute-audio',
                    '--no-first-run',
                    '--safebrowsing-disable-auto-update',
                    '--ignore-certificate-errors',
                    '--ignore-ssl-errors',
                    '--ignore-certificate-errors-spki-list'
                ],
                executablePath: undefined, // Let puppeteer find Chrome automatically
                handleSIGINT: false,
                handleSIGTERM: false,
                handleSIGHUP: false
            },
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
            }
        });

        // Initialize bot state
        this.botOwner = null;
        this.isReady = false;
        this.stats = {
            messagesReceived: 0,
            messagesSent: 0,
            mediaSaved: 0,
            commandsUsed: 0,
            groupsManaged: 0,
            contactsModified: 0,
            startTime: Date.now()
        };

        // Initialize feature modules
        this.mediaHandler = new MediaHandler(this);
        this.groupManager = new GroupManager(this);
        this.contactManager = new ContactManager(this);
        this.messageManager = new MessageManager(this);
        this.moderationManager = new ModerationManager(this);
        this.utilityManager = new UtilityManager(this);

        // Initialize web dashboard
        this.webDashboard = new WebDashboard(this);

        // Command categories for organized help
        this.commandCategories = {
            media: {
                title: '📸 Media Management',
                commands: {
                    '!media': 'Media management menu',
                    '!save': 'Save recent media',
                    '!send': 'Send media to contact/group',
                    '!sticker': 'Convert image to sticker'
                }
            },
            groups: {
                title: '👥 Group Management',
                commands: {
                    '!group': 'Group management menu',
                    '!create': 'Create new group',
                    '!add': 'Add participants',
                    '!remove': 'Remove participants',
                    '!promote': 'Promote to admin',
                    '!demote': 'Demote from admin',
                    '!info': 'Get group info',
                    '!link': 'Get group invite link'
                }
            },
            contacts: {
                title: '👤 Contact Management',
                commands: {
                    '!contact': 'Contact management menu',
                    '!block': 'Block contact',
                    '!unblock': 'Unblock contact',
                    '!profile': 'Get profile info',
                    '!status': 'Set status message'
                }
            },
            messages: {
                title: '💬 Message Features',
                commands: {
                    '!reply': 'Reply to message',
                    '!mention': 'Mention users',
                    '!react': 'React to messages',
                    '!poll': 'Create poll',
                    '!location': 'Send location'
                }
            },
            moderation: {
                title: '🛡️ Moderation',
                commands: {
                    '!mod': 'Moderation menu',
                    '!warn': 'Warn user',
                    '!mute': 'Mute chat',
                    '!unmute': 'Unmute chat',
                    '!delete': 'Delete messages'
                }
            },
            utility: {
                title: '🔧 Utilities',
                commands: {
                    '!help': 'Show this help',
                    '!menu': 'Show main menu',
                    '!stats': 'Bot statistics',
                    '!ping': 'Check bot status',
                    '!backup': 'Backup data',
                    '!settings': 'Bot settings',
                    '!dashboard': 'Get dashboard URL'
                }
            }
        };

        this.initializeBot();
    }

    initializeBot() {
        // Error handling for client
        this.client.on('auth_failure', (msg) => {
            console.error('❌ Authentication failed:', msg);
            console.log('🔄 Please delete .wwebjs_auth folder and restart');
        });

        this.client.on('loading_screen', (percent, message) => {
            console.log(`⏳ Loading... ${percent}% - ${message}`);
        });

        // QR Code generation - now shows both terminal and web options
        this.client.on('qr', (qr) => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 ENHANCED WHATSAPP BOT v2.0');
            console.log('='.repeat(60));
            console.log('📱 QR Code Options:');
            console.log('');
            console.log('1. 🌐 WEB DASHBOARD (Recommended):');
            console.log(`   http://localhost:${process.env.WEB_PORT || 3000}`);
            console.log('');
            console.log('2. 📺 Terminal QR Code:');
            qrcode.generate(qr, { small: true });
            console.log('\n' + '='.repeat(60));
            console.log('💡 TIP: Use the web dashboard for easier scanning!');
            console.log('='.repeat(60));
        });

        // Bot ready event
        this.client.on('ready', async () => {
            this.isReady = true;
            this.botOwner = this.client.info.wid._serialized;
            
            console.log('\n' + '🎉'.repeat(20));
            console.log('✅ ENHANCED WHATSAPP BOT IS READY!');
            console.log('🎉'.repeat(20));
            
            this.displayWelcomeScreen();
            
            // Send welcome message to owner
            await this.sendWelcomeMessage();
        });

        // Message handlers with error handling
        this.client.on('message_create', async (message) => {
            try {
                this.stats.messagesReceived++;
                await this.handleMessage(message);
            } catch (error) {
                console.error('❌ Error handling message:', error);
            }
        });

        // Additional event listeners
        this.client.on('message_reaction', async (reaction) => {
            console.log('👍 Reaction received:', reaction.reaction);
        });

        this.client.on('group_join', async (notification) => {
            try {
                await this.groupManager.handleGroupJoin(notification);
            } catch (error) {
                console.error('❌ Error handling group join:', error);
            }
        });

        this.client.on('group_leave', async (notification) => {
            try {
                await this.groupManager.handleGroupLeave(notification);
            } catch (error) {
                console.error('❌ Error handling group leave:', error);
            }
        });

        this.client.on('disconnected', (reason) => {
            console.log('❌ Disconnected:', reason);
            this.isReady = false;
            
            // Auto-reconnect after 30 seconds
            console.log('🔄 Attempting to reconnect in 30 seconds...');
            setTimeout(() => {
                console.log('🔄 Reinitializing client...');
                this.client.initialize();
            }, 30000);
        });

        // Start web dashboard with error handling
        try {
            this.webDashboard.start();
        } catch (error) {
            console.error('❌ Failed to start web dashboard:', error);
            console.log('⚠️ Bot will continue without web dashboard');
        }

        // Initialize client with retry mechanism
        this.initializeWithRetry();
    }

    async initializeWithRetry(retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`🔄 Initializing client (attempt ${i + 1}/${retries})...`);
                await this.client.initialize();
                break;
            } catch (error) {
                console.error(`❌ Initialization attempt ${i + 1} failed:`, error.message);
                
                if (i === retries - 1) {
                    console.error('❌ All initialization attempts failed');
                    console.log('🔧 Troubleshooting steps:');
                    console.log('1. Delete .wwebjs_auth folder');
                    console.log('2. Restart the application');
                    console.log('3. Check your internet connection');
                    console.log('4. Try updating whatsapp-web.js: npm update whatsapp-web.js');
                    process.exit(1);
                } else {
                    console.log(`⏳ Waiting 10 seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            }
        }
    }

    displayWelcomeScreen() {
        const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
        const webPort = process.env.WEB_PORT || 3000;
        
        console.log(`
╔══════════════════════════════════════════════════════╗
║                 🤖 BOT STATUS PANEL                  ║
╠══════════════════════════════════════════════════════╣
║ Status: 🟢 ONLINE                                   ║
║ Owner: ${this.client.info.pushname || 'Unknown'}                                    ║
║ Number: ${this.client.info.wid.user}                           ║
║ Uptime: ${uptime}s                                      ║
║ Web Dashboard: http://localhost:${webPort}                    ║
╠══════════════════════════════════════════════════════╣
║                   📊 FEATURES                        ║
╠══════════════════════════════════════════════════════╣
║ ✅ Multi Device Support                              ║
║ ✅ Web Dashboard with QR Code                        ║
║ ✅ Media Management (Send/Receive/Save)              ║
║ ✅ Group Management (Full Control)                   ║
║ ✅ Contact Management                                ║
║ ✅ Message Features (Reply/React/Mention)            ║
║ ✅ Moderation Tools                                  ║
║ ✅ Location & Polls                                  ║
║ ✅ Sticker Support                                   ║
╠══════════════════════════════════════════════════════╣
║ 🌐 Access Dashboard: http://localhost:${webPort}             ║
║ 📱 Type !menu for main menu                          ║
║ 📚 Type !help for command list                       ║
╚══════════════════════════════════════════════════════╝
        `);
    }

    async sendWelcomeMessage() {
        try {
            const webPort = process.env.WEB_PORT || 3000;
            const welcomeMsg = `🎉 *Enhanced WhatsApp Bot v2.0* 🎉

🚀 *Welcome to your premium WhatsApp automation system!*

🌐 *Web Dashboard Available:*
http://localhost:${webPort}

📋 *Quick Start:*
• Type \`!menu\` for the main menu
• Type \`!help\` for command categories
• Type \`!settings\` to configure the bot
• Type \`!dashboard\` for web dashboard link

✨ *New Features:*
• 🌐 Web-based QR code scanning
• 📊 Real-time dashboard
• 📸 Advanced media management
• 👥 Complete group control
• 🛡️ Professional moderation tools
• 👤 Contact management system
• 📊 Interactive polls & reactions
• 📍 Location sharing
• 🎨 Sticker creation

💡 *Need help?* Type \`!help\` anytime!

_Bot is now fully operational and ready to serve._`;

            await this.client.sendMessage(this.botOwner, welcomeMsg);
        } catch (error) {
            console.error('❌ Error sending welcome message:', error);
        }
    }

    async handleMessage(message) {
        try {
            // Skip status broadcasts
            if (message.from === 'status@broadcast') return;

            // Handle commands
            if (message.body && message.body.startsWith('!')) {
                await this.handleCommand(message);
                return;
            }

            // Handle media automatically
            if (message.hasMedia && !message.fromMe) {
                await this.mediaHandler.handleIncomingMedia(message);
            }

            // Handle mentions
            if (message.mentionedIds && message.mentionedIds.length > 0) {
                await this.messageManager.handleMentions(message);
            }

            // Auto-moderation
            if (message.from.endsWith('@g.us')) {
                await this.moderationManager.autoModerate(message);
            }

        } catch (error) {
            console.error('❌ Error handling message:', error);
        }
    }

    async handleCommand(message) {
        // Permission check
        if (!await this.checkPermissions(message)) return;

        const args = message.body.trim().slice(1).split(' ');
        const command = args[0].toLowerCase();
        
        this.stats.commandsUsed++;

        try {
            // Main navigation commands
            switch (command) {
                case 'menu':
                    await this.showMainMenu(message);
                    break;
                case 'help':
                    await this.showHelpMenu(message, args[1]);
                    break;
                case 'stats':
                    await this.showStats(message);
                    break;
                case 'ping':
                    await this.utilityManager.handlePing(message);
                    break;
                case 'settings':
                    await this.utilityManager.showSettings(message);
                    break;
                case 'dashboard':
                    await this.showDashboardInfo(message);
                    break;

                // Media commands
                case 'media':
                case 'save':
                case 'send':
                case 'sticker':
                    await this.mediaHandler.handleCommand(command, message, args);
                    break;

                // Group commands
                case 'group':
                case 'create':
                case 'add':
                case 'remove':
                case 'promote':
                case 'demote':
                case 'info':
                case 'link':
                    await this.groupManager.handleCommand(command, message, args);
                    break;

                // Contact commands
                case 'contact':
                case 'block':
                case 'unblock':
                case 'profile':
                case 'status':
                    await this.contactManager.handleCommand(command, message, args);
                    break;

                // Message commands
                case 'reply':
                case 'mention':
                case 'react':
                case 'poll':
                case 'location':
                    await this.messageManager.handleCommand(command, message, args);
                    break;

                // Moderation commands
                case 'mod':
                case 'warn':
                case 'mute':
                case 'unmute':
                case 'delete':
                    await this.moderationManager.handleCommand(command, message, args);
                    break;

                default:
                    await this.showUnknownCommand(message, command);
            }

        } catch (error) {
            console.error(`❌ Error executing command ${command}:`, error);
            await message.reply('❌ An error occurred while executing the command.');
        }
    }

    async checkPermissions(message) {
        const isGroup = message.from.endsWith('@g.us');
        const isOwner = message.fromMe || message.from === this.botOwner;

        if (isGroup && !message.fromMe) {
            try {
                const chat = await message.getChat();
                const participant = chat.participants.find(p => p.id._serialized === message.author);
                const isAdmin = participant && (participant.isAdmin || participant.isSuperAdmin);

                if (!isAdmin && !isOwner) {
                    await message.reply('🚫 *Access Denied*\n\nOnly group admins can use bot commands.');
                    return false;
                }
            } catch (error) {
                console.error('❌ Error checking permissions:', error);
                return false;
            }
        } else if (!isGroup && !isOwner) {
            await message.reply('🚫 *Access Denied*\n\nYou are not authorized to use this bot.');
            return false;
        }

        return true;
    }

    async showMainMenu(message) {
        const webPort = process.env.WEB_PORT || 3000;
        const menuText = `🤖 *Enhanced WhatsApp Bot v2.0*
╔══════════════════════════════╗
║            MAIN MENU         ║
╚══════════════════════════════╝

📸 *Media Management*
├─ \`!media\` - Media control panel
├─ \`!save\` - Save recent media
└─ \`!sticker\` - Create stickers

👥 *Group Management*
├─ \`!group\` - Group control panel
├─ \`!info\` - Group information
└─ \`!link\` - Get invite link

👤 *Contact Management*
├─ \`!contact\` - Contact panel
├─ \`!profile\` - View profiles
└─ \`!block\` - Block/unblock

💬 *Message Features*
├─ \`!poll\` - Create polls
├─ \`!react\` - React to messages
└─ \`!location\` - Send location

🛡️ *Moderation*
├─ \`!mod\` - Moderation panel
├─ \`!mute\` - Mute chats
└─ \`!warn\` - Warning system

🔧 *Utilities*
├─ \`!stats\` - Bot statistics
├─ \`!settings\` - Configuration
└─ \`!help\` - Detailed help

🌐 *Web Dashboard*
├─ \`!dashboard\` - Get dashboard link
└─ Real-time monitoring available

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Quick Tip:* Type any command for instant access!
🌐 *Dashboard:* http://localhost:${webPort}`;

        await message.reply(menuText);
    }

    async showDashboardInfo(message) {
        const webPort = process.env.WEB_PORT || 3000;
        const dashboardMsg = `🌐 *Web Dashboard Information*

📊 *Real-time Dashboard Available:*
🔗 http://localhost:${webPort}

✨ *Dashboard Features:*
• 📱 QR code scanning interface
• 📊 Live bot statistics
• 🔄 Remote bot restart
• 📈 Real-time monitoring
• 💻 Professional UI
• 📱 Mobile-friendly design

🎯 *Access Methods:*
• Local: http://localhost:${webPort}
• Network: http://YOUR_SERVER_IP:${webPort}
• Mobile: Access from any device on same network

💡 *Perfect for:*
• Remote server deployments
• Easy QR code scanning
• Monitoring bot performance
• Managing multiple users

🔧 *No terminal needed!* Access everything from your browser.`;

        await message.reply(dashboardMsg);
    }

    async showHelpMenu(message, category) {
        if (!category) {
            const helpText = `📚 *Command Categories*

Choose a category for detailed commands:

${Object.entries(this.commandCategories).map(([key, cat]) => 
    `${cat.title}\n\`!help ${key}\` - View ${key} commands`
).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Example: \`!help media\` for media commands
🔄 Type \`!menu\` to return to main menu
🌐 Type \`!dashboard\` for web interface`;

            await message.reply(helpText);
            return;
        }

        const cat = this.commandCategories[category.toLowerCase()];
        if (!cat) {
            await message.reply('❌ Unknown category. Type `!help` to see all categories.');
            return;
        }

        const categoryHelp = `${cat.title}

${Object.entries(cat.commands).map(([cmd, desc]) => 
    `\`${cmd}\` - ${desc}`
).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔙 Type \`!help\` for all categories
🌐 Dashboard available for easy access`;

        await message.reply(categoryHelp);
    }

    async showStats(message) {
        const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const webPort = process.env.WEB_PORT || 3000;

        const statsText = `📊 *Bot Statistics*
╔══════════════════════════════╗
║          SYSTEM STATS        ║
╚══════════════════════════════╝

🟢 *Status:* Online
⏱️ *Uptime:* ${hours}h ${minutes}m
📱 *Owner:* ${this.client.info.pushname || 'Unknown'}
🌐 *Dashboard:* http://localhost:${webPort}

📈 *Activity Stats:*
• Messages Received: ${this.stats.messagesReceived.toLocaleString()}
• Messages Sent: ${this.stats.messagesSent.toLocaleString()}
• Commands Used: ${this.stats.commandsUsed.toLocaleString()}
• Media Saved: ${this.stats.mediaSaved.toLocaleString()}
• Groups Managed: ${this.stats.groupsManaged.toLocaleString()}
• Contacts Modified: ${this.stats.contactsModified.toLocaleString()}

🔋 *System Health:* Excellent
💾 *Memory Usage:* ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB

📊 *Web Dashboard:*
• Real-time monitoring: ✅
• QR code interface: ✅
• Remote management: ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Enhanced WhatsApp Bot v2.0 with Web Dashboard`;

        await message.reply(statsText);
    }

    async showUnknownCommand(message, command) {
        const suggestions = this.getSimilarCommands(command);
        
        let responseText = `❓ *Unknown Command:* \`!${command}\`\n\n`;
        
        if (suggestions.length > 0) {
            responseText += `💡 *Did you mean?*\n`;
            responseText += suggestions.map(cmd => `• \`!${cmd}\``).join('\n');
            responseText += '\n\n';
        }
        
        responseText += `📋 Type \`!menu\` for main menu\n`;
        responseText += `📚 Type \`!help\` for all commands\n`;
        responseText += `🌐 Type \`!dashboard\` for web interface`;

        await message.reply(responseText);
    }

    getSimilarCommands(command) {
        const allCommands = [];
        Object.values(this.commandCategories).forEach(cat => {
            Object.keys(cat.commands).forEach(cmd => {
                allCommands.push(cmd.slice(1)); // Remove !
            });
        });

        return allCommands.filter(cmd => {
            return cmd.includes(command) || command.includes(cmd) || 
                   this.levenshteinDistance(cmd, command) <= 2;
        }).slice(0, 3);
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
}

// Initialize and start the enhanced bot
console.log('🚀 Starting Enhanced WhatsApp Bot v2.0 with Web Dashboard...');
const bot = new EnhancedWhatsAppBot();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Enhanced WhatsApp Bot...');
    bot.webDashboard.stop();
    bot.client.destroy();
    process.exit(0);
});

module.exports = EnhancedWhatsAppBot;