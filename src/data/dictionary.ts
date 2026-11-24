import { WORDS_A_TO_G } from './wordsAtoG';
import { WORDS_H_TO_P } from './wordsHtoP';
import { WORDS_Q_TO_Z } from './wordsQtoZ';
import type { BaseRule, BountyObjective, PhaseModifier } from '../types';

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// Build core dictionary set (uppercase, >= 3 letters, alphabetic only)
const CORE_WORDS: string[] = [];
const CORE_SET = new Set<string>();

function ingestRawWords(raw: string) {
  const parts = raw.split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i].trim().toUpperCase();
    if (w.length >= 3 && /^[A-Z]+$/.test(w) && !CORE_SET.has(w)) {
      CORE_SET.add(w);
      CORE_WORDS.push(w);
    }
  }
}

ingestRawWords(WORDS_A_TO_G);
ingestRawWords(WORDS_H_TO_P);
ingestRawWords(WORDS_Q_TO_Z);

// Also add common modern / slang / everyday words TikTok chat loves typing
const EXTRA_MODERN_WORDS = [
  'AIRPLANE', 'AIRPORT', 'AVOCADO', 'BACKPACK', 'BARISTA', 'BASEBALL', 'BASKETBALL',
  'BATTERY', 'BIRTHDAY', 'BLUETOOTH', 'BOOKMARK', 'BRAINROT', 'BREAKFAST', 'BROADBAND',
  'BROCCOLI', 'BROWNIE', 'BUTTERFLY', 'CALENDAR', 'CAMPFIRE', 'CAPPUCCINO', 'CARAMEL',
  'CARDIGAN', 'CARNIVAL', 'CATAPULT', 'CELEBRITY', 'CHAMPION', 'CHARGER', 'CHEESECAKE',
  'CHOCOLATE', 'CINNAMON', 'CLICKBAIT', 'CLIPBOARD', 'CLOUD', 'COCKTAIL', 'COCONUT',
  'COMFORTABLE', 'COMPUTER', 'CONFETTI', 'CONTROLLER', 'COSPLAY', 'CROISSANT', 'CROSSWORD',
  'CUPCAKE', 'CYBERPUNK', 'DASHBOARD', 'DATABASE', 'DAYDREAM', 'DEADLINE', 'DINOSAUR',
  'DOMINOES', 'DOUGHNUT', 'DOWNLOAD', 'DRAGONFLY', 'DUMPLING', 'EARTHQUAKE', 'ESPRESSO',
  'FACEBOOK', 'FANTASTIC', 'FIREPLACE', 'FIREWORK', 'FLASHLIGHT', 'FOOTBALL', 'FOUNTAIN',
  'FREEZER', 'FRIENDSHIP', 'GAMEPLAY', 'GAMESTORE', 'GANGSTER', 'GARGOYLE', 'GENERATOR',
  'GIRAFFE', 'GOLDFISH', 'GRADUATE', 'GRAPEFRUIT', 'GRASSLAND', 'GREENHOUSE', 'GUACAMOLE',
  'HAMBURGER', 'HANDSHAKE', 'HEADPHONE', 'HEADPHONES', 'HEADSET', 'HEARTBEAT', 'HELICOPTER',
  'HIGHLIGHT', 'HOMEWORK', 'HONEYMOON', 'HOTDOG', 'HURRICANE', 'ICECREAM', 'INSTAGRAM',
  'INTERNET', 'JELLYFISH', 'JOYSTICK', 'KANGAROO', 'KEYBOARD', 'KEYCHAIN', 'KICKBOXING',
  'LADYBUG', 'LANDSCAPE', 'LASAGNA', 'LEMONADE', 'LIGHTHOUSE', 'LIGHTNING', 'LIVESTREAM',
  'MACARONI', 'MARSHMALLOW', 'MASTERPIECE', 'MAYONNAISE', 'MEATBALL', 'MICROPHONE', 'MICROWAVE',
  'MIDNIGHT', 'MILKSHAKE', 'MINECRAFT', 'MOONLIGHT', 'MOTORCYCLE', 'MOUNTAIN', 'MUSHROOM',
  'NECKLACE', 'NEWSPAPER', 'NIGHTMARE', 'NOTEBOOK', 'OCTOPUS', 'OVERDRIVE', 'OVERWATCH',
  'PANCAKE', 'PARACHUTE', 'PASSWORD', 'PEANUT', 'PEPPERONI', 'PINEAPPLE', 'PISTACHIO',
  'PLATFORM', 'PLAYLIST', 'PLAYSTATION', 'PODCAST', 'POKEMON', 'POPCORN', 'PORTFOLIO',
  'POSTCARD', 'POTATOES', 'POWERHOUSE', 'PRETZEL', 'PRINCESS', 'PROGRAMMER', 'PUMPKIN',
  'QUARTERBACK', 'QUESADILLA', 'QUICKSAND', 'RAINBOW', 'RASPBERRY', 'REFRIGERATOR', 'RESTAURANT',
  'ROADRUNNER', 'ROCKSTAR', 'ROLLERCOASTER', 'SALAMANDER', 'SANDCASTLE', 'SANDWICH', 'SATELLITE',
  'SCARECROW', 'SCOREBOARD', 'SCRABBLE', 'SCREENSHOT', 'SEAHORSE', 'SEASHELL', 'SELFIE',
  'SHAMPOO', 'SHIPWRECK', 'SHORTCUT', 'SHOWDOWN', 'SIDEWALK', 'SKATEBOARD', 'SKYSCRAPER',
  'SMARTPHONE', 'SMOOTHIE', 'SNAPCHAT', 'SNOWBALL', 'SNOWBOARD', 'SNOWFLAKE', 'SNOWMAN',
  'SOFTWARE', 'SOUNDTRACK', 'SPACESHIP', 'SPAGHETTI', 'SPEEDRUN', 'SPIDERMAN', 'SPOTLIGHT',
  'SPOTIFY', 'SPRINGBOARD', 'STARBUCKS', 'STARFISH', 'STARLIGHT', 'STOPWATCH', 'STRAWBERRY',
  'STREAMER', 'STRONGHOLD', 'SUBMARINE', 'SUNFLOWER', 'SUNGLASSES', 'SUNLIGHT', 'SUNRISE',
  'SUNSET', 'SUNSHINE', 'SUPERHERO', 'SUPERMARKET', 'SUPERSTAR', 'SURFBOARD', 'SURPRISE',
  'SWEATSHIRT', 'SWIMSUIT', 'SWORDFISH', 'TANGERINE', 'TARANTULA', 'TEAMMATE', 'TELEPHONE',
  'TELESCOPE', 'TELEVISION', 'TERRITORY', 'THUNDERBOLT', 'THUNDERSTORM', 'THUMBNAIL', 'TIKTOK',
  'TIMELINE', 'TIRAMISU', 'TOOTHBRUSH', 'TOOTHPASTE', 'TORNADO', 'TOUCHDOWN', 'TOURNAMENT',
  'TRAMPOLINE', 'TREASURE', 'TRIANGLE', 'TRICYCLE', 'TROMBONE', 'TROPICAL', 'TRUMPET',
  'TUGBOAT', 'TURQUOISE', 'UMBRELLA', 'UNDERCOVER', 'UNDERGROUND', 'UNDERWATER', 'UNICORN',
  'UNIVERSE', 'UPGRADE', 'VACATION', 'VALENTINE', 'VAMPIRE', 'VANILLA', 'VEGETABLE',
  'VIBRANIUM', 'VIDEOGAME', 'VOLCANO', 'VOLLEYBALL', 'WAFFLE', 'WALLPAPER', 'WAREHOUSE',
  'WATERFALL', 'WATERMELON', 'WATERPROOF', 'WEEKEND', 'WEREWOLF', 'WHIRLPOOL', 'WHIRLWIND',
  'WHITEBOARD', 'WILDFIRE', 'WILDLIFE', 'WINDMILL', 'WINDSHIELD', 'WONDERLAND', 'WOODPECKER',
  'WORKBOOK', 'WORKOUT', 'WORKSHOP', 'WRISTBAND', 'XYLOPHONE', 'YARDSTICK', 'YELLOWSTONE',
  'YOUTUBE', 'ZEPPELIN', 'ZOMBIE', 'ZUCCHINI',
];

