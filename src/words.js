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
    'Same shape as the paint, just fluffier.',
    'A little cloud drifted in. He can stay.',
    'Clouds are free. Take as many as you like.',
    'Scrub it in, soft and loose. Clouds don’t really have edges.',
  ],
  mountain: [
    'Oh, that’s a mountain. You can tell by the way it sits there.',
    'See the top of your splat? That’s the ridge now. We just made it bigger.',
    'Push it up, let it be big. Mountains don’t apologize.',
    'There was a mountain hiding in that one the whole time. Same shape and everything.',
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
  bank: ['This needs some land under it. Let’s make some ground.', 'Pull a little land in from the side. It’s the same shape as your splat.'],
  bankTree: ['He needs somewhere to stand. Land first, then the tree.'],
  island: ['It spilled into an island. Same shape and everything.', 'Out in the middle of the lake, a little island.'],
  islandTree: ['An island, and somebody’s already growing on it.'],
  merge: ['Those two ran together. Now it’s one big thing.', 'Wet into wet. They’re one splat now.'],
  treeSnow: ['Snow found him. He looks good in it.', 'Little bit of snow on the branches. Just tap it on top.'],
  treeGlow: ['The light’s hitting him just right now.', 'Catch the edges with a little warm light.'],
  autumn: ['That one turned. Fall came early for him.', 'You hit him with some color, so now it’s autumn over there.'],
  company: ['You hit him, so now he’s got company.', 'He got bumped, and a friend showed up.'],
  snowfall: ['Fresh snow up top. It came down overnight.', 'White on the mountain. It snowed.'],
  waterfall: ['Blue on the mountain? That’s a waterfall now.', 'Water found a way down from right where you hit.'],
  alpenglow: ['Now the mountain’s catching the last of the light.', 'Warm up the peaks. That’s the evening hitting them.'],
  sunset: ['Paint on the sun, and the whole sky warms up.', 'You touched the sun. Everything goes a little golden.'],
  cloudOverSun: ['A little cloud wandered across the sun.'],
  storm: ['That cloud got heavy. Here comes a little rain.', 'Dark paint on a cloud means weather.'],
  sunlitCloud: ['The edges of that cloud caught the light.'],
  lights: ['Somebody’s home. The lights just came on.', 'Light in the window and smoke in the chimney.'],
  roofSnow: ['Snow on the roof. Cozy in there.'],
  garden: ['They planted a little garden out front.'],
  moss: ['A little moss on the rock.'],
  rockSnow: ['Snow on the rock.'],
  rock: ['A little rock, sitting in the water, minding its own business.', 'Knife it in, touch the top with light. That’s a rock now.'],
  ripples: ['Just a few ripples. The water noticed.', 'A little sparkle on the water.'],
  birds: ['Every little drop that flew off turned into a bird.', 'A couple of birds heard about the view.'],
  stars: ['Look at that. Every drop’s a star.', 'A little spatter up there and the night fills itself in.'],
  sun: ['That’s a sun if I ever saw one.', 'Let’s give this painting some light.'],
  moon: ['The moon’s up. Everybody be quiet now.'],
  aurora: ['The sky’s doing that shimmery thing tonight.'],
  // What a paint turned into, when the color made the call.
  wisp: ['Just a wisp of cloud. Barely there.', 'A little streak of cloud, thin as you like.'],
  goldenCloud: ['Yellow up there, so the cloud’s lit from underneath.', 'A cloud with the sun on it. That’s where the yellow went.'],
  sunsetCloud: ['Red in the sky makes a sunset cloud.', 'A pink cloud. Somebody’s having a nice evening.'],
  coolCloud: ['A cool blue cloud. Weather might be on the way.', 'Blue in the sky makes a cool, shady cloud.'],
  stormCloud: ['Dark paint up high? That’s a storm cloud.', 'That one’s heavy. Dark clouds carry weather.'],
  snowyMountain: ['All that white is snow. There was a mountain under it.', 'White, low in the sky. That’s a snowy peak.'],
  blueMountain: ['Blue mountains, way off. Distance turns everything blue.', 'A blue ridge. Far away and quiet.'],
  brownMountain: ['Brown, low in the sky. That’s rock. A big old mountain.', 'Van Dyke Brown makes good solid rock.'],
  redMountain: ['Red rock. It glows like that out west.', 'A red mountain. The evening sun lives in there.'],
  goldMountain: ['Ochre makes a sunny mountain. Sandstone, maybe.'],
  greenMountain: ['A green mountain, trees all the way up.', 'Green that high up is a forested hill.'],
  tallTree: ['Green way up there? That’s the top of a tall tree.', 'A tall one. He grew right up to where the paint landed.'],
  snowyTreeline: ['A row of snowy trees, way off.'],
  blueSpruce: ['Blue paint on the ground makes a blue spruce.', 'A little blue spruce. They’re real, you know.'],
  birch: ['White on the ground? A birch. White bark, dark marks.', 'A birch tree. The white paint went into the bark.'],
  snowyTree: ['White on the land. A tree that’s been out in the snow.', 'That white’s snow. There’s a tree under it.'],
  goldenTree: ['Yellow on the ground turns into a golden tree.', 'A golden fella. The yellow went into the leaves.'],
  redTree: ['A red one. Maples do that.', 'Red paint on the land makes a red tree.'],
  bareTree: ['Brown makes a bare tree. Just branches. He’s resting.', 'No leaves on this one. Brown paint, bare branches.'],
  redCabin: ['Red on the land? A little red cabin.', 'Somebody painted their cabin red. Good for them.'],
  whiteCabin: ['A little white house. Somebody keeps it nice.'],
  sailboat: ['White on the water is a sail. Somebody’s out on the lake.', 'A little sailboat. The white paint caught the wind.'],
  canoe: ['Red on the water. That’s a canoe.', 'A red canoe, just drifting. Nobody’s in a hurry.'],
  glints: ['Light on the water. That’s where the paint went.', 'A little sparkle where the light hits the lake.'],
  blueRipples: ['Blue on the water just moves the water around.', 'A few ripples, cool and blue.'],
  signature: ['Now sign it. That makes it yours.'],
  invite: ['Your turn. Tap, flick, or press and hold. Try hitting something that’s already there, too.'],
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
  sailboat: ['Liner brush', ['Titanium White', 'Van Dyke Brown']],
  canoe: ['Palette knife', ['Bright Red', 'Van Dyke Brown']],
  glints: ['Liner brush', ['Cadmium Yellow', 'Titanium White']],
  island: ['2-inch brush', ['Van Dyke Brown', 'Sap Green', 'Yellow Ochre']],
  treeSnow: ['Fan brush', ['Titanium White']],
  treeGlow: ['Fan brush', ['Cadmium Yellow', 'Titanium White']],
  autumn: ['Round brush', ['Bright Red', 'Indian Yellow', 'Yellow Ochre']],
  snowfall: ['Palette knife', ['Titanium White']],
  waterfall: ['Liner brush', ['Titanium White', 'Phthalo Blue']],
  alpenglow: ['Palette knife', ['Alizarin Crimson', 'Titanium White']],
  sunset: ['2-inch brush', ['Cadmium Yellow', 'Alizarin Crimson']],
  storm: ['1-inch brush', ['Midnight Black', 'Prussian Blue']],
  rain: ['Fan brush', ['Liquid White']],
  sunlitCloud: ['1-inch brush', ['Cadmium Yellow', 'Titanium White']],
  lights: ['Liner brush', ['Cadmium Yellow', 'Indian Yellow']],
  roofSnow: ['Palette knife', ['Titanium White']],
  moss: ['Fan brush', ['Sap Green']],
  rockSnow: ['Palette knife', ['Titanium White']],
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
  if (counts.island) s.push(['Island', 'Islands']);
  if (counts.waterfall) s.push(['Falls', 'Falls']);
  if (counts.sailboat) s.push(['Sail', 'Sails']);
  if (counts.canoe) s.push(['Canoe', 'Canoes']);
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
  ['island', 'an island', 'islands'],
  ['sailboat', 'a sailboat', 'sailboats'],
  ['canoe', 'a canoe', 'canoes'],
  ['waterfall', 'a waterfall', 'waterfalls'],
  ['rain', 'a passing rainstorm', 'passing rainstorms'],
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

