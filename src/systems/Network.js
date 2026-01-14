
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, set, update, onValue, remove, serverTimestamp, push, onChildAdded, onDisconnect } from "firebase/database";
import * as THREE from 'three';
import { CharacterFactory } from '../entities/CharacterFactory.js';

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
        this.game = game;
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getDatabase(this.app);
        this.currentUser = null;
        this.isLeader = false;
        this.isMultiplayer = false;
        this.otherPlayers = {}; // Map of uid -> Mesh
        this.roomName = "room_canaa";
        this.teamId = 1;

        this.refs = {
            players: null,
            nades: null,
            bots: null,
            registry: null,
            myDoc: null
        };
    }

    async connect() {
        console.log('🌐 Connecting to Firebase...');
        try {
            await signInAnonymously(this.auth);
            return new Promise((resolve) => {
                onAuthStateChanged(this.auth, (user) => {
                    if (user) {
                        this.currentUser = user;
                        console.log('✅ Connected as:', user.uid);
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
                        resolve(true);
                    }
                });
            });
        } catch (e) {
            console.error('❌ Firebase Connection Error:', e);
            alert('Erro de Conexão: ' + e.message);
            return false;
        }
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
            x: this.game.player.position.x,
            y: this.game.player.position.y,
            z: this.game.player.position.z,
            ry: this.game.cameraYaw,
            hp: this.game.health,
            kills: this.game.playerKills,
            status: 'playing',
            lastUpdate: serverTimestamp(),
            joinedAt: Date.now()
        };

        update(this.refs.myDoc, playerData);
        onDisconnect(this.refs.myDoc).remove();

        // 2. Start Listeners
        this.listenToPlayers();
        this.listenToBots();
        this.listenToGrenades();
    }

    listenToPlayers() {
        onValue(this.refs.players, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // Leader Election
            const sortedKeys = Object.keys(data).sort((a, b) => (data[a].joinedAt || 0) - (data[b].joinedAt || 0));
            const wasLeader = this.isLeader;
            this.isLeader = (sortedKeys[0] === this.currentUser.uid);

            if (this.isLeader && !wasLeader) {
                console.log('👑 You are now the Match Leader');
                this.takeCommand();
            }

            // Update UI/HUD
            this.updateLeaderboard(data);

            // Sync Remote Players
            const now = Date.now();
            Object.keys(data).forEach(id => {
                if (id === this.currentUser.uid) return;
                const p = data[id];

                // Cleanup old players (5s timeout)
                if (p.status === 'playing' && p.lastUpdate && (now - p.lastUpdate < 8000)) {
                    this.updateRemotePlayer(id, p);
                } else {
                    this.removeRemotePlayer(id);
                }
            });

            // Cleanup removed players
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
        });
    }

    updateRemotePlayer(id, data) {
        if (!this.otherPlayers[id]) {
            // Create new player mesh
            const color = (data.team === this.teamId) ? 0x00f3ff : 0xff0000;
            const mesh = CharacterFactory.createHumanoid(color, id, 'player');
            mesh.userData.team = data.team;
            this.game.scene.add(mesh);
            this.otherPlayers[id] = mesh;
        }

        const mesh = this.otherPlayers[id];
        // Lerp position for smoothness
        const targetPos = new THREE.Vector3(data.x, data.y, data.z);
        mesh.position.lerp(targetPos, 0.3);

        // Fix rotation (Backup said + PI)
        mesh.rotation.y = data.ry + Math.PI;

        // Update Animation (Simple)
        const isMoving = mesh.position.distanceTo(targetPos) > 0.1;
        // You might need to call animateLimbs here if accessible
        CharacterFactory.animateLimbs(mesh, 0.016, isMoving);
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
            this.game.spawnRemoteGrenade(d);
        });
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
                        isAlly: b.userData.isAlly,
                        name: b.userData.name
                    };
                });
                set(this.refs.bots, botData).catch(() => { });
            }
        }
    }

    updateLeaderboard(data) {
        const lbContent = document.getElementById('lb-content');
        if (!lbContent) return;

        const allPlayers = Object.values(data);
        allPlayers.sort((a, b) => (b.kills || 0) - (a.kills || 0));

        lbContent.innerHTML = "";
        allPlayers.forEach(p => {
            const row = document.createElement('div');
            row.className = 'lb-row';
            // Safe name substring
            const safeName = (p.name || "Anon").substring(0, 8);
            row.innerHTML = `<span>${safeName}</span><span style="color: var(--ui-primary)">${p.kills || 0}</span>`;
            lbContent.appendChild(row);
        });
    }
}
