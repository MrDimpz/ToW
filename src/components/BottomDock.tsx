import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { gameEngine } from '../engine/gameEngine';
import type { HudSnapshot, WsConnectionStatus } from '../types';

interface BottomDockProps {
  hud: HudSnapshot;
  wsStatus: WsConnectionStatus;
  onTogglePause: () => void;
  onResetTeams: () => void;
  onNextPhase: () => void;
  onToggleMute: () => void;
  onOpenDrawer: () => void;
}

export function BottomDock({
  hud,
  wsStatus,
  onTogglePause,
  onResetTeams,
  onNextPhase,
  onToggleMute,
  onOpenDrawer,
}: BottomDockProps) {
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [quickWord, setQuickWord] = useState('');
  const [submitCue, setSubmitCue] = useState<{ kind: 'VALID' | 'ERROR'; message: string; key: number } | null>(null);

  const isPaused = hud.status === 'PAUSED';
  const preview = gameEngine.validateWordPreview(quickWord);
  const isInvalidPreview =
    preview.status === 'TAKEN' ||
    preview.status === 'RULE_MISS' ||
    preview.status === 'MODIFIER_MISS' ||
    preview.status === 'NOT_IN_DICT';

  const handleQuickSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!quickWord.trim()) return;
    const res = gameEngine.processChatMessage({
      username: 'player_you',
      nickname: 'You',
      comment: quickWord,
    });
    if (res.outcome === 'VALID' || res.outcome === 'SWITCH') {
      setSubmitCue({ kind: 'VALID', message: res.reason, key: Date.now() });
      setQuickWord('');
    } else if (res.outcome === 'TAKEN' || res.outcome === 'INVALID' || res.outcome === 'COOLDOWN') {
      setSubmitCue({ kind: 'ERROR', message: res.reason, key: Date.now() });
    }
    setTimeout(() => {
      setSubmitCue((curr) => (curr && Date.now() - curr.key >= 1400 ? null : curr));
    }, 1500);
  };

  return (
    <section
      aria-label="Used words feed, quick type validator, and streamer controls"
      className="relative z-20 shrink-0 min-h-[146px] max-h-[24%] bg-[#090B14] border-t border-white/10 flex flex-col justify-between select-none"
    >
      {/* 1. Burned Words Feed (Last 10 validated words + exact score effect) */}
      <div className="flex-1 min-h-0 px-3 pt-1.5 pb-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-slate-400 mb-1">
          <span>USED-WORDS TICKER · LOCKED OUT ({hud.burnedWords.length}/10)</span>
          <span className="text-slate-500">SCORE IMPACT</span>
        </div>

        {hud.burnedWords.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
            Waiting for first validated word...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto thin-scroll pr-0.5">
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-0.5">
              {hud.burnedWords.map((entry) => {
                const isRed = entry.team === 'RED';
                const isInverted = entry.effectLabel === 'INVERTED!';
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-1 text-[11px] leading-tight py-0.5 border-b border-white/[0.05] min-w-0"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className={`font-display font-extrabold text-[13px] tracking-wide truncate ${
                          isInverted
                            ? 'text-[#C084FC]'
                            : entry.tier === 'BOUNTY'
                            ? 'text-[#FFD166]'
                            : isRed
                            ? 'text-[#FF2A5F]'
                            : 'text-[#00E5FF]'
                        }`}
                      >
                        {entry.word}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        {entry.nickname}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {entry.effectLabel && (
                        <span className="text-[8.5px] font-bold tracking-tight text-[#FFD166] uppercase">
                          {entry.effectLabel}
                        </span>
                      )}
                      <span
                        className={`font-mono-num text-[10px] font-bold ${
                          isInverted
                            ? 'text-[#C084FC]'
                            : entry.tier === 'NUCLEAR' || entry.tier === 'BOUNTY'
                            ? 'text-[#FFD166]'
                            : 'text-slate-200'
                        }`}
                      >
                        {isInverted ? '↺' : '+'}
                        {entry.pushPercent.toFixed(entry.pushPercent % 1 === 0 ? 0 : 1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Real-Time Validation Word Input Strip */}
      <div className="px-2.5 py-1 border-t border-white/[0.08] bg-[#0B0E1A]">
        <form onSubmit={handleQuickSubmit} className="flex items-center gap-1.5">
          <div
            key={submitCue?.key || 'idle'}
            className={`relative flex-1 flex items-center rounded-md border transition-colors ${
              submitCue?.kind === 'ERROR'
                ? 'animate-input-shake border-[#FF2A5F] bg-[#FF2A5F]/15'
                : submitCue?.kind === 'VALID'
                ? 'animate-valid-flash border-[#4ADE80] bg-[#22C55E]/15'
                : preview.status === 'VALID'
                ? 'border-[#4ADE80]/80 bg-[#22C55E]/10'
                : isInvalidPreview
                ? 'border-[#FF2A5F]/80 bg-[#FF2A5F]/10'
                : 'border-white/15 bg-[#090B14]'
            }`}
          >
            <input
              type="text"
              value={quickWord}
              onChange={(e) => setQuickWord(e.target.value)}
              placeholder={`Type word (${hud.baseRule.label})...`}
              aria-label="Type a word to play with real-time validation"
              className="w-full h-8 pl-2.5 pr-2 bg-transparent text-xs font-semibold text-white placeholder:text-slate-500 focus:outline-none"
            />
            {quickWord.trim().length > 0 && (
              <span
                className={`pr-2 inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap shrink-0 ${
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
                <span className="max-w-[130px] truncate">{preview.message}</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            aria-label="Send word"
            className={`h-8 px-2.5 rounded-md font-bold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              preview.status === 'VALID'
                ? 'bg-[#22C55E] hover:bg-[#4ADE80] text-[#05060B]'
                : 'bg-white/12 hover:bg-white/20 text-white'
            }`}
          >
            <Send className="w-3 h-3" aria-hidden="true" />
            Fire
          </button>
        </form>
        {submitCue && quickWord.trim().length === 0 && (
          <div
            className={`mt-0.5 text-[10px] font-bold truncate ${
              submitCue.kind === 'VALID' ? 'text-[#4ADE80]' : 'text-[#FF8FA3]'
            }`}
          >
            {submitCue.message}
          </div>
        )}
      </div>

      {/* 3. Collapsible Streamer Host Control Bar */}
      <div className="border-t border-white/10 bg-[#0D101D] px-2 py-1.5">
        {controlsCollapsed ? (
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold text-slate-400">
              Host Controls Hidden
            </span>
            <button
              type="button"
              onClick={() => setControlsCollapsed(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              Show Controls
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onTogglePause}
                title={isPaused ? 'Resume Match' : 'Pause Match'}
                className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#00E5FF]" aria-hidden="true" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                    Pause
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onNextPhase}
                title="Jump to Next Phase"
                className="inline-flex items-center justify-center gap-1 h-8 px-2 rounded bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FastForward className="w-3.5 h-3.5 text-[#FFD166]" aria-hidden="true" />
                Phase
              </button>

              <button
                type="button"
                onClick={onResetTeams}
                title="Reset Teams & Session Score"
                className="inline-flex items-center justify-center gap-1 h-8 px-2 rounded bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={hud.muted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
                title={hud.muted ? 'Unmute Audio' : 'Mute Audio'}
                className="inline-flex items-center justify-center h-8 w-8 rounded bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                {hud.muted ? (
                  <VolumeX className="w-3.5 h-3.5 text-[#FF2A5F]" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-[#00E5FF]" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={onOpenDrawer}
                className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded bg-[#FF2A5F] hover:bg-[#ff4271] text-white text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Live / Sim</span>
                {wsStatus === 'CONNECTED' && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]"
                    title="TikTok WebSocket Connected"
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => setControlsCollapsed(true)}
                aria-label="Collapse Host Controls"
                title="Hide Host Bar"
                className="inline-flex items-center justify-center h-8 w-7 rounded bg-white/[0.04] hover:bg-white/[0.12] text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
