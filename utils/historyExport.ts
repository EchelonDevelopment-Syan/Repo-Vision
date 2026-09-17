/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  RepoHistoryItem, 
  ArticleHistoryItem, 
  HistoryExportOptions, 
  HistoryExportData,
  ExportedRepoHistoryItem,
  ExportedArticleHistoryItem
} from '../types';

/**
 * Builds a structured, typed export payload from repo and article histories.
 */
export function buildHistoryExportPayload(
  repoHistory: RepoHistoryItem[],
  articleHistory: ArticleHistoryItem[],
  options: HistoryExportOptions
): HistoryExportData {
  const { scope, includeImages } = options;

  const shouldIncludeRepos = scope === 'all' || scope === 'repos';
  const shouldIncludeArticles = scope === 'all' || scope === 'articles';

  const exportedRepos: ExportedRepoHistoryItem[] = shouldIncludeRepos
    ? repoHistory.map(item => {
        const dateStr = item.date instanceof Date 
          ? item.date.toISOString() 
          : new Date(item.date).toISOString();

        const baseItem: ExportedRepoHistoryItem = {
          id: item.id,
          repoName: item.repoName,
          style: item.style,
          is3D: item.is3D,
          date: dateStr,
          hasImageData: Boolean(item.imageData)
        };

        if (includeImages && item.imageData) {
          baseItem.imageData = item.imageData;
        }

        return baseItem;
      })
    : [];

  const exportedArticles: ExportedArticleHistoryItem[] = shouldIncludeArticles
    ? articleHistory.map(item => {
        const dateStr = item.date instanceof Date 
          ? item.date.toISOString() 
          : new Date(item.date).toISOString();

        const baseItem: ExportedArticleHistoryItem = {
          id: item.id,
          title: item.title,
          url: item.url,
          date: dateStr,
          citationsCount: item.citations?.length || 0,
          citations: item.citations || [],
          hasImageData: Boolean(item.imageData)
        };

        if (includeImages && item.imageData) {
          baseItem.imageData = item.imageData;
        }

        return baseItem;
      })
    : [];

  const totalItems = exportedRepos.length + exportedArticles.length;

  const payload: HistoryExportData = {
    metadata: {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      application: 'Repo Vision Studio',
      scope,
      totalItems,
      repositoriesCount: exportedRepos.length,
      articlesCount: exportedArticles.length,
      includesImages: Boolean(includeImages)
    }
  };

  if (shouldIncludeRepos) {
    payload.repositories = exportedRepos;
  }

  if (shouldIncludeArticles) {
    payload.articles = exportedArticles;
  }

  return payload;
}

/**
 * Generates a formatted JSON string for clipboard copying or previewing.
 */
export function generateHistoryJsonString(
  repoHistory: RepoHistoryItem[],
  articleHistory: ArticleHistoryItem[],
  options: HistoryExportOptions
): string {
  const payload = buildHistoryExportPayload(repoHistory, articleHistory, options);
  const indent = options.prettyPrint !== false ? 2 : 0;
  return JSON.stringify(payload, null, indent);
}

/**
 * Triggers a browser file download of the structured JSON history.
 */
export function downloadHistoryJson(
  repoHistory: RepoHistoryItem[],
  articleHistory: ArticleHistoryItem[],
  options: HistoryExportOptions,
  customFilename?: string
): { filename: string; sizeBytes: number } {
  const jsonString = generateHistoryJsonString(repoHistory, articleHistory, options);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
  const scopeSuffix = options.scope === 'all' ? 'complete' : options.scope;
  const imageSuffix = options.includeImages ? '-with-images' : '';
  
  const defaultFilename = `repo-vision-history-${scopeSuffix}-${dateStr}-${timeStr}${imageSuffix}.json`;
  const filename = customFilename || defaultFilename;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return {
    filename,
    sizeBytes: blob.size
  };
}
