const { MessageMedia } = require('whatsapp-web.js');

class GroupManager {
    constructor(bot) {
        this.bot = bot;
        this.groupSettings = new Map();
        this.welcomeMessages = new Map();
    }

    async handleCommand(command, message, args) {
        switch (command) {
            case 'group':
                await this.showGroupMenu(message);
                break;
            case 'create':
                await this.createGroup(message, args);
                break;
            case 'add':
                await this.addParticipants(message, args);
                break;
            case 'remove':
                await this.removeParticipants(message, args);
                break;
            case 'promote':
                await this.promoteParticipant(message, args);
                break;
            case 'demote':
                await this.demoteParticipant(message, args);
                break;
            case 'info':
                await this.getGroupInfo(message);
                break;
            case 'link':
                await this.getInviteLink(message);
                break;
            default:
                await message.reply('❌ Unknown group command. Type `!group` for menu.');
        }
    }

    async showGroupMenu(message) {
        const isGroup = message.from.endsWith('@g.us');
        
        const menuText = `👥 *Group Management Panel*
╔══════════════════════════════╗
║        GROUP CONTROLS        ║
╚══════════════════════════════╝

🆕 *Create & Setup*
├─ \`!create "Name" @user1 @user2\` - Create new group
├─ \`!info\` - Show group information
└─ \`!link\` - Get/revoke invite link

👤 *Member Management*
├─ \`!add @user1 @user2\` - Add participants
├─ \`!remove @user\` - Remove participant
├─ \`!promote @user\` - Promote to admin
└─ \`!demote @user\` - Demote from admin

⚙️ *Group Settings*
├─ \`!settings\` - Configure group settings
├─ \`!welcome on/off\` - Welcome messages
├─ \`!rules\` - Set group rules
└─ \`!announce\` - Announcement mode

📊 *Group Stats*
${isGroup ? await this.getQuickStats(message) : '└─ Use in a group to see stats'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Note:* Bot must be admin for most functions`;

        await message.reply(menuText);
    }

