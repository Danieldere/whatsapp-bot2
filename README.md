# WhatsApp Bot - Moderation & Utility Tool

A Node.js WhatsApp bot that provides moderation features, saves view-once media, and includes interactive utilities.

## ⚡ Features

- **🛡️ Auto-Moderation**: Deletes messages with links in group chats
- **📸 View-Once Saver**: Automatically saves disappearing media
- **🧠 Interactive Quiz**: Play quiz games with trivia questions
- **📊 Statistics**: Track bot usage and activity
- **⚡ Real-time Commands**: Ping, help, and utility commands

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- WhatsApp account (will need to scan QR code)

### Installation

```bash
# Clone or create project directory
mkdir whatsapp-bot && cd whatsapp-bot

# Initialize and install dependencies
npm init -y
npm install whatsapp-web.js qrcode-terminal

# Install dev dependencies (optional)
npm install --save-dev nodemon

# Copy the bot code to index.js
# (Use the provided index.js code)
```

### Running the Bot

```bash
# Start the bot
npm start

# Or with auto-restart during development
npm run dev
```

1. **Scan QR Code**: When you run the bot, a QR code will appear in terminal
2. **Open WhatsApp**: On your phone, go to WhatsApp > Settings > Linked Devices
3. **Scan Code**: Point your camera at the terminal QR code
4. **Bot Ready**: You'll see "WhatsApp Bot is ready!" message

## 🎮 Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!ping` | Check if bot is online | `!ping` |
| `!help` | Show all available commands | `!help` |
| `!quiz` | Start a random quiz question | `!quiz` |
| `!quiz <number>` | Answer current quiz (1-4) | `!quiz 3` |
| `!stats` | Show bot statistics | `!stats` |

## 🛡️ Auto-Features

### Link Moderation
- Automatically deletes messages containing `http://` or `https://` links in group chats
- Sends warning message to the group
- Tracks deleted links in statistics

### View-Once Media Saver
- Detects view-once images and videos
- Saves them to `saved-media/` folder
- Works in both DMs and group chats
- Confirms save with reply message (DMs only)

### Quiz System
- Interactive trivia questions
- Multiple choice answers (1-4)
- Tracks response time
- Gives feedback on correct/wrong answers

## 📁 File Structure

```
whatsapp-bot/
├── index.js              # Main bot file
├── package.json          # Dependencies
├── saved-media/          # Auto-created for view-once media
├── .wwebjs_auth/         # Auto-created for WhatsApp session
└── README.md            # This file
```

## 🔧 Configuration

### Customizing Quiz Questions

Edit the `quizQuestions` array in `index.js`:

```javascript
this.quizQuestions = [
    {
        question: "Your question here?",
        options: ["1. Option A", "2. Option B", "3. Option C", "4. Option D"],
        correct: 2, // Correct answer number (1-4)
        answer: "Option B" // Correct answer text
    }
];
```

### Adjusting Moderation

- **Disable link deletion**: Comment out the `handleLinkModeration` call
- **Change link regex**: Modify the `linkRegex` pattern
- **Whitelist domains**: Add domain checking logic

## 🚨 Production Setup

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start bot with PM2
npm run pm2

# Monitor bot
pm2 status
pm2 logs whatsapp-bot

# Restart bot
pm2 restart whatsapp-bot
```

### Docker Setup

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## ⚠️ Important Notes

### WhatsApp TOS Compliance
- This bot uses unofficial WhatsApp Web automation
- Use at your own risk - WhatsApp may ban accounts using unofficial tools
- Recommended for personal/educational use only
- Consider using WhatsApp Business API for commercial applications

### Session Management
- Bot saves login session in `.wwebjs_auth/` folder
- Delete this folder to force new QR code login
- Sessions may expire and require re-authentication

### Error Handling
- Bot includes basic error handling and logging
- Check console output for debugging information
- Bot will attempt to reconnect on disconnection

## 🔍 Troubleshooting

### Common Issues

**QR Code Won't Scan**
- Make sure terminal supports QR code display
- Try different terminal applications
- Ensure good lighting when scanning

**Bot Not Responding**
- Check if WhatsApp Web session is active
- Restart the bot process
- Clear `.wwebjs_auth/` and re-authenticate

**Media Not Saving**
- Ensure `saved-media/` directory exists and is writable
- Check disk space
- Verify media download permissions

**Commands Not Working**
- Commands must start with `!` (exclamation mark)
- Check for typos in command names
- Ensure bot is in the correct chat/group

### Debug Mode

Add more logging by modifying console.log statements:

```javascript
console.log('📥 Message received:', message.body);
console.log('👤 From:', message.from);
```

## 📈 Extending the Bot

### Adding New Commands

```javascript
case 'newcommand':
    await message.reply('Your new command response!');
    break;
```

### Adding Scheduled Messages

```javascript
// Add this after bot initialization
setInterval(async () => {
    await this.client.sendMessage('groupid@g.us', 'Daily reminder!');
}, 24 * 60 * 60 * 1000); // 24 hours
```

### Database Integration

Consider adding:
- SQLite for user statistics
- Redis for temporary data
- MongoDB for advanced features

## 📜 License

MIT License - Use freely but at your own risk.

## 🤝 Contributing

This is a personal project. Feel free to fork and modify for your needs.

---

**⚠️ Disclaimer**: This bot uses unofficial WhatsApp automation and may violate WhatsApp's Terms of Service. Use responsibly and at your own risk.