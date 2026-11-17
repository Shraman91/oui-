import './sketchboard.css';
import { Game } from '../../core/Game';
import { InputManager } from '../../input/InputManager';
import { SKETCHBOARD_CONSTANTS, ColorOption, BrushSizeOption } from './constants';
import { SKETCH_PIXEL_ICONS } from './icons';

export class SketchboardGame implements Game {
  public readonly id = 'sketchboard';
  public readonly title = 'Sketchboard';

  private container: HTMLElement | null = null;
  private inputManager: InputManager | null = null;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // Drawing state
  private currentColor: string = SKETCHBOARD_CONSTANTS.DEFAULT_COLOR;
  private currentBrushSize: number = SKETCHBOARD_CONSTANTS.DEFAULT_BRUSH_SIZE;
  private isEraserActive = false;
  private isDrawing = false;
  private lastCanvasPos: { x: number; y: number } | null = null;

  // Undo history stack
  private undoStack: ImageData[] = [];

  // Listeners
  private unsubPressA: (() => void) | null = null;
  private unsubReleaseA: (() => void) | null = null;

  // DOM elements
  private rootElement: HTMLElement | null = null;
  private toastElement: HTMLElement | null = null;
  private toastTimeout: number | null = null;

  public init(container: HTMLElement, inputManager: InputManager): void {
    this.container = container;
    this.inputManager = inputManager;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'oui-sketch-wrapper';

    this.renderLayout();
    this.container.appendChild(this.rootElement);

    this.setupCanvas();
    this.setupInputSubscriptions();
  }

  private renderLayout(): void {
    if (!this.rootElement) return;

    this.rootElement.innerHTML = `
      <!-- Header -->
      <header class="oui-sketch-header">
        <div class="oui-sketch-title-box">
          <h2 class="oui-sketch-title">Sketchboard</h2>
          <span class="oui-sketch-badge">Channel 1</span>
        </div>
        <div class="oui-sketch-hint">Hold [Button A] to Draw &bull; Release to End Stroke</div>
      </header>

      <!-- Drawing Stage -->
      <main class="oui-sketch-stage">
        <div class="oui-sketch-canvas-frame">
          <canvas id="oui-sketch-canvas" width="${SKETCHBOARD_CONSTANTS.CANVAS.WIDTH}" height="${SKETCHBOARD_CONSTANTS.CANVAS.HEIGHT}"></canvas>
        </div>
      </main>

      <!-- Tool Tray Bar -->
      <footer class="oui-sketch-toolbar">
        <!-- Palette -->
        <div class="oui-sketch-tool-group" id="oui-sketch-palette">
          ${SKETCHBOARD_CONSTANTS.PALETTE.map((c: ColorOption) => `
            <button
              class="oui-sketch-color-swatch ${c.hex === this.currentColor && !this.isEraserActive ? 'active' : ''}"
              data-color="${c.hex}"
              title="${c.name}"
              style="background-color: ${c.hex};"
            ></button>
          `).join('')}
        </div>

        <div class="oui-sketch-divider"></div>

        <!-- Brush Sizes -->
        <div class="oui-sketch-tool-group" id="oui-sketch-sizes">
          ${SKETCHBOARD_CONSTANTS.BRUSH_SIZES.map((b: BrushSizeOption) => `
            <button
              class="oui-sketch-size-btn ${b.size === this.currentBrushSize ? 'active' : ''}"
              data-size="${b.size}"
              title="${b.name} (${b.size}px)"
            >
              <span class="oui-sketch-size-dot" style="width: ${Math.min(18, Math.max(4, b.size / 1.8))}px; height: ${Math.min(18, Math.max(4, b.size / 1.8))}px;"></span>
            </button>
          `).join('')}
        </div>

        <div class="oui-sketch-divider"></div>

        <!-- Action Tools -->
        <div class="oui-sketch-tool-group">
          <button class="oui-sketch-action-btn ${this.isEraserActive ? 'active-tool' : ''}" id="oui-btn-eraser" title="Eraser">
            ${SKETCH_PIXEL_ICONS.eraser}
            <span>Eraser</span>
          </button>
          <button class="oui-sketch-action-btn" id="oui-btn-undo" title="Undo Last Stroke">
            ${SKETCH_PIXEL_ICONS.undo}
            <span>Undo</span>
          </button>
          <button class="oui-sketch-action-btn" id="oui-btn-clear" title="Clear Canvas">
            ${SKETCH_PIXEL_ICONS.trash}
            <span>Clear</span>
          </button>
          <button class="oui-sketch-action-btn oui-sketch-save-btn" id="oui-btn-save" title="Save as PNG">
            ${SKETCH_PIXEL_ICONS.save}
            <span>Save PNG</span>
          </button>
        </div>
      </footer>
    `;

    this.bindToolbarEvents();
  }

