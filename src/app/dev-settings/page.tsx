'use client';

import { useState, useEffect } from 'react';
import { Key, Save, CheckCircle, Eye, EyeOff, ArrowLeft, Cpu, Sparkles } from 'lucide-react';
import Link from 'next/link';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

export default function DevSettingsPage() {
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [currentGeminiKey, setCurrentGeminiKey] = useState('');
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    setIsDev(process.env.NODE_ENV === 'development');
    const geminiStored = localStorage.getItem('gemini_api_key');
    if (geminiStored) setCurrentGeminiKey(geminiStored);
  }, []);

  if (!isDev) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-headline-md font-bold text-on-surface mb-2">Not Found</h1>
          <p className="text-on-surface-variant">This page is only available in development.</p>
          <Link href="/" className="inline-block mt-4 text-primary hover:underline text-sm">
            Go to app
          </Link>
        </div>
      </div>
    );
  }

  const handleSaveGemini = () => {
    if (geminiKey.trim()) {
      localStorage.setItem('gemini_api_key', geminiKey.trim());
      setCurrentGeminiKey(geminiKey.trim());
      setGeminiKey('');
      setGeminiSaved(true);
      setTimeout(() => setGeminiSaved(false), 2000);
    }
  };

  const handleClearGemini = () => {
    localStorage.removeItem('gemini_api_key');
    setCurrentGeminiKey('');
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-elevated border border-outline-variant/30 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="p-2 hover:bg-surface-container rounded-lg">
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </Link>
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Key className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-headline-md font-bold text-on-surface">Developer Settings</h1>
            <p className="text-sm text-on-surface-variant">Configure API keys</p>
          </div>
        </div>

        {/* Gemini API Key Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h2 className="text-headline-sm font-bold text-on-surface">Gemini API Key</h2>
          </div>
          <p className="text-sm text-on-surface-variant mb-4">
            Free tier: 15 requests/min, 1M tokens/day. Powers AI chatbot and food photo recognition.
          </p>

          {currentGeminiKey ? (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Gemini Key Configured</span>
                </div>
                <p className="text-xs text-green-700 font-mono mt-1">
                  {currentGeminiKey.substring(0, 12)}...{currentGeminiKey.substring(currentGeminiKey.length - 4)}
                </p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Model: {GEMINI_MODEL}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleClearGemini}
                  className="flex-1 py-3 bg-error-container text-on-error-container rounded-xl text-sm font-bold hover:bg-error-container/80 transition-colors"
                >
                  Remove Key
                </button>
              </div>
              <div className="border-t border-outline-variant/30 pt-3">
                <p className="text-sm text-on-surface-variant mb-2">Update with new key:</p>
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full h-11 px-4 pr-10 rounded-xl border border-outline-variant bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={handleSaveGemini}
                  disabled={!geminiKey.trim()}
                  className="w-full mt-3 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {geminiSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {geminiSaved ? 'Saved!' : 'Update Key'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 mb-1">No API key configured</p>
                <p className="text-xs text-amber-700">
                  Required for AI food detection and chatbot features.
                </p>
              </div>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full h-11 px-4 pr-10 rounded-xl border border-outline-variant bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={handleSaveGemini}
                disabled={!geminiKey.trim()}
                className="w-full py-3 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {geminiSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {geminiSaved ? 'Saved!' : 'Save Gemini Key'}
              </button>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-sm text-primary hover:underline"
              >
                Get free key from Google AI Studio →
              </a>
            </div>
          )}
        </div>

        <p className="text-xs text-on-surface-variant/60 text-center mt-6">
          Free tier: 15 requests/min • Key stored in browser only
        </p>
      </div>
    </div>
  );
}