for (const w of EXTRA_MODERN_WORDS) {
  if (!CORE_SET.has(w)) {
    CORE_SET.add(w);
    CORE_WORDS.push(w);
  }
}

export const DICTIONARY_COUNT = CORE_WORDS.length;

/**
 * Checks whether a word is a valid English word in our embedded dictionary,
 * including safe morphological inflection checks (-S, -ES, -IES, -ED, -IED, -ING, -ER, -EST, -LY)
 * so everyday plurals and verb tenses entered by human viewers are always recognized.
 */
export function isValidEnglishWord(rawWord: string): boolean {
  const word = rawWord.toUpperCase();
  if (word.length < 3 || !/^[A-Z]+$/.test(word)) return false;
  if (CORE_SET.has(word)) return true;

  // Plural / 3rd person -S
  if (word.length >= 4 && word.endsWith('S') && !word.endsWith('SS')) {
    const stem = word.slice(0, -1);
    if (CORE_SET.has(stem)) return true;
  }
  // -ES (boxes, watches, heroes)
  if (word.length >= 5 && word.endsWith('ES')) {
    const stem = word.slice(0, -2);
    if (CORE_SET.has(stem)) return true;
  }
  // -IES -> -Y (strawberries -> strawberry)
  if (word.length >= 5 && word.endsWith('IES')) {
    const stem = word.slice(0, -3) + 'Y';
    if (CORE_SET.has(stem)) return true;
  }
  // -ED / -D / -IED
  if (word.length >= 5 && word.endsWith('ED')) {
    const stem2 = word.slice(0, -2);
    const stem1 = word.slice(0, -1);
    if (CORE_SET.has(stem2) || CORE_SET.has(stem1)) return true;
    // doubled consonant (stopped -> stop)
    if (stem2.length >= 3 && stem2[stem2.length - 1] === stem2[stem2.length - 2]) {
      if (CORE_SET.has(stem2.slice(0, -1))) return true;
    }
  }
  if (word.length >= 5 && word.endsWith('IED')) {
    if (CORE_SET.has(word.slice(0, -3) + 'Y')) return true;
  }
  // -ING (running, baking, jumping)
  if (word.length >= 5 && word.endsWith('ING')) {
    const stem = word.slice(0, -3);
    if (CORE_SET.has(stem) || CORE_SET.has(stem + 'E')) return true;
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      if (CORE_SET.has(stem.slice(0, -1))) return true;
    }
  }
  // -ER / -EST / -LY
  if (word.length >= 5 && word.endsWith('ER')) {
    const stem = word.slice(0, -2);
    if (CORE_SET.has(stem) || CORE_SET.has(stem + 'E')) return true;
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      if (CORE_SET.has(stem.slice(0, -1))) return true;
    }
  }
  if (word.length >= 6 && word.endsWith('EST')) {
    const stem = word.slice(0, -3);
    if (CORE_SET.has(stem) || CORE_SET.has(stem + 'E')) return true;
  }
  if (word.length >= 5 && word.endsWith('LY')) {
    const stem = word.slice(0, -2);
    if (CORE_SET.has(stem)) return true;
    if (word.endsWith('ILY') && CORE_SET.has(word.slice(0, -3) + 'Y')) return true;
  }

  return false;
}

