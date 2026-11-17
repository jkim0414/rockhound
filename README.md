# Rockhound

A collect-them-all rock, mineral, and gem game where every specimen is earned with math.
Pick a mystery rock, land three hammer strikes (three math problems), and a real specimen
goes into the collection with a field card to read.

It is a plain static web app with no build step and no tracking. Progress is saved on the
device, and an optional cloud save carries it between devices.

## Live site

(address removed)

Hosted on Vercel from this repository. Every push to `main` redeploys it within a minute.
`npm test` runs every check (math generators, full playthroughs, cloud save).
Always install and play from that exact address: progress is stored per address.

## Run it on this computer

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. The dev server also runs the cloud-save API, keeping saves in a
local `.data` folder (family key: `dev-family-key`). Run `node tools/dev_server.mjs 5173 5174` to get
two addresses that behave like two separate devices.

## Put it on an iPad or phone

A home-screen app needs to be served over HTTPS, so the folder has to be hosted somewhere.
Any static host works (GitHub Pages, Netlify, Cloudflare Pages): upload the whole folder as-is.

Once it is hosted:

1. Open the address in **Safari** on the iPad.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen once while online. It saves all the photos in the background
   and then works with no internet.

Progress lives in that device's browser storage. Clearing Safari website data erases it, unless
cloud save is on.

## Cloud save (progress on every device)

Each explorer can have a cloud save, which works as their account. It has no email and no password.

**Turn it on** (once per explorer): Grown-ups → Cloud save → enter the **family key** → *Turn on cloud save*.
The app shows a 16-character **cloud save code** such as `K7QM-2XPD-9TBR-4NHC`.

**Use it on another device:** open the app there, tap *I already have a cloud save code* on the welcome
screen, and type the code. Anything already found on that device is combined in.

**After that it is automatic.** The app saves when a rock is opened, a chapter is finished, a Field Test
ends, settings change, or the app is closed, and it checks for newer progress whenever it is opened.
It keeps working offline and catches up later. If two devices changed while apart, nothing found is
lost: collections, finished chapters and stars are combined, and math levels follow the device with
more problems solved.

Things to know:

- The **code is the key**. Anyone who has it can load and change that collection, so treat it like a
  password. It is shown under Grown-ups on any signed-in device. If every device is signed out and the
  code is lost, that save cannot be recovered.
- The **family key** only allows creating new cloud saves. It is the `FAMILY_KEY` environment variable
  of the Vercel project; change it there (then redeploy) whenever you like.
- *Sign out on this device* saves first, then clears the device back to the welcome screen. That is how
  a second child uses the same device with their own code.
- *Delete cloud save* erases the cloud copy for good; progress on the current device stays.
- What is stored: the explorer's name, the Grown-ups PIN and settings, and game progress. Nothing else.

How it is built: `api/sync.js` is one small serverless function; saves are single JSON files in a
**private Vercel Blob store** (`rockhound-saves`). Codes are random and carry check characters signed
with `SYNC_SECRET`, so made-up codes are rejected without touching storage. At most `MAX_ACCOUNTS`
(default 12) cloud saves can exist. Vercel's free plan allows about 2,000 saves a month across everyone;
normal play uses a few hundred. If that allowance ever runs out, the game keeps working on each device and
syncing resumes later.

## How the game works

- **One mystery rock = three problems**, each from a different math strand, so practice is always mixed.
- **Every rock holds a new specimen.** No duplicates. A rock occasionally holds a "lucky find" from the next expedition.
- **Ten expeditions**, from Backyard & Beach to Legends. Finishing one earns a new rank and unlocks a Field Guide chapter.
- **Mistakes cost nothing.** No timer, no lives, no lost progress. A miss shows a hint; a second miss
  shows the first steps of the solution; a third shows the full worked example and then offers a
  fresh problem of the same kind. Wrong multi-digit answers get specific feedback ("every digit is right except the tens place").
- **Right answers stay on screen.** A solved problem stays put, marked correct, until he taps *Next strike*.
- **Chapters are finished on purpose.** A Field Guide chapter counts as read only when he taps *I finished reading*.
- **Field Test** (optional) quizzes him on his own specimens and awards stars. It never blocks anything.

## How the collection is organized

Every specimen has exactly one home, decided by one question at a time:

| Question | Answer | Kingdom | Then sorted by |
|---|---|---|---|
| One substance, with a crystal pattern, never alive? | yes | **Minerals** (91) | chemistry: native elements, sulfides, oxides, halides, carbonates, borates, sulfates, phosphates, silicates (six structural families) |
| One substance, but breaks a mineral rule? | | **Mineraloids** (6) | which rule: no crystal pattern, or made by living things |
| A mixture, formed on Earth? | | **Rocks** (32) | how it formed: igneous (intrusive / extrusive), sedimentary (clastic / chemical / biochemical), metamorphic (foliated / non-foliated) |
| A mixture, not from Earth? | | **Space rocks** (4) | stony, stony-iron, iron, Moon rocks |

