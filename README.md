# Bella's Home Base

A personalized apartment finder for 1–2 bedroom communities whose refreshed no-traffic route plus a 30% planning buffer is within 40 minutes of Sixes Elementary School in Canton, Georgia.

The public site is deployed with GitHub Pages at:

**https://williamjblodgett.github.io/Apartment4Bella/**

## What it includes

- 46 apartment communities in Canton, Holly Springs, Woodstock, Acworth, and Kennesaw, manually rechecked on September 4, 2026
- drive-time, bedroom, rent, deal, amenity, and access-feature filters
- official property, pricing, amenity, photo, and live-directions links
- a dedicated, shareable page for every community, with property-specific social metadata
- a reachable property/management-site photo for all 46 communities, with provenance notes and three-photo galleries where stable first-party assets were available
- detailed rent notes, fees, pet policies, review snapshots, and deal caveats
- per-property audit labels for official observations, conflicting sources, and limited public data
- relative starting-rent labels based on the same directory, with price-basis caveats
- GBI county-level reported-crime context with an explicit no-property-rating caveat
- locally saved favorites

## Daily monitoring and refresh

`.github/workflows/pages.yml` runs every morning and on every push. It checks each configured primary pricing/source URL, records blocked and unparsed sources separately, expires dated promotions, hides undated offers after seven days unless they are reconfirmed, saves generic price findings only as review candidates, validates the directory, builds the static site, and redeploys GitHub Pages. Scheduled/manual runs also commit the latest status snapshot so a later blocked check cannot roll the data backward.

If a source blocks automation or changes format, the site keeps the last successful observation, says that the current check was blocked/unparsed, and continues to link to the official page. The leasing office remains the final authority for price, availability, eligibility, and fees.

The September 4, 2026 manual audit rechecked every displayed community record against its official property/management pages and the specifically linked review source. It is a dated audit, not a permanent guarantee: dynamic rents, available units, fees, promotions, and review counts can change immediately, and the site labels source conflicts instead of silently choosing one as certain.

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
- `npm run build:pages` creates the static GitHub Pages artifact, all 46 detail routes, and a sitemap in `pages-dist/`.
- `npm run refresh:data` performs the same best-effort configured-source monitoring and route refresh used by the daily workflow.
- `npm run validate:data` rejects duplicate communities, invalid prices, missing source links, and anything outside the 40-minute ceiling.

## Data principles

- Commute ranges use a refreshed OSRM/OpenStreetMap no-traffic route plus a 30% planning buffer. They are not stored Google traffic data, and every listing links to a fresh Google Maps route.
- Affordability is relative to the current shortlist; it does not determine personal affordability or leasing eligibility.
- Crime figures are county/jurisdiction context, never a property safety grade. No location can be guaranteed safe.
- Review ratings are dated snapshots with live source links.
- Property photos remain hosted by and attributed to official property or management sites, with direct links to their complete galleries.
- This is a broad community directory, not a licensed feed guaranteed to contain every individual available unit or private rental.
