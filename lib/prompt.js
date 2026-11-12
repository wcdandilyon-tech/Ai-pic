// Shared prompt builder + safety filter.
// Used by the server (authoritative) and the browser (live preview).

export const STYLES = {
  anime: {
    label: 'Anime',
    positive: 'masterpiece, best quality, highly detailed, anime style, vibrant colors, clean lineart, detailed eyes, cel shading',
    negative: 'lowres, bad anatomy, bad hands, extra fingers, missing fingers, blurry, jpeg artifacts, watermark, signature, text, worst quality, low quality',
  },
  'anime-painterly': {
    label: 'Anime (painterly)',
    positive: 'masterpiece, best quality, ultra detailed, anime illustration, painterly, soft lighting, rich color palette, intricate details, depth of field',
    negative: 'lowres, bad anatomy, bad hands, extra digits, blurry, watermark, signature, text, flat colors, worst quality, low quality',
  },
  realistic: {
    label: 'Photorealistic',
    positive: 'photorealistic, 8k, ultra detailed, sharp focus, natural skin texture, professional photography, realistic lighting',
    negative: 'cartoon, anime, 3d render, painting, lowres, bad anatomy, deformed, blurry, watermark, text, worst quality',
  },
  fantasy: {
    label: 'Fantasy art',
    positive: 'epic fantasy art, highly detailed, dramatic lighting, concept art, intricate, cinematic composition, artstation quality',
    negative: 'lowres, blurry, bad anatomy, watermark, text, signature, worst quality, low quality',
  },
  '3d': {
    label: '3D render',
    positive: '3d render, octane render, highly detailed, subsurface scattering, global illumination, studio lighting',
    negative: 'lowres, blurry, 2d, sketch, watermark, text, worst quality, low quality',
  },
  none: { label: 'None (raw prompt)', positive: '', negative: '' },
};

// Detail fields the UI exposes. Each one is appended to the prompt if filled in.
export const DETAIL_FIELDS = [
  ['subject', 'Subject / character'],
  ['hair', 'Hair'],
  ['eyes', 'Eyes'],
  ['body', 'Body / build'],
  ['outfit', 'Outfit'],
  ['expression', 'Expression'],
  ['pose', 'Pose / action'],
  ['setting', 'Setting / background'],
  ['lighting', 'Lighting'],
  ['camera', 'Camera / framing'],
  ['extra', 'Extra tags'],
];

// Terms indicating a minor. Sexual or suggestive content involving minors is
// never allowed; these are blocked in every mode, and always added to the
// negative prompt so the model steers away from youthful bodies.
const MINOR_TERMS = [
  'child', 'children', 'kid', 'kids', 'minor', 'minors', 'underage', 'under age',
  'loli', 'lolicon', 'shota', 'shotacon', 'toddler', 'infant', 'preteen',
  'pre-teen', 'tween', 'young girl', 'young boy', 'little girl', 'little boy',
  'schoolgirl', 'school girl', 'elementary', 'middle school', 'junior high',
  'flat chest child', 'petite child', 'teen', 'teens', 'teenage', 'teenager',
  'cp', 'jailbait', 'aged down', 'age regression',
];
const MINOR_AGE_RE = /\b(?:[1-9]|1[0-7])\s*(?:-|\s)?\s*(?:y\/?o|yrs?|years?(?:\s*old)?)\b/i;

const MINOR_NEGATIVE = 'child, loli, minor, underage, teen, young-looking, childlike body, small child';
const ADULT_POSITIVE = 'adult woman, mature, 25 years old';
const SFW_NEGATIVE = 'nsfw, nude, naked, nipples, explicit, sexual';

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const MINOR_RE = new RegExp(`\\b(?:${MINOR_TERMS.map(escapeRe).join('|')})\\b`, 'i');

/** Returns the offending term if the text references a minor, else null. */
export function findMinorReference(text) {
  if (!text) return null;
  const m = String(text).match(MINOR_RE) || String(text).match(MINOR_AGE_RE);
  return m ? m[0] : null;
}

function join(...parts) {
  return parts
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean)
    .join(', ');
}

/**
 * Build the final positive/negative prompt.
 * @param {object} input { prompt, style, details: {field: text}, negative, nsfw }
 * @returns {{ok: true, positive, negative} | {ok: false, error}}
 */
export function buildPrompt(input = {}) {
  const style = STYLES[input.style] || STYLES.anime;
  const details = input.details || {};
  const detailText = DETAIL_FIELDS.map(([k]) => details[k]).filter(Boolean);
  const userText = join(input.prompt, ...detailText);

  if (!userText) return { ok: false, error: 'Describe what you want to see.' };

  const hit = findMinorReference(userText);
  if (hit) {
    return {
      ok: false,
      error: `Blocked: "${hit}" refers to a minor. Characters must be adults.`,
    };
  }

  const positive = join(style.positive, input.nsfw ? ADULT_POSITIVE : '', userText);
  const negative = join(style.negative, MINOR_NEGATIVE, input.nsfw ? '' : SFW_NEGATIVE, input.negative);
  return { ok: true, positive, negative };
}
