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
    // Check removed: Allow editing anytime
    // if (!window.isPlaying) ...

    window.isPaused = true;
    isEditingHud = true;

    // Show HUD if not visible (e.g. from Start Screen)
    const storedStartDisplay = document.getElementById('start-screen').style.display;
    if (document.getElementById('hud').style.display === 'none') {
        document.getElementById('hud').style.display = 'block';
        document.getElementById('start-screen').style.display = 'none';
        // Store state to restore later
        window._wasStartScreen = true;
    }

    // Create editor overlay (Transparent, just for the button)
    const editor = document.createElement('div');
    editor.id = 'hud-editor';
    editor.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000;
        pointer-events: none; /* Let clicks pass through to HUD elements */
    `;

    editor.innerHTML = `
        <button id="save-hud-btn" style="
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 30px;
            font-size: 16px;
            background: #00ff00;
            color: #000;
            border: 2px solid #fff;
            border-radius: 20px;
            font-weight: bold;
            cursor: pointer;
            pointer-events: auto; /* Enable clicking on this button */
            box-shadow: 0 0 10px #00ff00;
            font-family: inherit;
            text-transform: uppercase;
        ">💾 SALVAR & SAIR</button>
    `;

    document.body.appendChild(editor);

    // Make all HUD elements draggable
    const hudEls = document.querySelectorAll('.hud-el');
    hudEls.forEach(el => {
        el.style.border = '2px dashed #00ff00'; // Green dashed border
        el.style.backgroundColor = 'rgba(0, 255, 0, 0.2)'; // Slight highlight
        el.style.pointerEvents = 'auto';
        el.style.zIndex = '10001';
        el.style.position = 'absolute';
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

    // MOUSE EVENTS
    element.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);

    // TOUCH EVENTS (Mobile)
    element.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault(); // Prevent scroll
        startDrag(e.touches[0]);
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (isDragging && e.cancelable) e.preventDefault();
        moveDrag(e.touches[0]);
    }, { passive: false });

    document.addEventListener('touchend', endDrag);

    function startDrag(e) {
        if (!isEditingHud) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        element.style.cursor = 'grabbing';
    }

    function moveDrag(e) {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        element.style.left = (initialLeft + dx) + 'px';
        element.style.top = (initialTop + dy) + 'px';
        element.style.bottom = 'auto'; // Clear bottom/right to rely on top/left
        element.style.right = 'auto';
    }

    function endDrag() {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'grab';
        }
    }

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
        el.style.border = '';
        el.style.cursor = '';
        el.style.zIndex = ''; // Reset z-index
    });

    // Restore screens if we were on start screen
    if (window._wasStartScreen) {
        document.getElementById('hud').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
        window._wasStartScreen = false;
    }
}

// Global function
window.openHudEditor = openHudEditor;
window.loadHudLayout = loadHudLayout;
