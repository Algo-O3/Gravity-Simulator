let scene, camera, renderer, controls, grid;
const GRID_COLOR = 0x2A0F36;
let objects = [];
let placementActive = false;
let removalActive = false;
let selectedObject = null;
let simulationActive = false; 

class SpaceObject {
    constructor(x, z) {
        this.mass = 1;
        this.radius = 0.5;
        this.color = 0xFF4444;
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(this.radius, 32, 32),
            new THREE.MeshPhongMaterial({
                color: this.color,
                shininess: 100
            })
        );
        this.mesh.position.set(x, 0, z);
        this.mesh.userData.object = this;
    }
}

function init() {
   
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(15, 15, 15);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    createGrid();

    const axesHelper = new THREE.AxesHelper(15);
    scene.add(axesHelper);
    
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 25, 0);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;


    document.getElementById('addBtn').addEventListener('click', startPlacement);
    document.getElementById('removeBtn').addEventListener('click', startRemoval);
    document.getElementById('completeBtn').addEventListener('click', completeAction);
    document.getElementById('startBtn').addEventListener('click', startSimulation);
    document.getElementById('stopBtn').addEventListener('click', stopSimulation);
    renderer.domElement.addEventListener('click', handleClick);
    window.addEventListener('resize', onWindowResize);
}

function createGrid() {
    const gridSize = 100;
    const divisions = 100;
    
    const geometry = new THREE.PlaneGeometry(gridSize, gridSize, divisions, divisions);
    const material = new THREE.MeshPhongMaterial({
        color: GRID_COLOR,
        wireframe: true,
        transparent: true,
        opacity: 0.8
    });
    
    grid = new THREE.Mesh(geometry, material);
    grid.rotation.x = -Math.PI/2;
    grid.position.y = -0.1;
    scene.add(grid);

    const posAttr = geometry.attributes.position;
    geometry.userData.originalPositions = new Float32Array(posAttr.array);
}

function startPlacement() {
    placementActive = true;
    removalActive = false;
    toggleButtonStates('add');
}

function startRemoval() {
    removalActive = true;
    placementActive = false;
    toggleButtonStates('remove');
}

function completeAction() {
    placementActive = false;
    removalActive = false;
    toggleButtonStates('none');
}

function startSimulation() {
    simulationActive = true;
    document.getElementById('startBtn').classList.add('active');
    document.getElementById('stopBtn').classList.remove('active');
}

function stopSimulation() {
    simulationActive = false;
    document.getElementById('stopBtn').classList.add('active');
    document.getElementById('startBtn').classList.remove('active');
}

function toggleButtonStates(mode) {
    const addBtn = document.getElementById('addBtn');
    const removeBtn = document.getElementById('removeBtn');
    const completeBtn = document.getElementById('completeBtn');

    addBtn.classList.toggle('active', mode === 'add');
    removeBtn.classList.toggle('active', mode === 'remove');
    completeBtn.disabled = (mode === 'none');
}

const G = 5; 

function updatePhysics(deltaTime) {
    
    if (!simulationActive) return;
    
    
    objects.forEach(obj1 => {
        objects.forEach(obj2 => {
            if(obj1 === obj2) return;
            
            const dx = obj2.mesh.position.x - obj1.mesh.position.x;
            const dz = obj2.mesh.position.z - obj1.mesh.position.z;
            const distanceSq = dx*dx + dz*dz;
            const distance = Math.sqrt(distanceSq);
            
            if(distance > 0) {
                const force = G * obj1.mass * obj2.mass / distanceSq;
                const dirX = dx/distance;
                const dirZ = dz/distance;
                
                obj1.velocity.x += (force/obj1.mass) * dirX * deltaTime;
                obj1.velocity.z += (force/obj1.mass) * dirZ * deltaTime;
            }
        });
        
        obj1.mesh.position.x += obj1.velocity.x * deltaTime;
        obj1.mesh.position.z += obj1.velocity.z * deltaTime;
    });
}

function checkCollisions() {
    
    if (!simulationActive) return;
    
    for(let i = objects.length-1; i >= 0; i--) {
        for(let j = i-1; j >= 0; j--) {
            const obj1 = objects[i];
            const obj2 = objects[j];
            
            const dx = obj2.mesh.position.x - obj1.mesh.position.x;
            const dz = obj2.mesh.position.z - obj1.mesh.position.z;
            const distance = Math.sqrt(dx*dx + dz*dz);
            
            if(distance < obj1.radius + obj2.radius) {
                const totalMass = obj1.mass + obj2.mass;
                const newObj = new SpaceObject(
                    (obj1.mesh.position.x*obj1.mass + obj2.mesh.position.x*obj2.mass)/totalMass,
                    (obj1.mesh.position.z*obj1.mass + obj2.mesh.position.z*obj2.mass)/totalMass
                );
                
                newObj.velocity.x = (obj1.velocity.x*obj1.mass + obj2.velocity.x*obj2.mass)/totalMass;
                newObj.velocity.z = (obj1.velocity.z*obj1.mass + obj2.velocity.z*obj2.mass)/totalMass;
                newObj.mass = totalMass;
                newObj.radius = (obj1.radius +obj2.radius);
                
                removeObject(obj1.mesh);
                removeObject(obj2.mesh);
                addObject(newObj.mesh.position.x, newObj.mesh.position.z);
                objects[objects.length-1] = newObj;
            }
        }
    }
}

