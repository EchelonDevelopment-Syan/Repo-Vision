/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export enum ViewMode {
  HOME = 'HOME',
  REPO_ANALYZER = 'REPO_ANALYZER',
  ARTICLE_INFOGRAPHIC = 'ARTICLE_INFOGRAPHIC',
  DEV_STUDIO = 'DEV_STUDIO'
}

export interface MissingStructureItem {
  title: string;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  recommendedLocation?: string;
  solutionBlueprint: string;
}

export interface SuggestedAddonItem {
  title: string;
  category: string;
  impact: 'High' | 'Medium' | 'Low';
  description: string;
  implementationGuide: string;
  suggestedFiles?: string[];
}

export interface ArchitectureAuditReport {
  score: number;
  healthSummary: string;
  missingStructures: MissingStructureItem[];
  suggestedAddons: SuggestedAddonItem[];
  actionPlan: string[];
}

export interface D3Node extends SimulationNodeDatum {
  id: string;
  group: number;
  label: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface D3Link extends SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  value: number;
}

export interface DataFlowGraph {
  nodes: D3Node[];
  links: D3Link[];
}

export interface RepoFileTree {
  path: string;
  type: string;
  content?: string;
  isKeyFile?: boolean;
}

export interface DevStudioState {
  repoName: string;
  fileTree: RepoFileTree[];
  graphData: DataFlowGraph;
}

export interface Citation {
    uri: string;
    title: string;
}

export interface RepoCommitRaw {
  sha: string;
  message: string;
  authorName: string;
  authorLogin?: string;
  date: string;
}

export interface RepoCommitActivity {
  date: string; // YYYY-MM-DD
  formattedDate: string;
  count: number;
  authors: string[];
  sampleMessages: string[];
  isSpike: boolean;
  movingAverage?: number;
}

export interface DayOfWeekActivity {
  day: string; // Mon, Tue, etc.
  dayIndex: number; // 0-6
  count: number;
  percentage: number;
}

export interface RepoActivityStats {
  totalCommits: number;
  timeline: RepoCommitActivity[];
  peakDay: { date: string; formattedDate: string; count: number } | null;
  activeContributors: number;
  averagePerDay: number;
  velocityTrend: 'increasing' | 'stable' | 'decreasing';
  spikesCount: number;
  spikesList: RepoCommitActivity[];
  dayOfWeekDistribution: DayOfWeekActivity[];
  source: 'live_github' | 'simulated_fallback';
  dateRange: { start: string; end: string } | null;
}

export interface RepoHistoryItem {
  id: string;
  repoName: string;
  imageData: string;
  is3D: boolean;
  style: string;
  date: Date;
}

export interface ArticleHistoryItem {
    id: string;
    title: string;
    url: string;
    imageData: string;
    citations: Citation[];
    date: Date;
}

export interface HistoryExportOptions {
  scope: 'all' | 'repos' | 'articles';
  includeImages: boolean;
  prettyPrint?: boolean;
}

export interface HistoryExportMetadata {
  version: string;
  exportedAt: string;
  application: string;
  scope: 'all' | 'repos' | 'articles';
  totalItems: number;
  repositoriesCount: number;
  articlesCount: number;
  includesImages: boolean;
}

export interface ExportedRepoHistoryItem {
  id: string;
  repoName: string;
  style: string;
  is3D: boolean;
  date: string;
  hasImageData: boolean;
  imageData?: string;
}

export interface ExportedArticleHistoryItem {
  id: string;
  title: string;
  url: string;
  date: string;
  citationsCount: number;
  citations: Citation[];
  hasImageData: boolean;
  imageData?: string;
}

export interface HistoryExportData {
  metadata: HistoryExportMetadata;
  repositories?: ExportedRepoHistoryItem[];
  articles?: ExportedArticleHistoryItem[];
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
