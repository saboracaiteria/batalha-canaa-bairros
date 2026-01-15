
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, remove, serverTimestamp, push, onChildAdded, onDisconnect } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// 🔧 FIREBASE CONFIG (Canãã)
const firebaseConfig = {
    apiKey: "AIzaSyAF7cOVw5tCc5aNKRev8r2BHvhfNlfhvNE",
    authDomain: "residencial-canaa.firebaseapp.com",
    projectId: "residencial-canaa",
    databaseURL: "https://residencial-canaa-default-rtdb.firebaseio.com/",
    storageBucket: "residencial-canaa.firebasestorage.app",
    messagingSenderId: "885073733262",
    appId: "1:885073733262:web:84e6bc69d0df3918b7cbdf",
    measurementId: "G-GC3PF7ZZPB"
};

const APP_ID = "residencial-canaa-tactical";

export class Network {
    constructor(game) {
        this.game = game; // Reference to Main Game structure
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getDatabase(this.app);

        this.currentUser = null;
        this.roomName = "room_canaa"; // Default Room
        this.refs = {};
        this.otherPlayers = {}; // Mesh Storage
        this.isLeader = false;
        this.isMultiplayer = false;
        this.teamId = 1;

        // Binds
        this.setupRefs = this.setupRefs.bind(this);
    }

    async connect() {
        console.log('🌐 Connecting to Firebase...');
        alert('TENTANDO CONECTAR...'); // DEBUG MOBILE
        try {
            await signInAnonymously(this.auth);
            return new Promise((resolve) => {
                onAuthStateChanged(this.auth, (user) => {
                    if (user) {
                        this.currentUser = user;
                        console.log('✅ Connected as:', user.uid);
                        alert('CONECTADO! UID: ' + user.uid.substr(0, 4)); // DEBUG MOBILE
                        this.setupRefs();
                        // Presence
                        const presenceRef = ref(this.db, `artifacts/${APP_ID}/public/data/${this.roomName}/${user.uid}`);
                        // Default status
                        update(presenceRef, {
                            name: document.getElementById('player-name').value || "OPERADOR",
                            status: 'lobby',
                            lastUpdate: serverTimestamp()
                        });
                        onDisconnect(presenceRef).remove();

                        // 🟢 KEEP-ALIVE LOOP (Auto Cleanup Prevention)
                        setInterval(() => {
                            if (this.auth.currentUser) update(presenceRef, { lastUpdate: serverTimestamp() }).catch(() => { });
                        }, 5000); // Pulse every 5s

                        resolve(true);
                    }
                });
            });
        } catch (e) {
            console.error('❌ Firebase Connection Error:', e);
            alert('Erro de Conexão: ' + e.message);
            const statusEl = document.getElementById('status-multi-msg');
            if (statusEl) { statusEl.innerText = "ERRO: " + e.message; statusEl.style.color = 'red'; }
            return false;
        }
    }

    // New method to show agents in Lobby
    listenToPublicPresence() {
        const presenceRef = ref(this.db, `artifacts/${APP_ID}/public/data/${this.roomName}`);
        onValue(presenceRef, (snapshot) => {
            const data = snapshot.val();
            const listEl = document.getElementById('room-browser');
            const statusEl = document.getElementById('status-multi-msg');
            const countEl = document.getElementById('active-count');

            if (statusEl) {
                statusEl.innerText = "CONECTADO: AGUARDANDO...";
                statusEl.style.color = '#00ff00';
            }

            if (listEl && data) {
                listEl.innerHTML = ""; // Clear

                // FILTER STALE PLAYERS (Simulated Auto Cleanup)
                // We show all but could filter by time if needed.
                // For now, trusting onDisconnect.
                const activeKeys = Object.keys(data);

                if (countEl) countEl.innerText = activeKeys.length; // Update Count

                activeKeys.forEach(uid => {
                    const p = data[uid];
                    const item = document.createElement('div');
                    item.style.padding = "5px";
                    item.style.borderBottom = "1px solid #333";
                    item.style.fontSize = "12px";
                    item.style.color = "#ccc";
                    item.innerHTML = `👤 <b>${p.name || "Desconhecido"}</b> - ${p.status || "Lobby"}`;
                    listEl.appendChild(item);
                });

                // Enable Join Button if connected
                const btn = document.getElementById('btn-init-multi');
                if (btn) { btn.disabled = false; btn.innerText = "ENTRAR NA OPERAÇÃO"; }
            } else if (listEl) {
                listEl.innerHTML = "<div style='padding:10px; color:#555;'>Nenhum agente detectado.</div>";
                // Enable anyway to be the first
                const btn = document.getElementById('btn-init-multi');
                if (btn) { btn.disabled = false; }
            }
        });
    }

