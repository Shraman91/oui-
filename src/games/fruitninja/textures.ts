import { FRUIT_NINJA_CONSTANTS, FruitConfig } from './constants';

export class FruitTextureGenerator {
  /**
   * Generates all programmatic fruit, bomb, and particle textures into the Phaser scene.
   */
  public static generateAll(scene: Phaser.Scene): void {
    // Generate textures for each fruit
    for (const fruit of FRUIT_NINJA_CONSTANTS.FRUITS) {
      this.generateFruitTextures(scene, fruit);
    }

    // Generate Bomb
    this.generateBombTexture(scene);

    // Generate Splat / Juice Particles
    this.generateParticleTextures(scene);
  }

  private static safeAddCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    scene.textures.addCanvas(key, canvas);
  }

  private static generateFruitTextures(scene: Phaser.Scene, fruit: FruitConfig): void {
    const r = fruit.radius;
    const size = Math.ceil(r * 2 + 12);
    const center = size / 2;

    // 1. Whole Fruit
    const wholeCanvas = document.createElement('canvas');
    wholeCanvas.width = size;
    wholeCanvas.height = size;
    const ctx = wholeCanvas.getContext('2d');
    if (ctx) {
      // Outline
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.fillStyle = fruit.skinColor;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#3b1d28';
      ctx.stroke();

      // Stem / Leaf on top
      ctx.fillStyle = '#15803d';
      ctx.fillRect(center - 2, center - r - 4, 4, 6);
      ctx.beginPath();
      ctx.ellipse(center + 4, center - r - 3, 5, 2.5, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Highlight glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(center - r * 0.35, center - r * 0.35, r * 0.2, 0, Math.PI * 2);
      ctx.fill();

      this.safeAddCanvas(scene, `fruit_${fruit.id}_whole`, wholeCanvas);
    }

    // 2. Left Half (Cut along vertical centerline)
    const leftCanvas = document.createElement('canvas');
    leftCanvas.width = size;
    leftCanvas.height = size;
    const leftCtx = leftCanvas.getContext('2d');
    if (leftCtx) {
      leftCtx.beginPath();
      leftCtx.arc(center, center, r, Math.PI * 0.5, Math.PI * 1.5, false);
      leftCtx.closePath();
      leftCtx.fillStyle = fruit.fleshColor;
      leftCtx.fill();

      // Rind layer
      if (fruit.rindColor) {
        leftCtx.lineWidth = 3;
        leftCtx.strokeStyle = fruit.rindColor;
        leftCtx.stroke();
      }

      // Outer outline
      leftCtx.lineWidth = 3;
      leftCtx.strokeStyle = '#3b1d28';
      leftCtx.stroke();

      // Flat cut surface seeds/texture
      leftCtx.fillStyle = '#3b1d28';
      leftCtx.fillRect(center - 5, center - 6, 2, 3);
      leftCtx.fillRect(center - 7, center + 4, 2, 3);

      this.safeAddCanvas(scene, `fruit_${fruit.id}_half_left`, leftCanvas);
    }

    // 3. Right Half (Cut along vertical centerline)
    const rightCanvas = document.createElement('canvas');
    rightCanvas.width = size;
    rightCanvas.height = size;
    const rightCtx = rightCanvas.getContext('2d');
    if (rightCtx) {
      rightCtx.beginPath();
      rightCtx.arc(center, center, r, Math.PI * 1.5, Math.PI * 0.5, false);
      rightCtx.closePath();
      rightCtx.fillStyle = fruit.fleshColor;
      rightCtx.fill();

      // Rind layer
      if (fruit.rindColor) {
        rightCtx.lineWidth = 3;
        rightCtx.strokeStyle = fruit.rindColor;
        rightCtx.stroke();
      }

      // Outer outline
      rightCtx.lineWidth = 3;
      rightCtx.strokeStyle = '#3b1d28';
      rightCtx.stroke();

      // Flat cut surface seeds/texture
      rightCtx.fillStyle = '#3b1d28';
      rightCtx.fillRect(center + 3, center - 6, 2, 3);
      rightCtx.fillRect(center + 5, center + 4, 2, 3);

      this.safeAddCanvas(scene, `fruit_${fruit.id}_half_right`, rightCanvas);
    }
  }

  private static generateBombTexture(scene: Phaser.Scene): void {
    const r = FRUIT_NINJA_CONSTANTS.BOMB.radius;
    const size = Math.ceil(r * 2 + 16);
    const center = size / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Body
    ctx.beginPath();
    ctx.arc(center, center + 4, r, 0, Math.PI * 2);
    ctx.fillStyle = FRUIT_NINJA_CONSTANTS.BOMB.bodyColor;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1e0f17';
    ctx.stroke();

    // Fuse Collar
    ctx.fillStyle = '#64748b';
    ctx.fillRect(center - 4, center - r + 1, 8, 4);

    // Fuse Rope
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = FRUIT_NINJA_CONSTANTS.BOMB.fuseColor;
    ctx.beginPath();
    ctx.moveTo(center, center - r + 1);
    ctx.quadraticCurveTo(center + 6, center - r - 4, center + 4, center - r - 8);
    ctx.stroke();

    // Fuse Spark
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(center + 3, center - r - 10, 4, 4);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(center + 4, center - r - 9, 2, 2);

    // Cute skull crossbones or exclamation mark on bomb
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(center - 2, center - 1, 4, 7);
    ctx.fillRect(center - 2, center + 9, 4, 3);

    this.safeAddCanvas(scene, 'bomb', canvas);
  }

  private static generateParticleTextures(scene: Phaser.Scene): void {
    const colors = ['#f43f5e', '#fb923c', '#f87171', '#4ade80', '#f472b6', '#fde047'];

    for (let i = 0; i < colors.length; i++) {
      const color = colors[i];
      const canvas = document.createElement('canvas');
      canvas.width = 12;
      canvas.height = 12;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = color;
        ctx.fillRect(2, 2, 8, 8);
        ctx.strokeStyle = '#3b1d28';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(2, 2, 8, 8);
        this.safeAddCanvas(scene, `particle_${i}`, canvas);
      }
    }
  }
}
