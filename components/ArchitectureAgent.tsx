/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { RepoFileTree, ArchitectureAuditReport, MissingStructureItem, SuggestedAddonItem } from '../types';
import { analyzeRepoArchitectureWithAgent, askArchitectureAgentFollowup } from '../services/geminiService';
import { 
  Bot, 
  Sparkles, 
  Loader2, 
  AlertTriangle, 
  PlusCircle, 
  CheckCircle2, 
  Copy, 
  Check, 
  FileCode, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  Zap, 
  ListOrdered, 
  MessageSquareText, 
  RefreshCw,
  Download
} from 'lucide-react';

interface ArchitectureAgentProps {
  repoName: string;
  fileTree: RepoFileTree[];
  language?: string;
  auditReport?: ArchitectureAuditReport | null;
  onAuditComplete?: (report: ArchitectureAuditReport) => void;
}

export const ArchitectureAgent: React.FC<ArchitectureAgentProps> = ({
  repoName,
  fileTree,
  language = "English",
  auditReport: initialAuditReport,
  onAuditComplete
}) => {
  const [report, setReport] = useState<ArchitectureAuditReport | null>(initialAuditReport || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'missing' | 'addons' | 'plan' | 'chat'>('missing');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Chat / Agent Consultation state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'agent', text: string }>>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  const handleRunAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeRepoArchitectureWithAgent(repoName, fileTree, language);
      setReport(result);
      if (onAuditComplete) {
        onAuditComplete(result);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze architecture with Gemini Agent.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !report) return;

    const userQ = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userQ }]);
    setChatLoading(true);

    try {
      const agentAns = await askArchitectureAgentFollowup(userQ, report, repoName, fileTree, language);
      setChatMessages(prev => [...prev, { role: 'agent', text: agentAns }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'agent', text: 'Error consulting Gemini Agent. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDownloadMarkdownReport = () => {
    if (!report) return;
    let md = `# Architecture Audit Report for ${repoName}\n\n`;
    md += `**Health Score:** ${report.score}/100\n\n`;
    md += `## Executive Summary\n${report.healthSummary}\n\n`;
    
    md += `## Identified Missing Structures (${report.missingStructures.length})\n`;
    report.missingStructures.forEach((item, idx) => {
      md += `### ${idx + 1}. ${item.title} [${item.severity.toUpperCase()}]\n`;
      md += `- **Category:** ${item.category}\n`;
      if (item.recommendedLocation) md += `- **Recommended Location:** \`${item.recommendedLocation}\`\n`;
      md += `- **Description:** ${item.description}\n`;
      md += `\`\`\`ts\n${item.solutionBlueprint}\n\`\`\`\n\n`;
    });

    md += `## Recommended Add-ons (${report.suggestedAddons.length})\n`;
    report.suggestedAddons.forEach((item, idx) => {
      md += `### ${idx + 1}. ${item.title} [Impact: ${item.impact}]\n`;
      md += `- **Category:** ${item.category}\n`;
      if (item.suggestedFiles?.length) md += `- **Files:** ${item.suggestedFiles.join(', ')}\n`;
      md += `- **Description:** ${item.description}\n`;
      md += `\`\`\`ts\n${item.implementationGuide}\n\`\`\`\n\n`;
    });

    md += `## Action Plan\n`;
    report.actionPlan.forEach((step, idx) => {
      md += `${idx + 1}. ${step}\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repoName}-architecture-audit.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getSeverityBadge = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'warning':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'info':
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  const getImpactBadge = (impact: 'High' | 'Medium' | 'Low') => {
    switch (impact) {
      case 'High':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Medium':
        return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
      case 'Low':
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden border border-violet-500/20 shadow-neon-violet">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-500/20 rounded-2xl border border-violet-500/40 text-violet-300 shadow-inner">
            <Bot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-extrabold text-white font-sans tracking-tight">
                Gemini Architecture Agent
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/30 text-[10px] font-mono uppercase tracking-widest flex items-center gap-1 font-bold">
                <Sparkles className="w-3 h-3 text-fuchsia-400" /> AI Advisor
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Deep structure analysis, missing component detection & add-on recommendations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {report && (
            <button
              onClick={handleDownloadMarkdownReport}
              className="px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-all hover:border-violet-500/30"
              title="Download Full Report as Markdown"
            >
              <Download className="w-3.5 h-3.5 text-violet-400" /> Export Audit
            </button>
          )}

          <button
            onClick={handleRunAudit}
            disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-bold font-mono text-xs flex items-center gap-2 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : report ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'AUDITING STRUCTURE...' : report ? 'RE-AUDIT' : 'ANALYZE ARCHITECTURE'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300 font-mono text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Initial Empty / Prompt State */}
      {!report && !loading && !error && (
        <div className="py-12 px-6 text-center space-y-4 max-w-xl mx-auto bg-slate-950/40 rounded-2xl border border-white/5">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto text-violet-400">
            <Bot className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-slate-200">Ready to audit repository structure</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Click <strong className="text-violet-300">"Analyze Architecture"</strong> to run the Gemini agent. It will evaluate missing tests, security headers, middleware, CI/CD, and recommend high-impact add-ons.
            </p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-12 px-6 text-center space-y-4 bg-slate-950/40 rounded-2xl border border-white/5 animate-pulse">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto" />
          <div className="space-y-1 font-mono text-xs text-violet-300">
            <p className="font-bold uppercase tracking-wider">GEMINI ARCHITECTURE AGENT WORKING...</p>
            <p className="text-slate-500">Scanning file tree, checking dependencies, detecting missing layers & generating blueprints</p>
          </div>
        </div>
      )}

      {/* Report Dashboard */}
      {report && !loading && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Executive Overview Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Health Score Meter */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between ${getScoreColor(report.score)}`}>
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Architecture Score</span>
              <div className="flex items-baseline gap-1 my-2">
                <span className="text-5xl font-extrabold font-mono tracking-tight">{report.score}</span>
                <span className="text-sm font-mono opacity-60">/ 100</span>
              </div>
              <span className="text-[11px] font-mono">
                {report.score >= 80 ? '✓ Enterprise Grade' : report.score >= 60 ? '⚡ Good, Needs Optimization' : '⚠️ Missing Key Structures'}
              </span>
            </div>

            {/* Health Summary */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-slate-950/60 border border-white/10 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest font-bold flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-violet-400" /> Executive Architectural Summary
              </span>
              <p className="text-sm text-slate-200 leading-relaxed font-sans font-light">
                {report.healthSummary}
              </p>
              <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-4 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> {report.missingStructures.length} Missing Structures
                </span>
                <span className="flex items-center gap-1">
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" /> {report.suggestedAddons.length} Recommended Add-ons
                </span>
              </div>
            </div>
          </div>

          {/* Tab Controls */}
          <div className="flex border-b border-white/10 gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => { setActiveTab('missing'); setExpandedIndex(0); }}
              className={`pb-3 px-4 text-xs font-mono font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'missing'
                  ? 'border-rose-500 text-rose-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <ShieldAlert className="w-4 h-4" /> Missing Structure ({report.missingStructures.length})
            </button>

            <button
              onClick={() => { setActiveTab('addons'); setExpandedIndex(0); }}
              className={`pb-3 px-4 text-xs font-mono font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'addons'
                  ? 'border-emerald-500 text-emerald-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <PlusCircle className="w-4 h-4" /> Suggested Add-ons ({report.suggestedAddons.length})
            </button>

            <button
              onClick={() => setActiveTab('plan')}
              className={`pb-3 px-4 text-xs font-mono font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'plan'
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <ListOrdered className="w-4 h-4" /> Action Roadmap ({report.actionPlan.length})
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`pb-3 px-4 text-xs font-mono font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <MessageSquareText className="w-4 h-4" /> Consult Agent
            </button>
          </div>

          {/* TAB 1: MISSING STRUCTURES */}
          {activeTab === 'missing' && (
            <div className="space-y-4 animate-in fade-in">
              {report.missingStructures.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-mono text-xs bg-slate-950/40 rounded-2xl">
                  ✓ No critical missing structures identified. Your repository layout is comprehensive!
                </div>
              ) : (
                report.missingStructures.map((item, idx) => {
                  const isExpanded = expandedIndex === idx;
                  const snippetId = `missing-${idx}`;

                  return (
                    <div
                      key={idx}
                      className="bg-slate-950/60 border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-white/20"
                    >
                      <button
                        onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                        className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase font-bold shrink-0 ${getSeverityBadge(item.severity)}`}>
                            {item.severity}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate font-mono">{item.title}</h4>
                            <p className="text-[11px] text-slate-400 truncate font-mono mt-0.5">
                              Category: {item.category} {item.recommendedLocation ? `• Target: ${item.recommendedLocation}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                            {isExpanded ? 'Hide Blueprint' : 'View Blueprint'}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-5 border-t border-white/10 bg-black/40 space-y-4">
                          <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.description}</p>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                              <span className="flex items-center gap-1.5 font-bold text-rose-300">
                                <FileCode className="w-3.5 h-3.5" /> Recommended Solution Blueprint
                              </span>
                              <button
                                onClick={() => handleCopySnippet(item.solutionBlueprint, snippetId)}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[11px] text-slate-300 flex items-center gap-1 transition-colors"
                              >
                                {copiedId === snippetId ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> Copy Code
                                  </>
                                )}
                              </button>
                            </div>

                            <pre className="p-4 bg-slate-950 rounded-xl border border-white/10 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-[250px]">
                              <code>{item.solutionBlueprint}</code>
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: SUGGESTED ADD-ONS */}
          {activeTab === 'addons' && (
            <div className="space-y-4 animate-in fade-in">
              {report.suggestedAddons.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-mono text-xs bg-slate-950/40 rounded-2xl">
                  No additional add-ons suggested at this stage.
                </div>
              ) : (
                report.suggestedAddons.map((item, idx) => {
                  const isExpanded = expandedIndex === idx;
                  const snippetId = `addon-${idx}`;

                  return (
                    <div
                      key={idx}
                      className="bg-slate-950/60 border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-white/20"
                    >
                      <button
                        onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                        className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase font-bold shrink-0 ${getImpactBadge(item.impact)}`}>
                            {item.impact} Impact
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate font-mono">{item.title}</h4>
                            <p className="text-[11px] text-slate-400 truncate font-mono mt-0.5">
                              Category: {item.category}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                            {isExpanded ? 'Hide Guide' : 'View Implementation'}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-5 border-t border-white/10 bg-black/40 space-y-4">
                          <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.description}</p>

                          {item.suggestedFiles && item.suggestedFiles.length > 0 && (
                            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 flex-wrap">
                              <span className="text-slate-500 uppercase font-bold">Suggested Files:</span>
                              {item.suggestedFiles.map((file, fIdx) => (
                                <span key={fIdx} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-200">
                                  {file}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                              <span className="flex items-center gap-1.5 font-bold text-emerald-300">
                                <FileCode className="w-3.5 h-3.5" /> Implementation Code Guide
                              </span>
                              <button
                                onClick={() => handleCopySnippet(item.implementationGuide, snippetId)}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[11px] text-slate-300 flex items-center gap-1 transition-colors"
                              >
                                {copiedId === snippetId ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> Copy Code
                                  </>
                                )}
                              </button>
                            </div>

                            <pre className="p-4 bg-slate-950 rounded-xl border border-white/10 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-[250px]">
                              <code>{item.implementationGuide}</code>
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: ACTION ROADMAP */}
          {activeTab === 'plan' && (
            <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-6 space-y-4 animate-in fade-in">
              <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-violet-400" /> Prioritized Implementation Roadmap
              </h4>
              <div className="space-y-3">
                {report.actionPlan.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3.5 bg-white/5 rounded-xl border border-white/5">
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <p className="text-sm text-slate-200 font-sans leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CONSULT AGENT Q&A */}
          {activeTab === 'chat' && (
            <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 md:p-6 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-xs font-mono text-indigo-300">
                  <Bot className="w-4 h-4" />
                  <span>Ask the Gemini Agent anything about this repository structure...</span>
                </div>
              </div>

              {/* Messages list */}
              <div className="space-y-3 max-h-[350px] overflow-y-auto p-2">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 font-mono text-xs">
                    Ask questions like: "How do I implement the missing rate-limiting middleware?" or "What database schema should I use for add-on X?"
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-3.5 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-indigo-600/30 text-indigo-100 border border-indigo-500/30 rounded-br-none'
                            : 'bg-slate-900/90 text-slate-200 border border-white/10 rounded-bl-none shadow-lg'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="p-3 bg-slate-900/90 rounded-2xl border border-white/10 text-xs font-mono text-indigo-300 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      <span>Gemini Agent reasoning...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Form */}
              <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2 border-t border-white/10">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask Gemini Agent for code examples or guidance..."
                  disabled={chatLoading}
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500/50 font-mono"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>SEND</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArchitectureAgent;
