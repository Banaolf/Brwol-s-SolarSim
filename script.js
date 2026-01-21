import * as THREE from 'three';

// --- CONFIG & CONSTANTS ---
const AU_SIZE = 200; // 1 Grid Square = 1 AU
let G = 500; 
let SUN_MASS = 1000;
let MAX_PLANETS = 12;
const SUB_STEPS = 100; // High sub-stepping for maximum stability
let CRASH_DISTANCE = 18; 
let DESPAWN_DISTANCE = 5000;
const VERSION = "B.0.8.2";

// --- NEW CONFIGS ---
let SHOW_ATMOSPHERES = true;
let SHOW_CLOUDS = true;
let SHOW_STARS = true;
let ORBIT_COLOR = '#ffffff';


const KEYS = {
    SPAWN: '1',
    TIME_UP: '+',
    TIME_DOWN: '-',
    CONFIG: 'o',
    PLACEMENT: 'p',
    DELETE: 'Delete',
    CHANGELOG: 'c',
    RESET: 'r'
};

const timeSteps = [1920, 3600, 14400, 43200, 86400, 259200, 604800, 1209600, 2592000, 7776000, 15552000, 31536000];
let currentTimeStepIndex = 4; // Starts at 1 Day/s
let timeMultiplier = 1; // Will be calculated dynamically

const nameBank = ["Aether", "Alcor", "Amalthea", "Ananke", "Anthe", "Ariel", "Atlas", "Belinda", "Bianca", "Callisto", "Calypso", "Carme", "Ceres", "Charon", "Cordelia", "Cressida", "Cybele", "Daphnis", "Deimos", "Despina", "Dione", "Eris", "Elara", "Enceladus", "Epimetheus", "Erinome", "Euanthe", "Eukelade", "Europa", "Eurydome", "Fenrir", "Fornjot", "Galatea", "Ganymede", "Greip", "Harpalyke", "Haumea", "Helene", "Himalia", "Hyperion", "Iapetus", "Iocaste", "Io", "Ison", "Janus", "Juliet", "Kale", "Kalyke", "Kiviuq", "Larissa", "Leda", "Lysithea", "Makemake", "Metis", "Mimas", "Mira", "Miranda", "Naiad", "Narvi", "Nereid", "Oberon", "Ophelia", "Orthosie", "Pandora", "Pasiphae", "Pax", "Phobos", "Phoebe", "Portia", "Prometheus", "Proteus", "Puck", "Rhea", "Sinope", "Styx", "Tarvos", "Telesto", "Tethys", "Thalassa", "Thebe", "Titan"];

// --- PHYSICAL CONSTANTS & DATA ---
const EARTH_RADIUS_KM = 6371;
const EARTH_MASS_KG = 5.972e24;
const JUPITER_RADIUS_KM = 69911;
const SUN_RADIUS_KM = 696340;
const SUN_LUMINOSITY_W = 3.828e26;
const DENSITY_ROCKY_KGM3 = 5514;
const DENSITY_GAS_KGM3 = 1326;
const STEFAN_BOLTZMANN = 5.67e-8;

const CHANGELOG_DATA = [
    { ver: "B.0.8.2", notes: ["Camera Focus on Selected Planet", "Atmosphere/Cloud Altitude Sync", "Prevent Browser Zoom (Ctrl+/-)", "Starfield Background", "Config Pagination"] },
    { ver: "B.0.8.1", notes: ["Realistic Atmosphere Shader (Fresnel Glow)", "Fixed Raycast Selection (Grid/Orbit blocking)", "Fixed Cloud Rotation Speed", "Memory Cleanup on Delete"] },
    { ver: "B.0.8-hotfix.b", notes: ["Reverted to Procedural Planet Colors", "Added Procedural Cloud Generation", "Improved Atmosphere Shader (Cyan Glow)"] },
    { ver: "B.0.8-hotfix", notes: ["Fixed Texture 404s (Folder path)", "Fixed Ocean planet selection", "Added missing Sun properties", "Fixed Sun selection crash"] },
    { ver: "B.0.8.0", notes: ["Major UI Redesign", "Realistic Mass/Radius/Luminosity", "Planet Texturing", "Atmospheres & Clouds", "New Config Options (Orbits, FX)"] },
    { ver: "B.0.7.8", notes: ["Realistic Time Warp (32m/s to 1y/s)", "Fixed Distance Display (AU scaling)", "Dynamic Physics Calibration"] },
    { ver: "B.0.7.7-hotfix", notes: ["Fixed invisible orbits bug (Variable collision)", "Patched circular orbit math"] },
    { ver: "B.0.7.7", notes: ["Physics stability overhaul (100 sub-steps)", "Real-time Velocity & Apsides data", "Modular Camera System", "Futuristic UI Polish", "Time Warp units (Min/s, Hr/s)"] },
    { ver: "B.0.7.6", notes: ["Optimized physics engine (Reduced GC)", "Added Changelog (Press C). We are aware that moving down moves the camera, too.", "Code cleanup"] },
    { ver: "B.0.7.5", notes: ["Grid Helper added", "Grid configuration options"] },
    { ver: "B.0.7.4", notes: ["Grid System implementation"] },
    { ver: "B.0.7.3", notes: ["Input focus fix for shortcuts"] },
    { ver: "B.0.7.2", notes: ["Analytical Orbit Solver (Keplerian)", "Delete Outermost Planet (Ctrl+Del)"] },
    { ver: "B.0.7.1", notes: ["Placement Menu (P)", "Keybinds Tab"] },
    { ver: "B.0.7.0", notes: ["Configuration Tab (O)", "White Orbits", "Data Link Stats"] }
];

