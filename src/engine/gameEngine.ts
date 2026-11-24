import { soundEngine } from '../audio/soundEngine';
import { generateAvatarPortraitUrl } from '../data/avatarPortraits';
import {
  extractFirstWord,
  getMatchingDictionaryWords,
  isValidEnglishWord,
  matchesBaseRule,
  matchesBounty,
  matchesModifier,
} from '../data/dictionary';
import {
  createBountyObjective,
  pickBaseRule,
  pickBonusShieldLetter,
  pickModifierForRule,
} from '../data/prompts';
import type {
  BaseRule,
  BountyObjective,
  BurnedWordEntry,
  CenterBanner,
  EnergyBeam,
  FieldPowerUp,
  FloatingCallout,
  HudSnapshot,
  MatchPhase,
  MatchStatus,
  MvpEntry,
  Particle,
  PhaseModifier,
  PlayerRecord,
  PowerUpType,
  ShockwaveRing,
  SimIntensity,
  Team,
  TeamPowerUpState,
  TikTokChatMessage,
  VictorySummary,
  WordValidationPreview,
} from '../types';

const MATCH_DURATION_SEC = 60;
const SUDDEN_DEATH_DURATION_SEC = 10;
const VICTORY_DURATION_SEC = 10;
const COOLDOWN_MS = 3000;
const MAX_BURNED_WORDS = 10;
const MAX_SHIELDS = 6;
const INVERT_DURATION_MS = 6000;

const RED_AVATAR_PALETTE = ['#FF2A5F', '#FF4D6D', '#E11D48', '#FB7185', '#F43F5E', '#FF5E7E'];
const BLUE_AVATAR_PALETTE = ['#00E5FF', '#0EA5E9', '#38BDF8', '#06B6D4', '#22D3EE', '#3B82F6'];

const SIMULATED_NICKNAMES: string[] = [
  'Maya', 'Tyler', 'Chloe', 'Sammy', 'Vortex',
  'Kairo', 'Luna', 'Jayden', 'Zoe', 'Marcus',
  'Nina', 'Devon', 'Aria', 'Liam', 'Sofia',
  'Ethan', 'Milo', 'Bella', 'Noah', 'Ava',
  'Lucas', 'Emma', 'Owen', 'Zara', 'Caleb',
  'Ivy', 'Dylan', 'Ruby', 'Leo', 'Mila',
];

const POWERUP_TRIGGER_LETTERS = ['R', 'N', 'L', 'T', 'D', 'M', 'P', 'C', 'G', 'H'];

function normalizeKey(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase() || 'viewer';
}

function cleanNickname(raw: string): string {
  const cleaned = raw.trim().replace(/^@+/, '');
  return cleaned || 'Viewer';
}

export interface ProcessChatResult {
  outcome: 'VALID' | 'TAKEN' | 'INVALID' | 'COOLDOWN' | 'SWITCH' | 'IGNORED';
  reason: string;
  word?: string;
  pushPercent?: number;
  team?: Team;
}

export class TerritoryWarEngine {
  // Persistent across matches
  public teamRegistry = new Map<string, Team>();
  public players = new Map<string, PlayerRecord>();
  public redWins = 0;
  public blueWins = 0;
  public matchNumber = 1;

  // Current match state
  public status: MatchStatus = 'PLAYING';
  public phase: MatchPhase = 1;
  public timeRemainingSec = MATCH_DURATION_SEC;
  public suddenDeathSec = SUDDEN_DEATH_DURATION_SEC;
  public victoryCountdownSec = VICTORY_DURATION_SEC;

  // Territory: 50.0 = center, 100 = Red wins, 0 = Blue wins
  public targetRedPercent = 50.0;
  public visualRedPercent = 50.0;
  private borderVelocity = 0;

  public redShields = 0;
  public blueShields = 0;

  // Power-Up State
  public redPowerUps: TeamPowerUpState = { doublePushCharges: 0, shieldBreakReady: false, invertedUntil: 0 };
  public bluePowerUps: TeamPowerUpState = { doublePushCharges: 0, shieldBreakReady: false, invertedUntil: 0 };
  public fieldPowerUps: FieldPowerUp[] = [];
  private nextPowerUpAtElapsedSec = 5;
  private longestWordThisMatch = 7; // beating >=8 letters earns Longest Word achievement
  private phaseOpenedAtMs = Date.now();
  private fastestAwardedThisPhase = false;

  public baseRule: BaseRule;
  public plannedModifier: PhaseModifier;
  public activeModifier: PhaseModifier | null = null;
  public bonusLetter: string;
  public activeBounty: BountyObjective | null = null;
  private nextBountyAtElapsedSec = 18;
  private matchElapsedSec = 0;

  public usedWords = new Set<string>();
  public burnedWords: BurnedWordEntry[] = [];
  public activeBanner: CenterBanner | null = null;
  public victorySummary: VictorySummary | null = null;
  public recentSwitchMessage: string | null = null;
  private switchMsgUntil = 0;
  public balanceNotice: string | null = null;
  private balanceNoticeUntil = 0;

  // Visual FX state (consumed directly by 60fps canvas)
  public beams: EnergyBeam[] = [];
  public particles: Particle[] = [];
  public callouts: FloatingCallout[] = [];
  public shockwaves: ShockwaveRing[] = [];
  public screenShake = 0;
  public flashAlpha = 0;
  public flashColor = '#FFFFFF';
  public borderPulse = 0;
  public redShieldFlash = 0;
  public blueShieldFlash = 0;
  public simTime = 0;
  public avatarImageCache = new Map<string, HTMLImageElement>();

  // Simulator state
  public simulatorEnabled = true;
  public simIntensity: SimIntensity = 'HYPE';
  private simAccumulatorMs = 0;
  private simJoinedCount = 0;
  private simJoinTimerMs = 0;
  private cachedValidWords: string[] = [];
  private cacheDirty = true;

  // Subscribers for React HUD
  private listeners = new Set<(snap: HudSnapshot) => void>();
  private lastHudEmitMs = 0;
  private hudDirty = true;

  constructor() {
    this.baseRule = pickBaseRule();
    this.plannedModifier = pickModifierForRule(this.baseRule);
    this.bonusLetter = pickBonusShieldLetter(this.baseRule, null);
    this.seedInitialSimRoster();
  }

