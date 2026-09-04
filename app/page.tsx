"use client";

import { useMemo, useState } from "react";
import rawData from "./apartments.json";
import expandedData from "./apartments-expanded.json";

type Price = { min: number | null; max: number | null; note: string; observedAt?: string };
type Review = { rating: number | null; count: number | null; source: string; url: string | null; observedAt?: string };
type GalleryImage = { url: string; sourceUrl: string; alt: string };
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
  routeObservedAt?: string;
  routeSource?: string;
  routeSourceUrl?: string;
  withinDriveLimit?: boolean;
  oneBed: Price;
  twoBed: Price;
  priceBasis: string;
  priceSource: string;
  deal: string | null;
  dealDetail: string;
  dealExpires: string | null;
  dealLastSeenAt?: string;
  dealStatus?: "confirmed" | "candidate_mismatch" | "needs_review" | "expired";
  amenities: string[];
  security: string[];
  petCost: string;
  fees: string[];
  review: Review;
  officialUrl: string;
  pricingUrl: string;
  amenitiesUrl: string;
  galleryUrl?: string;
  imageUrl: string | null;
  imageSource: string;
  galleryImages?: GalleryImage[];
  priceConfidence: "official" | "snapshot" | "conflict";
  verifiedAt: string;
  lastSourceCheck?: string;
  sourceCheckStatus?: "verified" | "reachable_unparsed" | "blocked" | "error" | "reachable" | "unreachable";
  auditedAt?: string;
  auditStatus?: "official" | "source_conflict" | "limited_public_data";
  auditNote?: string;
};

const allApartments = [...rawData.apartments, ...expandedData.apartments] as Apartment[];
const apartments = allApartments.filter((apartment) => apartment.withinDriveLimit !== false && apartment.driveMax <= 40);
const school = rawData.meta.school;
const crimeContext = rawData.meta.crimeContext;
const sourceCheckDate = rawData.meta.checkedAt.slice(0, 10);
const automation = rawData.meta.automation;
const manualAudit = (rawData.meta as typeof rawData.meta & {
  manualAudit?: { completedAt: string; communitiesReviewed: number; scope: string; limitation: string };
}).manualAudit;
const closeCount = apartments.filter((apartment) => apartment.driveMax <= 15).length;
const conflictCount = apartments.filter((apartment) => apartment.auditStatus === "source_conflict").length;
const limitedDataCount = apartments.filter((apartment) => apartment.auditStatus === "limited_public_data").length;

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const priceRange = (price: Price) => {
  if (price.min === null) return /not offered|no 1br product/i.test(price.note) ? "Not offered" : "No public price";
  if (price.max === price.min) return money(price.min);
  return price.max !== null ? `${money(price.min)}–${money(price.max)}` : `${money(price.min)}+`;
};

const directionsUrl = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(address)}&destination=${encodeURIComponent(school.address)}&travelmode=driving`;

const locationUrl = (address: string) =>
  `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));

function siteBasePath() {
  if (typeof window === "undefined") return "/";
  const marker = "/apartments/";
  const markerIndex = window.location.pathname.lastIndexOf(marker);
  if (markerIndex >= 0) return window.location.pathname.slice(0, markerIndex + 1);
  return window.location.pathname.endsWith("/") ? window.location.pathname : `${window.location.pathname}/`;
}

const detailPageUrl = (id: string) => `${siteBasePath()}apartments/${encodeURIComponent(id)}/`;
const directoryUrl = () => siteBasePath();

function apartmentIdFromLocation() {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/\/apartments\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

const apartmentInitials = (name: string) => name.split(" ").map((word) => word[0]).slice(0, 2).join("");

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
  if (["candidate_mismatch", "needs_review", "expired"].includes(apartment.dealStatus ?? "")) return false;
  if (apartment.dealExpires) return apartment.dealExpires >= sourceCheckDate;
  const lastSeen = apartment.dealLastSeenAt || apartment.auditedAt || apartment.verifiedAt;
  const ageDays = (new Date(`${sourceCheckDate}T12:00:00Z`).getTime() - new Date(`${lastSeen}T12:00:00Z`).getTime()) / 86_400_000;
  return ageDays <= 7;
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

function auditStatusCopy(apartment: Apartment) {
  if (!apartment.auditedAt) return null;
  const date = formatDate(apartment.auditedAt);
  if (apartment.auditStatus === "source_conflict") return `Manually rechecked ${date} · sources differ`;
  if (apartment.auditStatus === "limited_public_data") return `Manually rechecked ${date} · limited public data`;
  return `Manually rechecked ${date}`;
}

function compareApartments(a: Apartment, b: Apartment, sort: SortKey, bedrooms: string) {
  const commuteTieBreak = () => a.driveMax - b.driveMax || a.driveMin - b.driveMin || a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name);
  if (sort === "price") return priceFor(a, bedrooms) - priceFor(b, bedrooms) || commuteTieBreak();
  if (sort === "rating") return (b.review.rating ?? -1) - (a.review.rating ?? -1) || (b.review.count ?? 0) - (a.review.count ?? 0) || commuteTieBreak();
  if (sort === "reviews") return (b.review.count ?? 0) - (a.review.count ?? 0) || (b.review.rating ?? -1) - (a.review.rating ?? -1) || commuteTieBreak();
  if (sort === "deals") return Number(hasCurrentDeal(b)) - Number(hasCurrentDeal(a)) || commuteTieBreak();
  return commuteTieBreak();
}

