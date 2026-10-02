import { colors } from "@/theme/colors";
import type { MotionCategory, MotionItem } from "@/types";

export const motionCategories: MotionCategory[] = [
  {
    id: "logo-animations",
    title: "Logo Animations",
    description: "Glossy-R reveals, headphone pulses & hologram wipes for your brand mark.",
    icon: "alpha-r-circle",
    gradient: [colors.neonRed, colors.neonPurple],
  },
  {
    id: "transitions",
    title: "Transitions",
    description: "Swipe, strobe & shatter transitions to cut between sets and scenes.",
    icon: "transition",
    gradient: [colors.neonPurple, colors.neonBlue],
  },
  {
    id: "background-loops",
    title: "Background Loops",
    description: "Seamless looping stage backdrops — rings, scanlines, particle fog.",
    icon: "infinity",
    gradient: [colors.neonBlue, colors.neonRed],
  },
  {
    id: "text-animations",
    title: "Text Animations",
    description: "Kinetic typography for track titles, lower-thirds & callouts.",
    icon: "format-text-variant",
    gradient: [colors.neonRed, colors.neonBlueSoft],
  },
  {
    id: "event-visuals",
    title: "Event Visuals",
    description: "Countdowns, date reveals & venue cards for gigs and livestreams.",
    icon: "calendar-star",
    gradient: [colors.neonPurple, colors.neonRedSoft],
  },
  {
    id: "overlay-fx",
    title: "Overlay FX",
    description: "Sparks, pulses & particle bursts to layer over any footage.",
    icon: "shimmer",
    gradient: [colors.neonBlue, colors.neonPurpleSoft],
  },
];

