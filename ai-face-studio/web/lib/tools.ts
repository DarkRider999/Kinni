import type { StudioDef, ToolDef } from './types';

export const STUDIOS: StudioDef[] = [
  { id: 'face', name: 'Face Studio', tagline: 'Swap, morph, age, portrait', icon: 'face' },
  { id: 'body', name: 'Body Studio', tagline: 'Shape, pose, fitness', icon: 'body' },
  { id: 'fashion', name: 'Fashion Studio', tagline: 'Outfits, try-on, accessories', icon: 'clothing' },
  { id: 'hair', name: 'Hair & Beauty', tagline: 'Color, style, makeup', icon: 'hair' },
  { id: 'character', name: 'Character Studio', tagline: 'Fantasy, anime, sci-fi', icon: 'character' },
  { id: 'photo', name: 'Photo Studio', tagline: 'Enhance, upscale, backgrounds', icon: 'photo' },
  { id: 'restore', name: 'Restore & Enhance', tagline: 'Old photo repair', icon: 'restore' },
  { id: 'analysis', name: 'AI Analysis', tagline: 'Symmetry, style, quality', icon: 'analysis' },
  { id: 'creator', name: 'AI Creator', tagline: 'Describe it, get an edit plan', icon: 'sparkle' },
  { id: 'video', name: 'Video Studio', tagline: 'Architecture only — see SPEC §11', icon: 'video' },
];

const faceLockAllRest = { face: 'change', hair: 'lock', body: 'lock', clothing: 'lock', background: 'lock', skin: 'lock' } as const;

