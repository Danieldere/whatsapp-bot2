const fs = require('fs');
const path = require('path');

class BotSetup {
    constructor() {
        this.projectRoot = process.cwd();
        this.requiredDirs = [
            'modules',
            'config',
            'saved-media',
            'saved-media/images',
            'saved-media/videos', 
            'saved-media/audio',
            'saved-media/documents',
            'backups',
            'logs',
            'temp',
            'scripts',
            'test'
        ];
        
        this.configFiles = [
            {
                name: 'config/settings.json',
                content: this.getSettingsTemplate()
            },
            {
                name: 'config/commands.json', 
                content: this.getCommandsTemplate()
            },
            {
                name: 'config/templates.json',
                content: this.getTemplatesTemplate()
            },
            {
                name: '.gitignore',
                content: this.getGitignoreTemplate()
            },
            {
                name: '.env.example',
                content: this.getEnvTemplate()
            }
        ];
    }

    async setup() {
        console.log('🚀 Setting up Enhanced WhatsApp Bot v2.0...\n');
        
        try {
            await this.createDirectories();
            await this.createConfigFiles();
            await this.createModuleFiles();
            await this.displaySuccessMessage();
        } catch (error) {
            console.error('❌ Setup failed:', error);
            process.exit(1);
        }
    }

    async createDirectories() {
        console.log('📁 Creating directory structure...');
        
        for (const dir of this.requiredDirs) {
            const dirPath = path.join(this.projectRoot, dir);
            
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`  ✅ Created: ${dir}/`);
            } else {
                console.log(`  ✓ Exists: ${dir}/`);
            }
        }
        console.log('');
    }

    async createConfigFiles() {
        console.log('⚙️ Creating configuration files...');
        
        for (const file of this.configFiles) {
            const filePath = path.join(this.projectRoot, file.name);
            
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, file.content);
                console.log(`  ✅ Created: ${file.name}`);
            } else {
                console.log(`  ✓ Exists: ${file.name}`);
            }
        }
        console.log('');
    }

    async createModuleFiles() {
        console.log('🔧 Checking module files...');
        
        const modules = [
            'MediaHandler.js',
            'GroupManager.js', 
            'ContactManager.js',
            'MessageManager.js',
            'ModerationManager.js',
            'UtilityManager.js'
        ];

        for (const module of modules) {
            const modulePath = path.join(this.projectRoot, 'modules', module);
            
            if (fs.existsSync(modulePath)) {
                console.log(`  ✓ Found: modules/${module}`);
            } else {
                console.log(`  ❌ Missing: modules/${module}`);
                console.log(`     Please copy ${module} to the modules/ directory`);
            }
        }
        console.log('');
    }

    displaySuccessMessage() {
        console.log('🎉 Setup completed successfully!\n');
        
        console.log('📋 Next Steps:');
        console.log('  1. Copy all module files to modules/ directory');
        console.log('  2. Run: npm install');
        console.log('  3. Run: npm start');
        console.log('  4. Scan QR code with WhatsApp');
        console.log('  5. Start using your bot!\n');
        
        console.log('🔗 Quick Commands:');
        console.log('  npm start       - Start the bot');
        console.log('  npm run dev     - Start with auto-restart');
        console.log('  npm run pm2     - Start with PM2\n');
        
        console.log('📚 Documentation:');
        console.log('  Type !help      - Show command categories');
        console.log('  Type !menu      - Show main menu');
        console.log('  Type !settings  - Configure bot\n');
        
        console.log('✨ Your Enhanced WhatsApp Bot v2.0 is ready to go!');
    }

    getSettingsTemplate() {
        return JSON.stringify({
            "bot": {
                "name": "Enhanced WhatsApp Bot",
                "version": "2.0.0",
                "timezone": "UTC",
                "language": "en",
                "debugMode": false
            },
            "features": {
                "autoSaveMedia": true,
                "welcomeMessages": true,
                "autoModeration": true,
                "linkProtection": true,
                "spamDetection": true
            },
            "moderation": {
                "maxWarnings": 3,
                "muteTimeout": 60000,
                "maxMentions": 5,
                "autoDeleteLinks": true
            }
        }, null, 2);
    }

    getCommandsTemplate() {
        return JSON.stringify({
            "categories": {
                "navigation": {"title": "🏠 Navigation", "priority": 1},
                "media": {"title": "📸 Media", "priority": 2},
                "groups": {"title": "👥 Groups", "priority": 3}
            },
            "commands": {
                "menu": {"category": "navigation", "description": "Show main menu"},
                "help": {"category": "navigation", "description": "Show help"},
                "media": {"category": "media", "description": "Media panel"}
            }
        }, null, 2);
    }

    getTemplatesTemplate() {
        return JSON.stringify({
            "welcome": {
                "default": {
                    "title": "🎉 Welcome!",
                    "message": "Welcome {user}! 👋\n\nType !help for commands.",
                    "enabled": true
                }
            },
            "system": {
                "botStarted": {
                    "title": "🚀 Bot Started", 
                    "message": "Bot is online! Type !menu to start.",
                    "enabled": true
                }
            }
        }, null, 2);
    }

    getGitignoreTemplate() {
        return `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# WhatsApp Session
.wwebjs_auth/
.wwebjs_cache/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Saved media (optional - remove if you want to track media)
saved-media/

# Temporary files
temp/
*.tmp

# Backups (optional)
backups/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# PM2
.pm2/

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output/

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity`;
    }

    getEnvTemplate() {
        return `# Enhanced WhatsApp Bot Configuration

# Bot Settings
BOT_NAME="Enhanced WhatsApp Bot"
BOT_VERSION="2.0.0"
BOT_TIMEZONE="UTC"
BOT_LANGUAGE="en"

# Debug Settings
DEBUG_MODE=false
LOG_LEVEL="info"

# Features
AUTO_SAVE_MEDIA=true
WELCOME_MESSAGES=true
AUTO_MODERATION=true
LINK_PROTECTION=true
SPAM_DETECTION=true

# Moderation Settings
MAX_WARNINGS=3
MUTE_TIMEOUT=60000
MAX_MENTIONS=5
MAX_MESSAGES_PER_MINUTE=10

# File Limits
MAX_FILE_SIZE=16777216
STORAGE_LIMIT=1073741824

# Backup Settings
AUTO_BACKUP=true
BACKUP_INTERVAL=86400000
MAX_BACKUPS=7

# Security
OWNER_PHONE=""
ADMIN_PHONES=""
RATE_LIMITING=true
MAX_COMMANDS_PER_MINUTE=20

# Notifications
DAILY_REPORTS=false
ERROR_ALERTS=true
SYSTEM_UPDATES=true`;
    }
}

// Check if this script is being run directly
if (require.main === module) {
    const setup = new BotSetup();
    setup.setup();
}

module.exports = BotSetup;