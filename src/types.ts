export type Team = 'RED' | 'BLUE';

export type MatchPhase = 1 | 2 | 3;

export type MatchStatus = 'PLAYING' | 'PAUSED' | 'SUDDEN_DEATH' | 'VICTORY';

export type SimIntensity = 'CHILL' | 'HYPE' | 'CHAOS';

export type WsConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export type PowerUpType = 'DOUBLE_PUSH' | 'SHIELD_BREAK' | 'INVERT_CONTROL';

export interface TikTokChatMessage {
  username: string;
  nickname?: string;
  avatarUrl?: string;
  comment: string;
}

export interface BaseRule {
  id: string;
  type: 'STARTS_WITH' | 'ENDS_WITH' | 'CONTAINS';
  value: string;
  label: string;
  shortTag: string;
}

export interface PhaseModifier {
  id: string;
  type: 'FORBIDDEN_LETTER' | 'MIN_LENGTH';
  value: string | number;
  label: string;
}

export interface BountyObjective {
  id: string;
  type: 'MIN_LENGTH_8' | 'MIN_LENGTH_7' | 'DOUBLE_LETTER' | 'SAME_START_END' | 'VOWEL_RICH';
  label: string;
  shortLabel: string;
  bonusPercent: number;
  expiresAt: number;
  durationMs: number;
}

export interface FieldPowerUp {
  id: string;
  type: PowerUpType;
  label: string;
  shortLabel: string;
  triggerType: 'CONTAINS_LETTER' | 'MIN_LENGTH';
  triggerValue: string | number;
  triggerHint: string;
  x: number; // normalized 0..1
  yOffset: number; // offset from border (-0.14..0.14)
  spawnedAt: number;
  expiresAt: number;
}

export interface TeamPowerUpState {
  doublePushCharges: number; // next word gets 2x push
  shieldBreakReady: boolean; // next hit ignores & shatters enemy shields
  invertedUntil: number; // timestamp while this team's controls are inverted
}

export interface WordValidationPreview {
  word: string;
  status: 'EMPTY' | 'TOO_SHORT' | 'COMMAND' | 'VALID' | 'TAKEN' | 'RULE_MISS' | 'MODIFIER_MISS' | 'NOT_IN_DICT';
  message: string;
  estimatedPush?: number;
  tier?: 'LIGHT' | 'HEAVY' | 'SHOCKWAVE' | 'NUCLEAR' | 'BOUNTY';
  triggersShield?: boolean;
  triggersBounty?: boolean;
  triggersPowerUp?: PowerUpType | null;
}

export interface PlayerRecord {
  username: string;
  nickname: string;
  team: Team;
  avatarUrl: string;
  customAvatarUrl?: string;
  avatarColor: string;
  lastFireAt: number;
  streak: number;
  onFire: boolean;
  // Match stats (reset each match)
  matchPushTotal: number;
  matchWordsCount: number;
  biggestWord: string;
  biggestWordPush: number;
  // Canvas spatial properties (normalized 0..1)
  laneX: number;
  depthOffset: number;
  lunge: number; // 0..1 forward lunge
  knockback: number; // 0..1 backward knock
  shakeTimer: number; // ms remaining for red invalid/taken shake
  validFlashTimer: number; // ms remaining for green valid flash
  feedbackText: string;
  feedbackColor: string;
  feedbackUntil: number;
  lastActiveAt: number;
  draftedAt: number;
}

export interface BurnedWordEntry {
  id: string;
  word: string;
  nickname: string;
  team: Team;
  pushPercent: number;
  signedDelta: number; // positive pushes RED, negative pushes BLUE
  tier: 'LIGHT' | 'HEAVY' | 'SHOCKWAVE' | 'NUCLEAR' | 'BOUNTY';
  effectLabel?: string;
  shieldTriggered: boolean;
  timestamp: number;
}

export interface CenterBanner {
  id: string;
  kind: 'NUCLEAR' | 'PHASE' | 'BOUNTY' | 'SUDDEN_DEATH' | 'KNOCKOUT' | 'POWERUP';
  title: string;
  subtitle: string;
  accent: 'RED' | 'BLUE' | 'GOLD' | 'WHITE' | 'PURPLE';
  createdAt: number;
  durationMs: number;
}

export interface MvpEntry {
  username: string;
  nickname: string;
  team: Team;
  avatarUrl: string;
  avatarColor: string;
  totalPush: number;
  biggestWord: string;
  biggestWordPush: number;
  wordsCount: number;
}

export interface VictorySummary {
  winner: Team;
  reason: 'KNOCKOUT' | 'TIME_UP' | 'SUDDEN_DEATH';
  finalRedPercent: number;
  finalBluePercent: number;
  mvps: MvpEntry[];
  nextMatchInSeconds: number;
}

export interface HudSnapshot {
  status: MatchStatus;
  phase: MatchPhase;
  timeRemainingSec: number;
  suddenDeathSec: number;
  redPercent: number;
  bluePercent: number;
  redPlayerCount: number;
  bluePlayerCount: number;
  redShields: number;
  blueShields: number;
  redPowerUps: TeamPowerUpState;
  bluePowerUps: TeamPowerUpState;
  fieldPowerUps: FieldPowerUp[];
  redWins: number;
  blueWins: number;
  matchNumber: number;
  baseRule: BaseRule;
  activeModifier: PhaseModifier | null;
  bonusLetter: string;
  activeBounty: BountyObjective | null;
  bountyRemainingSec: number;
  burnedWords: BurnedWordEntry[];
  activeBanner: CenterBanner | null;
  victory: VictorySummary | null;
  simulatorEnabled: boolean;
  simIntensity: SimIntensity;
  muted: boolean;
  recentSwitchMessage: string | null;
  balanceNotice: string | null;
}

// Canvas particle / visual effect types
export interface EnergyBeam {
  id: string;
  team: Team;
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  width: number;
  tier: 'LIGHT' | 'HEAVY' | 'SHOCKWAVE' | 'NUCLEAR' | 'BOUNTY';
  word: string;
  pushPercent: number;
  nickname: string;
  impacted: boolean;
  fade: number;
  isPowered?: boolean;
  isInverted?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  glow?: boolean;
}

export interface FloatingCallout {
  id: string;
  x: number;
  y: number;
  text: string;
  subtext?: string;
  color: string;
  scale: number;
  age: number;
  maxAge: number;
  isNuclear?: boolean;
  isGold?: boolean;
  isPurple?: boolean;
}

export interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  lineWidth: number;
}

declare global {
  interface Window {
    onTikTokChatMessage?: (payload: TikTokChatMessage) => void;
  }
}
