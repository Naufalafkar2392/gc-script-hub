// ============================================================
// GC SCRIPT HUB - WEB SERVER
// ============================================================

const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ KONFIGURASI ============
const PORT = process.env.PORT || 3000;
const OWNER_KEY = process.env.OWNER_KEY || "GC_OWNER_2026";
const BLOCK_DURATION = 30 * 60 * 1000;
const SESSION_DURATION = 5 * 60 * 1000;

// ============ DATABASE ============
const DB_FILE = "./database.json";

function initDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify({
                scripts: [],
                sessions: {},
                blockedIPs: {},
                logs: [],
                stats: { totalLogin: 0, totalScriptView: 0, lastUpdate: Date.now() }
            }, null, 4));
        }
    } catch (err) {}
}

function loadDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch (err) {
        return {
            scripts: [],
            sessions: {},
            blockedIPs: {},
            logs: [],
            stats: { totalLogin: 0, totalScriptView: 0, lastUpdate: Date.now() }
        };
    }
}

function saveDB(data) {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4)); } catch (err) {}
}

// ============ GENERATE KEY ============
function generateKey() {
    const chars = "ABCDEF0123456789";
    let key = "GC-";
    for (let i = 0; i < 6; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

// ============ GET CLIENT IP ============
function getClientIP(req) {
    return req.headers["x-forwarded-for"]?.split(",")[0] || 
           req.socket.remoteAddress || "unknown";
}

// ============ LOG AKTIVITAS ============
function addLog(data, action, ip, detail = "") {
    data.logs.unshift({ action, ip, detail, time: Date.now() });
    if (data.logs.length > 100) data.logs = data.logs.slice(0, 100);
}

// ============ CEK BLOKIR ============
function isBlocked(ip) {
    const data = loadDB();
    const blocked = data.blockedIPs[ip];
    if (!blocked) return false;
    if (Date.now() - blocked.blockedAt > BLOCK_DURATION) {
        delete data.blockedIPs[ip];
        saveDB(data);
        return false;
    }
    return true;
}

// ============ SESSION ============
function createSession(ip) {
    const data = loadDB();
    const sessionKey = generateKey();
    data.sessions[sessionKey] = {
        ip: ip,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
    };
    for (const key in data.sessions) {
        if (Date.now() > data.sessions[key].expiresAt) delete data.sessions[key];
    }
    saveDB(data);
    return sessionKey;
}

function checkSession(sessionKey, ip) {
    const data = loadDB();
    const session = data.sessions[sessionKey];
    if (!session) return false;
    if (session.ip !== ip) return false;
    if (Date.now() > session.expiresAt) {
        delete data.sessions[sessionKey];
        saveDB(data);
        return false;
    }
    return true;
}

initDB();// ============ LOGIN PAGE ============
app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>GC Script Hub</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a12;
            color: #fff;
            font-family: 'Segoe UI', Arial, sans-serif;
            height: 100vh;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        #stars {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
        }
        .star {
            position: absolute;
            background: #fff;
            border-radius: 50%;
            animation: twinkle 3s infinite;
        }
        @keyframes twinkle {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
        }
        .login-box {
            position: relative;
            z-index: 1;
            background: rgba(20, 20, 32, 0.95);
            padding: 50px 40px;
            border-radius: 16px;
            box-shadow: 0 0 40px rgba(0, 220, 130, 0.3);
            border: 1px solid rgba(0, 220, 130, 0.2);
            width: 380px;
            text-align: center;
        }
        h1 {
            font-size: 28px;
            margin-bottom: 10px;
            background: linear-gradient(90deg, #00dc82, #00a8ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        p.subtitle {
            color: #888;
            font-size: 12px;
            margin-bottom: 30px;
        }
        input {
            width: 100%;
            padding: 14px;
            background: rgba(10, 10, 18, 0.8);
            border: 1px solid #2d2d3c;
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            margin-bottom: 15px;
            outline: none;
            transition: 0.3s;
        }
        input:focus {
            border-color: #00dc82;
            box-shadow: 0 0 10px rgba(0, 220, 130, 0.3);
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(90deg, #00dc82, #00a8ff);
            border: none;
            border-radius: 8px;
            color: #000;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
            transition: 0.3s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0, 220, 130, 0.4);
        }
        #msg {
            margin-top: 15px;
            font-size: 13px;
            min-height: 20px;
        }
        .footer {
            margin-top: 20px;
            font-size: 11px;
            color: #555;
        }
    </style>
</head>
<body>
    <div id="stars"></div>
    <div class="login-box">
        <h1>🌌 GC SCRIPT HUB 🌌</h1>
        <p class="subtitle">Akses khusus Owner</p>
        <input type="password" id="key" placeholder="Masukin Key Owner">
        <button onclick="login()">🔓 LOGIN</button>
        <p id="msg"></p>
        <p class="footer">⚠️ IP akan dicatat untuk keamanan</p>
    </div>
    <script>
        const stars = document.getElementById("stars");
        for (let i = 0; i < 100; i++) {
            const s = document.createElement("div");
            s.className = "star";
            s.style.left = Math.random() * 100 + "%";
            s.style.top = Math.random() * 100 + "%";
            s.style.width = Math.random() * 3 + "px";
            s.style.height = s.style.width;
            s.style.animationDelay = Math.random() * 3 + "s";
            stars.appendChild(s);
        }
        
        async function login() {
            const key = document.getElementById("key").value;
            const msg = document.getElementById("msg");
            msg.style.color = "#f0b432";
            msg.innerText = "⏳ Verifikasi...";
            
            try {
                const res = await fetch("/api/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key })
                });
                const data = await res.json();
                
                if (data.success) {
                    msg.style.color = "#00dc82";
                    msg.innerText = "✅ Login berhasil!";
                    setTimeout(() => {
                        window.location.href = "/dashboard?session=" + data.session;
                    }, 1000);
                } else {
                    msg.style.color = "#dc3c3c";
                    msg.innerText = "❌ " + data.message;
                }
            } catch (err) {
                msg.style.color = "#dc3c3c";
                msg.innerText = "❌ Gagal connect ke server";
            }
        }
        
        document.getElementById("key").addEventListener("keypress", (e) => {
            if (e.key === "Enter") login();
        });
    </script>
