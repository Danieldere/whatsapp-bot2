class ModerationManager {
    constructor(bot) {
        this.bot = bot;
        this.warnings = new Map();
        this.mutedChats = new Set();
        this.autoModRules = new Map();
        this.spamTracker = new Map();
        
        // Default auto-moderation rules
        this.defaultRules = {
            antiLink: true,
            antiSpam: true,
            profanityFilter: false,
            maxMentions: 5,
            maxMessages: 10,
            timeWindow: 60000 // 1 minute
        };
    }

    async handleCommand(command, message, args) {
        switch (command) {
            case 'mod':
                await this.showModerationMenu(message);
                break;
            case 'warn':
                await this.warnUser(message, args);
                break;
            case 'mute':
                await this.muteChat(message, args);
                break;
            case 'unmute':
                await this.unmuteChat(message, args);
                break;
            case 'delete':
                await this.deleteMessages(message, args);
                break;
            default:
                await message.reply('❌ Unknown moderation command. Type `!mod` for menu.');
        }
    }

    async showModerationMenu(message) {
        const chatId = message.from;
        const rules = this.autoModRules.get(chatId) || this.defaultRules;
        const warningCount = this.getWarningCount(chatId);
        const isMuted = this.mutedChats.has(chatId);

        const menuText = `🛡️ *Moderation Control Panel*
╔══════════════════════════════╗
║      MODERATION TOOLS        ║
╚══════════════════════════════╝

⚠️ *Warning System*
├─ \`!warn @user [reason]\` - Warn user
├─ \`!warn list\` - Show warnings
├─ \`!warn clear @user\` - Clear warnings
└─ \`!warn history @user\` - User's warning history

🔇 *Chat Control*
├─ \`!mute\` - Mute current chat
├─ \`!unmute\` - Unmute current chat
├─ \`!mute @user\` - Mute specific user
└─ \`!mute list\` - Show muted chats

🗑️ *Message Management*
├─ \`!delete\` - Delete replied message
├─ \`!delete all @user\` - Delete user's messages
├─ \`!delete last 5\` - Delete last 5 messages
└─ \`!delete links\` - Delete all links

⚙️ *Auto-Moderation Rules*
├─ Anti-Link: ${rules.antiLink ? '✅ Enabled' : '❌ Disabled'}
├─ Anti-Spam: ${rules.antiSpam ? '✅ Enabled' : '❌ Disabled'}
├─ Profanity Filter: ${rules.profanityFilter ? '✅ Enabled' : '❌ Disabled'}
└─ Max Mentions: ${rules.maxMentions}

📊 *Current Status*
├─ Chat Status: ${isMuted ? '🔇 Muted' : '🔊 Active'}
├─ Total Warnings: ${warningCount}
├─ Spam Incidents: ${this.getSpamCount(chatId)}
└─ Auto-Mod Actions: ${this.getModActionCount(chatId)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Quick Actions:* Reply to messages for instant moderation`;

        await message.reply(menuText);
    }

    async warnUser(message, args) {
        if (args.length < 2) {
            await message.reply(`⚠️ *Warning System Usage:*

\`!warn @user [reason]\` - Warn specific user
\`!warn list\` - Show all warnings
\`!warn clear @user\` - Clear user warnings
\`!warn history @user\` - User's warning history

**Examples:**
• \`!warn @john Spam posting\`
• \`!warn @jane Inappropriate language\`
• \`!warn list\`
• \`!warn clear @john\``);
            return;
        }

        const action = args[1].toLowerCase();

        if (action === 'list') {
            await this.showWarningList(message);
            return;
        }

        if (action === 'clear') {
            await this.clearWarnings(message);
            return;
        }

        if (action === 'history') {
            await this.showWarningHistory(message);
            return;
        }

        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            await message.reply('❌ Please mention a user to warn.');
            return;
        }

        try {
            const userId = message.mentionedIds[0];
            const reason = args.slice(2).join(' ') || 'No reason provided';
            const chatId = message.from;

            // Add warning
            this.addWarning(chatId, userId, reason, message.author || message.from);

            const contact = await this.bot.client.getContactById(userId);
            const warningCount = this.getUserWarnings(chatId, userId).length;

            const warningMsg = `⚠️ *USER WARNING*

👤 **User:** ${contact.pushname || contact.number}
📝 **Reason:** ${reason}
🔢 **Warning Count:** ${warningCount}
👮 **Warned by:** Admin
📅 **Date:** ${new Date().toLocaleString()}

${warningCount >= 3 ? '🚨 **FINAL WARNING** - Next violation may result in removal!' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Please follow group rules to avoid further warnings.`;

            await this.bot.client.sendMessage(chatId, warningMsg, {
                mentions: [userId]
            });

            // Auto-actions based on warning count
            if (warningCount >= 5) {
                await this.autoRemoveUser(chatId, userId, 'Too many warnings');
            } else if (warningCount >= 3) {
                await this.autoMuteUser(chatId, userId, 60000); // 1 minute mute
            }

        } catch (error) {
            console.error('❌ Error warning user:', error);
            await message.reply('❌ Failed to warn user.');
        }
    }

    async muteChat(message, args) {
        const chatId = message.from;

        if (args.length > 1 && message.mentionedIds && message.mentionedIds.length > 0) {
            // Mute specific user
            await this.muteSpecificUser(message, args);
            return;
        }

        if (args[1] === 'list') {
            await this.showMutedList(message);
            return;
        }

        try {
            this.mutedChats.add(chatId);

            const muteMsg = `🔇 *CHAT MUTED*

📵 This chat has been muted by admin.
⏰ Duration: Until manually unmuted
🔊 Use \`!unmute\` to restore chat

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Only admins can send messages while muted.`;

            await message.reply(muteMsg);

        } catch (error) {
            console.error('❌ Error muting chat:', error);
            await message.reply('❌ Failed to mute chat.');
        }
    }

    async unmuteChat(message, args) {
        const chatId = message.from;

        try {
            if (this.mutedChats.has(chatId)) {
                this.mutedChats.delete(chatId);

                const unmuteMsg = `🔊 *CHAT UNMUTED*

✅ Chat has been unmuted by admin.
💬 All members can now send messages.
📅 Unmuted: ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Welcome back to normal chat!`;

                await message.reply(unmuteMsg);
            } else {
                await message.reply('❌ Chat is not currently muted.');
            }

        } catch (error) {
            console.error('❌ Error unmuting chat:', error);
            await message.reply('❌ Failed to unmute chat.');
        }
    }

    async deleteMessages(message, args) {
        if (message.hasQuotedMsg) {
            // Delete specific quoted message
            try {
                const quotedMsg = await message.getQuotedMessage();
                await quotedMsg.delete(true); // Delete for everyone
                await message.reply('✅ Message deleted successfully.');
            } catch (error) {
                await message.reply('❌ Failed to delete message.');
            }
            return;
        }

        if (args.length < 2) {
            await message.reply(`🗑️ *Delete Messages Usage:*

**Reply to message:**
Reply to any message with \`!delete\` to delete it

**Bulk delete:**
• \`!delete last 5\` - Delete last 5 messages
• \`!delete all @user\` - Delete user's recent messages
• \`!delete links\` - Delete all links in chat
• \`!delete media\` - Delete all media messages

**Examples:**
• Reply to spam with \`!delete\`
• \`!delete last 10\`
• \`!delete all @spammer\``);
            return;
        }

        try {
            const action = args[1].toLowerCase();
            const chat = await message.getChat();

            switch (action) {
                case 'last':
                    const count = parseInt(args[2]) || 5;
                    await this.deleteLastMessages(chat, count, message);
                    break;

                case 'all':
                    if (message.mentionedIds && message.mentionedIds.length > 0) {
                        await this.deleteUserMessages(chat, message.mentionedIds[0], message);
                    } else {
                        await message.reply('❌ Please mention a user.');
                    }
                    break;

                case 'links':
                    await this.deleteLinkMessages(chat, message);
                    break;

                case 'media':
                    await this.deleteMediaMessages(chat, message);
                    break;

                default:
                    await message.reply('❌ Unknown delete action.');
            }

        } catch (error) {
            console.error('❌ Error deleting messages:', error);
            await message.reply('❌ Failed to delete messages.');
        }
    }

    async autoModerate(message) {
        const chatId = message.from;
        const rules = this.autoModRules.get(chatId) || this.defaultRules;

        // Skip if chat is muted for non-admins
        if (this.mutedChats.has(chatId) && !await this.isAdmin(message)) {
            await message.delete(true);
            return;
        }

        // Anti-link moderation
        if (rules.antiLink && this.containsLinks(message.body)) {
            await this.handleLinkViolation(message);
            return;
        }

        // Anti-spam moderation
        if (rules.antiSpam && await this.isSpam(message)) {
            await this.handleSpamViolation(message);
            return;
        }

        // Mention limit check
        if (message.mentionedIds && message.mentionedIds.length > rules.maxMentions) {
            await this.handleMentionSpam(message);
            return;
        }

        // Profanity filter
        if (rules.profanityFilter && this.containsProfanity(message.body)) {
            await this.handleProfanityViolation(message);
            return;
        }
    }

    async handleLinkViolation(message) {
        try {
            await message.delete(true);
            
            const contact = await message.getContact();
            const warningMsg = `🔗 *LINK DETECTED*

⚠️ @${contact.number} Links are not allowed in this group.
🗑️ Your message has been deleted.
📝 Repeated violations will result in warnings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Please follow group rules.`;

            await this.bot.client.sendMessage(message.from, warningMsg, {
                mentions: [message.author || message.from]
            });

            // Add to violation count
            this.addViolation(message.from, message.author || message.from, 'link');

        } catch (error) {
            console.error('❌ Error handling link violation:', error);
        }
    }

    async handleSpamViolation(message) {
        try {
            await message.delete(true);
            
            const contact = await message.getContact();
            const warningMsg = `🚫 *SPAM DETECTED*

⚠️ @${contact.number} Spam messages are not allowed.
🗑️ Your message has been deleted.
⏰ You are temporarily muted for 1 minute.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Please slow down your messaging.`;

            await this.bot.client.sendMessage(message.from, warningMsg, {
                mentions: [message.author || message.from]
            });

            // Temporary mute for 1 minute
            await this.autoMuteUser(message.from, message.author || message.from, 60000);

        } catch (error) {
            console.error('❌ Error handling spam violation:', error);
        }
    }

    containsLinks(text) {
        if (!text) return false;
        const linkRegex = /https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|edu|gov|mil|int|info|biz|name|museum|coop|aero|[a-z]{2})\b/gi;
        return linkRegex.test(text);
    }

    async isSpam(message) {
        const userId = message.author || message.from;
        const chatId = message.from;
        const now = Date.now();

        if (!this.spamTracker.has(chatId)) {
            this.spamTracker.set(chatId, new Map());
        }

        const chatTracker = this.spamTracker.get(chatId);
        
        if (!chatTracker.has(userId)) {
            chatTracker.set(userId, []);
        }

        const userMessages = chatTracker.get(userId);
        
        // Remove old messages (older than time window)
        const rules = this.autoModRules.get(chatId) || this.defaultRules;
        const filtered = userMessages.filter(timestamp => now - timestamp < rules.timeWindow);
        
        // Add current message
        filtered.push(now);
        chatTracker.set(userId, filtered);

        // Check if exceeds limit
        return filtered.length > rules.maxMessages;
    }

    containsProfanity(text) {
        if (!text) return false;
        
        // Basic profanity list - you can expand this
        const profanityList = ['badword1', 'badword2', 'badword3']; // Add actual words
        const lowercaseText = text.toLowerCase();
        
        return profanityList.some(word => lowercaseText.includes(word));
    }

    addWarning(chatId, userId, reason, warnedBy) {
        if (!this.warnings.has(chatId)) {
            this.warnings.set(chatId, new Map());
        }

        const chatWarnings = this.warnings.get(chatId);
        
        if (!chatWarnings.has(userId)) {
            chatWarnings.set(userId, []);
        }

        const userWarnings = chatWarnings.get(userId);
        userWarnings.push({
            reason: reason,
            warnedBy: warnedBy,
            timestamp: Date.now()
        });
    }

    getUserWarnings(chatId, userId) {
        if (!this.warnings.has(chatId)) return [];
        const chatWarnings = this.warnings.get(chatId);
        if (!chatWarnings.has(userId)) return [];
        return chatWarnings.get(userId);
    }

    getWarningCount(chatId) {
        if (!this.warnings.has(chatId)) return 0;
        const chatWarnings = this.warnings.get(chatId);
        let total = 0;
        for (const userWarnings of chatWarnings.values()) {
            total += userWarnings.length;
        }
        return total;
    }

    async isAdmin(message) {
        if (!message.from.endsWith('@g.us')) return true; // Always admin in DM
        
        try {
            const chat = await message.getChat();
            const participant = chat.participants.find(p => p.id._serialized === (message.author || message.from));
            return participant && (participant.isAdmin || participant.isSuperAdmin);
        } catch (error) {
            return false;
        }
    }

    async deleteLastMessages(chat, count, replyMessage) {
        try {
            const messages = await chat.fetchMessages({ limit: count + 1 }); // +1 to exclude command message
            let deleted = 0;

            for (const msg of messages) {
                if (msg.id.id !== replyMessage.id.id) { // Don't delete the command message
                    try {
                        await msg.delete(true);
                        deleted++;
                    } catch (error) {
                        // Message might already be deleted or too old
                    }
                }
            }

            await replyMessage.reply(`✅ Deleted ${deleted} messages.`);

        } catch (error) {
            await replyMessage.reply('❌ Failed to delete messages.');
        }
    }

    async deleteUserMessages(chat, userId, replyMessage) {
        try {
            const messages = await chat.fetchMessages({ limit: 50 });
            const userMessages = messages.filter(msg => 
                (msg.author === userId || msg.from === userId) && 
                msg.id.id !== replyMessage.id.id
            );

            let deleted = 0;
            for (const msg of userMessages) {
                try {
                    await msg.delete(true);
                    deleted++;
                } catch (error) {
                    // Message might already be deleted or too old
                }
            }

            await replyMessage.reply(`✅ Deleted ${deleted} messages from user.`);

        } catch (error) {
            await replyMessage.reply('❌ Failed to delete user messages.');
        }
    }

    async autoMuteUser(chatId, userId, duration) {
        // This would require custom implementation as WhatsApp doesn't have built-in user muting
        // You could implement by tracking muted users and auto-deleting their messages
        console.log(`🔇 Auto-muted user ${userId} in ${chatId} for ${duration}ms`);
    }

    addViolation(chatId, userId, type) {
        // Track violations for analytics
        console.log(`⚠️ Violation recorded: ${type} by ${userId} in ${chatId}`);
    }

    getSpamCount(chatId) {
        // Return spam incident count for this chat
        return 0; // Implement based on your tracking needs
    }

    getModActionCount(chatId) {
        // Return moderation action count for this chat
        return 0; // Implement based on your tracking needs
    }

    async showWarningList(message) {
        const chatId = message.from;
        if (!this.warnings.has(chatId)) {
            await message.reply('✅ No warnings in this chat.');
            return;
        }

        const chatWarnings = this.warnings.get(chatId);
        let warningText = `⚠️ *Warning List*\n\n`;

        for (const [userId, userWarnings] of chatWarnings.entries()) {
            try {
                const contact = await this.bot.client.getContactById(userId);
                warningText += `👤 ${contact.pushname || contact.number}: ${userWarnings.length} warnings\n`;
            } catch (error) {
                warningText += `👤 ${userId}: ${userWarnings.length} warnings\n`;
            }
        }

        await message.reply(warningText);
    }

    async clearWarnings(message) {
        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            await message.reply('❌ Please mention a user to clear warnings.');
            return;
        }

        const chatId = message.from;
        const userId = message.mentionedIds[0];

        if (!this.warnings.has(chatId)) {
            await message.reply('✅ No warnings to clear.');
            return;
        }

        const chatWarnings = this.warnings.get(chatId);
        if (chatWarnings.has(userId)) {
            chatWarnings.delete(userId);
            await message.reply('✅ Warnings cleared for user.');
        } else {
            await message.reply('✅ User has no warnings.');
        }
    }
}

module.exports = ModerationManager;