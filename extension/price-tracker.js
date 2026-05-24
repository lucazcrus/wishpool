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

  // src/lib/site-adapters/parse.ts
  function parseLocalizedPrice(raw) {
    if (!raw) return null;
    const cleaned = raw.replace(/[^\d.,-]/g, "");
    if (!cleaned) return null;
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    let normalized;
    if (lastDot === -1 && lastComma === -1) {
      normalized = cleaned;
    } else if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function symbolToCurrency(text) {
    if (text.includes("R$")) return "BRL";
    if (text.includes("US$")) return "USD";
    if (text.includes("\u20AC")) return "EUR";
    if (text.includes("\xA3")) return "GBP";
    if (text.includes("\xA5")) return "JPY";
    if (text.includes("CHF")) return "CHF";
    if (/[A-Z]{0,2}\$/.test(text)) return "USD";
    return null;
  }
  var EUR_TLDS = /* @__PURE__ */ new Set([
    ".de",
    ".fr",
    ".it",
    ".es",
    ".nl",
    ".pt",
    ".ie",
    ".be",
    ".at",
    ".fi",
    ".lu",
    ".gr",
    ".sk",
    ".si",
    ".lt",
    ".lv",
    ".ee",
    ".eu"
  ]);
  function currencyFromHostname(hostname) {
    const h = hostname.toLowerCase();
    if (h.endsWith(".com.br")) return "BRL";
    if (h.endsWith(".com.mx")) return "MXN";
    if (h.endsWith(".com.ar")) return "ARS";
    if (h.endsWith(".com.au")) return "AUD";
    if (h.endsWith(".co.uk") || h.endsWith(".uk")) return "GBP";
    if (h.endsWith(".co.jp") || h.endsWith(".jp")) return "JPY";
    if (h.endsWith(".ca")) return "CAD";
    if (h.endsWith(".ch")) return "CHF";
    for (const tld of EUR_TLDS) {
      if (h.endsWith(tld)) return "EUR";
    }
    if (h.endsWith(".com")) return "USD";
    return null;
  }
  async function waitFor(doc, selectors, timeoutMs = 5e3, intervalMs = 250) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (el && el.textContent && el.textContent.trim()) return el;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (el) return el;
    }
    return null;
  }
  function firstNonEmptyText(doc, selectors) {
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text) return text;
    }
    return null;
  }

  // src/lib/site-adapters/adidas.ts
  var ADIDAS_HOST_RE = /(?:^|\.)adidas\.(?:com|com\.br|com\.mx|com\.ar|co\.uk|com\.au|co\.jp|de|fr|it|es|nl|ca)$/;
  var ADIDAS_PRICE_SELECTORS = [
    '[data-testid="main-price"]',
    '[data-testid="product-price"]',
    '[data-auto-id="product-price"]',
    ".gl-price-item--sale",
    ".gl-price-item--current",
    ".gl-price-item",
    ".product-price"
  ];
  async function waitForReady(doc) {
    await waitFor(doc, ADIDAS_PRICE_SELECTORS, 4e3, 250);
  }
  function extract(doc) {
    const priceText = firstNonEmptyText(doc, ADIDAS_PRICE_SELECTORS);
    if (!priceText) return null;
    const amount = parseLocalizedPrice(priceText);
    if (!amount) return null;
    const hostname = doc.defaultView?.location?.hostname ?? "";
    const currency = symbolToCurrency(priceText) ?? currencyFromHostname(hostname);
    if (!currency) return null;
    return { amount, currency };
  }
  var adidasAdapter = {
    name: "adidas",
    matches: (hostname) => ADIDAS_HOST_RE.test(hostname),
    extract,
    waitForReady
  };

  // src/lib/site-adapters/amazon.ts
  var AMAZON_HOST_RE = /(?:^|\.)amazon\.(?:com|com\.br|com\.mx|com\.au|co\.uk|de|fr|it|es|nl|ca|co\.jp)$/;
  var AMAZON_PRICE_SELECTORS = [
    '#corePriceDisplay_desktop_feature_div .a-price[data-a-color="price"] .a-offscreen',
    '#corePrice_feature_div .a-price[data-a-color="price"] .a-offscreen',
    '#corePrice_desktop .a-price[data-a-color="price"] .a-offscreen',
    '#apex_desktop .a-price[data-a-color="price"] .a-offscreen',
    ".priceToPay .a-offscreen",
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    "#priceblock_saleprice",
    "#corePrice_feature_div .a-offscreen"
  ];
  function extract2(doc) {
    const priceText = firstNonEmptyText(doc, AMAZON_PRICE_SELECTORS);
    if (!priceText) return null;
    const amount = parseLocalizedPrice(priceText);
    if (!amount) return null;
    const hostname = doc.defaultView?.location?.hostname ?? "";
    const currency = symbolToCurrency(priceText) ?? currencyFromHostname(hostname);
    if (!currency) return null;
    return { amount, currency };
  }
  var amazonAdapter = {
    name: "amazon",
    matches: (hostname) => AMAZON_HOST_RE.test(hostname),
    extract: extract2
  };

  // src/lib/site-adapters/nike.ts
  var NIKE_HOST_RE = /(?:^|\.)nike\.(?:com|com\.br|com\.mx|co\.uk|com\.au|co\.jp|de|fr|it|es|nl|ca)$/;
  var NIKE_PRICE_SELECTORS = [
    '[data-testid="currentPrice-container"]',
    '[data-testid="product-price-reduced"]',
    '[data-testid="product-price"]',
    '[data-test="product-price-reduced"]',
    '[data-test="product-price"]',
    ".product-price.is--current-price",
    ".product-price"
  ];
  async function waitForReady2(doc) {
    await waitFor(doc, NIKE_PRICE_SELECTORS, 4e3, 250);
  }
  function extract3(doc) {
    const priceText = firstNonEmptyText(doc, NIKE_PRICE_SELECTORS);
    if (!priceText) return null;
    const amount = parseLocalizedPrice(priceText);
    if (!amount) return null;
    const hostname = doc.defaultView?.location?.hostname ?? "";
    const currency = symbolToCurrency(priceText) ?? currencyFromHostname(hostname);
    if (!currency) return null;
    return { amount, currency };
  }
  var nikeAdapter = {
    name: "nike",
    matches: (hostname) => NIKE_HOST_RE.test(hostname),
    extract: extract3,
    waitForReady: waitForReady2
  };

  // src/lib/site-adapters/index.ts
  var ADAPTERS = [amazonAdapter, nikeAdapter, adidasAdapter];
  function pickAdapter(hostname) {
    const normalized = hostname.toLowerCase();
    return ADAPTERS.find((a) => a.matches(normalized)) ?? null;
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
    const adapter = pickAdapter(window.location.hostname);
    if (adapter?.waitForReady) {
      try {
        await adapter.waitForReady(document);
      } catch {
      }
    }
    let extracted = adapter?.extract(document) ?? null;
    if (!extracted) extracted = extractPriceFromDocument(document);
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
