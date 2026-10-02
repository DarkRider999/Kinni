import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ExportConfig, GeneratedAsset, MotionItem, ProjectConfig } from "@/types";

const LIBRARY_STORAGE_KEY = "splitfire.library.v1";

const defaultExportConfig: ExportConfig = {
  resolution: "1080p",
  format: "mp4",
  loop: false,
  neonEnhance: true,
};

function defaultConfigFor(item?: MotionItem): ProjectConfig {
  return {
    primaryColor: item?.accent ?? "red",
    secondaryColor: item?.accent === "blue" ? "purple" : "blue",
    glowIntensity: 65,
    particleDensity: 45,
    beatSyncEnabled: item?.bpmReady ?? false,
    bpm: 128,
    timelinePhase: 0,
  };
}

interface State {
  configs: Record<string, ProjectConfig>;
  generated: Record<string, GeneratedAsset>;
  exportConfigs: Record<string, ExportConfig>;
  libraryItemIds: string[];
  libraryHydrated: boolean;
}

type Action =
  | { type: "SET_CONFIG"; itemId: string; patch: Partial<ProjectConfig>; fallback: MotionItem | undefined }
  | { type: "SET_GENERATED"; itemId: string; patch: Partial<GeneratedAsset>; fallback: MotionItem | undefined }
  | { type: "SET_EXPORT_CONFIG"; itemId: string; patch: Partial<ExportConfig> }
  | { type: "ADD_TO_LIBRARY"; itemId: string }
  | { type: "REMOVE_FROM_LIBRARY"; itemId: string }
  | { type: "HYDRATE_LIBRARY"; ids: string[] };

const initialState: State = {
  configs: {},
  generated: {},
  exportConfigs: {},
  libraryItemIds: [],
  libraryHydrated: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_CONFIG": {
      const current = state.configs[action.itemId] ?? defaultConfigFor(action.fallback);
      return {
        ...state,
        configs: { ...state.configs, [action.itemId]: { ...current, ...action.patch } },
      };
    }
    case "SET_GENERATED": {
      const current: GeneratedAsset =
        state.generated[action.itemId] ??
        ({
          itemId: action.itemId,
          status: "idle",
          progress: 0,
          config: state.configs[action.itemId] ?? defaultConfigFor(action.fallback),
        } as GeneratedAsset);
      return {
        ...state,
        generated: { ...state.generated, [action.itemId]: { ...current, ...action.patch } },
      };
    }
    case "SET_EXPORT_CONFIG": {
      const current = state.exportConfigs[action.itemId] ?? defaultExportConfig;
      return {
        ...state,
        exportConfigs: { ...state.exportConfigs, [action.itemId]: { ...current, ...action.patch } },
      };
    }
    case "ADD_TO_LIBRARY": {
      if (state.libraryItemIds.includes(action.itemId)) return state;
      const ids = [action.itemId, ...state.libraryItemIds];
      persistLibrary(ids);
      return { ...state, libraryItemIds: ids };
    }
    case "REMOVE_FROM_LIBRARY": {
      const ids = state.libraryItemIds.filter((id) => id !== action.itemId);
      persistLibrary(ids);
      return { ...state, libraryItemIds: ids };
    }
    case "HYDRATE_LIBRARY":
      return { ...state, libraryItemIds: action.ids, libraryHydrated: true };
    default:
      return state;
  }
}

function persistLibrary(ids: string[]) {
  AsyncStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
}

interface ProjectStoreContextValue {
  state: State;
  dispatch: React.Dispatch<Action>;
}

const ProjectStoreContext = createContext<ProjectStoreContextValue | null>(null);

export function ProjectStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    AsyncStorage.getItem(LIBRARY_STORAGE_KEY)
      .then((raw) => {
        if (raw) dispatch({ type: "HYDRATE_LIBRARY", ids: JSON.parse(raw) });
        else dispatch({ type: "HYDRATE_LIBRARY", ids: [] });
      })
      .catch(() => dispatch({ type: "HYDRATE_LIBRARY", ids: [] }));
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <ProjectStoreContext.Provider value={value}>{children}</ProjectStoreContext.Provider>;
}

function useStore() {
  const ctx = useContext(ProjectStoreContext);
  if (!ctx) throw new Error("useStore must be used within ProjectStoreProvider");
  return ctx;
}

export function useProjectConfig(itemId: string, item?: MotionItem): [ProjectConfig, (patch: Partial<ProjectConfig>) => void] {
  const { state, dispatch } = useStore();
  const config = state.configs[itemId] ?? defaultConfigFor(item);
  const update = useCallback(
    (patch: Partial<ProjectConfig>) => dispatch({ type: "SET_CONFIG", itemId, patch, fallback: item }),
    [dispatch, itemId, item]
  );
  return [config, update];
}

export function useGeneratedAsset(itemId: string, item?: MotionItem): [GeneratedAsset, (patch: Partial<GeneratedAsset>) => void] {
  const { state, dispatch } = useStore();
  const asset: GeneratedAsset =
    state.generated[itemId] ?? { itemId, status: "idle", progress: 0, config: state.configs[itemId] ?? defaultConfigFor(item) };
  const update = useCallback(
    (patch: Partial<GeneratedAsset>) => dispatch({ type: "SET_GENERATED", itemId, patch, fallback: item }),
    [dispatch, itemId, item]
  );
  return [asset, update];
}

export function useExportConfig(itemId: string): [ExportConfig, (patch: Partial<ExportConfig>) => void] {
  const { state, dispatch } = useStore();
  const config = state.exportConfigs[itemId] ?? defaultExportConfig;
  const update = useCallback(
    (patch: Partial<ExportConfig>) => dispatch({ type: "SET_EXPORT_CONFIG", itemId, patch }),
    [dispatch, itemId]
  );
  return [config, update];
}

export function useLibrary() {
  const { state, dispatch } = useStore();
  const add = useCallback((itemId: string) => dispatch({ type: "ADD_TO_LIBRARY", itemId }), [dispatch]);
  const remove = useCallback((itemId: string) => dispatch({ type: "REMOVE_FROM_LIBRARY", itemId }), [dispatch]);
  const has = useCallback((itemId: string) => state.libraryItemIds.includes(itemId), [state.libraryItemIds]);
  return { ids: state.libraryItemIds, add, remove, has, hydrated: state.libraryHydrated };
}
