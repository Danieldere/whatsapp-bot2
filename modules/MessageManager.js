const { Location, Poll } = require('whatsapp-web.js');

class MessageManager {
    constructor(bot) {
        this.bot = bot;
        this.pollTracker = new Map();
        this.reactionHistory = new Map();
    }

    async handleCommand(command, message, args) {
        switch (command) {
            case 'reply':
                await this.replyToMessage(message, args);
                break;
            case 'mention':
                await this.mentionUsers(message, args);
                break;
            case 'react':
                await this.reactToMessage(message, args);
                break;
            case 'poll':
                await this.createPoll(message, args);
                break;
            case 'location':
                await this.sendLocation(message, args);
                break;
            default:
                await message.reply('❌ Unknown message command.');
        }
    }

    async replyToMessage(message, args) {
        if (!message.hasQuotedMsg) {
            await message.reply(`💬 *Reply to Message Usage:*

Reply to any message with:
\`!reply Your response here\`

**Features:**
• Smart reply suggestions
• Emoji reactions
• Multi-language support

**Example:**
Reply to "How are you?" with \`!reply I'm doing great!\``);
            return;
        }

        if (args.length < 2) {
            await message.reply('❌ Please provide a reply message.');
            return;
        }

        try {
            const quotedMsg = await message.getQuotedMessage();
            const replyText = args.slice(1).join(' ');
            
            await quotedMsg.reply(replyText);
            await message.reply('✅ Reply sent successfully!');

        } catch (error) {
            console.error('❌ Error replying to message:', error);
            await message.reply('❌ Failed to send reply.');
        }
    }

    async mentionUsers(message, args) {
        if (args.length < 2) {
            await message.reply(`🏷️ *Mention Users Usage:*

\`!mention @user1 @user2 Your message here\`

**Features:**
• Multiple mentions
• Custom messages
• Group announcements

**Examples:**
• \`!mention @john @jane Meeting at 3pm\`
• \`!mention @everyone Important announcement\`
• \`!mention @admins Please review this\``);
            return;
        }

        try {
            if (!message.mentionedIds || message.mentionedIds.length === 0) {
                await message.reply('❌ Please mention at least one user.');
                return;
            }

            const messageText = args.slice(1).join(' ');
            const mentions = message.mentionedIds;

            // Create mention text
            let mentionText = '';
            for (const mentionId of mentions) {
                const contact = await this.bot.client.getContactById(mentionId);
                mentionText += `@${contact.number} `;
            }

            const fullMessage = `${mentionText}\n\n${messageText}`;

            await this.bot.client.sendMessage(message.from, fullMessage, {
                mentions: mentions
            });

            await message.reply(`✅ Mentioned ${mentions.length} users successfully!`);

        } catch (error) {
            console.error('❌ Error mentioning users:', error);
            await message.reply('❌ Failed to mention users.');
        }
    }

    async reactToMessage(message, args) {
        if (!message.hasQuotedMsg) {
            await message.reply(`😀 *React to Message Usage:*

Reply to any message with:
\`!react <emoji>\`

**Popular Reactions:**
• \`!react ❤️\` - Love it
• \`!react 👍\` - Like
• \`!react 😂\` - Funny
• \`!react 😢\` - Sad
• \`!react 😡\` - Angry
• \`!react 🔥\` - Fire

**Example:**
Reply to a funny message with \`!react 😂\``);
            return;
        }

        if (args.length < 2) {
            await message.reply('❌ Please provide an emoji to react with.');
            return;
        }

        try {
            const quotedMsg = await message.getQuotedMessage();
            const emoji = args[1];

            await quotedMsg.react(emoji);
            await message.reply(`✅ Reacted with ${emoji}`);

            // Track reaction
            this.trackReaction(quotedMsg.id.id, emoji, message.author || message.from);

        } catch (error) {
            console.error('❌ Error reacting to message:', error);
            await message.reply('❌ Failed to react to message.');
        }
    }

