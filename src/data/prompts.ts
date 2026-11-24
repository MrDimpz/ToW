import type { BaseRule, BountyObjective, PhaseModifier } from '../types';
import { getMatchingDictionaryWords } from './dictionary';

const BASE_RULE_POOL: BaseRule[] = [
  { id: 'start-S', type: 'STARTS_WITH', value: 'S', label: 'STARTS WITH "S"', shortTag: 'S___' },
  { id: 'start-C', type: 'STARTS_WITH', value: 'C', label: 'STARTS WITH "C"', shortTag: 'C___' },
  { id: 'start-B', type: 'STARTS_WITH', value: 'B', label: 'STARTS WITH "B"', shortTag: 'B___' },
  { id: 'start-P', type: 'STARTS_WITH', value: 'P', label: 'STARTS WITH "P"', shortTag: 'P___' },
  { id: 'start-T', type: 'STARTS_WITH', value: 'T', label: 'STARTS WITH "T"', shortTag: 'T___' },
  { id: 'start-M', type: 'STARTS_WITH', value: 'M', label: 'STARTS WITH "M"', shortTag: 'M___' },
  { id: 'start-R', type: 'STARTS_WITH', value: 'R', label: 'STARTS WITH "R"', shortTag: 'R___' },
  { id: 'start-F', type: 'STARTS_WITH', value: 'F', label: 'STARTS WITH "F"', shortTag: 'F___' },
  { id: 'start-A', type: 'STARTS_WITH', value: 'A', label: 'STARTS WITH "A"', shortTag: 'A___' },
  { id: 'start-D', type: 'STARTS_WITH', value: 'D', label: 'STARTS WITH "D"', shortTag: 'D___' },
  { id: 'start-G', type: 'STARTS_WITH', value: 'G', label: 'STARTS WITH "G"', shortTag: 'G___' },
  { id: 'start-L', type: 'STARTS_WITH', value: 'L', label: 'STARTS WITH "L"', shortTag: 'L___' },
  { id: 'start-W', type: 'STARTS_WITH', value: 'W', label: 'STARTS WITH "W"', shortTag: 'W___' },
  { id: 'contains-AR', type: 'CONTAINS', value: 'AR', label: 'CONTAINS "AR"', shortTag: '*AR*' },
  { id: 'contains-IN', type: 'CONTAINS', value: 'IN', label: 'CONTAINS "IN"', shortTag: '*IN*' },
  { id: 'contains-CH', type: 'CONTAINS', value: 'CH', label: 'CONTAINS "CH"', shortTag: '*CH*' },
  { id: 'contains-ST', type: 'CONTAINS', value: 'ST', label: 'CONTAINS "ST"', shortTag: '*ST*' },
  { id: 'contains-OR', type: 'CONTAINS', value: 'OR', label: 'CONTAINS "OR"', shortTag: '*OR*' },
  { id: 'contains-AN', type: 'CONTAINS', value: 'AN', label: 'CONTAINS "AN"', shortTag: '*AN*' },
  { id: 'ends-ER', type: 'ENDS_WITH', value: 'ER', label: 'ENDS IN "ER"', shortTag: '___ER' },
  { id: 'ends-ON', type: 'ENDS_WITH', value: 'ON', label: 'ENDS IN "ON"', shortTag: '___ON' },
  { id: 'ends-AL', type: 'ENDS_WITH', value: 'AL', label: 'ENDS IN "AL"', shortTag: '___AL' },
  { id: 'ends-LE', type: 'ENDS_WITH', value: 'LE', label: 'ENDS IN "LE"', shortTag: '___LE' },
  { id: 'ends-NT', type: 'ENDS_WITH', value: 'NT', label: 'ENDS IN "NT"', shortTag: '___NT' },
];

