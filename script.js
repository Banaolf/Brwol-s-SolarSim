import * as THREE from 'three';

// --- CONFIG & CONSTANTS ---
let G = 500; 
let SUN_MASS = 1000;
let MAX_PLANETS = 12;
const SUB_STEPS = 12; // Increased for better orbit stability
let CRASH_DISTANCE = 18; 
let DESPAWN_DISTANCE = 5000;
const VERSION = "AB.0.7.3";

const KEYS = {
    SPAWN: '1',
    TIME_UP: '+',
    TIME_DOWN: '-',
    CONFIG: 'o',
    PLACEMENT: 'p',
    DELETE: 'Delete'
};

const timeSteps = [1, 2, 5, 10, 20, 30, 40, 50, 60, 80, 100, 150, 200];
let currentTimeStepIndex = 4; 
let timeMultiplier = timeSteps[currentTimeStepIndex];

const nameBank = ["Aether", "Alcor", "Amalthea", "Ananke", "Anthe", "Ariel", "Atlas", "Belinda", "Bianca", "Callisto", "Calypso", "Carme", "Ceres", "Charon", "Cordelia", "Cressida", "Cybele", "Daphnis", "Deimos", "Despina", "Dione", "Eris", "Elara", "Enceladus", "Epimetheus", "Erinome", "Euanthe", "Eukelade", "Europa", "Eurydome", "Fenrir", "Fornjot", "Galatea", "Ganymede", "Greip", "Harpalyke", "Haumea", "Helene", "Himalia", "Hyperion", "Iapetus", "Iocaste", "Io", "Ison", "Janus", "Juliet", "Kale", "Kalyke", "Kiviuq", "Larissa", "Leda", "Lysithea", "Makemake", "Metis", "Mimas", "Mira", "Miranda", "Naiad", "Narvi", "Nereid", "Oberon", "Ophelia", "Orthosie", "Pandora", "Pasiphae", "Pax", "Phobos", "Phoebe", "Portia", "Prometheus", "Proteus", "Puck", "Rhea", "Sinope", "Styx", "Tarvos", "Telesto", "Tethys", "Thalassa", "Thebe", "Titan"];

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
sun.userData.planetData = { name: "THE_SUN", isSun: true, label: sunLabel, mesh: sun };
scene.add(sun);

