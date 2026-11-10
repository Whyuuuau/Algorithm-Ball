import { create } from "zustand";
import {
  type ProjectConfig,
  CLASSIC_3_TOWERS_PRESET,
  PRESETS,
  parseProjectConfig
} from "@asmr/schema";
import type { SimSnapshot } from "@asmr/sim-core";
import type { ExportProgress } from "../exporter/ExportDirector.js";
import type { ScoutedSeedResult } from "../scout/SeedScout.js";

export type StudioTab = "scene" | "physics" | "sound" | "look" | "arc" | "export";

const STORAGE_KEY = "asmr_studio_custom_presets_v2";

function loadSavedPresets(): Record<string, ProjectConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ProjectConfig>;
  } catch {
    return {};
  }
}

export interface ProjectStore {
  config: ProjectConfig;
  undoStack: ProjectConfig[];
  redoStack: ProjectConfig[];
  savedPresets: Record<string, ProjectConfig>;

  isPlaying: boolean;
  currentFrame: number;
  seekFrame: number | null;
  resetCounter: number;
  simState: SimSnapshot | null;
  activeTab: StudioTab;
  previewWidth: number;
  previewHeight: number;

  isExporting: boolean;
  exportProgress: ExportProgress | null;
  exportedBlob: Blob | null;

  isScouting: boolean;
  scoutProgress: number;
  scoutedSeeds: ScoutedSeedResult[];

  // Actions
  setConfig: (config: ProjectConfig) => void;
  updateConfig: (updater: (prev: ProjectConfig) => ProjectConfig) => void;
  undo: () => void;
  redo: () => void;
  loadPreset: (key: string) => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (name: string) => void;
  importJsonConfig: (jsonStr: string) => { ok: boolean; error?: string };

  setActiveTab: (tab: StudioTab) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentFrame: (frame: number) => void;
  requestSeek: (frame: number) => void;
  clearSeek: () => void;
  triggerReset: () => void;
  setSimState: (state: SimSnapshot | null) => void;
  setPreviewScale: (scale: "540p" | "1080p") => void;

  setExporting: (exporting: boolean) => void;
  setExportProgress: (p: ExportProgress | null) => void;
  setExportedBlob: (blob: Blob | null) => void;

  setScouting: (scouting: boolean) => void;
  setScoutProgress: (progress: number) => void;
  setScoutedSeeds: (seeds: ScoutedSeedResult[]) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  config: structuredClone(CLASSIC_3_TOWERS_PRESET),
  undoStack: [],
  redoStack: [],
  savedPresets: loadSavedPresets(),

  isPlaying: false,
  currentFrame: 0,
  seekFrame: null,
  resetCounter: 0,
  simState: null,
  activeTab: "scene",
  previewWidth: 540,
  previewHeight: 960,

  isExporting: false,
  exportProgress: null,
  exportedBlob: null,

  isScouting: false,
  scoutProgress: 0,
  scoutedSeeds: [],

  setConfig: (config) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-29), s.config],
      redoStack: [],
      config: structuredClone(config),
      currentFrame: 0,
      resetCounter: s.resetCounter + 1
    })),

  updateConfig: (updater) =>
    set((s) => {
      const next = updater(structuredClone(s.config));
      return {
        undoStack: [...s.undoStack.slice(-29), s.config],
        redoStack: [],
        config: next
      };
    }),

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s;
      const prev = s.undoStack[s.undoStack.length - 1];
      return {
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, s.config],
        config: structuredClone(prev),
        resetCounter: s.resetCounter + 1
      };
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return s;
      const next = s.redoStack[s.redoStack.length - 1];
      return {
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, s.config],
        config: structuredClone(next),
        resetCounter: s.resetCounter + 1
      };
    }),

  loadPreset: (key) => {
    const builtIn = PRESETS[key]?.config;
    const custom = get().savedPresets[key];
    const target = builtIn || custom;
    if (!target) return;
    set((s) => ({
      undoStack: [...s.undoStack.slice(-29), s.config],
      redoStack: [],
      config: structuredClone(target),
      currentFrame: 0,
      isPlaying: false,
      resetCounter: s.resetCounter + 1
    }));
  },

  saveCustomPreset: (name) => {
    const clean = name.trim();
    if (!clean) return;
    set((s) => {
      const next = { ...s.savedPresets, [clean]: structuredClone(s.config) };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return { savedPresets: next };
    });
  },

  deleteCustomPreset: (name) =>
    set((s) => {
      const next = { ...s.savedPresets };
      delete next[name];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return { savedPresets: next };
    }),

  importJsonConfig: (jsonStr) => {
    try {
      const raw = JSON.parse(jsonStr);
      const parsed = parseProjectConfig(raw);
      get().setConfig(parsed);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  setActiveTab: (activeTab) => set({ activeTab }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentFrame: (currentFrame) => set({ currentFrame }),
  requestSeek: (frame) => set({ isPlaying: false, seekFrame: frame }),
  clearSeek: () => set({ seekFrame: null }),
  triggerReset: () => set((s) => ({ isPlaying: false, currentFrame: 0, resetCounter: s.resetCounter + 1 })),
  setSimState: (simState) => set({ simState }),
  setPreviewScale: (scale) =>
    set(scale === "1080p" ? { previewWidth: 1080, previewHeight: 1920 } : { previewWidth: 540, previewHeight: 960 }),

  setExporting: (isExporting) => set({ isExporting }),
  setExportProgress: (exportProgress) => set({ exportProgress }),
  setExportedBlob: (exportedBlob) => set({ exportedBlob }),

  setScouting: (isScouting) => set({ isScouting }),
  setScoutProgress: (scoutProgress) => set({ scoutProgress }),
  setScoutedSeeds: (scoutedSeeds) => set({ scoutedSeeds })
}));
