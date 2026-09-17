/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef } from 'react';
import { generateArticleInfographic } from '../services/geminiService';
import { Citation, ArticleHistoryItem } from '../types';
import { Link, Loader2, Download, Sparkles, AlertCircle, Palette, Globe, ExternalLink, BookOpen, Clock, Maximize, Upload, FileText, FileCode, File, X, Check, FileCheck, FileDown, FileJson } from 'lucide-react';
import { LoadingState } from './LoadingState';
import ImageViewer from './ImageViewer';
import { exportInfographicToPdf } from '../utils/pdfExport';

interface ArticleToInfographicProps {
    history: ArticleHistoryItem[];
    onAddToHistory: (item: ArticleHistoryItem) => void;
    onOpenExportHistory?: () => void;
}

interface UploadedFile {
    name: string;
    size: number;
    type: string;
    content: string;
}

const SKETCH_STYLES = [
    "Modern Editorial",
    "Fun & Playful",
    "Clean Minimalist",
    "Dark Mode Tech",
    "Custom"
];

const LANGUAGES = [
  { label: "English (US)", value: "English" },
  { label: "Arabic (Egypt)", value: "Arabic" },
  { label: "German (Germany)", value: "German" },
  { label: "Spanish (Mexico)", value: "Spanish" },
  { label: "French (France)", value: "French" },
  { label: "Hindi (India)", value: "Hindi" },
  { label: "Indonesian (Indonesia)", value: "Indonesian" },
  { label: "Italian (Italy)", value: "Italian" },
  { label: "Japanese (Japan)", value: "Japanese" },
  { label: "Korean (South Korea)", value: "Korean" },
  { label: "Portuguese (Brazil)", value: "Portuguese" },
  { label: "Russian (Russia)", value: "Russian" },
  { label: "Ukrainian (Ukraine)", value: "Ukrainian" },
  { label: "Vietnamese (Vietnam)", value: "Vietnamese" },
  { label: "Chinese (China)", value: "Chinese" },
];

