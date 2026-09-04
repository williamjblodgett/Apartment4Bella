"use client";

import { useEffect, useMemo, useState } from "react";
import rawData from "./apartments.json";
import expandedData from "./apartments-expanded.json";

type Price = { min: number | null; max: number | null; note: string; observedAt?: string };
type Review = { rating: number | null; count: number; source: string; url: string; observedAt?: string };
type SortKey = "drive" | "price" | "rating" | "reviews" | "deals";
type Apartment = {
  id: string;
  name: string;
  city: string;
  county: "Cherokee" | "Cobb";
  eligibility?: string;
  address: string;
  lat: number;
  lng: number;
  distanceMiles: number;
  driveMin: number;
  driveMax: number;
  commuteNote: string;
  oneBed: Price;
  twoBed: Price;
  priceBasis: string;
  priceSource: string;
  deal: string | null;
  dealDetail: string;
  dealExpires: string | null;
  amenities: string[];
  security: string[];
  petCost: string;
  fees: string[];
  review: Review;
  officialUrl: string;
  pricingUrl: string;
  amenitiesUrl: string;
  imageUrl: string | null;
  imageSource: string;
  priceConfidence: "official" | "snapshot" | "conflict";
  verifiedAt: string;
  lastSourceCheck?: string;
  sourceCheckStatus?: "verified" | "reachable_unparsed" | "blocked" | "error" | "reachable" | "unreachable";
};

const apartments = [...rawData.apartments, ...expandedData.apartments] as Apartment[];
const school = rawData.meta.school;
const crimeContext = rawData.meta.crimeContext;
const sourceCheckDate = rawData.meta.checkedAt.slice(0, 10);
const automation = rawData.meta.automation;
const closeCount = apartments.filter((apartment) => apartment.driveMax <= 15).length;

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const priceRange = (price: Price) => {
  if (price.min === null) return "Not offered";
  return price.max && price.max !== price.min ? `${money(price.min)}–${money(price.max)}` : `${money(price.min)}+`;
};

const directionsUrl = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(address)}&destination=${encodeURIComponent(school.address)}&travelmode=driving`;

const locationUrl = (address: string) =>
  `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));

function priceFor(apartment: Apartment, bedrooms: string) {
  if (bedrooms === "2") return apartment.twoBed.min ?? Number.POSITIVE_INFINITY;
  if (bedrooms === "1") return apartment.oneBed.min ?? Number.POSITIVE_INFINITY;
  const eligible = [apartment.oneBed.min, apartment.twoBed.min].filter((value): value is number => value !== null);
  return eligible.length ? Math.min(...eligible) : Number.POSITIVE_INFINITY;
}

function affordabilityScore(apartment: Apartment, bedrooms: string) {
  const values = apartments.map((item) => priceFor(item, bedrooms)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length || !Number.isFinite(priceFor(apartment, bedrooms))) return 0;
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return Math.round(Math.max(0, Math.min(100, 150 - (100 * priceFor(apartment, bedrooms)) / median)));
}

function affordabilityLabel(score: number) {
  if (score >= 80) return "Much lower cost";
  if (score >= 60) return "Lower cost";
  if (score >= 40) return "Near shortlist median";
  if (score >= 20) return "Higher cost";
  return "Much higher cost";
}

function mapPosition(item: { lat: number; lng: number }) {
  const bounds = { north: 34.36, south: 33.97, east: -84.40, west: -84.78 };
  return {
    left: `${Math.max(4, Math.min(96, ((item.lng - bounds.west) / (bounds.east - bounds.west)) * 100))}%`,
    top: `${Math.max(5, Math.min(94, ((bounds.north - item.lat) / (bounds.north - bounds.south)) * 100))}%`,
  };
}

function confidenceCopy(value: Apartment["priceConfidence"]) {
  if (value === "official") return "Official-site price snapshot";
  if (value === "conflict") return "Sources differ—verify";
  return "Recent price snapshot";
}

function hasCurrentDeal(apartment: Apartment) {
  if (!apartment.deal || apartment.deal.toLowerCase().startsWith("ask")) return false;
  return !apartment.dealExpires || apartment.dealExpires >= sourceCheckDate;
}

