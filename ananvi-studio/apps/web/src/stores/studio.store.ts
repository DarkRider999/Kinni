import { create } from 'zustand';
import { CaptionStyle, AIVideoStyle, IJob } from '@ananvi/shared';

interface StudioState {
  url: string;
  clipCount: number;
  captionStyle: CaptionStyle;
  captionLanguage: string;
  aiVideoStyle: AIVideoStyle | null;
  activeJob: IJob | null;

  setUrl: (url: string) => void;
  setClipCount: (n: number) => void;
  setCaptionStyle: (s: CaptionStyle) => void;
  setCaptionLanguage: (l: string) => void;
  setAiVideoStyle: (s: AIVideoStyle | null) => void;
  setActiveJob: (j: IJob | null) => void;
  reset: () => void;
}

export const useStudioStore = create<StudioState>()((set) => ({
  url: '',
  clipCount: 10,
  captionStyle: CaptionStyle.EXCITED,
  captionLanguage: 'en',
  aiVideoStyle: null,
  activeJob: null,

  setUrl: (url) => set({ url }),
  setClipCount: (clipCount) => set({ clipCount }),
  setCaptionStyle: (captionStyle) => set({ captionStyle }),
  setCaptionLanguage: (captionLanguage) => set({ captionLanguage }),
  setAiVideoStyle: (aiVideoStyle) => set({ aiVideoStyle }),
  setActiveJob: (activeJob) => set({ activeJob }),
  reset: () => set({
    url: '', clipCount: 10, captionStyle: CaptionStyle.EXCITED,
    captionLanguage: 'en', aiVideoStyle: null, activeJob: null,
  }),
}));
