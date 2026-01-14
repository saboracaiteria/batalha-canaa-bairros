/**
 * HUD Editor - Sistema de customização de interface
 * Permite arrastar e posicionar todos os elementos do HUD
 */

let isEditingHud = false;
let hudElements = [];

export function initHudEditor() {
    console.log('🎨 HUD Editor inicializado');
}

export function openHudEditor() {
    if (!window.isPlaying) {
        alert('Inicie o jogo primeiro!');
        return;
    }

    window.isPaused = true;
    isEditingHud = true;

    // Create editor overlay
    const editor = document.createElement('div');
    editor.id = 'hud-editor';
    editor.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        flex-direction: column;
    `;

    editor.innerHTML = `
        <div style="background: #fcee0a; padding: 15px; text-align: center;">
            <h2 style="margin: 0; color: black;">CUSTOMIZAR INTERFACE (HUD)</h2>
            <p style="margin: 5px 0 0 0; color: black; font-size: 12px;">Arraste os elementos para reposicionar</p>
        </div>
        <div style="flex: 1; position: relative;">
            <button id="save-hud-btn" style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 20px 50px;
                font-size: 20px;
                background: #00ff00;
                border: none;
                border-radius: 8px;
                font-weight: bold;
                cursor: pointer;
                z-index: 10001;
            ">💾 GUARDAR HUD</button>
        </div>
    `;

    document.body.appendChild(editor);

    // Make all HUD elements draggable
    const hudEls = document.querySelectorAll('.hud-el');
    hudEls.forEach(el => {
        el.style.border = '3px dashed #fcee0a';
        el.style.pointerEvents = 'auto';
        makeDraggable(el);
    });

    // Save button
    document.getElementById('save-hud-btn').onclick = () => {
        saveHudLayout();
        closeHudEditor();
    };
}

function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    element.addEventListener('mousedown', (e) => {
        if (!isEditingHud) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        element.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        element.style.left = (initialLeft + dx) + 'px';
        element.style.top = (initialTop + dy) + 'px';
        element.style.bottom = 'auto';
        element.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'grab';
        }
    });

    element.style.cursor = 'grab';
}

function saveHudLayout() {
    const layout = {};
    const hudEls = document.querySelectorAll('.hud-el');

    hudEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        layout[el.id] = {
            left: rect.left,
            top: rect.top
        };
    });

    localStorage.setItem('hud-layout', JSON.stringify(layout));
    console.log('✅ Layout do HUD salvo!', layout);
}

function loadHudLayout() {
    const saved = localStorage.getItem('hud-layout');
    if (!saved) return;

    const layout = JSON.parse(saved);
    Object.keys(layout).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.left = layout[id].left + 'px';
            el.style.top = layout[id].top + 'px';
            el.style.bottom = 'auto';
            el.style.right = 'auto';
        }
    });
}

function closeHudEditor() {
    isEditingHud = false;
    window.isPaused = false;

    const editor = document.getElementById('hud-editor');
    if (editor) editor.remove();

    // Remove drag styling
    const hudEls = document.querySelectorAll('.hud-el');
    hudEls.forEach(el => {
        el.style.border = '2.5px solid rgba(255,255,255,0.5)';
        el.style.cursor = '';
    });
}

// Global function
window.openHudEditor = openHudEditor;
window.loadHudLayout = loadHudLayout;