export function extractFirstWord(comment: string): string {
  const firstToken = comment.trim().split(/\s+/)[0] || '';
  return firstToken.toUpperCase().replace(/[^A-Z]/g, '');
}

export function matchesBaseRule(word: string, rule: BaseRule): boolean {
  switch (rule.type) {
    case 'STARTS_WITH':
      return word.startsWith(rule.value);
    case 'ENDS_WITH':
      return word.endsWith(rule.value);
    case 'CONTAINS':
      return word.includes(rule.value);
  }
}

export function matchesModifier(word: string, modifier: PhaseModifier | null): boolean {
  if (!modifier) return true;
  if (modifier.type === 'FORBIDDEN_LETTER') {
    return !word.includes(String(modifier.value));
  }
  if (modifier.type === 'MIN_LENGTH') {
    return word.length >= Number(modifier.value);
  }
  return true;
}

export function matchesBounty(word: string, bounty: BountyObjective | null): boolean {
  if (!bounty) return false;
  switch (bounty.type) {
    case 'MIN_LENGTH_8':
      return word.length >= 8;
    case 'MIN_LENGTH_7':
      return word.length >= 7;
    case 'DOUBLE_LETTER':
      for (let i = 0; i < word.length - 1; i++) {
        if (word[i] === word[i + 1]) return true;
      }
      return false;
    case 'SAME_START_END':
      return word.length >= 4 && word[0] === word[word.length - 1];
    case 'VOWEL_RICH': {
      let count = 0;
      for (let i = 0; i < word.length; i++) {
        if (VOWELS.has(word[i])) count++;
      }
      return count >= 3 && word.length >= 6;
    }
  }
}

export function getMatchingDictionaryWords(
  rule: BaseRule,
  modifier: PhaseModifier | null,
  usedWords?: Set<string>
): string[] {
  const result: string[] = [];
  for (let i = 0; i < CORE_WORDS.length; i++) {
    const w = CORE_WORDS[i];
    if (usedWords && usedWords.has(w)) continue;
    if (matchesBaseRule(w, rule) && matchesModifier(w, modifier)) {
      result.push(w);
    }
  }
  return result;
}