let planets = [];
let selected = null;

const labelsContainer = document.getElementById('labels-container');
const uiPanel = document.getElementById('planet-ui');
const nameInput = document.getElementById('planetNameDisplay');
const speedInput = document.getElementById('speedDisplay');
const colorPicker = document.getElementById('colorPicker');
let extraStatsContainer = null; // Will be created dynamically

// --- SCENE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 20000);
camera.position.set(0, 600, 900);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.PointLight(0xffffff, 2500, 8000));
scene.add(new THREE.AmbientLight(0x404040, 2.5));

const sun = new THREE.Mesh(new THREE.SphereGeometry(22, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
const sunLabel = createLabel("THE_SUN");
sun.userData.planetData = { name: "THE_SUN", isSun: true, label: sunLabel, mesh: sun, size: 22, pos: new THREE.Vector3(0,0,0), vel: new THREE.Vector3(0,0,0), type: "STAR" };
scene.add(sun);
calculatePhysicalProperties(sun.userData.planetData); // Calculate sun's properties

// --- STARFIELD ---
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for(let i=0; i<6000; i++) starPos.push(THREE.MathUtils.randFloatSpread(10000), THREE.MathUtils.randFloatSpread(10000), THREE.MathUtils.randFloatSpread(10000));
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 1.5}));
scene.add(stars);

// --- GRID HELPER ---
const gridHelper = new THREE.GridHelper(10000, 50, 0xffffff, 0xffffff);
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.15;
scene.add(gridHelper);

