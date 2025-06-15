#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 WhatsApp Bot Fix Script');
console.log('='.repeat(40));

async function fixBot() {
    try {
        // Step 1: Clear session
        console.log('1️⃣ Clearing WhatsApp session...');
        const authPath = path.join(process.cwd(), '.wwebjs_auth');
        const cachePath = path.join(process.cwd(), '.wwebjs_cache');
        
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('   ✅ Cleared .wwebjs_auth');
        }
        
        if (fs.existsSync(cachePath)) {
            fs.rmSync(cachePath, { recursive: true, force: true });
            console.log('   ✅ Cleared .wwebjs_cache');
        }

        // Step 2: Clear node_modules and reinstall
        console.log('\n2️⃣ Reinstalling dependencies...');
        const nodeModulesPath = path.join(process.cwd(), 'node_modules');
        
        if (fs.existsSync(nodeModulesPath)) {
            console.log('   🗑️ Removing node_modules...');
            fs.rmSync(nodeModulesPath, { recursive: true, force: true });
        }

        console.log('   📦 Installing fresh dependencies...');
        execSync('npm install', { stdio: 'inherit' });

        // Step 3: Install specific working version
        console.log('\n3️⃣ Installing stable WhatsApp Web.js version...');
        execSync('npm install whatsapp-web.js@1.22.2 --save', { stdio: 'inherit' });

        // Step 4: Clear npm cache
        console.log('\n4️⃣ Clearing npm cache...');
        execSync('npm cache clean --force', { stdio: 'inherit' });

        console.log('\n' + '✅'.repeat(20));
        console.log('🎉 Bot fixed successfully!');
        console.log('✅'.repeat(20));
        console.log('\n📋 Next steps:');
        console.log('1. Run: npm start');
        console.log('2. Scan the new QR code');
        console.log('3. Your bot should work now!');
        console.log('\n💡 If issues persist:');
        console.log('• Restart your computer');
        console.log('• Check internet connection');
        console.log('• Try running: npm update');

    } catch (error) {
        console.error('\n❌ Fix script failed:', error.message);
        console.log('\n🔧 Manual fix steps:');
        console.log('1. Delete .wwebjs_auth folder');
        console.log('2. Delete .wwebjs_cache folder');
        console.log('3. Delete node_modules folder');
        console.log('4. Run: npm install');
        console.log('5. Run: npm start');
    }
}

// Run the fix
fixBot();