export const TOOLS: ToolDef[] = [
  // Face Studio
  {
    id: 'face-swap', studio: 'face', name: 'Face Swap',
    description: 'Swap in a reference face while preserving everything else by default.',
    icon: 'face', kind: 'edit', maxUploads: 1, controls: ['locks', 'identity'],
    defaultLocks: faceLockAllRest, available: true,
  },
  {
    id: 'multi-face-swap', studio: 'face', name: 'Multiple Face Swap',
    description: 'Map each detected face to a different reference.',
    icon: 'users', kind: 'edit', maxUploads: 1, controls: ['locks'],
    defaultLocks: faceLockAllRest, available: false,
    unavailableReason: 'Needs server-side multi-face detection and per-person mapping — see SPEC §4.2. Faking this client-side would mislead you about what the result is.',
  },
  {
    id: 'batch-face-swap', studio: 'face', name: 'Batch Face Swap',
    description: 'Process up to 20 photos in one queue — pause, retry, download all as a ZIP.',
    icon: 'grid', kind: 'edit', maxUploads: 20, controls: ['locks', 'identity'],
    defaultLocks: faceLockAllRest, available: true,
  },
  {
    id: 'face-age', studio: 'face', name: 'Age Transformation',
    description: 'Preview a younger or older appearance. Always labeled as a visual transformation.',
    icon: 'face', kind: 'edit', maxUploads: 1, controls: ['locks', 'intensity'],
    defaultLocks: faceLockAllRest, available: true,
  },
  {
    id: 'ai-portrait', studio: 'face', name: 'AI Portrait Generator',
    description: 'Corporate, casual, luxury and creative portrait styles from one photo.',
    icon: 'face', kind: 'edit', maxUploads: 1, controls: ['locks', 'stylePreset'],
    defaultLocks: faceLockAllRest, presetOptions: ['Corporate', 'Casual', 'Luxury', 'Creative'], available: true,
  },
  {
    id: 'profile-picture', studio: 'face', name: 'AI Profile Picture Generator',
    description: 'Multiple profile-picture styles from one upload.',
    icon: 'face', kind: 'edit', maxUploads: 1, controls: ['locks', 'stylePreset'],
    defaultLocks: faceLockAllRest,
    presetOptions: ['Corporate', 'Casual', 'Luxury', 'Gamer', 'Influencer', 'Executive', 'Travel'], available: true,
  },

  // Body Studio
  {
    id: 'body-shape', studio: 'body', name: 'Body Shape Visualizer',
    description: 'A visual preview, not a factual body assessment.',
    icon: 'body', kind: 'edit', maxUploads: 1, controls: ['locks', 'intensity'],
    defaultLocks: { body: 'change', face: 'lock', hair: 'lock', clothing: 'lock', background: 'lock' }, available: true,
  },
  {
    id: 'pose-changer', studio: 'body', name: 'Pose Changer',
    description: 'Re-pose a subject while preserving identity and background.',
    icon: 'body', kind: 'edit', maxUploads: 1, controls: ['locks'],
    defaultLocks: { body: 'change', face: 'lock' }, available: false,
    unavailableReason: 'Pose-conditioned synthesis needs a connected generative model — see SPEC §8.4.',
  },

  // Fashion Studio
  {
    id: 'clothes-changer', studio: 'fashion', name: 'AI Clothes Changer',
    description: 'Swap an outfit from a preset while keeping face, hair and background.',
    icon: 'clothing', kind: 'edit', maxUploads: 1, controls: ['locks', 'stylePreset'],
    defaultLocks: { clothing: 'change', face: 'lock', hair: 'lock', body: 'lock', background: 'lock' },
    presetOptions: ['Business suit', 'Streetwear', 'Wedding outfit', 'Traditional', 'Luxury'], available: true,
  },
  {
    id: 'accessory-changer', studio: 'fashion', name: 'Glasses / Hat / Jewelry',
    description: 'Try on accessories without changing anything else.',
    icon: 'clothing', kind: 'edit', maxUploads: 1, controls: ['locks', 'stylePreset'],
    defaultLocks: { clothing: 'change', face: 'lock', hair: 'lock', body: 'lock', background: 'lock' },
    presetOptions: ['Glasses', 'Hat', 'Necklace'], available: true,
  },

  // Hair & Beauty
  {
    id: 'hairstyle-changer', studio: 'hair', name: 'Hairstyle Changer',
    description: 'Short, long, curly, buzz cut, braids and more.',
    icon: 'hair', kind: 'edit', maxUploads: 1, controls: ['locks', 'stylePreset'],
    defaultLocks: { hair: 'change', face: 'lock', body: 'lock', clothing: 'lock', background: 'lock' },
    presetOptions: ['Short', 'Long', 'Curly', 'Bob', 'Buzz cut', 'Braids'], available: true,
  },
  {
    id: 'hair-color-changer', studio: 'hair', name: 'Hair Color Changer',
    description: 'Pick any color, keep everything else locked.',
    icon: 'hair', kind: 'edit', maxUploads: 1, controls: ['locks', 'colorPicker'],
    defaultLocks: { hair: 'change', face: 'lock', body: 'lock', clothing: 'lock', background: 'lock' },
    presetOptions: ['#1C1C1E', '#4A2E1E', '#D9A441', '#E5C9A8', '#C0C0C8', '#B22234', '#3B82F6', '#8B5CF6', '#EC4899'],
    available: true,
  },
  {
    id: 'makeup-studio', studio: 'hair', name: 'Makeup Studio',
    description: 'Natural, professional, party, wedding and fantasy looks with an intensity slider.',
    icon: 'hair', kind: 'edit', maxUploads: 1, controls: ['locks', 'stylePreset', 'intensity'],
    defaultLocks: { skin: 'change', face: 'lock', hair: 'lock', body: 'lock', clothing: 'lock', background: 'lock' },
    presetOptions: ['Natural', 'Professional', 'Party', 'Wedding', 'Fantasy'], available: true,
  },
  {
    id: 'beard-mustache', studio: 'hair', name: 'Beard & Mustache Styler',
    description: 'Clean, stubble, full beard or mustache only.',
    icon: 'hair', kind: 'edit', maxUploads: 1, controls: ['locks', 'stylePreset'],
    defaultLocks: { hair: 'change', face: 'lock', body: 'lock', clothing: 'lock', background: 'lock' },
    presetOptions: ['Clean', 'Stubble', 'Full beard', 'Mustache'], available: true,
  },

  // Character Studio
  {
    id: 'character-swap', studio: 'character', name: 'Character Swap',
    description: 'Cyberpunk, anime, fantasy, superhero and more — identity preserved.',
    icon: 'character', kind: 'edit', maxUploads: 1, controls: ['locks', 'stylePreset', 'identity'],
    defaultLocks: { face: 'change', hair: 'change', clothing: 'change', background: 'change', body: 'lock' },
    presetOptions: ['Cyberpunk', 'Anime', 'Fantasy warrior', 'Superhero', 'Sci-fi', 'Royal'], available: true,
  },
  {
    id: 'create-character', studio: 'character', name: 'Create My Character',
    description: 'Upload once, reuse the same identity across every tool in this app.',
    icon: 'star', kind: 'character-create', maxUploads: 1, controls: [], defaultLocks: {}, available: true,
  },

  // Photo Studio
  {
    id: 'photo-enhancer', studio: 'photo', name: 'AI Photo Enhancer',
    description: 'Sharpness, clarity, color and denoise in one pass.',
    icon: 'photo', kind: 'edit', maxUploads: 1, controls: ['intensity'], defaultLocks: {}, available: true,
  },
  {
    id: 'upscaler', studio: 'photo', name: 'AI Image Upscaler',
    description: '2x or 4x upscale.',
    icon: 'photo', kind: 'edit', maxUploads: 1, controls: ['stylePreset'], defaultLocks: {},
    presetOptions: ['2x', '4x'], available: true,
  },
  {
    id: 'background-remover', studio: 'photo', name: 'Background Remover',
    description: 'Cut the subject out onto a transparent background.',
    icon: 'photo', kind: 'edit', maxUploads: 1, controls: [], defaultLocks: {}, available: true,
  },
  {
    id: 'background-changer', studio: 'photo', name: 'Background Changer',
    description: 'Replace the background scene only.',
    icon: 'photo', kind: 'edit', maxUploads: 1, controls: ['locks', 'stylePreset'],
    defaultLocks: { background: 'change', face: 'lock', hair: 'lock', body: 'lock', clothing: 'lock' },
    presetOptions: ['Studio', 'Neon city', 'Beach sunset', 'Office', 'Dubai skyline'], available: true,
  },
  {
    id: 'object-remover', studio: 'photo', name: 'Object Remover',
    description: 'Remove an unwanted object and fill the gap.',
    icon: 'photo', kind: 'edit', maxUploads: 1, controls: ['intensity'], defaultLocks: {}, available: true,
  },
  {
    id: 'headshot-presets', studio: 'photo', name: 'Professional Headshot',
    description: 'Passport, LinkedIn, CV and corporate presets.',
    icon: 'photo', kind: 'edit', maxUploads: 1, controls: ['stylePreset'], defaultLocks: {},
    presetOptions: ['Passport', 'LinkedIn', 'CV', 'Corporate'], available: true,
  },

  // Restore & Enhance
  {
    id: 'old-photo-restore', studio: 'restore', name: 'Old Photo Restoration',
    description: 'Repair scratches, fading and damage.',
    icon: 'restore', kind: 'edit', maxUploads: 1, controls: ['intensity'], defaultLocks: {}, available: true,
  },
  {
    id: 'colorize', studio: 'restore', name: 'Colorize Old Photo',
    description: 'Adds color to a black-and-white photo. Always labeled "AI-generated reconstruction."',
    icon: 'restore', kind: 'edit', maxUploads: 1, controls: ['intensity'], defaultLocks: {}, available: true,
  },
  {
    id: 'low-light-enhance', studio: 'restore', name: 'Low-Light Enhancement',
    description: 'Brighten and denoise a dark photo.',
    icon: 'restore', kind: 'edit', maxUploads: 1, controls: ['intensity'], defaultLocks: {}, available: true,
  },

  // AI Analysis (no image is generated — a report is shown instead)
  {
    id: 'face-shape-detector', studio: 'analysis', name: 'Face Shape Detector',
    description: 'A heuristic estimate of face shape from the photo.',
    icon: 'analysis', kind: 'analysis', maxUploads: 1, controls: [], defaultLocks: {}, available: true,
  },
  {
    id: 'symmetry-analysis', studio: 'analysis', name: 'Face Symmetry Analysis',
    description: 'Compares the left and right half of the face.',
    icon: 'analysis', kind: 'analysis', maxUploads: 1, controls: [], defaultLocks: {}, available: true,
  },
  {
    id: 'photo-quality-analysis', studio: 'analysis', name: 'Photo Quality Analysis',
    description: 'Resolution, brightness and contrast estimate.',
    icon: 'analysis', kind: 'analysis', maxUploads: 1, controls: [], defaultLocks: {}, available: true,
  },
  {
    id: 'visual-style-analyzer', studio: 'analysis', name: 'Visual Style Analyzer',
    description: 'Estimates the dominant palette and suggests a matching tool.',
    icon: 'analysis', kind: 'analysis', maxUploads: 1, controls: [], defaultLocks: {}, available: true,
  },

  // AI Creator
  {
    id: 'ai-creator', studio: 'creator', name: 'AI Creator',
    description: 'Describe the change in your own words — review the edit plan before generating.',
    icon: 'sparkle', kind: 'generate', maxUploads: 1, controls: ['locks'], defaultLocks: {}, available: true,
  },

  // Video Studio — architecture only (SPEC §11), never fakes a result
  {
    id: 'video-face-swap', studio: 'video', name: 'Video Face Swap',
    description: 'Architecture only — no video model connected yet.',
    icon: 'video', kind: 'edit', maxUploads: 0, controls: [], defaultLocks: {}, available: false,
    unavailableReason: 'No video model is connected yet (SPEC §11 defines the interface only). Uploading a video here would go nowhere, so upload is disabled rather than faked.',
  },
  {
    id: 'talking-portrait', studio: 'video', name: 'Talking Portrait',
    description: 'Architecture only — no video model connected yet.',
    icon: 'video', kind: 'edit', maxUploads: 0, controls: [], defaultLocks: {}, available: false,
    unavailableReason: 'No video model is connected yet (SPEC §11 defines the interface only). Uploading a video here would go nowhere, so upload is disabled rather than faked.',
  },
];

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function toolsByStudio(studio: string): ToolDef[] {
  return TOOLS.filter((t) => t.studio === studio);
}