  public subscribe(listener: (snap: HudSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitHud(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastHudEmitMs < 65) {
      this.hudDirty = true;
      return;
    }
    this.lastHudEmitMs = now;
    this.hudDirty = false;
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  public getSnapshot(): HudSnapshot {
    let redCount = 0;
    let blueCount = 0;
    this.players.forEach((p) => {
      if (p.team === 'RED') redCount++;
      else blueCount++;
    });

    const now = Date.now();
    const bountyRemainingSec = this.activeBounty
      ? Math.max(0, (this.activeBounty.expiresAt - now) / 1000)
      : 0;

    return {
      status: this.status,
      phase: this.phase,
      timeRemainingSec: Math.max(0, this.timeRemainingSec),
      suddenDeathSec: Math.max(0, this.suddenDeathSec),
      redPercent: this.targetRedPercent,
      bluePercent: 100 - this.targetRedPercent,
      redPlayerCount: redCount,
      bluePlayerCount: blueCount,
      redShields: this.redShields,
      blueShields: this.blueShields,
      redPowerUps: { ...this.redPowerUps },
      bluePowerUps: { ...this.bluePowerUps },
      fieldPowerUps: [...this.fieldPowerUps],
      redWins: this.redWins,
      blueWins: this.blueWins,
      matchNumber: this.matchNumber,
      baseRule: this.baseRule,
      activeModifier: this.activeModifier,
      bonusLetter: this.bonusLetter,
      activeBounty: this.activeBounty,
      bountyRemainingSec,
      burnedWords: this.burnedWords,
      activeBanner: this.activeBanner,
      victory: this.victorySummary
        ? {
            ...this.victorySummary,
            nextMatchInSeconds: Math.ceil(Math.max(0, this.victoryCountdownSec)),
          }
        : null,
      simulatorEnabled: this.simulatorEnabled,
      simIntensity: this.simIntensity,
      muted: soundEngine.isMuted(),
      recentSwitchMessage: now < this.switchMsgUntil ? this.recentSwitchMessage : null,
      balanceNotice: now < this.balanceNoticeUntil ? this.balanceNotice : null,
    };
  }

  private seedInitialSimRoster(): void {
    for (let i = 0; i < 12; i++) {
      this.ensurePlayerDrafted(SIMULATED_NICKNAMES[i], SIMULATED_NICKNAMES[i]);
    }
    this.simJoinedCount = 12;
    this.rebalanceTeamsIfNeeded(true);
  }

  private refreshWordCacheIfNeeded(): void {
    if (!this.cacheDirty) return;
    this.cachedValidWords = getMatchingDictionaryWords(this.baseRule, this.activeModifier, this.usedWords);
    this.cacheDirty = false;
  }

  public getSampleValidWord(): string {
    this.refreshWordCacheIfNeeded();
    if (this.cachedValidWords.length === 0) return 'VICTORY';

    // If a field power-up exists, prefer a word that claims it!
    if (this.fieldPowerUps.length > 0) {
      const pu = this.fieldPowerUps[0];
      const puMatches = this.cachedValidWords.filter((w) => this.matchesPowerUpTrigger(w, pu));
      if (puMatches.length > 0) {
        return puMatches[Math.floor(Math.random() * puMatches.length)];
      }
    }

    const longPool = this.cachedValidWords.filter((w) => w.length >= 6 && w.length <= 10);
    const pool = longPool.length > 0 ? longPool : this.cachedValidWords;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  public matchesPowerUpTrigger(word: string, pu: FieldPowerUp): boolean {
    if (pu.triggerType === 'CONTAINS_LETTER') {
      return word.includes(String(pu.triggerValue));
    }
    return word.length >= Number(pu.triggerValue);
  }

  // Real-time word validation preview for live typing feedback
  public validateWordPreview(rawInput: string): WordValidationPreview {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return { word: '', status: 'EMPTY', message: `Rule: ${this.baseRule.label}` };
    }
    if (trimmed.toUpperCase().startsWith('!SWITCH')) {
      return {
        word: '!SWITCH',
        status: 'COMMAND',
        message: this.status === 'VICTORY' || this.status === 'PAUSED'
          ? 'Ready to switch teams'
          : '!SWITCH works during Victory / Pause',
      };
    }

    const word = extractFirstWord(trimmed);
    if (word.length < 3) {
      return { word, status: 'TOO_SHORT', message: 'Type at least 3 letters' };
    }
    if (this.usedWords.has(word)) {
      return { word, status: 'TAKEN', message: `"${word}" is already taken!` };
    }
    if (!matchesBaseRule(word, this.baseRule)) {
      return { word, status: 'RULE_MISS', message: `Must match: ${this.baseRule.label}` };
    }
    if (!matchesModifier(word, this.activeModifier)) {
      return {
        word,
        status: 'MODIFIER_MISS',
        message: `Blocked by modifier: ${this.activeModifier?.label}`,
      };
    }
    if (!isValidEnglishWord(word)) {
      return { word, status: 'NOT_IN_DICT', message: `"${word}" not found in dictionary` };
    }

    let basePush = 1.2;
    let tier: WordValidationPreview['tier'] = 'LIGHT';
    if (word.length >= 9) {
      basePush = 14.0;
      tier = 'NUCLEAR';
    } else if (word.length >= 7) {
      basePush = 7.0;
      tier = 'SHOCKWAVE';
    } else if (word.length >= 5) {
      basePush = 3.0;
      tier = 'HEAVY';
    }

    let est = basePush * (this.phase === 3 ? 2.0 : 1.0);
    const triggersBounty = !!(this.activeBounty && matchesBounty(word, this.activeBounty));
    if (triggersBounty && this.activeBounty) {
      est += this.activeBounty.bonusPercent;
      tier = 'BOUNTY';
    }
    const triggersShield = word.includes(this.bonusLetter);
    const matchingPu = this.fieldPowerUps.find((pu) => this.matchesPowerUpTrigger(word, pu)) || null;

    const extras: string[] = [];
    if (triggersBounty) extras.push('BOUNTY');
    if (matchingPu) extras.push(matchingPu.shortLabel);
    if (triggersShield) extras.push('SHIELD +3');

    const extraText = extras.length > 0 ? ` · ${extras.join(' + ')}` : '';
    return {
      word,
      status: 'VALID',
      message: `VALID · +${est.toFixed(est % 1 === 0 ? 0 : 1)}%${extraText}`,
      estimatedPush: est,
      tier,
      triggersShield,
      triggersBounty,
      triggersPowerUp: matchingPu ? matchingPu.type : null,
    };
  }

  // Controls for Streamer Host Dock
  public togglePause(): void {
    soundEngine.unlock();
    if (this.status === 'PLAYING') {
      this.status = 'PAUSED';
    } else if (this.status === 'PAUSED') {
      this.status = 'PLAYING';
    } else if (this.status === 'VICTORY') {
      this.startNextMatch();
    }
    this.emitHud(true);
  }

  public startNextMatch(): void {
    soundEngine.unlock();
    this.matchNumber += 1;
    this.status = 'PLAYING';
    this.phase = 1;
    this.timeRemainingSec = MATCH_DURATION_SEC;
    this.suddenDeathSec = SUDDEN_DEATH_DURATION_SEC;
    this.victoryCountdownSec = VICTORY_DURATION_SEC;
    this.matchElapsedSec = 0;
    this.nextBountyAtElapsedSec = 18;
    this.nextPowerUpAtElapsedSec = 5;
    this.longestWordThisMatch = 7;
    this.phaseOpenedAtMs = Date.now();
    this.fastestAwardedThisPhase = false;

    this.targetRedPercent = 50.0;
    this.visualRedPercent = 50.0;
    this.borderVelocity = 0;
    this.redShields = 0;
    this.blueShields = 0;
    this.redPowerUps = { doublePushCharges: 0, shieldBreakReady: false, invertedUntil: 0 };
    this.bluePowerUps = { doublePushCharges: 0, shieldBreakReady: false, invertedUntil: 0 };
    this.fieldPowerUps = [];

    this.baseRule = pickBaseRule(this.baseRule.id);
    this.plannedModifier = pickModifierForRule(this.baseRule);
    this.activeModifier = null;
    this.bonusLetter = pickBonusShieldLetter(this.baseRule, null);
    this.activeBounty = null;

    this.usedWords.clear();
    this.burnedWords = [];
    this.victorySummary = null;
    this.beams = [];
    this.callouts = [];
    this.shockwaves = [];
    this.cacheDirty = true;

    this.players.forEach((p) => {
      p.matchPushTotal = 0;
      p.matchWordsCount = 0;
      p.biggestWord = '';
      p.biggestWordPush = 0;
      p.streak = 0;
      p.onFire = false;
      p.lastFireAt = 0;
      p.lunge = 0;
      p.knockback = 0;
      p.shakeTimer = 0;
      p.validFlashTimer = 0;
      p.feedbackText = '';
    });

    this.rebalanceTeamsIfNeeded(true);
    this.showBanner('PHASE', `MATCH #${this.matchNumber} START`, this.baseRule.label, 'WHITE', 1900);
    soundEngine.playAlertChime(false);
    this.emitHud(true);
  }

  public resetTeams(): void {
    soundEngine.unlock();
    this.teamRegistry.clear();
    this.players.clear();
    this.redWins = 0;
    this.blueWins = 0;
    this.matchNumber = 0;
    this.simJoinedCount = 0;
    if (this.simulatorEnabled) {
      this.seedInitialSimRoster();
    }
    this.startNextMatch();
  }

  public advancePhase(): void {
    soundEngine.unlock();
    if (this.status !== 'PLAYING') return;
    if (this.phase === 1) {
      this.timeRemainingSec = 40;
      this.matchElapsedSec = 20;
      this.enterPhase2();
    } else if (this.phase === 2) {
      this.timeRemainingSec = 20;
      this.matchElapsedSec = 40;
      this.enterPhase3();
    } else {
      if (!this.activeBounty) {
        this.spawnBounty();
      } else {
        this.timeRemainingSec = 3;
      }
    }
    this.emitHud(true);
  }

  public setSimulatorEnabled(enabled: boolean): void {
    this.simulatorEnabled = enabled;
    if (enabled && this.players.size === 0) {
      this.seedInitialSimRoster();
    }
    this.emitHud(true);
  }

  public setSimIntensity(intensity: SimIntensity): void {
    this.simIntensity = intensity;
    this.emitHud(true);
  }

  public toggleMute(): void {
    soundEngine.toggleMute();
    this.emitHud(true);
  }

  private enterPhase2(): void {
    this.phase = 2;
    this.phaseOpenedAtMs = Date.now();
    this.fastestAwardedThisPhase = false;
    this.activeModifier = this.plannedModifier;
    this.bonusLetter = pickBonusShieldLetter(this.baseRule, this.activeModifier);
    this.cacheDirty = true;
    this.screenShake = Math.max(this.screenShake, 8);
    this.showBanner('PHASE', 'PHASE 2 • MUTATION', `${this.baseRule.label} • ${this.activeModifier.label}`, 'GOLD', 2400);
    soundEngine.playAlertChime(false);
    this.emitHud(true);
  }

  private enterPhase3(): void {
    this.phase = 3;
    this.phaseOpenedAtMs = Date.now();
    this.fastestAwardedThisPhase = false;
    if (!this.activeModifier) {
      this.activeModifier = this.plannedModifier;
      this.cacheDirty = true;
    }
    this.screenShake = Math.max(this.screenShake, 12);
    this.flashColor = '#FFD166';
    this.flashAlpha = 0.25;
    this.showBanner('PHASE', 'OVERDRIVE 2X!', 'ALL WORD PUSHES DOUBLED • FINAL 20 SECONDS!', 'GOLD', 2500);
    soundEngine.playAlertChime(true);
    this.emitHud(true);
  }

  private spawnBounty(): void {
    const now = Date.now();
    this.activeBounty = createBountyObjective(now, 10000);
    soundEngine.playAlertChime(true);
    this.showBanner('BOUNTY', 'GOLDEN BOUNTY ACTIVE!', this.activeBounty.label, 'GOLD', 2100);
    this.emitHud(true);
  }

  public spawnFieldPowerUp(): void {
    if (this.fieldPowerUps.length >= 2) return;
    this.refreshWordCacheIfNeeded();

    const types: PowerUpType[] = ['DOUBLE_PUSH', 'SHIELD_BREAK', 'INVERT_CONTROL'];
    const existingTypes = new Set(this.fieldPowerUps.map((p) => p.type));
    const availableTypes = types.filter((t) => !existingTypes.has(t));
    // Prefer SHIELD_BREAK if either team has active shields
    let chosenType = availableTypes[Math.floor(Math.random() * availableTypes.length)] || 'DOUBLE_PUSH';
    if ((this.redShields > 0 || this.blueShields > 0) && availableTypes.includes('SHIELD_BREAK') && Math.random() < 0.5) {
      chosenType = 'SHIELD_BREAK';
    }

    // Pick a clean trigger letter that exists in plenty of valid matching words
    const validTriggerLetters = POWERUP_TRIGGER_LETTERS.filter((letter) => {
      if (this.baseRule.value.includes(letter)) return false;
      if (this.activeModifier?.type === 'FORBIDDEN_LETTER' && this.activeModifier.value === letter) return false;
      if (letter === this.bonusLetter) return false;
      let count = 0;
      for (let i = 0; i < this.cachedValidWords.length; i++) {
        if (this.cachedValidWords[i].includes(letter)) count++;
        if (count >= 12) return true;
      }
      return false;
    });

    const useLengthTrigger = validTriggerLetters.length === 0 || Math.random() < 0.3;
    const triggerType: FieldPowerUp['triggerType'] = useLengthTrigger ? 'MIN_LENGTH' : 'CONTAINS_LETTER';
    const triggerValue = useLengthTrigger
      ? 7
      : validTriggerLetters[Math.floor(Math.random() * validTriggerLetters.length)];
    const triggerHint = useLengthTrigger ? 'TYPE 7+ LTR' : `USE [${triggerValue}]`;

    const meta: Record<PowerUpType, { label: string; shortLabel: string }> = {
      DOUBLE_PUSH: { label: 'DOUBLE PUSH', shortLabel: '2X PUSH' },
      SHIELD_BREAK: { label: 'SHIELD BREAK', shortLabel: 'SHIELD BREAK' },
      INVERT_CONTROL: { label: 'INVERT CONTROL', shortLabel: 'INVERT' },
    };

    const now = Date.now();
    // Place on left or right side of the battlefield so it never overlaps the center prompt card
    const occupiedLeft = this.fieldPowerUps.some((p) => p.x < 0.5);
    const x = occupiedLeft ? 0.84 : Math.random() < 0.5 ? 0.16 : 0.84;
    const yOffset = (Math.random() < 0.5 ? -1 : 1) * (0.11 + Math.random() * 0.04);

    this.fieldPowerUps.push({
      id: `pu-${now}-${Math.random().toString(36).slice(2, 5)}`,
      type: chosenType,
      label: meta[chosenType].label,
      shortLabel: meta[chosenType].shortLabel,
      triggerType,
      triggerValue,
      triggerHint,
      x,
      yOffset,
      spawnedAt: now,
      expiresAt: now + 13000,
    });

    soundEngine.playAlertChime(false);
    this.emitHud(true);
  }

  private awardPowerUpToTeam(
    team: Team,
    type: PowerUpType,
    sourceLabel: string,
    claimantNickname: string,
    originX: number,
    originY: number
  ): string {
    const enemyTeam: Team = team === 'RED' ? 'BLUE' : 'RED';
    const myState = team === 'RED' ? this.redPowerUps : this.bluePowerUps;
    const enemyState = enemyTeam === 'RED' ? this.redPowerUps : this.bluePowerUps;
    const now = Date.now();

    soundEngine.playPowerUpActivate(type);

    const color =
      type === 'DOUBLE_PUSH' ? '#FFD166' : type === 'SHIELD_BREAK' ? '#F43F5E' : '#C084FC';

    // Burst particles at orb / claimant origin
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.12 + Math.random() * 0.36;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 2.5 + Math.random() * 3.5,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.35,
        glow: true,
      });
    }
    this.shockwaves.push({
      x: originX,
      y: originY,
      radius: 0.02,
      maxRadius: 0.28,
      color,
      alpha: 0.95,
      lineWidth: 4,
    });