  private bindToolbarEvents(): void {
    if (!this.rootElement) return;

    // Color Swatches
    const swatches = this.rootElement.querySelectorAll('.oui-sketch-color-swatch');
    for (const swatch of swatches) {
      swatch.addEventListener('click', () => {
        const color = swatch.getAttribute('data-color');
        if (color) {
          this.selectColor(color);
        }
      });
    }

    // Brush Sizes
    const sizes = this.rootElement.querySelectorAll('.oui-sketch-size-btn');
    for (const sizeBtn of sizes) {
      sizeBtn.addEventListener('click', () => {
        const sizeStr = sizeBtn.getAttribute('data-size');
        if (sizeStr) {
          this.selectBrushSize(Number.parseInt(sizeStr, 10));
        }
      });
    }

    // Eraser Button
    const eraserBtn = this.rootElement.querySelector('#oui-btn-eraser');
    eraserBtn?.addEventListener('click', () => {
      this.toggleEraser();
    });

    // Undo Button
    const undoBtn = this.rootElement.querySelector('#oui-btn-undo');
    undoBtn?.addEventListener('click', () => {
      this.undo();
    });

    // Clear Button
    const clearBtn = this.rootElement.querySelector('#oui-btn-clear');
    clearBtn?.addEventListener('click', () => {
      this.clearCanvas();
    });

    // Save Button
    const saveBtn = this.rootElement.querySelector('#oui-btn-save');
    saveBtn?.addEventListener('click', () => {
      this.saveAsPNG();
    });
  }

  private setupCanvas(): void {
    if (!this.rootElement) return;
    this.canvas = this.rootElement.querySelector('#oui-sketch-canvas') as HTMLCanvasElement;
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!this.ctx) return;

    // Fill initial canvas with clean background
    this.ctx.fillStyle = SKETCHBOARD_CONSTANTS.CANVAS.BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Save initial blank snapshot
    this.pushUndoSnapshot();

