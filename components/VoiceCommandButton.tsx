/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Sparkles, Command, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { ViewMode } from '../types';

interface VoiceCommandButtonProps {
  onNavigate: (mode: ViewMode) => void;
  onAnalyzeRepo?: (repoName: string) => void;
  onAuditArchitecture?: () => void;
  onExportPng?: () => void;
}

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const VoiceCommandButton: React.FC<VoiceCommandButtonProps> = ({
  onNavigate,
  onAnalyzeRepo,
  onAuditArchitecture,
  onExportPng
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          currentTranscript += text;
          if (event.results[i].isFinal) {
            handleVoiceCommand(text.trim());
          }
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setFeedbackMessage('Microphone access blocked. Please enable permissions.');
        } else {
          setFeedbackMessage(`Mic error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const speakFeedback = (text: string) => {
    setFeedbackMessage(text);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // stop current speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleVoiceCommand = (commandText: string) => {
    const lower = commandText.toLowerCase().trim();
    setLastCommand(commandText);

    // Command 1: Analyze / Generate Architecture for Repo
    // e.g. "generate architecture for facebook/react", "analyze react-router", "fetch repo vercel/next.js"
    const analyzeMatch = lower.match(/(?:generate architecture|analyze|fetch repo|architecture for|blueprint for|scan repo)\s+(?:for\s+)?([a-zA-Z0-9_\-\.\/]+)/i);
    if (analyzeMatch && analyzeMatch[1]) {
      let targetRepo = analyzeMatch[1].trim();
      if (targetRepo.endsWith('.')) targetRepo = targetRepo.slice(0, -1);
      
      speakFeedback(`Analyzing repository ${targetRepo}`);
      onNavigate(ViewMode.REPO_ANALYZER);
      if (onAnalyzeRepo) {
        onAnalyzeRepo(targetRepo);
      }
      return;
    }

    // Command 2: Navigation
    if (lower.includes('go home') || lower.includes('home page') || lower === 'home') {
      speakFeedback('Navigating to Home');
      onNavigate(ViewMode.HOME);
      return;
    }

    if (lower.includes('sitesketch') || lower.includes('site sketch') || lower.includes('article') || lower.includes('infographic')) {
      speakFeedback('Opening SiteSketch Article to Infographic Studio');
      onNavigate(ViewMode.ARTICLE_INFOGRAPHIC);
      return;
    }

    if (lower.includes('gitflow') || lower.includes('git flow') || lower.includes('repo analyzer') || lower.includes('repository analyzer')) {
      speakFeedback('Opening GitFlow Repository Analyzer');
      onNavigate(ViewMode.REPO_ANALYZER);
      return;
    }

    if (lower.includes('devstudio') || lower.includes('dev studio') || lower.includes('terminal') || lower.includes('dependency graph')) {
      speakFeedback('Opening DevStudio Interactive Canvas');
      onNavigate(ViewMode.DEV_STUDIO);
      return;
    }

    // Command 3: Audit Architecture with Gemini Agent
    if (lower.includes('audit architecture') || lower.includes('run agent') || lower.includes('architecture audit') || lower.includes('check structure')) {
      speakFeedback('Running Gemini Architecture Audit');
      if (onAuditArchitecture) {
        onAuditArchitecture();
      }
      return;
    }

    // Command 4: Export to PNG
    if (lower.includes('export') || lower.includes('download png') || lower.includes('save image')) {
      speakFeedback('Exporting architecture blueprint to PNG');
      if (onExportPng) {
        onExportPng();
      }
      return;
    }

    speakFeedback(`Recognized command: "${commandText}". Command not matched.`);
  };

  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Browser Speech Recognition API is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setFeedbackMessage(null);
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-2">
        <button
          onClick={toggleListening}
          className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all border shadow-md ${
            isListening
              ? 'bg-rose-600/90 hover:bg-rose-500 text-white border-rose-400/50 animate-pulse shadow-rose-500/30'
              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-white/10 hover:border-violet-500/40'
          }`}
          title={isListening ? 'Click to stop listening' : 'Click to enable voice commands'}
        >
          {isListening ? (
            <>
              <Mic className="w-4 h-4 text-white animate-bounce" />
              <span className="hidden sm:inline">Listening...</span>
            </>
          ) : (
            <>
              <MicOff className="w-4 h-4 text-violet-400" />
              <span className="hidden sm:inline">Voice Command</span>
            </>
          )}
        </button>

        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-1.5 rounded-xl bg-slate-900/60 border border-white/10 text-slate-400 hover:text-white transition-colors text-xs"
          title="Voice Command Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Live Transcript & Feedback Banner */}
      {(isListening || feedbackMessage || transcript) && (
        <div className="absolute right-0 top-12 z-50 w-80 p-3.5 bg-slate-950/95 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-2xl space-y-2 text-xs font-mono animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-white/10 pb-1.5">
            <span className="flex items-center gap-1.5 font-bold text-violet-300">
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" /> Voice Assistant
            </span>
            {isListening && <span className="text-rose-400 animate-pulse font-bold">• MIC LIVE</span>}
          </div>

          {transcript && (
            <div className="text-slate-200 bg-white/5 p-2 rounded-lg border border-white/5 italic">
              "{transcript}"
            </div>
          )}

          {feedbackMessage && (
            <div className="flex items-start gap-2 text-emerald-300 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
              <Volume2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{feedbackMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Voice Commands Help Modal / Popover */}
      {showHelp && (
        <div className="absolute right-0 top-12 z-50 w-88 p-4 bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl space-y-3 text-xs font-mono text-slate-300 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-bold text-white flex items-center gap-2">
              <Command className="w-4 h-4 text-violet-400" /> Natural Voice Commands
            </span>
            <button
              onClick={() => setShowHelp(false)}
              className="text-slate-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-[11px] leading-relaxed">
            <p className="text-slate-400">Speak naturally into your microphone to trigger actions:</p>

            <div className="p-2 bg-white/5 rounded-lg border border-white/5 space-y-1">
              <p className="text-violet-300 font-bold">1. Repository Analysis:</p>
              <p className="text-slate-300">"Generate architecture for facebook/react"</p>
              <p className="text-slate-300">"Analyze vercel/next.js"</p>
            </div>

            <div className="p-2 bg-white/5 rounded-lg border border-white/5 space-y-1">
              <p className="text-emerald-300 font-bold">2. Navigation:</p>
              <p className="text-slate-300">"Go Home" | "Switch to SiteSketch"</p>
              <p className="text-slate-300">"Open GitFlow" | "Launch DevStudio"</p>
            </div>

            <div className="p-2 bg-white/5 rounded-lg border border-white/5 space-y-1">
              <p className="text-indigo-300 font-bold">3. Tools & Export:</p>
              <p className="text-slate-300">"Audit architecture"</p>
              <p className="text-slate-300">"Export to PNG"</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceCommandButton;
