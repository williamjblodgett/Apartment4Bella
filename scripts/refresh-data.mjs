import { readFile, writeFile } from "node:fs/promises";

const dataUrl = new URL("../app/apartments.json", import.meta.url);
const expandedDataUrl = new URL("../app/apartments-expanded.json", import.meta.url);
const primaryData = JSON.parse(await readFile(dataUrl, "utf8"));
const expandedData = JSON.parse(await readFile(expandedDataUrl, "utf8"));
const primaryIds = new Set(primaryData.apartments.map((apartment) => apartment.id));
const data = { meta: primaryData.meta, apartments: [...primaryData.apartments, ...expandedData.apartments] };
const startedAt = new Date();
const today = startedAt.toISOString().slice(0, 10);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#36;|&dollar;/gi, "$")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function pageLooksRelevant(text, apartment) {
  const normalized = text.toLowerCase();
  const tokens = apartment.name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 5 && !["apartments", "apartment", "heights", "springs"].includes(token));
  return tokens.length === 0 || tokens.some((token) => normalized.includes(token));
}

function pricesNearBedroom(text, bedroom, nextBedroom) {
  const lower = text.toLowerCase();
  const needles = [`${bedroom} bedroom`, `${bedroom}-bedroom`, `${bedroom} bed`, `${bedroom}br`, `${bedroom} beds`];
  const starts = needles.flatMap((needle) => {
    const hits = [];
    let cursor = lower.indexOf(needle);
    while (cursor >= 0 && hits.length < 12) {
      hits.push(cursor);
      cursor = lower.indexOf(needle, cursor + needle.length);
    }
    return hits;
  });
  if (!starts.length) return null;

  const values = [];
  for (const start of starts) {
    const nextNeedles = [`${nextBedroom} bedroom`, `${nextBedroom}-bedroom`, `${nextBedroom} bed`, `${nextBedroom}br`, `${nextBedroom} beds`];
    const nextStarts = nextNeedles.map((needle) => lower.indexOf(needle, start + 20)).filter((index) => index > start);
    const end = nextStarts.length ? Math.min(Math.min(...nextStarts), start + 5000) : Math.min(text.length, start + 3000);
    const section = text.slice(start, end);
    values.push(...[...section.matchAll(/\$\s*([1-4][\d,]{3,})/g)]
      .map((match) => Number(match[1].replaceAll(",", "")))
      .filter((value) => value >= 900 && value <= 4500));
  }

  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (!unique.length || unique.length > 30) return null;
  const min = unique[0];
  const max = unique.length > 1 ? unique[unique.length - 1] : null;
  if (max && max / min > 2.25) return null;
  return { min, max };
}

function plausible(next, current) {
  if (!next || !current?.min) return false;
  const ratio = next.min / current.min;
  return ratio >= 0.65 && ratio <= 1.55 && next.min <= (next.max ?? next.min);
}

