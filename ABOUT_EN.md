# HWHArchdemonExt

An add-on for HeroWarsHelper for the Archdemon event. It runs a free chapter that ends with the Archdemon — the Abyss
chapter or, as from 16.11.2026, any chapter of the event — collects the team you set and stops right before the
Archdemon — you attack yourself.
If a run does not work out, it resets the chapter and tries again.

## Features

- **The goal is picked like in the game** — with a “Gather the team” window: up to five heroes
  with ranks 80/100/130, patrons, the main pet and two emblems.
- **Regular run** — without the Emblem of Capital. It holds off buying until the stall has more slots:
  - on each point it buys the needed heroes; if there are none, one refresh, then the battle;
  - on point 1 it buys every unknown card;
  - a lost point is remembered and the chapter restarts; next time the team is changed;
  - the final shopping completes the team, selling extra pets when coins run short;
  - optionally stops before the Archdemon even if the team is not complete.
- **Run with the Emblem of Capital** — goes with cheap carry heroes, saves coins and buys
  the main team at the very end:
  - needed heroes are pinned in the shop along the way and bought in the final shopping,
    so coins are not spent early and go into the emblem bonus;
  - carry heroes with ranks — only discounted or, with a checkbox, at any price; a hero on hand fights in place of
    one not bought on the first point, and the run buys the needed one along the chapter; none set at all —
    the run picks them itself, like a ready-made build with a start;
  - with "start" in the build strategy it buys heroes on the first point — discounted pairs and random fragments —
    so five heroes fight, and along the way buys team heroes at a discount and sells the weakest spare ones;
  - two deliberate losses for coins on a chosen point — any regular one, never the main boss; a checkbox turns them off;
  - resale of profitable lots;
  - discounted pets are bought out and sold later, so the shop offers more heroes;
  - minimum Shop Coins with the emblem bonus shown: the shopping stops once it is out of reach;
    with "Keep extra coins" unchecked, coins above the minimum are spent down to its bonus.
- **The needed emblem was not offered** — the chapter's free rerolls go first, then the chapter restarts.
- **Emblem of Ascension** — once it is taken, the run ascends the heroes of the team or the ones picked in the window,
  collected in full, before the Archdemon: +20% to all stats for 30 Shop Coins each, never below the minimum for the Emblem of Capital.
- **Ready-made builds** — per event and chapter: the window lists the builds of the running event and the chosen chapter — teams of other players from open videos, collected on [HWDaily](https://hwdaily.win/) (by Fragator)
  and [HWMAP](https://hwmap.online/) (by Kircheis). One button runs the chapter with the chosen build. The builds are
  loaded from our server on Netlify or its mirrors on jsDelivr and GitHub, no player data is sent. Thanks to the video authors and to both sites.
- **Settings of their own for each chapter**, within the event only: what you fill in is kept, a new event starts empty.
- **Run log** on the right, a Stop button, an optional report before the final shopping.
- The chapter's main boss cannot be skipped: its result goes after the battle length, as the helper does.
- Paid chapters are never touched.
- Does not start a run when less than 10 minutes are left until the event ends.

## Install

HeroWarsHelper 2.459 or newer is required: with an older helper the run fails. Import `HWHArchdemonExt.user.js` into Tampermonkey. The script order does not matter: the add-on waits for the helper.
The item appears in the helper menu: **Others → ArchRank** (with a redneck chasing the Archdemon with a stick).

While a run is going, turn off other scripts that improve Invasion battles: they intercept the add-on's
requests too and can turn an intentional loss into a win. And do not play manually in the same tab during a run.

## Screenshots

<details>
<summary>Show</summary>

<a href="docs/img/setup_en.png"><img src="docs/img/setup_en.png" width="420" alt="Setup window"></a>
<a href="docs/img/wealth_en.png"><img src="docs/img/wealth_en.png" width="420" alt="Emblem of Capital run settings"></a>

</details>
