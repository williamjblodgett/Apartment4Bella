import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders Bella's finished apartment finder", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Bella&#x27;s Home Base \| Apartments near Sixes Elementary<\/title>/i);
  assert.match(html, /Closer to school/);
  assert.match(html, /The Atlantic BridgeMill/);
  assert.match(html, /Reported-crime context/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/i);
});

test("ships a complete, bounded apartment dataset", async () => {
  const primary = JSON.parse(await readFile(new URL("../app/apartments.json", import.meta.url), "utf8"));
  const expanded = JSON.parse(await readFile(new URL("../app/apartments-expanded.json", import.meta.url), "utf8"));
  const apartments = [...primary.apartments, ...expanded.apartments];
  assert.ok(apartments.length >= 40);
  assert.equal(new Set(apartments.map((home) => home.id)).size, apartments.length);
  assert.equal(new Set(apartments.map((home) => home.address.toLowerCase())).size, apartments.length);
  assert.ok(apartments.every((home) => home.driveMax <= 40));
  assert.ok(apartments.every((home) => (home.oneBed.min ?? home.twoBed.min) > 0));
  assert.ok(apartments.every((home) => home.officialUrl.startsWith("https://")));
  assert.ok(apartments.every((home) => home.imageUrl?.startsWith("https://")));
  assert.ok(apartments.every((home) => home.review.url.startsWith("https://")));
});

test("builds a unique, shareable detail page for every apartment", async () => {
  const primary = JSON.parse(await readFile(new URL("../app/apartments.json", import.meta.url), "utf8"));
  const expanded = JSON.parse(await readFile(new URL("../app/apartments-expanded.json", import.meta.url), "utf8"));
  const apartments = [...primary.apartments, ...expanded.apartments];

  for (const apartment of apartments) {
    const html = await readFile(new URL(`../pages-dist/apartments/${apartment.id}/index.html`, import.meta.url), "utf8");
    assert.match(html, new RegExp(`<title>${apartment.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| Bella's Home Base<\\/title>`, "i"));
    assert.match(html, new RegExp(`Apartment4Bella/apartments/${apartment.id}/`));
    assert.match(html, /property="og:image" content="https:\/\//i);
    assert.equal((html.match(/property="og:title"/gi) ?? []).length, 1);
    assert.equal((html.match(/name="twitter:title"/gi) ?? []).length, 1);
    assert.match(html, new RegExp(`property="og:title" content="${apartment.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| Bella's Home Base"`, "i"));
    assert.match(html, new RegExp(`name="twitter:title" content="${apartment.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| Bella's Home Base"`, "i"));
  }

  const withPhoto = await readFile(new URL("../pages-dist/apartments/atlantic-bridgemill/index.html", import.meta.url), "utf8");
  assert.match(withPhoto, /property="og:image" content="https:\/\//i);
  assert.doesNotMatch(withPhoto, /property="og:image" content="https:\/\/williamjblodgett\.github\.io\/Apartment4Bella\/og\.png"/i);

});

test("includes the scheduled GitHub Pages publisher", async () => {
  const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /npm run refresh:data/);
  assert.match(workflow, /npm run validate:data/);
  assert.match(workflow, /preserve daily apartment snapshot/i);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});
