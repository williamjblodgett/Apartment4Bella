# Bella's Home Base

A personalized apartment finder for 1–2 bedroom communities within a conservative 40-minute drive of Sixes Elementary School in Canton, Georgia.

The public site is deployed with GitHub Pages at:

**https://williamjblodgett.github.io/Apartment4Bella/**

## What it includes

- 46 second-pass researched apartment communities in Canton, Holly Springs, Woodstock, Acworth, and Kennesaw
- drive-time, bedroom, rent, deal, amenity, and access-feature filters
- official property, pricing, amenity, photo, and live-directions links
- detailed rent notes, fees, pet policies, review snapshots, and deal caveats
- starting-rent affordability scoring based on the same directory, with price-basis caveats
- GBI county-level reported-crime context with an explicit no-property-rating caveat
- locally saved favorites

## Daily refresh

`.github/workflows/pages.yml` runs every morning and on every push. It checks the official property pricing URLs, records blocked and unparsed sources separately, expires dated promotions, saves generic price findings only as review candidates, validates the directory, builds the static site, and redeploys GitHub Pages. Scheduled/manual runs also commit the latest status snapshot so a later blocked check cannot roll the data backward.

If a source blocks automation or changes format, the site keeps the last successful observation, says that the current check was blocked/unparsed, and continues to link to the official page. The leasing office remains the final authority for price, availability, eligibility, and fees.

## Local commands

```bash
npm ci
npm run dev
npm run build
npm run build:pages
npm run refresh:data
npm run validate:data
```

- `npm run dev` runs the full vinext/Sites preview.
- `npm run build` validates the Cloudflare-compatible application build.
- `npm run build:pages` creates the static GitHub Pages artifact in `pages-dist/`.
- `npm run refresh:data` performs the same best-effort official-source refresh used by the daily workflow.
- `npm run validate:data` rejects duplicate communities, invalid prices, missing source links, and anything outside the 40-minute ceiling.

## Data principles

- Commute ranges are static estimates and are not stored Google traffic data. Every listing links to a fresh Google Maps route.
- Affordability is relative to the current shortlist; it does not determine personal affordability or leasing eligibility.
- Crime figures are county/jurisdiction context, never a property safety grade. No location can be guaranteed safe.
- Review ratings are dated snapshots with live source links.
- Property photos remain hosted by and attributed to official property sites; cards without a stable embeddable asset link to the official gallery instead.
- This is a broad community directory, not a licensed feed guaranteed to contain every individual available unit or private rental.
