/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import RepoAnalyzer from './components/RepoAnalyzer';
import ArticleToInfographic from './components/ArticleToInfographic';
import DevStudio from './components/DevStudio';
import Home from './components/Home';
import IntroAnimation from './components/IntroAnimation';
import ApiKeyModal from './components/ApiKeyModal';
import VoiceCommandButton from './components/VoiceCommandButton';
import ExportHistoryModal from './components/ExportHistoryModal';
import { ViewMode, RepoHistoryItem, ArticleHistoryItem, DevStudioState } from './types';
import { Github, PenTool, GitBranch, FileText, Home as HomeIcon, CreditCard, Terminal, FileJson } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.HOME);
  const [devStudioState, setDevStudioState] = useState<DevStudioState | null>(null);
  const [voiceSearchRepo, setVoiceSearchRepo] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [checkingKey, setCheckingKey] = useState<boolean>(true);
  
  // Export Modal State
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportModalScope, setExportModalScope] = useState<'all' | 'repos' | 'articles'>('all');

  // Lifted History State for Persistence with safe localStorage initialization
  const [repoHistory, setRepoHistory] = useState<RepoHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('repo_vision_repo_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((item: any) => ({
          ...item,
          date: new Date(item.date)
        }));
      }
    } catch (err) {
      console.warn('Could not restore repo history from localStorage:', err);
    }
    return [];
  });

  const [articleHistory, setArticleHistory] = useState<ArticleHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('repo_vision_article_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((item: any) => ({
          ...item,
          date: new Date(item.date)
        }));
      }
    } catch (err) {
      console.warn('Could not restore article history from localStorage:', err);
    }
    return [];
  });

  // Sync history to localStorage safely (capped to recent 25 to prevent storage exhaustion)
  useEffect(() => {
    try {
      localStorage.setItem('repo_vision_repo_history', JSON.stringify(repoHistory.slice(0, 25)));
    } catch (err) {
      console.warn('Could not sync repo history to localStorage', err);
    }
  }, [repoHistory]);

  useEffect(() => {
    try {
      localStorage.setItem('repo_vision_article_history', JSON.stringify(articleHistory.slice(0, 25)));
    } catch (err) {
      console.warn('Could not sync article history to localStorage', err);
    }
  }, [articleHistory]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      } else {
        setHasApiKey(false);
      }
      setCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  const handleNavigate = (mode: ViewMode, data?: any) => {
    if (data) {
      setDevStudioState(data);
    }
    setCurrentView(mode);
  };

  const handleVoiceAnalyzeRepo = (repoName: string) => {
    setVoiceSearchRepo(repoName);
    setCurrentView(ViewMode.REPO_ANALYZER);
  };

  const handleAddRepoHistory = (item: RepoHistoryItem) => {
    setRepoHistory(prev => [item, ...prev]);
  };

  const handleAddArticleHistory = (item: ArticleHistoryItem) => {
    setArticleHistory(prev => [item, ...prev]);
  };

  const handleOpenExportModal = (scope: 'all' | 'repos' | 'articles' = 'all') => {
    setExportModalScope(scope);
    setShowExportModal(true);
  };

  const onReauthRequested = () => {
    setHasApiKey(false); // This will trigger the modal to reappear
  };

  if (checkingKey) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Enforce API Key Modal */}
      {!hasApiKey && <ApiKeyModal onKeySelected={() => setHasApiKey(true)} />}

      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}

      <header className="sticky top-4 z-50 mx-auto w-[calc(100%-1rem)] md:w-[calc(100%-2rem)] max-w-[1400px]">
        <div className="glass-panel rounded-2xl px-4 md:px-6 py-3 md:py-4 flex justify-between items-center">
          <button 
            onClick={() => setCurrentView(ViewMode.HOME)}
            className="flex items-center gap-3 md:gap-4 group transition-opacity hover:opacity-80"
          >
            <div className="relative flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-xl bg-slate-900/50 border border-white/10 shadow-inner group-hover:border-violet-500/50 transition-colors">
               <PenTool className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-lg md:text-xl font-extrabold text-white tracking-tight font-sans flex items-center gap-2">
                Repo Vision <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-mono text-slate-400 border border-white/5 hidden sm:inline-block">Studio</span>
              </h1>
              <p className="text-xs font-mono text-slate-400 tracking-wider uppercase hidden sm:block">Visual Intelligence Platform</p>
            </div>
          </button>
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <VoiceCommandButton 
              onNavigate={handleNavigate}
              onAnalyzeRepo={handleVoiceAnalyzeRepo}
            />

            {/* Export History Trigger */}
            <button
              onClick={() => handleOpenExportModal('all')}
              className="flex items-center gap-1.5 px-3 py-1.5 md:py-2 rounded-xl bg-slate-900/50 border border-white/10 hover:border-violet-500/50 text-slate-300 hover:text-white transition-all text-xs font-mono group"
              title="Export repository and article analysis history as JSON"
            >
              <FileJson className="w-4 h-4 text-violet-400 group-hover:text-violet-300" />
              <span className="hidden md:inline">Export History</span>
              {repoHistory.length + articleHistory.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold border border-violet-500/30">
                  {repoHistory.length + articleHistory.length}
                </span>
              )}
            </button>

            {hasApiKey && (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-widest cursor-help" title="API Key Active">
                    <CreditCard className="w-3 h-3" /> Paid Tier
                </div>
            )}
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 md:p-2.5 rounded-xl bg-slate-900/50 border border-white/10 text-slate-400 hover:text-white hover:border-violet-500/50 transition-all hover:shadow-neon-violet"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {/* Navigation Tabs (Hidden on Home, visible on tools) */}
        {currentView !== ViewMode.HOME && (
            <div className="flex justify-center mb-8 md:mb-10 animate-in fade-in slide-in-from-top-4 sticky top-24 z-40">
            <div className="glass-panel p-1 md:p-1.5 rounded-full flex relative shadow-2xl">
                <button
                onClick={() => setCurrentView(ViewMode.HOME)}
                className="relative flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-full font-medium text-sm transition-all duration-300 font-mono text-slate-500 hover:text-slate-300 hover:bg-white/5"
                title="Home"
                >
                <HomeIcon className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-white/10 my-auto mx-1"></div>
                <button
                onClick={() => setCurrentView(ViewMode.REPO_ANALYZER)}
                className={`relative flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full font-medium text-sm transition-all duration-300 font-mono ${
                    currentView === ViewMode.REPO_ANALYZER
                    ? 'text-white bg-white/10 shadow-glass-inset border border-white/10'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                >
                <GitBranch className="w-4 h-4" />
                <span className="hidden sm:inline">GitFlow</span>
                </button>
                <button
                onClick={() => setCurrentView(ViewMode.ARTICLE_INFOGRAPHIC)}
                className={`relative flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full font-medium text-sm transition-all duration-300 font-mono ${
                    currentView === ViewMode.ARTICLE_INFOGRAPHIC
                    ? 'text-emerald-100 bg-emerald-500/10 shadow-glass-inset border border-emerald-500/20'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">SiteSketch</span>
                </button>
                {(devStudioState || currentView === ViewMode.DEV_STUDIO) && (
                  <button
                  onClick={() => setCurrentView(ViewMode.DEV_STUDIO)}
                  className={`relative flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full font-medium text-sm transition-all duration-300 font-mono ${
                      currentView === ViewMode.DEV_STUDIO
                      ? 'text-indigo-100 bg-indigo-500/10 shadow-glass-inset border border-indigo-500/20'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  >
                  <Terminal className="w-4 h-4" />
                  <span className="hidden sm:inline">DevStudio</span>
                  </button>
                )}
            </div>
            </div>
        )}

        <div className="flex-1">
            {currentView === ViewMode.HOME && (
                <Home 
                    onNavigate={handleNavigate} 
                    onOpenExport={() => handleOpenExportModal('all')}
                    historyCount={repoHistory.length + articleHistory.length}
                />
            )}
            {currentView === ViewMode.REPO_ANALYZER && (
                <div className="animate-in fade-in-30 slide-in-from-bottom-4 duration-500 ease-out">
                    <RepoAnalyzer 
                        onNavigate={handleNavigate} 
                        history={repoHistory} 
                        onAddToHistory={handleAddRepoHistory}
                        autoSearchRepo={voiceSearchRepo}
                        onOpenExportHistory={() => handleOpenExportModal('repos')}
                    />
                </div>
            )}
            {currentView === ViewMode.ARTICLE_INFOGRAPHIC && (
                <div className="animate-in fade-in-30 slide-in-from-bottom-4 duration-500 ease-out">
                    <ArticleToInfographic 
                        history={articleHistory} 
                        onAddToHistory={handleAddArticleHistory}
                        onOpenExportHistory={() => handleOpenExportModal('articles')}
                    />
                </div>
            )}
            {currentView === ViewMode.DEV_STUDIO && (
                <div className="animate-in fade-in-30 slide-in-from-bottom-4 duration-500 ease-out">
                    <DevStudio
                        initialState={devStudioState}
                        onNavigate={handleNavigate}
                    />
                </div>
            )}
        </div>
      </main>

      <footer className="py-6 mt-auto border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center px-4">
          <p className="text-xs font-mono text-slate-600">
            <span className="text-violet-500/70">repo</span>:<span className="text-emerald-500/70">vision</span>$ Powered by Nano Banana Pro
          </p>
        </div>
      </footer>

      {/* Export History Modal */}
      <ExportHistoryModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        repoHistory={repoHistory}
        articleHistory={articleHistory}
        defaultScope={exportModalScope}
      />
    </div>
  );
};

export default App;
