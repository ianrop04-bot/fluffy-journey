import express from 'express';
import cors from 'cors';
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import fs from 'fs';
impost path from 'path';

const app = express();
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

let sock = null;

async function startBot() {
    try {
        const authFolder = './auth_file';
        
        // Create auth folder if doesn't exist
        if (!fs.existsSync(authFolder)) {
            fs.mkdirSync(authFolder, { recursive: true });
        }
        
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            printQRInTerminal: false,
            auth: state,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000, // Fixed: was 2500 (too fast)
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update; // Fixed typo
            
            if (connection === 'open') {
                console.log('✅ Connected to WhatsApp!');
                console.log('🤖 Bot is now online and ready!');
                
                // Send test message
                setTimeout(async () => {
                    try {
                        const botJid = sock.user.id;
                        await sock.sendMessage(botJid, {
                            text: `
*Creative Hub Bot Connected*
_.ping_
_.menu_
_.alive_
> powered By Ian`
                        });
                        console.log('✅ Test message sent');
                    } catch (error) {
                        console.log('Note: Could not send test message');
                    }
                }, 5000);
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('⚠️ Disconnected. Reconnecting:', shouldReconnect);
                
                if (shouldReconnect) {
                    setTimeout(() => {
                        console.log('🔄 Attempting to reconnect...');
                        startBot();
                    }, 5000);
                }
            }
        });
        
        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.message) return;
                
                const sender = msg.key.remoteJid;
                const text = msg.message.conversation ||
                    msg.message.extendedTextMessage?.text ||
                    msg.message.imageMessage?.caption || '';
                    
                console.log(`Message From: ${sender} text: ${text}`);
                const m246 = '~' + text.toLowerCase();
                
                if (m246.includes('menu')) {
                    await sock.sendMessage(sender, {
                        text: `
*CreativeHubBot*
~Menu~
━━━━━━━━━━━━━━
~ping
~menu
~alive
\n> Dev By TechIr/IanRop`
                    }, { quoted: msg });
                }
                else if (m246.includes('ping')) {
                    await sock.sendMessage(sender, {
                        text: '*pong* \n' + `time: ${new Date().toLocaleTimeString()}`
                    }, { quoted: msg });
                }
                else if (m246.includes('alive')) {
                    await sock.sendMessage(sender, {
                        text: '*Bot Alive*\n More Command Soon'
                    }, { quoted: msg });
                }
            } catch (e) {
                console.log('Error Handling Messages: ' + e.message);
            }
        });
        
    } catch (error) {
        console.log('Error Starting Bot: ' + error);
        setTimeout(startBot, 30000);
    }
}

startBot().catch(error => {
    console.error('Fatal error:', error);
    console.log('Trying to restart in 30 seconds...');
    setTimeout(() => {
        startBot();
    }, 30000);
});

// Keep-alive message
let minutes = 0;
setInterval(() => {
    minutes += 5;
    console.log(`⏱️ Bot has been running for ${minutes} minutes on vercel.host`);
}, 300000);

// ============ API ENDPOINTS (FIXED) ============
app.use('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/g', (req, res) => {
    res.json({ message: 'Creative Hub Bot 🔵 Online' });
});

app.get('/get', (req, res) => {
    res.json({ message: 'Creative Hub Bot 🔵 Online' });
});

app.post('/pair', async (req, res) => {  // Fixed: (req, res) not (res, req)
    const { number } = req.body;
    
    if (!number) {
        return res.status(400).json({ error: 'Phone Number Required' });
    }
    
    if (!sock) {
        return res.status(503).json({ error: 'Bot not ready. Wait 10 seconds.' });
    }
    
    try {
        const cleanNumber = number.replace(/\D/g, '');
        const code = await sock.requestPairingCode(cleanNumber);
        res.json({ success: true, code: code });
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({ error: 'Error generating pairing code' });
    }
});

app.get('/status', (req, res) => {
    res.json({
        connected: sock !== null,
        ready: sock !== null
    });
});

const PORT = process.env.PORT || 4447;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}`);
});
