import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (match) => match.slice(1)));
const outputRoot = path.join(projectRoot, "pages-dist");
const siteUrl = "https://williamjblodgett.github.io/Apartment4Bella/";

const primary = JSON.parse(await readFile(path.join(projectRoot, "app", "apartments.json"), "utf8"));
const expanded = JSON.parse(await readFile(path.join(projectRoot, "app", "apartments-expanded.json"), "utf8"));
const apartments = [...primary.apartments, ...expanded.apartments]
  .filter((apartment) => apartment.withinDriveLimit !== false && apartment.driveMax <= 40);
const template = await readFile(path.join(outputRoot, "index.html"), "utf8");

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function setMeta(html, attribute, name, content) {
  const expression = new RegExp(`<meta\\s+${attribute}="${escapeRegex(name)}"\\s+content="[^"]*"\\s*\\/?\\s*>`, "i");
  const tag = `<meta ${attribute}="${escapeHtml(name)}" content="${escapeHtml(content)}" />`;
  return expression.test(html) ? html.replace(expression, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function removeMeta(html, attribute, name) {
  const expression = new RegExp(`\\s*<meta\\s+${attribute}="${escapeRegex(name)}"\\s+content="[^"]*"\\s*\\/?\\s*>`, "gi");
  return html.replace(expression, "");
}

function priceLabel(price) {
  if (price.min === null) return /not offered|no 1br product/i.test(price.note) ? "not offered" : "no public price";
  const money = (value) => `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (price.max === price.min) return money(price.min);
  return price.max === null ? `${money(price.min)}+` : `${money(price.min)}–${money(price.max)}`;
}

for (const apartment of apartments) {
  const detailUrl = `${siteUrl}apartments/${encodeURIComponent(apartment.id)}/`;
  const title = `${apartment.name} | Bella's Home Base`;
  const description = `${apartment.name} in ${apartment.city}, Georgia: ${apartment.driveMin}–${apartment.driveMax} minutes from Sixes Elementary, with 1BR ${priceLabel(apartment.oneBed)} and 2BR ${priceLabel(apartment.twoBed)} pricing snapshots.`;
  const image = apartment.galleryImages?.[0]?.url || apartment.imageUrl;
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:url", detailUrl);
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);

  if (image) {
    html = setMeta(html, "property", "og:image", image);
    html = setMeta(html, "name", "twitter:image", image);
    html = setMeta(html, "name", "twitter:card", "summary_large_image");
  } else {
    html = removeMeta(html, "property", "og:image");
    html = removeMeta(html, "name", "twitter:image");
    html = setMeta(html, "name", "twitter:card", "summary");
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: apartment.name,
    address: apartment.address,
    url: apartment.officialUrl,
    image: image || undefined,
    amenityFeature: apartment.amenities.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
  };
  html = html.replace("</head>", `    <link rel="canonical" href="${detailUrl}" />\n    <script type="application/ld+json">${JSON.stringify(structuredData).replaceAll("<", "\\u003c")}</script>\n  </head>`);

  const detailDirectory = path.join(outputRoot, "apartments", apartment.id);
  await mkdir(detailDirectory, { recursive: true });
  await writeFile(path.join(detailDirectory, "index.html"), html);
}

const sitemapEntries = [siteUrl, ...apartments.map((apartment) => `${siteUrl}apartments/${encodeURIComponent(apartment.id)}/`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(outputRoot, "sitemap.xml"), sitemap);

console.log(`Generated ${apartments.length} apartment detail pages with unique metadata.`);