    if (type === 'DOUBLE_PUSH') {
      myState.doublePushCharges = Math.min(3, myState.doublePushCharges + 1);
      this.showBanner(
        'POWERUP',
        'DOUBLE PUSH ACTIVATED!',
        `${claimantNickname} (${sourceLabel}) · TEAM ${team} NEXT HIT 2X!`,
        'GOLD',
        2100
      );
      return '2X READY';
    }

    if (type === 'SHIELD_BREAK') {
      const enemyHasShields = enemyTeam === 'RED' ? this.redShields > 0 : this.blueShields > 0;
      if (enemyHasShields) {
        if (enemyTeam === 'RED') {
          this.redShields = 0;
          this.redShieldFlash = 1.0;
        } else {
          this.blueShields = 0;
          this.blueShieldFlash = 1.0;
        }
        // Bonus +3% shield-shatter breach surge
        const dir = team === 'RED' ? 1 : -1;
        this.targetRedPercent = Math.max(0, Math.min(100, this.targetRedPercent + dir * 3.0));
        this.screenShake = Math.max(this.screenShake, 12);
        this.showBanner(
          'POWERUP',
          'SHIELD SHATTERED!',
          `${claimantNickname} (${sourceLabel}) DESTROYED TEAM ${enemyTeam} SHIELDS (+3%)`,
          team,
          2200
        );
        return 'SHIELD SHATTERED!';
      } else {
        myState.shieldBreakReady = true;
        this.showBanner(
          'POWERUP',
          'SHIELD BREAKER ARMED!',
          `${claimantNickname} (${sourceLabel}) · NEXT HIT PIERCES SHIELDS`,
          team,
          2000
        );
        return 'BREAKER ARMED';
      }
    }

