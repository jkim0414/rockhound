# Rockhound

A collect-them-all rock, mineral, and gem game where every specimen is earned with math.
Pick a mystery rock, land three hammer strikes (three math problems), and a real specimen
goes into the collection with a field card to read.

It is a plain static web app (no build step, no accounts, no tracking). All progress is
saved on the device.

## Live site

(address removed)

Hosted on Vercel from this repository. Every push to `main` redeploys it within a minute.
Always install and play from that exact address: progress is stored per address.

## Run it on this computer

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Put it on an iPad or phone

A home-screen app needs to be served over HTTPS, so the folder has to be hosted somewhere.
Any static host works (GitHub Pages, Netlify, Cloudflare Pages): upload the whole folder as-is.

Once it is hosted:

1. Open the address in **Safari** on the iPad.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen once while online. It saves all the photos in the background
   and then works with no internet.

Progress lives in that device's browser storage. Clearing Safari website data erases it.

## How the game works

- **One mystery rock = three problems**, each from a different math strand, so practice is always mixed.
- **Every rock holds a new specimen.** No duplicates. A rock occasionally holds a "lucky find" from the next expedition.
- **Ten expeditions**, from Backyard & Beach to Legends. Finishing one earns a new rank and unlocks a Field Guide chapter.
- **Mistakes cost nothing.** No timer, no lives, no lost progress. A miss shows a hint; a second miss
  shows the first steps of the solution; a third shows the full worked example and then offers a
  fresh problem of the same kind. Wrong multi-digit answers get specific feedback ("every digit is right except the tens place").
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

- **Up:** four first-try solves at the current level.
- **Down:** two problems in a row that needed the full worked example.
- **Cap:** automatic levelling cannot pass *expedition + 2*, so difficulty climbs with the collection
  (level 10 becomes reachable at expedition 8).
- About one problem in four is review from one or two levels down. Review never changes the level.

Place-value colors follow Montessori materials: units green, tens blue, hundreds red. Column problems are
answered units-first, with tap-to-mark exchange boxes above each column.

## Grown-ups corner

Home screen → **Grown-ups** (bottom of the page). Set a 4-digit PIN the first time. There you can:

- see each strand's level, mastery dots, first-try rate, and the last 15 problems
- move a strand's level up or down by hand
- cap mystery rocks per day, change the name, turn sounds off, or reset progress

## Changing things

| To change | Edit |
|---|---|
| Specimens, facts, groups, expeditions | `js/data.js` |
| Field Guide chapters | `js/lessons.js` |
| Math skills and hints | `js/math.js` (then run `node tools/test_math.mjs`) |
| Levelling rules, lucky-find odds | top of `js/store.js` |
| A photo | pin a file in `tools/photo_sources.json`, then `python3 tools/fetch_photos.py <id>` |

`python3 tools/find_photo.py "search words" some/folder` lists Wikimedia Commons candidates and saves previews.

## Photos

Every photo is a real specimen from Wikimedia Commons, used under its Creative Commons or public-domain
license. Author and license are shown on each field card and listed on the in-app **Photo credits** page
(`js/credits.js`, generated by `tools/fetch_photos.py`).
