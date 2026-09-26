// Everything the painter says, the brushes they reach for, and what the finished piece is called.
import { pick, pickFresh } from './util.js';

export const LINES = {
  wash: [
    "Let's put a little color on this canvas and see what shows up.",
    "Thin and wet. Everything moves easier when it's wet.",
    "Criss-cross, criss-cross. We're just getting the sky started.",
  ],
  cloud: [
    'That one wants to float. We’ll let it be a cloud.',
    'A little cloud drifted in. He can stay.',
    'Clouds are free. Take as many as you like.',
    'Scrub it in, soft and loose. Clouds don’t really have edges.',
  ],
  mountain: [
    'Oh, that’s a mountain. You can tell by the way it sits there.',
    'Push it up, let it be big. Mountains don’t apologize.',
    'Knife in, pull it down, and let the light find its own way.',
    'There was a mountain hiding in that one the whole time.',
  ],
  foothills: ['A few little trees climbing up the hill.', 'Some trees wandered up the mountain. That’s allowed.'],
  mist: ['Let a little mist drift through here. It softens everything.'],
  treeline: [
    'Way back there, a whole row of little trees. They’re far away, so they’re quiet.',
    'Just tap in a distant forest. Nobody has to count them.',
  ],
  evergreen: [
    'There’s a happy little tree in there. Let him grow.',
    'Tap, tap, tap. Let the branches hang however they want.',
    'Trees don’t grow even, and neither should yours.',
    'That drip wanted to be a tree. Who are we to argue.',
  ],
  deciduous: [
    'This one gets leaves. Just dab them on.',
    'A leafy fella. Leave some holes so the birds can get through.',
  ],
  bush: ['Just a little bush. Tap it in and walk away.', 'Push the brush in and let the bristles do the work.'],
  tree: ['There’s a happy little tree in there. Let him grow.'],
  friend: ['He looked lonely, so he got a friend.', 'Everybody needs a neighbor.', 'Let’s give him some company.'],
  family: ['Well, now it’s a whole family.'],
  flowers: ['A few little flowers came up there.', 'Just a dot of color. Leave it alone and it looks like flowers.'],
  cabin: ['Somebody lives here now. A little cabin, nice and cozy.', 'Put a little home in there. Everybody deserves a place to be.'],
  bank: ['This needs some land under it. Let’s make some ground.', 'Pull a little land in from the side. The water will make room.'],
  bankTree: ['He needs somewhere to stand. Land first, then the tree.'],
  rock: ['A little rock, sitting in the water, minding its own business.', 'Knife it in, touch the top with light. That’s a rock now.'],
  ripples: ['Just a few ripples. The water noticed.', 'A little sparkle on the water.'],
  birds: ['A couple of birds heard about the view.', 'Two little birds. Keep them small and they’ll be far away.'],
  stars: ['Look at that. Stars.', 'A little spatter up there and the night fills itself in.'],
  sun: ['That’s a sun if I ever saw one.', 'Let’s give this painting some light.'],
  moon: ['The moon’s up. Everybody be quiet now.'],
  aurora: ['The sky’s doing that shimmery thing tonight.'],
  signature: ['Now sign it. That makes it yours.'],
  invite: ['Your turn. Tap, flick, or press and hold anywhere on the canvas.'],
  done: ['That might be done. Sign it whenever you’re ready.'],
  undo: ['There’s no undo in here. Let’s see what it turns into instead.'],
  leave: ['That one landed off the canvas. Happens to everybody.'],
};

const TOOLS = {
  wash: ['2-inch brush', ['Liquid White', 'Phthalo Blue', 'Alizarin Crimson']],
  cloud: ['1-inch brush', ['Titanium White', 'a whisper of Alizarin Crimson']],
  mountain: ['Palette knife', ['Van Dyke Brown', 'Prussian Blue', 'Titanium White']],
  foothills: ['Fan brush', ['Sap Green', 'Liquid White']],
  mist: ['2-inch brush', ['Liquid White']],
  treeline: ['Fan brush', ['Sap Green', 'Midnight Black']],
  evergreen: ['Fan brush', ['Midnight Black', 'Sap Green', 'Cadmium Yellow']],
  deciduous: ['Round brush', ['Sap Green', 'Yellow Ochre', 'Van Dyke Brown']],
  bush: ['1-inch brush', ['Sap Green', 'Cadmium Yellow']],
  flowers: ['Liner brush', ['Bright Red', 'Cadmium Yellow']],
  cabin: ['Palette knife', ['Van Dyke Brown', 'Dark Sienna', 'Titanium White']],
  bank: ['2-inch brush', ['Van Dyke Brown', 'Sap Green', 'Yellow Ochre']],
  rock: ['Palette knife', ['Van Dyke Brown', 'Titanium White']],
  ripples: ['Liner brush', ['Titanium White']],
  birds: ['Liner brush', ['Midnight Black']],
  stars: ['Liner brush', ['Titanium White']],
  sun: ['1-inch brush', ['Cadmium Yellow', 'Titanium White']],
  moon: ['1-inch brush', ['Titanium White', 'Prussian Blue']],
  aurora: ['2-inch brush', ['Phthalo Green', 'Titanium White']],
  signature: ['Liner brush', ['Bright Red']],
};

export function line(key) {
  return pickFresh(key, LINES[key] || []);
}

