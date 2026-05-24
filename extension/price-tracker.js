"use strict";
(() => {
  // src/lib/price-extractor.ts
  function pickOffer(node) {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = pickOffer(child);
        if (found) return found;
      }
      return null;
    }
    const obj = node;
    const type = obj["@type"];
    const isProduct = type === "Product" || Array.isArray(type) && type.includes("Product");
    if (isProduct) {
      const offers = obj["offers"];
      const fromOffers = pickOffer(offers);
      if (fromOffers) return fromOffers;
    }
    const priceRaw = obj["price"] ?? obj["lowPrice"];
    const currencyRaw = obj["priceCurrency"] ?? obj["currency"];
    if (priceRaw != null && typeof currencyRaw === "string") {
      const amount = Number(String(priceRaw).replace(/[^\d.,-]/g, "").replace(",", "."));
      if (Number.isFinite(amount) && amount > 0) {
        return { amount, currency: currencyRaw.toUpperCase() };
      }
    }
    for (const value of Object.values(obj)) {
      const found = pickOffer(value);
      if (found) return found;
    }
    return null;
  }
  function tryJsonLdScripts(scripts) {
    for (const raw of scripts) {
      try {
        const parsed = JSON.parse(raw);
        const found = pickOffer(parsed);
        if (found) return found;
      } catch {
      }
    }
    return null;
  }
  function parseAmount(raw) {
    if (!raw) return null;
    const trimmed = raw.trim().replace(/[^\d.,-]/g, "").replace(",", ".");
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function extractPriceFromDocument(doc) {
    const ldScripts = Array.from(
      doc.querySelectorAll('script[type="application/ld+json"]')
    ).map((s) => s.textContent ?? "");
    const fromLd = tryJsonLdScripts(ldScripts);
    if (fromLd) return fromLd;
    const ogAmount = parseAmount(
      doc.querySelector('meta[property="og:price:amount"]')?.content
    );
    const ogCurrency = doc.querySelector('meta[property="og:price:currency"]')?.content?.toUpperCase();
    if (ogAmount && ogCurrency) return { amount: ogAmount, currency: ogCurrency };
    const productAmount = parseAmount(
      doc.querySelector('meta[property="product:price:amount"]')?.content
    );
    const productCurrency = doc.querySelector('meta[property="product:price:currency"]')?.content?.toUpperCase();
    if (productAmount && productCurrency) return { amount: productAmount, currency: productCurrency };
    const microRoot = doc.querySelector('[itemtype$="schema.org/Product"]');
    if (microRoot) {
      const microAmount = parseAmount(
        microRoot.querySelector('[itemprop="price"]')?.content ?? microRoot.querySelector('[itemprop="price"]')?.textContent
      );
      const microCurrency = microRoot.querySelector('[itemprop="priceCurrency"]')?.content?.toUpperCase() || microRoot.querySelector('[itemprop="priceCurrency"]')?.textContent?.toUpperCase();
      if (microAmount && microCurrency) return { amount: microAmount, currency: microCurrency };
    }
    return null;
  }

  // extension/price-tracker.src.js
  var SESSION_KEY = "wishpoolExtSession";
  var LINKS_INDEX_KEY = "wishpoolLinksIndex";
  var LAST_FIRED_KEY = "wishpoolPriceTrackerFired";
  var MIN_FIRE_INTERVAL_MS = 60 * 60 * 1e3;
  var SUPABASE_URL = "https://okpxxpjskegpohowqqry.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_i_N5por1Imv5eL20Y7VwRw_stIIpGCa";
  function normalizeUrl(raw) {
    try {
      const u = new URL(raw);
      u.hash = "";
      const drop = /* @__PURE__ */ new Set([
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "gclid",
        "fbclid",
        "mc_cid",
        "mc_eid",
        "_ga"
      ]);
      const next = new URLSearchParams();
      for (const [k, v] of u.searchParams) {
        if (!drop.has(k.toLowerCase())) next.set(k, v);
      }
      u.search = next.toString() ? `?${next.toString()}` : "";
      return u.toString();
    } catch {
      return raw;
    }
  }
  async function readIndex() {
    const stored = await chrome.storage.local.get([LINKS_INDEX_KEY, LAST_FIRED_KEY, SESSION_KEY]);
    return {
      index: stored[LINKS_INDEX_KEY] || {},
      fired: stored[LAST_FIRED_KEY] || {},
      session: stored[SESSION_KEY] || null
    };
  }
  async function recordSnapshot(session, linkId, price, currency) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_price_snapshot`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_link_id: linkId,
        p_price: price,
        p_currency: currency,
        p_source: "extension"
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[bag price-tracker] RPC failed", res.status, text);
    }
  }
  async function run() {
    const { index, fired, session } = await readIndex();
    if (!session?.accessToken) return;
    const here = normalizeUrl(window.location.href);
    const entry = index[here];
    if (!entry) return;
    const now = Date.now();
    const lastFired = fired[here] || 0;
    if (now - lastFired < MIN_FIRE_INTERVAL_MS) return;
    const extracted = extractPriceFromDocument(document);
    if (!extracted) return;
    if (extracted.currency !== entry.currency) return;
    if (extracted.amount === entry.lastPrice) {
      await chrome.storage.local.set({
        [LAST_FIRED_KEY]: { ...fired, [here]: now }
      });
      return;
    }
    await recordSnapshot(session, entry.itemId, extracted.amount, extracted.currency);
    await chrome.storage.local.set({
      [LINKS_INDEX_KEY]: {
        ...index,
        [here]: { ...entry, lastPrice: extracted.amount }
      },
      [LAST_FIRED_KEY]: { ...fired, [here]: now }
    });
  }
  setTimeout(() => {
    void run().catch((err) => console.warn("[bag price-tracker]", err));
  }, 1500);
})();