// --- UI INITIALIZATION ---
function initUI() {
    // Add Config Hint to Main UI
    const ui = document.getElementById('ui');
    const hint = document.createElement('div');
    hint.className = 'key-hint';
    hint.innerHTML = '<br>[O] CONFIGURATION TAB';
    hint.innerHTML += '<br>[P] PLACEMENT MENU';
    ui.appendChild(hint);

    // Create Config Modal
    const configDiv = document.createElement('div');
    configDiv.id = 'config-ui';
    configDiv.innerHTML = `
        <div class="tab-header">
            <button class="tab-btn active" id="tab-btn-general">GENERAL</button>
            <button class="tab-btn" id="tab-btn-keybinds">KEYBINDS</button>
        </div>
        
        <div id="tab-general" class="tab-content active">
            <div class="config-row"><span>GRAVITY_CONST (G)</span><input type="number" id="cfg-g" value="${G}"></div>
            <div class="config-row"><span>SUN_MASS</span><input type="number" id="cfg-mass" value="${SUN_MASS}"></div>
            <div class="config-row"><span>MAX_PLANETS</span><input type="number" id="cfg-max" value="${MAX_PLANETS}"></div>
            <div class="config-row"><span>DESPAWN_DIST</span><input type="number" id="cfg-despawn" value="${DESPAWN_DISTANCE}"></div>
        </div>

        <div id="tab-keybinds" class="tab-content">
            <div class="config-row"><span>SPAWN (Ctrl+)</span><button class="bind-btn" data-action="SPAWN">${KEYS.SPAWN}</button></div>
            <div class="config-row"><span>TIME UP (Ctrl+)</span><button class="bind-btn" data-action="TIME_UP">${KEYS.TIME_UP}</button></div>
            <div class="config-row"><span>TIME DOWN (Ctrl+)</span><button class="bind-btn" data-action="TIME_DOWN">${KEYS.TIME_DOWN}</button></div>
            <div class="config-row"><span>CONFIG MENU</span><button class="bind-btn" data-action="CONFIG">${KEYS.CONFIG}</button></div>
            <div class="config-row"><span>PLACEMENT MENU</span><button class="bind-btn" data-action="PLACEMENT">${KEYS.PLACEMENT}</button></div>
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

    // Config Logic
    document.getElementById('cfg-close').onclick = () => {
        G = parseFloat(document.getElementById('cfg-g').value);
        SUN_MASS = parseFloat(document.getElementById('cfg-mass').value);
        MAX_PLANETS = parseInt(document.getElementById('cfg-max').value);
        DESPAWN_DISTANCE = parseFloat(document.getElementById('cfg-despawn').value);
        document.getElementById('config-ui').style.display = 'none';
    };

    // Keybind Logic
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

    // Create Extra Stats Container in Planet UI
    extraStatsContainer = document.createElement('div');
    extraStatsContainer.id = 'planet-extra-stats';
    extraStatsContainer.style.marginTop = '10px';
    extraStatsContainer.style.fontSize = '0.9em';
    extraStatsContainer.style.color = '#aaa';
    uiPanel.insertBefore(extraStatsContainer, document.getElementById('planet-only-stats'));
}
initUI();

// --- HELPERS ---
function createLabel(text) {
    const div = document.createElement('div');
    div.className = 'planet-label';
    div.textContent = text;
    labelsContainer.appendChild(div);
    return div;
}

function updateTimeUI() {
    timeMultiplier = timeSteps[currentTimeStepIndex];
    const label = document.getElementById('timeLabel');
    if(label) label.textContent = `WARP_FACTOR: ${timeMultiplier}X`;
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
        scene.remove(p.orbitLine);
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
    
    const points = [];

    if (e < 0.99) {
        // Elliptical Orbit (Analytical Solution)
        const specificEnergy = vVec.lengthSq() / 2 - mu / rVec.length();
        const a = -mu / (2 * specificEnergy); // Semi-major axis
        const p_param = a * (1 - e * e); // Semi-latus rectum
        
        // Basis Vectors
        const n = new THREE.Vector3().copy(h).normalize(); // Orbit Normal
        let u = new THREE.Vector3(); // Periapsis direction
        if (e > 0.01) {
            u.copy(eVec).normalize();
        } else {
            u.copy(rVec).normalize(); // Circular fallback
        }
        const w = new THREE.Vector3().crossVectors(n, u);
        
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
            const diff = tempPos.clone().negate();
            const r2 = diff.lengthSq();
            if (r2 < CRASH_DISTANCE * CRASH_DISTANCE) break;
            
            const dist = Math.sqrt(r2);
            const acc = diff.multiplyScalar(mu / (r2 * dist));
            
            tempVel.addScaledVector(acc, simStep);
            tempPos.addScaledVector(tempVel, simStep);
            points.push(tempPos.clone());
            if (tempPos.length() > DESPAWN_DISTANCE) break;
        }
    }
    
    p.orbitLine.geometry.dispose();
    p.orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
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

    const orbitMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
    const orbitLine = new THREE.Line(new THREE.BufferGeometry(), orbitMat);
    scene.add(orbitLine);

    const pData = {
        name: `${type}_${nameBank[Math.floor(Math.random() * nameBank.length)].toUpperCase()}`,
        pos, vel, orbitLine, type, size,
        mesh: new THREE.Mesh(new THREE.SphereGeometry(size, 32, 32), new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 })),
        label: null
    };
    
    pData.label = createLabel(pData.name);
    pData.mesh.userData.planetData = pData;
    scene.add(pData.mesh);
    planets.push(pData);
    updateOrbitLine(pData);
}

// --- CONTROLS ---
let theta = Math.PI/4, phi = Math.PI/4, radius = 1000, isRightClick = false;

// ZOOM FEATURE
window.addEventListener('wheel', (e) => {
    radius = Math.max(100, Math.min(6000, radius + e.deltaY * 0.5));
});

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key.toLowerCase() === KEYS.CONFIG.toLowerCase()) {
        const cfg = document.getElementById('config-ui');
        cfg.style.display = (cfg.style.display === 'none' || cfg.style.display === '') ? 'block' : 'none';
    }
    
    if (e.key.toLowerCase() === KEYS.PLACEMENT.toLowerCase()) {
        const pl = document.getElementById('placement-ui');
        pl.style.display = (pl.style.display === 'none' || pl.style.display === '') ? 'block' : 'none';
    }

    if (!e.ctrlKey) return;
    if (e.key === KEYS.SPAWN) { e.preventDefault(); createPlanet(); }
    if (e.key === KEYS.DELETE) { e.preventDefault(); deleteOutermostPlanet(); }
    if (e.key === KEYS.TIME_UP) { e.preventDefault(); if (currentTimeStepIndex < timeSteps.length - 1) { currentTimeStepIndex++; updateTimeUI(); } }
    if (e.key === KEYS.TIME_DOWN) { e.preventDefault(); if (currentTimeStepIndex > 0) { currentTimeStepIndex--; updateTimeUI(); } }
});

// Selection & Mouse
window.addEventListener('mousedown', (e) => {
    if (e.button === 2) isRightClick = true;
    if (e.target.closest('#ui') || e.target.closest('#planet-ui')) return;
    
    const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(scene.children);

    if (hits.length > 0 && hits[0].object.userData.planetData) {
        selected = hits[0].object.userData.planetData;
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

window.addEventListener('mouseup', () => isRightClick = false);
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousemove', e => {
    if(isRightClick) {
        theta -= e.movementX * 0.005;
        phi = Math.max(0.1, Math.min(Math.PI/2 - 0.1, phi + e.movementY * 0.005));
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
            const diff = new THREE.Vector3(0,0,0).sub(p.pos);
            const r = diff.length();

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

            const acc = diff.normalize().multiplyScalar((G * SUN_MASS) / (r * r));
            p.vel.add(acc.multiplyScalar(subDt));
            p.pos.add(p.vel.clone().multiplyScalar(subDt));
        }
    }

    // Update UI Stats if selected
    if (selected && !selected.isSun) {
        const dist = selected.pos.length().toFixed(1);
        extraStatsContainer.innerHTML = `
            TYPE: ${selected.type}<br>
            RADIUS: ${selected.size.toFixed(1)}<br>
            DIST: ${dist} AU
        `;
    } else {
        extraStatsContainer.innerHTML = "";
    }

    camera.position.set(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    camera.lookAt(0, 0, 0);

    const sunV = new THREE.Vector3(0,0,0).project(camera);
    sunLabel.style.left = `${(sunV.x * 0.5 + 0.5) * window.innerWidth}px`;
    sunLabel.style.top = `${(sunV.y * -0.5 + 0.5) * window.innerHeight - 40}px`;

    planets.forEach(p => {
        p.mesh.position.copy(p.pos);
        
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