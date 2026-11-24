// Deterministic, expressive illustrated profile picture generator (SVG data URIs)
// Guarantees every player has a unique, crisp circular portrait instead of 2-letter monograms.

const SKIN_TONES = ['#F9D5B8', '#F2BE9B', '#E3A47B', '#C6865A', '#9B6242', '#6F432C'];
const HAIR_COLORS = ['#18181B', '#3F2718', '#78350F', '#D97706', '#FDE047', '#DC2626', '#EC4899', '#38BDF8', '#A855F7', '#F8FAFC'];
const BG_PALETTES_RED: [string, string][] = [
  ['#FF2A5F', '#4A081E'],
  ['#FB7185', '#3B0722'],
  ['#F43F5E', '#581029'],
  ['#FF5E7E', '#2A0815'],
  ['#E11D48', '#3F0A1B'],
];
const BG_PALETTES_BLUE: [string, string][] = [
  ['#00E5FF', '#06263D'],
  ['#38BDF8', '#082F49'],
  ['#0EA5E9', '#0B1D3A'],
  ['#22D3EE', '#063344'],
  ['#3B82F6', '#0A1E45'],
];
const SHIRT_COLORS = ['#1E293B', '#0F172A', '#312E81', '#881337', '#064E3B', '#7C2D12', '#3B0764', '#164E63'];

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const portraitCache = new Map<string, string>();

