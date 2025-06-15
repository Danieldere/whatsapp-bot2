class ContactManager {
    constructor(bot) {
        this.bot = bot;
        this.blockedContacts = new Set();
        this.contactCache = new Map();
    }

    async handleCommand(command, message, args) {
        switch (command) {
            case 'contact':
                await this.showContactMenu(message);
                break;
            case 'block':
                await this.blockContact(message, args);
                break;
            case 'unblock':
                await this.unblockContact(message, args);
                break;
            case 'profile':
                await this.getProfileInfo(message, args);
                break;
            case 'status':
                await this.setStatus(message, args);
                break;
            default:
                await message.reply('❌ Unknown contact command. Type `!contact` for menu.');
        }
    }

    async showContactMenu(message) {
        const menuText = `👤 *Contact Management Panel*
╔══════════════════════════════╗
║       CONTACT CONTROLS       ║
╚══════════════════════════════╝

🚫 *Block/Unblock*
├─ \`!block @user\` - Block contact
├─ \`!unblock @user\` - Unblock contact
├─ \`!block list\` - Show blocked contacts
└─ \`!block check @user\` - Check if blocked

👤 *Profile Management*
├─ \`!profile @user\` - Get profile info
├─ \`!profile pic @user\` - Get profile picture
├─ \`!profile about @user\` - Get status message
└─ \`!profile save @user\` - Save contact info

📱 *Status Management*
├─ \`!status set "Your status"\` - Set your status
├─ \`!status clear\` - Clear status
├─ \`!status emoji 😊\` - Set emoji status
└─ \`!status view\` - View current status

📊 *Contact Stats*
├─ Total contacts: ${await this.getContactCount()}
├─ Blocked contacts: ${this.blockedContacts.size}
└─ Cached profiles: ${this.contactCache.size}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Tip:* Use @mentions to specify contacts`;

        await message.reply(menuText);
    }

    async blockContact(message, args) {
        if (args.length < 2) {
            await message.reply(`🚫 *Block Contact Usage:*

\`!block @user\` - Block specific user
\`!block list\` - Show blocked contacts
\`!block check @user\` - Check if user is blocked

**Examples:**
• \`!block @spam_user\`
• \`!block list\`
• \`!block check @john\``);
            return;
        }

        if (args[1] === 'list') {
            await this.showBlockedList(message);
            return;
        }

        if (args[1] === 'check') {
            await this.checkBlockStatus(message);
            return;
        }

        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            await message.reply('❌ Please mention a user to block.');
            return;
        }

        try {
            const results = [];
            
            for (const contactId of message.mentionedIds) {
                try {
                    const contact = await this.bot.client.getContactById(contactId);
                    await contact.block();
                    
                    this.blockedContacts.add(contactId);
                    results.push(`✅ ${contact.pushname || contact.number}`);
                    
                } catch (error) {
                    const contact = await this.bot.client.getContactById(contactId);
                    results.push(`❌ ${contact.pushname || contact.number} - ${error.message}`);
                }
            }

            const resultMsg = `🚫 *Block Results:*

${results.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successfully blocked: ${results.filter(r => r.startsWith('✅')).length}
❌ Failed to block: ${results.filter(r => r.startsWith('❌')).length}`;

            await message.reply(resultMsg);
            this.bot.stats.contactsModified++;

        } catch (error) {
            console.error('❌ Error blocking contact:', error);
            await message.reply('❌ Failed to block contact.');
        }
    }

    async unblockContact(message, args) {
        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            await message.reply('❌ Please mention a user to unblock.');
            return;
        }

        try {
            const results = [];
            
            for (const contactId of message.mentionedIds) {
                try {
                    const contact = await this.bot.client.getContactById(contactId);
                    await contact.unblock();
                    
                    this.blockedContacts.delete(contactId);
                    results.push(`✅ ${contact.pushname || contact.number}`);
                    
                } catch (error) {
                    const contact = await this.bot.client.getContactById(contactId);
                    results.push(`❌ ${contact.pushname || contact.number} - ${error.message}`);
                }
            }

            const resultMsg = `✅ *Unblock Results:*

${results.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successfully unblocked: ${results.filter(r => r.startsWith('✅')).length}
❌ Failed to unblock: ${results.filter(r => r.startsWith('❌')).length}`;

            await message.reply(resultMsg);
            this.bot.stats.contactsModified++;

        } catch (error) {
            console.error('❌ Error unblocking contact:', error);
            await message.reply('❌ Failed to unblock contact.');
        }
    }

    async getProfileInfo(message, args) {
        let targetContact = null;

        // Check if mentioning someone
        if (message.mentionedIds && message.mentionedIds.length > 0) {
            targetContact = await this.bot.client.getContactById(message.mentionedIds[0]);
        } else if (!message.from.endsWith('@g.us')) {
            // In DM, show other person's profile
            targetContact = await this.bot.client.getContactById(message.from);
        } else {
            await message.reply('❌ Please mention a user or use in DM.');
            return;
        }

        try {
            // Get profile picture
            let profilePicUrl = 'No profile picture';
            try {
                profilePicUrl = await targetContact.getProfilePicUrl();
            } catch (error) {
                // Profile pic not available
            }

            // Get about/status
            let about = 'No status message';
            try {
                about = await targetContact.getAbout();
            } catch (error) {
                // About not available
            }

            // Check if contact is blocked
            const isBlocked = await targetContact.isBlocked();

            const profileInfo = `👤 *Profile Information*
╔══════════════════════════════╗
║        CONTACT DETAILS       ║
╚══════════════════════════════╝

📱 **Number:** +${targetContact.number}
👤 **Name:** ${targetContact.pushname || targetContact.name || 'No name'}
📝 **About:** ${about}
🖼️ **Profile Pic:** ${profilePicUrl !== 'No profile picture' ? 'Available' : 'Not available'}
🚫 **Blocked:** ${isBlocked ? 'Yes' : 'No'}
💬 **Is Business:** ${targetContact.isBusiness ? 'Yes' : 'No'}
📞 **Is Contact:** ${targetContact.isMyContact ? 'Yes' : 'No'}

📊 **Contact Stats:**
├─ Last seen: ${targetContact.lastSeen ? new Date(targetContact.lastSeen * 1000).toLocaleString() : 'Unknown'}
├─ Is online: ${targetContact.isOnline ? 'Yes' : 'No'}
└─ Profile fetched: ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Use \`!profile pic @user\` to get profile picture`;

            await message.reply(profileInfo);

            // Send profile picture if available and requested
            if (args.includes('pic') && profilePicUrl !== 'No profile picture') {
                try {
                    const media = await MessageMedia.fromUrl(profilePicUrl);
                    await this.bot.client.sendMessage(message.from, media, {
                        caption: `📸 Profile picture of ${targetContact.pushname || targetContact.number}`
                    });
                } catch (error) {
                    console.error('❌ Error sending profile picture:', error);
                }
            }

        } catch (error) {
            console.error('❌ Error getting profile info:', error);
            await message.reply('❌ Failed to get profile information.');
        }
    }

    async setStatus(message, args) {
        if (args.length < 2) {
            await message.reply(`📱 *Set Status Usage:*

\`!status set "Your status message"\` - Set text status
\`!status emoji 😊\` - Set emoji status
\`!status clear\` - Clear status
\`!status view\` - View current status

**Examples:**
• \`!status set "Busy at work"\`
• \`!status emoji 😴\`
• \`!status clear\``);
            return;
        }

        try {
            const action = args[1].toLowerCase();

            switch (action) {
                case 'set':
                    if (args.length < 3) {
                        await message.reply('❌ Please provide a status message in quotes.');
                        return;
                    }
                    
                    const statusMatch = message.body.match(/"([^"]+)"/);
                    if (!statusMatch) {
                        await message.reply('❌ Status message must be in quotes.');
                        return;
                    }

                    const statusText = statusMatch[1];
                    await this.bot.client.setStatus(statusText);
                    await message.reply(`✅ Status set to: "${statusText}"`);
                    break;

                case 'emoji':
                    if (args.length < 3) {
                        await message.reply('❌ Please provide an emoji.');
                        return;
                    }
                    
                    const emoji = args[2];
                    await this.bot.client.setStatus(emoji);
                    await message.reply(`✅ Status set to: ${emoji}`);
                    break;

                case 'clear':
                    await this.bot.client.setStatus('');
                    await message.reply('✅ Status cleared.');
                    break;

                case 'view':
                    const currentStatus = await this.bot.client.getStatus();
                    await message.reply(`📱 *Current Status:* ${currentStatus || 'No status set'}`);
                    break;

                default:
                    await message.reply('❌ Unknown status action. Use set, emoji, clear, or view.');
            }

        } catch (error) {
            console.error('❌ Error setting status:', error);
            await message.reply('❌ Failed to update status.');
        }
    }

    async showBlockedList(message) {
        try {
            if (this.blockedContacts.size === 0) {
                await message.reply('✅ No blocked contacts.');
                return;
            }

            let blockedList = `🚫 *Blocked Contacts*\n\n`;
            let count = 1;

            for (const contactId of this.blockedContacts) {
                try {
                    const contact = await this.bot.client.getContactById(contactId);
                    blockedList += `${count}. ${contact.pushname || contact.number}\n`;
                    count++;
                } catch (error) {
                    blockedList += `${count}. ${contactId} (Contact not found)\n`;
                    count++;
                }
            }

            blockedList += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTotal blocked: ${this.blockedContacts.size}`;

            await message.reply(blockedList);

        } catch (error) {
            console.error('❌ Error showing blocked list:', error);
            await message.reply('❌ Failed to get blocked contacts list.');
        }
    }

    async checkBlockStatus(message) {
        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            await message.reply('❌ Please mention a user to check.');
            return;
        }

        try {
            const contact = await this.bot.client.getContactById(message.mentionedIds[0]);
            const isBlocked = await contact.isBlocked();
            
            const statusMsg = `🔍 *Block Status Check*

👤 **Contact:** ${contact.pushname || contact.number}
🚫 **Status:** ${isBlocked ? '❌ BLOCKED' : '✅ NOT BLOCKED'}
📅 **Checked:** ${new Date().toLocaleString()}`;

            await message.reply(statusMsg);

        } catch (error) {
            console.error('❌ Error checking block status:', error);
            await message.reply('❌ Failed to check block status.');
        }
    }

    async getContactCount() {
        try {
            const contacts = await this.bot.client.getContacts();
            return contacts.length;
        } catch (error) {
            return 'Unknown';
        }
    }

    async searchContacts(query) {
        try {
            const contacts = await this.bot.client.getContacts();
            return contacts.filter(contact => 
                (contact.pushname && contact.pushname.toLowerCase().includes(query.toLowerCase())) ||
                (contact.name && contact.name.toLowerCase().includes(query.toLowerCase())) ||
                contact.number.includes(query)
            );
        } catch (error) {
            console.error('❌ Error searching contacts:', error);
            return [];
        }
    }

    cacheContact(contactId, contactData) {
        this.contactCache.set(contactId, {
            data: contactData,
            timestamp: Date.now()
        });

        // Auto-expire cache after 1 hour
        setTimeout(() => {
            this.contactCache.delete(contactId);
        }, 60 * 60 * 1000);
    }

    getCachedContact(contactId) {
        const cached = this.contactCache.get(contactId);
        if (cached && (Date.now() - cached.timestamp) < 60 * 60 * 1000) {
            return cached.data;
        }
        return null;
    }
}

module.exports = ContactManager;