    // INVERT_CONTROL
    enemyState.invertedUntil = now + INVERT_DURATION_MS;
    this.screenShake = Math.max(this.screenShake, 10);
    this.showBanner(
      'POWERUP',
      'CONTROLS INVERTED!',
      `${claimantNickname} (${sourceLabel}) SCRAMBLED TEAM ${enemyTeam} FOR 6s!`,
      'PURPLE',
      2300
    );
    return 'INVERTED ENEMY!';
  }

  private showBanner(
    kind: CenterBanner['kind'],
    title: string,
    subtitle: string,
    accent: CenterBanner['accent'],
    durationMs: number
  ): void {
    this.activeBanner = {
      id: `banner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      title,
      subtitle,
      accent,
      createdAt: Date.now(),
      durationMs,
    };
  }

  private countTeamPlayers(): { red: number; blue: number } {
    let red = 0;
    let blue = 0;
    this.players.forEach((p) => {
      if (p.team === 'RED') red++;
      else blue++;
    });
    return { red, blue };
  }

  private preloadAvatar(url: string): void {
    if (!url || this.avatarImageCache.has(url)) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    this.avatarImageCache.set(url, img);
  }

  private assignFormationSlot(player: PlayerRecord): void {
    const teamPlayers = Array.from(this.players.values()).filter(
      (p) => p.team === player.team && p.username !== player.username
    );
    const idx = teamPlayers.length;
    const slotsPerRow = 5;
    const col = idx % slotsPerRow;
    const row = Math.floor(idx / slotsPerRow);
    const laneX =
      0.13 +
      (col / (slotsPerRow - 1)) * 0.74 +
      (row % 2 === 1 ? 0.045 : -0.025) * (col === 4 ? -1 : 1);
    const depthOffset = 0.14 + (row % 3) * 0.25 + (Math.random() - 0.5) * 0.05;
    player.laneX = Math.max(0.09, Math.min(0.91, laneX));
    player.depthOffset = Math.max(0.1, Math.min(0.84, depthOffset));
  }

  /**
   * Automatic Team Balancing:
   * Whenever team counts diverge by 2 or more players, move excess player(s) from
   * the larger team to the smaller team to keep matches fair and balanced.
   */
  public rebalanceTeamsIfNeeded(silent = false): void {
    const counts = this.countTeamPlayers();
    const diff = counts.red - counts.blue;
    if (Math.abs(diff) < 2) return;

    const fromTeam: Team = diff > 0 ? 'RED' : 'BLUE';
    const toTeam: Team = fromTeam === 'RED' ? 'BLUE' : 'RED';
    const movesNeeded = Math.floor(Math.abs(diff) / 2);

    // Pick players from the larger team with lowest streak / most recently drafted so top MVPs aren't disrupted first
    const candidates = Array.from(this.players.values())
      .filter((p) => p.team === fromTeam)
      .sort((a, b) => {
        if (a.streak !== b.streak) return a.streak - b.streak;
        return b.draftedAt - a.draftedAt;
      });

    const movedNames: string[] = [];
    for (let i = 0; i < movesNeeded && i < candidates.length; i++) {
      const p = candidates[i];
      p.team = toTeam;
      this.teamRegistry.set(p.username, toTeam);
      const palette = toTeam === 'RED' ? RED_AVATAR_PALETTE : BLUE_AVATAR_PALETTE;
      p.avatarColor = palette[Math.floor(Math.random() * palette.length)];
      if (!p.customAvatarUrl) {
        p.avatarUrl = generateAvatarPortraitUrl(p.nickname, toTeam);
        this.preloadAvatar(p.avatarUrl);
      }
      this.assignFormationSlot(p);
      p.feedbackText = `MOVED TO ${toTeam}`;
      p.feedbackColor = toTeam === 'RED' ? '#FF2A5F' : '#00E5FF';
      p.feedbackUntil = Date.now() + 1800;
      movedNames.push(p.nickname);

      // Subtle transfer sparks
      const pos = this.getPlayerCanvasPos(p);
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * Math.PI * 2;
        this.particles.push({
          x: pos.x,
          y: pos.y,
          vx: Math.cos(a) * 0.16,
          vy: Math.sin(a) * 0.16,
          size: 2.5,
          color: toTeam === 'RED' ? '#FF2A5F' : '#00E5FF',
          alpha: 1,
          life: 0,
          maxLife: 0.45,
          glow: true,
        });
      }
    }

    if (!silent && movedNames.length > 0) {
      const updated = this.countTeamPlayers();
      this.balanceNotice = `Auto-Balanced: ${movedNames.join(', ')} moved to TEAM ${toTeam} (${updated.red}v${updated.blue})`;
      this.balanceNoticeUntil = Date.now() + 3600;
      this.emitHud(true);
    }
  }

  private ensurePlayerDrafted(rawUsername: string, rawNickname?: string, customAvatarUrl?: string): PlayerRecord {
    const key = normalizeKey(rawUsername);
    const displayNick = cleanNickname(rawNickname || rawUsername);
    const existing = this.players.get(key);
    if (existing) {
      if (rawNickname) existing.nickname = displayNick;
      if (customAvatarUrl && customAvatarUrl !== existing.customAvatarUrl) {
        existing.customAvatarUrl = customAvatarUrl;
        existing.avatarUrl = customAvatarUrl;
        this.preloadAvatar(customAvatarUrl);
      }
      existing.lastActiveAt = Date.now();
      return existing;
    }

    let team = this.teamRegistry.get(key);
    const counts = this.countTeamPlayers();
    // Even if previously registered, enforce balance if teams would become unbalanced by >=2
    if (!team) {
      if (counts.red < counts.blue) team = 'RED';
      else if (counts.blue < counts.red) team = 'BLUE';
      else team = Math.random() < 0.5 ? 'RED' : 'BLUE';
    } else if (team === 'RED' && counts.red - counts.blue >= 1) {
      team = 'BLUE';
    } else if (team === 'BLUE' && counts.blue - counts.red >= 1) {
      team = 'RED';
    }
    this.teamRegistry.set(key, team);

    const palette = team === 'RED' ? RED_AVATAR_PALETTE : BLUE_AVATAR_PALETTE;
    const teamCount = team === 'RED' ? counts.red : counts.blue;
    const avatarUrl = customAvatarUrl || generateAvatarPortraitUrl(displayNick, team);
    this.preloadAvatar(avatarUrl);

    const record: PlayerRecord = {
      username: key,
      nickname: displayNick,
      team,
      avatarUrl,
      customAvatarUrl,
      avatarColor: palette[teamCount % palette.length],
      lastFireAt: 0,
      streak: 0,
      onFire: false,
      matchPushTotal: 0,
      matchWordsCount: 0,
      biggestWord: '',
      biggestWordPush: 0,
      laneX: 0.5,
      depthOffset: 0.3,
      lunge: 0,
      knockback: 0,
      shakeTimer: 0,
      validFlashTimer: 0,
      feedbackText: '',
      feedbackColor: '#FFFFFF',
      feedbackUntil: 0,
      lastActiveAt: Date.now(),
      draftedAt: Date.now(),
    };

    this.players.set(key, record);
    this.assignFormationSlot(record);
    this.rebalanceTeamsIfNeeded();
    return record;
  }

  private getPlayerCanvasPos(player: PlayerRecord): { x: number; y: number } {
    const borderY = this.visualRedPercent / 100;
    const safeBorderY = Math.max(0.12, Math.min(0.88, borderY));
    const lungePull = player.lunge * 0.065;
    const knockPush = player.knockback * 0.055;

    if (player.team === 'RED') {
      const zoneTop = 0.075;
      const zoneBottom = Math.max(zoneTop + 0.05, safeBorderY - 0.105);
      const y = zoneBottom - player.depthOffset * (zoneBottom - zoneTop) + lungePull - knockPush;
      return { x: player.laneX, y: Math.max(0.065, Math.min(safeBorderY - 0.05, y)) };
    } else {
      const zoneTop = Math.min(0.89, safeBorderY + 0.105);
      const zoneBottom = 0.925;
      const y = zoneTop + player.depthOffset * (zoneBottom - zoneTop) - lungePull + knockPush;
      return { x: player.laneX, y: Math.max(safeBorderY + 0.05, Math.min(0.935, y)) };
    }
  }

  public processChatMessage(payload: TikTokChatMessage): ProcessChatResult {
    if (!payload || !payload.username || !payload.comment) {
      return { outcome: 'IGNORED', reason: 'Empty message' };
    }
    const rawComment = payload.comment.trim();
    if (!rawComment) return { outcome: 'IGNORED', reason: 'Empty message' };

    const player = this.ensurePlayerDrafted(payload.username, payload.nickname, payload.avatarUrl);
    const now = Date.now();

    // Handle !SWITCH command during Victory / Lobby between matches
    if (rawComment.toUpperCase().startsWith('!SWITCH')) {
      if (this.status === 'VICTORY' || this.status === 'PAUSED') {
        const counts = this.countTeamPlayers();
        const otherTeam: Team = player.team === 'RED' ? 'BLUE' : 'RED';
        const otherCount = otherTeam === 'RED' ? counts.red : counts.blue;
        const myCount = player.team === 'RED' ? counts.red : counts.blue;
        if (otherCount <= myCount) {
          player.team = otherTeam;
          this.teamRegistry.set(player.username, otherTeam);
          const palette = otherTeam === 'RED' ? RED_AVATAR_PALETTE : BLUE_AVATAR_PALETTE;
          player.avatarColor = palette[Math.floor(Math.random() * palette.length)];
          if (!player.customAvatarUrl) {
            player.avatarUrl = generateAvatarPortraitUrl(player.nickname, otherTeam);
            this.preloadAvatar(player.avatarUrl);
          }
          this.assignFormationSlot(player);
          this.rebalanceTeamsIfNeeded();
          this.recentSwitchMessage = `${player.nickname} switched to TEAM ${otherTeam}!`;
          this.switchMsgUntil = now + 3500;
          soundEngine.playAlertChime(false);
          this.emitHud(true);
          return { outcome: 'SWITCH', reason: this.recentSwitchMessage, team: otherTeam };
        } else {
          this.recentSwitchMessage = `${player.nickname}: TEAM ${otherTeam} already leads in players!`;
          this.switchMsgUntil = now + 2600;
          this.emitHud(true);
          return { outcome: 'INVALID', reason: this.recentSwitchMessage, team: player.team };
        }
      }
      return { outcome: 'IGNORED', reason: '!SWITCH works between matches' };
    }

    if (this.status !== 'PLAYING' && this.status !== 'SUDDEN_DEATH') {
      return { outcome: 'IGNORED', reason: 'Match is not active' };
    }

    const word = extractFirstWord(rawComment);
    if (word.length < 3) {
      player.shakeTimer = 280;
      player.feedbackText = 'TOO SHORT';
      player.feedbackColor = '#FF2A5F';
      player.feedbackUntil = now + 750;
      soundEngine.playErrorBuzz();
      return { outcome: 'INVALID', reason: 'Word must be at least 3 letters', word, team: player.team };
    }

    // Personal 3-second cooldown check
    if (now - player.lastFireAt < COOLDOWN_MS) {
      player.feedbackText = 'RELOADING...';
      player.feedbackColor = '#94A3B8';
      player.feedbackUntil = now + 750;
      return { outcome: 'COOLDOWN', reason: 'Reloading (3s cooldown)', word, team: player.team };
    }

    // Check if already used -> "TAKEN!" red shake + reset streak
    if (this.usedWords.has(word)) {
      player.streak = 0;
      player.onFire = false;
      player.shakeTimer = 460;
      player.feedbackText = 'TAKEN!';
      player.feedbackColor = '#FF2A5F';
      player.feedbackUntil = now + 1050;
      soundEngine.playErrorBuzz();
      return { outcome: 'TAKEN', reason: `"${word}" already taken!`, word, team: player.team };
    }

    // Validate against prompt, modifier, and embedded dictionary with explicit feedback cues
    if (!matchesBaseRule(word, this.baseRule)) {
      player.streak = 0;
      player.onFire = false;
      player.shakeTimer = 420;
      player.feedbackText = 'RULE MISS!';
      player.feedbackColor = '#FF2A5F';
      player.feedbackUntil = now + 950;
      soundEngine.playErrorBuzz();
      return { outcome: 'INVALID', reason: `Must match: ${this.baseRule.label}`, word, team: player.team };
    }

    if (!matchesModifier(word, this.activeModifier)) {
      player.streak = 0;
      player.onFire = false;
      player.shakeTimer = 420;
      player.feedbackText = 'MODIFIER!';
      player.feedbackColor = '#FF2A5F';
      player.feedbackUntil = now + 950;
      soundEngine.playErrorBuzz();
      return {
        outcome: 'INVALID',
        reason: `Blocked by ${this.activeModifier?.label}`,
        word,
        team: player.team,
      };
    }

    if (!isValidEnglishWord(word)) {
      player.streak = 0;
      player.onFire = false;
      player.shakeTimer = 420;
      player.feedbackText = 'INVALID!';
      player.feedbackColor = '#FF2A5F';
      player.feedbackUntil = now + 950;
      soundEngine.playErrorBuzz();
      return { outcome: 'INVALID', reason: `"${word}" not in dictionary`, word, team: player.team };
    }

    // VALID HIT! Trigger immediate green validation flash on avatar
    this.usedWords.add(word);
    this.cacheDirty = true;
    player.lastFireAt = now;
    player.streak += 1;
    player.onFire = player.streak >= 3;
    player.lunge = 1.0;
    player.validFlashTimer = 560;
    player.feedbackText = 'VALID!';
    player.feedbackColor = '#4ADE80';
    player.feedbackUntil = now + 750;

    const myPowerUps = player.team === 'RED' ? this.redPowerUps : this.bluePowerUps;
    const enemyPowerUps = player.team === 'RED' ? this.bluePowerUps : this.redPowerUps;
    const isInverted = now < myPowerUps.invertedUntil;

    // Base push scaling by word length
    let basePush = 1.2;
    let tier: BurnedWordEntry['tier'] = 'LIGHT';
    if (word.length >= 9) {
      basePush = 14.0;
      tier = 'NUCLEAR';
    } else if (word.length >= 7) {
      basePush = 7.0;
      tier = 'SHOCKWAVE';
    } else if (word.length >= 5) {
      basePush = 3.0;
      tier = 'HEAVY';
    }

    const effectTags: string[] = [];
    let totalPush = basePush;
    if (player.onFire) {
      totalPush *= 1.5;
      effectTags.push('FIRE 1.5X');
    }
    if (this.phase === 3) {
      totalPush *= 2.0;
      effectTags.push('2X OD');
    }

    // Check active DOUBLE_PUSH power-up charge
    let consumedDoublePush = false;
    if (myPowerUps.doublePushCharges > 0) {
      myPowerUps.doublePushCharges -= 1;
      totalPush *= 2.0;
      consumedDoublePush = true;
      effectTags.push('2X PUSH');
    }

    // Check Golden Bounty trigger
    let bountyClaimed = false;
    if (this.activeBounty && matchesBounty(word, this.activeBounty)) {
      bountyClaimed = true;
      totalPush += this.activeBounty.bonusPercent;
      tier = 'BOUNTY';
      this.activeBounty = null;
      effectTags.push('BOUNTY +15%');
    }

    // Check Shield Letter activation
    let shieldTriggered = false;
    if (word.includes(this.bonusLetter)) {
      shieldTriggered = true;
      if (player.team === 'RED') {
        this.redShields = Math.min(MAX_SHIELDS, this.redShields + 3);
      } else {
        this.blueShields = Math.min(MAX_SHIELDS, this.blueShields + 3);
      }
      effectTags.push('SHIELD +3');
      soundEngine.playShieldActivated();
    }

    // Check enemy Shield absorption vs armed Shield Breaker
    let blockedByShield = false;
    const enemyHasShields = player.team === 'RED' ? this.blueShields > 0 : this.redShields > 0;
    if (enemyHasShields) {
      if (myPowerUps.shieldBreakReady) {
        myPowerUps.shieldBreakReady = false;
        if (player.team === 'RED') {
          this.blueShields = 0;
          this.blueShieldFlash = 1.0;
        } else {
          this.redShields = 0;
          this.redShieldFlash = 1.0;
        }
        effectTags.push('SHIELD BREAK');
        soundEngine.playPowerUpActivate('SHIELD_BREAK');
      } else {
        if (player.team === 'RED') {
          this.blueShields -= 1;
          this.blueShieldFlash = 1.0;
        } else {
          this.redShields -= 1;
          this.redShieldFlash = 1.0;
        }
        totalPush *= 0.5;
        blockedByShield = true;
        effectTags.push('SHIELDED -50%');
        soundEngine.playShieldDeflect();
      }
    }

    // Check if this player's team is currently under INVERT CONTROL sabotage!
    // Reverses 35% of the hit into backfire push OR weakens hit dramatically with clear visual feedback
    let pushDirection = player.team === 'RED' ? 1 : -1;
    if (isInverted) {
      pushDirection *= -1; // Temporarily reverses the push direction!
      totalPush = Math.max(0.8, Math.round(totalPush * 0.45 * 10) / 10);
      effectTags.push('INVERTED!');
    } else {
      totalPush = Math.round(totalPush * 10) / 10;
    }

    const pos = this.getPlayerCanvasPos(player);
    const borderY = Math.max(0.06, Math.min(0.94, this.visualRedPercent / 100));

    // Check Battlefield Power-Up Orb Claims
    for (let i = this.fieldPowerUps.length - 1; i >= 0; i--) {
      const pu = this.fieldPowerUps[i];
      if (this.matchesPowerUpTrigger(word, pu)) {
        this.fieldPowerUps.splice(i, 1);
        const tag = this.awardPowerUpToTeam(
          player.team,
          pu.type,
          'FIELD ORB',
          player.nickname,
          pu.x,
          Math.max(0.14, Math.min(0.86, borderY + pu.yOffset))
        );
        effectTags.push(tag);
        break;
      }
    }

    // Check Achievement-Awarded Power-Ups (Longest Word / Fastest Valid Word / Shield Crusher)
    if (word.length > this.longestWordThisMatch) {
      this.longestWordThisMatch = word.length;
      const tag = this.awardPowerUpToTeam(
        player.team,
        'DOUBLE_PUSH',
        `LONGEST WORD (${word.length} LTR)`,
        player.nickname,
        pos.x,
        pos.y
      );
      effectTags.push(tag);
    } else if (!this.fastestAwardedThisPhase && now - this.phaseOpenedAtMs <= 3500) {
      this.fastestAwardedThisPhase = true;
      const tag = this.awardPowerUpToTeam(
        player.team,
        'INVERT_CONTROL',
        'FASTEST WORD',
        player.nickname,
        pos.x,
        pos.y
      );
      effectTags.push(tag);
    } else if (player.streak === 3 && (enemyHasShields || !myPowerUps.shieldBreakReady)) {
      const tag = this.awardPowerUpToTeam(
        player.team,
        'SHIELD_BREAK',
        '3X STREAK',
        player.nickname,
        pos.x,
        pos.y
      );
      effectTags.push(tag);
    }

    // Keep enemyPowerUps reference clean
    void enemyPowerUps;

    // Track player stats for Victory MVP podium
    if (!isInverted) {
      player.matchPushTotal = Math.round((player.matchPushTotal + totalPush) * 10) / 10;
      if (totalPush >= player.biggestWordPush) {
        player.biggestWordPush = totalPush;
        player.biggestWord = word;
      }
    }
    player.matchWordsCount += 1;

    // Record burned word ticker with exact effect on the score
    const signedDelta = pushDirection * totalPush;
    const entry: BurnedWordEntry = {
      id: `${now}-${word}-${Math.random().toString(36).slice(2, 5)}`,
      word,
      nickname: player.nickname,
      team: player.team,
      pushPercent: totalPush,
      signedDelta,
      tier,
      effectLabel: effectTags[0],
      shieldTriggered,
      timestamp: now,
    };
    this.burnedWords = [entry, ...this.burnedWords].slice(0, MAX_BURNED_WORDS);

    // Spawn kinetic beam
    const targetX = Math.max(0.12, Math.min(0.88, pos.x + (Math.random() - 0.5) * 0.14));
    this.beams.push({
      id: entry.id,
      team: player.team,
      fromX: pos.x,
      fromY: pos.y,
      targetX,
      targetY: borderY,
      progress: 0,
      speed: tier === 'NUCLEAR' || tier === 'BOUNTY' ? 3.2 : 4.6,
      width:
        tier === 'NUCLEAR'
          ? 14
          : tier === 'BOUNTY' || consumedDoublePush
          ? 12
          : tier === 'SHOCKWAVE'
          ? 8
          : tier === 'HEAVY'
          ? 5
          : 3,
      tier,
      word,
      pushPercent: totalPush,
      nickname: player.nickname,
      impacted: false,
      fade: 1,
      isPowered: consumedDoublePush,
      isInverted,
    });

    // Spawn floating word callout badge
    this.callouts.push({
      id: `call-${entry.id}`,
      x: Math.max(0.18, Math.min(0.82, pos.x)),
      y: player.team === 'RED' ? Math.min(0.85, pos.y + 0.03) : Math.max(0.15, pos.y - 0.03),
      text: isInverted
        ? `${word} BACKFIRE ${totalPush.toFixed(1)}%`
        : `${word} +${totalPush.toFixed(totalPush % 1 === 0 ? 0 : 1)}%`,
      subtext: isInverted
        ? 'CONTROLS INVERTED!'
        : bountyClaimed
        ? 'AIR-STRIKE BOUNTY!'
        : consumedDoublePush
        ? 'DOUBLE PUSH 2X!'
        : shieldTriggered
        ? `SHIELD +3 [${this.bonusLetter}]`
        : blockedByShield
        ? 'SHIELDED (-50%)'
        : player.onFire
        ? 'ON FIRE 1.5X'
        : undefined,
      color: isInverted
        ? '#C084FC'
        : bountyClaimed || consumedDoublePush
        ? '#FFD166'
        : player.team === 'RED'
        ? '#FF2A5F'
        : '#00E5FF',
      scale: tier === 'NUCLEAR' || tier === 'BOUNTY' || consumedDoublePush ? 1.3 : tier === 'SHOCKWAVE' ? 1.12 : 0.96,
      age: 0,
      maxAge: tier === 'NUCLEAR' || tier === 'BOUNTY' ? 2.1 : 1.55,
      isNuclear: tier === 'NUCLEAR',
      isGold: bountyClaimed || consumedDoublePush,
      isPurple: isInverted,
    });

    // Sound effects & Dramatic FX
    if (tier === 'NUCLEAR') {
      soundEngine.playNuclearBoom();
      this.screenShake = Math.max(this.screenShake, 22);
      this.flashColor = player.team === 'RED' ? '#FF2A5F' : '#00E5FF';
      this.flashAlpha = 0.42;
      this.knockBackTeam(player.team === 'RED' ? 'BLUE' : 'RED', 1.0);
      this.showBanner(
        'NUCLEAR',
        'NUCLEAR HIT!',
        `${player.nickname}: "${word}" (+${totalPush.toFixed(1)}%)`,
        player.team,
        2400
      );
    } else if (bountyClaimed) {
      soundEngine.playNuclearBoom();
      this.screenShake = Math.max(this.screenShake, 18);
      this.flashColor = '#FFD166';
      this.flashAlpha = 0.36;
      this.knockBackTeam(player.team === 'RED' ? 'BLUE' : 'RED', 0.9);
      this.spawnAirStrikeBeams(player.team, borderY);
      this.showBanner(
        'BOUNTY',
        'AIR-STRIKE SURGE!',
        `${player.nickname}: "${word}" (+${totalPush.toFixed(1)}%)`,
        'GOLD',
        2400
      );
    } else if (tier === 'SHOCKWAVE' || consumedDoublePush) {
      soundEngine.playLaserShot(Math.max(word.length, 7), player.team);
      this.screenShake = Math.max(this.screenShake, 9);
      this.knockBackTeam(player.team === 'RED' ? 'BLUE' : 'RED', 0.65);
    } else {
      soundEngine.playLaserShot(word.length, player.team);
    }

    // Apply territory push
    this.targetRedPercent = Math.max(0, Math.min(100, this.targetRedPercent + signedDelta));
    this.borderVelocity += pushDirection * Math.min(35, totalPush * 2.2);
    this.borderPulse = Math.min(1.5, this.borderPulse + (tier === 'NUCLEAR' ? 1.2 : 0.45));

    // Sudden Death instant win check
    if (this.status === 'SUDDEN_DEATH') {
      this.triggerVictory(player.team, 'SUDDEN_DEATH');
      return { outcome: 'VALID', reason: `SUDDEN DEATH WIN!`, word, pushPercent: totalPush, team: player.team };
    }

    // Mercy Rule / Knockout check (>= 98% or <= 2%)
    if (this.targetRedPercent >= 98) {
      this.targetRedPercent = 100;
      this.triggerBaseDetonation('RED');
    } else if (this.targetRedPercent <= 2) {
      this.targetRedPercent = 0;
      this.triggerBaseDetonation('BLUE');
    } else {
      this.emitHud();
    }

    return {
      outcome: 'VALID',
      reason: isInverted
        ? `INVERTED BACKFIRE (${totalPush.toFixed(1)}%)`
        : `+${totalPush.toFixed(totalPush % 1 === 0 ? 0 : 1)}% pushed for TEAM ${player.team}!`,
      word,
      pushPercent: totalPush,
      team: player.team,
    };
  }

  private knockBackTeam(team: Team, force: number): void {
    this.players.forEach((p) => {
      if (p.team === team) {
        p.knockback = Math.min(1.0, p.knockback + force);
      }
    });
  }

  private spawnAirStrikeBeams(team: Team, borderY: number): void {
    const startY = team === 'RED' ? 0.03 : 0.97;
    const cols = [0.2, 0.35, 0.5, 0.65, 0.8];
    cols.forEach((x, idx) => {
      this.beams.push({
        id: `air-${Date.now()}-${idx}`,
        team,
        fromX: x,
        fromY: startY,
        targetX: x,
        targetY: borderY,
        progress: -idx * 0.12,
        speed: 4.2,
        width: 7,
        tier: 'BOUNTY',
        word: '',
        pushPercent: 0,
        nickname: '',
        impacted: false,
        fade: 1,
      });
    });
  }

  private triggerBaseDetonation(winner: Team): void {
    const explosionY = winner === 'RED' ? 0.96 : 0.04;
    const color = winner === 'RED' ? '#FF2A5F' : '#00E5FF';
    for (let i = 0; i < 85; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.15 + Math.random() * 0.95;
      this.particles.push({
        x: 0.15 + Math.random() * 0.7,
        y: explosionY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * (winner === 'RED' ? -0.8 : 0.8),
        size: 3 + Math.random() * 7,
        color: Math.random() < 0.35 ? '#FFD166' : color,
        alpha: 1,
        life: 0,
        maxLife: 0.75 + Math.random() * 0.85,
        glow: true,
      });
    }
    this.shockwaves.push({
      x: 0.5,
      y: explosionY,
      radius: 0.02,
      maxRadius: 0.75,
      color: '#FFD166',
      alpha: 1,
      lineWidth: 8,
    });
    this.screenShake = 30;
    this.flashColor = '#FFFFFF';
    this.flashAlpha = 0.65;
    this.showBanner('KNOCKOUT', 'BASE DETONATION!', `TEAM ${winner} 100% KNOCKOUT!`, winner, 2200);
    this.triggerVictory(winner, 'KNOCKOUT');
  }

  private triggerVictory(winner: Team, reason: VictorySummary['reason']): void {
    if (this.status === 'VICTORY') return;
    this.status = 'VICTORY';
    this.victoryCountdownSec = VICTORY_DURATION_SEC;
    this.activeBounty = null;
    this.fieldPowerUps = [];

    if (winner === 'RED') this.redWins += 1;
    else this.blueWins += 1;

    const winningPlayers = Array.from(this.players.values())
      .filter((p) => p.team === winner && p.matchWordsCount > 0)
      .sort((a, b) => b.matchPushTotal - a.matchPushTotal)
      .slice(0, 3);

    const mvps: MvpEntry[] = winningPlayers.map((p) => ({
      username: p.username,
      nickname: p.nickname,
      team: p.team,
      avatarUrl: p.avatarUrl,
      avatarColor: p.avatarColor,
      totalPush: p.matchPushTotal,
      biggestWord: p.biggestWord || '—',
      biggestWordPush: p.biggestWordPush,
      wordsCount: p.matchWordsCount,
    }));

    this.victorySummary = {
      winner,
      reason,
      finalRedPercent: Math.round(this.targetRedPercent * 10) / 10,
      finalBluePercent: Math.round((100 - this.targetRedPercent) * 10) / 10,
      mvps,
      nextMatchInSeconds: VICTORY_DURATION_SEC,
    };

    soundEngine.playVictoryFanfare(reason === 'KNOCKOUT');
    this.emitHud(true);
  }

  public tick(dtSec: number): void {
    const dt = Math.min(0.05, Math.max(0.001, dtSec));
    this.simTime += dt;
    const now = Date.now();

    if (this.activeBanner && now - this.activeBanner.createdAt >= this.activeBanner.durationMs) {
      this.activeBanner = null;
      this.hudDirty = true;
    }

    // Expire field power-ups
    for (let i = this.fieldPowerUps.length - 1; i >= 0; i--) {
      if (now >= this.fieldPowerUps[i].expiresAt) {
        this.fieldPowerUps.splice(i, 1);
        this.hudDirty = true;
      }
    }

    // Smooth spring physics for territory line
    const springK = 18;
    const damping = 7.5;
    const diff = this.targetRedPercent - this.visualRedPercent;
    this.borderVelocity += (diff * springK - this.borderVelocity * damping) * dt;
    this.visualRedPercent += this.borderVelocity * dt;
    this.visualRedPercent = Math.max(0, Math.min(100, this.visualRedPercent));

    // Decay visual FX
    this.screenShake = Math.max(0, this.screenShake - dt * 42);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.4);
    this.borderPulse = Math.max(0, this.borderPulse - dt * 2.4);
    this.redShieldFlash = Math.max(0, this.redShieldFlash - dt * 3.5);
    this.blueShieldFlash = Math.max(0, this.blueShieldFlash - dt * 3.5);

    // Update player avatar animations
    this.players.forEach((p) => {
      if (p.lunge > 0) p.lunge = Math.max(0, p.lunge - dt * 4.5);
      if (p.knockback > 0) p.knockback = Math.max(0, p.knockback - dt * 3.2);
      if (p.shakeTimer > 0) p.shakeTimer = Math.max(0, p.shakeTimer - dt * 1000);
      if (p.validFlashTimer > 0) p.validFlashTimer = Math.max(0, p.validFlashTimer - dt * 1000);
    });

    // Update energy beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.targetY = Math.max(0.05, Math.min(0.95, this.visualRedPercent / 100));
      if (!b.impacted) {
        b.progress += dt * b.speed;
        if (b.progress >= 1) {
          b.progress = 1;
          b.impacted = true;
          this.spawnImpactFX(b);
        }
      } else {
        b.fade -= dt * (b.tier === 'NUCLEAR' ? 2.4 : 4.2);
        if (b.fade <= 0) {
          this.beams.splice(i, 1);
        }
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.alpha = 1 - pt.life / pt.maxLife;
    }

    // Ambient horizon sparks & base danger sparks
    if (this.status === 'PLAYING' || this.status === 'SUDDEN_DEATH') {
      const sparkChance = this.phase === 3 ? 0.55 : 0.25;
      if (Math.random() < sparkChance && this.particles.length < 220) {
        const borderY = this.visualRedPercent / 100;
        const isRedSpark = Math.random() < 0.5;
        this.particles.push({
          x: 0.04 + Math.random() * 0.92,
          y: borderY,
          vx: (Math.random() - 0.5) * 0.14,
          vy: (Math.random() - 0.5) * 0.16,
          size: 1.5 + Math.random() * 2.5,
          color: this.phase === 3 && Math.random() < 0.4 ? '#FFD166' : isRedSpark ? '#FF2A5F' : '#00E5FF',
          alpha: 0.9,
          life: 0,
          maxLife: 0.35 + Math.random() * 0.3,
          glow: true,
        });
      }

      if (this.visualRedPercent >= 85 && Math.random() < 0.45) {
        this.particles.push({
          x: 0.1 + Math.random() * 0.8,
          y: 0.97,
          vx: (Math.random() - 0.5) * 0.25,
          vy: -(0.12 + Math.random() * 0.22),
          size: 2 + Math.random() * 3,
          color: Math.random() < 0.5 ? '#FFD166' : '#00E5FF',
          alpha: 1,
          life: 0,
          maxLife: 0.45,
          glow: true,
        });
      } else if (this.visualRedPercent <= 15 && Math.random() < 0.45) {
        this.particles.push({
          x: 0.1 + Math.random() * 0.8,
          y: 0.03,
          vx: (Math.random() - 0.5) * 0.25,
          vy: 0.12 + Math.random() * 0.22,
          size: 2 + Math.random() * 3,
          color: Math.random() < 0.5 ? '#FFD166' : '#FF2A5F',
          alpha: 1,
          life: 0,
          maxLife: 0.45,
          glow: true,
        });
      }
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 7.5);
      sw.alpha -= dt * 2.2;
      if (sw.alpha <= 0.02) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update floating word callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.age += dt;
      c.y -= dt * 0.048;
      if (c.age >= c.maxAge) {
        this.callouts.splice(i, 1);
      }
    }

    // Match Clock, Phase Transitions & Spawns
    if (this.status === 'PLAYING') {
      this.timeRemainingSec -= dt;
      this.matchElapsedSec += dt;

      if (this.phase === 1 && this.timeRemainingSec <= 40) {
        this.enterPhase2();
      } else if (this.phase === 2 && this.timeRemainingSec <= 20) {
        this.enterPhase3();
      }

      // Field Power-Up spawning every ~13s
      if (this.matchElapsedSec >= this.nextPowerUpAtElapsedSec && this.timeRemainingSec > 8) {
        this.nextPowerUpAtElapsedSec += 13;
        this.spawnFieldPowerUp();
      }

      // Golden Bounty schedule (every 18 seconds)
      if (!this.activeBounty && this.matchElapsedSec >= this.nextBountyAtElapsedSec && this.timeRemainingSec > 6) {
        this.nextBountyAtElapsedSec += 18;
        this.spawnBounty();
      }
      if (this.activeBounty && now >= this.activeBounty.expiresAt) {
        this.activeBounty = null;
        this.hudDirty = true;
      }

      // Time Up check
      if (this.timeRemainingSec <= 0) {
        this.timeRemainingSec = 0;
        if (Math.abs(this.targetRedPercent - 50.0) < 0.05) {
          this.status = 'SUDDEN_DEATH';
          this.suddenDeathSec = SUDDEN_DEATH_DURATION_SEC;
          this.showBanner('SUDDEN_DEATH', 'SUDDEN DEATH!', 'EXACT 50/50 TIE • NEXT VALID WORD WINS!', 'GOLD', 3000);
          soundEngine.playAlertChime(true);
          this.emitHud(true);
        } else {
          this.triggerVictory(this.targetRedPercent > 50 ? 'RED' : 'BLUE', 'TIME_UP');
        }
      }

      if (this.simulatorEnabled) {
        this.tickSimulator(dt * 1000);
      }
      this.hudDirty = true;
    } else if (this.status === 'SUDDEN_DEATH') {
      this.suddenDeathSec -= dt;
      if (this.simulatorEnabled) {
        this.tickSimulator(dt * 1000);
      }
      if (this.suddenDeathSec <= 0) {
        this.triggerVictory(Math.random() < 0.5 ? 'RED' : 'BLUE', 'SUDDEN_DEATH');
      }
      this.hudDirty = true;
    } else if (this.status === 'VICTORY') {
      this.victoryCountdownSec -= dt;
      if (this.victoryCountdownSec <= 0) {
        this.startNextMatch();
      } else {
        this.hudDirty = true;
      }
    }

    if (this.hudDirty) {
      this.emitHud();
    }
  }

  private spawnImpactFX(b: EnergyBeam): void {
    const color = b.isInverted
      ? '#C084FC'
      : b.tier === 'BOUNTY' || b.isPowered
      ? '#FFD166'
      : b.team === 'RED'
      ? '#FF2A5F'
      : '#00E5FF';
    const count =
      b.tier === 'NUCLEAR' ? 38 : b.tier === 'BOUNTY' || b.isPowered ? 28 : b.tier === 'SHOCKWAVE' ? 20 : b.tier === 'HEAVY' ? 12 : 7;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.08 + Math.random() * (b.tier === 'NUCLEAR' ? 0.55 : 0.32);
      this.particles.push({
        x: b.targetX,
        y: b.targetY,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: (b.tier === 'NUCLEAR' ? 3 : 2) + Math.random() * 3.5,
        color: Math.random() < 0.25 ? '#FFFFFF' : color,
        alpha: 1,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.4,
        glow: true,
      });
    }

    if (b.tier === 'SHOCKWAVE' || b.tier === 'NUCLEAR' || b.tier === 'BOUNTY' || b.isPowered) {
      this.shockwaves.push({
        x: b.targetX,
        y: b.targetY,
        radius: 0.01,
        maxRadius: b.tier === 'NUCLEAR' ? 0.42 : b.tier === 'BOUNTY' ? 0.34 : 0.22,
        color,
        alpha: 0.95,
        lineWidth: b.tier === 'NUCLEAR' ? 6 : 3.5,
      });
    }
  }

  private tickSimulator(dtMs: number): void {
    if (this.simJoinedCount < SIMULATED_NICKNAMES.length) {
      this.simJoinTimerMs += dtMs;
      if (this.simJoinTimerMs >= 1100) {
        this.simJoinTimerMs = 0;
        const nick = SIMULATED_NICKNAMES[this.simJoinedCount];
        this.ensurePlayerDrafted(nick, nick);
        this.simJoinedCount += 1;
      }
    }

    const baseIntervalMs =
      this.simIntensity === 'CHAOS' ? 420 : this.simIntensity === 'HYPE' ? 760 : 1250;
    const phaseFactor = this.phase === 3 ? 0.78 : 1.0;

    this.simAccumulatorMs += dtMs;
    if (this.simAccumulatorMs < baseIntervalMs * phaseFactor) return;
    this.simAccumulatorMs = 0;

    const now = Date.now();
    const simPool = SIMULATED_NICKNAMES.slice(0, this.simJoinedCount)
      .map((n) => this.players.get(normalizeKey(n)))
      .filter((p): p is PlayerRecord => !!p && now - p.lastFireAt >= COOLDOWN_MS + 150);

    if (simPool.length === 0) return;

    let chosen: PlayerRecord;
    const trailingTeam: Team =
      this.targetRedPercent > 55 ? 'BLUE' : this.targetRedPercent < 45 ? 'RED' : Math.random() < 0.5 ? 'RED' : 'BLUE';
    const trailingPool = simPool.filter((p) => p.team === trailingTeam);
    if (trailingPool.length > 0 && Math.random() < 0.57) {
      chosen = trailingPool[Math.floor(Math.random() * trailingPool.length)];
    } else {
      chosen = simPool[Math.floor(Math.random() * simPool.length)];
    }

    // 10% chance to type an already-used word ("TAKEN!" red shake)
    if (this.burnedWords.length >= 2 && Math.random() < 0.1) {
      const dupe = this.burnedWords[Math.floor(Math.random() * Math.min(5, this.burnedWords.length))].word;
      this.processChatMessage({ username: chosen.username, nickname: chosen.nickname, comment: dupe });
      return;
    }

    this.refreshWordCacheIfNeeded();
    if (this.cachedValidWords.length === 0) return;

    let selectedWord: string | null = null;

    // 28% chance viewer targets an active Battlefield Power-Up Orb
    if (this.fieldPowerUps.length > 0 && Math.random() < 0.28) {
      const pu = this.fieldPowerUps[0];
      const puWords = this.cachedValidWords.filter((w) => this.matchesPowerUpTrigger(w, pu));
      if (puWords.length > 0) {
        selectedWord = puWords[Math.floor(Math.random() * puWords.length)];
      }
    }

    // If bounty is active, 30% chance viewer snipes a bounty word
    if (!selectedWord && this.activeBounty && Math.random() < 0.3) {
      const bountyWords = this.cachedValidWords.filter((w) => matchesBounty(w, this.activeBounty));
      if (bountyWords.length > 0) {
        selectedWord = bountyWords[Math.floor(Math.random() * bountyWords.length)];
      }
    }

    if (!selectedWord) {
      const roll = Math.random();
      let bucket: string[];
      if (roll < 0.08) {
        bucket = this.cachedValidWords.filter((w) => w.length >= 9);
      } else if (roll < 0.27) {
        bucket = this.cachedValidWords.filter((w) => w.length >= 7 && w.length <= 8);
      } else if (roll < 0.68) {
        bucket = this.cachedValidWords.filter((w) => w.length >= 5 && w.length <= 6);
      } else {
        bucket = this.cachedValidWords.filter((w) => w.length <= 4);
      }
      if (bucket.length === 0) bucket = this.cachedValidWords;
      selectedWord = bucket[Math.floor(Math.random() * bucket.length)];
    }

    if (selectedWord) {
      this.processChatMessage({ username: chosen.username, nickname: chosen.nickname, comment: selectedWord });
    }
  }
}

export const gameEngine = new TerritoryWarEngine();