export function generateAvatarPortraitUrl(seedName: string, team: 'RED' | 'BLUE'): string {
  const cacheKey = `${seedName.toLowerCase()}::${team}`;
  const existing = portraitCache.get(cacheKey);
  if (existing) return existing;

  const h = hashString(seedName.toLowerCase());
  const skin = SKIN_TONES[h % SKIN_TONES.length];
  const hair = HAIR_COLORS[(h >> 3) % HAIR_COLORS.length];
  const shirt = SHIRT_COLORS[(h >> 6) % SHIRT_COLORS.length];
  const bgPool = team === 'RED' ? BG_PALETTES_RED : BG_PALETTES_BLUE;
  const [bg1, bg2] = bgPool[(h >> 9) % bgPool.length];
  const hairStyle = (h >> 12) % 6;
  const accessory = (h >> 15) % 5; // 0: none, 1: headphones, 2: glasses, 3: cap/visor, 4: sunglasses
  const smileStyle = (h >> 18) % 3;
  const accent = team === 'RED' ? '#FF2A5F' : '#00E5FF';

  let backHairSvg = '';
  let frontHairSvg = '';

  switch (hairStyle) {
    case 0: // Modern wavy bob
      backHairSvg = `<ellipse cx="50" cy="48" rx="28" ry="27" fill="${hair}"/>`;
      frontHairSvg = `<path d="M24 44 C26 22, 74 22, 76 44 C69 32, 57 34, 50 31 C42 35, 31 33, 24 44 Z" fill="${hair}"/>`;
      break;
    case 1: // Spiky esports crop
      frontHairSvg = `<path d="M26 42 L29 25 L39 30 L48 18 L57 29 L68 23 L74 42 C66 32, 34 32, 26 42 Z" fill="${hair}"/>`;
      break;
    case 2: // Curly afro halo
      backHairSvg = `<circle cx="50" cy="40" r="29" fill="${hair}"/><circle cx="29" cy="42" r="12" fill="${hair}"/><circle cx="71" cy="42" r="12" fill="${hair}"/>`;
      frontHairSvg = `<path d="M26 39 C32 28, 68 28, 74 39 C65 34, 35 34, 26 39 Z" fill="${hair}"/>`;
      break;
    case 3: // Sleek side-part
      backHairSvg = `<ellipse cx="50" cy="44" rx="25" ry="23" fill="${hair}"/>`;
      frontHairSvg = `<path d="M25 45 C26 20, 74 20, 75 43 C64 33, 46 28, 34 38 C30 41, 27 43, 25 45 Z" fill="${hair}"/>`;
      break;
    case 4: // Long flowing hair
      backHairSvg = `<path d="M20 45 C20 18, 80 18, 80 45 L82 88 L18 88 Z" fill="${hair}"/>`;
      frontHairSvg = `<path d="M24 44 C28 24, 72 24, 76 44 C66 31, 56 32, 50 30 C44 32, 34 31, 24 44 Z" fill="${hair}"/>`;
      break;
    default: // Cozy beanie
      frontHairSvg = `<path d="M24 43 C25 19, 75 19, 76 43 Z" fill="${accent}"/><rect x="22" y="36" width="56" height="9" rx="4.5" fill="#0F172A"/><circle cx="50" cy="18" r="6" fill="${accent}"/>`;
      break;
  }

  let accessorySvg = '';
  if (accessory === 1) {
    // Gaming headphones
    accessorySvg = `
      <path d="M21 52 C21 20, 79 20, 79 52" fill="none" stroke="#E2E8F0" stroke-width="4.5" stroke-linecap="round"/>
      <rect x="16" y="45" width="9" height="18" rx="4" fill="#0F172A" stroke="${accent}" stroke-width="2"/>
      <rect x="75" y="45" width="9" height="18" rx="4" fill="#0F172A" stroke="${accent}" stroke-width="2"/>
    `;
  } else if (accessory === 2) {
    // Stylish round glasses
    accessorySvg = `
      <circle cx="40" cy="52" r="7.5" fill="rgba(255,255,255,0.14)" stroke="#F8FAFC" stroke-width="2.2"/>
      <circle cx="60" cy="52" r="7.5" fill="rgba(255,255,255,0.14)" stroke="#F8FAFC" stroke-width="2.2"/>
      <line x1="47.5" y1="52" x2="52.5" y2="52" stroke="#F8FAFC" stroke-width="2.2"/>
    `;
  } else if (accessory === 3) {
    // Neon esports visor glasses
    accessorySvg = `
      <rect x="30" y="47" width="40" height="10" rx="4" fill="#090B14" fill-opacity="0.88" stroke="${accent}" stroke-width="2"/>
      <line x1="34" y1="50" x2="46" y2="50" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round"/>
    `;
  } else if (accessory === 4) {
    // Cool shades
    accessorySvg = `
      <path d="M31 48 H48 L46 57 C45 59, 34 59, 33 57 Z" fill="#0F172A" stroke="#FFD166" stroke-width="1.6"/>
      <path d="M52 48 H69 L67 57 C66 59, 55 59, 54 57 Z" fill="#0F172A" stroke="#FFD166" stroke-width="1.6"/>
      <line x1="48" y1="50" x2="52" y2="50" stroke="#FFD166" stroke-width="1.8"/>
    `;
  }

  const mouthSvg =
    smileStyle === 0
      ? `<path d="M42 64 Q50 71 58 64" fill="none" stroke="#451A03" stroke-width="2.6" stroke-linecap="round"/>`
      : smileStyle === 1
      ? `<path d="M43 64 Q50 70 57 64 Z" fill="#FFFFFF" stroke="#451A03" stroke-width="1.8" stroke-linejoin="round"/>`
      : `<path d="M44 65 Q51 68 57 63" fill="none" stroke="#451A03" stroke-width="2.5" stroke-linecap="round"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#bg)"/>
    <circle cx="80" cy="20" r="24" fill="#FFFFFF" fill-opacity="0.08"/>
    ${backHairSvg}
    <!-- Hoodie / Shoulders -->
    <path d="M16 102 C18 79, 34 74, 50 74 C66 74, 82 79, 84 102 Z" fill="${shirt}"/>
    <path d="M38 75 L50 86 L62 75" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Neck -->
    <rect x="43" y="67" width="14" height="12" rx="5" fill="${skin}"/>
    <!-- Ears -->
    <circle cx="27" cy="54" r="5" fill="${skin}"/>
    <circle cx="73" cy="54" r="5" fill="${skin}"/>
    <!-- Face -->
    <ellipse cx="50" cy="52" rx="22" ry="24" fill="${skin}"/>
    <!-- Subtle Cheek Blush -->
    <ellipse cx="36" cy="59" rx="4" ry="2.2" fill="#FB7185" fill-opacity="0.28"/>
    <ellipse cx="64" cy="59" rx="4" ry="2.2" fill="#FB7185" fill-opacity="0.28"/>
    <!-- Eyes -->
    <circle cx="40.5" cy="52" r="3.1" fill="#0F172A"/>
    <circle cx="59.5" cy="52" r="3.1" fill="#0F172A"/>
    <circle cx="41.5" cy="50.8" r="1.1" fill="#FFFFFF"/>
    <circle cx="60.5" cy="50.8" r="1.1" fill="#FFFFFF"/>
    <!-- Eyebrows -->
    <path d="M35 45 Q40.5 43 45 45" fill="none" stroke="#18181B" stroke-width="2" stroke-linecap="round"/>
    <path d="M55 45 Q59.5 43 65 45" fill="none" stroke="#18181B" stroke-width="2" stroke-linecap="round"/>
    <!-- Mouth -->
    ${mouthSvg}
    ${frontHairSvg}
    ${accessorySvg}
  </svg>`;

  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  portraitCache.set(cacheKey, url);
  return url;
}
