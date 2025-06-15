const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

class MediaHandler {
    constructor(bot) {
        this.bot = bot;
        this.mediaDir = path.join(__dirname, '../saved-media');
        this.tempDir = path.join(__dirname, '../temp');
        this.ensureDirectories();
        
        this.pendingMedia = new Map();
        this.supportedTypes = {
            image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
            video: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'],
            audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
            document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt']
        };
    }

    ensureDirectories() {
        [this.mediaDir, this.tempDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async handleCommand(command, message, args) {
        switch (command) {
            case 'media':
                await this.showMediaMenu(message);
                break;
            case 'save':
                await this.saveRecentMedia(message);
                break;
            case 'send':
                await this.sendMedia(message, args);
                break;
            case 'sticker':
                await this.createSticker(message);
                break;
            default:
                await message.reply('❌ Unknown media command. Type `!media` for menu.');
        }
    }

    async showMediaMenu(message) {
        const menuText = `📸 *Media Management Panel*
╔══════════════════════════════╗
║         MEDIA CONTROLS       ║
╚══════════════════════════════╝

💾 *Save Media*
├─ \`!save\` - Save recent media from chat
├─ \`!save all\` - Save all recent media
└─ \`!save @user\` - Save media from specific user

📤 *Send Media*
├─ \`!send image @user\` - Send saved image
├─ \`!send video @user\` - Send saved video
├─ \`!send document @user\` - Send document
└─ \`!send list\` - Show saved media

🎨 *Create Content*
├─ \`!sticker\` - Convert image to sticker
├─ \`!sticker text\` - Create text sticker
└─ \`!compress\` - Compress media

📊 *Media Stats*
├─ Total saved: ${await this.getMediaCount()}
├─ Storage used: ${await this.getStorageSize()}
└─ Supported: Images, Videos, Audio, Docs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Tip:* Reply to any media with \`!save\` to save it instantly!`;

        await message.reply(menuText);
    }

    async handleIncomingMedia(message) {
        try {
            const contact = await message.getContact();
            const mediaInfo = {
                message: message,
                contact: contact,
                timestamp: Date.now(),
                type: message.type,
                hasMedia: message.hasMedia
            };

            // Store for potential saving
            this.pendingMedia.set(message.from, mediaInfo);

            // Auto-expire after 1 hour
            setTimeout(() => {
                this.pendingMedia.delete(message.from);
            }, 60 * 60 * 1000);

            // Notify user if configured for auto-notifications
            const contactName = contact.pushname || contact.name || contact.number;
            console.log(`📸 Media received from ${contactName}: ${message.type}`);

        } catch (error) {
            console.error('❌ Error handling incoming media:', error);
        }
    }

    async saveRecentMedia(message) {
        try {
            const chat = await message.getChat();
            
            // Check if replying to a media message
            if (message.hasQuotedMsg) {
                const quotedMsg = await message.getQuotedMessage();
                if (quotedMsg.hasMedia) {
                    await this.saveMediaMessage(quotedMsg, message);
                    return;
                }
            }

            // Get recent media from this chat
            const messages = await chat.fetchMessages({ limit: 20 });
            const mediaMessages = messages.filter(msg => msg.hasMedia && !msg.fromMe);

            if (mediaMessages.length === 0) {
                await message.reply('❌ No recent media found in this chat.');
                return;
            }

            const recentMedia = mediaMessages[0]; // Most recent
            await this.saveMediaMessage(recentMedia, message);

        } catch (error) {
            console.error('❌ Error saving media:', error);
            await message.reply('❌ Failed to save media.');
        }
    }

    async saveMediaMessage(mediaMessage, replyMessage) {
        try {
            const media = await mediaMessage.downloadMedia();
            if (!media) {
                await replyMessage.reply('❌ Could not download media.');
                return;
            }

            const contact = await mediaMessage.getContact();
            const timestamp = Date.now();
            const contactName = (contact.pushname || contact.name || contact.number).replace(/[^a-zA-Z0-9]/g, '_');
            
            const ext = this.getFileExtension(media.mimetype);
            const filename = `${mediaMessage.type}_${contactName}_${timestamp}${ext}`;
            const filepath = path.join(this.mediaDir, filename);

            // Save file
            fs.writeFileSync(filepath, media.data, 'base64');
            
            this.bot.stats.mediaSaved++;
            
            const saveMsg = `✅ *Media Saved Successfully!*

📁 **File:** ${filename}
👤 **From:** ${contact.pushname || contact.number}
📱 **Type:** ${mediaMessage.type}
💾 **Size:** ${this.formatFileSize(media.data.length)}
📅 **Date:** ${new Date().toLocaleString()}

🗂️ *Location:* saved-media/${filename}`;

            await replyMessage.reply(saveMsg);

        } catch (error) {
            console.error('❌ Error saving media message:', error);
            await replyMessage.reply('❌ Failed to save media message.');
        }
    }

    async sendMedia(message, args) {
        if (args.length < 3) {
            await message.reply(`📤 *Send Media Usage:*

\`!send <type> <target>\`

**Examples:**
• \`!send image @contact\` - Send recent image
• \`!send video @user\` - Send recent video  
• \`!send document @group\` - Send document
• \`!send list\` - Show available media`);
            return;
        }

        const mediaType = args[1].toLowerCase();
        const target = args[2];

        if (target === 'list') {
            await this.showMediaList(message);
            return;
        }

        try {
            // Get saved media files
            const files = fs.readdirSync(this.mediaDir);
            const typeFiles = files.filter(file => file.startsWith(mediaType));

            if (typeFiles.length === 0) {
                await message.reply(`❌ No saved ${mediaType} files found.`);
                return;
            }

            // Use most recent file
            const latestFile = typeFiles.sort().reverse()[0];
            const filepath = path.join(this.mediaDir, latestFile);

            const media = MessageMedia.fromFilePath(filepath);
            
            // Send to mentioned contact or current chat
            let targetChat = message.from;
            if (message.mentionedIds && message.mentionedIds.length > 0) {
                targetChat = message.mentionedIds[0];
            }

            await this.bot.client.sendMessage(targetChat, media, {
                caption: `📎 Sent via Enhanced WhatsApp Bot\n🗂️ File: ${latestFile}`
            });

            await message.reply(`✅ ${mediaType} sent successfully!`);
            this.bot.stats.messagesSent++;

        } catch (error) {
            console.error('❌ Error sending media:', error);
            await message.reply('❌ Failed to send media.');
        }
    }

    async createSticker(message) {
        try {
            let mediaMessage = null;

            // Check if replying to media
            if (message.hasQuotedMsg) {
                const quotedMsg = await message.getQuotedMessage();
                if (quotedMsg.hasMedia && quotedMsg.type === 'image') {
                    mediaMessage = quotedMsg;
                }
            }

            if (!mediaMessage) {
                await message.reply(`🎨 *Create Sticker*

Reply to an image with \`!sticker\` to convert it.

**Requirements:**
• Image format (JPG, PNG, WEBP)
• Max size: 1MB
• Recommended: Square aspect ratio`);
                return;
            }

            const media = await mediaMessage.downloadMedia();
            if (!media) {
                await message.reply('❌ Could not download image.');
                return;
            }

            // Create sticker
            const sticker = new MessageMedia(media.mimetype, media.data, 'sticker');
            
            await this.bot.client.sendMessage(message.from, sticker);
            await message.reply('✅ Sticker created and sent!');

        } catch (error) {
            console.error('❌ Error creating sticker:', error);
            await message.reply('❌ Failed to create sticker.');
        }
    }

    async showMediaList(message) {
        try {
            const files = fs.readdirSync(this.mediaDir);
            
            if (files.length === 0) {
                await message.reply('📁 No saved media files found.');
                return;
            }

            // Group files by type
            const mediaByType = {
                image: [],
                video: [],
                audio: [],
                document: []
            };

            files.forEach(file => {
                const type = file.split('_')[0];
                if (mediaByType[type]) {
                    mediaByType[type].push(file);
                }
            });

            let listText = `📁 *Saved Media Library*
╔══════════════════════════════╗
║         MEDIA FILES          ║
╚══════════════════════════════╝\n\n`;

            Object.entries(mediaByType).forEach(([type, typeFiles]) => {
                if (typeFiles.length > 0) {
                    listText += `${this.getTypeEmoji(type)} **${type.toUpperCase()}** (${typeFiles.length})\n`;
                    typeFiles.slice(0, 3).forEach(file => {
                        const size = this.getFileSize(path.join(this.mediaDir, file));
                        listText += `├─ ${file.substring(0, 30)}... (${size})\n`;
                    });
                    if (typeFiles.length > 3) {
                        listText += `└─ ... and ${typeFiles.length - 3} more\n`;
                    }
                    listText += '\n';
                }
            });

            listText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **Total Files:** ${files.length}
💾 **Storage Used:** ${await this.getStorageSize()}

💡 Use \`!send <type> @user\` to send media`;

            await message.reply(listText);

        } catch (error) {
            console.error('❌ Error showing media list:', error);
            await message.reply('❌ Failed to load media list.');
        }
    }

    getTypeEmoji(type) {
        const emojis = {
            image: '🖼️',
            video: '🎥',
            audio: '🎵',
            document: '📄'
        };
        return emojis[type] || '📎';
    }

    getFileExtension(mimetype) {
        const extensions = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'video/mp4': '.mp4',
            'video/avi': '.avi',
            'audio/mpeg': '.mp3',
            'audio/wav': '.wav',
            'application/pdf': '.pdf',
            'text/plain': '.txt'
        };
        return extensions[mimetype] || '.bin';
    }

    getFileSize(filepath) {
        try {
            const stats = fs.statSync(filepath);
            return this.formatFileSize(stats.size);
        } catch (error) {
            return 'Unknown';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async getMediaCount() {
        try {
            const files = fs.readdirSync(this.mediaDir);
            return files.length;
        } catch (error) {
            return 0;
        }
    }

    async getStorageSize() {
        try {
            const files = fs.readdirSync(this.mediaDir);
            let totalSize = 0;
            
            files.forEach(file => {
                const filepath = path.join(this.mediaDir, file);
                const stats = fs.statSync(filepath);
                totalSize += stats.size;
            });
            
            return this.formatFileSize(totalSize);
        } catch (error) {
            return 'Unknown';
        }
    }
}

module.exports = MediaHandler;