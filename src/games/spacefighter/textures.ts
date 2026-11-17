import * as Phaser from 'phaser';

export class SpaceFighterTextureGenerator {
  public static generateAll(scene: Phaser.Scene): void {
    this.generatePlayerShip(scene);
    this.generatePlayerBullet(scene);
    this.generateEnemies(scene);
    this.generateBoss(scene);
    this.generateEnemyBullet(scene);
    this.generateStars(scene);
    this.generateExplosionParticles(scene);
  }

  private static safeAddCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    scene.textures.addCanvas(key, canvas);
  }

  private static generatePlayerShip(scene: Phaser.Scene): void {
    const w = 48;
    const h = 52;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = w / 2;

    // Outer Dark Contour
    ctx.fillStyle = '#2c2227';
    ctx.beginPath();
    ctx.moveTo(cx, 2);
    ctx.lineTo(cx + 8, 16);
    ctx.lineTo(cx + 22, 38);
    ctx.lineTo(cx + 20, 48);
    ctx.lineTo(cx + 8, 44);
    ctx.lineTo(cx - 8, 44);
    ctx.lineTo(cx - 20, 48);
    ctx.lineTo(cx - 22, 38);
    ctx.lineTo(cx - 8, 16);
    ctx.closePath();
    ctx.fill();

    // Wings (Pastel Rose / Coral)
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(cx, 8);
    ctx.lineTo(cx + 18, 36);
    ctx.lineTo(cx + 16, 44);
    ctx.lineTo(cx + 6, 40);
    ctx.lineTo(cx - 6, 40);
    ctx.lineTo(cx - 16, 44);
    ctx.lineTo(cx - 18, 36);
    ctx.closePath();
    ctx.fill();

    // Main Fuselage (Cream White)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, 4);
    ctx.lineTo(cx + 7, 20);
    ctx.lineTo(cx + 7, 42);
    ctx.lineTo(cx - 7, 42);
    ctx.lineTo(cx - 7, 20);
    ctx.closePath();
    ctx.fill();

    // Wing Cannons
    ctx.fillStyle = '#382c33';
    ctx.fillRect(cx - 20, 26, 3, 14);
    ctx.fillRect(cx + 17, 26, 3, 14);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(cx - 20, 24, 3, 2);
    ctx.fillRect(cx + 17, 24, 3, 2);

    // Cute Cockpit (Pastel Pink / Magenta Glass)
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.ellipse(cx, 22, 4.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(cx - 1.5, 19, 1.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Thruster Mount
    ctx.fillStyle = '#382c33';
    ctx.fillRect(cx - 6, 42, 4, 4);
    ctx.fillRect(cx + 2, 42, 4, 4);

    // Twin Thruster Jet Flame
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(cx - 5, 46, 2, 5);
    ctx.fillRect(cx + 3, 46, 2, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 5, 46, 2, 2);
    ctx.fillRect(cx + 3, 46, 2, 2);

    this.safeAddCanvas(scene, 'player_ship', canvas);
  }

  private static generatePlayerBullet(scene: Phaser.Scene): void {
    const w = 12;
    const h = 26;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Outer glow (neon pink)
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.roundRect(1, 1, 10, 24, 5);
    ctx.fill();

    // Mid laser
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.roundRect(2.5, 2.5, 7, 21, 3.5);
    ctx.fill();

    // Gleaming white core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(4, 4, 4, 18, 2);
    ctx.fill();

    this.safeAddCanvas(scene, 'player_bullet', canvas);
  }

  private static generateEnemies(scene: Phaser.Scene): void {
    // 1. Scout: Cute Mint Saucer with Antennae
    {
      const size = 44;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const c = size / 2;

        // Dark outline
        ctx.fillStyle = '#2c2227';
        ctx.beginPath();
        ctx.ellipse(c, c + 2, 18, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hull (Soft Mint Green)
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.ellipse(c, c + 2, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dome (Cyan glass)
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(c, c - 2, 8, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2c2227';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Dome shine
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(c - 3, c - 4, 2, 0, Math.PI * 2);
        ctx.fill();

        // Cute Antenna
        ctx.strokeStyle = '#2c2227';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c, c - 10);
        ctx.lineTo(c, c - 16);
        ctx.stroke();

        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(c, c - 17, 3, 0, Math.PI * 2);
        ctx.fill();

        // Bottom lights
        ctx.fillStyle = '#fde047';
        ctx.fillRect(c - 10, c + 3, 3, 2);
        ctx.fillRect(c - 1.5, c + 5, 3, 2);
        ctx.fillRect(c + 7, c + 3, 3, 2);

        this.safeAddCanvas(scene, 'enemy_scout', canvas);
      }
    }

    // 2. Bomber: Peach Fast Delta Jet
    {
      const size = 44;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const c = size / 2;

        // Dark contour
        ctx.fillStyle = '#2c2227';
        ctx.beginPath();
        ctx.moveTo(c, size - 4);
        ctx.lineTo(size - 4, 8);
        ctx.lineTo(c, 16);
        ctx.lineTo(4, 8);
        ctx.closePath();
        ctx.fill();

        // Peach / Orange body
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(c, size - 8);
        ctx.lineTo(size - 7, 10);
        ctx.lineTo(c, 17);
        ctx.lineTo(7, 10);
        ctx.closePath();
        ctx.fill();

        // Center spine (Cream)
        ctx.fillStyle = '#ffedd5';
        ctx.beginPath();
        ctx.moveTo(c, size - 10);
        ctx.lineTo(c + 4, 18);
        ctx.lineTo(c - 4, 18);
        ctx.closePath();
        ctx.fill();

        // Eye / Cockpit
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.ellipse(c, 26, 3.5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        this.safeAddCanvas(scene, 'enemy_bomber', canvas);
      }
    }

    // 3. Cruiser: Lavender Armored Flyer
    {
      const size = 56;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const c = size / 2;

        // Dark contour
        ctx.fillStyle = '#2c2227';
        ctx.beginPath();
        ctx.roundRect(6, 12, size - 12, 28, 8);
        ctx.fill();

        // Wings
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.roundRect(8, 14, size - 16, 24, 6);
        ctx.fill();

        // Armored hull
        ctx.fillStyle = '#c084fc';
        ctx.fillRect(c - 10, 8, 20, 36);
        ctx.strokeStyle = '#2c2227';
        ctx.lineWidth = 2;
        ctx.strokeRect(c - 10, 8, 20, 36);

        // Heavy twin blasters
        ctx.fillStyle = '#382c33';
        ctx.fillRect(10, 34, 4, 12);
        ctx.fillRect(size - 14, 34, 4, 12);

        // Core eye
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(c, 24, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2c2227';
        ctx.lineWidth = 2;
        ctx.stroke();

        this.safeAddCanvas(scene, 'enemy_cruiser', canvas);
      }
    }
  }

  private static generateBoss(scene: Phaser.Scene): void {
    const w = 140;
    const h = 100;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = w / 2;

    // Heavy Mothership Silhouette
    ctx.fillStyle = '#23181f';
    ctx.beginPath();
    ctx.moveTo(cx, 88);
    ctx.lineTo(w - 10, 32);
    ctx.lineTo(w - 20, 10);
    ctx.lineTo(cx, 24);
    ctx.lineTo(20, 10);
    ctx.lineTo(10, 32);
    ctx.closePath();
    ctx.fill();

    // Outer Wings (Dark Violet)
    ctx.fillStyle = '#7e22ce';
    ctx.beginPath();
    ctx.moveTo(cx, 82);
    ctx.lineTo(w - 14, 30);
    ctx.lineTo(w - 22, 14);
    ctx.lineTo(cx, 26);
    ctx.lineTo(22, 14);
    ctx.lineTo(14, 30);
    ctx.closePath();
    ctx.fill();

    // Armored Plates (Lilac / Rose)
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(cx, 74);
    ctx.lineTo(cx + 34, 36);
    ctx.lineTo(cx + 28, 18);
    ctx.lineTo(cx - 28, 18);
    ctx.lineTo(cx - 34, 36);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#23181f';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Quad Plasma Turrets
    ctx.fillStyle = '#1e1b1e';
    ctx.fillRect(24, 28, 8, 22);
    ctx.fillRect(w - 32, 28, 8, 22);
    ctx.fillRect(cx - 20, 48, 6, 20);
    ctx.fillRect(cx + 14, 48, 6, 20);

    // Glowing Central Reactor Core (Pulsing Eye)
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(cx, 40, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#23181f';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(cx, 40, 7, 0, Math.PI * 2);
    ctx.fill();

    // Specular Glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 3, 37, 3, 0, Math.PI * 2);
    ctx.fill();

    this.safeAddCanvas(scene, 'boss_mothership', canvas);
  }

  private static generateEnemyBullet(scene: Phaser.Scene): void {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const c = size / 2;

    // Outer plasma glow
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(c, c, 7, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright plasma
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(c, c, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Pure white spark core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c, c, 2, 0, Math.PI * 2);
    ctx.fill();

    this.safeAddCanvas(scene, 'enemy_bullet', canvas);
  }

  private static generateStars(scene: Phaser.Scene): void {
    // Star small
    {
      const canvas = document.createElement('canvas');
      canvas.width = 4;
      canvas.height = 4;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#e9d5ff';
        ctx.fillRect(1, 1, 2, 2);
        this.safeAddCanvas(scene, 'star_small', canvas);
      }
    }

    // Star medium
    {
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(3, 1, 2, 6);
        ctx.fillRect(1, 3, 6, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(3, 3, 2, 2);
        this.safeAddCanvas(scene, 'star_medium', canvas);
      }
    }

    // Star large (Twinkling cross)
    {
      const canvas = document.createElement('canvas');
      canvas.width = 14;
      canvas.height = 14;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(244, 114, 182, 0.5)';
        ctx.fillRect(6, 1, 2, 12);
        ctx.fillRect(1, 6, 12, 2);
        ctx.fillStyle = '#fce7f3';
        ctx.fillRect(5, 5, 4, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(6, 6, 2, 2);
        this.safeAddCanvas(scene, 'star_large', canvas);
      }
    }
  }

  private static generateExplosionParticles(scene: Phaser.Scene): void {
    const colors = ['#f472b6', '#38bdf8', '#fde047', '#fb923c', '#ffffff'];
    for (let i = 0; i < colors.length; i++) {
      const s = 10;
      const canvas = document.createElement('canvas');
      canvas.width = s;
      canvas.height = s;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(1, 1, 8, 8);
        ctx.strokeStyle = '#2c2227';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(1, 1, 8, 8);
        this.safeAddCanvas(scene, `particle_debris_${i}`, canvas);
      }
    }
  }
}
