import { Flame, Shield, Zap } from 'lucide-react';
import type { HudSnapshot } from '../types';

interface HorizonCommandDeckProps {
  hud: HudSnapshot;
}

export function HorizonCommandDeck({ hud }: HorizonCommandDeckProps) {
  // Clamp vertical position between 18% and 80% so the prompt card rides the moving border cleanly without overlapping bases
  const clampedY = Math.max(18, Math.min(80, hud.redPercent));
  const isOverdrive = hud.phase === 3;
  const bountyPct = hud.activeBounty
    ? Math.max(0, Math.min(100, (hud.bountyRemainingSec / (hud.activeBounty.durationMs / 1000)) * 100))
    : 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      {/* Floating Command Deck anchored to the moving Horizon Laser Border */}
      <div
        className="absolute left-1/2 w-[88%] max-w-[380px] transition-[top] duration-150 ease-out"
        style={{
          top: `${clampedY}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          className={`rounded-lg bg-[#090B14]/92 backdrop-blur-md border px-3.5 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.72)] ${
            isOverdrive
              ? 'border-[#FFD166]/90 shadow-[0_0_24px_rgba(255,209,102,0.3)]'
              : 'border-white/20'
          }`}
        >
          {/* Primary Rule Line */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Zap
                className={`w-4 h-4 shrink-0 ${isOverdrive ? 'text-[#FFD166]' : 'text-white'}`}
                aria-hidden="true"
              />
              <h2 className="font-display text-[22px] sm:text-2xl font-black tracking-wide text-white leading-none truncate">
                {hud.baseRule.label}
              </h2>
            </div>

            {isOverdrive && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-extrabold text-[#FFD166] tracking-wider whitespace-nowrap">
                <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                2X POWER
              </span>
            )}
          </div>

          {/* Modifier + Bonus Shield Letter Row (Clean unboxed metadata separated by typographic dot) */}
          <div className="mt-1.5 pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] font-bold">
            <div className="flex items-center gap-1.5 min-w-0">
              {hud.activeModifier ? (
                <span className="text-[#FF8FA3] tracking-wide truncate">
                  MODIFIER: <strong className="text-white">{hud.activeModifier.label}</strong>
                </span>
              ) : (
                <span className="text-slate-400 font-semibold">
                  3+ LETTERS · LONGER = MORE PUSH
                </span>
              )}
            </div>

            <div className="inline-flex items-center gap-1 text-[#FFD166] shrink-0 whitespace-nowrap">
              <Shield className="w-3 h-3" aria-hidden="true" />
              <span>
                BONUS [{hud.bonusLetter}] = SHIELD
              </span>
            </div>
          </div>

          {/* Golden Bounty Banner (appears every 18s for 10s) */}
          {hud.activeBounty && (
            <div className="mt-2 pt-1.5 border-t border-[#FFD166]/35">
              <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold text-[#FFD166]">
                <span className="truncate">BOUNTY: {hud.activeBounty.shortLabel}</span>
                <span className="font-mono-num shrink-0">
                  {hud.bountyRemainingSec.toFixed(1)}s
                </span>
              </div>
              <div className="mt-1 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FFD166] transition-[width] duration-100 ease-linear"
                  style={{ width: `${bountyPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dramatic Center-Screen Event Banner (Nuclear Hit, Phase Shift, Air-Strike, Knockout) */}
      {hud.activeBanner && (
        <div
          key={hud.activeBanner.id}
          className="animate-banner-pop absolute left-1/2 top-[28%] w-[90%] max-w-[390px] z-30"
        >
          <div
            className={`rounded-lg px-4 py-2.5 text-center border-2 shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-md ${
              hud.activeBanner.accent === 'RED'
                ? 'bg-[#2A0815]/95 border-[#FF2A5F] text-white'
                : hud.activeBanner.accent === 'BLUE'
                ? 'bg-[#061F33]/95 border-[#00E5FF] text-white'
                : hud.activeBanner.accent === 'GOLD'
                ? 'bg-[#1D1505]/95 border-[#FFD166] text-[#FFD166]'
                : hud.activeBanner.accent === 'PURPLE'
                ? 'bg-[#1C0B2E]/95 border-[#C084FC] text-[#E9D5FF]'
                : 'bg-[#090B14]/95 border-white/70 text-white'
            }`}
          >
            <div className="font-display text-2xl sm:text-3xl font-black tracking-wider leading-none uppercase">
              {hud.activeBanner.title}
            </div>
            <div className="mt-1 text-xs sm:text-sm font-bold text-white/95 truncate">
              {hud.activeBanner.subtitle}
            </div>
          </div>
        </div>
      )}

      {/* Paused Dimmer */}
      {hud.status === 'PAUSED' && (
        <div className="absolute inset-0 bg-[#090B14]/65 backdrop-blur-[2px] flex items-center justify-center z-20">
          <div className="px-5 py-3 rounded-lg bg-[#090B14]/95 border border-white/20 text-center">
            <div className="font-display text-3xl font-black tracking-wider text-white">
              MATCH PAUSED
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              Tap Resume in the host bar to continue the battle
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