</body>
</html>`);
});// ============ DASHBOARD ============
app.get("/dashboard", (req, res) => {
    const ip = getClientIP(req);
    const session = req.query.session;
    
    if (!checkSession(session, ip)) {
        return res.redirect("/");
    }
    
    const data = loadDB();
    const scripts = data.scripts || [];
    const stats = data.stats || {};
    const logs = (data.logs || []).slice(0, 10);
    
    let scriptsHTML = "";
    if (scripts.length === 0) {
        scriptsHTML = "<p style='color:#666'>Belum ada script.</p>";
    } else {
        scriptsHTML = scripts.map(s => `
            <div class="script-item">
                <div>
                    <span class="script-name">📁 ${s.name}</span>
                    <span class="script-info">v${s.version} • ${new Date(s.updatedAt).toLocaleDateString("id-ID")}</span>
                </div>
                <button onclick="viewScript('${s.name}', '${session}')">👁️ Lihat</button>
            </div>
        `).join("");
    }
    
    let logsHTML = "";
    if (logs.length === 0) {
        logsHTML = "<p style='color:#666'>Belum ada log.</p>";
    } else {
        logsHTML = logs.map(l => `
            <div class="log-item">
                <span class="log-time">${new Date(l.time).toLocaleTimeString("id-ID")}</span>
                <span class="log-action">${l.action}</span>
                <span class="log-ip">${l.ip}</span>
            </div>
        `).join("");
    }
    
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Dashboard - GC Script Hub</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a12;
            color: #fff;
            font-family: 'Segoe UI', Arial, sans-serif;
            min-height: 100vh;
        }
        #stars {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
        }
        .star {
            position: absolute;
            background: #fff;
            border-radius: 50%;
            animation: twinkle 3s infinite;
        }
        @keyframes twinkle {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
        }
        .container {
            position: relative;
            z-index: 1;
            max-width: 900px;
            margin: 0 auto;
            padding: 30px 20px;
        }
        h1 {
            font-size: 26px;
            margin-bottom: 5px;
            background: linear-gradient(90deg, #00dc82, #00a8ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            color: #666;
            font-size: 12px;
            margin-bottom: 30px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: rgba(20, 20, 32, 0.9);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid rgba(0, 220, 130, 0.2);
            text-align: center;
        }
        .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: #00dc82;
        }
        .stat-label {
            font-size: 12px;
            color: #888;
            margin-top: 5px;
        }
        .section {
            background: rgba(20, 20, 32, 0.9);
            padding: 25px;
            border-radius: 12px;
            border: 1px solid rgba(0, 220, 130, 0.2);
            margin-bottom: 20px;
        }
        .section h2 {
            font-size: 16px;
            color: #00dc82;
            margin-bottom: 15px;
        }
        .script-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: rgba(10, 10, 18, 0.8);
            border-radius: 8px;
            margin-bottom: 8px;
        }
        .script-name {
            font-size: 14px;
            color: #fff;
        }
        .script-info {
            font-size: 11px;
            color: #666;
            margin-left: 10px;
        }
        .script-item button {
            padding: 8px 15px;
            background: #00dc82;
            border: none;
            border-radius: 6px;
            color: #000;
            font-weight: bold;
            cursor: pointer;
            font-size: 12px;
        }
        .log-item {
            display: flex;
            gap: 15px;
            padding: 8px;
            font-size: 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .log-time { color: #00a8ff; min-width: 70px; }
        .log-action { color: #fff; flex: 1; }
        .log-ip { color: #666; font-size: 11px; }
        .script-viewer {
            display: none;
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 100;
            padding: 30px;
            overflow-y: auto;
        }
        .script-viewer pre {
            background: #181828;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid rgba(0, 220, 130, 0.3);
            color: #00dc82;
            font-size: 12px;
            line-height: 1.6;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-width: 900px;
            margin: 0 auto;
        }
        .close-btn {
            display: block;
            margin: 20px auto;
            padding: 12px 30px;
            background: #dc3c3c;
            border: none;
            border-radius: 8px;
            color: #fff;
            font-weight: bold;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div id="stars"></div>
    <div class="container">
        <h1>🌌 GC SCRIPT HUB</h1>
        <p class="subtitle">Dashboard Owner</p>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${scripts.length}</div>
                <div class="stat-label">Total Script</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.totalLogin || 0}</div>
                <div class="stat-label">Total Login</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.totalScriptView || 0}</div>
                <div class="stat-label">Script Dilihat</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📜 DAFTAR SCRIPT</h2>
            ${scriptsHTML}
        </div>
        
        <div class="section">
            <h2>📋 LOG AKTIVITAS</h2>
            ${logsHTML}
        </div>
    </div>
    
    <div class="script-viewer" id="viewer">
        <pre id="viewerContent"></pre>
        <button class="close-btn" onclick="closeViewer()">❌ Tutup</button>
    </div>
    
    <script>
        const stars = document.getElementById("stars");
        for (let i = 0; i < 100; i++) {
            const s = document.createElement("div");
            s.className = "star";
            s.style.left = Math.random() * 100 + "%";
            s.style.top = Math.random() * 100 + "%";
            s.style.width = Math.random() * 3 + "px";
            s.style.height = s.style.width;
            s.style.animationDelay = Math.random() * 3 + "s";
            stars.appendChild(s);
        }
        
        async function viewScript(name, session) {
            const res = await fetch("/api/script/" + name + "?session=" + session);
            const data = await res.json();
            if (data.success) {
                document.getElementById("viewerContent").innerText = data.code;
                document.getElementById("viewer").style.display = "block";
            }
        }
        
        function closeViewer() {
            document.getElementById("viewer").style.display = "none";
        }
    </script>
</body>
</html>`);
});// ============ API: LOGIN ============
app.post("/api/login", (req, res) => {
    const ip = getClientIP(req);
    const { key } = req.body;
    
    // Cek blokir
    if (isBlocked(ip)) {
        return res.json({ success: false, message: "IP lo diblokir! Tunggu 30 menit atau minta Owner unlock." });
    }
    
    // Cek key
    if (!key) {
        return res.json({ success: false, message: "Key kosong!" });
    }
    
    if (key !== OWNER_KEY) {
        // Catat salah key
        const data = loadDB();
        if (!data.blockedIPs[ip]) {
            data.blockedIPs[ip] = { attempts: 0, blockedAt: null };
        }
        data.blockedIPs[ip].attempts = (data.blockedIPs[ip].attempts || 0) + 1;
        
        // Kalo salah 3x → blokir
        if (data.blockedIPs[ip].attempts >= 3) {
            data.blockedIPs[ip].blockedAt = Date.now();
            addLog(data, "BLOCKED", ip, "3x salah key");
            saveDB(data);
            return res.json({ success: false, message: "Salah 3x! IP lo diblokir 30 menit." });
        }
        
        addLog(data, "LOGIN FAILED", ip, `Salah key (${data.blockedIPs[ip].attempts}x)`);
        saveDB(data);
        return res.json({ success: false, message: `Key salah! Sisa ${3 - data.blockedIPs[ip].attempts}x percobaan.` });
    }
    
    // Key bener → bikin session
    const session = createSession(ip);
    
    const data = loadDB();
    data.blockedIPs[ip] = { attempts: 0, blockedAt: null };
    data.stats.totalLogin = (data.stats.totalLogin || 0) + 1;
    data.stats.lastUpdate = Date.now();
    addLog(data, "LOGIN SUCCESS", ip, "Owner login");
    saveDB(data);
    
    res.json({ success: true, session: session });
});