    this.resizeCanvasDisplay();
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.resizeCanvasDisplay();
  };

  private resizeCanvasDisplay(): void {
    if (!this.canvas || !this.rootElement) return;
    const stage = this.rootElement.querySelector('.oui-sketch-stage');
    if (!stage) return;

    const stageRect = stage.getBoundingClientRect();
    const maxWidth = stageRect.width - 20;
    const maxHeight = stageRect.height - 20;

    const aspect = SKETCHBOARD_CONSTANTS.CANVAS.WIDTH / SKETCHBOARD_CONSTANTS.CANVAS.HEIGHT;

    let targetWidth = maxWidth;
    let targetHeight = targetWidth / aspect;

    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = targetHeight * aspect;
    }

    this.canvas.style.width = `${Math.floor(targetWidth)}px`;
    this.canvas.style.height = `${Math.floor(targetHeight)}px`;
  }

  private setupInputSubscriptions(): void {
    if (!this.inputManager) return;

    this.unsubPressA = this.inputManager.on('pressA', () => {
      // Stroke begins in update loop
    });

    this.unsubReleaseA = this.inputManager.on('releaseA', () => {
      if (this.isDrawing) {
        this.endStroke();
      }
    });
  }

  private selectColor(color: string): void {
    this.currentColor = color;
    this.isEraserActive = false;
    this.updateToolbarActiveStates();
  }

  private selectBrushSize(size: number): void {
    this.currentBrushSize = size;
    this.updateToolbarActiveStates();
  }

  private toggleEraser(): void {
    this.isEraserActive = !this.isEraserActive;
    this.updateToolbarActiveStates();
  }

  private updateToolbarActiveStates(): void {
    if (!this.rootElement) return;

    // Update Swatches
    const swatches = this.rootElement.querySelectorAll('.oui-sketch-color-swatch');
    for (const swatch of swatches) {
      const color = swatch.getAttribute('data-color');
      if (color === this.currentColor && !this.isEraserActive) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    }

    // Update Sizes
    const sizes = this.rootElement.querySelectorAll('.oui-sketch-size-btn');
    for (const sizeBtn of sizes) {
      const sizeStr = sizeBtn.getAttribute('data-size');
      if (sizeStr && Number.parseInt(sizeStr, 10) === this.currentBrushSize) {
        sizeBtn.classList.add('active');
      } else {
        sizeBtn.classList.remove('active');
      }
    }

    // Update Eraser
    const eraserBtn = this.rootElement.querySelector('#oui-btn-eraser');
    if (eraserBtn) {
      if (this.isEraserActive) {
        eraserBtn.classList.add('active-tool');
      } else {
        eraserBtn.classList.remove('active-tool');
      }
    }
  }

  private pushUndoSnapshot(): void {
    if (!this.ctx || !this.canvas) return;
    try {
      const snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.undoStack.push(snapshot);
      if (this.undoStack.length > SKETCHBOARD_CONSTANTS.CANVAS.MAX_UNDO_STEPS) {
        this.undoStack.shift();
      }
    } catch {
      // Snapshot buffer error fallback
    }
  }

  private undo(): void {
    if (!this.ctx || !this.canvas || this.undoStack.length <= 1) return;

    // Remove current state
    this.undoStack.pop();
    const previous = this.undoStack[this.undoStack.length - 1];
    if (previous) {
      this.ctx.putImageData(previous, 0, 0);
      this.showToast('Stroke undone');
    }
  }

  private clearCanvas(): void {
    if (!this.ctx || !this.canvas) return;
    this.ctx.fillStyle = SKETCHBOARD_CONSTANTS.CANVAS.BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.pushUndoSnapshot();
    this.showToast('Canvas cleared');
  }

  private saveAsPNG(): void {
    if (!this.canvas) return;

    try {
      const dataUrl = this.canvas.toDataURL('image/png');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `oui-sketch-${timestamp}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();

      this.showToast(`Saved as ${filename}!`);
    } catch (err) {
      console.error('Error saving sketch:', err);
      this.showToast('Error exporting PNG');
    }
  }

  private showToast(message: string): void {
    if (this.toastTimeout !== null) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
    this.toastElement?.remove();

    if (!this.rootElement) return;

    this.toastElement = document.createElement('div');
    this.toastElement.className = 'oui-sketch-toast';
    this.toastElement.innerHTML = `
      <span style="display:inline-flex; align-items:center;">${SKETCH_PIXEL_ICONS.brush}</span>
      <span>${message}</span>
    `;

    this.rootElement.appendChild(this.toastElement);

    this.toastTimeout = window.setTimeout(() => {
      this.toastElement?.remove();
      this.toastElement = null;
      this.toastTimeout = null;
    }, 2000);
  }

  private endStroke(): void {
    this.isDrawing = false;
    this.lastCanvasPos = null;
    this.pushUndoSnapshot();
  }

  public update(_dt: number): void {
    if (!this.inputManager || !this.canvas || !this.ctx) return;

    const state = this.inputManager.getState();
    const rect = this.canvas.getBoundingClientRect();

    const screenX = state.pointer.x * window.innerWidth;
    const screenY = state.pointer.y * window.innerHeight;

    const isInsideCanvas =
      screenX >= rect.left &&
      screenX <= rect.right &&
      screenY >= rect.top &&
      screenY <= rect.bottom;

    if (isInsideCanvas && state.buttonA) {
      const canvasX = (screenX - rect.left) * (this.canvas.width / rect.width);
      const canvasY = (screenY - rect.top) * (this.canvas.height / rect.height);

      if (!this.isDrawing) {
        // Start stroke
        this.isDrawing = true;
        this.lastCanvasPos = { x: canvasX, y: canvasY };
        this.drawDot(canvasX, canvasY);
      } else if (this.lastCanvasPos) {
        // Continue stroke with smooth interpolation
        this.drawLine(this.lastCanvasPos.x, this.lastCanvasPos.y, canvasX, canvasY);
        this.lastCanvasPos = { x: canvasX, y: canvasY };
      }
    } else if (this.isDrawing && !state.buttonA) {
      this.endStroke();
    }
  }

  private drawDot(x: number, y: number): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.currentBrushSize / 2, 0, Math.PI * 2);

    if (this.isEraserActive) {
      this.ctx.fillStyle = SKETCHBOARD_CONSTANTS.CANVAS.BACKGROUND_COLOR;
    } else {
      this.ctx.fillStyle = this.currentColor;
    }

    this.ctx.fill();
    this.ctx.restore();
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = this.currentBrushSize;

    if (this.isEraserActive) {
      this.ctx.strokeStyle = SKETCHBOARD_CONSTANTS.CANVAS.BACKGROUND_COLOR;
    } else {
      this.ctx.strokeStyle = this.currentColor;
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  public render(): void {
    // Rendering is directly painted to canvas on stroke events
  }

  public pause(): void {
    if (this.isDrawing) {
      this.endStroke();
    }
  }

  public resume(): void {
    this.isDrawing = false;
    this.lastCanvasPos = null;
  }

  public destroy(): void {
    window.removeEventListener('resize', this.handleResize);

    if (this.unsubPressA) {
      this.unsubPressA();
      this.unsubPressA = null;
    }
    if (this.unsubReleaseA) {
      this.unsubReleaseA();
      this.unsubReleaseA = null;
    }

    if (this.toastTimeout !== null) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }

    this.undoStack = [];
    this.canvas = null;
    this.ctx = null;
    this.rootElement?.remove();
    this.rootElement = null;
    this.container = null;
    this.inputManager = null;
  }
}
