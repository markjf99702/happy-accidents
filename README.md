# Happy Accidents

A painting toy where you can't paint on purpose.

You flick, tap, or pour paint at a canvas on an easel. After a beat, a gentle
painter looks at the splat (where it landed, what it landed on, its shape, which
way it was flung, what color it was) and decides what it was *trying* to be. Then
they paint it in, stroke by stroke, while the wet blob of paint soaks away.

**The shape of the splat carries through.** Whatever gets painted is built from the
splat's actual outline and droplets, so no two come out the same:

- a mountain's ridge is the top edge of the splat, blown up (spikes become needle peaks)
- a cloud has the splat's silhouette, and the flung droplets drift off as little cloudlets
- a splat on the water becomes land or an island in its own shape, laid flat on the lake
- a leafy tree's crown is the splat; an evergreen's branches bulge where the splat bulged
- each droplet becomes its own bird, star, flower or ripple
- the far-off treeline's skyline follows the splat's top edge

**Paint that lands on something already there changes it** instead of adding something new:

| Hit | With | And |
| --- | --- | --- |
| a tree | white | snow settles on it |
| an evergreen | yellow or red | late light catches its side |
| a leafy tree or bush | yellow or red | it turns to autumn |
| a tree | anything else | a friend grows next to it |
| a mountain | white / blue / yellow or red / green | fresh snow / a waterfall / alpenglow / trees up the slope |
| the sun or moon | warm or white | the whole sky warms into a sunset |
| the sun or moon | anything else | a cloud drifts across it |
| a cloud | something dark | it turns stormy and rains |
| the cabin | white / warm / anything | snow on the roof / the lights come on / a garden |
| a rock | green / white | moss / snow |
| a splat that's still wet | anything | the two run together into one bigger splat, colors mixed |

Otherwise it goes by where it lands: clouds, a sun or moon, birds or stars up high;
mountains in the lower sky; a quiet row of trees on the horizon; land, islands, rocks
and ripples on the lake; trees, bushes, flowers and sometimes a little cabin on land.

The lake reflects everything above the horizon, with ripples. When you like it,
sign it: you get a museum label with a generated title, and it goes up on your
gallery wall (kept in this browser only).

There is no undo. That's the point.

## Playing

| Do this | And |
| --- | --- |
| Tap | a small splat |
| Flick (drag and let go) | a stretched splat, flung in that direction, with droplets |
| Press and hold | paint pools and grows until you let go |
| Pick a paint on the palette | that pigment tints whatever the splat becomes; **Surprise me** picks a new one each time |
| **Oops** / <kbd>Space</kbd> | an accident you didn't make |
| **Let it happen** / <kbd>A</kbd> | accidents keep happening on their own until the painting feels done |
| **Sign it** / <kbd>S</kbd> | sign, title, frame and hang it |
| <kbd>N</kbd> new canvas · <kbd>G</kbd> gallery · <kbd>M</kbd> sound | |

Every canvas gets a mood: Golden Hour, Winter Hush, Northern Night, Autumn Blaze,
Misty Morning or Violet Dusk.

## Running it

No build step is needed to play. Serve the folder with any static server:

```sh
npm start            # or: python3 -m http.server
```

then open http://localhost:8080. (Opening `index.html` straight from disk won't
work, because browsers block ES modules on `file://`.)

To get a single self-contained HTML file you can double-click, email, or drop anywhere:

```sh
npm install
npm run build        # writes dist/happy-accidents.html
```

To host it on GitHub Pages: Settings → Pages → Deploy from a branch → your default branch, `/ (root)`.

## How it works

It's plain JavaScript and Canvas 2D, with no framework and no image assets.
Everything on the canvas is procedurally painted.

- `src/brush.js`: the brush engine. A stroke is many thin bristle lines, each with
  its own color wobble, opacity, and dry-brush breaks. Knife pulls, taps, and scrubs
  are built from it.
- `src/splat.js`: the accident: a glossy blob with harmonic wobble, spikes, and flung droplets,
  plus its outline and droplets in canvas coordinates (a union, when wet splats run together).
- `src/shape.js`: turns that outline into silhouettes: top edges, side profiles, clumps.
- `src/decide.js`: reads a splat and returns a *plan* (for example: land, then a tree on it).
  It first checks what's already painted under the splat, pixel by pixel, and reacts to that.
- `src/paint/react.js`: changes to existing things. Most paint straight into the existing
  element's layer with `source-atop`, so new paint only sticks where there was paint already.
- `src/paint/*`: one painter per thing. Each returns a bounding box, a depth, and a list
  of small drawing steps that get played back over a second or two, so you watch it being painted.
- `src/studio.js`: owns the scene. Every element paints into its own offscreen layer,
  and the layers are composited back-to-front by depth. The lake is drawn live from a
  mirrored, rippled copy of everything above the horizon, and a canvas weave texture goes over the top.
- `src/words.js`: what the painter says, which brushes and paints they name, and titles
  like *Cabin at Otter Cove* or *October Pines*.
- `src/sound.js`: optional, synthesized splat and brush sounds (off by default).
- `og.png`: the picture shown when a link is shared in a message.

The window exposes the studio as `window.happyAccidents` if you want to poke at it from the console:

```js
happyAccidents.newCanvas('northern-night')
happyAccidents.randomAccident({ hint: 'cabin' })
```
