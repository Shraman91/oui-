export interface ColorOption {
  id: string;
  name: string;
  hex: string;
}

export interface BrushSizeOption {
  id: string;
  name: string;
  size: number;
}

export const SKETCHBOARD_CONSTANTS = {
  CANVAS: {
    WIDTH: 1280,
    HEIGHT: 720,
    BACKGROUND_COLOR: '#ffffff',
    MAX_UNDO_STEPS: 25
  },
  DEFAULT_COLOR: '#3b1d28',
  DEFAULT_BRUSH_SIZE: 10,
  PALETTE: [
    { id: 'charcoal', name: 'Charcoal', hex: '#3b1d28' },
    { id: 'strawberry', name: 'Strawberry', hex: '#e11d48' },
    { id: 'babypink', name: 'Baby Pink', hex: '#f472b6' },
    { id: 'peach', name: 'Peach', hex: '#fb923c' },
    { id: 'sunshine', name: 'Sunshine', hex: '#facc15' },
    { id: 'mint', name: 'Mint Green', hex: '#22c55e' },
    { id: 'sky', name: 'Sky Blue', hex: '#0284c7' },
    { id: 'lavender', name: 'Lavender', hex: '#a855f7' },
    { id: 'white', name: 'White', hex: '#ffffff' }
  ] as const satisfies readonly ColorOption[],
  BRUSH_SIZES: [
    { id: 's', name: 'Fine', size: 4 },
    { id: 'm', name: 'Medium', size: 10 },
    { id: 'l', name: 'Thick', size: 20 },
    { id: 'xl', name: 'Chunky', size: 36 }
  ] as const satisfies readonly BrushSizeOption[]
} as const;
