// =====================================================
// COMPLETE index.js - Multi-User Support
// =====================================================

const {
    Client,
    LocalAuth,
    MessageMedia,
    Location,
    Poll,
    Contact,
  } = require('whatsapp-web.js');
  const fs = require('fs');
  const path = require('path');
  const qrcode = require('qrcode-terminal');
  const express = require('express');
  const http = require('http');
  const socketIO = require('socket.io');
  const QRCode = require('qrcode');
  
  // Import feature modules
  const MediaHandler = require('./modules/MediaHandler');
  const GroupManager = require('./modules/GroupManager');
  const ContactManager = require('./modules/ContactManager');
  const MessageManager = require('./modules/MessageManager');
  const ModerationManager = require('./modules/ModerationManager');
  const UtilityManager = require('./modules/UtilityManager');
  
  // =====================================================
  // EnhancedWhatsAppBot Class
  // =====================================================
  
  class EnhancedWhatsAppBot {
    constructor(options = {}) {
      this.sessionId = options.sessionId || 'default';
      this.webDashboard = options.webDashboard || null;
  
      this.client = new Client({
        authStrategy:
          options.authStrategy ||
          new LocalAuth({
            clientId: this.sessionId,
            dataPath: path.join(__dirname, '.sessions', this.sessionId),
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
            '--safebrowsing-disable-auto-update',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list',
          ],
          executablePath: undefined,
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        },
        webVersionCache: {
          type: 'remote',
          remotePath:
            'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
      });
  
      // Initialize bot state
      this.botOwner = null;
      this.isReady = false;
      this.currentQR = null;
      this.status = 'initializing';
  
      this.stats = {
        messagesReceived: 0,
        messagesSent: 0,
        mediaSaved: 0,
        commandsUsed: 0,
        groupsManaged: 0,
        contactsModified: 0,
        startTime: Date.now(),
      };
  
      // Initialize feature modules
      this.mediaHandler = new MediaHandler(this);
      this.groupManager = new GroupManager(this);
      this.contactManager = new ContactManager(this);
      this.messageManager = new MessageManager(this);
      this.moderationManager = new ModerationManager(this);
      this.utilityManager = new UtilityManager(this);
  
      // Command categories for organized help
      this.commandCategories = {
        media: {
          title: '📸 Media Management',
          commands: {
            '!media': 'Media management menu',
            '!save': 'Save recent media',
            '!send': 'Send media to contact/group',
            '!sticker': 'Convert image to sticker',
          },
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
            '!link': 'Get group invite link',
          },
        },
        contacts: {
          title: '👤 Contact Management',
          commands: {
            '!contact': 'Contact management menu',
            '!block': 'Block contact',
            '!unblock': 'Unblock contact',
            '!profile': 'Get profile info',
            '!status': 'Set status message',
          },
        },
        messages: {
          title: '💬 Message Features',
          commands: {
            '!reply': 'Reply to message',
            '!mention': 'Mention users',
            '!react': 'React to messages',
            '!poll': 'Create poll',
            '!location': 'Send location',
          },
        },
        moderation: {
          title: '🛡️ Moderation',
          commands: {
            '!mod': 'Moderation menu',
            '!warn': 'Warn user',
            '!mute': 'Mute chat',
            '!unmute': 'Unmute chat',
            '!delete': 'Delete messages',
          },
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
          },
        },
      };
  
      this.initializeBot();
    }
  
    initializeBot() {
      console.log(`🤖 Initializing bot session: ${this.sessionId}`);
  
      // Error handling for client
      this.client.on('auth_failure', (msg) => {
        console.error(`❌ [${this.sessionId}] Authentication failed:`, msg);
        this.status = 'auth_failed';
        this.notifyWebDashboard('status', { status: this.status });
      });
  
      this.client.on('loading_screen', (percent, message) => {
        console.log(`⏳ [${this.sessionId}] Loading... ${percent}% - ${message}`);
      });
  
      // QR Code generation
      this.client.on('qr', async (qr) => {
        try {
          this.currentQR = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          });
  
          this.status = 'waiting_qr';
  
          console.log(
            `📱 [${this.sessionId}] QR Code generated - waiting for scan`
          );
  
          // Notify web dashboard
          this.notifyWebDashboard('qr', this.currentQR);
          this.notifyWebDashboard('status', {
            status: this.status,
            stats: this.stats,
          });
  
          // Also show in terminal for convenience
          if (process.env.SHOW_TERMINAL_QR !== 'false') {
            console.log(`\n📱 QR Code for session ${this.sessionId}:`);
            qrcode.generate(qr, { small: true });
          }
        } catch (error) {
          console.error(
            `❌ [${this.sessionId}] Error generating QR code:`,
            error
          );
        }
      });
  
      // Bot ready event
      this.client.on('ready', async () => {
        this.isReady = true;
        this.status = 'connected';
        this.botOwner = this.client.info.wid._serialized;
        this.currentQR = null;
  
        console.log(
          `✅ [${this.sessionId}] Bot is ready! User: ${this.client.info.pushname}`
        );
  
        // Notify web dashboard
        this.notifyWebDashboard('status', {
          status: this.status,
          stats: this.stats,
          user: this.client.info,
        });
  
        this.notifyWebDashboard('connected', {
          user: this.client.info.pushname,
          number: this.client.info.wid.user,
        });
  
        // Send welcome message to owner
        await this.sendWelcomeMessage();
      });
  
      // Message handlers with error handling
      this.client.on('message_create', async (message) => {
        try {
          this.stats.messagesReceived++;
          await this.handleMessage(message);
  
          // Update dashboard stats
          this.notifyWebDashboard('status', {
            status: this.status,
            stats: this.stats,
          });
        } catch (error) {
          console.error(`❌ [${this.sessionId}] Error handling message:`, error);
        }
      });
  
      // Additional event listeners
      this.client.on('message_reaction', async (reaction) => {
        console.log(
          `👍 [${this.sessionId}] Reaction received:`,
          reaction.reaction
        );
      });
  
      this.client.on('group_join', async (notification) => {
        try {
          await this.groupManager.handleGroupJoin(notification);
        } catch (error) {
          console.error(
            `❌ [${this.sessionId}] Error handling group join:`,
            error
          );
        }
      });
  
      this.client.on('group_leave', async (notification) => {
        try {
          await this.groupManager.handleGroupLeave(notification);
        } catch (error) {
          console.error(
            `❌ [${this.sessionId}] Error handling group leave:`,
            error
          );
        }
      });
  
      this.client.on('disconnected', (reason) => {
        console.log(`❌ [${this.sessionId}] Disconnected:`, reason);
        this.isReady = false;
        this.status = 'disconnected';
        this.currentQR = null;
  
        // Notify web dashboard
        this.notifyWebDashboard('status', {
          status: this.status,
          stats: this.stats,
        });
  
        this.notifyWebDashboard('disconnected', { reason });
  
        // Auto-reconnect after 30 seconds
        console.log(
          `🔄 [${this.sessionId}] Attempting to reconnect in 30 seconds...`
        );
        setTimeout(() => {
          console.log(`🔄 [${this.sessionId}] Reinitializing client...`);
          this.client.initialize();
        }, 30000);
      });
  
      // Initialize client with retry mechanism
      this.initializeWithRetry();
    }
  
    notifyWebDashboard(event, data) {
      if (this.webDashboard && this.webDashboard.emitToSession) {
        this.webDashboard.emitToSession(this.sessionId, event, data);
      }
    }
  
    async initializeWithRetry(retries = 3) {
      for (let i = 0; i < retries; i++) {
        try {
          console.log(
            `🔄 [${this.sessionId}] Initializing client (attempt ${i + 1}/${retries})...`
          );
          await this.client.initialize();
          break;
        } catch (error) {
          console.error(
            `❌ [${this.sessionId}] Initialization attempt ${i + 1} failed:`,
            error.message
          );
  
          if (i === retries - 1) {
            console.error(
              `❌ [${this.sessionId}] All initialization attempts failed`
            );
            this.status = 'failed';
            this.notifyWebDashboard('status', { status: this.status });
          } else {
            console.log(
              `⏳ [${this.sessionId}] Waiting 10 seconds before retry...`
            );
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }
        }
      }
    }
  
    async sendWelcomeMessage() {
      try {
        const welcomeMsg = `🎉 *Enhanced WhatsApp Bot v2.0* 🎉
  
  🚀 *Welcome to your personal WhatsApp automation system!*
  
  📋 *Quick Start:*
  • Type \`!menu\` for the main menu
  • Type \`!help\` for command categories
  • Type \`!settings\` to configure the bot
  
  ✨ *Available Features:*
  • 📸 Advanced media management
  • 👥 Complete group control
  • 🛡️ Professional moderation tools
  • 👤 Contact management system
  • 📊 Interactive polls & reactions
  • 📍 Location sharing
  • 🎨 Sticker creation
  
  💡 *Session ID:* ${this.sessionId}
  
  _Your bot is now fully operational and ready to serve._`;
  
        await this.client.sendMessage(this.botOwner, welcomeMsg);
      } catch (error) {
        console.error(
          `❌ [${this.sessionId}] Error sending welcome message:`,
          error
        );
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
        console.error(`❌ [${this.sessionId}] Error handling message:`, error);
      }
    }
  
    async handleCommand(message) {
      // Permission check
      if (!(await this.checkPermissions(message))) return;
  
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
        console.error(
          `❌ [${this.sessionId}] Error executing command ${command}:`,
          error
        );
        await message.reply('❌ An error occurred while executing the command.');
      }
    }
  
    async checkPermissions(message) {
      const isGroup = message.from.endsWith('@g.us');
      const isOwner = message.fromMe || message.from === this.botOwner;
  
      if (isGroup && !message.fromMe) {
        try {
          const chat = await message.getChat();
          const participant = chat.participants.find(
            (p) => p.id._serialized === message.author
          );
          const isAdmin =
            participant && (participant.isAdmin || participant.isSuperAdmin);
  
          if (!isAdmin && !isOwner) {
            await message.reply(
              '🚫 *Access Denied*\n\nOnly group admins can use bot commands.'
            );
            return false;
          }
        } catch (error) {
          console.error(
            `❌ [${this.sessionId}] Error checking permissions:`,
            error
          );
          return false;
        }
      } else if (!isGroup && !isOwner) {
        await message.reply(
          '🚫 *Access Denied*\n\nYou are not authorized to use this bot.'
        );
        return false;
      }
  
      return true;
    }
  
    async showMainMenu(message) {
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
  
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  💡 *Session:* ${this.sessionId}
  🔄 Type any command for instant access!`;
  
      await message.reply(menuText);
    }
  
    async showHelpMenu(message, category) {
      if (!category) {
        const helpText = `📚 *Command Categories*
  
  Choose a category for detailed commands:
  
  ${Object.entries(this.commandCategories)
    .map(([key, cat]) => `${cat.title}\n\`!help ${key}\` - View ${key} commands`)
    .join('\n\n')}
  
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  💡 Example: \`!help media\` for media commands
  🔄 Type \`!menu\` to return to main menu`;
  
        await message.reply(helpText);
        return;
      }
  
      const cat = this.commandCategories[category.toLowerCase()];
      if (!cat) {
        await message.reply(
          '❌ Unknown category. Type `!help` to see all categories.'
        );
        return;
      }
  
      const categoryHelp = `${cat.title}
  
  ${Object.entries(cat.commands)
    .map(([cmd, desc]) => `\`${cmd}\` - ${desc}`)
    .join('\n')}
  
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔙 Type \`!help\` for all categories
  📱 Session: ${this.sessionId}`;
  
      await message.reply(categoryHelp);
    }
  
    async showStats(message) {
      const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
  
      const statsText = `📊 *Bot Statistics*
  ╔══════════════════════════════╗
  ║          SESSION STATS       ║
  ╚══════════════════════════════╝
  
  🟢 *Status:* ${this.status}
  ⏱️ *Uptime:* ${hours}h ${minutes}m
  📱 *Owner:* ${this.client.info ? this.client.info.pushname : 'Unknown'}
  🆔 *Session:* ${this.sessionId}
  
  📈 *Activity Stats:*
  • Messages Received: ${this.stats.messagesReceived.toLocaleString()}
  • Messages Sent: ${this.stats.messagesSent.toLocaleString()}
  • Commands Used: ${this.stats.commandsUsed.toLocaleString()}
  • Media Saved: ${this.stats.mediaSaved.toLocaleString()}
  • Groups Managed: ${this.stats.groupsManaged.toLocaleString()}
  • Contacts Modified: ${this.stats.contactsModified.toLocaleString()}
  
  🔋 *System Health:* Excellent
  💾 *Memory Usage:* ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
  
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🤖 Enhanced WhatsApp Bot v2.0 - Session ${this.sessionId}`;
  
      await message.reply(statsText);
    }
  
    async showUnknownCommand(message, command) {
      const suggestions = this.getSimilarCommands(command);
  
      let responseText = `❓ *Unknown Command:* \`!${command}\`\n\n`;
  
      if (suggestions.length > 0) {
        responseText += `💡 *Did you mean?*\n`;
        responseText += suggestions.map((cmd) => `• \`!${cmd}\``).join('\n');
        responseText += '\n\n';
      }
  
      responseText += `📋 Type \`!menu\` for main menu\n`;
      responseText += `📚 Type \`!help\` for all commands\n`;
      responseText += `🆔 Session: ${this.sessionId}`;
  
      await message.reply(responseText);
    }
  
    getSimilarCommands(command) {
      const allCommands = [];
      Object.values(this.commandCategories).forEach((cat) => {
        Object.keys(cat.commands).forEach((cmd) => {
          allCommands.push(cmd.slice(1)); // Remove !
        });
      });
  
      return allCommands
        .filter((cmd) => {
          return (
            cmd.includes(command) ||
            command.includes(cmd) ||
            this.levenshteinDistance(cmd, command) <= 2
          );
        })
        .slice(0, 3);
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
  
    // Clean shutdown method
    async destroy() {
      console.log(`🛑 [${this.sessionId}] Shutting down bot instance...`);
      this.isReady = false;
      this.status = 'shutdown';
  
      try {
        if (this.client) {
          await this.client.destroy();
        }
      } catch (error) {
        console.error(`❌ [${this.sessionId}] Error during shutdown:`, error);
      }
    }
  }
  
  // =====================================================
  // MultiUserManager Class
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
        const qrData = await QRCode.toDataURL(qr, {
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
  // MultiUserWebDashboard Class
  // =====================================================
  
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
      return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Multi-User WhatsApp Bot Dashboard</title>
      <script src="/socket.io/socket.io.js"></script>
      <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh; color: #333;
          }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; color: white; margin-bottom: 30px; }
          .header h1 { font-size: 2.5em; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
          .card {
              background: white; border-radius: 15px; padding: 30px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin-bottom: 20px;
              transition: transform 0.3s ease;
          }
          .card:hover { transform: translateY(-5px); }
          .create-session { text-align: center; margin-bottom: 30px; }
          .btn {
              background: #667eea; color: white; border: none; padding: 15px 30px;
              border-radius: 25px; cursor: pointer; font-size: 1.1em;
              transition: background 0.3s ease; margin: 10px; text-decoration: none;
              display: inline-block;
          }
          .btn:hover { background: #5a67d8; }
          .btn-success { background: #4caf50; }
          .btn-success:hover { background: #45a049; }
          .btn-danger { background: #ff6b6b; }
          .btn-danger:hover { background: #ff5252; }
          .btn-small { padding: 8px 16px; font-size: 0.9em; }
          .sessions-list { display: grid; gap: 20px; }
          .session-item {
              background: #f8f9fa; padding: 20px; border-radius: 10px;
              display: flex; justify-content: space-between; align-items: center;
              transition: background 0.3s ease;
          }
          .session-item:hover { background: #e9ecef; }
          .session-info h3 { margin-bottom: 10px; color: #333; font-size: 1.2em; }
          .session-status {
              padding: 5px 15px; border-radius: 20px; font-weight: bold;
              text-transform: uppercase; font-size: 0.8em; margin-bottom: 5px;
              display: inline-block;
          }
          .status-connected { background: #4caf50; color: white; }
          .status-disconnected { background: #ff6b6b; color: white; }
          .status-waiting_qr { background: #ffa726; color: white; }
          .status-initializing { background: #9e9e9e; color: white; }
          .session-actions { display: flex; gap: 10px; flex-wrap: wrap; }
          .stats {
              display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px; margin-top: 20px;
          }
          .stat-card {
              background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
              padding: 20px; border-radius: 10px; text-align: center;
              transition: transform 0.3s ease;
          }
          .stat-card:hover { transform: scale(1.05); }
          .stat-number { font-size: 2.5em; font-weight: bold; color: #667eea; margin-bottom: 5px; }
          .stat-label { color: #666; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
          .loading { text-align: center; padding: 40px; color: #666; }
          .empty-state { text-align: center; padding: 40px; color: #666; }
          .empty-state h3 { margin-bottom: 15px; color: #333; }
          @media (max-width: 768px) {
              .session-item { flex-direction: column; align-items: flex-start; gap: 15px; }
              .session-actions { width: 100%; justify-content: center; }
              .stats { grid-template-columns: repeat(2, 1fr); }
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
              <button class="btn" onclick="createNewSession()">📱 Create New WhatsApp Session</button>
          </div>
          <div class="card">
              <h2>📊 Active Sessions</h2>
              <div id="sessionsList" class="sessions-list">
                  <div class="loading"><p>🔄 Loading sessions...</p></div>
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
              </div>
          </div>
      </div>
      <script>
          async function createNewSession() {
              try {
                  const button = event.target;
                  button.disabled = true;
                  button.textContent = '🔄 Creating Session...';
                  const response = await fetch('/api/create-session', { method: 'POST' });
                  const data = await response.json();
                  if (data.success) {
                      window.open(data.dashboardUrl, '_blank');
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
              }
          }
          function displaySessions(sessions) {
              const container = document.getElementById('sessionsList');
              if (sessions.length === 0) {
                  container.innerHTML = \`<div class="empty-state">
                      <h3>🌟 No Active Sessions</h3>
                      <p>Create your first WhatsApp session to get started!</p>
                  </div>\`;
                  return;
              }
              container.innerHTML = sessions.map(session => \`
                  <div class="session-item">
                      <div class="session-info">
                          <h3>📱 \${session.sessionId}</h3>
                          <div class="session-status status-\${session.status}">\${formatStatus(session.status)}</div>
                          <small>📅 Created: \${new Date(session.createdAt).toLocaleString()}</small>
                      </div>
                      <div class="session-actions">
                          <button class="btn btn-small btn-success" onclick="openSession('\${session.sessionId}')">
                              🖥️ Open Dashboard
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
          }
          function formatStatus(status) {
              const statusMap = {
                  'connected': 'Connected', 'disconnected': 'Disconnected',
                  'waiting_qr': 'Waiting for QR', 'initializing': 'Initializing'
              };
              return statusMap[status] || status;
          }
          function openSession(sessionId) {
              window.open(\`/session/\${sessionId}\`, '_blank');
          }
          async function deleteSession(sessionId) {
              if (confirm('Are you sure you want to delete this session?')) {
                  try {
                      const response = await fetch(\`/api/session/\${sessionId}\`, { method: 'DELETE' });
                      const data = await response.json();
                      if (data.message) {
                          loadSessions();
                      } else {
                          alert('Failed to delete session: ' + data.error);
                      }
                  } catch (error) {
                      alert('Error deleting session: ' + error.message);
                  }
              }
          }
          loadSessions();
          setInterval(loadSessions, 15000);
      </script>
  </body>
  </html>`;
    }
  
    getSessionDashboardHTML(sessionId) {
      return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WhatsApp Bot - Session ${sessionId}</title>
      <script src="/socket.io/socket.io.js"></script>
      <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh; color: #333;
          }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; color: white; margin-bottom: 30px; }
          .header h1 { font-size: 2.5em; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
          .session-info {
              background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;
              margin-bottom: 20px; text-align: center;
          }
          .session-info h3 { margin-bottom: 5px; }
          .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .card {
              background: white; border-radius: 15px; padding: 30px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2); transition: transform 0.3s ease;
          }
          .card:hover { transform: translateY(-5px); }
          .qr-section { text-align: center; }
          .qr-container {
              background: #f8f9fa; border: 3px dashed #dee2e6; border-radius: 10px;
              padding: 30px; margin: 20px 0; min-height: 300px;
              display: flex; align-items: center; justify-content: center; flex-direction: column;
          }
          .qr-code { max-width: 100%; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
          .status-section { text-align: center; }
          .status-indicator {
              display: inline-block; padding: 10px 20px; border-radius: 25px;
              font-weight: bold; margin: 10px 0; text-transform: uppercase; letter-spacing: 1px;
          }
          .status-disconnected { background: #ff6b6b; color: white; }
          .status-waiting_qr { background: #ffa726; color: white; }
          .status-connected { background: #4caf50; color: white; }
          .status-initializing { background: #9e9e9e; color: white; }
          .stats-grid {
              display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
              gap: 15px; margin-top: 20px;
          }
          .stat-item { background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; }
          .stat-number { font-size: 2em; font-weight: bold; color: #667eea; }
          .stat-label { color: #666; font-size: 0.9em; margin-top: 5px; }
          .btn {
              background: #667eea; color: white; border: none; padding: 12px 24px;
              border-radius: 25px; cursor: pointer; font-size: 1em;
              transition: background 0.3s ease; margin: 10px; text-decoration: none;
              display: inline-block;
          }
          .btn:hover { background: #5a67d8; }
          .btn-danger { background: #ff6b6b; }
          .btn-danger:hover { background: #ff5252; }
          .btn-secondary { background: #6c757d; }
          .btn-secondary:hover { background: #5a6268; }
          .back-link {
              color: white; text-decoration: none; display: inline-flex;
              align-items: center; margin-bottom: 20px; padding: 10px 20px;
              background: rgba(255,255,255,0.1); border-radius: 25px;
              transition: background 0.3s ease;
          }
          .back-link:hover { background: rgba(255,255,255,0.2); }
          .pulse { animation: pulse 2s infinite; }
          @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }
          .loading {
              display: inline-block; width: 20px; height: 20px;
              border: 3px solid #f3f3f3; border-top: 3px solid #667eea;
              border-radius: 50%; animation: spin 1s linear infinite; margin-right: 10px;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @media (max-width: 768px) {
              .dashboard { grid-template-columns: 1fr; }
              .stats-grid { grid-template-columns: repeat(2, 1fr); }
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
                  <div class="status-indicator status-disconnected" id="statusIndicator">Initializing</div>
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
          </div>
      </div>
      <script>
          const socket = io();
          const sessionId = '${sessionId}';
          socket.emit('join-session', sessionId);
          
          socket.on('qr', (qrData) => {
              const container = document.getElementById('qrContainer');
              container.innerHTML = \`
                  <img src="\${qrData}" alt="WhatsApp QR Code" class="qr-code pulse">
                  <p style="margin-top: 15px; color: #666;">
                      <strong>📱 Scan this QR code with WhatsApp</strong><br>
                      Settings → Linked Devices → Link a Device
                  </p>
              \`;
          });
          
          socket.on('session-status', (data) => {
              const indicator = document.getElementById('statusIndicator');
              indicator.className = 'status-indicator status-' + data.status;
              indicator.textContent = formatStatus(data.status);
              
              if (data.stats) {
                  document.getElementById('messagesCount').textContent = data.stats.messagesReceived || 0;
                  document.getElementById('commandsCount').textContent = data.stats.commandsUsed || 0;
                  document.getElementById('uptimeDisplay').textContent = formatUptime(data.stats.startTime);
              }
              document.getElementById('statusTime').textContent = new Date().toLocaleTimeString();
          });
          
          socket.on('connected', (data) => {
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
          });
          
          function formatStatus(status) {
              const statusMap = {
                  'disconnected': 'Disconnected', 'waiting_qr': 'Waiting for QR Scan',
                  'connected': 'Connected', 'initializing': 'Initializing'
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
              if (confirm('Are you sure you want to restart the bot?')) {
                  fetch(\`/api/session/\${sessionId}/restart\`, { method: 'POST' })
                      .then(response => response.json())
                      .then(data => {
                          if (data.message) {
                              alert('Bot restart initiated. Please wait...');
                              document.getElementById('qrContainer').innerHTML = \`
                                  <div style="text-align: center;">
                                      <div class="loading"></div>
                                      <p>Restarting bot... Please wait.</p>
                                  </div>
                              \`;
                          } else {
                              alert('Error restarting bot: ' + (data.error || 'Unknown error'));
                          }
                      });
              }
          }
          
          setInterval(() => {
              fetch(\`/api/session/\${sessionId}/status\`)
                  .then(response => response.json())
                  .then(data => {
                      if (!data.error) {
                          socket.emit('session-status', data);
                      }
                  });
          }, 30000);
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
  
  // =====================================================
  // Main Application Entry Point
  // =====================================================
  
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