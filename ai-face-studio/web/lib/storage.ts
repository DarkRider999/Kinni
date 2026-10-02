import type { CharacterProfile, Project } from './types';

const PROJECTS_KEY = 'aifs.projects.v1';
const CHARACTERS_KEY = 'aifs.characters.v1';
const OWNER_SESSION_KEY = 'aifs.ownerSession.v1';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable (private mode) — fail silently, nothing the user can act on here.
  }
}

export function listProjects(): Project[] {
  return readJson<Project[]>(PROJECTS_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveProject(project: Project): void {
  const all = readJson<Project[]>(PROJECTS_KEY, []);
  writeJson(PROJECTS_KEY, [...all, project]);
}

export function deleteProject(id: string): void {
  const all = readJson<Project[]>(PROJECTS_KEY, []);
  writeJson(PROJECTS_KEY, all.filter((p) => p.id !== id));
}

export function toggleFavorite(id: string): void {
  const all = readJson<Project[]>(PROJECTS_KEY, []);
  writeJson(
    PROJECTS_KEY,
    all.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)),
  );
}

export function listCharacters(): CharacterProfile[] {
  return readJson<CharacterProfile[]>(CHARACTERS_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveCharacter(character: CharacterProfile): void {
  const all = readJson<CharacterProfile[]>(CHARACTERS_KEY, []);
  writeJson(CHARACTERS_KEY, [...all, character]);
}

export function deleteCharacter(id: string): void {
  const all = readJson<CharacterProfile[]>(CHARACTERS_KEY, []);
  writeJson(CHARACTERS_KEY, all.filter((c) => c.id !== id));
}

/**
 * Demo-only "is this browser the owner" flag. See README "What's real vs. mocked" and SPEC §15 —
 * this proves nothing to a server and must never be treated as real authentication.
 */
export function getOwnerSession(): { email: string } | null {
  return readJson<{ email: string } | null>(OWNER_SESSION_KEY, null);
}

export function setOwnerSession(email: string | null): void {
  writeJson(OWNER_SESSION_KEY, email ? { email } : null);
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
