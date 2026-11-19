import * as THREE from 'three';
import { TABLE_TENNIS_CONSTANTS } from './constants';
import { TableTennisPhysics } from './physics';

export class TableTennisScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // 3D Meshes
  private ballMesh!: THREE.Mesh;
  private playerPaddleGroup!: THREE.Group;
  private aiPaddleGroup!: THREE.Group;
  private particles: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[] = [];

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6f3f5); // Soft calm stadium backdrop

    // 2. Camera: Wii Sports Table Tennis perspective
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 100);
    this.camera.position.set(0, 3.4, 8.4);
    this.camera.lookAt(0, 0.4, 0);

    // 3. Renderer with antialiasing and soft shadow map
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    this.setupLighting();

    // 5. Build 3D Arena
    this.buildTableAndNet();
    this.buildBall();
    this.buildPaddles();
    this.buildFloor();

    window.addEventListener('resize', this.onResizeBound);
  }

  private onResizeBound = (): void => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xfff5f8, 0.75);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(4, 9, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -6;
    dirLight.shadow.camera.right = 6;
    dirLight.shadow.camera.top = 8;
    dirLight.shadow.camera.bottom = -8;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.35);
    fillLight.position.set(-5, 6, -6);
    this.scene.add(fillLight);
  }

  private buildTableAndNet(): void {
    const tblW = TABLE_TENNIS_CONSTANTS.TABLE.WIDTH;
    const tblL = TABLE_TENNIS_CONSTANTS.TABLE.LENGTH;
    const tblH = TABLE_TENNIS_CONSTANTS.TABLE.THICKNESS;

    // 1. Table Top (Soothing pastel cyan/blue surface)
    const tableGeom = new THREE.BoxGeometry(tblW, tblH, tblL);
    const tableMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
    const tableMesh = new THREE.Mesh(tableGeom, tableMat);
    tableMesh.position.set(0, -tblH / 2, 0);
    tableMesh.receiveShadow = true;
    tableMesh.castShadow = true;
    this.scene.add(tableMesh);

    // 2. Table Border Lines & Center Line
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lineWidth = 0.05;

    // Side border lines
    const leftLine = new THREE.Mesh(new THREE.BoxGeometry(lineWidth, 0.005, tblL), lineMat);
    leftLine.position.set(-tblW / 2 + lineWidth / 2, 0.003, 0);
    this.scene.add(leftLine);

    const rightLine = new THREE.Mesh(new THREE.BoxGeometry(lineWidth, 0.005, tblL), lineMat);
    rightLine.position.set(tblW / 2 - lineWidth / 2, 0.003, 0);
    this.scene.add(rightLine);

    // End border lines
    const endNear = new THREE.Mesh(new THREE.BoxGeometry(tblW, 0.005, lineWidth), lineMat);
    endNear.position.set(0, 0.003, tblL / 2 - lineWidth / 2);
    this.scene.add(endNear);

    const endFar = new THREE.Mesh(new THREE.BoxGeometry(tblW, 0.005, lineWidth), lineMat);
    endFar.position.set(0, 0.003, -tblL / 2 + lineWidth / 2);
    this.scene.add(endFar);

    // Center divider line
    const centerLine = new THREE.Mesh(new THREE.BoxGeometry(lineWidth * 0.7, 0.005, tblL), lineMat);
    centerLine.position.set(0, 0.003, 0);
    this.scene.add(centerLine);

    // 3. Table Legs & Frame
    const legMat = new THREE.MeshLambertMaterial({ color: 0x382c33 });
    const legH = TABLE_TENNIS_CONSTANTS.TABLE.LEGS_HEIGHT;
    const legGeom = new THREE.BoxGeometry(0.16, legH, 0.16);

    const legPositions = [
      [-tblW / 2 + 0.4, -tblH - legH / 2, -tblL / 2 + 0.6],
      [tblW / 2 - 0.4, -tblH - legH / 2, -tblL / 2 + 0.6],
      [-tblW / 2 + 0.4, -tblH - legH / 2, tblL / 2 - 0.6],
      [tblW / 2 - 0.4, -tblH - legH / 2, tblL / 2 - 0.6]
    ];

    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeom, legMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      this.scene.add(leg);
    }

    // 4. Net
    const netW = tblW + TABLE_TENNIS_CONSTANTS.TABLE.NET_OVERHANG;
    const netH = TABLE_TENNIS_CONSTANTS.TABLE.NET_HEIGHT;
    const netMeshGeom = new THREE.PlaneGeometry(netW, netH);
    const netMeshMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const netMesh = new THREE.Mesh(netMeshGeom, netMeshMat);
    netMesh.position.set(0, netH / 2, 0);
    this.scene.add(netMesh);

    // Top white tape
    const netTape = new THREE.Mesh(
      new THREE.BoxGeometry(netW, 0.04, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    netTape.position.set(0, netH, 0);
    this.scene.add(netTape);

    // Net side posts
    const postGeom = new THREE.CylinderGeometry(0.04, 0.04, netH + 0.1, 8);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x382c33 });
    const postLeft = new THREE.Mesh(postGeom, postMat);
    postLeft.position.set(-netW / 2, (netH + 0.1) / 2 - 0.05, 0);
    this.scene.add(postLeft);

    const postRight = new THREE.Mesh(postGeom, postMat);
    postRight.position.set(netW / 2, (netH + 0.1) / 2 - 0.05, 0);
    this.scene.add(postRight);
  }

  private buildBall(): void {
    const r = TABLE_TENNIS_CONSTANTS.BALL.RADIUS;
    const geom = new THREE.SphereGeometry(r, 20, 20);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: 0x222222
    });
    this.ballMesh = new THREE.Mesh(geom, mat);
    this.ballMesh.castShadow = true;
    this.scene.add(this.ballMesh);
  }

  private createPaddle(faceColor: number): THREE.Group {
    const group = new THREE.Group();
    const r = TABLE_TENNIS_CONSTANTS.PADDLE.RADIUS;
    const thick = TABLE_TENNIS_CONSTANTS.PADDLE.THICKNESS;

    // Blade / Rubber face (Cylinder)
    const bladeGeom = new THREE.CylinderGeometry(r, r, thick, 24);
    bladeGeom.rotateX(Math.PI / 2); // face Z axis

    const faceMat = new THREE.MeshLambertMaterial({ color: faceColor });
    const backMat = new THREE.MeshLambertMaterial({ color: 0x2c2227 });
    const woodRimMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });

    const blade = new THREE.Mesh(bladeGeom, [woodRimMat, faceMat, backMat]);
    blade.castShadow = true;
    group.add(blade);

    // Handle
    const handleL = TABLE_TENNIS_CONSTANTS.PADDLE.HANDLE_LENGTH;
    const handleGeom = new THREE.CylinderGeometry(0.07, 0.09, handleL, 12);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
    const handle = new THREE.Mesh(handleGeom, handleMat);
    handle.position.set(0, -r - handleL / 2 + 0.08, 0);
    handle.castShadow = true;
    group.add(handle);

    return group;
  }

  private buildPaddles(): void {
    // Player Paddle: Coral red rubber face
    this.playerPaddleGroup = this.createPaddle(0xfb7185);
    this.playerPaddleGroup.position.set(0, 0.6, TABLE_TENNIS_CONSTANTS.PADDLE.PLAYER_Z);
    this.scene.add(this.playerPaddleGroup);

    // AI Paddle: Baby Pink / Lavender rubber face
    this.aiPaddleGroup = this.createPaddle(0xf472b6);
    this.aiPaddleGroup.position.set(0, 0.6, TABLE_TENNIS_CONSTANTS.PADDLE.AI_Z);
    // Face player
    this.aiPaddleGroup.rotation.y = Math.PI;
    this.scene.add(this.aiPaddleGroup);
  }

  private buildFloor(): void {
    const floorGeom = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xfaede6 });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -TABLE_TENNIS_CONSTANTS.TABLE.LEGS_HEIGHT - TABLE_TENNIS_CONSTANTS.TABLE.THICKNESS;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  public updateVisuals(
    physics: TableTennisPhysics,
    playerTargetX: number,
    playerTargetY: number,
    aiTargetX: number,
    aiTargetY: number,
    dt: number
  ): void {
    const ballState = physics.getState();

    // 1. Update Ball Position
    this.ballMesh.position.copy(ballState.position);

    // 2. Smoothly Update Player Paddle
    const lerpRate = Math.min(1, dt * TABLE_TENNIS_CONSTANTS.PADDLE.TRACKING_LERP);
    this.playerPaddleGroup.position.x +=
      (playerTargetX - this.playerPaddleGroup.position.x) * lerpRate;
    this.playerPaddleGroup.position.y +=
      (playerTargetY - this.playerPaddleGroup.position.y) * lerpRate;

    // Slight dynamic paddle tilt based on displacement
    const dx = playerTargetX - this.playerPaddleGroup.position.x;
    this.playerPaddleGroup.rotation.z = -dx * 0.45;
    this.playerPaddleGroup.rotation.x = -0.15;

    // 3. Smoothly Update AI Paddle
    this.aiPaddleGroup.position.x +=
      (aiTargetX - this.aiPaddleGroup.position.x) * lerpRate;
    this.aiPaddleGroup.position.y +=
      (aiTargetY - this.aiPaddleGroup.position.y) * lerpRate;

    const aiDx = aiTargetX - this.aiPaddleGroup.position.x;
    this.aiPaddleGroup.rotation.z = aiDx * 0.45;
    this.aiPaddleGroup.rotation.x = 0.15;

    // 4. Update Particle Bursts
    this.updateParticles(dt);
  }

  public spawnSparks(pos: THREE.Vector3, color = 0xf472b6, count = 10): void {
    const geom = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const mat = new THREE.MeshBasicMaterial({ color });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const speed = 2.0 + Math.random() * 3.5;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: (Math.random() + 0.4) * speed,
        vz: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.2
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      p.vy -= 9.8 * dt; // gravity
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      const s = Math.max(0.01, p.life * 2.5);
      p.mesh.scale.set(s, s, s);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onResizeBound);

    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    this.particles = [];

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