"Gem" and "crystal" are deliberately not separate boxes. A gem is a specimen fine enough to wear
(shown as a badge, with gem varieties such as ruby linked to their species, corundum). A crystal is the
shape a mineral grows in (shown as its crystal system). The collection can be re-sorted by
**Hardness**, **Crystal shape**, or **Gems** using the lens buttons.
A switch above them shows **Everything** (with silhouettes for what is still hidden) or **Only what I've found**.

## The math ladder

Five strands, ten levels each. All strands start at level 1.

**Place value & number sense** — 1 Stamp Game stamps, digit values · 2 four-digit place value, expanded form, bead frame ·
3 stamps that need exchanging, comparing, 10/100/1,000 more · 4 rounding, patterns · 5 five- and six-digit numbers ·
6 rounding to 1,000, ×10/×100 · 7 millions · 8 decimals: tenths (Mohs hardness) · 9 adding tenths · 10 hundredths, rounding decimals

**Addition & subtraction** — 1 two-digit ± one-digit · 2 two-digit mental · 3 three-digit, one exchange ·
4 four-digit static · 5 four-digit dynamic addition · 6 four-digit dynamic subtraction · 7 Dot Board (3–4 addends), across zeros ·
8 five-digit, missing part · 9 six-digit, two-step stories · 10 long chains, the Gauss trick

**Multiplication & division** — 1 tables 2/3/4/5/10 · 2 tables 6–9 · 3 tables 11–12, easy division facts ·
4 all division facts, multiples of ten · 5 2-digit × 1-digit · 6 3-digit × 1-digit, remainders · 7 4-digit × 1-digit, 2-digit ÷ 1-digit ·
8 2-digit × 2-digit · 9 3-digit ÷ 1-digit, order of operations · 10 long division with remainders, parentheses

**Balance scales & algebra** — 1 scale: x + a = b · 2 scale: equal rocks; x − a = b · 3 two-step scale ·
4 one-step equations · 5 two-step equations · 6 scale with rocks on both sides · 7 x on both sides, division ·
8 parentheses · 9 two unknowns · 10 function rules, growing patterns

**Fractions & proportion** — 1 naming fractions, half and quarter · 2 unit fraction of a set · 3 fraction of a set ·
4 equivalent fractions, comparing · 5 adding like fractions · 6 proportions · 7 simplest form, mixed numbers ·
8 unlike denominators · 9 percent · 10 rates and ratios

### How levels move

Each strand moves on its own, slowly and on purpose. The pace is chosen under Grown-ups:

| Pace | First-try solves needed at a level | Strands that may move up per day | A child who gets everything right finishes the collection around |
|---|---|---|---|
| **Gentle** (default) | 8 | 1 | level 5 |
| Steady | 6 | 2 | level 6 to 8 |
| Quick | 4 | no limit | level 10 |

- **Up:** a first-try solve at the current level fills one dot. Solving on the second try empties one; needing the
  worked steps empties two. When the dots are full the strand may move up, if the day's allowance is not used.
  The daily allowance stops everything getting harder in one sitting.
- **Down:** trouble in a row moves a strand back a level quickly: for example one two-try problem followed by one
  that needed the worked steps. A first-try solve in between clears the count.
- **Settling in:** a level he has only just reached is mixed half-and-half with easier review. After that about one
  problem in four is review. Review never changes the level.
- **Cap:** automatic levelling cannot pass *expedition + 2*.
- **By hand:** the − and + buttons under Grown-ups place a strand anywhere, at any time.

Place-value colors follow Montessori materials: units green, tens blue, hundreds red. Column problems are
answered units-first, with tap-to-mark exchange boxes above each column.

## Grown-ups corner

Home screen → **Grown-ups** (bottom of the page). Set a 4-digit PIN the first time. There you can:

- see each strand's level, mastery dots, first-try rate, and the last 15 problems
- choose how quickly the math gets harder (Gentle, Steady, Quick)
- move a strand's level up or down by hand
- cap mystery rocks per day, change the name, turn sounds off, or reset progress

## Changing things

| To change | Edit |
|---|---|
| Specimens, facts, groups, expeditions | `js/data.js` |
| Field Guide chapters | `js/lessons.js` |
| Math skills and hints | `js/math.js` (then run `node tools/test_math.mjs`) |
| Levelling rules, lucky-find odds, how two devices merge | `js/store.js` |
| Cloud save | `api/sync.js`, `api/_lib/`, `js/sync.js` (then run `node tools/test_sync.mjs`) |
| A photo | pin a file in `tools/photo_sources.json`, then `python3 tools/fetch_photos.py <id>` |

`python3 tools/find_photo.py "search words" some/folder` lists Wikimedia Commons candidates and saves previews.

## Photos

Every photo is a real specimen from Wikimedia Commons, used under its Creative Commons or public-domain
license. Author and license are shown on each field card and listed on the in-app **Photo credits** page
(`js/credits.js`, generated by `tools/fetch_photos.py`).
