# How YallaTrip was built with Claude Code

YallaTrip was built by a product owner who writes no code, working with [Claude Code](https://claude.com/claude-code) as the engineer. This file explains the working method. The real project keeps a longer, private version of these rules that Claude reads at the start of every session.

## Standing rules

A single instructions file, read at the start of every session, holds the rules that never change:

- **Product:** a Hebrew, right-to-left, phone-first site. Every change must work at 360–390 px wide. Tap targets are at least 40 px, and inputs use 16 px text so phones don't zoom in.
- **Money:** anything that costs money now or later (a new Google API call, a paid service, a plan upgrade) is explained with its price first, and nothing is built until the owner approves. No paid plan is ever upgraded by the agent.
- **Secrets:** keys and passwords never go into code, Git or the chat. They live only in the hosting and database settings, entered by the owner.
- **Database:** every schema change (table, column, function, RLS policy) is described in plain language and waits for approval. Nothing destructive is ever run against real data.
- **Design:** one typeface, the blue palette, and nothing added "just in case". Features the owner removed stay removed.
- **The in-app guide:** every new button gets a step in the on-screen tour in the same change, and each step must light exactly what its text describes.

## One branch per change

- Nobody works on `main`. Every request starts a new branch.
- Pushing the branch creates a **Vercel preview** at its own address. It runs the same code against the same database as the live site.
- The owner checks the preview on a real phone. Only after the owner says "merge" does the change go to `main` and to the live site.
- A failed build never replaces the live site, and any release can be rolled back in one click.

## Checks before every push

- `npm run typecheck` and `npm test` must pass. Nothing is pushed with a failure.
- **Phone QA:** each layout is opened in a headless browser at 360 px, 390 px and desktop width. Screenshots are reviewed, and the page is checked for horizontal scrolling. Flows that need a signed-in user are checked on a temporary local page with sample data that is never committed.
- Device behaviour (iPhone Safari, in-app browsers, Android Chrome) is checked by emulating each device. Anything that can only be confirmed on a real phone is said so plainly.
- Every change ends with three lines for the owner: what changed, what to check on the phone, and whether it costs anything.

## Feature switches instead of deletions

Features that aren't ready for the first release are turned off in one file (`src/lib/features.ts`), not deleted. A feature that is off has no button, link, menu line or tour step, and its pages redirect. Its code and data stay intact, so it comes back as it was when the switch is turned on.

## Cost control

Google Maps Platform bills per call. Usage is kept inside the free monthly tier by three layers:

1. **Daily quotas in Google Cloud** on the map, Routes and Places APIs. Google stops the service until the next day instead of charging.
2. **Monthly ceilings in code** (`src/lib/api/guard.ts`). Each costly call is counted in the database before it is made. Each ceiling sits below Google's free amount and resets by itself every month, and the app shows a friendly message instead of an error.
3. **A budget alert by email** at a small amount, as a last safety net.

Per-user daily limits also stop any single account from running up usage.
