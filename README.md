# Soufiane Tajri — Campground Portfolio

A small, browser-based Three.js portfolio. Explore a lakeside campground built from the full 62-asset kit as an animated backpacker, then read the portfolio panels at each station. The world opens in sunset lighting, with campsites, cabins, docks, forest details, and warm lanterns.

The map follows the campground trail: the lookout and cabins sit to the north-west, the creek and footbridge to the west, the campfire plaza in the centre, the kitchen to the east, and the docks on the south-east lake shore.

## Run locally

From this folder, run:

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite in your browser (typically `http://localhost:5173`). The page uses ES modules and cannot be opened reliably with `file://`.

Three.js and low-poly models load from unpkg and the Polyfork CDN, so an internet connection is needed. If individual campground models fail to load or time out, built-in fallback scenery keeps the world playable.

## Deploy to GitHub Pages

The `main` branch deploys automatically to GitHub Pages using the workflow in `.github/workflows/deploy.yml`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The site is built with a relative base path so it works from a project repository URL.

## Controls

- **WASD / ZQSD (AZERTY) / arrow keys** — walk
- **Space** — jump (visual only; it does not cross obstacles)
- **Shift** — sprint (with a faster run animation)
- **Hold E** — open a portfolio section when its nearby prompt appears; the prompt fills while held, and the camera adds a gentle shake on completion
- On touch screens, use the virtual joystick, **RUN**, and **JUMP** buttons.
- Approach a station to reveal its **Hold E** prompt; keep **E** held or press and hold the prompt until its progress fills. The card stays open until you move away or close it. Use the **Visit** shortcuts to fast-travel. The Projects card has previous/next buttons and supports horizontal swipes.
- Scroll over the world to zoom. The **☼** button switches between sunset and morning lighting; **♫** toggles generated relaxing ambient music and movement sounds.
- Visited stations, time of day, and sound preference are saved in local storage.

## Customize

- Edit portfolio copy, project details, and links in `content.js`.
- Adjust model IDs, station positions, and model sizes in `models.js`.
- The Three.js scene and movement logic are in `src/main.js`.