const clock = new THREE.Clock();

function handleClick(event) {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    if (placementActive) {
        const intersects = raycaster.intersectObject(grid);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            addObject(point.x, point.z);
        }
    } else if (removalActive) {
        const intersects = raycaster.intersectObjects(objects.map(o => o.mesh));
        if (intersects.length > 0) {
            removeObject(intersects[0].object);
        }
    } else {
        const intersects = raycaster.intersectObjects(objects.map(o => o.mesh));
        if (intersects.length > 0) {
            showContextMenu(event.clientX, event.clientY, intersects[0].object.userData.object);
        }
    }
}

function showContextMenu(x, y, object) {
    selectedObject = object;
    const menu = document.getElementById('contextMenu');
    
    const colorObj = new THREE.Color(object.color);
    
    menu.innerHTML = `
        <div class="menu-item">
            <label>Mass: <input type="number" id="massInput" value="${object.mass}" step="0.1" min="0.1"></label>
        </div>
        <div class="menu-item">
            <label>Radius: <input type="number" id="radiusInput" value="${object.radius}" step="0.1" min="0.1"></label>
        </div>
        <div class="menu-item">
            <label>Color: <input type="color" id="colorInput" value="#${colorObj.getHexString()}"></label>
        </div>
    <div class="menu-item">
        <label>Velocity X</label>
        <input type="number" step="0.1" id="velX" value="${selectedObject.velocity.x}">
    </div>
    <div class="menu-item">
        <label>Velocity Z</label>
        <input type="number" step="0.1" id="velZ" value="${selectedObject.velocity.z}">
        <div class="menu-buttons">
            <button id="applyButton" onclick="updateObject()">Apply</button>
            <button id="cancelButton" onclick="hideContextMenu()">Cancel</button>
        </div>
    `;
    
    menu.style.display = 'block';

    setTimeout(() => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let adjustedX = x;
        let adjustedY = y;
        
        if (x + menuWidth > viewportWidth) {
            adjustedX = Math.max(0, viewportWidth - menuWidth - 10);
        }
        
        if (y + menuHeight > viewportHeight) {
            adjustedY = Math.max(0, viewportHeight - menuHeight - 10);
        }
        
        menu.style.left = `${adjustedX}px`;
        menu.style.top = `${adjustedY}px`;
    }, 0);
}

function hideContextMenu() {
    document.getElementById('contextMenu').style.display = 'none';
    selectedObject = null;
}

window.updateObject = function() {
    if (!selectedObject) return;

    selectedObject.mass = parseFloat(document.getElementById('massInput').value);
    selectedObject.radius = parseFloat(document.getElementById('radiusInput').value);
    
    const colorValue = document.getElementById('colorInput').value;
    selectedObject.color = new THREE.Color(colorValue).getHex();
    
    selectedObject.velocity.x = parseFloat(document.getElementById('velX').value);
    selectedObject.velocity.z = parseFloat(document.getElementById('velZ').value);

    selectedObject.mesh.geometry.dispose();
    selectedObject.mesh.geometry = new THREE.SphereGeometry(selectedObject.radius, 32, 32);
    selectedObject.mesh.material.color.set(colorValue);

    hideContextMenu();
};

function addObject(x, z) {
    const newObj = new SpaceObject(x, z);
    scene.add(newObj.mesh);
    objects.push(newObj);
}

function removeObject(object) {
    scene.remove(object);
    const index = objects.findIndex(o => o.mesh === object);
    if (index > -1) {
        objects.splice(index, 1);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateSpacetimeCurvature() {
    const geometry = grid.geometry;
    const posAttr = geometry.attributes.position;
    const positions = posAttr.array;
    const origPos = geometry.userData.originalPositions;
    const CURVATURE_STRENGTH = 0.15;
  
    positions.set(origPos);
  
    objects.forEach(obj => {
      const influenceRadius = obj.mass * 2;
      const objX = obj.mesh.position.x;
      const objZ = obj.mesh.position.z;
  
      for(let i=0; i<positions.length; i+=3) {
        const x = origPos[i];
        const z = -1*origPos[i+1];
        const dx = x - objX;
        const dz = z - objZ;
        const distance = Math.sqrt(dx*dx + dz*dz);
        
        if(distance < influenceRadius) {
          const intensity = (obj.mass / (distance + 0.1)) * CURVATURE_STRENGTH;
          positions[i+2] -= intensity * (1 - distance/influenceRadius);
        }
      }
    });
  
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
    updatePhysics(deltaTime);
    checkCollisions();
    updateSpacetimeCurvature();
    
    controls.update();
    renderer.render(scene, camera);
}

init();
animate();