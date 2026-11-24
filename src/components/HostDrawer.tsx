import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Radio,
  Scale,
  Send,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DICTIONARY_COUNT } from '../data/dictionary';
import { gameEngine } from '../engine/gameEngine';
import type { HudSnapshot, SimIntensity, WsConnectionStatus } from '../types';

interface HostDrawerProps {
  open: boolean;
  onClose: () => void;
  hud: HudSnapshot;
  wsUrl: string;
  wsStatus: WsConnectionStatus;
  wsError: string | null;
  wsMessageCount: number;
  onWsUrlChange: (url: string) => void;
  onConnectWs: () => void;
  onDisconnectWs: () => void;
  onToggleSim: (enabled: boolean) => void;
  onChangeIntensity: (intensity: SimIntensity) => void;
}

export function HostDrawer({
  open,
  onClose,
  hud,
  wsUrl,
  wsStatus,
  wsError,
  wsMessageCount,
  onWsUrlChange,
  onConnectWs,
  onDisconnectWs,
  onToggleSim,
  onChangeIntensity,
}: HostDrawerProps) {
  const [testNickname, setTestNickname] = useState('Host Tester');
  const [testWord, setTestWord] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [submitCue, setSubmitCue] = useState<{ kind: 'VALID' | 'ERROR'; message: string; key: number } | null>(null);

  if (!open) return null;

  const preview = gameEngine.validateWordPreview(testWord);
  const isInvalidPreview =
    preview.status === 'TAKEN' ||
    preview.status === 'RULE_MISS' ||
    preview.status === 'MODIFIER_MISS' ||
    preview.status === 'NOT_IN_DICT';

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanedWord = testWord.trim();
    const cleanedNick = testNickname.trim() || 'Host Tester';
    if (!cleanedWord) return;
    const res = gameEngine.processChatMessage({
      username: cleanedNick.toLowerCase().replace(/\s+/g, '_'),
      nickname: cleanedNick,
      comment: cleanedWord,
    });
    if (res.outcome === 'VALID' || res.outcome === 'SWITCH') {
      setSubmitCue({ kind: 'VALID', message: res.reason, key: Date.now() });
      setTestWord('');
    } else if (res.outcome === 'TAKEN' || res.outcome === 'INVALID' || res.outcome === 'COOLDOWN') {
      setSubmitCue({ kind: 'ERROR', message: res.reason, key: Date.now() });
    }
  };

  const handleQuickFill = () => {
    setTestWord(gameEngine.getSampleValidWord());
    setSubmitCue(null);
  };

  const handleCopyBridgeSnippet = () => {
    const snippet = `window.onTikTokChatMessage({ username: "viewer_one", nickname: "Alex", comment: "${gameEngine.getSampleValidWord()}" })`;
    navigator.clipboard
      ?.writeText(snippet)
      .then(() => {
        setCopiedSnippet(true);
        setTimeout(() => setCopiedSnippet(false), 1800);
      })
      .catch(() => {});
  };

  const intensities: { id: SimIntensity; label: string }[] = [
    { id: 'CHILL', label: 'Chill' },
    { id: 'HYPE', label: 'Hype' },
    { id: 'CHAOS', label: 'Chaos' },
  ];

  return (
    <div
      className="absolute inset-0 z-40 bg-[#05060B]/75 backdrop-blur-sm flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Live TikTok Bridge and Simulator Controls"
    >
      <div className="w-full max-h-[86%] bg-[#0D101D] border-t border-white/15 rounded-t-2xl flex flex-col overflow-hidden shadow-[0_-16px_48px_rgba(0,0,0,0.85)]">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div>
            <h3 className="font-display text-xl font-black tracking-wide text-white leading-none">
              HOST STUDIO · LIVE &amp; SIMULATOR
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              {DICTIONARY_COUNT.toLocaleString()}+ English words · Red {hud.redPlayerCount} vs Blue {hud.bluePlayerCount} (auto-balanced)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Host Drawer"
            className="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-5">
          {/* 1. Manual Test Input Bar with Real-Time Validation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-wider text-white">
                Manual Test Fire (Real-Time Validation)
              </span>
              <button
                type="button"
                onClick={handleQuickFill}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FFD166] hover:text-white transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                Fill valid word
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <div className="grid grid-cols-[1fr_1.3fr] gap-2">
                <input
                  type="text"
                  value={testNickname}
                  onChange={(e) => setTestNickname(e.target.value)}
                  placeholder="Player Nickname"
                  aria-label="Player nickname"
                  className="h-10 px-3 rounded-lg bg-[#090B14] border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF]"
                />
                <input
                  key={submitCue?.key || 'drawer-input'}
                  type="text"
                  value={testWord}
                  onChange={(e) => setTestWord(e.target.value)}
                  placeholder={`Word (${hud.baseRule.shortTag}) or !SWITCH`}
                  aria-label="Test word or command"
                  className={`h-10 px-3 rounded-lg bg-[#090B14] border text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors ${
                    submitCue?.kind === 'ERROR'
                      ? 'animate-input-shake border-[#FF2A5F] bg-[#FF2A5F]/15'
                      : submitCue?.kind === 'VALID'
                      ? 'animate-valid-flash border-[#4ADE80]'
                      : preview.status === 'VALID'
                      ? 'border-[#4ADE80]'
                      : isInvalidPreview
                      ? 'border-[#FF2A5F]'
                      : 'border-white/15 focus:border-[#FF2A5F]'
                  }`}
                />
              </div>

              {/* Real-time validation status line */}
              <div className="flex items-center justify-between text-[11px] min-h-[18px]">
                {testWord.trim().length > 0 ? (
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${
                      preview.status === 'VALID'
                        ? 'text-[#4ADE80]'
                        : isInvalidPreview
                        ? 'text-[#FF8FA3]'
                        : 'text-slate-400'
                    }`}
                  >
                    {preview.status === 'VALID' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : isInvalidPreview ? (
                      <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : null}
                    {preview.message}
                  </span>
                ) : submitCue ? (
                  <span
                    className={`font-bold ${
                      submitCue.kind === 'VALID' ? 'text-[#4ADE80]' : 'text-[#FF8FA3]'
                    }`}
                  >
                    {submitCue.message}
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Active rule: {hud.baseRule.label}
                    {hud.activeModifier ? ` · ${hud.activeModifier.label}` : ''}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className={`w-full h-10 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  preview.status === 'VALID'
                    ? 'bg-[#22C55E] hover:bg-[#4ADE80] text-[#05060B]'
                    : 'bg-[#00E5FF] hover:bg-[#33ecff] text-[#090B14]'
                }`}
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                Fire Energy Beam as {testNickname.trim() || 'Host Tester'}
              </button>
            </form>
          </div>

          {/* 2. Battlefield Power-Ups & Team Balance Quick Actions */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Zap className="w-3.5 h-3.5 text-[#FFD166]" aria-hidden="true" />
                <span>Battlefield Power-Ups &amp; Team Balance</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
              Orbs spawn on the battlefield and are also awarded for <strong className="text-slate-200">Longest Word</strong> (Double Push), <strong className="text-slate-200">Fastest Word</strong> (Invert Control), and <strong className="text-slate-200">3x Streaks</strong> (Shield Break).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => gameEngine.spawnFieldPowerUp()}
                className="h-9 px-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-[#FFD166]" aria-hidden="true" />
                Spawn Power-Up
              </button>
              <button
                type="button"
                onClick={() => gameEngine.rebalanceTeamsIfNeeded(false)}
                className="h-9 px-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 text-[#00E5FF]" aria-hidden="true" />
                Balance Teams
              </button>
            </div>
          </div>

          {/* 3. Built-In Live Match Simulator */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Users className="w-3.5 h-3.5 text-[#FF2A5F]" aria-hidden="true" />
                  <span>Simulate Live TikTok Chat (30 Viewers)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Auto-balanced nicknames, profile portraits, power-ups &amp; mistakes
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={hud.simulatorEnabled}
                onClick={() => onToggleSim(!hud.simulatorEnabled)}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 cursor-pointer ${
                  hud.simulatorEnabled ? 'bg-[#FF2A5F]' : 'bg-white/15'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ${
                    hud.simulatorEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {hud.simulatorEnabled && (
              <div className="mt-3 flex items-center gap-1.5 p-1 rounded-lg bg-[#090B14] border border-white/10">
                {intensities.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeIntensity(item.id)}
                    className={`flex-1 h-8 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      hud.simIntensity === item.id
                        ? 'bg-white/15 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. TikTok Live WebSocket Integration */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Radio className="w-3.5 h-3.5 text-[#00E5FF]" aria-hidden="true" />
                <span>TikTok Live WebSocket Bridge</span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                {wsStatus === 'CONNECTED' ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-[#4ADE80]" aria-hidden="true" />
                    <span className="text-[#4ADE80]">CONNECTED</span>
                  </>
                ) : wsStatus === 'CONNECTING' ? (
                  <span className="text-[#FFD166]">CONNECTING...</span>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span className="text-slate-400">DISCONNECTED</span>
                  </>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mb-2">
              Connects to TikFinity or TikTok-Live-Connector WebSocket JSON events (
              <code className="text-slate-200">data.nickname</code>,{' '}
              <code className="text-slate-200">data.profilePictureUrl</code>,{' '}
              <code className="text-slate-200">data.comment</code>).
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => onWsUrlChange(e.target.value)}
                disabled={wsStatus === 'CONNECTED' || wsStatus === 'CONNECTING'}
                placeholder="ws://localhost:21213"
                aria-label="WebSocket Server URL"
                className="flex-1 h-10 px-3 rounded-lg bg-[#090B14] border border-white/15 font-mono-num text-xs text-white placeholder:text-slate-500 disabled:opacity-60 focus:outline-none focus:border-[#00E5FF]"
              />
              {wsStatus === 'CONNECTED' || wsStatus === 'CONNECTING' ? (
                <button
                  type="button"
                  onClick={onDisconnectWs}
                  className="h-10 px-4 rounded-lg bg-[#FF2A5F] hover:bg-[#ff4271] text-white font-bold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConnectWs}
                  className="h-10 px-4 rounded-lg bg-white/12 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Connect
                </button>
              )}
            </div>

            {wsError && <p className="mt-1.5 text-[11px] text-[#FF8FA3]">{wsError}</p>}
            {wsStatus === 'CONNECTED' && (
              <p className="mt-1.5 text-[11px] text-[#4ADE80] tabular-nums">
                Listening live · {wsMessageCount} chat events received
              </p>
            )}

            <div className="mt-3 p-2.5 rounded-lg bg-[#090B14] border border-white/10">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-wider text-slate-400">
                  GLOBAL WINDOW HOOK (BROWSER SOURCE)
                </span>
                <button
                  type="button"
                  onClick={handleCopyBridgeSnippet}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#00E5FF] hover:text-white cursor-pointer"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="w-3 h-3" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" aria-hidden="true" />
                      Copy snippet
                    </>
                  )}
                </button>
              </div>
              <code className="block text-[10.5px] font-mono text-slate-300 break-all">
                window.onTikTokChatMessage(&#123; username, nickname, avatarUrl, comment &#125;)
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
