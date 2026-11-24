import { Crown, Play, Trophy } from 'lucide-react';
import type { HudSnapshot } from '../types';

interface VictoryOverlayProps {
  hud: HudSnapshot;
  onStartNextMatch: () => void;
}

export function VictoryOverlay({ hud, onStartNextMatch }: VictoryOverlayProps) {
  const victory = hud.victory;
  if (!victory || hud.status !== 'VICTORY') return null;

  const isRed = victory.winner === 'RED';
  const accentColor = isRed ? '#FF2A5F' : '#00E5FF';
  const reasonLabel =
    victory.reason === 'KNOCKOUT'
      ? '100% BASE KNOCKOUT'
      : victory.reason === 'SUDDEN_DEATH'
      ? 'SUDDEN DEATH WINNER'
      : `TERRITORY VICTORY · ${isRed ? victory.finalRedPercent : victory.finalBluePercent}%`;

  return (
    <div className="absolute inset-0 z-30 bg-[#090B14]/88 backdrop-blur-md flex flex-col items-center justify-center p-5 select-none">
      <div
        className="w-full max-w-[360px] rounded-xl bg-[#0D101D] border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
        style={{ borderColor: accentColor }}
      >
        {/* Winner Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center gap-1.5 text-xs font-extrabold tracking-widest text-[#FFD166]">
            <Trophy className="w-4 h-4" aria-hidden="true" />
            <span>{reasonLabel}</span>
          </div>

          <h2
            className="font-display text-4xl sm:text-5xl font-black tracking-wide leading-none mt-1.5"
            style={{ color: accentColor }}
          >
            TEAM {victory.winner} WINS!
          </h2>

          <div className="mt-2 flex items-center justify-center gap-3 text-xs font-semibold text-slate-300 tabular-nums">
            <span>
              RED <strong className="text-[#FF2A5F] font-mono-num">{victory.finalRedPercent}%</strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              BLUE <strong className="text-[#00E5FF] font-mono-num">{victory.finalBluePercent}%</strong>
            </span>
          </div>
        </div>

        {/* Top 3 MVPs Podium */}
        <div className="mt-5">
          <div className="text-[11px] font-bold tracking-widest text-slate-400 mb-2 text-center">
            TOP 3 WINNING MVPS
          </div>

          {victory.mvps.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-4">
              No words landed this match.
            </div>
          ) : (
            <div className="space-y-2">
              {victory.mvps.map((mvp, index) => (
                <div
                  key={mvp.username}
                  className="flex items-center justify-between gap-2.5 p-2.5 rounded-lg bg-white/[0.04] border border-white/10"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <div
                        className="w-10 h-10 rounded-full overflow-hidden border-2 bg-[#090B14]"
                        style={{
                          borderColor: index === 0 ? '#FFD166' : 'rgba(255,255,255,0.35)',
                        }}
                      >
                        <img
                          src={mvp.avatarUrl}
                          alt={`${mvp.nickname} profile picture`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {index === 0 && (
                        <Crown
                          className="w-3.5 h-3.5 text-[#FFD166] absolute -top-2 -right-1 drop-shadow"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-num text-[11px] font-bold text-slate-400">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-bold text-white truncate">
                          {mvp.nickname}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Best: <strong className="text-[#FFD166]">{mvp.biggestWord}</strong>{' '}
                        <span className="font-mono-num">(+{mvp.biggestWordPush.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className="font-mono-num text-sm font-extrabold"
                      style={{ color: accentColor }}
                    >
                      +{mvp.totalPush.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-400 tabular-nums">
                      {mvp.wordsCount} {mvp.wordsCount === 1 ? 'word' : 'words'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* !SWITCH Intermission Prompt */}
        <div className="mt-4 pt-3 border-t border-white/10 text-center">
          {hud.recentSwitchMessage ? (
            <div className="text-xs font-bold text-[#FFD166] mb-2">
              {hud.recentSwitchMessage}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 mb-3">
              Type <strong className="text-white font-mono-num">!SWITCH</strong> in chat now to swap to the underdog team
            </div>
          )}

          <button
            type="button"
            onClick={onStartNextMatch}
            className="w-full h-10 rounded-lg font-bold text-sm text-[#090B14] flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer"
            style={{ backgroundColor: accentColor }}
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Next Match in {victory.nextMatchInSeconds}s · Start Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
