/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Shield, ExternalLink, CreditCard, Loader2, KeyRound, AlertTriangle, Key, Check } from 'lucide-react';

interface ApiKeyModalProps {
  onKeySelected: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onKeySelected }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        setTimeout(() => {
            onKeySelected();
        }, 500);
      } else {
        setIsConnecting(false);
      }
    } catch (e) {
      console.error("Failed to open key selector", e);
      setIsConnecting(false);
    }
  };

  const handleSaveManualKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualKey.trim()) return;
    localStorage.setItem('gemini_api_key', manualKey.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      onKeySelected();
    }, 600);
  };

  const hasAiStudio = typeof window !== 'undefined' && !!(window as any).aistudio?.openSelectKey;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4">
      <div className="w-full max-w-md relative overflow-hidden glass-panel rounded-3xl border border-red-500/30 shadow-[0_0_50px_rgba(220,38,38,0.2)] animate-in fade-in zoom-in-95 duration-300">
        
        {/* Decorative Background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="p-8 relative z-10 flex flex-col items-center text-center space-y-5">
          
          <div className="w-16 h-16 bg-slate-900/50 rounded-2xl flex items-center justify-center border border-red-500/30 shadow-xl">
             <KeyRound className="w-8 h-8 text-red-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white font-sans">Gemini API Key Required</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Link2Ink requires a Gemini API key with <span className="text-slate-200 font-semibold">Imagen / Image Generation</span> enabled.
            </p>
          </div>

          <div className="w-full p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-left">
             <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
             <div className="space-y-1">
                 <p className="text-xs font-bold text-red-200 uppercase tracking-wider">Cloud Billing Project Key Required</p>
                 <p className="text-xs text-red-200/70 leading-relaxed">
                    Image generation models require a paid Google Cloud Project API key. Standard free-tier keys will return quota errors.
                 </p>
             </div>
          </div>

          {hasAiStudio && (
            <button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full py-3.5 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-red-900/80 hover:to-red-800/80 border border-white/10 hover:border-red-500/50 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-70"
            >
              {isConnecting ? (
                  <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Connecting...
                  </>
              ) : (
                  <>
                      <CreditCard className="w-5 h-5 group-hover:text-red-200" /> Select API Key via AI Studio
                  </>
              )}
            </button>
          )}

          {/* Manual Input Form (works when pushed to GitHub / standalone deployments) */}
          <form onSubmit={handleSaveManualKey} className="w-full space-y-3 pt-2 text-left border-t border-white/10">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-violet-400" /> Enter API Key Manually:
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 bg-slate-900/90 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                type="submit"
                disabled={!manualKey.trim()}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0"
              >
                {savedSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : 'Save Key'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">Key is saved locally in your browser's LocalStorage and never sent to secondary servers.</p>
          </form>

          <div className="pt-2 border-t border-white/5 w-full">
             <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors font-mono"
             >
                View Billing Documentation <ExternalLink className="w-3 h-3" />
             </a>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
