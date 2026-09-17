/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  FileJson, 
  Download, 
  Copy, 
  Check, 
  X, 
  GitBranch, 
  FileText, 
  Eye, 
  Code2, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { RepoHistoryItem, ArticleHistoryItem, HistoryExportOptions } from '../types';
import { 
  downloadHistoryJson, 
  generateHistoryJsonString, 
  buildHistoryExportPayload 
} from '../utils/historyExport';

interface ExportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoHistory: RepoHistoryItem[];
  articleHistory: ArticleHistoryItem[];
  defaultScope?: 'all' | 'repos' | 'articles';
}

export const ExportHistoryModal: React.FC<ExportHistoryModalProps> = ({
  isOpen,
  onClose,
  repoHistory,
  articleHistory,
  defaultScope = 'all'
}) => {
  const [scope, setScope] = useState<'all' | 'repos' | 'articles'>(defaultScope);
  const [includeImages, setIncludeImages] = useState<boolean>(false);
  const [prettyPrint, setPrettyPrint] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');

  const totalRepoCount = repoHistory.length;
  const totalArticleCount = articleHistory.length;
  const totalCount = totalRepoCount + totalArticleCount;

  // Calculate citations count
  const totalCitations = useMemo(() => {
    return articleHistory.reduce((acc, item) => acc + (item.citations?.length || 0), 0);
  }, [articleHistory]);

  const exportOptions: HistoryExportOptions = useMemo(() => ({
    scope,
    includeImages,
    prettyPrint
  }), [scope, includeImages, prettyPrint]);

  // Generate payload for preview & sizing
  const previewPayload = useMemo(() => {
    // If empty history, create a sample template
    if (totalCount === 0) {
      const dummyRepo: RepoHistoryItem = {
        id: 'sample-repo-1',
        repoName: 'sample/repository',
        style: 'Modern Cyberpunk',
        is3D: false,
        date: new Date(),
        imageData: includeImages ? 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' : ''
      };
      const dummyArticle: ArticleHistoryItem = {
        id: 'sample-article-1',
        title: 'Architectural Blueprint Guide',
        url: 'https://example.com/architecture-guide',
        date: new Date(),
        citations: [{ title: 'System Documentation', uri: 'https://example.com' }],
        imageData: includeImages ? 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' : ''
      };
      return buildHistoryExportPayload([dummyRepo], [dummyArticle], exportOptions);
    }
    return buildHistoryExportPayload(repoHistory, articleHistory, exportOptions);
  }, [repoHistory, articleHistory, exportOptions, totalCount, includeImages]);

  const jsonString = useMemo(() => {
    return JSON.stringify(previewPayload, null, prettyPrint ? 2 : 0);
  }, [previewPayload, prettyPrint]);

  const estimatedSizeBytes = useMemo(() => {
    return new Blob([jsonString]).size;
  }, [jsonString]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = () => {
    // If empty, pass the sample or empty list
    const reposToExport = totalCount === 0 ? [] : repoHistory;
    const articlesToExport = totalCount === 0 ? [] : articleHistory;

    const result = downloadHistoryJson(reposToExport, articlesToExport, exportOptions);
    setDownloadSuccess(`Saved ${result.filename} (${formatBytes(result.sizeBytes)})`);
    setTimeout(() => {
      setDownloadSuccess(null);
    }, 4000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full sm:max-w-2xl bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-6 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-sans flex items-center gap-2">
                Export Analysis History
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  JSON 1.0
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Download structured data for backups, pipelines, or reporting
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Toggle: Configuration vs Live JSON Preview */}
        <div className="px-5 sm:px-6 pt-3 pb-1 border-b border-white/5 flex items-center justify-between gap-2 bg-slate-950/30">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 text-xs font-mono">
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'config'
                  ? 'bg-violet-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Export Options</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-violet-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>JSON Preview ({formatBytes(estimatedSizeBytes)})</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 hidden sm:flex items-center gap-2">
            <span>Estimated Size:</span>
            <span className="text-violet-300 font-bold">{formatBytes(estimatedSizeBytes)}</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Summary Stats Overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-white/5 flex flex-col">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-violet-400" /> Repositories
              </span>
              <span className="text-xl font-extrabold text-white font-mono mt-1">
                {totalRepoCount}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Blueprints</span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-2xl border border-white/5 flex flex-col">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3 h-3 text-emerald-400" /> Web Articles
              </span>
              <span className="text-xl font-extrabold text-white font-mono mt-1">
                {totalArticleCount}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Sketches</span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-2xl border border-white/5 flex flex-col">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-sky-400" /> Citations
              </span>
              <span className="text-xl font-extrabold text-white font-mono mt-1">
                {totalCitations}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Verified links</span>
            </div>
          </div>

          {totalCount === 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-300 text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-bold">No historical analyses recorded in this session yet.</p>
                <p className="text-[11px] text-amber-200/70 mt-0.5">
                  You can still preview or download the structured JSON format template below to inspect its schema.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'config' ? (
            <div className="space-y-5">
              {/* Scope Selection */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Select Export Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`p-3 rounded-xl border text-left font-mono transition-all ${
                      scope === 'all'
                        ? 'bg-violet-600/20 border-violet-500 text-white shadow-sm'
                        : 'bg-slate-950/50 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-violet-400" /> All History
                      </span>
                      {scope === 'all' && <Check className="w-3.5 h-3.5 text-violet-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Both Repos ({totalRepoCount}) & Articles ({totalArticleCount})
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('repos')}
                    className={`p-3 rounded-xl border text-left font-mono transition-all ${
                      scope === 'repos'
                        ? 'bg-violet-600/20 border-violet-500 text-white shadow-sm'
                        : 'bg-slate-950/50 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-violet-400" /> Repos Only
                      </span>
                      {scope === 'repos' && <Check className="w-3.5 h-3.5 text-violet-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      GitHub architecture blueprints ({totalRepoCount})
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('articles')}
                    className={`p-3 rounded-xl border text-left font-mono transition-all ${
                      scope === 'articles'
                        ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-sm'
                        : 'bg-slate-950/50 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" /> Articles Only
                      </span>
                      {scope === 'articles' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Web article infographics ({totalArticleCount})
                    </p>
                  </button>
                </div>
              </div>

              {/* Advanced JSON Export Options */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Export Options & Payload Density
                </label>

                <div className="space-y-2.5">
                  {/* Include Images Option */}
                  <label className="flex items-start gap-3 p-3 bg-slate-950/50 rounded-xl border border-white/5 hover:border-white/10 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={includeImages}
                      onChange={(e) => setIncludeImages(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500/50"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs font-mono font-bold text-white">
                          Include Base64 Blueprint Images
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${includeImages ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                          {includeImages ? 'Larger File' : 'Compact'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Embeds raw base64 image data for offline recovery. Keep disabled for a fast, human-readable metadata file.
                      </p>
                    </div>
                  </label>

                  {/* Pretty Print Option */}
                  <label className="flex items-start gap-3 p-3 bg-slate-950/50 rounded-xl border border-white/5 hover:border-white/10 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={prettyPrint}
                      onChange={(e) => setPrettyPrint(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500/50"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-xs font-mono font-bold text-white">
                          Format & Indent JSON (2 Spaces)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Indents with readable line breaks for VS Code or terminal inspection.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            /* Live JSON Preview */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-violet-400" />
                  Live JSON Document ({formatBytes(estimatedSizeBytes)})
                </span>
                <span className="text-[10px] text-slate-500">
                  {jsonString.split('\n').length} lines
                </span>
              </div>
              <div className="relative">
                <pre className="p-4 bg-slate-950 rounded-2xl border border-white/10 font-mono text-[11px] text-violet-200 overflow-x-auto max-h-[260px] leading-relaxed select-all">
                  {jsonString}
                </pre>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {downloadSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-emerald-300 text-xs font-mono animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-2 transition-all"
              title="Copy JSON to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-xs font-mono font-medium transition-colors"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportHistoryModal;