    async createPoll(message, args) {
        if (args.length < 4) {
            await message.reply(`📊 *Create Poll Usage:*

\`!poll "Question?" "Option 1" "Option 2" "Option 3" ...\`

**Features:**
• Multiple choice polls
• Up to 12 options
• Real-time results
• Automatic tracking

**Example:**
\`!poll "What's your favorite color?" "Red" "Blue" "Green" "Yellow"\`

**Requirements:**
• Question and options in quotes
• Minimum 2 options
• Maximum 12 options`);
            return;
        }

        try {
            // Extract question and options from quotes
            const quotes = message.body.match(/"([^"]+)"/g);
            
            if (!quotes || quotes.length < 3) {
                await message.reply('❌ Please provide question and at least 2 options in quotes.');
                return;
            }

            const question = quotes[0].replace(/"/g, '');
            const options = quotes.slice(1).map(opt => opt.replace(/"/g, ''));

            if (options.length > 12) {
                await message.reply('❌ Maximum 12 options allowed.');
                return;
            }

            // Create poll
            const poll = new Poll(question, options, {
                allowMultipleAnswers: false
            });

            const pollMessage = await this.bot.client.sendMessage(message.from, poll);
            
            // Track poll
            this.pollTracker.set(pollMessage.id.id, {
                question: question,
                options: options,
                createdBy: message.author || message.from,
                createdAt: Date.now(),
                votes: new Map()
            });

            await message.reply('✅ Poll created successfully!');

        } catch (error) {
            console.error('❌ Error creating poll:', error);
            await message.reply('❌ Failed to create poll. Polls may not be supported in this chat.');
        }
    }

    async sendLocation(message, args) {
        if (args.length < 3) {
            await message.reply(`📍 *Send Location Usage:*

\`!location <latitude> <longitude> [name]\`

**Examples:**
• \`!location 40.7128 -74.0060 "New York City"\`
• \`!location 51.5074 -0.1278 "London"\`
• \`!location 35.6762 139.6503\` (Tokyo coordinates)

**Popular Locations:**
• New York: 40.7128, -74.0060
• London: 51.5074, -0.1278
• Paris: 48.8566, 2.3522
• Tokyo: 35.6762, 139.6503

💡 **Tip:** You can get coordinates from Google Maps!`);
            return;
        }

        try {
            const latitude = parseFloat(args[1]);
            const longitude = parseFloat(args[2]);
            const name = args.slice(3).join(' ').replace(/"/g, '') || 'Shared Location';

            if (isNaN(latitude) || isNaN(longitude)) {
                await message.reply('❌ Invalid coordinates. Please provide valid latitude and longitude.');
                return;
            }

            // Validate coordinate ranges
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                await message.reply('❌ Coordinates out of range. Latitude: -90 to 90, Longitude: -180 to 180');
                return;
            }

            const location = new Location(latitude, longitude, name);
            
            await this.bot.client.sendMessage(message.from, location);
            await message.reply(`✅ Location "${name}" sent successfully!`);

        } catch (error) {
            console.error('❌ Error sending location:', error);
            await message.reply('❌ Failed to send location.');
        }
    }

    async handleMentions(message) {
        try {
            // Log mention for analytics
            console.log(`🏷️ Mention detected in ${message.from} by ${message.author || 'unknown'}`);
            
            // Auto-respond to bot mentions if configured
            const botNumber = this.bot.client.info.wid.user;
            if (message.mentionedIds.includes(`${botNumber}@c.us`)) {
                const autoResponse = `🤖 *Bot Mentioned*

Hello! I'm the Enhanced WhatsApp Bot.

📋 **Quick Commands:**
• \`!menu\` - Main menu
• \`!help\` - Command help
• \`!stats\` - Bot statistics

💡 Type any command to get started!`;

                setTimeout(async () => {
                    await message.reply(autoResponse);
                }, 1000);
            }

        } catch (error) {
            console.error('❌ Error handling mentions:', error);
        }
    }

    trackReaction(messageId, emoji, userId) {
        if (!this.reactionHistory.has(messageId)) {
            this.reactionHistory.set(messageId, new Map());
        }
        
        const messageReactions = this.reactionHistory.get(messageId);
        messageReactions.set(userId, {
            emoji: emoji,
            timestamp: Date.now()
        });
    }

    async getMessageStats(message) {
        const chat = await message.getChat();
        const messages = await chat.fetchMessages({ limit: 100 });
        
        const stats = {
            totalMessages: messages.length,
            mediaMessages: messages.filter(msg => msg.hasMedia).length,
            textMessages: messages.filter(msg => !msg.hasMedia && msg.body).length,
            reactedMessages: messages.filter(msg => msg.reactions && msg.reactions.length > 0).length
        };

        return stats;
    }

    async sendMessageWithFormatting(chatId, text, options = {}) {
        try {
            // Apply text formatting
            let formattedText = text;
            
            // Bold: *text*
            formattedText = formattedText.replace(/\*([^*]+)\*/g, '*$1*');
            
            // Italic: _text_
            formattedText = formattedText.replace(/\_([^_]+)\_/g, '_$1_');
            
            // Strikethrough: ~text~
            formattedText = formattedText.replace(/\~([^~]+)\~/g, '~$1~');
            
            // Monospace: ```text```
            formattedText = formattedText.replace(/\`\`\`([^`]+)\`\`\`/g, '```$1```');

            await this.bot.client.sendMessage(chatId, formattedText, options);
            return true;

        } catch (error) {
            console.error('❌ Error sending formatted message:', error);
            return false;
        }
    }

    async scheduleMessage(chatId, text, delay) {
        setTimeout(async () => {
            try {
                await this.bot.client.sendMessage(chatId, text);
            } catch (error) {
                console.error('❌ Error sending scheduled message:', error);
            }
        }, delay);
    }

    async broadcastMessage(chatIds, message, options = {}) {
        const results = [];
        
        for (const chatId of chatIds) {
            try {
                await this.bot.client.sendMessage(chatId, message, options);
                results.push({ chatId, status: 'success' });
                
                // Add delay between messages to avoid spam detection
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                results.push({ chatId, status: 'failed', error: error.message });
            }
        }
        
        return results;
    }

    async createQuickReply(message, options) {
        if (!Array.isArray(options) || options.length === 0) {
            return;
        }

        let replyText = '🔘 *Quick Reply Options:*\n\n';
        options.forEach((option, index) => {
            replyText += `${index + 1}️⃣ ${option}\n`;
        });
        replyText += '\n💡 Reply with the number of your choice!';

        await message.reply(replyText);
    }

    async handleQuickReply(message, options) {
        const userResponse = parseInt(message.body.trim());
        
        if (userResponse && userResponse >= 1 && userResponse <= options.length) {
            const selectedOption = options[userResponse - 1];
            await message.reply(`✅ You selected: *${selectedOption}*`);
            return selectedOption;
        }
        
        return null;
    }

    getMessageTemplate(type) {
        const templates = {
            welcome: `🎉 *Welcome to the group!*

We're excited to have you here. Please read our rules and feel free to introduce yourself!

📋 *Quick Commands:*
• Type \`!help\` for bot commands
• Type \`!rules\` to see group rules
• Type \`!info\` for group information`,

            goodbye: `👋 *Goodbye!*

Thanks for being part of our community. You're always welcome back!`,

            announcement: `📢 *ANNOUNCEMENT*

{message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an official group announcement.`,

            reminder: `⏰ *REMINDER*

{message}

🔔 This is an automated reminder from the bot.`,

            warning: `⚠️ *WARNING*

{message}

Please follow the group rules to avoid further action.`
        };

        return templates[type] || '';
    }

    async sendTemplate(chatId, templateType, variables = {}) {
        let template = this.getMessageTemplate(templateType);
        
        // Replace variables in template
        Object.entries(variables).forEach(([key, value]) => {
            template = template.replace(new RegExp(`{${key}}`, 'g'), value);
        });

        if (template) {
            await this.bot.client.sendMessage(chatId, template);
            return true;
        }
        
        return false;
    }
}

module.exports = MessageManager;