export function toolInfo(kind, pigment) {
  const t = TOOLS[kind];
  if (!t) return '';
  const [tool, paints] = t;
  let text = `${tool} · ${paints.join(', ')}`;
  if (pigment && !paints.includes(pigment.name)) text += ` · a touch of ${pigment.name}`;
  return text;
}

// ——— Titles ———

const PLACE_A = ['Hollow', 'Cedar', 'Otter', 'Wren', 'Bramble', 'Silver', 'Miller’s', 'Juniper', 'Heron', 'Quiet', 'Lantern', 'Foxglove', 'Birch', 'Stillwater', 'Old Mill', 'Kestrel'];
const PLACE_B = ['Creek', 'Lake', 'Cove', 'Pond', 'Hollow', 'Reach', 'Bend', 'Ridge', 'Meadow', 'Crossing', 'Narrows', 'Point'];

const MOOD = {
  'golden-hour': { adj: ['Golden', 'Late', 'Amber', 'Warm'], time: ['Late Afternoon', 'Sundown', 'Golden Hour'] },
  'winter-hush': { adj: ['Quiet', 'Frozen', 'Hushed', 'Silver'], time: ['First Snow', 'Deep Winter', 'A Cold Morning'] },
  'northern-night': { adj: ['Midnight', 'Starlit', 'Northern', 'Sleeping'], time: ['Midnight', 'Moonrise', 'The Long Night'] },
  'autumn-blaze': { adj: ['October', 'Copper', 'Blazing', 'Russet'], time: ['Early October', 'Harvest Time', 'The Turning'] },
  'misty-morning': { adj: ['Misty', 'Soft', 'Early', 'Gentle'], time: ['Early Morning', 'First Light', 'Morning Fog'] },
  'violet-dusk': { adj: ['Violet', 'Evening', 'Dusky', 'Lavender'], time: ['Dusk', 'Last Light', 'Nightfall'] },
};

function subjects(counts) {
  const s = [];
  if (counts.cabin) s.push(['Cabin', 'Cabins'], ['Hideaway', 'Hideaways'], ['Homestead', 'Homesteads']);
  if (counts.mountain) s.push(['Peak', 'Peaks'], ['Ridge', 'Ridges'], ['Mountain', 'Mountains']);
  if (counts.evergreen) s.push(['Pine', 'Pines'], ['Evergreen', 'Evergreens']);
  if (counts.deciduous || counts.bush) s.push(['Grove', 'Groves'], ['Thicket', 'Thickets']);
  if (counts.rock) s.push(['Stone', 'Stones']);
  if (counts.moon || counts.stars) s.push(['Moon', 'Moons']);
  if (!s.length) s.push(['Water', 'Waters'], ['Sky', 'Skies'], ['Shore', 'Shores']);
  return s;
}

export function makeTitle(counts, schemeId) {
  const mood = MOOD[schemeId] || MOOD['golden-hour'];
  const place = `${pick(PLACE_A)} ${pick(PLACE_B)}`.replace('Hollow Hollow', 'Hollow Creek');
  const [one, many] = pick(subjects(counts));
  const adj = pick(mood.adj);
  const templates = [
    () => `${adj} ${many}`,
    () => `${one} at ${place}`,
    () => `${pick(mood.time)} at ${place}`,
    () => `The ${adj} ${one}`,
    () => `Where the ${many} Are`,
    () => `${place}, ${pick(mood.time)}`,
    () => `${adj} Morning at ${place}`.replace(/(Midnight|Evening|Dusky|Violet|Starlit|Sleeping|Northern) Morning/, '$1 Night'),
  ];
  return pick(templates)();
}

// ——— Placard text ———

const FEATURE_NAMES = [
  ['mountain', 'a mountain', 'mountains'],
  ['evergreen', 'a happy little tree', 'happy little trees'],
  ['deciduous', 'a leafy tree', 'leafy trees'],
  ['bush', 'a bush', 'bushes'],
  ['cabin', 'a cabin', 'cabins'],
  ['cloud', 'a cloud', 'clouds'],
  ['rock', 'a rock', 'rocks'],
  ['birds', 'a pair of birds', 'flocks of birds'],
  ['flowers', 'some flowers', 'patches of flowers'],
  ['bank', 'a bit of shore', 'stretches of shore'],
  ['treeline', 'a distant forest', 'distant forests'],
];

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const num = (n) => WORDS[n] || String(n);

export function featureLine(counts) {
  const parts = [];
  for (const [key, one, many] of FEATURE_NAMES) {
    const n = counts[key] || 0;
    if (!n) continue;
    parts.push(n === 1 ? one : `${num(n)} ${many}`);
  }
  if (counts.sun) parts.push('the sun');
  if (counts.moon) parts.push('the moon');
  if (counts.aurora) parts.push('an aurora');
  if (!parts.length) return 'Mostly sky and water, which is plenty.';
  if (parts.length === 1) return `Features ${parts[0]}.`;
  if (parts.length > 6) return `Features ${parts.slice(0, 5).join(', ')}, and more.`;
  const last = parts.pop();
  return `Features ${parts.join(', ')} and ${last}.`;
}

export function durationText(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (!m) return `${s} seconds`;
  return `${m} min ${s} s`;
}

export function madeFrom(accidents, seconds) {
  const a = accidents === 1 ? 'one happy accident' : `${accidents} happy accidents`;
  return `Painted wet-on-wet from ${a} in ${durationText(seconds)}.`;
}

