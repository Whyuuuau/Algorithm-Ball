import { create } from "zustand";
import { ProjectConfig, CLASSIC_3_TOWERS_PRESET, MAZE_RINGS_PRESET } from "@asmr/schema";
import { SimStateSnapshot } from "@asmr/sim-core";
import { ExportProgress } from "../exporter/ExportDirector.js";
import { ScoutedSeedResult } from "../scout/SeedScout.js";

export type StudioTab = "scene" | "sound" | "look" | "arc" | "rules" | "export" | "scout";

export interface ProjectStore {
  config: ProjectConfig;
  isPlaying: boolean;
  currentFrame: number;
  simState: SimStateSnapshot | null;
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
  loadPreset: (name: "classic_3_towers" | "maze_rings") => void;
  setActiveTab: (tab: StudioTab) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentFrame: (frame: number) => void;
  setSimState: (state: SimStateSnapshot | null) => void;
  setPreviewScale: (scale: "540p" | "1080p") => void;

  setExporting: (exporting: boolean) => void;
  setExportProgress: (p: ExportProgress | null) => void;
  setExportedBlob: (blob: Blob | null) => void;

  setScouting: (scouting: boolean) => void;
  setScoutProgress: (progress: number) => void;
  setScoutedSeeds: (seeds: ScoutedSeedResult[]) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  config: CLASSIC_3_TOWERS_PRESET,
  isPlaying: false,
  currentFrame: 0,
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

  setConfig: (config) => set({ config, currentFrame: 0 }),
  updateConfig: (updater) => set((s) => ({ config: updater(s.config), currentFrame: 0 })),
  loadPreset: (name) => {
    if (name === "maze_rings") {
      set({ config: MAZE_RINGS_PRESET, currentFrame: 0, simState: null, isPlaying: false });
    } else {
      set({ config: CLASSIC_3_TOWERS_PRESET, currentFrame: 0, simState: null, isPlaying: false });
    }
  },
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentFrame: (currentFrame) => set({ currentFrame }),
  setSimState: (simState) => set({ simState }),
  setPreviewScale: (scale) => {
    if (scale === "1080p") {
      set({ previewWidth: 1080, previewHeight: 1920 });
    } else {
      set({ previewWidth: 540, previewHeight: 960 });
    }
  },

  setExporting: (isExporting) => set({ isExporting }),
  setExportProgress: (exportProgress) => set({ exportProgress }),
  setExportedBlob: (exportedBlob) => set({ exportedBlob }),

  setScouting: (isScouting) => set({ isScouting }),
  setScoutProgress: (scoutProgress) => set({ scoutProgress }),
  setScoutedSeeds: (scoutedSeeds) => set({ scoutedSeeds })
}));