    setupRefs() {
        const root = `artifacts/${APP_ID}/public/data`;
        this.refs.players = ref(this.db, `${root}/${this.roomName}`);
        this.refs.nades = ref(this.db, `${root}/${this.roomName}_nades`);
        this.refs.bots = ref(this.db, `${root}/${this.roomName}_bots`);
        this.refs.registry = ref(this.db, `${root}/room_registry/canaa`);

        if (this.currentUser) {
            this.refs.myDoc = ref(this.db, `${root}/${this.roomName}/${this.currentUser.uid}`);
        }
    }

    startMultiplayer() {
        if (!this.currentUser) return;
        this.isMultiplayer = true;
        this.teamId = parseInt(document.getElementById('team-id').value) || 1;

        console.log('🚀 Starting Multiplayer Sync...');

        // 1. Initial Player Data
        const playerData = {
            name: document.getElementById('player-name').value || "OPERADOR",
            team: this.teamId,
            status: 'playing',
            lastUpdate: serverTimestamp(),
            joinedAt: serverTimestamp() // For Leader Election
        };
        update(this.refs.myDoc, playerData);
        onDisconnect(this.refs.myDoc).remove();

        // 2. Start Listeners
        this.listenToPlayers();
        this.listenToBots();
        this.listenToGrenades();
        this.listenToRegistry();
    }

