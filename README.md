# Bella's Home Base

A personalized apartment finder for 1–2 bedroom communities within a conservative 40-minute drive of Sixes Elementary School in Canton, Georgia.

The public site is deployed with GitHub Pages at:

**https://williamjblodgett.github.io/Apartment4Bella/**

## What it includes

- 13 researched apartment communities in Canton, Holly Springs, Woodstock, Acworth, and Kennesaw
- drive-time, bedroom, rent, deal, amenity, and access-feature filters
- official property, pricing, amenity, photo, and live-directions links
- detailed rent notes, fees, pet policies, review snapshots, and deal caveats
- relative-affordability scoring based on the same filtered shortlist
- GBI county-level reported-crime context with an explicit no-property-rating caveat
- locally saved favorites

## Daily refresh

`.github/workflows/pages.yml` runs every morning and on every push. It checks the official property pricing URLs, expires dated promotions, cautiously updates a lowest advertised price only when the page can be parsed and the result passes sanity limits, detects clearly worded rent concessions, builds the static site, and redeploys GitHub Pages.

If a source blocks automation or changes format, the site keeps the last curated value and continues to link to the live official page. The official leasing office remains the final authority for price, availability, eligibility, and fees.

## Local commands

```bash
npm ci
npm run dev
npm run build
npm run build:pages
npm run refresh:data
```

- `npm run dev` runs the full vinext/Sites preview.
- `npm run build` validates the Cloudflare-compatible application build.
- `npm run build:pages` creates the static GitHub Pages artifact in `pages-dist/`.
- `npm run refresh:data` performs the same best-effort official-source refresh used by the daily workflow.

## Data principles

- Commute ranges are static estimates and are not stored Google traffic data. Every listing links to a fresh Google Maps route.
- Affordability is relative to the current shortlist; it does not determine personal affordability or leasing eligibility.
- Crime figures are county/jurisdiction context, never a property safety grade. No location can be guaranteed safe.
- Review ratings are dated snapshots with live source links.
- Property photos remain hosted by and attributed to the official property sites.