export const motionItems: MotionItem[] = [
  // Logo Animations
  {
    id: "logo-glossy-reveal",
    categoryId: "logo-animations",
    title: "Glossy R Reveal",
    description: "The signature red R ignites from a spark, headphones snap into place, ring sweeps outward.",
    kind: "video",
    duration: "0:05",
    tags: ["Intro", "Logo", "Signature"],
    pattern: "pulse-rings",
    accent: "red",
    bpmReady: true,
  },
  {
    id: "logo-hologram-wipe",
    categoryId: "logo-animations",
    title: "Hologram Wipe",
    description: "DJ silhouette materializes in scanlines before the logo locks center-stage.",
    kind: "video",
    duration: "0:04",
    tags: ["Hologram", "Cinematic", "Intro"],
    pattern: "scanlines",
    accent: "blue",
    bpmReady: false,
  },
  {
    id: "logo-particle-build",
    categoryId: "logo-animations",
    title: "Particle Build",
    description: "Thousands of embers converge into the R mark, then burst into the neon ring.",
    kind: "video",
    duration: "0:06",
    tags: ["Particles", "Build-up", "Intro"],
    pattern: "burst",
    accent: "purple",
    bpmReady: true,
  },
  {
    id: "logo-strobe-stamp",
    categoryId: "logo-animations",
    title: "Strobe Stamp",
    description: "Hard-cut strobe flashes stamp the logo on beat — built for drops.",
    kind: "video",
    duration: "0:03",
    tags: ["Strobe", "Drop"],
    pattern: "strobe",
    accent: "red",
    bpmReady: true,
  },

  // Transitions
  {
    id: "trans-ring-swipe",
    categoryId: "transitions",
    title: "Neon Ring Swipe",
    description: "A glowing ring sweeps across frame, wiping from one scene to the next.",
    kind: "video",
    duration: "0:02",
    tags: ["Swipe", "Smooth"],
    pattern: "sweep",
    accent: "blue",
    bpmReady: true,
  },
  {
    id: "trans-shatter-cut",
    categoryId: "transitions",
    title: "Shatter Cut",
    description: "Glass-like shards burst outward on the beat, revealing the next shot.",
    kind: "video",
    duration: "0:01",
    tags: ["Impact", "Beat Cut"],
    pattern: "strobe",
    accent: "purple",
    bpmReady: true,
  },
  {
    id: "trans-spark-wipe",
    categoryId: "transitions",
    title: "Spark Wipe",
    description: "A trail of sparks drags across the frame leaving a clean cut behind it.",
    kind: "video",
    duration: "0:02",
    tags: ["Sparks", "Energetic"],
    pattern: "burst",
    accent: "red",
    bpmReady: false,
  },

  // Background Loops
  {
    id: "bg-ring-pulse",
    categoryId: "background-loops",
    title: "Pulse Ring Stage",
    description: "Concentric neon rings breathe in and out — a seamless 8-second loop.",
    kind: "video",
    duration: "0:08 loop",
    tags: ["Loop", "Stage", "Reel"],
    pattern: "pulse-rings",
    accent: "purple",
    bpmReady: true,
  },
  {
    id: "bg-scanline-fog",
    categoryId: "background-loops",
    title: "Scanline Fog",
    description: "Slow drifting scanlines through particle fog for moody set backdrops.",
    kind: "video",
    duration: "0:10 loop",
    tags: ["Loop", "Moody"],
    pattern: "scanlines",
    accent: "blue",
    bpmReady: false,
  },
  {
    id: "bg-particle-drift",
    categoryId: "background-loops",
    title: "Ember Drift",
    description: "Embers and particles drift upward endlessly behind your mix.",
    kind: "video",
    duration: "0:12 loop",
    tags: ["Loop", "Ambient", "Reel"],
    pattern: "burst",
    accent: "red",
    bpmReady: false,
  },

  // Text Animations
  {
    id: "text-kinetic-title",
    categoryId: "text-animations",
    title: "Kinetic Track Title",
    description: "Track & artist name snap in letter-by-letter with a neon trail.",
    kind: "video",
    duration: "0:03",
    tags: ["Lower Third", "Kinetic"],
    pattern: "typewriter",
    accent: "blue",
    bpmReady: false,
  },
  {
    id: "text-glow-callout",
    categoryId: "text-animations",
    title: "Glow Callout",
    description: "Punchy callout text with pulsing glow — perfect for \"NOW PLAYING\".",
    kind: "video",
    duration: "0:02",
    tags: ["Callout", "Glow"],
    pattern: "pulse-rings",
    accent: "red",
    bpmReady: true,
  },

  // Event Visuals
  {
    id: "event-countdown",
    categoryId: "event-visuals",
    title: "Set Countdown",
    description: "Neon numerals count down to set time with a ring sweep on each tick.",
    kind: "video",
    duration: "0:10 loop",
    tags: ["Countdown", "Livestream"],
    pattern: "sweep",
    accent: "purple",
    bpmReady: true,
  },
  {
    id: "event-date-reveal",
    categoryId: "event-visuals",
    title: "Date Reveal Card",
    description: "Venue, date & lineup reveal on a glossy hologram card.",
    kind: "poster",
    duration: "Static",
    tags: ["Poster", "Lineup"],
    pattern: "scanlines",
    accent: "blue",
    bpmReady: false,
  },
  {
    id: "event-show-poster",
    categoryId: "event-visuals",
    title: "Show Poster Card",
    description: "Full-bleed hologram poster with the glossy R mark and headline slot.",
    kind: "poster",
    duration: "Static",
    tags: ["Poster", "Gig"],
    pattern: "pulse-rings",
    accent: "red",
    bpmReady: false,
  },
  {
    id: "event-lineup-grid",
    categoryId: "event-visuals",
    title: "Lineup Grid Poster",
    description: "Multi-act lineup grid framed by the neon ring, ready for print or IG.",
    kind: "poster",
    duration: "Static",
    tags: ["Poster", "Lineup"],
    pattern: "sweep",
    accent: "purple",
    bpmReady: false,
  },

  // Overlay FX
  {
    id: "fx-spark-overlay",
    categoryId: "overlay-fx",
    title: "Spark Shower",
    description: "Loopable spark shower to layer over any clip at 50% opacity.",
    kind: "video",
    duration: "0:06 loop",
    tags: ["Overlay", "Sparks", "Reel"],
    pattern: "burst",
    accent: "red",
    bpmReady: true,
  },
  {
    id: "fx-beat-pulse",
    categoryId: "overlay-fx",
    title: "Beat Pulse Flash",
    description: "Full-frame glow flashes synced to your BPM — drop it on the drum bus.",
    kind: "video",
    duration: "0:04 loop",
    tags: ["Overlay", "Beat Sync", "Reel"],
    pattern: "strobe",
    accent: "purple",
    bpmReady: true,
  },
];

export function getCategory(id: string) {
  return motionCategories.find((category) => category.id === id);
}

export function getItemsForCategory(id: string) {
  return motionItems.filter((item) => item.categoryId === id);
}

export function getItem(id: string) {
  return motionItems.find((item) => item.id === id);
}

export function getItemsByTag(tag: string) {
  return motionItems.filter((item) => item.tags.includes(tag));
}

export function getItemsByKind(kind: MotionItem["kind"]) {
  return motionItems.filter((item) => item.kind === kind);
}
