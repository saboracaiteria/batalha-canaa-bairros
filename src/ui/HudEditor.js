/**
 * HUD Editor - Sistema de customização de interface
 * Permite arrastar e posicionar todos os elementos do HUD
 */

// Global state for main.js to check
window.isEditingHud = false;

// Dragging State
let currentDraggable = null;
let startX = 0, startY = 0;
let initialLeft = 0, initialTop = 0;

export function initHudEditor() {
    console.log('🎨 HUD Editor inicializado');
    setupGlobalDragListeners();
}

/**
 * Sets up global listeners once to avoid duplication/leaks
 */
function setupGlobalDragListeners() {
    // Mouse Move
    document.addEventListener('mousemove', (e) => {
        if (!window.isEditingHud || !currentDraggable) return;
        e.preventDefault();
        handleDragMove(e.clientX, e.clientY);
    });

    // Mouse Up
    document.addEventListener('mouseup', () => {
        if (currentDraggable) {
            currentDraggable.style.cursor = 'grab';
            currentDraggable = null;
        }
    });

    // Touch Move
    document.addEventListener('touchmove', (e) => {
        if (!window.isEditingHud || !currentDraggable) return;
        // Prevent scrolling while dragging HUD elements, but allow if not dragging
        if (e.cancelable) e.preventDefault();
        const t = e.touches[0];
        handleDragMove(t.clientX, t.clientY);
    }, { passive: false });

    // Touch End
    document.addEventListener('touchend', () => {
        if (currentDraggable) {
            currentDraggable = null;
        }
    });
}

function handleDragMove(clientX, clientY) {
    const dx = clientX - startX;
    const dy = clientY - startY;

    currentDraggable.style.left = (initialLeft + dx) + 'px';
    currentDraggable.style.top = (initialTop + dy) + 'px';
    currentDraggable.style.bottom = 'auto';
    currentDraggable.style.right = 'auto';
}

function startDrag(element, clientX, clientY) {
    if (!window.isEditingHud) return;

    currentDraggable = element;
    startX = clientX;
    startY = clientY;

    const rect = element.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    element.style.cursor = 'grabbing';
}

export function openHudEditor() {
    window.isPaused = true;
    window.isEditingHud = true;

    // Show HUD if not visible
    const storedStartDisplay = document.getElementById('start-screen').style.display;
    if (document.getElementById('hud').style.display === 'none') {
        document.getElementById('hud').style.display = 'block';
        document.getElementById('start-screen').style.display = 'none';
        window._wasStartScreen = true;
    }

    // Hide Pause Menu explicitly to prevent overlap
    const pm = document.getElementById('pause-menu');
    if (pm) pm.style.display = 'none';

    // Create editor overlay (Save button)
    const editor = document.createElement('div');
    editor.id = 'hud-editor';
    editor.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000;
        pointer-events: none;
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
            pointer-events: auto;
            box-shadow: 0 0 10px #00ff00;
            font-family: inherit;
            text-transform: uppercase;
        ">💾 SALVAR & SAIR</button>
    `;

    document.body.appendChild(editor);

    // Prepare HUD elements
    const hudEls = document.querySelectorAll('.hud-el');
    hudEls.forEach(el => {
        el.style.border = '2px dashed #00ff00';
        el.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        el.style.pointerEvents = 'auto';
        el.style.zIndex = '10001';
        el.style.position = 'absolute';
        el.style.cursor = 'grab';

        // Attach local start listeners (Idempotent-ish if we remove them? No, better to just leave them or use a flag)
        // Since we re-run this function, we should ideally check if listener is attached. 
        // A simpler way: Remove old listener first (not easy with anonymous funcs) 
        // OR: Just assign onclick/ontouchstart properties directly (simpler but hacky)
        // OR: Use a custom prop to check.

        // CLEANER: Let's just use the global document listener approach but we need to know WHICH element was clicked.
        // We can add the 'mousedown'/'touchstart' here.

        el.onmousedown = (e) => {
            e.stopPropagation();
            startDrag(el, e.clientX, e.clientY);
        };

        el.ontouchstart = (e) => {
            if (window.isEditingHud) e.stopPropagation(); // Stop propagation only in edit mode
            // Don't prevent default here to allow clicking buttons in normal mode? 
            // Actually in edit mode we might want to prevent default button action.
            if (window.isEditingHud) {
                if (e.cancelable) e.preventDefault();
                startDrag(el, e.touches[0].clientX, e.touches[0].clientY);
            }
        };
    });

    // Save button logic
    const saveBtn = document.getElementById('save-hud-btn');
    saveBtn.onclick = () => {
        saveHudLayout();
        closeHudEditor();
    };

    // Mobile tap on save button
    saveBtn.ontouchend = (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveHudLayout();
        closeHudEditor();
    };
}

function closeHudEditor() {
    const editor = document.getElementById('hud-editor');
    if (editor) editor.remove();

    // Reset state
    window.isEditingHud = false;
    window.isPaused = false;

    // Reset styles
    document.querySelectorAll('.hud-el').forEach(el => {
        el.style.border = 'none';
        el.style.backgroundColor = 'transparent';
        el.style.cursor = 'default';
        el.onmousedown = null; // Remove listeners? Ideally yes, or use flag in listener (which we do)
    });

    console.log('🎨 Editor fechado');
}

function saveHudLayout() {
    const layout = {};
    const hudEls = document.querySelectorAll('.hud-el');

    hudEls.forEach(el => {
        // Reset transform if any (joystick knob) before saving position? 
        // Actually we save relative to viewport usually, or getBoundingClientRect
        const rect = el.getBoundingClientRect();
        layout[el.id] = {
            left: rect.left,
            top: rect.top
        };
    });

    localStorage.setItem('hud-layout', JSON.stringify(layout));
    console.log('✅ Layout do HUD salvo!', layout);
}

export function loadHudLayout() {
    const saved = localStorage.getItem('hud-layout');
    if (!saved) return;

    try {
        const layout = JSON.parse(saved);
        Object.keys(layout).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.position = 'absolute'; // Ensure absolute
                el.style.left = layout[id].left + 'px';
                el.style.top = layout[id].top + 'px';
                el.style.bottom = 'auto';
                el.style.right = 'auto';
            }
        });
    } catch (e) {
        console.error("Erro ao carregar layout HUD:", e);
    }
}




// Global function
window.openHudEditor = openHudEditor;
window.loadHudLayout = loadHudLayout;