function sourceStatusCopy(apartment: Apartment) {
  const checkDate = apartment.lastSourceCheck ? formatDate(apartment.lastSourceCheck) : "not yet checked";
  const observed = apartment.oneBed.observedAt || apartment.twoBed.observedAt || apartment.verifiedAt;
  const observedDate = formatDate(observed);
  if (apartment.sourceCheckStatus === "verified") return `Price read ${checkDate}`;
  if (apartment.sourceCheckStatus === "reachable_unparsed" || apartment.sourceCheckStatus === "reachable") {
    return `Page reached ${checkDate} · price snapshot ${observedDate}`;
  }
  if (apartment.sourceCheckStatus === "blocked" || apartment.sourceCheckStatus === "unreachable") {
    return `Check blocked ${checkDate} · price snapshot ${observedDate}`;
  }
  if (apartment.sourceCheckStatus === "error") return `Check failed ${checkDate} · price snapshot ${observedDate}`;
  return `Price snapshot ${observedDate}`;
}

function compareApartments(a: Apartment, b: Apartment, sort: SortKey, bedrooms: string) {
  const commuteTieBreak = () => a.driveMax - b.driveMax || a.driveMin - b.driveMin || a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name);
  if (sort === "price") return priceFor(a, bedrooms) - priceFor(b, bedrooms) || commuteTieBreak();
  if (sort === "rating") return (b.review.rating ?? -1) - (a.review.rating ?? -1) || b.review.count - a.review.count || commuteTieBreak();
  if (sort === "reviews") return b.review.count - a.review.count || (b.review.rating ?? -1) - (a.review.rating ?? -1) || commuteTieBreak();
  if (sort === "deals") return Number(hasCurrentDeal(b)) - Number(hasCurrentDeal(a)) || commuteTieBreak();
  return commuteTieBreak();
}