    async createGroup(message, args) {
        if (args.length < 2) {
            await message.reply(`🆕 *Create Group Usage:*

\`!create "Group Name" @user1 @user2 ...\`

**Example:**
\`!create "My New Group" @john @jane @bob\`

**Requirements:**
• Group name in quotes
• At least one participant
• All participants must be contacts`);
            return;
        }

        try {
            // Extract group name from quotes
            const nameMatch = message.body.match(/"([^"]+)"/);
            if (!nameMatch) {
                await message.reply('❌ Group name must be in quotes. Example: `!create "My Group" @user`');
                return;
            }

            const groupName = nameMatch[1];
            const participants = message.mentionedIds || [];

            if (participants.length === 0) {
                await message.reply('❌ Please mention at least one participant.');
                return;
            }

            // Create the group
            const group = await this.bot.client.createGroup(groupName, participants);
            
            this.bot.stats.groupsManaged++;

            const successMsg = `✅ *Group Created Successfully!*

👥 **Group:** ${groupName}
🆔 **ID:** ${group.gid._serialized}
👤 **Participants:** ${participants.length}
🔗 **Invite Link:** ${await group.getInviteCode()}

🎉 Group is ready to use!`;

            await message.reply(successMsg);

        } catch (error) {
            console.error('❌ Error creating group:', error);
            await message.reply('❌ Failed to create group. Make sure all participants are valid contacts.');
        }
    }

    async addParticipants(message, args) {
        if (!message.from.endsWith('@g.us')) {
            await message.reply('❌ This command can only be used in groups.');
            return;
        }

        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            await message.reply('❌ Please mention users to add. Example: `!add @user1 @user2`');
            return;
        }

        try {
            const chat = await message.getChat();
            const results = [];

            for (const participantId of message.mentionedIds) {
                try {
                    await chat.addParticipants([participantId]);
                    const contact = await this.bot.client.getContactById(participantId);
                    results.push(`✅ ${contact.pushname || contact.number}`);
                } catch (error) {
                    const contact = await this.bot.client.getContactById(participantId);
                    results.push(`❌ ${contact.pushname || contact.number} - ${error.message}`);
                }
            }

            const resultMsg = `👥 *Add Participants Results:*

${results.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successfully added: ${results.filter(r => r.startsWith('✅')).length}
❌ Failed to add: ${results.filter(r => r.startsWith('❌')).length}`;

            await message.reply(resultMsg);

        } catch (error) {
            console.error('❌ Error adding participants:', error);
            await message.reply('❌ Failed to add participants. Make sure you have admin permissions.');
        }
    }

    async removeParticipants(message, args) {
        if (!message.from.endsWith('@g.us')) {
            await message.reply('❌ This command can only be used in groups.');
            return;
        }

        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            await message.reply('❌ Please mention users to remove. Example: `!remove @user1 @user2`');
            return;
        }

        try {
            const chat = await message.getChat();
            const results = [];

            for (const participantId of message.mentionedIds) {
                try {
                    await chat.removeParticipants([participantId]);
                    const contact = await this.bot.client.getContactById(participantId);
                    results.push(`✅ ${contact.pushname || contact.number}`);
                } catch (error) {
                    const contact = await this.bot.client.getContactById(participantId);
                    results.push(`❌ ${contact.pushname || contact.number} - ${error.message}`);
                }
            }

            const resultMsg = `👥 *Remove Participants Results:*

${results.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successfully removed: ${results.filter(r => r.startsWith('✅')).length}
❌ Failed to remove: ${results.filter(r => r.startsWith('❌')).length}`;

            await message.reply(resultMsg);

        } catch (error) {
            console.error('❌ Error removing participants:', error);
            await message.reply('❌ Failed to remove participants. Make sure you have admin permissions.');
        }
    }

    async promoteParticipant(message, args) {
        if (!message.from.endsWith('@g.us')) {
            await message.reply('❌ This command can only be used in groups.');
            return;
        }

        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            await message.reply('❌ Please mention users to promote. Example: `!promote @user1 @user2`');
            return;
        }

        try {
            const chat = await message.getChat();
            const results = [];

            for (const participantId of message.mentionedIds) {
                try {
                    await chat.promoteParticipants([participantId]);
                    const contact = await this.bot.client.getContactById(participantId);
                    results.push(`✅ ${contact.pushname || contact.number} promoted to admin`);
                } catch (error) {
                    const contact = await this.bot.client.getContactById(participantId);
                    results.push(`❌ ${contact.pushname || contact.number} - ${error.message}`);
                }
            }

            const resultMsg = `👑 *Promotion Results:*

${results.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successfully promoted: ${results.filter(r => r.startsWith('✅')).length}
❌ Failed to promote: ${results.filter(r => r.startsWith('❌')).length}`;

            await message.reply(resultMsg);

        } catch (error) {
            console.error('❌ Error promoting participants:', error);
            await message.reply('❌ Failed to promote participants. Make sure you have admin permissions.');
        }
    }

    async demoteParticipant(message, args) {
        if (!message.from.endsWith('@g.us')) {
            await message.reply('❌ This command can only be used in groups.');
            return;
        }

        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            await message.reply('❌ Please mention users to demote. Example: `!demote @user1 @user2`');
            return;
        }

        try {
            const chat = await message.getChat();
            const results = [];

            for (const participantId of message.mentionedIds) {
                try {
                    await chat.demoteParticipants([participantId]);
                    const contact = await this.bot.client.getContactById(participantId);
                    results.push(`✅ ${contact.pushname || contact.number} demoted from admin`);
                } catch (error) {
                    const contact = await this.bot.client.getContactById(participantId);
                    results.push(`❌ ${contact.pushname || contact.number} - ${error.message}`);
                }
            }

            const resultMsg = `👤 *Demotion Results:*

${results.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successfully demoted: ${results.filter(r => r.startsWith('✅')).length}
❌ Failed to demote: ${results.filter(r => r.startsWith('❌')).length}`;

            await message.reply(resultMsg);

        } catch (error) {
            console.error('❌ Error demoting participants:', error);
            await message.reply('❌ Failed to demote participants. Make sure you have admin permissions.');
        }
    }

    async getGroupInfo(message) {
        if (!message.from.endsWith('@g.us')) {
            await message.reply('❌ This command can only be used in groups.');
            return;
        }

        try {
            const chat = await message.getChat();
            const admins = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin);
            const members = chat.participants.filter(p => !p.isAdmin && !p.isSuperAdmin);

            let infoText = `ℹ️ *Group Information*
╔══════════════════════════════╗
║         GROUP DETAILS        ║
╚══════════════════════════════╝

📋 **Name:** ${chat.name}
🆔 **ID:** ${chat.id._serialized}
👥 **Total Members:** ${chat.participants.length}
👑 **Admins:** ${admins.length}
👤 **Members:** ${members.length}
📅 **Created:** ${chat.createdAt ? new Date(chat.createdAt * 1000).toLocaleDateString() : 'Unknown'}

📜 **Description:**
${chat.description || 'No description set'}

👑 **Administrators:**
${admins.map(admin => {
    const contact = admin.id.user;
    const role = admin.isSuperAdmin ? '👨‍💼 Super Admin' : '👮‍♂️ Admin';
    return `├─ ${role}: +${contact}`;
}).join('\n') || '└─ No admins found'}

⚙️ **Group Settings:**
├─ Send Messages: ${chat.groupMetadata?.restrict ? '❌ Admins Only' : '✅ Everyone'}
├─ Edit Info: ${chat.groupMetadata?.restrict ? '❌ Admins Only' : '✅ Everyone'}
└─ Invite Link: ${chat.groupMetadata?.inviteCode ? '✅ Available' : '❌ Disabled'}`;

            await message.reply(infoText);

        } catch (error) {
            console.error('❌ Error getting group info:', error);
            await message.reply('❌ Failed to get group information.');
        }
    }

    async getInviteLink(message) {
        if (!message.from.endsWith('@g.us')) {
            await message.reply('❌ This command can only be used in groups.');
            return;
        }

        try {
            const chat = await message.getChat();
            const inviteCode = await chat.getInviteCode();
            
            const linkMsg = `🔗 *Group Invite Link*

**Group:** ${chat.name}
**Link:** https://chat.whatsapp.com/${inviteCode}

📋 **Quick Actions:**
├─ \`!link revoke\` - Revoke current link
├─ \`!link new\` - Generate new link
└─ \`!link disable\` - Disable invite link

⚠️ **Warning:** Anyone with this link can join the group!`;

            await message.reply(linkMsg);

        } catch (error) {
            console.error('❌ Error getting invite link:', error);
            await message.reply('❌ Failed to get invite link. Make sure you have admin permissions.');
        }
    }

    async getQuickStats(message) {
        try {
            const chat = await message.getChat();
            const admins = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin);
            
            return `├─ Members: ${chat.participants.length}
├─ Admins: ${admins.length}
└─ Messages: ${await this.getMessageCount(chat)}`;
        } catch (error) {
            return '└─ Stats unavailable';
        }
    }

    async getMessageCount(chat) {
        try {
            const messages = await chat.fetchMessages({ limit: 100 });
            return messages.length + '+';
        } catch (error) {
            return 'Unknown';
        }
    }

    async handleGroupJoin(notification) {
        try {
            if (this.welcomeMessages.has(notification.chatId)) {
                const welcomeConfig = this.welcomeMessages.get(notification.chatId);
                if (welcomeConfig.enabled) {
                    const contact = await this.bot.client.getContactById(notification.id.participant);
                    const welcomeMsg = welcomeConfig.message.replace('{user}', `@${contact.number}`);
                    
                    await this.bot.client.sendMessage(notification.chatId, welcomeMsg, {
                        mentions: [contact.id._serialized]
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error handling group join:', error);
        }
    }

    async handleGroupLeave(notification) {
        try {
            console.log(`👋 User left group: ${notification.id.participant}`);
        } catch (error) {
            console.error('❌ Error handling group leave:', error);
        }
    }
}

module.exports = GroupManager;