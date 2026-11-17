import { FRUIT_NINJA_CONSTANTS, FruitConfig } from './constants';

export class FruitTextureGenerator {
  /**
   * Generates programmatic fruit, bomb, decal, and particle textures into the Phaser scene.
   */
  public static generateAll(scene: Phaser.Scene): void {
    // Generate textures for each fruit
    for (const fruit of FRUIT_NINJA_CONSTANTS.FRUITS) {
      this.generateFruitTextures(scene, fruit);
    }

    // Generate Bomb Texture
    this.generateBombTexture(scene);

    // Generate Splat / Juice Particles
    this.generateParticleTextures(scene);

    // Generate Dojo Wall Splat Decals
    this.generateDecalTextures(scene);

    // Generate Slash Flash Line Texture
    this.generateSlashFlashTexture(scene);
  }

  private static safeAddCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    scene.textures.addCanvas(key, canvas);
  }

  private static generateFruitTextures(scene: Phaser.Scene, fruit: FruitConfig): void {
    const r = fruit.radius;
    const size = Math.ceil(r * 2 + 16);
    const center = size / 2;

    // 1. Whole Fruit
    const wholeCanvas = document.createElement('canvas');
    wholeCanvas.width = size;
    wholeCanvas.height = size;
    const ctx = wholeCanvas.getContext('2d');
    if (ctx) {
      // Main Body
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.fillStyle = fruit.skinColor;
      ctx.fill();

      // Fruit specific skin decorations
      if (fruit.id === 'watermelon') {
        // Cute wavy melon stripes
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(center - 8, center, r - 3, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(center + 8, center, r - 3, Math.PI * 0.6, Math.PI * 1.4);
        ctx.stroke();
      } else if (fruit.id === 'orange' || fruit.id === 'lime') {
        // Subtle citrus stipple dots
        ctx.fillStyle = fruit.rindColor || '#ffffff';
        ctx.globalAlpha = 0.35;
        ctx.fillRect(center - r * 0.4, center + r * 0.2, 2, 2);
        ctx.fillRect(center + r * 0.3, center - r * 0.1, 2, 2);
        ctx.fillRect(center - r * 0.2, center - r * 0.4, 2, 2);
        ctx.globalAlpha = 1.0;
      } else if (fruit.id === 'strawberry') {
        // Golden yellow seed dots
        ctx.fillStyle = '#fde047';
        const seedCoords = [
          [-r * 0.4, -r * 0.2],
          [r * 0.4, -r * 0.2],
          [0, -r * 0.35],
          [-r * 0.25, r * 0.2],
          [r * 0.25, r * 0.2],
          [0, r * 0.45]
        ];
        for (const [sx, sy] of seedCoords) {
          ctx.beginPath();
          ctx.ellipse(center + sx, center + sy, 1.5, 2.5, Math.PI / 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Crisp outer contour outline
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#2d2226';
      ctx.stroke();

      // Stem & Leaf on top
      ctx.fillStyle = '#15803d';
      ctx.fillRect(center - 2, center - r - 4, 4, 6);
      ctx.beginPath();
      ctx.ellipse(center + 5, center - r - 3, 6, 3, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2d2226';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Specular highlight glint
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(center - r * 0.4, center - r * 0.4, r * 0.28, r * 0.14, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      this.safeAddCanvas(scene, `fruit_${fruit.id}_whole`, wholeCanvas);
    }

    // 2. Left Sliced Half
    const leftCanvas = document.createElement('canvas');
    leftCanvas.width = size;
    leftCanvas.height = size;
    const leftCtx = leftCanvas.getContext('2d');
    if (leftCtx) {
      // Outer peel semi-circle
      leftCtx.beginPath();
      leftCtx.arc(center, center, r, Math.PI * 0.5, Math.PI * 1.5, false);
      leftCtx.closePath();
      leftCtx.fillStyle = fruit.skinColor;
      leftCtx.fill();

      // Inner rind layer
      if (fruit.rindColor) {
        leftCtx.beginPath();
        leftCtx.arc(center, center, r - 3.5, Math.PI * 0.5, Math.PI * 1.5, false);
        leftCtx.closePath();
        leftCtx.fillStyle = fruit.rindColor;
        leftCtx.fill();
      }

      // Flesh core
      leftCtx.beginPath();
      leftCtx.arc(center, center, r - 7, Math.PI * 0.5, Math.PI * 1.5, false);
      leftCtx.closePath();
      leftCtx.fillStyle = fruit.fleshColor;
      leftCtx.fill();

      // Internal seeds or citrus segments
      if (fruit.id === 'watermelon') {
        leftCtx.fillStyle = '#2d2226';
        leftCtx.fillRect(center - 7, center - 10, 2.5, 3.5);
        leftCtx.fillRect(center - 11, center + 2, 2.5, 3.5);
        leftCtx.fillRect(center - 6, center + 12, 2.5, 3.5);
      } else if (fruit.id === 'orange' || fruit.id === 'lime') {
        leftCtx.strokeStyle = fruit.rindColor || '#ffffff';
        leftCtx.lineWidth = 1.5;
        leftCtx.beginPath();
        leftCtx.moveTo(center, center);
        leftCtx.lineTo(center - r * 0.7, center - r * 0.5);
        leftCtx.moveTo(center, center);
        leftCtx.lineTo(center - r * 0.8, center);
        leftCtx.moveTo(center, center);
        leftCtx.lineTo(center - r * 0.7, center + r * 0.5);
        leftCtx.stroke();
      }

      // Clean contour outline
      leftCtx.beginPath();
      leftCtx.arc(center, center, r, Math.PI * 0.5, Math.PI * 1.5, false);
      leftCtx.closePath();
      leftCtx.lineWidth = 2.5;
      leftCtx.strokeStyle = '#2d2226';
      leftCtx.stroke();

      this.safeAddCanvas(scene, `fruit_${fruit.id}_half_left`, leftCanvas);
    }

    // 3. Right Sliced Half
    const rightCanvas = document.createElement('canvas');
    rightCanvas.width = size;
    rightCanvas.height = size;
    const rightCtx = rightCanvas.getContext('2d');
    if (rightCtx) {
      // Outer peel semi-circle
      rightCtx.beginPath();
      rightCtx.arc(center, center, r, Math.PI * 1.5, Math.PI * 0.5, false);
      rightCtx.closePath();
      rightCtx.fillStyle = fruit.skinColor;
      rightCtx.fill();

      // Inner rind layer
      if (fruit.rindColor) {
        rightCtx.beginPath();
        rightCtx.arc(center, center, r - 3.5, Math.PI * 1.5, Math.PI * 0.5, false);
        rightCtx.closePath();
        rightCtx.fillStyle = fruit.rindColor;
        rightCtx.fill();
      }

      // Flesh core
      rightCtx.beginPath();
      rightCtx.arc(center, center, r - 7, Math.PI * 1.5, Math.PI * 0.5, false);
      rightCtx.closePath();
      rightCtx.fillStyle = fruit.fleshColor;
      rightCtx.fill();

      // Internal seeds or citrus segments
      if (fruit.id === 'watermelon') {
        rightCtx.fillStyle = '#2d2226';
        rightCtx.fillRect(center + 5, center - 10, 2.5, 3.5);
        rightCtx.fillRect(center + 9, center + 2, 2.5, 3.5);
        rightCtx.fillRect(center + 4, center + 12, 2.5, 3.5);
      } else if (fruit.id === 'orange' || fruit.id === 'lime') {
        rightCtx.strokeStyle = fruit.rindColor || '#ffffff';
        rightCtx.lineWidth = 1.5;
        rightCtx.beginPath();
        rightCtx.moveTo(center, center);
        rightCtx.lineTo(center + r * 0.7, center - r * 0.5);
        rightCtx.moveTo(center, center);
        rightCtx.lineTo(center + r * 0.8, center);
        rightCtx.moveTo(center, center);
        rightCtx.lineTo(center + r * 0.7, center + r * 0.5);
        rightCtx.stroke();
      }

      // Clean contour outline
      rightCtx.beginPath();
      rightCtx.arc(center, center, r, Math.PI * 1.5, Math.PI * 0.5, false);
      rightCtx.closePath();
      rightCtx.lineWidth = 2.5;
      rightCtx.strokeStyle = '#2d2226';
      rightCtx.stroke();

      this.safeAddCanvas(scene, `fruit_${fruit.id}_half_right`, rightCanvas);
    }
  }

  private static generateBombTexture(scene: Phaser.Scene): void {
    const r = FRUIT_NINJA_CONSTANTS.BOMB.radius;
    const size = Math.ceil(r * 2 + 20);
    const center = size / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Body
    ctx.beginPath();
    ctx.arc(center, center + 4, r, 0, Math.PI * 2);
    ctx.fillStyle = '#262024';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#120d10';
    ctx.stroke();

    // Specular sphere highlight
    ctx.fillStyle = '#64748b';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(center - r * 0.35, center + 4 - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Metal collar
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(center - 5, center - r + 1, 10, 4);
    ctx.strokeStyle = '#1e1b1e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(center - 5, center - r + 1, 10, 4);

    // Twisted rope fuse
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#d97706';
    ctx.beginPath();
    ctx.moveTo(center, center - r + 1);
    ctx.quadraticCurveTo(center + 6, center - r - 5, center + 3, center - r - 9);
    ctx.stroke();

    // Fuse Spark
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(center + 2, center - r - 12, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center + 3, center - r - 11, 2, 2);

    // Cute skull emblem
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(center, center + 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(center - 3, center + 5, 6, 3);
    ctx.fillStyle = '#262024';
    ctx.fillRect(center - 2, center + 1, 1.5, 1.5);
    ctx.fillRect(center + 0.5, center + 1, 1.5, 1.5);

    this.safeAddCanvas(scene, 'bomb', canvas);
  }

  private static generateParticleTextures(scene: Phaser.Scene): void {
    // Round droplet particle textures with delicate rim
    const sizes = [6, 10, 14];
    for (let i = 0; i < sizes.length; i++) {
      const s = sizes[i];
      const canvas = document.createElement('canvas');
      canvas.width = s;
      canvas.height = s;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(56, 44, 51, 0.4)';
        ctx.stroke();
        this.safeAddCanvas(scene, `droplet_${i}`, canvas);
      }
    }
  }

  private static generateDecalTextures(scene: Phaser.Scene): void {
    // Dojo floor juicy splat decals
    const splatSize = 64;
    const center = splatSize / 2;

    for (let i = 0; i < 3; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = splatSize;
      canvas.height = splatSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        // Main central splash
        ctx.beginPath();
        ctx.arc(center, center, 14 + i * 2, 0, Math.PI * 2);
        ctx.fill();

        // Radiating satellite drops
        const dropletCount = 6 + i * 2;
        for (let d = 0; d < dropletCount; d++) {
          const angle = (d / dropletCount) * Math.PI * 2 + (i * 0.4);
          const dist = 18 + ((d * 7) % 11);
          const dropR = 2.5 + ((d * 3) % 4);
          ctx.beginPath();
          ctx.arc(center + Math.cos(angle) * dist, center + Math.sin(angle) * dist, dropR, 0, Math.PI * 2);
          ctx.fill();
        }

        this.safeAddCanvas(scene, `splat_decal_${i}`, canvas);
      }
    }
  }

  private static generateSlashFlashTexture(scene: Phaser.Scene): void {
    const w = 120;
    const h = 16;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Razor sharp flash line with diamond taper
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w / 2, 1);
      ctx.lineTo(w, h / 2);
      ctx.lineTo(w / 2, h - 1);
      ctx.closePath();
      ctx.fill();

      this.safeAddCanvas(scene, 'slash_flash', canvas);
    }
  }
}
