import { readFile } from "node:fs/promises";

const primary = JSON.parse(await readFile(new URL("../app/apartments.json", import.meta.url), "utf8"));
const expanded = JSON.parse(await readFile(new URL("../app/apartments-expanded.json", import.meta.url), "utf8"));
const data = { meta: primary.meta, apartments: [...primary.apartments, ...expanded.apartments] };
const errors = [];
const ids = new Set();
const addresses = new Set();

if (!data.meta?.checkedAt || !data.meta?.curatedAt || !data.meta?.discoveryCheckedAt) {
  errors.push("metadata must include checkedAt, curatedAt, and discoveryCheckedAt");
}

for (const apartment of data.apartments ?? []) {
  if (!apartment.id || ids.has(apartment.id)) errors.push(`missing or duplicate id: ${apartment.id}`);
  ids.add(apartment.id);
  const normalizedAddress = apartment.address?.trim().toLowerCase();
  if (!normalizedAddress || addresses.has(normalizedAddress)) errors.push(`missing or duplicate address: ${apartment.address}`);
  addresses.add(normalizedAddress);
  if (!Number.isFinite(apartment.driveMin) || !Number.isFinite(apartment.driveMax) || apartment.driveMin < 0 || apartment.driveMin > apartment.driveMax || apartment.driveMax > 40) {
    errors.push(`invalid commute ceiling: ${apartment.id}`);
  }
  if (apartment.oneBed?.min === null && apartment.twoBed?.min === null) errors.push(`no eligible 1BR/2BR rent: ${apartment.id}`);
  for (const [label, price] of [["oneBed", apartment.oneBed], ["twoBed", apartment.twoBed]]) {
    if (!price || (price.min !== null && (!Number.isFinite(price.min) || price.min <= 0 || (price.max !== null && (!Number.isFinite(price.max) || price.max < price.min))))) {
      errors.push(`invalid ${label} price: ${apartment.id}`);
    }
  }
  for (const [label, url] of [["officialUrl", apartment.officialUrl], ["pricingUrl", apartment.pricingUrl], ["amenitiesUrl", apartment.amenitiesUrl], ["review.url", apartment.review?.url]]) {
    if (typeof url !== "string" || !url.startsWith("https://")) errors.push(`invalid ${label}: ${apartment.id}`);
  }
  if (apartment.galleryUrl !== undefined && (typeof apartment.galleryUrl !== "string" || !apartment.galleryUrl.startsWith("https://"))) errors.push(`invalid galleryUrl: ${apartment.id}`);
  if (typeof apartment.imageUrl !== "string" || !apartment.imageUrl.startsWith("https://")) errors.push(`missing or invalid imageUrl: ${apartment.id}`);
  if (apartment.galleryImages !== undefined) {
    if (!Array.isArray(apartment.galleryImages) || apartment.galleryImages.length === 0) errors.push(`invalid galleryImages: ${apartment.id}`);
    for (const image of apartment.galleryImages ?? []) {
      if (typeof image?.url !== "string" || !image.url.startsWith("https://") || typeof image?.sourceUrl !== "string" || !image.sourceUrl.startsWith("https://") || typeof image?.alt !== "string" || !image.alt.trim()) {
        errors.push(`invalid gallery image: ${apartment.id}`);
      }
    }
  }
  if (!Array.isArray(apartment.amenities) || apartment.amenities.length < 3) errors.push(`too few amenities: ${apartment.id}`);
  if (!Array.isArray(apartment.security) || !apartment.security.length) errors.push(`missing property-reported security/access notes: ${apartment.id}`);
  if (apartment.deal && apartment.dealExpires && apartment.dealExpires < new Date().toISOString().slice(0, 10)) errors.push(`expired deal still active: ${apartment.id}`);
}

if (!data.apartments?.length) errors.push("directory is empty");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${data.apartments.length} unique apartment communities inside the 40-minute ceiling.`);