export default function Home() {
  const [maxDrive, setMaxDrive] = useState(40);
  const [bedrooms, setBedrooms] = useState("either");
  const [maxRent, setMaxRent] = useState("any");
  const [sort, setSort] = useState<SortKey>("drive");
  const [query, setQuery] = useState("");
  const [dealsOnly, setDealsOnly] = useState(false);
  const [securityOnly, setSecurityOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState(apartments[0].id);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("bella-saved-apartments");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) setSaved(parsed);
      }
    } catch {
      // Blocked browser storage should never stop the search experience.
    }
  }, []);

  const toggleSaved = (id: string) => {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try { window.localStorage.setItem("bella-saved-apartments", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return apartments
      .filter((apartment) => apartment.driveMax <= maxDrive)
      .filter((apartment) => Number.isFinite(priceFor(apartment, bedrooms)))
      .filter((apartment) => maxRent === "any" || priceFor(apartment, bedrooms) <= Number(maxRent))
      .filter((apartment) => !dealsOnly || hasCurrentDeal(apartment))
      .filter((apartment) => !securityOnly || apartment.security.some((item) => /gated|controlled|key-fob|smart-entry/i.test(item)))
      .filter((apartment) => !normalized || [apartment.name, apartment.city, apartment.address, ...apartment.amenities].join(" ").toLowerCase().includes(normalized))
      .sort((a, b) => compareApartments(a, b, sort, bedrooms));
  }, [bedrooms, dealsOnly, maxDrive, maxRent, query, securityOnly, sort]);

  useEffect(() => {
    if (matches.length && !matches.some((item) => item.id === selected)) setSelected(matches[0].id);
  }, [matches, selected]);

  const selectedApartment = matches.find((item) => item.id === selected) ?? matches[0];
  const cheapest = matches.length ? Math.min(...matches.map((item) => priceFor(item, bedrooms))) : null;
  const dealCount = matches.filter(hasCurrentDeal).length;

  const resetFilters = () => {
    setMaxDrive(40);
    setBedrooms("either");
    setMaxRent("any");
    setDealsOnly(false);
    setSecurityOnly(false);
    setQuery("");
    setSort("drive");
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Bella's apartment finder home">
          <span className="brand-mark">B</span>
          <span>Bella&apos;s Home Base</span>
        </a>
        <nav className="header-nav" aria-label="Main navigation">
          <a href="#matches">Apartments</a>
          <a href="#how-it-works">How scores work</a>
          <a href="#sources">Sources</a>
        </nav>
        <div className="header-meta">
          <span className={`live-dot ${automation.reachable < automation.checked ? "partial" : ""}`} aria-hidden="true" />
          Daily check {formatDate(sourceCheckDate)} · {automation.reachable}/{automation.checked} pages reached
          <a className="saved-button" href={saved.length ? "#saved" : "#matches"}>♥ Saved <span>{saved.length}</span></a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">APARTMENTS NEAR SIXES ELEMENTARY · CANTON, GA</div>
          <h1>Closer to school.<br /><em>Clearer on cost.</em></h1>
          <p>A researched shortlist of 1–2 bedroom apartments within a conservative 40-minute drive—organized by commute, rent, perks, reviews, and honest area context.</p>
          <div className="hero-proof">
            <span><b>{apartments.length}</b> communities researched</span>
            <span><b>{closeCount}</b> within ~15 minutes</span>
            <span><b>{automation.reachable}/{automation.checked}</b> official pages reached in the latest daily check</span>
          </div>
        </div>

        <div className={`filter-panel ${filtersOpen ? "open" : ""}`} aria-label="Apartment filters">
          <button className="mobile-filter-toggle" type="button" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}>
            Search filters <span>{filtersOpen ? "−" : "+"}</span>
          </button>
          <div className="filter-grid">
            <label>
              <span>MAX DRIVE</span>
              <select value={maxDrive} onChange={(event) => setMaxDrive(Number(event.target.value))}>
                <option value="10">10 minutes</option><option value="15">15 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="40">40 minutes</option>
              </select>
            </label>
            <label>
              <span>BEDROOMS</span>
              <select value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}>
                <option value="either">1 or 2 bedrooms</option><option value="1">1 bedroom</option><option value="2">2 bedrooms</option>
              </select>
            </label>
            <label>
              <span>MAX ADVERTISED STARTING RENT</span>
              <select value={maxRent} onChange={(event) => setMaxRent(event.target.value)}>
                <option value="any">Any listed price</option><option value="1400">Up to $1,400</option><option value="1600">Up to $1,600</option><option value="1800">Up to $1,800</option><option value="2000">Up to $2,000</option><option value="2200">Up to $2,200</option>
              </select>
            </label>
            <label className="keyword-field">
              <span>NAME, CITY, OR PERK</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “dog park” or Woodstock" />
            </label>
          </div>
          <div className="filter-bottom">
            <label className="check-filter"><input type="checkbox" checked={dealsOnly} onChange={(event) => setDealsOnly(event.target.checked)} /> <span>Current deals only</span></label>
            <label className="check-filter"><input type="checkbox" checked={securityOnly} onChange={(event) => setSecurityOnly(event.target.checked)} /> <span>Controlled/gated entry</span></label>
            <button type="button" onClick={resetFilters} className="reset-button">Reset all</button>
            <a href="#matches" className="find-button">See {matches.length} matches <span>↓</span></a>
          </div>
        </div>
      </section>

      <section className="snapshot-bar" aria-label="Current search summary">
        <div><span>RESULTS</span><strong>{matches.length}</strong><small>inside the selected drive</small></div>
        <div><span>LOWEST LISTED</span><strong>{cheapest ? `${money(cheapest)}+` : "—"}</strong><small>{bedrooms === "2" ? "2 bedroom" : bedrooms === "1" ? "1 bedroom" : "eligible floor plan"}</small></div>
        <div><span>CURRENT DEALS</span><strong>{dealCount}</strong><small>always confirm eligibility</small></div>
        <div className="snapshot-note"><b>Commutes are conservative estimates.</b><small>Use each card’s live-directions link at the actual weekday time.</small></div>
      </section>

      <section className="coverage-banner" aria-label="Directory coverage">
        <span>SECOND-PASS COVERAGE</span>
        <div><strong>A broad community directory—not every active rental unit.</strong><p>It covers researched apartment communities with public 1–2 bedroom information inside the 40-minute screen. Private rentals, newly posted units, and properties without public data can still be missing.</p></div>
        <a href="#sources">See the accuracy rules ↓</a>
      </section>

      <section className="results-shell" id="matches">
        <div className="results-heading">
          <div><span className="section-kicker">A SHORTER SHORTLIST</span><h2>Best nearby matches</h2></div>
          <div className="sort-control" aria-label="Sort apartment results">
            <span>SORT RESULTS</span>
            <div className="sort-buttons" role="group">
              {([
                ["drive", "Closest"],
                ["price", bedrooms === "1" ? "Lowest 1BR" : bedrooms === "2" ? "Lowest 2BR" : "Lowest rent"],
                ["rating", "Highest stars"],
                ["reviews", "Most reviewed"],
                ["deals", "Deals first"],
              ] as [SortKey, string][]).map(([value, label]) => (
                <button key={value} type="button" className={sort === value ? "active" : ""} aria-pressed={sort === value} onClick={() => { setSort(value); setSelected(""); }}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="results-layout">
          <div className="cards" aria-live="polite">
            {matches.length ? matches.map((apartment, index) => {
              const valueScore = affordabilityScore(apartment, bedrooms);
              const isSaved = saved.includes(apartment.id);
              const isSelected = selected === apartment.id;
              const countyRate = apartment.county === "Cherokee" ? crimeContext.cherokeeRate : crimeContext.cobbRate;
              return (
                <article className={`home-card ${isSelected ? "selected" : ""}`} key={apartment.id} onMouseEnter={() => setSelected(apartment.id)}>
                  <figure className="property-photo" onClick={() => setSelected(apartment.id)}>
                    <span className="photo-fallback" aria-hidden="true">{apartment.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</span>
                    {apartment.imageUrl && <img src={apartment.imageUrl} alt={`${apartment.name} property photograph`} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                    <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                    {index === 0 && sort === "drive" && <span className="best-badge">CLOSEST MATCH</span>}
                    <a className="photo-credit" href={apartment.imageUrl ? apartment.officialUrl : apartment.amenitiesUrl} target="_blank" rel="noreferrer">{apartment.imageUrl ? "Photo: property site" : "Open official gallery"} ↗</a>
                  </figure>

                  <div className="card-copy">
                    <div className="card-topline">
                      <span>{apartment.city}, GA · {apartment.distanceMiles.toFixed(1)} mi</span>
                      <button className={isSaved ? "favorite active" : "favorite"} aria-label={`${isSaved ? "Remove" : "Save"} ${apartment.name}`} aria-pressed={isSaved} onClick={() => toggleSaved(apartment.id)}>{isSaved ? "♥" : "♡"}</button>
                    </div>
                    <h3><button type="button" onClick={() => setSelected(apartment.id)}>{apartment.name}</button></h3>
                    <p className="address">{apartment.address}</p>

                    <div className="primary-facts">
                      <div className="commute-fact"><span>EST. DRIVE</span><strong>{apartment.driveMin}–{apartment.driveMax} min</strong><small>to Sixes Elementary</small></div>
                      <div><span>1 BEDROOM</span><strong>{priceRange(apartment.oneBed)}</strong><small>{apartment.priceBasis}</small></div>
                      <div><span>2 BEDROOM</span><strong>{priceRange(apartment.twoBed)}</strong><small>{apartment.priceBasis}</small></div>
                    </div>

                    <div className="signal-row">
                      {hasCurrentDeal(apartment) ? <span className="deal">✦ {apartment.deal}</span> : <span className="no-deal">No current broad deal verified</span>}
                      {apartment.eligibility && <span className="eligibility-badge">{apartment.eligibility}</span>}
                      <span className={`confidence ${apartment.priceConfidence}`}>{confidenceCopy(apartment.priceConfidence)}</span>
                    </div>

                    <div className="tags">{apartment.amenities.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>

                    <div className="score-row">
                      <div className="value-score"><b>{valueScore}</b><span><strong>{affordabilityLabel(valueScore)}</strong>Starting-rent affordability</span></div>
                      <a className="review-score" href={apartment.review.url} target="_blank" rel="noreferrer">
                        <b>{apartment.review.rating !== null ? `${apartment.review.rating.toFixed(1)} ★` : "N/A"}</b>
                        <span>{apartment.review.count ? `${apartment.review.count} reviews · ${apartment.review.source.replace(" snapshot", "")}` : "No current review rating"}</span>
                      </a>
                      <button className="details-link" type="button" onClick={() => {
                        const details = document.getElementById(`details-${apartment.id}`) as HTMLDetailsElement | null;
                        if (details) { details.open = true; details.scrollIntoView({ behavior: "smooth", block: "center" }); }
                      }}>Full details ↓</button>
                    </div>

                    <details className="detail-drawer" id={`details-${apartment.id}`}>
                      <summary>Costs, perks, reviews & area context</summary>
                      <div className="detail-grid">
                        <div>
                          <h4>What the rent means</h4>
                          <p><b>1BR:</b> {apartment.oneBed.note}</p>
                          <p><b>2BR:</b> {apartment.twoBed.note}</p>
                          <p><b>Drive:</b> {apartment.commuteNote}</p>
                          <p className="source-line">Source: <a href={apartment.pricingUrl} target="_blank" rel="noreferrer">{apartment.priceSource} ↗</a></p>
                        </div>
                        <div>
                          <h4>Deal details</h4>
                          <p>{apartment.dealDetail}</p>
                          {apartment.dealExpires && <p className="expiry">Listed end date: {formatDate(apartment.dealExpires)}</p>}
                        </div>
                        <div>
                          <h4>Fees & pets found</h4>
                          <ul>{apartment.fees.map((fee) => <li key={fee}>{fee}</li>)}</ul>
                          <p>{apartment.petCost}</p>
                          {apartment.eligibility && <p><b>Eligibility:</b> {apartment.eligibility}</p>}
                        </div>
                        <div>
                          <h4>Reported-crime context</h4>
                          <p className="crime-number"><b>{countyRate}</b> <span>per 1,000</span></p>
                          <p>{apartment.county} County’s {crimeContext.period} GBI reported Index Crime rate. This is county-level context—not a property safety rating.</p>
                          <a href={crimeContext.sourceUrl} target="_blank" rel="noreferrer">Open GBI source ↗</a>
                        </div>
                        <div className="wide-detail">
                          <h4>Property-reported access & security features</h4>
                          <div className="security-list">{apartment.security.map((item) => <span key={item}>✓ {item}</span>)}</div>
                          <p className="tiny-note">Features are property-reported and unverified. Ask to see lighting, entries, locks, parking, and emergency procedures during a tour.</p>
                        </div>
                        <div className="wide-detail">
                          <h4>All highlighted perks</h4>
                          <div className="security-list amenities-list">{apartment.amenities.map((item) => <span key={item}>{item}</span>)}</div>
                        </div>
                      </div>
                    </details>

                    <div className="card-actions">
                      <a className="primary-link" href={apartment.officialUrl} target="_blank" rel="noreferrer">Visit official site ↗</a>
                      <a href={directionsUrl(apartment.address)} target="_blank" rel="noreferrer">Check live drive ↗</a>
                      <a href={apartment.amenitiesUrl} target="_blank" rel="noreferrer">All amenities ↗</a>
                      <span>{sourceStatusCopy(apartment)}</span>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="empty-state">
                <span>0</span><h3>No exact matches yet.</h3><p>Try a higher rent ceiling, a longer drive, or remove one of the extra filters.</p><button type="button" onClick={resetFilters}>Reset filters</button>
              </div>
            )}
          </div>

          <aside className="map-card" aria-label="Apartment location overview">
            <div className="map-toolbar"><div><span>LOCATION OVERVIEW</span><b>{matches.length} plotted</b></div><a href={locationUrl(school.address)} target="_blank" rel="noreferrer">Open full map ↗</a></div>
            <div className="map-surface">
              <div className="map-grid" aria-hidden="true" />
              <div className="road road-one" aria-hidden="true" /><div className="road road-two" aria-hidden="true" /><div className="road road-three" aria-hidden="true" />
              <span className="map-label canton">CANTON</span><span className="map-label woodstock">WOODSTOCK</span><span className="map-label acworth">ACWORTH</span>
              <span className="school-pin" style={mapPosition(school)} aria-label="Sixes Elementary School">★<small>Sixes<br />Elementary</small></span>
              {matches.map((apartment, index) => (
                <button key={apartment.id} type="button" className={`map-pin ${selected === apartment.id ? "active" : ""}`} style={mapPosition(apartment)} onClick={() => setSelected(apartment.id)} aria-label={`Select ${apartment.name}`}>{index + 1}</button>
              ))}
              {selectedApartment && <div className="map-note"><span>{selectedApartment.city} · {selectedApartment.distanceMiles.toFixed(1)} mi</span><b>{selectedApartment.name}</b><small>{selectedApartment.driveMin}–{selectedApartment.driveMax} min estimated</small><a href={directionsUrl(selectedApartment.address)} target="_blank" rel="noreferrer">Live directions ↗</a></div>}
            </div>
            <p className="map-disclaimer">Pins use geocoded addresses; roads are simplified. Drive ranges are static estimates without live traffic.</p>
          </aside>
        </div>
      </section>

      {saved.length > 0 && (
        <section className="saved-strip" id="saved">
          <div><span className="section-kicker">BELLA&apos;S SAVED LIST</span><h2>{saved.length} place{saved.length === 1 ? "" : "s"} worth a closer look</h2></div>
          <div className="saved-names">{saved.map((id) => { const item = apartments.find((apartment) => apartment.id === id); return item ? <a href={`#details-${id}`} key={id}>{item.name}</a> : null; })}</div>
        </section>
      )}

      <section className="methodology" id="how-it-works">
        <div className="method-intro">
          <span className="section-kicker">READ THE SIGNALS, NOT THE HYPE</span>
          <h2>What the scores actually mean</h2>
          <p>The goal is a useful comparison—not false precision. Every signal is labeled by source and scope so Bella can decide what matters to her.</p>
        </div>
        <div className="method-grid">
          <article><span>01</span><h3>Drive range</h3><p>A conservative static route range to Sixes Elementary. It is a first-pass filter, not a traffic promise. Every card opens a live Google Maps route.</p></article>
          <article><span>02</span><h3>Starting-rent affordability</h3><p>Compares the lowest eligible advertised starting price with the median of the full {apartments.length}-community directory. Fee disclosures and price bases differ, so this is a first-pass signal—not a complete effective-rent or personal-affordability test.</p></article>
          <article><span>03</span><h3>Review snapshot</h3><p>A dated third-party rating and count, linked to the live review page. A high score with very few reviews is shown as such—never treated like a certainty.</p></article>
          <article><span>04</span><h3>Reported-crime context</h3><p>GBI county data shown consistently for context. It cannot measure a property, block, or personal risk. Security features are listed separately for tour verification.</p></article>
        </div>
      </section>

      <section className="safety-callout">
        <div className="callout-mark">i</div>
        <div><h2>Why there isn’t a “safe / unsafe” grade</h2><p>Reported-crime data describe a law-enforcement jurisdiction, not an apartment or personal risk. Not every incident is reported, agencies can revise submissions, and no location can be guaranteed safe. Comparing places as a league table can also be misleading.</p></div>
        <a href={crimeContext.cautionUrl} target="_blank" rel="noreferrer">Read the FBI caution ↗</a>
      </section>

      <section className="sources" id="sources">
        <div><span className="section-kicker">FRESHNESS & SOURCES</span><h2>Built to be checked, not blindly trusted.</h2></div>
        <div className="source-columns">
          <div><h3>Daily apartment check</h3><p>The GitHub workflow attempts every official pricing page each morning, records which pages were reached or blocked, preserves the last curated price, and republishes the site. Generic price hints are queued for review rather than automatically replacing trusted rents.</p></div>
          <div><h3>Official links stay primary</h3><p>Every community links directly to its property, pricing, amenity, photo, and live-directions pages. Call the leasing office before paying any fee or relying on a concession.</p></div>
          <div><h3>Coverage & reviews</h3><p>This is a researched community directory, not a guaranteed feed of every individual unit. Stable official-site images are embedded; otherwise the card links to the property gallery. Ratings are dated snapshots with direct review links.</p></div>
        </div>
        <div className="source-list">
          <a href="https://gbi.georgia.gov/services/crime-statistics" target="_blank" rel="noreferrer">GBI crime statistics ↗</a>
          <a href="https://www.huduser.gov/portal/ongoing/Fair-Market-Rents.html" target="_blank" rel="noreferrer">HUD rent benchmarks ↗</a>
          <a href="https://gis.cherokeecountyga.gov/arcgis/rest/services/CherokeeCountyBasemap/MapServer/68" target="_blank" rel="noreferrer">Cherokee municipal boundaries ↗</a>
          <a href="https://github.com/williamjblodgett/Apartment4Bella" target="_blank" rel="noreferrer">Site data & update history ↗</a>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark">B</span><span>Bella&apos;s Home Base</span></a>
        <p>Made for a smarter apartment hunt around Sixes Elementary.</p>
        <p className="footer-fine">Directory curated {formatDate(rawData.meta.curatedAt || sourceCheckDate)} · Equal-housing-minded, source-forward comparisons.</p>
      </footer>
    </main>
  );
}