    listenToPlayers() {
        onValue(this.refs.players, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // Sort by join time (older = leader)
            const sortedKeys = Object.keys(data).sort((a, b) => {
                const ta = data[a].joinedAt || 0;
                const tb = data[b].joinedAt || 0;
                return ta - tb;
            });

            // Leader Logic
            const wasLeader = this.isLeader;
            this.isLeader = (sortedKeys[0] === this.currentUser.uid);

            if (this.isLeader && !wasLeader) {
                console.log("👑 YOU ARE NOW THE LEADER");
                // Leader manages bot lifecycle on disconnect
                onDisconnect(this.refs.bots).remove();
                onDisconnect(this.refs.registry).remove();

                // If no bots, spawn them
                if (this.game.toggleBots) this.game.toggleBots(true); // Assuming main has this
                else if (this.game.setupBotsPeriphery) this.game.setupBotsPeriphery();
            }

            // Sync Other Players
            Object.keys(data).forEach(id => {
                if (id === this.currentUser.uid) return;
                const p = data[id];
                if (p.status === 'playing') {
                    this.updateRemotePlayer(id, p);
                } else {
                    this.removeRemotePlayer(id);
                }
            });

            // Cleanups
            Object.keys(this.otherPlayers).forEach(id => {
                if (!data[id]) this.removeRemotePlayer(id);
            });

            // Online Count
            const onlineCountEl = document.getElementById('online-count-hud');
            if (onlineCountEl) {
                onlineCountEl.classList.remove('hidden');
                const leaderName = data[sortedKeys[0]]?.name || "---";
                onlineCountEl.innerHTML = `ONLINE: ${Object.keys(data).length}<br><span style="color:var(--ui-primary)">LÍDER: ${leaderName}</span>`;
            }

            this.updateLeaderboard(data);
        });
    }

    updateRemotePlayer(id, data) {
        if (!this.otherPlayers[id]) {
            // Create new player mesh
            const color = (data.team === this.teamId) ? 0x00f3ff : 0xff0000;
            // Use global createHumanoid if available, or try access from game (assuming game exports it or it is global)
            // Backup used global createHumanoid.
            // We need to ensure createHumanoid is available!
            // In main.js we see createHumanoid is defined globally or inside module?
            // Checking previous views: createHumanoid is inside main.js module scope. 
            // We need to attach it to 'game' object or export it.
            // Assuming for now user has 'window.createHumanoid' or similar, 
            // OR checks main.js to export it.
            // Wait, main.js imports Network. Network cannot import createHumanoid from main.js (circular).
            // Main.js should pass a factory function to Network constructor!
            // FALLBACK: accessing window.createHumanoid if defined.
            if (window.createHumanoid) {
                const mesh = window.createHumanoid(color, id);
                mesh.userData.team = data.team;
                this.game.scene.add(mesh);
                this.otherPlayers[id] = mesh;
            } else {
                console.error("createHumanoid not found!");
            }
        }

        if (this.otherPlayers[id]) {
            const mesh = this.otherPlayers[id];
            // Lerp position for smoothness
            const targetPos = new THREE.Vector3(data.x, data.y, data.z);
            mesh.position.lerp(targetPos, 0.3);

            // Fix rotation (Backup said + PI)
            mesh.rotation.y = data.ry + Math.PI;

            // Update Animation (Simple)
            // const isMoving = mesh.position.distanceTo(targetPos) > 0.1;
            // if(window.updateCharAnim) window.updateCharAnim(mesh, isMoving, 0, 0); // Assuming updateCharAnim is global too
        }
    }

    removeRemotePlayer(id) {
        if (this.otherPlayers[id]) {
            this.game.scene.remove(this.otherPlayers[id]);
            delete this.otherPlayers[id];
        }
    }

    takeCommand() {
        // Leader handles bots removal on disconnect
        onDisconnect(this.refs.bots).remove();
        onDisconnect(this.refs.registry).remove();
        // If bots aren't spawned, spawn them
        if (this.game.bots.length === 0) {
            this.game.setupBotsPeriphery();
        }
    }

    listenToBots() {
        onValue(this.refs.bots, (snapshot) => {
            if (this.isLeader) return; // Leader sends, doesn't receive

            const data = snapshot.val();
            if (!data) {
                // Clear bots if server empty
                this.game.clearBots();
                return;
            }

            // Sync Bots from Leader
            Object.keys(data).forEach(id => {
                this.game.syncBot(id, data[id]);
            });

            // Remove extras
            this.game.cleanupBots(Object.keys(data));
        });
    }

    listenToGrenades() {
        onChildAdded(this.refs.nades, (snapshot) => {
            const d = snapshot.val();
            if (d.owner === this.currentUser.uid) return; // Ignore own
            if (this.game.spawnRemoteGrenade) this.game.spawnRemoteGrenade(d);
        });
    }

    listenToRegistry() {
        onValue(this.refs.registry, (snap) => {
            const rData = snap.val();
            if (rData && rData.missionStatus === 'complete') {
                if (window.showMsg) window.showMsg("MISSÃO CUMPRIDA", "Líder confirmou eliminação das ameaças.");
            }
        });
    }

    throwGrenade(data) {
        if (!this.currentUser) return;
        const newNadeRef = push(this.refs.nades);
        set(newNadeRef, {
            type: data.type,
            x: data.x, y: data.y, z: data.z,
            vx: data.vx, vy: data.vy, vz: data.vz,
            owner: this.currentUser.uid,
            time: serverTimestamp()
        }).catch(() => { });
    }

    update(deltaTime) {
        if (!this.isMultiplayer || !this.currentUser) return;

        // Sync Self (Every 50ms approx)
        if (Math.random() < 0.3) { // Throttling
            update(this.refs.myDoc, {
                x: this.game.player.position.x,
                y: this.game.player.position.y,
                z: this.game.player.position.z,
                ry: this.game.cameraYaw,
                hp: this.game.health,
                kills: this.game.playerKills,
                lastUpdate: serverTimestamp()
            }).catch(() => { });
        }

        // Host Syncs Bots
        if (this.isLeader) {
            if (Math.random() < 0.2) { // Every ~80ms
                const botData = {};
                this.game.bots.forEach(b => {
                    botData[b.userData.id] = {
                        x: b.position.x,
                        y: b.position.y,
                        z: b.position.z,
                        ry: b.rotation.y,
                        hp: b.userData.hp,
                        maxHP: b.userData.maxHP || 100,
                        isAlly: b.userData.isAlly,
                        name: b.userData.name
                    };
                });
                set(this.refs.bots, botData).catch(() => { });

                // Check Win Condition (Leader Only)
                const enemyCount = this.game.bots.filter(b => !b.userData.isAlly).length;
                if (window.initialBotsSpawned && enemyCount === 0 && this.game.bots.length > 0) {
                    update(this.refs.registry, { missionStatus: 'complete' }).catch(() => { });
                }
            }
        }
    }

    updateLeaderboard(data) {
        const lbContent = document.getElementById('lb-content');
        if (!lbContent) return;
        lbContent.innerHTML = "";
        const all = Object.values(data);
        all.sort((a, b) => (b.kills || 0) - (a.kills || 0));
        all.forEach(p => {
            const row = document.createElement('div');
            row.className = 'lb-row';
            row.innerHTML = `<span>${(p.name || "").substring(0, 8)}</span><span style="color:var(--ui-primary)">${p.kills || 0}</span>`;
            lbContent.appendChild(row);
        });
    }
}