// --- UI INITIALIZATION ---
function initUI() {
    // Add Config Hint to Main UI
    const ui = document.getElementById('ui');
    const hint = document.createElement('div');
    hint.className = 'key-hint';
    hint.innerHTML = '<br>[O] CONFIGURATION TAB';
    hint.innerHTML += '<br>[P] PLACEMENT MENU';
    hint.innerHTML += '<br>[C] CHANGELOG';
    ui.appendChild(hint);

    // Config Data Definitions
    const genConfigs = [
        { label: "GRAVITY_CONST (G)", type: "number", id: "cfg-g", value: G },
        { label: "SUN_MASS", type: "number", id: "cfg-mass", value: SUN_MASS },
        { label: "MAX_PLANETS", type: "number", id: "cfg-max", value: MAX_PLANETS },
        { label: "DESPAWN_DIST", type: "number", id: "cfg-despawn", value: DESPAWN_DISTANCE },
        { label: "SHOW_GRID", type: "checkbox", id: "cfg-grid-show", checked: true },
        { label: "SHOW_ATMOSPHERES", type: "checkbox", id: "cfg-fx-atmos", checked: SHOW_ATMOSPHERES },
        { label: "SHOW_CLOUDS", type: "checkbox", id: "cfg-fx-clouds", checked: SHOW_CLOUDS },
        { label: "SHOW_STARS", type: "checkbox", id: "cfg-fx-stars", checked: SHOW_STARS },
        { label: "GRID_COLOR", type: "color", id: "cfg-grid-col", value: "#ffffff" },
        { label: "ORBIT_COLOR", type: "color", id: "cfg-orbit-col", value: ORBIT_COLOR }
    ];

    const keyConfigs = [
        { label: "SPAWN (Ctrl+)", action: "SPAWN" },
        { label: "TIME UP (Ctrl+)", action: "TIME_UP" },
        { label: "TIME DOWN (Ctrl+)", action: "TIME_DOWN" },
        { label: "DELETE (Ctrl+)", action: "DELETE" },
        { label: "CONFIG MENU", action: "CONFIG" },
        { label: "PLACEMENT MENU", action: "PLACEMENT" },
        { label: "CHANGELOG", action: "CHANGELOG" },
        { label: "RESET", action: "RESET" }
    ];

    // Create Config Modal
    const configDiv = document.createElement('div');
    configDiv.id = 'config-ui';
    configDiv.innerHTML = `
        <div class="tab-header">
            <button class="tab-btn active" id="tab-btn-general">GENERAL</button>
            <button class="tab-btn" id="tab-btn-keybinds">KEYBINDS</button>
        </div>
        
        <div id="tab-general" class="tab-content active"></div>
        <div id="tab-keybinds" class="tab-content"></div>

        <div class="pagination-controls">
            <button id="prev-page" class="page-btn"><</button>
            <span id="page-indicator">1/1</span>
            <button id="next-page" class="page-btn">></button>
        </div>

        <div style="text-align:center; margin-top:20px;">
            <button id="cfg-close">APPLY & CLOSE</button>
        </div>
    `;
    document.body.appendChild(configDiv);

    // Create Placement UI
    const placeDiv = document.createElement('div');
    placeDiv.id = 'placement-ui';
    placeDiv.innerHTML = `
        <h3>SPAWN PLANET</h3>
        <button id="spawn-rocky">ROCKY</button>
        <button id="spawn-ocean">OCEAN</button>
        <button id="spawn-gas">GAS GIANT</button>
    `;
    document.body.appendChild(placeDiv);

    // Create Changelog UI
    const logDiv = document.createElement('div');
    logDiv.id = 'changelog-ui';
    logDiv.innerHTML = `<h2 style="text-align:center; margin-top:0; color:white;">SYSTEM_LOG</h2>`;
    CHANGELOG_DATA.forEach(log => {
        logDiv.innerHTML += `
            <div class="log-entry">
                <div class="log-ver">VERSION ${log.ver}</div>
                <ul class="log-list">${log.notes.map(n => `<li>${n}</li>`).join('')}</ul>
            </div>`;
    });
    document.body.appendChild(logDiv);

    // --- EVENT LISTENERS FOR UI ---
    
    // Placement Buttons
    document.getElementById('spawn-rocky').onclick = () => createPlanet('ROCKY');
    document.getElementById('spawn-ocean').onclick = () => createPlanet('OCEAN');
    document.getElementById('spawn-gas').onclick = () => createPlanet('GAS');

    // Tab Switching
    const tabs = { general: document.getElementById('tab-general'), keybinds: document.getElementById('tab-keybinds') };
    const btns = { general: document.getElementById('tab-btn-general'), keybinds: document.getElementById('tab-btn-keybinds') };
    
    function switchTab(t) {
        Object.values(tabs).forEach(el => el.style.display = 'none');
        Object.values(btns).forEach(el => el.classList.remove('active'));
        tabs[t].style.display = 'block';
        btns[t].classList.add('active');
    }
    btns.general.onclick = () => switchTab('general');
    btns.keybinds.onclick = () => switchTab('keybinds');

    // Pagination Logic
    let curGenPage = 0;
    let curKeyPage = 0;
    let activeTab = 'general';

    function renderConfig() {
        const renderItems = (items, page, containerId, isKey) => {
            const start = page * 5;
            const slice = items.slice(start, start + 5);
            let html = '';
            slice.forEach(item => {
                if (isKey) {
                    html += `<div class="config-row"><span>${item.label}</span><button class="bind-btn" data-action="${item.action}">${KEYS[item.action]}</button></div>`;
                } else {
                    let input = `<input type="number" id="${item.id}" value="${item.value}">`;
                    if (item.type === 'checkbox') input = `<input type="checkbox" id="${item.id}" ${item.checked ? 'checked' : ''}>`;
                    else if (item.type === 'color') input = `<input type="color" id="${item.id}" value="${item.value}">`;
                    html += `<div class="config-row"><span>${item.label}</span>${input}</div>`;
                }
            });
            document.getElementById(containerId).innerHTML = html;
        };

        renderItems(genConfigs, curGenPage, 'tab-general', false);
        renderItems(keyConfigs, curKeyPage, 'tab-keybinds', true);

        const total = activeTab === 'general' ? Math.ceil(genConfigs.length/5) : Math.ceil(keyConfigs.length/5);
        const current = activeTab === 'general' ? curGenPage : curKeyPage;
        document.getElementById('page-indicator').textContent = `${current + 1}/${total}`;
        
        // Re-attach keybind listeners
        document.querySelectorAll('.bind-btn').forEach(btn => {
            btn.onclick = () => {
                btn.textContent = "...";
                const action = btn.dataset.action;
                const handler = (e) => {
                    KEYS[action] = e.key;
                    btn.textContent = e.key.toUpperCase();
                    window.removeEventListener('keydown', handler, true);
                    e.stopPropagation(); e.preventDefault();
                };
                window.addEventListener('keydown', handler, { capture: true, once: true });
            };
        });
    }
    
    // Hook into tab switching to update pagination state
    btns.general.addEventListener('click', () => { activeTab = 'general'; renderConfig(); });
    btns.keybinds.addEventListener('click', () => { activeTab = 'keybinds'; renderConfig(); });
    
    document.getElementById('prev-page').onclick = () => {
        if (activeTab === 'general' && curGenPage > 0) curGenPage--;
        if (activeTab === 'keybinds' && curKeyPage > 0) curKeyPage--;
        renderConfig();
    };
    document.getElementById('next-page').onclick = () => {
        if (activeTab === 'general' && curGenPage < Math.ceil(genConfigs.length/5)-1) curGenPage++;
        if (activeTab === 'keybinds' && curKeyPage < Math.ceil(keyConfigs.length/5)-1) curKeyPage++;
        renderConfig();
    };
    
    // Initial Render
    renderConfig();

    // Config Logic
    document.getElementById('cfg-close').onclick = () => {
        // Update values from inputs (if they exist in DOM, otherwise they keep old values)
        // Note: Only visible inputs can be read directly. For a robust system, we'd bind inputs to the array.
        // For now, we assume user sets what they see.
        const getVal = (id, type) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return type === 'checkbox' ? el.checked : (type === 'number' ? parseFloat(el.value) : el.value);
        };

        // We iterate config arrays to save state back
        genConfigs.forEach(c => {
            const val = getVal(c.id, c.type);
            if (val !== null) c.value = c.checked = val; // Update internal state
        });

        // Apply to Globals
        const find = (id) => { const f = genConfigs.find(c => c.id === id); return f.type === 'checkbox' ? f.checked : f.value; };
        
        G = find('cfg-g');
        SUN_MASS = find('cfg-mass');
        MAX_PLANETS = find('cfg-max');
        DESPAWN_DISTANCE = find('cfg-despawn');
        gridHelper.visible = find('cfg-grid-show');
        SHOW_ATMOSPHERES = find('cfg-fx-atmos');
        SHOW_CLOUDS = find('cfg-fx-clouds');
        SHOW_STARS = find('cfg-fx-stars');
        gridHelper.material.color.set(find('cfg-grid-col'));
        ORBIT_COLOR = find('cfg-orbit-col');

        stars.visible = SHOW_STARS;

        // Update existing orbits and sun properties
        planets.forEach(p => p.orbitLine.material.color.set(ORBIT_COLOR));
        calculatePhysicalProperties(sun.userData.planetData);

        updateTimeUI(); // Recalculate physics ratio if G/Mass changed
        document.getElementById('config-ui').style.display = 'none';
    };

    // Create Extra Stats Container in Planet UI
    extraStatsContainer = document.createElement('div');
    extraStatsContainer.id = 'planet-extra-stats';
    extraStatsContainer.style.marginTop = '10px';
    extraStatsContainer.style.fontSize = '0.9em';
    extraStatsContainer.style.color = '#aaa';
    uiPanel.insertBefore(extraStatsContainer, document.getElementById('planet-only-stats'));

    // Polish Speed Input UI
    const speedContainer = document.getElementById('planet-only-stats');
    if (speedContainer) {
        // Inject structure for "VELOCITY [input] m/s"
        const lbl = speedContainer.querySelector('label');
        if(lbl) lbl.textContent = "VELOCITY";
        speedInput.style.width = "70px";
        speedInput.style.textAlign = "right";
        speedInput.insertAdjacentHTML('afterend', '<span style="color:#00f2ff; font-size:0.8em; margin-left:5px;">m/s</span>');
        speedContainer.insertAdjacentHTML('beforeend', '<div id="apsides-info" style="margin-top:8px; font-size:0.8em; color:#888;"></div>');
    }
}
initUI();

