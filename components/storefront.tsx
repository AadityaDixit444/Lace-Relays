"use client";
/* eslint-disable @next/next/no-img-element -- Product photos are bundled local assets with explicit geometry. */
import { useState, useRef, useEffect, useMemo } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Bookmark,
  Menu,
  X,
  Check,
  Link as LinkIcon,
  SlidersHorizontal,
  ChevronDown,
  LoaderCircle,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import {
  previewShoes as shoes,
  shoes as catalogShoes,
  money,
  ukSizes,
  type Shoe,
} from "@/lib/catalog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductCard } from "./product-card";
import { BrandStrip } from "./brand-strip";
import type { Listing } from "@/lib/providers";
import { compareOffers } from "@/lib/comparison";

type Panel = "search" | "saved" | "deal" | "about" | null;
// Fixed reference time for illustrative offers; never presented as live data.
const previewReference = Date.parse("2026-11-14T10:00:00Z");
function Brand() {
  return (
    <a href="#" className="brand" aria-label="LaceRelay home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      LaceRelay
    </a>
  );
}

export default function Storefront() {
  const router = useRouter();
  const [size, setSize] = useState(7),
    [selected, setSelected] = useState<Shoe>(shoes[0]),
    [panel, setPanel] = useState<Panel>(null),
    [query, setQuery] = useState(""),
    [saved, setSaved] = useState<string[]>([]),
    [filter, setFilter] = useState("All pairs"),
    [notice, setNotice] = useState(""),
    [live, setLive] = useState(false),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [listings, setListings] = useState<Listing[] | null>(null),
    [sourceNote, setSourceNote] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("search") === "1") {
      // Honour the shared header's search link after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanel("search");
    }
    try {
      const stored = JSON.parse(
        localStorage.getItem("lacerelay-saved") || "[]",
      );
      if (Array.isArray(stored)) {
        // Restore device-local preferences after hydration.
        setSaved(
          stored.filter(
            (id: unknown) =>
              typeof id === "string" && shoes.some((s) => s.id === id),
          ),
        );
      }
    } catch {
      /* Storage is optional. */
    }
  }, []);
  useEffect(() => {
    if (panel) dialog.current?.showModal();
    else dialog.current?.close();
  }, [panel]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        setPanel("search");
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  const results = useMemo(
    () =>
      catalogShoes.filter((s) =>
        `${s.name} ${s.color} ${s.article}`.toLowerCase().includes(
          query
            .toLowerCase()
            .replace(/\buk\s*\d+(\.\d+)?/gi, "")
            .trim(),
        ),
      ),
    [query],
  );
  const ranked = compareOffers(
    selected.offers.map((o) => ({
      id: o.retailer,
      retailer: o.retailer,
      pricePaise: Math.round(o.price * 100),
      size: o.sizes.includes(size) ? size : null,
      stock: o.sizes.includes(size)
        ? ("in_stock" as const)
        : ("out_of_stock" as const),
      observedAt: new Date(previewReference - o.age * 3600000).toISOString(),
      priceType: "ordinary" as const,
      url: o.url,
    })),
    size,
    previewReference,
  );
  const offers = ranked.confirmed.map((o) =>
    selected.offers.find((item) => item.retailer === o.id)!,
  );
  function toggleSave(shoe: Shoe) {
    const next = saved.includes(shoe.id)
      ? saved.filter((id) => id !== shoe.id)
      : [...saved, shoe.id];
    setSaved(next);
    try {
      localStorage.setItem("lacerelay-saved", JSON.stringify(next));
    } catch {
      setNotice("Your browser could not save this pair.");
    }
  }
  function pick(shoe: Shoe) {
    setSelected(shoe);
    setPanel(null);
    router.push(`/shoes/${shoe.id}?size=${size}`);
  }
  function openSearch() {
    setError("");
    setPanel("search");
  }
  async function searchLive(e: React.FormEvent) {
    e.preventDefault();
    const sizeMatch = query.match(/\buk\s*(\d+(?:\.\d+)?)/i);
    if (sizeMatch && ukSizes.includes(Number(sizeMatch[1])))
      setSize(Number(sizeMatch[1]));
    if (!live) return;
    setBusy(true);
    setError("");
    setListings(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ q: query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search unavailable.");
      setListings(data.listings);
      setSourceNote(
        `${data.sources.filter((s: { status: string }) => s.status !== "failed").length} of ${data.sources.length} stores checked${data.stale ? " · Previous results; refresh failed" : ""}. Exact model, colour and UK size still need verification.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function saveDeal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      const url = new URL(String(data.get("url")));
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error();
      const draft = {
        shoe: data.get("shoe"),
        size: data.get("size"),
        url: url.href,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem("lacerelay-deal-draft", JSON.stringify(draft));
      setPanel(null);
      setNotice(
        "Draft saved on this device. It has not been submitted for review.",
      );
    } catch {
      setError(
        "Use a valid HTTPS retailer link, or check browser storage permissions.",
      );
    }
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="preview-bar">
        <span className="status-dot" /> Private design preview{" "}
        <span className="bar-divider">/</span> Sample prices in INR{" "}
        <button onClick={() => setPanel("about")}>
          How it works <ArrowUpRight size={11} />
        </button>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Main navigation">
            <a className="active" href="#main">
              Discover
            </a>
            <a href="#trending">Trending</a>
            <a href="#community">Community</a>
          </nav>
          <div className="header-actions">
            <Link href="/browse" className="browse-entry">
              Browse by style
            </Link>
            <button
              className="search-trigger"
              aria-label="Search sneakers"
              onClick={openSearch}
            >
              <Search size={15} />
              <span>Search sneakers</span>
              <kbd>/</kbd>
            </button>
            <button
              className="icon-button saved-trigger"
              aria-label={`Saved pairs (${saved.length})`}
              onClick={() => setPanel("saved")}
            >
              <Bookmark size={17} />
              {saved.length > 0 && (
                <span className="saved-count">{saved.length}</span>
              )}
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setPanel("about")}
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div className="container hero-inner">
            <div className="hero-copy">
              <div className="eyebrow">
                <span /> Sneaker price comparison
              </div>
              <h1>
                SAME PAIR<span>.</span>
                <br />
                BETTER PRICE<span>.</span>
              </h1>
              <p>
                Find the lowest listed price for your exact sneaker
                <br className="desktop-break" /> and UK size across Indian
                online stores.
              </p>
              <div className="hero-buttons">
                <button className="button primary" onClick={openSearch}>
                  Compare a pair <ArrowRight size={17} />
                </button>
                <a className="button text-button" href="#trending">
                  Explore trending <ArrowUpRight size={16} />
                </a>
              </div>
            </div>
            <div className="hero-art">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="sparkle large" aria-hidden="true">
                ✦
              </span>
              <span className="sparkle small" aria-hidden="true">
                ✦
              </span>
              <img
                className="hero-shoe"
                src="/shoes/samba.jpg"
                alt="adidas Samba OG in Cloud White with black stripes and gum sole"
                width="1200"
                height="720"
                fetchPriority="high"
              />
              <button className="featured-label" onClick={() => pick(shoes[0])}>
                <span>
                  <small>Featured pair</small>
                  <strong>adidas Samba OG</strong>
                </span>
                <ArrowUpRight size={18} />
              </button>
              <div className="art-caption">THE CLASSIC. RECONSIDERED.</div>
            </div>
          </div>
        </section>
        <BrandStrip />
        <section id="trending" className="container trending-section">
          <div className="section-header">
            <div>
              <div className="eyebrow section-eyebrow">The shortlist / 01</div>
              <h2>
                Trending pairs<span>.</span>
              </h2>
            </div>
            <label className="size-control">
              Your size{" "}
              <select
                aria-label="Your UK shoe size"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              >
                {ukSizes.map((s) => (
                  <option key={s} value={s}>
                    UK {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          <div className="collection-toolbar">
            <p>Good pairs. Better places to find them.</p>
            <div className="filter-pills" aria-label="Filter collection">
              {["All pairs", "Under ₹7,000", "Saved"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={filter === f ? "selected" : ""}
                  aria-pressed={filter === f}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="product-grid">
            {shoes
              .filter((s) =>
                filter === "Saved"
                  ? saved.includes(s.id)
                  : filter === "Under ₹7,000"
                    ? s.price < 7000
                    : true,
              )
              .map((shoe, i) => (
                <ProductCard
                  key={shoe.id}
                  shoe={shoe}
                  index={i}
                  onPick={() => pick(shoe)}
                  saved={saved.includes(shoe.id)}
                  onSave={() => toggleSave(shoe)}
                  price={shoe.price}
                  retailer={shoe.retailer}
                  preview
                />
              ))}
          </div>
          {filter === "Saved" && !saved.length && (
            <div className="empty-state">
              <Bookmark size={24} />
              <h3>A good pair is worth saving.</h3>
              <p>Tap a bookmark to keep your shortlist on this device.</p>
              <button
                className="button outline"
                onClick={() => setFilter("All pairs")}
              >
                Explore pairs <ArrowRight size={16} />
              </button>
            </div>
          )}
          <p className="collection-note">
            An editorial preview, not a live popularity ranking. All displayed
            prices are illustrative.
          </p>
        </section>
        <section id="comparison" className="container comparison-wrap">
          <div className="comparison-panel">
            <div className="comparison-summary">
              <div className="eyebrow">Sample comparison</div>
              <h3>{selected.name}</h3>
              <p>
                {selected.color} <span>·</span> UK {size}
              </p>
              <strong className="comparison-price">
                {offers.length ? money(offers[0].price) : "Size unavailable"}
              </strong>
              <span className="muted">
                {offers.length
                  ? `Sample lowest listed · ${offers[0].retailer}`
                  : "No sample offers for this size"}
              </span>
            </div>
            <div className="offer-column">
              <div className="column-heading">
                <h4>Online offers</h4>
                <span>{offers.length} sample offers</span>
              </div>
              {offers.length ? (
                offers.map((offer, i) => (
                  <a
                    className={`offer-row ${i === 0 ? "best" : ""}`}
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={offer.retailer}
                    aria-label={`Explore ${selected.name} on ${offer.retailer}; sample price ${money(offer.price)}`}
                  >
                    <span>
                      {offer.retailer}
                      {i === 0 && <small>LOWEST</small>}
                    </span>
                    <span className="offer-age">{offer.age}h ago*</span>
                    <strong>{money(offer.price)}</strong>
                    <ArrowUpRight size={13} />
                  </a>
                ))
              ) : (
                <p className="muted offer-empty">
                  Try UK 7 to explore this comparison.
                </p>
              )}
              <p className="offer-disclaimer">
                *Illustrative times. Shipping extra or unknown.
                <br />
                Links may open a retailer search. Verify size and price there.
              </p>
            </div>
            <div className="history-column">
              <div className="column-heading">
                <h4>Price history</h4>
                <span className="sample-tag">Sample</span>
              </div>
              <p>Lowest listed · UK {size} · 30-day illustration</p>
              <div
                className="chart"
                role="img"
                aria-label="Illustrative price history only, not actual recorded prices"
              >
                <svg viewBox="0 0 320 92" preserveAspectRatio="none">
                  <path
                    className="gridline"
                    d="M0 18H320 M0 48H320 M0 78H320"
                  />
                  <path
                    className="history-fill"
                    d="M0 22L45 22L90 45L135 45L180 36L225 52L270 65L320 72V92H0Z"
                  />
                  <path
                    className="history-line"
                    d="M0 22L45 22L90 45L135 45L180 36L225 52L270 65L320 72"
                  />
                  <circle cx="318" cy="72" r="3" />
                </svg>
                <div className="chart-axis">
                  <span>30 days ago</span>
                  <span>Latest</span>
                </div>
              </div>
              <p className="history-disclaimer">
                Real history begins when live tracking is connected.
              </p>
            </div>
          </div>
        </section>
        <section id="community" className="container community-section">
          <div className="community-banner">
            <div>
              <div className="eyebrow">
                <LinkIcon size={13} /> Community finds
              </div>
              <h2>
                Found a lower price<span>?</span>
              </h2>
              <p>Same pair. Same UK size. A better find, passed on.</p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setError("");
                setPanel("deal");
              }}
            >
              Share a deal <ArrowRight size={17} />
            </button>
          </div>
          <div className="trust-row">
            <span>
              <ShieldCheck size={15} /> Exact pair. Clear size evidence.
            </span>
            <span>
              <SlidersHorizontal size={15} /> No card offers disguised as
              prices.
            </span>
            <button onClick={() => setPanel("about")}>
              Built around better decisions <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
      </main>
      <footer className="footer container">
        <Brand />
        <p>Good finds travel.</p>
        <span>
          India <span className="footer-dot">·</span> INR ₹
        </span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      <dialog
        aria-label={
          panel === "search"
            ? "Find your pair"
            : panel === "saved"
              ? "Saved pairs"
              : panel === "deal"
                ? "Prepare a deal draft"
                : "About LaceRelay"
        }
        ref={dialog}
        className={`modal ${panel === "search" ? "search-modal" : ""}`}
        onCancel={() => setPanel(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setPanel(null);
        }}
      >
        <div className="modal-header">
          <span className="eyebrow">
            LaceRelay /{" "}
            {panel === "search"
              ? "Find your pair"
              : panel === "saved"
                ? "Your shortlist"
                : panel === "deal"
                  ? "Community finds"
                  : "The details"}
          </span>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={() => setPanel(null)}
          >
            <X size={20} />
          </button>
        </div>
        {panel === "search" && (
          <>
            <h2>Your pair. Your size.</h2>
            <p className="modal-description">
              Start with a name. We’ll help you find the right version.
            </p>
            <form onSubmit={searchLive}>
              <label className="search-field">
                <Search size={20} />
                <input
                  autoFocus
                  aria-label="Search shoe name"
                  placeholder="Try adidas Samba OG white UK 7"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setListings(null);
                  }}
                  maxLength={100}
                />
                <button type="submit" aria-label="Search" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={20} />
                  ) : (
                    <ArrowRight size={21} />
                  )}
                </button>
              </label>
              <div className="search-options">
                <label>
                  <input
                    type="checkbox"
                    checked={live}
                    onChange={(e) => {
                      setLive(e.target.checked);
                      setError("");
                    }}
                  />{" "}
                  Search live retailers
                </label>
                <label>
                  Size{" "}
                  <select
                    aria-label="Search UK size"
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                  >
                    {ukSizes.map((s) => (
                      <option key={s} value={s}>
                        UK {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {live && (
                <div className="live-access">
                  <label htmlFor="pilot-token">
                    Private pilot access token
                  </label>
                  <input
                    id="pilot-token"
                    type="password"
                    autoComplete="off"
                    placeholder="Access token, not your API key"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <p>
                    Live search currently checks Myntra and Nykaa Fashion. Other
                    stores are planned. Search results need model, colour and
                    size verification.
                  </p>
                </div>
              )}
            </form>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {live && listings !== null ? (
              <>
                <p className="result-label">{sourceNote}</p>
                {listings.length ? (
                  listings.map((item) => (
                    <a
                      key={item.id}
                      className="live-result"
                      href={item.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.retailer} · Match and UK {size} stock
                          unconfirmed
                          {item.observedAt
                            ? ` · Source observed ${new Date(item.observedAt).toLocaleDateString("en-IN")}`
                            : " · Source observation time unknown"}
                        </small>
                      </span>
                      <strong>{money(item.price)}</strong>
                      <ExternalLink size={16} />
                    </a>
                  ))
                ) : (
                  <div className="empty-state">
                    <h3>No matching listings returned.</h3>
                    <p>Try the full model name or another colourway.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="result-label">
                  {query ? "Matching pairs" : "Explore the catalog"}{" "}
                  <span>Check prices on the pair page</span>
                </p>
                {results.length ? (
                  results.map((s) => (
                    <button
                      className="search-result"
                      key={s.id}
                      onClick={() => pick(s)}
                    >
                      <img src={s.image} alt="" width="100" height="60" />
                      <span>
                        <strong>{s.name}</strong>
                        <small>
                          {s.color} · {s.article}
                        </small>
                      </span>
                      <ArrowUpRight size={18} />
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    <Search size={24} />
                    <h3>That pair isn’t in the catalog yet.</h3>
                    <p>
                      Try a model name or article code. Live search checks
                      Myntra and Nykaa Fashion.
                    </p>
                    <button
                      className="button outline"
                      onClick={() => setQuery("")}
                    >
                      See all preview pairs
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {panel === "saved" && (
          <>
            <h2>Your next-pair shortlist.</h2>
            <p className="modal-description">
              Saved privately in this browser. No account needed.
            </p>
            {saved.length ? (
              shoes
                .filter((s) => saved.includes(s.id))
                .map((s) => (
                  <div className="saved-result" key={s.id}>
                    <button className="search-result" onClick={() => pick(s)}>
                      <img src={s.image} alt="" width="100" height="60" />
                      <span>
                        <strong>{s.name}</strong>
                        <small>{s.color}</small>
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => toggleSave(s)}
                      aria-label={`Remove ${s.name}`}
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))
            ) : (
              <div className="empty-state">
                <Bookmark size={28} />
                <h3>Something will catch your eye.</h3>
                <p>Bookmark a pair to keep it here.</p>
                <button
                  className="button primary"
                  onClick={() => {
                    setPanel(null);
                    document
                      .getElementById("trending")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Explore pairs <ArrowRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
        {panel === "deal" && (
          <>
            <h2>A good find deserves company.</h2>
            <p className="modal-description">
              Prepare a deal draft. Community submission and points are not
              active yet; nothing is sent to a server.
            </p>
            <form className="deal-form" onSubmit={saveDeal}>
              <label>
                Exact shoe and colourway
                <input
                  name="shoe"
                  required
                  maxLength={160}
                  defaultValue={`${selected.name} · ${selected.color}`}
                />
              </label>
              <label>
                UK size
                <select name="size" defaultValue={size}>
                  {ukSizes.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Retailer product link
                <input
                  name="url"
                  type="url"
                  required
                  maxLength={2000}
                  placeholder="https://retailer.com/product"
                />
              </label>
              <p>
                <ShieldCheck size={15} /> Verified new finds will earn points
                when community review launches. Drafts earn no points.
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="button primary">
                Save draft on this device <ArrowRight size={17} />
              </button>
            </form>
          </>
        )}
        {panel === "about" && (
          <>
            <h2>
              Less searching.
              <br />
              Better decisions.
            </h2>
            <p className="modal-description">
              LaceRelay is a private pilot for comparing the same sneaker, in
              the same UK size, across Indian online stores.
            </p>
            <div className="about-list">
              <p>
                <strong>01 / Find the exact pair</strong>Model, colourway and
                adult or kids’ edition matter. A similar shoe is not the same
                offer.
              </p>
              <p>
                <strong>02 / Know what the price means</strong>Size-confirmed
                ordinary offers come first. Shipping and bank-card conditions
                stay separate.
              </p>
              <p>
                <strong>03 / Check when it was seen</strong>Live offers expire
                after 48 hours. Source failures never become “no stock.”
              </p>
              <p>
                <strong>This is a design preview</strong>Collection prices,
                availability, rankings and charts are illustrative. Bookmarks
                and deal drafts stay on your device. Live provider access and
                persistent tracking are not connected.
              </p>
            </div>
            <button className="button primary" onClick={openSearch}>
              Find a pair <ArrowRight size={17} />
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