function ApartmentDetail({ apartment, isSaved, onToggleSaved }: { apartment: Apartment; isSaved: boolean; onToggleSaved: () => void }) {
  const countyRate = apartment.county === "Cherokee" ? crimeContext.cherokeeRate : crimeContext.cobbRate;
  const valueScore = affordabilityScore(apartment, "either");
  const galleryImages = apartment.galleryImages?.length
    ? apartment.galleryImages
    : apartment.imageUrl
      ? [{ url: apartment.imageUrl, sourceUrl: apartment.officialUrl, alt: `${apartment.name} property photograph` }]
      : [];
  const nearby = apartments
    .filter((item) => item.id !== apartment.id)
    .sort((a, b) => Math.abs(a.driveMax - apartment.driveMax) - Math.abs(b.driveMax - apartment.driveMax) || a.driveMax - b.driveMax)
    .slice(0, 3);
  const description = `${apartment.name} is a ${apartment.city} rental community approximately ${apartment.driveMin}–${apartment.driveMax} minutes from Sixes Elementary. Highlights include ${apartment.amenities.slice(0, 3).join(", ")}.`;
  const photoPageUrl = apartment.galleryUrl || apartment.amenitiesUrl;

  return (
    <main className="property-page">
      <header className="site-header detail-site-header">
        <a className="brand" href={directoryUrl()} aria-label="Back to Bella's apartment finder">
          <span className="brand-mark">B</span>
          <span>Bella&apos;s Home Base</span>
        </a>
        <nav className="header-nav" aria-label="Property navigation">
          <a href={`${directoryUrl()}#matches`}>All apartments</a>
          <a href={apartment.pricingUrl} target="_blank" rel="noreferrer">Live pricing ↗</a>
          <a href={photoPageUrl} target="_blank" rel="noreferrer">Official photos ↗</a>
        </nav>
        <a className="back-to-results" href={`${directoryUrl()}#matches`}>← Back to results</a>
      </header>

      <article className="property-detail">
        <div className="detail-breadcrumb"><a href={directoryUrl()}>Home</a><span>/</span><a href={`${directoryUrl()}#matches`}>Apartments</a><span>/</span><b>{apartment.name}</b></div>

        <section className="property-detail-hero">
          <div className={`detail-gallery ${galleryImages.length > 1 ? "has-multiple" : ""}`}>
            {galleryImages.length ? galleryImages.slice(0, 3).map((image, index) => (
              <a className={index === 0 ? "gallery-primary" : "gallery-secondary"} href={image.sourceUrl} target="_blank" rel="noreferrer" key={image.url}>
                <img src={image.url} alt={image.alt} onError={(event) => { event.currentTarget.style.display = "none"; }} />
                {index === 0 && <span>Photo: {apartment.imageSource}</span>}
              </a>
            )) : (
              <div className="gallery-fallback">
                <b aria-hidden="true">{apartmentInitials(apartment.name)}</b>
                <span>Property photos are available on the official gallery.</span>
              </div>
            )}
            <a className="open-gallery-button" href={photoPageUrl} target="_blank" rel="noreferrer">View official photos ↗</a>
          </div>

          <div className="property-hero-copy">
            <span className="section-kicker">{apartment.city}, GEORGIA · {apartment.distanceMiles.toFixed(1)} MILES FROM SCHOOL</span>
            <h1>{apartment.name}</h1>
            <p className="property-lede">{description}</p>
            <a className="property-address" href={locationUrl(apartment.address)} target="_blank" rel="noreferrer">{apartment.address} ↗</a>

            <div className="detail-fact-grid">
              <div className="detail-commute"><span>EST. DRIVE</span><strong>{apartment.driveMin}–{apartment.driveMax} min</strong><small>to Sixes Elementary</small></div>
              <div><span>1 BEDROOM</span><strong>{priceRange(apartment.oneBed)}</strong><small>{apartment.priceBasis}</small></div>
              <div><span>2 BEDROOM</span><strong>{priceRange(apartment.twoBed)}</strong><small>{apartment.priceBasis}</small></div>
              {apartment.review.url ? <a href={apartment.review.url} target="_blank" rel="noreferrer"><span>RESIDENT REVIEWS</span><strong>{apartment.review.rating !== null ? `${apartment.review.rating.toFixed(1)} ★` : "Not rated"}</strong><small>{apartment.review.count ? `${apartment.review.count} on ${apartment.review.source.replace(" snapshot", "")}` : "Open review source"}</small></a> : <div><span>RESIDENT REVIEWS</span><strong>Unavailable</strong><small>No live review source</small></div>}
            </div>

            <div className="detail-signals">
              {hasCurrentDeal(apartment) ? <span className="deal">✦ {apartment.deal}</span> : <span className="no-deal">No current broad deal verified</span>}
              {apartment.eligibility && <span className="eligibility-badge">{apartment.eligibility}</span>}
              <span className={`confidence ${apartment.priceConfidence}`}>{confidenceCopy(apartment.priceConfidence)}</span>
            </div>

            <div className="detail-primary-actions">
              <a className="detail-main-action" href={apartment.officialUrl} target="_blank" rel="noreferrer">Visit official website ↗</a>
              <a href={directionsUrl(apartment.address)} target="_blank" rel="noreferrer">Check live drive ↗</a>
              <button type="button" className={isSaved ? "detail-save active" : "detail-save"} onClick={onToggleSaved}>{isSaved ? "♥ Saved" : "♡ Save this place"}</button>
            </div>
            <p className="detail-freshness">{auditStatusCopy(apartment)} · {sourceStatusCopy(apartment)} · Always confirm the final quote with the leasing office.</p>
            {apartment.auditNote && <p className="detail-freshness">{apartment.auditNote}</p>}
          </div>
        </section>

        <section className="property-content-grid">
          <div className="property-main-column">
            <section className="detail-section">
              <span className="section-kicker">PRICE PICTURE</span>
              <h2>Costs and availability</h2>
              <div className="bedroom-detail-grid">
                <article><span>ONE BEDROOM</span><strong>{priceRange(apartment.oneBed)}</strong><p>{apartment.oneBed.note}</p></article>
                <article><span>TWO BEDROOM</span><strong>{priceRange(apartment.twoBed)}</strong><p>{apartment.twoBed.note}</p></article>
              </div>
              <div className="affordability-detail"><b>REL.</b><div><strong>{affordabilityLabel(valueScore)}</strong><span>Starting-rent comparison within this researched directory—not a complete effective-rent or personal-affordability determination.</span></div></div>
              <p className="source-note">Pricing basis: {apartment.priceBasis}. Source: <a href={apartment.pricingUrl} target="_blank" rel="noreferrer">{apartment.priceSource} ↗</a></p>
            </section>

            <section className="detail-section">
              <span className="section-kicker">WHAT STANDS OUT</span>
              <h2>Perks and amenities</h2>
              <div className="large-tag-list">{apartment.amenities.map((item) => <span key={item}>{item}</span>)}</div>
              <a className="text-link" href={photoPageUrl} target="_blank" rel="noreferrer">See more property photos ↗</a>
            </section>

            <section className="detail-section access-section">
              <span className="section-kicker">VERIFY ON A TOUR</span>
              <h2>Property-reported access features</h2>
              <div className="large-tag-list security-detail-list">{apartment.security.map((item) => <span key={item}>✓ {item}</span>)}</div>
              <p>These features are property-reported and unverified. Ask to see exterior lighting, building entries, locks, parking, package handling, and emergency procedures in person.</p>
            </section>

            <section className="detail-section commute-section">
              <span className="section-kicker">LOCATION</span>
              <h2>The school drive</h2>
              <div className="commute-callout"><b>{apartment.driveMin}–{apartment.driveMax}</b><span>estimated minutes</span></div>
              <p>{apartment.commuteNote}</p>
              <p>The range is a no-traffic baseline plus a 30% planning buffer—not a live-traffic promise. Check the route at the actual weekday school-arrival time before signing a lease.</p>
              {apartment.routeSourceUrl && <p className="source-note">Route source: <a href={apartment.routeSourceUrl} target="_blank" rel="noreferrer">{apartment.routeSource} ↗</a></p>}
              <div className="inline-actions"><a href={directionsUrl(apartment.address)} target="_blank" rel="noreferrer">Open live Google directions ↗</a><a href={locationUrl(apartment.address)} target="_blank" rel="noreferrer">Open location map ↗</a></div>
            </section>
          </div>

          <aside className="property-side-column">
            <section className="tour-card">
              <span className="section-kicker">BEFORE YOU TOUR</span>
              <h2>Useful links</h2>
              <a className="tour-primary" href={apartment.officialUrl} target="_blank" rel="noreferrer">Official property site ↗</a>
              <a href={apartment.pricingUrl} target="_blank" rel="noreferrer">Current floor plans & pricing ↗</a>
              <a href={photoPageUrl} target="_blank" rel="noreferrer">Official photos ↗</a>
              <a href={apartment.amenitiesUrl} target="_blank" rel="noreferrer">Complete amenities ↗</a>
              {apartment.review.url ? <a href={apartment.review.url} target="_blank" rel="noreferrer">Read resident reviews ↗</a> : <span>Live review source unavailable</span>}
              <a href={directionsUrl(apartment.address)} target="_blank" rel="noreferrer">Check live commute ↗</a>
            </section>

            <section className="side-detail-card">
              <h3>Fees found</h3>
              <ul>{apartment.fees.map((fee) => <li key={fee}>{fee}</li>)}</ul>
              <h3>Pet costs and rules</h3>
              <p>{apartment.petCost}</p>
              {apartment.eligibility && <><h3>Eligibility</h3><p>{apartment.eligibility}</p></>}
            </section>

            <section className="side-detail-card deal-detail-card">
              <h3>Deal details</h3>
              <p>{apartment.dealDetail}</p>
              {apartment.dealExpires && <p className="expiry">Listed end date: {formatDate(apartment.dealExpires)}</p>}
            </section>
          </aside>
        </section>

        <section className="crime-context-detail">
          <div><span className="section-kicker">REPORTED-CRIME CONTEXT</span><h2>Area-level information, not a property score</h2></div>
          <p className="crime-number"><b>{countyRate}</b><span>reported Index Crimes per 1,000 residents</span></p>
          <p>{apartment.county} County’s {crimeContext.period} GBI rate describes a law-enforcement jurisdiction—not this apartment or personal risk. Not all incidents are reported, agency data can be incomplete or revised, and no location can be guaranteed safe.</p>
          <a href={crimeContext.sourceUrl} target="_blank" rel="noreferrer">Review the GBI source ↗</a>
        </section>

        <section className="nearby-properties">
          <div><span className="section-kicker">KEEP COMPARING</span><h2>Three nearby alternatives</h2></div>
          <div className="nearby-grid">{nearby.map((item) => (
            <a href={detailPageUrl(item.id)} key={item.id}>
              <div className="nearby-image"><span>{apartmentInitials(item.name)}</span>{item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</div>
              <small>{item.city} · {item.driveMin}–{item.driveMax} min</small>
              <strong>{item.name}</strong>
              <span>From {money(Math.min(...[item.oneBed.min, item.twoBed.min].filter((price): price is number => price !== null)))} · View page →</span>
            </a>
          ))}</div>
        </section>
      </article>

      <footer>
        <a className="brand footer-brand" href={directoryUrl()}><span className="brand-mark">B</span><span>Bella&apos;s Home Base</span></a>
        <p>Compare the facts. Tour the favorites. Verify the final quote.</p>
        <span className="footer-fine">Daily source checks · Public information · {apartments.length} researched communities</span>
      </footer>
    </main>
  );
}

export default function Home() {
  const [maxDrive, setMaxDrive] = useState(40);
  const [bedrooms, setBedrooms] = useState("either");
  const [maxRent, setMaxRent] = useState("any");
  const [sort, setSort] = useState<SortKey>("drive");
  const [query, setQuery] = useState("");
  const [dealsOnly, setDealsOnly] = useState(false);
  const [securityOnly, setSecurityOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("bella-saved-apartments");
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState(apartments[0].id);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailId] = useState<string | null>(() => apartmentIdFromLocation());

  const toggleSaved = (id: string) => {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try { window.localStorage.setItem("bella-saved-apartments", JSON.stringify(next)); } catch { /* Saving is optional when browser storage is blocked. */ }
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

  const effectiveSelected = matches.some((item) => item.id === selected) ? selected : matches[0]?.id;
  const selectedApartment = matches.find((item) => item.id === effectiveSelected) ?? matches[0];
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

  const detailApartment = detailId ? apartments.find((apartment) => apartment.id === detailId) : null;
  if (detailApartment) {
    return <ApartmentDetail apartment={detailApartment} isSaved={saved.includes(detailApartment.id)} onToggleSaved={() => toggleSaved(detailApartment.id)} />;
  }

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
          {manualAudit ? `Manual audit ${formatDate(manualAudit.completedAt)} · ${manualAudit.communitiesReviewed}/${allApartments.length}; daily check ${formatDate(sourceCheckDate)} · ${automation.reachable}/${automation.checked} reached` : `Daily check ${formatDate(sourceCheckDate)} · ${automation.reachable}/${automation.checked} pages reached`}
          <a className="saved-button" href={saved.length ? "#saved" : "#matches"}>♥ Saved <span>{saved.length}</span></a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">APARTMENTS NEAR SIXES ELEMENTARY · CANTON, GA</div>
          <h1>Closer to school.<br /><em>Clearer on cost.</em></h1>
          <p>A researched shortlist of 1–2 bedroom apartments whose no-traffic route plus a 30% planning buffer remains under 40 minutes—organized by commute, rent, perks, reviews, and honest area context.</p>
          <div className="hero-proof">
            <span><b>{apartments.length}</b> communities researched</span>
            <span><b>{closeCount}</b> within ~15 minutes</span>
            <span><b>{manualAudit?.communitiesReviewed ?? 0}/{allApartments.length}</b> records manually rechecked {manualAudit ? formatDate(manualAudit.completedAt) : ""}</span>
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
        <div className="snapshot-note"><b>Commutes are planning estimates.</b><small>The upper number adds 30% to a refreshed no-traffic route. Use live directions at the actual weekday time.</small></div>
      </section>

      <section className="coverage-banner" aria-label="Directory coverage">
        <span>MANUAL AUDIT</span>
        <div><strong>{manualAudit ? `${manualAudit.communitiesReviewed} community records rechecked ${formatDate(manualAudit.completedAt)}—not every active rental unit.` : "A broad community directory—not every active rental unit."}</strong><p>Dynamic data can change immediately. {conflictCount} records show a source conflict and {limitedDataCount} disclose limited public data; private rentals and newly posted units can still be missing.</p></div>
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
                ["price", bedrooms === "1" ? "Lowest listed 1BR" : bedrooms === "2" ? "Lowest listed 2BR" : "Lowest listed start"],
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
              const isSelected = effectiveSelected === apartment.id;
              return (
                <article className={`home-card ${isSelected ? "selected" : ""}`} key={apartment.id} onMouseEnter={() => setSelected(apartment.id)}>
                  <figure className="property-photo">
                    <a className="property-photo-link" href={detailPageUrl(apartment.id)} aria-label={`Open the full page for ${apartment.name}`}>
                      <span className="photo-fallback" aria-hidden="true">{apartmentInitials(apartment.name)}</span>
                      {apartment.imageUrl && <img src={apartment.imageUrl} alt={`${apartment.name} property photograph`} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                      <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                      {index === 0 && sort === "drive" && <span className="best-badge">CLOSEST MATCH</span>}
                    </a>
                    <a className="photo-credit" href={apartment.imageUrl ? apartment.officialUrl : apartment.amenitiesUrl} target="_blank" rel="noreferrer">{apartment.imageUrl ? "Photo: property site" : "Open official gallery"} ↗</a>
                  </figure>

                  <div className="card-copy">
                    <div className="card-topline">
                      <span>{apartment.city}, GA · {apartment.distanceMiles.toFixed(1)} mi</span>
                      <button className={isSaved ? "favorite active" : "favorite"} aria-label={`${isSaved ? "Remove" : "Save"} ${apartment.name}`} aria-pressed={isSaved} onClick={() => toggleSaved(apartment.id)}>{isSaved ? "♥" : "♡"}</button>
                    </div>
                    <h3><a href={detailPageUrl(apartment.id)}>{apartment.name}</a></h3>
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
                      <div className="value-score"><b>REL.</b><span><strong>{affordabilityLabel(valueScore)}</strong>Starting-rent position</span></div>
                      {apartment.review.url ? <a className="review-score" href={apartment.review.url} target="_blank" rel="noreferrer">
                        <b>{apartment.review.rating !== null ? `${apartment.review.rating.toFixed(1)} ★` : "N/A"}</b>
                        <span>{apartment.review.count ? `${apartment.review.count} reviews · ${apartment.review.source.replace(" snapshot", "")}` : "No current review rating"}</span>
                      </a> : <div className="review-score"><b>N/A</b><span>Review source unavailable</span></div>}
                      <a className="details-link" href={detailPageUrl(apartment.id)}>View property page →</a>
                    </div>

                    <div className="card-actions">
                      <a className="primary-link" href={detailPageUrl(apartment.id)}>View full page →</a>
                      <a href={apartment.officialUrl} target="_blank" rel="noreferrer">Official site ↗</a>
                      <a href={directionsUrl(apartment.address)} target="_blank" rel="noreferrer">Check live drive ↗</a>
                      <span>{auditStatusCopy(apartment)} · {sourceStatusCopy(apartment)}</span>
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
                <button key={apartment.id} type="button" className={`map-pin ${effectiveSelected === apartment.id ? "active" : ""}`} style={mapPosition(apartment)} onClick={() => setSelected(apartment.id)} aria-label={`Select ${apartment.name}`}>{index + 1}</button>
              ))}
              {selectedApartment && <div className="map-note"><span>{selectedApartment.city} · {selectedApartment.distanceMiles.toFixed(1)} mi</span><b>{selectedApartment.name}</b><small>{selectedApartment.driveMin}–{selectedApartment.driveMax} min estimated</small><a href={directionsUrl(selectedApartment.address)} target="_blank" rel="noreferrer">Live directions ↗</a></div>}
            </div>
            <p className="map-disclaimer">Pins use geocoded addresses; roads are simplified. Routes use OSRM/OpenStreetMap with no live traffic; upper estimates add a 30% buffer.</p>
          </aside>
        </div>
      </section>

      {saved.length > 0 && (
        <section className="saved-strip" id="saved">
          <div><span className="section-kicker">BELLA&apos;S SAVED LIST</span><h2>{saved.length} place{saved.length === 1 ? "" : "s"} worth a closer look</h2></div>
          <div className="saved-names">{saved.map((id) => { const item = apartments.find((apartment) => apartment.id === id); return item ? <a href={detailPageUrl(id)} key={id}>{item.name} →</a> : null; })}</div>
        </section>
      )}

      <section className="methodology" id="how-it-works">
        <div className="method-intro">
          <span className="section-kicker">READ THE SIGNALS, NOT THE HYPE</span>
          <h2>What the scores actually mean</h2>
          <p>The goal is a useful comparison—not false precision. Every signal is labeled by source and scope so Bella can decide what matters to her.</p>
        </div>
        <div className="method-grid">
          <article><span>01</span><h3>Drive range</h3><p>A refreshed OSRM/OpenStreetMap no-traffic route plus a 30% planning buffer. It is a first-pass filter, not a traffic promise. Every card opens a live Google Maps route.</p></article>
          <article><span>02</span><h3>Starting-rent affordability</h3><p>Compares the lowest eligible advertised starting price with the median of the full {apartments.length}-community directory. Fee disclosures and price bases differ, so this is a first-pass signal—not a complete effective-rent or personal-affordability test.</p></article>
          <article><span>03</span><h3>Review snapshot</h3><p>When a current property review page is available, its dated rating and count are shown with a direct link. A high score with very few reviews is shown as such—never treated like a certainty.</p></article>
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
          <div><h3>Manual audit + daily check</h3><p>{manualAudit ? `${manualAudit.communitiesReviewed} community records were manually rechecked on ${formatDate(manualAudit.completedAt)}. ` : ""}The GitHub workflow then attempts each configured primary pricing/source page every morning, records which pages were reached or blocked, preserves the last curated price, and republishes the site. Generic price hints are queued for review rather than automatically replacing trusted rents; undated deals stop appearing as current after seven days unless reconfirmed.</p></div>
          <div><h3>Official links stay primary</h3><p>Every community links directly to its property, pricing, amenity, photo, and live-directions pages. Call the leasing office before paying any fee or relying on a concession.</p></div>
          <div><h3>Coverage & reviews</h3><p>This is a researched community directory, not a guaranteed feed of every individual unit. Stable property/management-site images are embedded with provenance notes; otherwise the card links to the property gallery. Ratings are dated snapshots with direct review links when one remains available.</p></div>
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
