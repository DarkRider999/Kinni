export type StudioId =
  | 'face'
  | 'body'
  | 'fashion'
  | 'hair'
  | 'character'
  | 'photo'
  | 'analysis'
  | 'creator'
  | 'video'
  | 'restore';

export type LockKey = 'face' | 'hair' | 'body' | 'clothing' | 'background' | 'skin';
export type LockState = 'change' | 'lock';
export type Locks = Partial<Record<LockKey, LockState>>;

export type ControlKind = 'locks' | 'identity' | 'colorPicker' | 'stylePreset' | 'intensity';

export type ToolKind = 'edit' | 'analysis' | 'generate' | 'character-create';

export interface ToolDef {
  id: string;
  studio: StudioId;
  name: string;
  description: string;
  icon: string;
  kind: ToolKind;
  /** 0 = no upload accepted at all (not yet connected to a model). */
  maxUploads: number;
  controls: ControlKind[];
  defaultLocks: Locks;
  presetOptions?: string[];
  /** When false, the tool card still opens so the user can see why, but nothing can be generated. */
  available: boolean;
  unavailableReason?: string;
}

export interface StudioDef {
  id: StudioId;
  name: string;
  tagline: string;
  icon: string;
}

export type QcVerdict = 'pass' | 'fail';

export interface GenerationResult {
  resultDataUrl: string;
  qc: { verdict: QcVerdict; reason?: string };
  billable: boolean;
}

export interface Project {
  id: string;
  toolId: string;
  toolName: string;
  studio: StudioId;
  originalDataUrl: string;
  resultDataUrl: string;
  locks: Locks;
  identityStrength?: number;
  preset?: string;
  createdAt: number;
  favorite: boolean;
}

export interface CharacterProfile {
  id: string;
  name: string;
  sourceDataUrl: string;
  createdAt: number;
}

export interface BatchItem {
  id: string;
  fileName: string;
  originalDataUrl: string;
  status: 'queued' | 'processing' | 'done' | 'failed' | 'canceled';
  resultDataUrl?: string;
}

export interface EditPlanField {
  field: 'face' | 'hair' | 'clothing' | 'background' | 'lighting';
  action: 'preserve' | 'change';
  value?: string;
  enabled: boolean;
}
