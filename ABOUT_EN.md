# HWHArchdemonExt

An add-on for HeroWarsHelper for the Archdemon event. It runs the free Abyss chapter, collects
the team you set and stops right before the Archdemon — you attack yourself.
If a run does not work out, it resets the chapter and tries again.

## Features

- **The goal is picked like in the game** — with a “Gather the team” window: up to five heroes
  with ranks 80/100/130, patrons, the main pet and two talismans.
- **Regular run** — without the Talisman of Wealth. It holds off buying until the stall has more slots:
  - on each point it buys the needed heroes; if there are none, one refresh, then the battle;
  - on point 1 it buys every unknown card;
  - a lost point is remembered and the chapter restarts; next time the team is changed;
  - the final shopping completes the team, selling extra pets when coins run short;
  - optionally stops before the Archdemon even if the team is not complete.
- **Run with the Talisman of Wealth** — goes with cheap carry heroes, saves coins and buys
  the main team at the very end:
  - needed heroes are pinned in the shop along the way and bought in the final shopping,
    so coins are not spent early and go into the talisman bonus;
  - carry heroes with ranks, topped up along the chapter;
  - two deliberate losses on the last point for coins;
  - resale of profitable lots;
  - discounted pets are bought out and sold later, so the shop offers more heroes;
  - minimum Shop Coins with the talisman bonus shown: the shopping stops once it is out of reach.
- **Ready-made builds** — teams of other players from open videos, collected on [HWDaily](https://hwdaily.win/) (by Fragator)
  and [HWMAP](https://hwmap.online/) (by Kircheis). One button runs the chapter with the chosen build. The builds are
  loaded from our server on Netlify or its mirrors on jsDelivr and GitHub, no player data is sent. Thanks to the video authors and to both sites.
- **Run log** on the right, a Stop button, an optional report before the final shopping.
- Paid Abyss chapters are never touched.
- Does not start a run when less than 10 minutes are left until the event ends.

## Install

HeroWarsHelper 2.459 or newer is required: with an older helper the run fails. Import `HWHArchdemonExt.user.js` into Tampermonkey. The script order does not matter: the add-on waits for the helper.
The item appears in the helper menu: **Others → Adventure (Arch)**.

## Screenshots

<details>
<summary>Show</summary>

<a href="docs/img/setup.png"><img src="docs/img/setup.png" width="420" alt="Setup window"></a>
<a href="docs/img/wealth.png"><img src="docs/img/wealth.png" width="420" alt="Talisman of Wealth run settings"></a>

</details>