function dealSignal(text) {
  const patterns = [
    /\bup to\s+(?:one|two|three|four|five|six|eight|ten|\d+)\s+(?:weeks?|months?)\s+free\b/i,
    /\b(?:one|two|three|four|five|six|eight|ten|\d+)\s+(?:weeks?|months?)\s+(?:of rent\s+)?free\b/i,
    /\b(?:one|two|three|four|\d+)\s+(?:weeks?|months?)\s+free\s+rent\b/i,
    /\b\d+%\s+off\s+(?:your\s+)?(?:first\s+)?(?:month|rent)\b/i,
    /\bwaived\s+(?:application|admin|administration)(?:\s*(?:and|&|\+)\s*(?:application|admin|administration))?\s+fees?\b/i,
  ];
  const found = [...new Set(patterns.map((pattern) => text.match(pattern)?.[0]).filter(Boolean))];
  const nonOverlapping = found.filter((candidate) => !found.some((other) => other !== candidate && other.toLowerCase().includes(candidate.toLowerCase())));
  if (!nonOverlapping.length) return null;
  const joined = nonOverlapping.slice(0, 2).join(" + ").toLowerCase();
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

function applyPrice(apartment, key, next) {
  const current = apartment[key];
  if (apartment.priceConfidence !== "official" || !plausible(next, current)) return { verified: false, changed: false, candidate: null };
  const candidate = { ...next, observedAt: today, bedroom: key === "oneBed" ? 1 : 2 };
  const changed = current.min !== next.min || (next.max !== null && current.max !== next.max);
  return { verified: false, changed: false, candidate: changed ? candidate : null };
}

async function checkApartment(apartment) {
  apartment.oneBed.observedAt ??= apartment.verifiedAt;
  apartment.twoBed.observedAt ??= apartment.verifiedAt;
  apartment.review.observedAt ??= apartment.verifiedAt;
  apartment.priceReviewCandidates = [];
  apartment.detectedDeal = null;

  if (apartment.dealExpires && apartment.dealExpires < today) {
    apartment.deal = null;
    apartment.dealExpires = null;
    apartment.dealDetail = "The previously dated promotion has ended. Check the official site for a replacement offer.";
    apartment.dealStatus = "expired";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);
  try {
    const response = await fetch(apartment.pricingUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Apartment4Bella/1.1 (+https://github.com/williamjblodgett/Apartment4Bella)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if ([401, 403, 429].includes(response.status)) {
      apartment.lastSourceCheck = today;
      apartment.sourceCheckStatus = "blocked";
      apartment.sourceCheckError = `HTTP ${response.status}`;
      return { id: apartment.id, status: "blocked", priceFieldsVerified: 0, priceFieldsChanged: 0, priceCandidatesFound: 0, dealDetected: false };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!/html|text/i.test(contentType)) throw new Error(`Unexpected content type: ${contentType || "unknown"}`);

    const text = visibleText(await response.text());
    if (text.length < 300 || !pageLooksRelevant(text, apartment)) throw new Error("Page identity/content check failed");

    const oneResult = applyPrice(apartment, "oneBed", pricesNearBedroom(text, 1, 2));
    const twoResult = applyPrice(apartment, "twoBed", pricesNearBedroom(text, 2, 3));
    const priceFieldsVerified = Number(oneResult.verified) + Number(twoResult.verified);
    const priceFieldsChanged = Number(oneResult.changed) + Number(twoResult.changed);
    apartment.priceReviewCandidates = [oneResult.candidate, twoResult.candidate].filter(Boolean);
    const priceCandidatesFound = apartment.priceReviewCandidates.length;
    const detectedDeal = dealSignal(text);

    apartment.detectedDeal = detectedDeal;
    if (detectedDeal) {
      apartment.dealLastSeenAt = today;
      if (apartment.deal && !apartment.deal.toLowerCase().includes(detectedDeal.toLowerCase()) && !detectedDeal.toLowerCase().includes(apartment.deal.toLowerCase())) {
        apartment.dealStatus = "needs_review";
      }
    }

    apartment.lastSourceCheck = today;
    apartment.lastSourceSuccess = today;
    apartment.sourceCheckStatus = priceFieldsVerified ? "verified" : "reachable_unparsed";
    delete apartment.sourceCheckError;
    return {
      id: apartment.id,
      status: apartment.sourceCheckStatus,
      priceFieldsVerified,
      priceFieldsChanged,
      priceCandidatesFound,
      dealDetected: Boolean(detectedDeal),
    };
  } catch (error) {
    apartment.lastSourceCheck = today;
    apartment.sourceCheckStatus = error instanceof Error && error.name === "AbortError" ? "blocked" : "error";
    apartment.sourceCheckError = error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180);
    return { id: apartment.id, status: apartment.sourceCheckStatus, priceFieldsVerified: 0, priceFieldsChanged: 0, priceCandidatesFound: 0, dealDetected: false };
  } finally {
    clearTimeout(timeout);
  }
}

function validate(nextData) {
  const errors = [];
  const seen = new Set();
  for (const apartment of nextData.apartments) {
    if (seen.has(apartment.id)) errors.push(`duplicate id: ${apartment.id}`);
    seen.add(apartment.id);
    if (apartment.driveMax > 40 || apartment.driveMin < 0 || apartment.driveMin > apartment.driveMax) errors.push(`invalid drive range: ${apartment.id}`);
    if (apartment.oneBed?.min === null && apartment.twoBed?.min === null) errors.push(`no eligible 1BR/2BR price: ${apartment.id}`);
    for (const [label, price] of [["1BR", apartment.oneBed], ["2BR", apartment.twoBed]]) {
      if (price.min !== null && (!Number.isFinite(price.min) || price.min <= 0 || (price.max !== null && price.max < price.min))) errors.push(`invalid ${label} price: ${apartment.id}`);
    }
    for (const [label, url] of [["official", apartment.officialUrl], ["pricing", apartment.pricingUrl]]) {
      if (typeof url !== "string" || !url.startsWith("https://")) errors.push(`invalid ${label} URL: ${apartment.id}`);
    }
    if (apartment.imageUrl !== null && (typeof apartment.imageUrl !== "string" || !apartment.imageUrl.startsWith("https://"))) errors.push(`invalid image URL: ${apartment.id}`);
    if (apartment.dealExpires && apartment.dealExpires < today && apartment.deal) errors.push(`expired active deal: ${apartment.id}`);
  }
  if (errors.length) throw new Error(`Refusing to write invalid apartment data:\n${errors.join("\n")}`);
}

const checks = [];
for (const apartment of data.apartments) {
  checks.push(await checkApartment(apartment));
  await pause(300);
}

const reachable = checks.filter((item) => item.status === "verified" || item.status === "reachable_unparsed").length;
const verified = checks.filter((item) => item.status === "verified").length;
data.meta.checkedAt = startedAt.toISOString();
data.meta.curatedAt ??= today;
data.meta.lastSuccessfulCheckAt = reachable ? startedAt.toISOString() : data.meta.lastSuccessfulCheckAt || null;
data.meta.automation = {
  checked: checks.length,
  reachable,
  verified,
  blocked: checks.filter((item) => item.status === "blocked").length,
  errors: checks.filter((item) => item.status === "error").length,
  priceFieldsVerified: checks.reduce((sum, item) => sum + item.priceFieldsVerified, 0),
  pricesChanged: checks.reduce((sum, item) => sum + item.priceFieldsChanged, 0),
  priceCandidatesFound: checks.reduce((sum, item) => sum + item.priceCandidatesFound, 0),
  dealsDetected: checks.filter((item) => item.dealDetected).length,
  status: verified === checks.length ? "complete" : reachable ? "partial" : "failed",
  method: "Daily best-effort checks of official property pricing pages. Generic parser findings are saved only as review candidates and never overwrite curated rents; only an approved structured adapter may publish a new price.",
};

validate(data);
primaryData.meta = data.meta;
primaryData.apartments = data.apartments.filter((apartment) => primaryIds.has(apartment.id));
expandedData.curatedAt = data.meta.curatedAt;
expandedData.apartments = data.apartments.filter((apartment) => !primaryIds.has(apartment.id));
await Promise.all([
  writeFile(dataUrl, `${JSON.stringify(primaryData, null, 2)}\n`),
  writeFile(expandedDataUrl, `${JSON.stringify(expandedData, null, 2)}\n`),
]);
console.log(JSON.stringify(data.meta.automation));
