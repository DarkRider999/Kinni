// Marketplace display data: brand colours and the hardcoded sample catalogue
// shown on the homepage and /explore until prompts come from the API.

/** Brand palette (dark theme). Applied as inline styles since these are custom values. */
export const BRAND = {
  bg: '#0d0f14',
  bg2: '#161922',
  bg3: '#1e2330',
  border: '#2a3045',
  accent: '#6c63ff',
  accent2: '#ff6584',
  accent3: '#43e97b',
  text: '#e8eaf0',
  text2: '#9ba3ba',
} as const;

export type MarketplaceCategory = 'Midjourney' | 'ChatGPT' | 'DALL·E' | 'Stable Diffusion' | 'Lightroom';

export interface MarketplacePrompt {
  id: string;
  title: string;
  category: MarketplaceCategory;
  tier: 'free' | 'premium';
  rating: number;
  uses: number;
  description: string;
  prompt: string;
}

export const SAMPLE_PROMPTS: MarketplacePrompt[] = [
  { id: '1', title: 'Cinematic Portrait — Golden Hour', category: 'Midjourney', tier: 'free', rating: 4.8, uses: 2847, description: 'Breathtaking portrait photography with golden hour lighting', prompt: 'A stunning portrait of a person bathed in warm golden hour sunlight, shot on 85mm lens, bokeh background, cinematic color grading, hyper-realistic --ar 16:9 --v 6' },
  { id: '2', title: 'Product Photography — Minimalist', category: 'DALL·E', tier: 'premium', rating: 4.9, uses: 1523, description: 'Clean product shots with premium studio lighting', prompt: 'Professional product photography of [product] on pure white background, studio lighting, sharp focus, e-commerce style, ultra-high resolution' },
  { id: '3', title: 'Fantasy Landscape — Epic Scale', category: 'Stable Diffusion', tier: 'free', rating: 4.7, uses: 3291, description: 'Massive fantasy worlds with incredible detail', prompt: 'Epic fantasy landscape, towering mountains, magical aurora borealis, ancient ruins, volumetric fog, concept art style, 8k resolution, trending on artstation' },
  { id: '4', title: 'Business Email Writer', category: 'ChatGPT', tier: 'free', rating: 4.6, uses: 8432, description: 'Professional business communication templates', prompt: 'Write a professional [email type] email from [sender role] to [recipient role] about [topic]. Tone: [formal/friendly/urgent]. Length: [brief/detailed]. Include: subject line, greeting, body, CTA, sign-off.' },
  { id: '5', title: 'Neon Cyberpunk City', category: 'Midjourney', tier: 'premium', rating: 4.9, uses: 2156, description: 'Futuristic cityscape with vibrant neon aesthetics', prompt: 'Cyberpunk metropolis at night, neon signs reflecting on wet streets, flying vehicles, holographic advertisements, dense fog, blade runner aesthetic, --ar 21:9 --v 6 --stylize 750' },
  { id: '6', title: 'Instagram Reel Script', category: 'ChatGPT', tier: 'free', rating: 4.5, uses: 5678, description: 'Viral-ready short-form video scripts', prompt: 'Create a 30-second Instagram Reel script about [topic] for [target audience]. Include: hook (0-3s), value delivery (3-25s), CTA (25-30s). Use trending formats: POV, storytelling, tutorial.' },
  { id: '7', title: 'Lightroom Cinematic Edit', category: 'Lightroom', tier: 'premium', rating: 4.8, uses: 1876, description: 'Hollywood-grade color grading presets', prompt: 'XMP preset: Teal and orange color grade, Film grain 25%, Clarity +15, Dehaze +10, HSL: Orange Hue -15, Saturation +20, Blue Luminance +30, Shadows teal, Highlights warm.' },
  { id: '8', title: 'Logo Design — Minimal', category: 'DALL·E', tier: 'free', rating: 4.7, uses: 2341, description: 'Clean, memorable brand identity design', prompt: 'Minimalist logo for [company name] in [industry], geometric shapes, [primary color] and white, scalable vector style, no text, modern and timeless design' },
  { id: '9', title: 'AI Podcast Outline', category: 'ChatGPT', tier: 'free', rating: 4.4, uses: 4532, description: 'Structured podcast episode frameworks', prompt: 'Create a 45-minute podcast episode outline on [topic]. Format: Title, Hook Question, 5 main segments with talking points, guest questions if applicable, listener takeaways, CTA.' },
  { id: '10', title: 'Surreal Dream Portrait', category: 'Stable Diffusion', tier: 'premium', rating: 4.9, uses: 987, description: 'Otherworldly portraits with dreamlike quality', prompt: 'Surreal double exposure portrait, woman merged with nature landscape, soft dreamy atmosphere, translucent overlapping elements, artistic photography style, award-winning photo' },
  { id: '11', title: 'Architecture Visualization', category: 'Midjourney', tier: 'premium', rating: 4.8, uses: 1654, description: 'Photorealistic architectural renders', prompt: 'Photorealistic architectural visualization of [building type], exterior view, golden hour lighting, lush landscaping, high-end CGI quality, featured in Architectural Digest --ar 16:9 --v 6 --quality 2' },
  { id: '12', title: 'Video Script — YouTube', category: 'ChatGPT', tier: 'free', rating: 4.6, uses: 7123, description: 'Engaging long-form YouTube video scripts', prompt: 'Write a 10-minute YouTube video script about [topic] for [audience]. Include: clickbait-free hook, problem/solution structure, key points with examples, graphics cues [B-ROLL], subscribe CTA at 70% mark.' },
];

/** Curated "Trending This Week" picks, shared by the homepage and the Trending filter. */
export const TRENDING_IDS: readonly string[] = ['5', '4', '3', '10'];

/** Thumbnail gradient per category, standing in for preview images. */
export const CATEGORY_GRADIENTS: Record<MarketplaceCategory, string> = {
  Midjourney: 'linear-gradient(135deg, #6c63ff 0%, #ff6584 100%)',
  ChatGPT: 'linear-gradient(135deg, #10a37f 0%, #43e97b 100%)',
  'DALL·E': 'linear-gradient(135deg, #f7971e 0%, #ff6584 100%)',
  'Stable Diffusion': 'linear-gradient(135deg, #4facfe 0%, #6c63ff 100%)',
  Lightroom: 'linear-gradient(135deg, #1e3c72 0%, #2a9df4 100%)',
};

export const formatUses = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
