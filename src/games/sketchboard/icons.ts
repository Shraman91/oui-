/**
 * Cute retro pixel art icons for Sketchboard (Zero gradients, zero emojis).
 */

export const SKETCH_PIXEL_ICONS = {
  // Eraser Icon (Pink rubber top with cream base)
  eraser: `
    <svg viewBox="0 0 16 16" width="20" height="20" shape-rendering="crispEdges">
      <rect x="5" y="2" width="6" height="1" fill="#3b1d28"/>
      <rect x="4" y="3" width="8" height="1" fill="#3b1d28"/>
      <rect x="3" y="4" width="10" height="8" fill="#3b1d28"/>
      <rect x="4" y="12" width="8" height="1" fill="#3b1d28"/>
      <rect x="5" y="13" width="6" height="1" fill="#3b1d28"/>

      <!-- Pink Eraser Top -->
      <rect x="5" y="3" width="6" height="1" fill="#f472b6"/>
      <rect x="4" y="4" width="8" height="4" fill="#f472b6"/>
      <rect x="5" y="4" width="2" height="2" fill="#fbcfe8"/>

      <!-- Cream / Grey Base -->
      <rect x="4" y="8" width="8" height="4" fill="#cbd5e1"/>
      <rect x="4" y="8" width="8" height="1" fill="#94a3b8"/>
    </svg>
  `,

  // Trash / Clear Canvas Icon
  trash: `
    <svg viewBox="0 0 16 16" width="20" height="20" shape-rendering="crispEdges">
      <!-- Lid Handle -->
      <rect x="6" y="2" width="4" height="1" fill="#3b1d28"/>
      <!-- Lid -->
      <rect x="3" y="3" width="10" height="2" fill="#3b1d28"/>
      <rect x="4" y="4" width="8" height="1" fill="#f472b6"/>
      <!-- Bin Body -->
      <rect x="4" y="5" width="8" height="8" fill="#3b1d28"/>
      <rect x="5" y="5" width="6" height="7" fill="#ffffff"/>
      <rect x="5" y="12" width="6" height="1" fill="#3b1d28"/>
      <!-- Ribs -->
      <rect x="6" y="6" width="1" height="5" fill="#f472b6"/>
      <rect x="8" y="6" width="1" height="5" fill="#f472b6"/>
      <rect x="10" y="6" width="1" height="5" fill="#f472b6"/>
    </svg>
  `,

  // Floppy Disk / Save as PNG Icon
  save: `
    <svg viewBox="0 0 16 16" width="20" height="20" shape-rendering="crispEdges">
      <!-- Floppy Outline -->
      <rect x="2" y="2" width="11" height="1" fill="#3b1d28"/>
      <rect x="2" y="3" width="12" height="11" fill="#3b1d28"/>
      <rect x="3" y="14" width="10" height="1" fill="#3b1d28"/>

      <!-- Main Shell (Cute Pink) -->
      <rect x="3" y="3" width="10" height="11" fill="#f472b6"/>
      <rect x="12" y="3" width="1" height="1" fill="#3b1d28"/> <!-- Cut corner -->

      <!-- Shutter Area (Top) -->
      <rect x="4" y="3" width="7" height="4" fill="#e2e8f0"/>
      <rect x="5" y="4" width="2" height="3" fill="#3b1d28"/>

      <!-- Label Area (Bottom) -->
      <rect x="4" y="8" width="8" height="5" fill="#ffffff"/>
      <rect x="5" y="9" width="6" height="1" fill="#38bdf8"/>
      <rect x="5" y="11" width="4" height="1" fill="#38bdf8"/>
    </svg>
  `,

  // Undo Icon (Pixel curved arrow)
  undo: `
    <svg viewBox="0 0 16 16" width="20" height="20" shape-rendering="crispEdges">
      <!-- Arrowhead -->
      <rect x="5" y="3" width="2" height="1" fill="#3b1d28"/>
      <rect x="4" y="4" width="2" height="1" fill="#3b1d28"/>
      <rect x="3" y="5" width="2" height="1" fill="#3b1d28"/>
      <rect x="2" y="6" width="2" height="2" fill="#3b1d28"/>
      <rect x="3" y="8" width="2" height="1" fill="#3b1d28"/>
      <rect x="4" y="9" width="2" height="1" fill="#3b1d28"/>
      <rect x="5" y="10" width="2" height="1" fill="#3b1d28"/>

      <rect x="4" y="5" width="1" height="1" fill="#f472b6"/>
      <rect x="3" y="6" width="1" height="2" fill="#f472b6"/>
      <rect x="4" y="8" width="1" height="1" fill="#f472b6"/>

      <!-- Curved Arrow Body -->
      <rect x="4" y="6" width="7" height="2" fill="#3b1d28"/>
      <rect x="9" y="8" width="3" height="4" fill="#3b1d28"/>
      <rect x="9" y="12" width="2" height="1" fill="#3b1d28"/>

      <rect x="5" y="6" width="5" height="2" fill="#f472b6"/>
      <rect x="9" y="8" width="2" height="3" fill="#f472b6"/>
    </svg>
  `,

  // Brush / Pen Icon
  brush: `
    <svg viewBox="0 0 16 16" width="20" height="20" shape-rendering="crispEdges">
      <!-- Pen Handle -->
      <rect x="11" y="2" width="2" height="3" fill="#3b1d28"/>
      <rect x="9" y="4" width="3" height="3" fill="#3b1d28"/>
      <rect x="7" y="6" width="3" height="3" fill="#3b1d28"/>
      <rect x="5" y="8" width="3" height="3" fill="#3b1d28"/>

      <rect x="11" y="2" width="1" height="2" fill="#fde047"/>
      <rect x="9" y="4" width="2" height="2" fill="#fde047"/>
      <rect x="7" y="6" width="2" height="2" fill="#fde047"/>
      <rect x="5" y="8" width="2" height="2" fill="#fde047"/>

      <!-- Ferrule -->
      <rect x="4" y="10" width="2" height="2" fill="#94a3b8"/>

      <!-- Bristle Tip -->
      <rect x="3" y="12" width="2" height="2" fill="#f472b6"/>
      <rect x="2" y="13" width="1" height="1" fill="#3b1d28"/>
    </svg>
  `
} as const;