const ArticleToInfographic: React.FC<ArticleToInfographicProps> = ({ history, onAddToHistory, onOpenExportHistory }) => {
  const [inputMode, setInputMode] = useState<'url' | 'file'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [selectedStyle, setSelectedStyle] = useState(SKETCH_STYLES[0]);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].value);
  const [customStyle, setCustomStyle] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportPdf = async () => {
    if (!imageData) return;
    setExportingPdf(true);
    try {
      const sourceTitle = inputMode === 'url' 
        ? (getDisplayHostname(urlInput) || 'Web Article')
        : (uploadedFile?.name || 'Uploaded Document');
      
      const sourceDetail = inputMode === 'url' ? urlInput : uploadedFile?.name;

      await exportInfographicToPdf({
        imageDataBase64: imageData,
        title: sourceTitle,
        sourceUrlOrName: sourceDetail,
        citations: citations,
        type: 'SiteSketch Infographic',
        language: selectedLanguage,
        style: selectedStyle === 'Custom' ? customStyle : selectedStyle
      });
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      setError('Failed to generate PDF export. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  // Viewer State
  const [fullScreenImage, setFullScreenImage] = useState<{src: string, alt: string} | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const processFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const textContent = e.target?.result as string || '';
      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'text/plain',
        content: textContent
      });
    };
    reader.onerror = () => {
      setError('Failed to read uploaded file. Please select a valid text, markdown, or code document.');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const getDisplayHostname = (urlOrString: string) => {
      if (!urlOrString) return '';
      try {
          const fullUrl = urlOrString.startsWith('http://') || urlOrString.startsWith('https://') 
              ? urlOrString 
              : `https://${urlOrString}`;
          return new URL(fullUrl).hostname;
      } catch (e) {
          return urlOrString;
      }
  };

  const addToHistory = (urlOrTitle: string, image: string, cites: Citation[]) => {
      let title = urlOrTitle;
      if (urlOrTitle.startsWith('http')) {
          try { title = new URL(urlOrTitle).hostname; } catch(e) {}
      }
      
      const newItem: ArticleHistoryItem = {
          id: Date.now().toString(),
          title: title,
          url: urlOrTitle,
          imageData: image,
          citations: cites,
          date: new Date()
      };
      onAddToHistory(newItem);
  };

  const loadFromHistory = (item: ArticleHistoryItem) => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (item.url.startsWith('http')) {
        setInputMode('url');
        setUrlInput(item.url);
      } else {
        setInputMode('file');
      }
      setImageData(item.imageData);
      setCitations(item.citations);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let sourceToUse = '';
    let displayTitle = '';

    if (inputMode === 'url') {
      if (!urlInput.trim()) {
        setError("Please provide a valid URL.");
        return;
      }
      sourceToUse = urlInput.trim();
      displayTitle = urlInput;
    } else {
      if (!uploadedFile) {
        setError("Please upload a file or document.");
        return;
      }
      sourceToUse = `DOCUMENT TITLE: ${uploadedFile.name}\n\n${uploadedFile.content}`;
      displayTitle = uploadedFile.name;
    }
    
    setLoading(true);
    setError(null);
    setImageData(null);
    setCitations([]);
    setLoadingStage('INITIALIZING...');

    try {
      const styleToUse = selectedStyle === 'Custom' ? customStyle : selectedStyle;
      const { imageData: resultImage, citations: resultCitations } = await generateArticleInfographic(sourceToUse, styleToUse, (stage) => {
          setLoadingStage(stage);
      }, selectedLanguage);
      
      if (resultImage) {
          setImageData(resultImage);
          setCitations(resultCitations);
          addToHistory(displayTitle, resultImage, resultCitations);
      } else {
          throw new Error("Failed to generate infographic image.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 mb-20">
      
      {fullScreenImage && (
          <ImageViewer 
            src={fullScreenImage.src} 
            alt={fullScreenImage.alt} 
            onClose={() => setFullScreenImage(null)} 
          />
      )}

      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-emerald-200 via-teal-200 to-slate-500 font-sans">
          Site<span className="text-emerald-400">Sketch</span>.
        </h2>
        <p className="text-slate-400 text-lg md:text-xl font-light tracking-wide">
          Turn any article, documentation page, or blog post into a stunning, easy-to-digest infographic.
        </p>
      </div>

      {/* Input Section */}
      <div className="glass-panel rounded-3xl p-6 md:p-10 space-y-8 relative z-10">
         {/* Mode Switcher */}
         <div className="flex items-center justify-center p-1 bg-slate-950/60 border border-white/10 rounded-2xl max-w-md mx-auto">
            <button
               type="button"
               onClick={() => setInputMode('url')}
               className={`flex-1 py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  inputMode === 'url'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
               }`}
            >
               <Link className="w-3.5 h-3.5" /> Web URL
            </button>
            <button
               type="button"
               onClick={() => setInputMode('file')}
               className={`flex-1 py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  inputMode === 'file'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
               }`}
            >
               <Upload className="w-3.5 h-3.5" /> Upload File
            </button>
         </div>

         <form onSubmit={handleGenerate} className="space-y-8">
            {inputMode === 'url' ? (
              <div className="space-y-4">
                  <label className="text-xs text-emerald-400 font-mono tracking-wider flex items-center gap-2">
                      <Link className="w-4 h-4" /> SOURCE_URL
                  </label>
                  <div className="relative">
                      <input
                          type="url"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="https://example.com/interesting-article"
                          className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-5 text-lg text-slate-200 placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 font-mono transition-all shadow-inner"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-700">
                          <Sparkles className="w-5 h-5 opacity-50" />
                      </div>
                  </div>
              </div>
            ) : (
              <div className="space-y-4">
                  <label className="text-xs text-emerald-400 font-mono tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-2">
                          <Upload className="w-4 h-4" /> UPLOAD_DOCUMENT
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">
                          .txt, .md, .doc, .docx, .json, .html, .csv, code
                      </span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".txt,.md,.markdown,.json,.html,.xml,.csv,.doc,.docx,.pdf,.js,.ts,.py,.tsx,.jsx"
                    className="hidden"
                  />

                  {uploadedFile ? (
                    <div className="bg-slate-950/60 border border-emerald-500/30 rounded-2xl p-5 flex items-center justify-between gap-4 animate-in fade-in">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-100 truncate font-mono">
                              {uploadedFile.name}
                            </p>
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-full font-mono border border-emerald-500/20">
                              <Check className="w-3 h-3" /> Ready
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-1">
                            Size: {formatFileSize(uploadedFile.size)} • Type: {uploadedFile.type || 'text/document'}
                          </p>
                          {uploadedFile.content && (
                            <p className="text-[11px] text-slate-500 font-mono mt-1.5 truncate max-w-lg italic">
                              "{uploadedFile.content.slice(0, 90).replace(/\s+/g, ' ')}..."
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-mono transition-colors border border-white/10"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadedFile(null)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                        isDragging
                          ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                          : 'border-white/10 hover:border-emerald-500/40 bg-slate-950/40 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-200 font-mono">
                        Drag & Drop document or <span className="text-emerald-400 underline decoration-emerald-500/40">Browse File</span>
                      </p>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        Supports Markdown (.md), Text (.txt), Documentation, JSON, HTML, or Source code
                      </p>
                    </div>
                  )}
              </div>
            )}

            {/* Style & Language Controls */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Style Selector */}
                <div className="space-y-4">
                     <label className="text-xs text-emerald-400 font-mono tracking-wider flex items-center gap-2">
                        <Palette className="w-4 h-4" /> ARTISTIC_STYLE
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {SKETCH_STYLES.map(style => (
                            <button
                                key={style}
                                type="button"
                                onClick={() => setSelectedStyle(style)}
                                className={`py-2 px-2 rounded-xl font-mono text-[11px] transition-all border whitespace-nowrap truncate ${
                                    selectedStyle === style 
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                    : 'bg-slate-900/50 text-slate-500 border-white/5 hover:border-white/10 hover:text-slate-300'
                                }`}
                            >
                                {style}
                            </button>
                        ))}
                    </div>
                     {selectedStyle === 'Custom' && (
                         <input 
                            type="text" 
                            value={customStyle}
                            onChange={(e) => setCustomStyle(e.target.value)}
                            placeholder="Describe custom style..."
                            className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 font-mono transition-all"
                         />
                     )}
                </div>

                 {/* Language Selector - CSS Fixed for wrapping */}
                 <div className="space-y-4 min-w-0">
                     <label className="text-xs text-emerald-400 font-mono tracking-wider flex items-center gap-2">
                        <Globe className="w-4 h-4" /> OUTPUT_LANGUAGE
                    </label>
                    <div className="relative w-full min-w-0">
                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 font-mono appearance-none cursor-pointer hover:bg-white/5 transition-colors truncate pr-8"
                        >
                             {LANGUAGES.map((lang) => (
                                <option key={lang.value} value={lang.value} className="bg-slate-900 text-slate-300">
                                    {lang.label}
                                </option>
                             ))}
                        </select>
                         <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                 </div>
            </div>

            <button
                type="submit"
                disabled={loading || (inputMode === 'url' ? !urlInput.trim() : !uploadedFile)}
                className="w-full py-5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 rounded-2xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-mono text-base tracking-wider hover:shadow-neon-emerald"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {loading ? "PROCESSING..." : "GENERATE_INFOGRAPHIC"}
            </button>
         </form>
      </div>

      {error && (
        <div className="glass-panel border-red-500/30 p-4 rounded-xl flex items-center gap-3 text-red-400 animate-in fade-in font-mono text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <LoadingState message={loadingStage || 'READING_CONTENT'} type="article" />
      )}

      {/* Result Section */}
      {imageData && !loading && (
        <div className="glass-panel rounded-3xl p-1.5 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 mb-1.5 bg-slate-950/30 rounded-t-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> Generated_Result
                </h3>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button 
                        onClick={() => setFullScreenImage({src: `data:image/png;base64,${imageData}`, alt: "Article Sketch"})}
                        className="text-xs flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-mono p-1.5 rounded-lg hover:bg-white/10"
                        title="Full Screen"
                    >
                        <Maximize className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExportPdf}
                        disabled={exportingPdf}
                        className="text-xs flex items-center gap-2 text-white hover:text-emerald-100 transition-all font-mono bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3.5 py-2 rounded-xl font-bold shadow-sm shadow-emerald-950"
                        title="Export as high-resolution PDF document with sources"
                    >
                        {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                        <span>{exportingPdf ? "EXPORTING..." : "EXPORT_PDF"}</span>
                    </button>
                    <a href={`data:image/png;base64,${imageData}`} download="site-sketch.png" className="text-xs flex items-center gap-2 text-emerald-300 hover:text-emerald-200 transition-colors font-mono bg-emerald-500/10 px-3.5 py-2 rounded-xl border border-emerald-500/20 font-bold">
                        <Download className="w-4 h-4" /> DOWNLOAD_PNG
                    </a>
                </div>
            </div>
            <div className="rounded-2xl overflow-hidden bg-[#eef8fe] relative group">
                 {selectedStyle === "Dark Mode Tech" && <div className="absolute inset-0 bg-slate-950 pointer-events-none mix-blend-multiply" />}
                <div className="absolute inset-0 bg-slate-950/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <img src={`data:image/png;base64,${imageData}`} alt="Generated Infographic" className="w-full h-auto object-contain max-h-[800px] mx-auto relative z-10" />
            </div>

             {/* Featured Citations Section */}
            {citations.length > 0 && (
                <div className="px-6 py-8 border-t border-white/5 bg-slate-900/30 rounded-b-2xl">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <BookOpen className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-white tracking-wide font-mono">
                                Grounding Sources
                            </h4>
                            <p className="text-[10px] text-slate-500 font-mono">Verified citations from analysis</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {citations.map((cite, idx) => {
                            const hostname = getDisplayHostname(cite.uri);
                            
                            return (
                                <a 
                                    key={idx} 
                                    href={cite.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex flex-col justify-between p-4 bg-slate-950/50 hover:bg-emerald-500/5 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all group relative overflow-hidden h-full"
                                    title={cite.title || cite.uri}
                                >
                                    <div className="flex items-start gap-3 mb-3">
                                         <div className="flex-shrink-0 w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-slate-500 group-hover:text-emerald-400 transition-colors border border-white/5">
                                            <Globe className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-200 group-hover:text-emerald-100 line-clamp-2 leading-snug transition-colors">
                                                {cite.title || "Web Source"}
                                            </p>
                                            <p className="text-[10px] text-slate-500 truncate font-mono mt-1 group-hover:text-emerald-400/70 transition-colors">
                                                {hostname}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5 group-hover:border-emerald-500/10 transition-colors">
                                        <span className="text-[10px] text-slate-600 font-mono uppercase tracking-wider group-hover:text-emerald-500/50">Verified Link</span>
                                        <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-emerald-400 transition-all transform group-hover:translate-x-1" />
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      )}
      
      {/* History Section */}
      {history.length > 0 && (
          <div className="pt-12 border-t border-white/5 animate-in fade-in">
              <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-mono uppercase tracking-wider text-white">Recent Sketches</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                        {history.length}
                      </span>
                  </div>
                  {onOpenExportHistory && (
                    <button 
                      type="button"
                      onClick={onOpenExportHistory}
                      className="px-3 py-1.5 rounded-xl bg-slate-900/70 hover:bg-emerald-600/20 border border-white/10 hover:border-emerald-500/40 text-slate-300 hover:text-white text-xs font-mono transition-all flex items-center gap-2"
                      title="Export article sketches as structured JSON"
                    >
                      <FileJson className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Export JSON</span>
                    </button>
                  )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {history.map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => loadFromHistory(item)}
                        className="group bg-slate-900/50 border border-white/5 hover:border-emerald-500/50 rounded-xl overflow-hidden text-left transition-all hover:shadow-neon-emerald"
                      >
                          <div className="aspect-video relative overflow-hidden bg-slate-950">
                              <img src={`data:image/png;base64,${item.imageData}`} alt={item.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="p-3">
                              <p className="text-xs font-bold text-white truncate font-mono">{item.title}</p>
                              <p className="text-[10px] text-slate-500 mt-1 truncate">{getDisplayHostname(item.url)}</p>
                          </div>
                      </button>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default ArticleToInfographic;