const CANDIDATE_MODIFIERS: PhaseModifier[] = [
  { id: 'no-E', type: 'FORBIDDEN_LETTER', value: 'E', label: 'NO LETTER "E"' },
  { id: 'no-A', type: 'FORBIDDEN_LETTER', value: 'A', label: 'NO LETTER "A"' },
  { id: 'no-I', type: 'FORBIDDEN_LETTER', value: 'I', label: 'NO LETTER "I"' },
  { id: 'no-O', type: 'FORBIDDEN_LETTER', value: 'O', label: 'NO LETTER "O"' },
  { id: 'no-T', type: 'FORBIDDEN_LETTER', value: 'T', label: 'NO LETTER "T"' },
  { id: 'min-5', type: 'MIN_LENGTH', value: 5, label: '5+ LETTERS ONLY' },
  { id: 'min-6', type: 'MIN_LENGTH', value: 6, label: '6+ LETTERS ONLY' },
];

const SHIELD_LETTERS = ['K', 'V', 'W', 'X', 'Z', 'Y', 'P', 'B', 'G', 'M', 'C', 'F', 'H'];

export function pickBaseRule(excludeId?: string): BaseRule {
  const candidates = BASE_RULE_POOL.filter((r) => r.id !== excludeId);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function pickModifierForRule(rule: BaseRule): PhaseModifier {
  // Ensure the modifier never conflicts with the base rule and always leaves >= 45 valid words
  const valid = CANDIDATE_MODIFIERS.filter((mod) => {
    if (mod.type === 'FORBIDDEN_LETTER' && rule.value.includes(String(mod.value))) {
      return false;
    }
    const matches = getMatchingDictionaryWords(rule, mod);
    return matches.length >= 45;
  });
  if (valid.length === 0) {
    return { id: 'min-5', type: 'MIN_LENGTH', value: 5, label: '5+ LETTERS ONLY' };
  }
  return valid[Math.floor(Math.random() * valid.length)];
}

export function pickBonusShieldLetter(rule: BaseRule, modifier: PhaseModifier | null): string {
  const matching = getMatchingDictionaryWords(rule, modifier);
  const candidates = SHIELD_LETTERS.filter((letter) => {
    if (rule.value.includes(letter)) return false;
    if (modifier?.type === 'FORBIDDEN_LETTER' && modifier.value === letter) return false;
    // Make sure at least 12 matching words contain this bonus letter so shields feel earnable!
    let count = 0;
    for (let i = 0; i < matching.length; i++) {
      if (matching[i].includes(letter)) count++;
      if (count >= 12) return true;
    }
    return false;
  });
  if (candidates.length === 0) return 'R';
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function createBountyObjective(now: number, durationMs = 10000): BountyObjective {
  const templates: Omit<BountyObjective, 'id' | 'expiresAt' | 'durationMs'>[] = [
    {
      type: 'MIN_LENGTH_8',
      label: 'FIRST 8+ LETTER WORD = +15% AIR-STRIKE!',
      shortLabel: '8+ LETTERS • +15% SURGE',
      bonusPercent: 15,
    },
    {
      type: 'DOUBLE_LETTER',
      label: 'DOUBLE LETTERS (E.G. LL, TT) = +15% SURGE!',
      shortLabel: 'DOUBLE LETTERS • +15% SURGE',
      bonusPercent: 15,
    },
    {
      type: 'MIN_LENGTH_7',
      label: 'FIRST 7+ LETTER WORD = +15% AIR-STRIKE!',
      shortLabel: '7+ LETTERS • +15% SURGE',
      bonusPercent: 15,
    },
    {
      type: 'VOWEL_RICH',
      label: '6+ LETTERS WITH 3+ VOWELS = +15% SURGE!',
      shortLabel: '3+ VOWELS (6+ LTR) • +15%',
      bonusPercent: 15,
    },
  ];
  const tpl = templates[Math.floor(Math.random() * templates.length)];
  return {
    ...tpl,
    id: `bounty-${now}-${Math.random().toString(36).slice(2, 6)}`,
    expiresAt: now + durationMs,
    durationMs,
  };
}