// ============ API: AMBIL SCRIPT ============
app.get("/api/script/:name", (req, res) => {
    const ip = getClientIP(req);
    const session = req.query.session;
    
    if (!checkSession(session, ip)) {
        return res.json({ success: false, message: "Session expired" });
    }
    
    const data = loadDB();
    const script = data.scripts.find(s => s.name === req.params.name);
    
    if (!script) {
        return res.json({ success: false, message: "Script gak ketemu" });
    }
    
    data.stats.totalScriptView = (data.stats.totalScriptView || 0) + 1;
    addLog(data, "VIEW SCRIPT", ip, script.name);
    saveDB(data);
    
    res.json({ success: true, name: script.name, code: script.code, version: script.version });
});

// ============ API: UPDATE SCRIPT (dari Bot) ============
app.post("/api/update", (req, res) => {
    const { name, code, version, apiKey } = req.body;
    
    if (apiKey !== OWNER_KEY) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    if (!name || !code) {
        return res.json({ success: false, message: "Data gak lengkap" });
    }
    
    const data = loadDB();
    const idx = data.scripts.findIndex(s => s.name === name);
    
    if (idx === -1) {
        // Tambah baru
        data.scripts.push({
            name: name,
            code: code,
            version: version || "1.0",
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    } else {
        // Update
        data.scripts[idx].code = code;
        data.scripts[idx].version = version || "1.1";
        data.scripts[idx].updatedAt = Date.now();
    }
    
    data.stats.lastUpdate = Date.now();
    addLog(data, "UPDATE SCRIPT", "BOT", name);
    saveDB(data);
    
    res.json({ success: true, message: "Script updated" });
});

// ============ API: LIST SCRIPT ============
app.get("/api/list", (req, res) => {
    const data = loadDB();
    res.json({
        success: true,
        scripts: data.scripts.map(s => ({
            name: s.name,
            version: s.version,
            updatedAt: s.updatedAt
        }))
    });
});

// ============ API: UNBLOCK IP ============
app.post("/api/unblock", (req, res) => {
    const { ip, apiKey } = req.body;
    
    if (apiKey !== OWNER_KEY) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    const data = loadDB();
    
    if (data.blockedIPs[ip]) {
        delete data.blockedIPs[ip];
        addLog(data, "UNBLOCK", ip, "Owner unlock");
        saveDB(data);
        return res.json({ success: true, message: "IP unlocked" });
    }
    
    res.json({ success: false, message: "IP gak diblokir" });
});

// ============ API: LIST BLOCKED IP ============
app.get("/api/blocked", (req, res) => {
    const apiKey = req.query.apiKey;
    
    if (apiKey !== OWNER_KEY) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    const data = loadDB();
    res.json({ success: true, blocked: data.blockedIPs });
});

// ============ LOGOUT ============
app.get("/logout", (req, res) => {
    const session = req.query.session;
    const data = loadDB();
    if (data.sessions[session]) {
        delete data.sessions[session];
        saveDB(data);
    }
    res.redirect("/");
});

// ============ START SERVER ============
app.listen(PORT, "0.0.0.0", () => {
    console.log("========================================");
    console.log("🌌 GC SCRIPT HUB - WEB SERVER");
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🔑 Owner Key: ${OWNER_KEY.substring(0, 4)}****`);
    console.log("========================================");
});
