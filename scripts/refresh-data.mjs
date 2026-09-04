import { readFile, writeFile } from "node:fs/promises";

const dataUrl = new URL("../app/apartments.json", import.meta.url);
const data = JSON.parse(await readFile(dataUrl, "utf8"));
const now = new Date();
const today = now.toISOString().slice(0, 10);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#36;|&dollar;/gi, "$")
    .replace(/\s+/g, " ")
    .trim();
}

function pricesNearBedroom(text, bedroom, nextBedroom) {
  const lower = text.toLowerCase();
  const starts = [`${bedroom} bedroom`, `${bedroom}-bedroom`, `${bedroom} bed`, `${bedroom}br`]
    .map((needle) => lower.indexOf(needle))
    .filter((index) => index >= 0);
  if (!starts.length) return null;
  const start = Math.min(...starts);
  const endCandidates = [`${nextBedroom} bedroom`, `${nextBedroom}-bedroom`, `${nextBedroom} bed`, `${nextBedroom}br`]
    .map((needle) => lower.indexOf(needle, start + 20))
    .filter((index) => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : Math.min(text.length, start + 18000);
  const section = text.slice(start, end);
  const values = [...section.matchAll(/\$\s*([1-4][\d,]{3,})/g)]
    .map((match) => Number(match[1].replaceAll(",", "")))
    .filter((value) => value >= 900 && value <= 4500);
  const unique = [...new Set(values)].sort((a, b) => a - b);
  return unique.length ? { min: unique[0], max: unique.length > 1 ? unique[unique.length - 1] : null } : null;
}

function plausible(next, current) {
  if (!next) return false;
  const ratio = next.min / current.min;
  return ratio >= 0.65 && ratio <= 1.55 && (!next.max || next.max <= 4500);
}

function dealSignal(text) {
  const patterns = [
    /\bup to\s+(?:one|two|three|four|\d+)\s+(?:weeks?|months?)\s+free\b/i,
    /\b(?:one|two|three|four|\d+)\s+(?:weeks?|months?)\s+(?:of rent\s+)?free\b/i,
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

async function checkApartment(apartment) {
  if (apartment.dealExpires && apartment.dealExpires < today) {
    apartment.deal = null;
    apartment.dealExpires = null;
    apartment.dealDetail = "The previously dated promotion has ended. Check the official site for a replacement offer.";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);
  try {
    const response = await fetch(apartment.pricingUrl, {
      headers: { "user-agent": "Apartment4Bella/1.0 (+https://github.com/williamjblodgett/Apartment4Bella)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = visibleText(await response.text());
    const oneBed = pricesNearBedroom(text, 1, 2);
    const twoBed = pricesNearBedroom(text, 2, 3);
    let priceUpdated = false;

    if (apartment.priceConfidence === "official" && plausible(oneBed, apartment.oneBed)) {
      apartment.oneBed = { ...apartment.oneBed, min: oneBed.min, note: `Lowest price observed on the official page on ${today}; the displayed upper range remains curated. Verify the exact unit and term.` };
      priceUpdated = true;
    }
    if (apartment.priceConfidence === "official" && plausible(twoBed, apartment.twoBed)) {
      apartment.twoBed = { ...apartment.twoBed, min: twoBed.min, note: `Lowest price observed on the official page on ${today}; the displayed upper range remains curated. Verify the exact unit and term.` };
      priceUpdated = true;
    }

    const detectedDeal = dealSignal(text);
    apartment.detectedDeal = detectedDeal;
    if (detectedDeal && !apartment.deal) {
      apartment.deal = detectedDeal;
      apartment.dealDetail = `Detected on the official pricing page on ${today}. Confirm the eligible unit, lease term, move-in deadline, and full written terms.`;
      apartment.dealExpires = null;
    }

    apartment.lastSourceCheck = today;
    apartment.sourceCheckStatus = "reachable";
    if (priceUpdated) apartment.verifiedAt = today;
    return { id: apartment.id, ok: true, priceUpdated, dealDetected: Boolean(detectedDeal) };
  } catch (error) {
    apartment.lastSourceCheck = today;
    apartment.sourceCheckStatus = "unreachable";
    return { id: apartment.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

const checks = [];
for (const apartment of data.apartments) {
  checks.push(await checkApartment(apartment));
  await pause(350);
}

data.meta.checkedAt = now.toISOString();
data.meta.automation = {
  checked: checks.length,
  reachable: checks.filter((item) => item.ok).length,
  pricesUpdated: checks.filter((item) => item.priceUpdated).length,
  dealsDetected: checks.filter((item) => item.dealDetected).length,
  method: "Best-effort checks of official property pricing pages; last curated values remain when parsing is inconclusive."
};

await writeFile(dataUrl, `${JSON.stringify(data, null, 2)}\n`);
console.log(JSON.stringify(data.meta.automation));