// --- SHADERS ---
const ATMOSPHERE_VERTEX_SHADER = `
varying vec3 vNormal;
void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ATMOSPHERE_FRAGMENT_SHADER = `
varying vec3 vNormal;
void main() {
    float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
    gl_FragColor = vec4(0.1, 0.9, 1.0, 1.0) * intensity * 1.5;
}
`;

// --- NEW HELPERS ---
function calculatePhysicalProperties(p) {
    if (p.isSun) {
        p.realRadius = (p.size / 22) * SUN_RADIUS_KM;
        p.realMass = (SUN_MASS / 1000) * 1.989e30; // Scale based on config
        const temp = 5778; // Kelvin
        p.luminosity = 4 * Math.PI * Math.pow(p.realRadius * 1000, 2) * STEFAN_BOLTZMANN * Math.pow(temp, 4);
        return;
    }

    let density = DENSITY_ROCKY_KGM3;
    let baseRadius = EARTH_RADIUS_KM;
    let baseSize = 8;

    if (p.type === 'GAS') {
        density = DENSITY_GAS_KGM3;
        baseRadius = JUPITER_RADIUS_KM;
        baseSize = 20;
    }

    p.realRadius = (p.size / baseSize) * baseRadius;
    p.realMass = (4/3) * Math.PI * Math.pow(p.realRadius * 1000, 3) * density;
}

function formatValue(value, unit) {
    if (value > 1e10) {
        return `${value.toExponential(2)} ${unit}`;
    }
    return `${value.toFixed(0)} ${unit}`;
}

function formatRelativeTo(value, baseValue, name) {
    if (!value || !baseValue) return 'N/A';
    return `${(value / baseValue).toFixed(3)} ${name}`;
}

function createProceduralCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Transparent background
    ctx.clearRect(0, 0, 512, 256);
    
    // Draw random cloud puffs
    for (let i = 0; i < 150; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 256;
        const r = Math.random() * 30 + 10;
        
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
    }
    
    return new THREE.CanvasTexture(canvas);
}

// --- HELPERS ---
function createLabel(text) {
    const div = document.createElement('div');
    div.className = 'planet-label';
    div.textContent = text;
    labelsContainer.appendChild(div);
    return div;
}
function getSimToRealRatio() {
    // Calculate period of 1 AU orbit in simulation seconds
    const simPeriod = 2 * Math.PI * Math.sqrt(Math.pow(AU_SIZE, 3) / (G * SUN_MASS));
    // Real Earth Period = 31,536,000 seconds
    return 31536000 / simPeriod;
}

function updateTimeUI() {
    const realSec = timeSteps[currentTimeStepIndex];
    const ratio = getSimToRealRatio();
    timeMultiplier = realSec / ratio; // Convert real seconds to physics multiplier

    const label = document.getElementById('timeLabel');
    if(label) {
        let text = "";
        if (realSec >= 31536000) text = `${(realSec/31536000).toFixed(1)} YEAR/S`;
        else if (realSec >= 2592000) text = `${(realSec/2592000).toFixed(1)} MON/S`;
        else if (realSec >= 604800) text = `${(realSec/604800).toFixed(1)} WEEK/S`;
        else if (realSec >= 86400) text = `${(realSec/86400).toFixed(1)} DAY/S`;
        else if (realSec >= 3600) text = `${(realSec/3600).toFixed(1)} HR/S`;
        else text = `${(realSec/60).toFixed(1)} MIN/S`;
        
        label.textContent = `WARP: ${text}`;
    }
}

function deleteOutermostPlanet() {
    if (planets.length === 0) return;
    let maxDist = -1;
    let targetIndex = -1;
    
    planets.forEach((p, index) => {
        const dist = p.pos.length();
        if (dist > maxDist) {
            maxDist = dist;
            targetIndex = index;
        }
    });

    if (targetIndex !== -1) {
        const p = planets[targetIndex];
        scene.remove(p.mesh);
        // Clean up memory
        p.mesh.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        scene.remove(p.orbitLine);
        p.orbitLine.geometry.dispose();
        p.label.remove();
        planets.splice(targetIndex, 1);
        if (selected === p) {
            selected = null;
            uiPanel.style.display = 'none';
        }
    }
}

// Polished Orbit: Uses semi-major axis for accurate period calculation
function updateOrbitLine(p) {
    const rVec = p.pos.clone();
    const vVec = p.vel.clone();
    const mu = G * SUN_MASS;
    
    // Orbital Elements (Keplerian)
    const h = new THREE.Vector3().crossVectors(rVec, vVec); // Angular momentum
    const eVec = new THREE.Vector3().crossVectors(vVec, h).divideScalar(mu).sub(rVec.clone().normalize()); // Eccentricity vector
    const e = eVec.length();
    let apsidesInfo = { tPe: 0, tAp: 0, period: 0 };
    
    const points = [];

    if (e < 0.99) {
        // Elliptical Orbit (Analytical Solution)
        const specificEnergy = vVec.lengthSq() / 2 - mu / rVec.length();
        const a = -mu / (2 * specificEnergy); // Semi-major axis
        const p_param = a * (1 - e * e); // Semi-latus rectum
        const period = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);

        // Time to Apsides Calculation
        const r = rVec.length();
        const dot = rVec.dot(vVec);
        const nu = (e > 1e-4) ? Math.acos(Math.max(-1, Math.min(1, eVec.dot(rVec) / (e * r)))) : 0;
        const trueAnomaly = (dot >= 0) ? nu : (2 * Math.PI - nu);
        
        const E = 2 * Math.atan(Math.sqrt((1-e)/(1+e)) * Math.tan(trueAnomaly/2));
        const M = E - e * Math.sin(E); // Mean Anomaly
        const n = Math.sqrt(mu / Math.pow(a, 3)); // Mean Motion
        const tSincePe = M / n;
        
        apsidesInfo = { tPe: period - tSincePe, tAp: (period * 1.5 - tSincePe) % period, period: period };
        
        // Basis Vectors
        const orbitNormal = new THREE.Vector3().copy(h).normalize(); // Orbit Normal
        let u = new THREE.Vector3(); // Periapsis direction
        if (e > 0.01) {
            u.copy(eVec).normalize();
        } else {
            u.copy(rVec).normalize(); // Circular fallback
        }
        const w = new THREE.Vector3().crossVectors(orbitNormal, u);
        
        const segments = 128;
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * 2 * Math.PI;
            const rDist = p_param / (1 + e * Math.cos(theta));
            
            const pt = new THREE.Vector3()
                .addScaledVector(u, rDist * Math.cos(theta))
                .addScaledVector(w, rDist * Math.sin(theta));
            points.push(pt);
        }
    } else {
        // Hyperbolic/Parabolic (Escape Trajectory) - Use numerical prediction
        let tempPos = rVec.clone();
        let tempVel = vVec.clone();
        const simStep = 1; 
        
        for (let i = 0; i < 300; i++) {
            const r2 = tempPos.lengthSq();
            if (r2 < CRASH_DISTANCE * CRASH_DISTANCE) break;
            
            const dist = Math.sqrt(r2);
            const accFactor = -mu / (r2 * dist);
            
            tempVel.addScaledVector(tempPos, accFactor * simStep);
            tempPos.addScaledVector(tempVel, simStep);
            points.push(tempPos.clone());
            if (tempPos.length() > DESPAWN_DISTANCE) break;
        }
    }
    
    p.orbitLine.geometry.dispose();
    p.orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
    p.orbitalData = apsidesInfo;
}

function createPlanet(typeOverride = null) {
    if (planets.length >= MAX_PLANETS) return;
    
    const lastDist = planets.length > 0 ? planets[planets.length-1].pos.length() : 180;
    const distance = lastDist + 120;
    const pos = new THREE.Vector3(distance, 0, 0);
    const vMag = Math.sqrt((G * SUN_MASS) / distance);
    const vel = new THREE.Vector3(0, 0, vMag); 

    // --- PLANET TYPES ---
    let type, color, size;
    
    if (typeOverride) {
        type = typeOverride;
        if (type === "ROCKY") { const grey = 0.5 + Math.random() * 0.3; color = new THREE.Color(grey, grey, grey); size = 6 + Math.random() * 3; }
        else if (type === "OCEAN") { color = new THREE.Color(0, 0.4 + Math.random() * 0.4, 0.8 + Math.random() * 0.2); size = 7 + Math.random() * 3; }
        else if (type === "GAS") { color = new THREE.Color(Math.random(), Math.random(), Math.random()); size = 16 + Math.random() * 6; }
    } else {
        const roll = Math.random();
        if (roll < 0.4) {
            type = "ROCKY"; const grey = 0.5 + Math.random() * 0.3; color = new THREE.Color(grey, grey, grey); size = 6 + Math.random() * 3;
        } else if (roll < 0.7) {
            type = "OCEAN"; color = new THREE.Color(0, 0.4 + Math.random() * 0.4, 0.8 + Math.random() * 0.2); size = 7 + Math.random() * 3;
        } else {
            type = "GAS"; color = new THREE.Color(Math.random(), Math.random(), Math.random()); size = 16 + Math.random() * 6;
        }
    }

    const orbitMat = new THREE.LineBasicMaterial({ color: ORBIT_COLOR, transparent: true, opacity: 0.25 });
    const orbitLine = new THREE.Line(new THREE.BufferGeometry(), orbitMat);
    scene.add(orbitLine);

    // --- MATERIAL & TEXTURING ---
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.8
    });

    const pData = {
        name: `${nameBank[Math.floor(Math.random() * nameBank.length)].toUpperCase()}`,
        pos, vel, orbitLine, type, size,
        mesh: new THREE.Mesh(new THREE.SphereGeometry(size, 32, 32), material),
        label: null
    };
    
    // --- ATMOSPHERE & CLOUDS ---
    if (type === 'OCEAN') {
        if (SHOW_ATMOSPHERES) {
            const atmGeo = new THREE.SphereGeometry(size * 1.04, 32, 32); // Lowered to match clouds
            const atmMat = new THREE.ShaderMaterial({
                vertexShader: ATMOSPHERE_VERTEX_SHADER,
                fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
                blending: THREE.AdditiveBlending,
                side: THREE.FrontSide,
                transparent: true,
                depthWrite: false
            });
            const atmMesh = new THREE.Mesh(atmGeo, atmMat);
            pData.mesh.add(atmMesh);
        }
        if (SHOW_CLOUDS) {
            const cloudGeo = new THREE.SphereGeometry(size * 1.03, 32, 32);
            const cloudMap = createProceduralCloudTexture();
            const cloudMat = new THREE.MeshStandardMaterial({ map: cloudMap, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
            pData.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
            pData.mesh.add(pData.cloudMesh);
        }
    }

    calculatePhysicalProperties(pData);
    pData.label = createLabel(pData.name);
    pData.mesh.userData.planetData = pData;
    scene.add(pData.mesh);
    planets.push(pData);
    updateOrbitLine(pData);
}

// --- CONTROLS ---
const CameraManager = {
    theta: Math.PI/4,
    phi: Math.PI/4,
    radius: 1000,
    isRightClick: false,
    
    update: function() {
        const target = selected ? selected.pos : new THREE.Vector3(0,0,0);
        camera.position.set(
            target.x + this.radius * Math.sin(this.phi) * Math.cos(this.theta),
            target.y + this.radius * Math.cos(this.phi),
            target.z + this.radius * Math.sin(this.phi) * Math.sin(this.theta)
        );
        camera.lookAt(target);
    }
};

// ZOOM FEATURE
window.addEventListener('wheel', (e) => {
    CameraManager.radius = Math.max(100, Math.min(6000, CameraManager.radius + e.deltaY * 0.5));
});

window.addEventListener('keydown', (e) => {
    // Prevent browser zoom (Ctrl + / -)
    if (e.ctrlKey && (e.key === '=' || e.key === '-' || e.key === '+' || e.key === '_')) {
        e.preventDefault();
    }

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key.toLowerCase() === KEYS.CONFIG.toLowerCase()) {
        const cfg = document.getElementById('config-ui');
        cfg.style.display = (cfg.style.display === 'none' || cfg.style.display === '') ? 'block' : 'none';
    }
    
    if (e.key.toLowerCase() === KEYS.PLACEMENT.toLowerCase()) {
        const pl = document.getElementById('placement-ui');
        pl.style.display = (pl.style.display === 'none' || pl.style.display === '') ? 'block' : 'none';
    }

    if (e.key.toLowerCase() === KEYS.CHANGELOG.toLowerCase()) {
        const cl = document.getElementById('changelog-ui');
        cl.style.display = (cl.style.display === 'none' || cl.style.display === '') ? 'block' : 'none';
    }

    if (!e.ctrlKey) return;
    if (e.key === KEYS.SPAWN) { e.preventDefault(); createPlanet(); }
    if (e.key === KEYS.DELETE) { e.preventDefault(); deleteOutermostPlanet(); }
    if (e.key === KEYS.TIME_UP) { e.preventDefault(); if (currentTimeStepIndex < timeSteps.length - 1) { currentTimeStepIndex++; updateTimeUI(); } }
    if (e.key === KEYS.TIME_DOWN) { e.preventDefault(); if (currentTimeStepIndex > 0) { currentTimeStepIndex--; updateTimeUI(); } }
});

// Selection & Mouse
window.addEventListener('mousedown', (e) => {
    if (e.button === 2) CameraManager.isRightClick = true;
    if (e.target.closest('#ui') || e.target.closest('#planet-ui')) return;
    
    const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(scene.children, true); // Recursive to hit atmospheres/clouds

    let targetData = null;
    for (let i = 0; i < hits.length; i++) {
        const obj = hits[i].object;
        // Ignore helpers and lines (Grid, Orbits) to prevent blocking
        if (obj.type === 'GridHelper' || obj.type === 'Line') continue;

        if (obj.userData.planetData) { targetData = obj.userData.planetData; break; }
        else if (obj.parent && obj.parent.userData.planetData) { targetData = obj.parent.userData.planetData; break; }
    }

    if (targetData) {
        selected = targetData;
        uiPanel.style.display = 'block';
        nameInput.value = selected.name;
        colorPicker.value = "#" + selected.mesh.material.color.getHexString();
        if (!selected.isSun) {
            document.getElementById('planet-only-stats').style.display = 'block';
            speedInput.value = selected.vel.length().toFixed(2);
        } else {
            document.getElementById('planet-only-stats').style.display = 'none';
        }
    } else if (e.button === 0) {
        uiPanel.style.display = 'none';
        selected = null;
    }
});

window.addEventListener('mouseup', () => CameraManager.isRightClick = false);
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousemove', e => {
    if(CameraManager.isRightClick) {
        CameraManager.theta -= e.movementX * 0.005;
        CameraManager.phi = Math.max(0.1, Math.min(Math.PI/2 - 0.1, CameraManager.phi + e.movementY * 0.005));
    }
});

nameInput.addEventListener('input', (e) => { if(selected) { selected.name = e.target.value.toUpperCase(); selected.label.textContent = selected.name; }});
speedInput.addEventListener('input', (e) => { 
    if(selected && !selected.isSun) {
        const val = parseFloat(e.target.value);
        if(!isNaN(val)) { selected.vel.normalize().multiplyScalar(val); updateOrbitLine(selected); }
    }
});
colorPicker.oninput = (e) => { if(selected) selected.mesh.material.color.set(e.target.value); };
document.getElementById('close-ui').onclick = () => uiPanel.style.display = 'none';

// --- MAIN LOOP ---
let planetUpdateIndex = 0;
let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min((performance.now() - lastTime) / 1000, 0.05);
    lastTime = performance.now();

    const subDt = (deltaTime * timeMultiplier) / SUB_STEPS;

    for (let s = 0; s < SUB_STEPS; s++) {
        for (let i = planets.length - 1; i >= 0; i--) {
            const p = planets[i];
            const rSq = p.pos.lengthSq();
            const r = Math.sqrt(rSq);

            if (r < CRASH_DISTANCE) {
                console.log(`%cCRASH: ${p.name}`, "color: #ff0000");
                scene.remove(p.mesh); scene.remove(p.orbitLine); p.label.remove();
                planets.splice(i, 1); continue;
            }
            if (r > DESPAWN_DISTANCE) {
                console.log(`%cDESPAWN: ${p.name}`, "color: #ffa500");
                scene.remove(p.mesh); scene.remove(p.orbitLine); p.label.remove();
                planets.splice(i, 1); continue;
            }

            const accFactor = -(G * SUN_MASS) / (rSq * r);
            p.vel.addScaledVector(p.pos, accFactor * subDt);
            p.pos.addScaledVector(p.vel, subDt);
        }
    }

    // Update UI Stats if selected
    if (selected) {
        const dist = (selected.pos.length() / AU_SIZE).toFixed(2);
        if (selected.isSun) {
            extraStatsContainer.innerHTML = `
                MASS: ${formatRelativeTo(selected.realMass, 1.989e30, 'Suns')}<br>
                RADIUS: ${formatRelativeTo(selected.realRadius, SUN_RADIUS_KM, 'Suns')}<br>
                LUMINOSITY: ${formatRelativeTo(selected.luminosity, SUN_LUMINOSITY_W, 'Suns')}
            `;
        } else {
            extraStatsContainer.innerHTML = `
                TYPE: ${selected.type}<br>
                DIST: ${dist} AU<br>
                <br>
                ---PHYSICAL---<br>
                MASS: ${formatRelativeTo(selected.realMass, EARTH_MASS_KG, 'Earths')}<br>
                RADIUS: ${formatRelativeTo(selected.realRadius, EARTH_RADIUS_KM, 'Earths')}
            `;
        }
        
        // Update Velocity Input (Real-time)
        if (document.activeElement !== speedInput) {
            speedInput.value = selected.vel.length().toFixed(2);
        }

        // Update Apsides Info
        const apsDiv = document.getElementById('apsides-info');
        if (apsDiv && selected.orbitalData) {
            apsDiv.innerHTML = `T-PE: ${selected.orbitalData.tPe.toFixed(0)}s<br>T-AP: ${selected.orbitalData.tAp.toFixed(0)}s`;
        }
    } else {
        extraStatsContainer.innerHTML = "";
    }

    CameraManager.update();

    const sunV = new THREE.Vector3(0,0,0).project(camera);
    sunLabel.style.left = `${(sunV.x * 0.5 + 0.5) * window.innerWidth}px`;
    sunLabel.style.top = `${(sunV.y * -0.5 + 0.5) * window.innerHeight - 40}px`;

    planets.forEach(p => {
        p.mesh.position.copy(p.pos);

        // Cloud rotation
        if (p.cloudMesh) {
            // Clamp rotation speed to avoid strobing at high time warps
            p.cloudMesh.rotation.y += Math.min(0.02, 0.0005 * timeMultiplier);
        }
        
        // Always update selected, round-robin update others (3 per frame for smoothness)
        if (selected === p) {
            updateOrbitLine(p);
        }
        
        const v = p.pos.clone().project(camera);
        p.label.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
        p.label.style.top = `${(v.y * -0.5 + 0.5) * window.innerHeight - 40}px`;
        p.label.style.display = (v.z > 1) ? 'none' : 'block';
    });

    // Round-robin orbit update
    for(let k=0; k<3; k++) {
        if(planets.length > 0) {
            planetUpdateIndex = (planetUpdateIndex + 1) % planets.length;
            if(planets[planetUpdateIndex] !== selected) updateOrbitLine(planets[planetUpdateIndex]);
        }
    }

    renderer.render(scene, camera);
}

document.getElementById('version-tag').textContent = `VERSION: ${VERSION}`;
animate();
for(let i=0; i<3; i++) createPlanet();
updateTimeUI();