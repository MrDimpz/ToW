import { RefreshCw, Shield, ShieldOff, Users, Zap } from 'lucide-react';
import type { HudSnapshot } from '../types';

interface TopHudProps {
  hud: HudSnapshot;
}

function formatClock(sec: number): string {
  const clamped = Math.max(0, Math.ceil(sec));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TopHud({ hud }: TopHudProps) {
  const redPct = Math.round(hud.redPercent);
  const bluePct = 100 - redPct;
  const isOverdrive = hud.phase === 3 && hud.status === 'PLAYING';
  const isSuddenDeath = hud.status === 'SUDDEN_DEATH';
  const clockSec = isSuddenDeath ? hud.suddenDeathSec : hud.timeRemainingSec;
  const now = Date.now();
  const redInverted = now < hud.redPowerUps.invertedUntil;
  const blueInverted = now < hud.bluePowerUps.invertedUntil;

  const phaseText = isSuddenDeath
    ? 'SUDDEN DEATH'
    : hud.status === 'PAUSED'
    ? 'MATCH PAUSED'
    : hud.status === 'VICTORY'
    ? 'MATCH COMPLETE'
    : hud.phase === 1
    ? 'PHASE 1 · SKIRMISH'
    : hud.phase === 2
    ? 'PHASE 2 · MODIFIER'
    : 'OVERDRIVE 2X';

  return (
    <header className="relative z-20 shrink-0 min-h-[78px] bg-[#090B14] border-b border-white/10 flex flex-col justify-between select-none">
      {/* Subtle Session Score Tracker or Live Auto-Balance Notice at very top edge */}
      <div className="flex items-center justify-center gap-3 px-3 pt-1 text-[10px] font-semibold tracking-wider text-slate-400 tabular-nums truncate">
        {hud.balanceNotice ? (
          <span className="text-[#FFD166] font-bold truncate">{hud.balanceNotice}</span>
        ) : (
          <>
            <span>
              RED WINS: <strong className="text-[#FF2A5F] font-mono-num">{hud.redWins}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">|</span>
            <span className="text-slate-500">MATCH #{hud.matchNumber}</span>
            <span aria-hidden="true" className="text-slate-600">|</span>
            <span>
              BLUE WINS: <strong className="text-[#00E5FF] font-mono-num">{hud.blueWins}</strong>
            </span>
          </>
        )}
      </div>

      {/* Main 3-Column Broadcast HUD */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pb-1.5 gap-2">
        {/* LEFT: TEAM RED */}
        <div className="flex flex-col items-start min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-2xl sm:text-3xl font-black leading-none text-[#FF2A5F] tabular-nums tracking-tight">
              {redPct}%
            </span>
            <span className="text-[11px] font-bold tracking-wide text-[#FF2A5F]/90 truncate">
              TEAM RED
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] text-slate-300 mt-0.5 tabular-nums">
            <span className="inline-flex items-center gap-0.5">
              <Users className="w-3 h-3 text-[#FF2A5F]" aria-hidden="true" />
              {hud.redPlayerCount}
            </span>
            {hud.redShields > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#FFD166] font-bold">
                <Shield className="w-3 h-3" aria-hidden="true" />
                {hud.redShields}
              </span>
            )}
            {hud.redPowerUps.doublePushCharges > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#FFD166] font-extrabold">
                <Zap className="w-3 h-3" aria-hidden="true" />
                2X
              </span>
            )}
            {hud.redPowerUps.shieldBreakReady && (
              <span className="inline-flex items-center gap-0.5 text-[#FB7185] font-extrabold">
                <ShieldOff className="w-3 h-3" aria-hidden="true" />
                BRK
              </span>
            )}
            {redInverted && (
              <span className="inline-flex items-center gap-0.5 text-[#C084FC] font-extrabold">
                <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                INV
              </span>
            )}
          </div>
        </div>

        {/* CENTER: 60s CLOCK + PHASE */}
        <div className="flex flex-col items-center justify-center px-2.5 py-0.5 rounded-md bg-white/[0.04] border border-white/10">
          <div
            className={`font-mono-num text-xl sm:text-2xl font-extrabold leading-none tracking-tight ${
              isSuddenDeath || (isOverdrive && clockSec <= 10)
                ? 'text-[#FFD166]'
                : 'text-white'
            }`}
          >
            {formatClock(clockSec)}
          </div>
          <div
            className={`text-[9.5px] font-extrabold tracking-widest mt-0.5 whitespace-nowrap ${
              isOverdrive || isSuddenDeath
                ? 'text-[#FFD166]'
                : hud.phase === 2
                ? 'text-[#FF9F43]'
                : 'text-slate-300'
            }`}
          >
            {phaseText}
          </div>
        </div>

        {/* RIGHT: TEAM BLUE */}
        <div className="flex flex-col items-end min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-bold tracking-wide text-[#00E5FF]/90 truncate">
              TEAM BLUE
            </span>
            <span className="font-display text-2xl sm:text-3xl font-black leading-none text-[#00E5FF] tabular-nums tracking-tight">
              {bluePct}%
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-[10.5px] text-slate-300 mt-0.5 tabular-nums">
            {blueInverted && (
              <span className="inline-flex items-center gap-0.5 text-[#C084FC] font-extrabold">
                <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                INV
              </span>
            )}
            {hud.bluePowerUps.shieldBreakReady && (
              <span className="inline-flex items-center gap-0.5 text-[#FB7185] font-extrabold">
                <ShieldOff className="w-3 h-3" aria-hidden="true" />
                BRK
              </span>
            )}
            {hud.bluePowerUps.doublePushCharges > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#FFD166] font-extrabold">
                <Zap className="w-3 h-3" aria-hidden="true" />
                2X
              </span>
            )}
            {hud.blueShields > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#FFD166] font-bold">
                <Shield className="w-3 h-3" aria-hidden="true" />
                {hud.blueShields}
              </span>
            )}
            <span className="inline-flex items-center gap-0.5">
              {hud.bluePlayerCount}
              <Users className="w-3 h-3 text-[#00E5FF]" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>

      {/* Crisp Territory Balance Hairline Bar */}
      <div className="w-full h-[3px] bg-[#061F33] flex overflow-hidden">
        <div
          className="h-full bg-[#FF2A5F] transition-[width] duration-150 ease-out"
          style={{ width: `${hud.redPercent}%` }}
        />
        <div className="w-[2px] h-full bg-white shrink-0" />
        <div className="h-full flex-1 bg-[#00E5FF]" />
      </div>
    </header>
  );
}
