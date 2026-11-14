"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { Check, X, ArrowLeft } from "lucide-react";
import { looks, type StyleId, type Height } from "@/lib/styles";
import { shoes, ukSizes, money } from "@/lib/catalog";
import {
  browseShoes,
  sizePrices,
  identityFor,
  type BrowseFilters,
} from "@/lib/observations";
import { filterQuery } from "@/lib/browse-state";
import { SiteHeader } from "./site-header";
import { ProductCard } from "./product-card";
import { useObservations } from "./use-observations";
export default function Browse({ initial }: { initial: BrowseFilters }) {
  const [filters, setFilters] = useState(initial);
  const { rows, loading, error, now, reload } = useObservations();
  function update(next: BrowseFilters) {
    setFilters(next);
    window.history.replaceState(
      null,
      "",
      `/browse${filterQuery(next) ? `?${filterQuery(next)}` : ""}`,
    );
  }
  function toggle(id: StyleId) {
    update({
      ...filters,
      styles: filters.styles.includes(id)
        ? filters.styles.filter((s) => s !== id)
        : [...filters.styles, id],
    });
  }
  const matches = browseShoes(shoes, rows, filters, now);
  const chips = [
    ...filters.styles.map((s) => ({
      label: looks.find((l) => l.id === s)!.label,
      remove: () =>
        update({ ...filters, styles: filters.styles.filter((x) => x !== s) }),
    })),
    ...(filters.height
      ? [
          {
            label: filters.height,
            remove: () => update({ ...filters, height: "" }),
          },
        ]
      : []),
    ...(filters.size !== null
      ? [
          {
            label: `UK ${filters.size}`,
            remove: () => update({ ...filters, size: null }),
          },
        ]
      : []),
    ...(filters.budgetPaise !== null
      ? [
          {
            label: `Up to ${money(filters.budgetPaise / 100)}`,
            remove: () => update({ ...filters, budgetPaise: null }),
          },
        ]
      : []),
  ];
  return (
    <>
      <SiteHeader />
      <main className="container feature-page">
        <Link href="/" className="back-link">
          <ArrowLeft size={15} /> Back to discover
        </Link>
        <div className="eyebrow">Find your look</div>
        <h1 className="feature-title">
          Know the look.
          <br />
          Find your pair<span>.</span>
        </h1>
        <p className="feature-intro">
          No sneaker vocabulary required. Choose any looks you like, then narrow
          things down.
        </p>
        <div className="category-row">
          <span>Category</span>
          <button className="category-pill" aria-pressed="true">
            Sneakers <Check size={13} />
          </button>
        </div>
        <div className="style-grid" aria-label="Sneaker looks">
          {looks.map((look) => (
            <button
              key={look.id}
              className={`style-tile ${filters.styles.includes(look.id) ? "chosen" : ""}`}
              aria-pressed={filters.styles.includes(look.id)}
              onClick={() => toggle(look.id)}
            >
              <img
                src={look.image}
                alt={`${look.label} representative sneaker`}
                width="280"
                height="170"
              />
              <span>{look.label}</span>
              <span className="tile-check" aria-hidden="true">
                {filters.styles.includes(look.id) && <Check size={12} />}
              </span>
            </button>
          ))}
        </div>
        <p className="collection-note">
          Looks match either selection. Ankle height is a separate filter.
        </p>
        <div className="browse-filters">
          <label>
            Ankle height
            <select
              aria-label="Ankle height"
              value={filters.height}
              onChange={(e) =>
                update({ ...filters, height: e.target.value as Height | "" })
              }
            >
              <option value="">Any height</option>
              {["Low", "Mid", "High"].map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </label>
          <label>
            UK size
            <select
              aria-label="Browse UK size"
              value={filters.size ?? ""}
              onChange={(e) =>
                update({
                  ...filters,
                  size: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Any size</option>
              {ukSizes.map((s) => (
                <option key={s} value={s}>
                  UK {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Maximum budget (INR)
            <input
              aria-label="Maximum budget in rupees"
              type="number"
              min="1"
              max="1000000"
              step="1"
              placeholder="Any budget"
              value={
                filters.budgetPaise === null ? "" : filters.budgetPaise / 100
              }
              onChange={(e) => {
                const n = Number(e.target.value);
                update({
                  ...filters,
                  budgetPaise:
                    e.target.value && n > 0 && n <= 1000000
                      ? Math.round(n * 100)
                      : null,
                });
              }}
            />
          </label>
        </div>
        <div className="filter-chips">
          {chips.map((c) => (
            <button
              key={c.label}
              onClick={c.remove}
              aria-label={`Remove ${c.label} filter`}
            >
              {c.label}
              <X size={12} />
            </button>
          ))}
          {chips.length > 0 && (
            <button
              className="clear-filters"
              onClick={() =>
                update({
                  styles: [],
                  height: "",
                  size: null,
                  budgetPaise: null,
                })
              }
            >
              Clear all
            </button>
          )}
        </div>
        <div className="browse-results-heading">
          <h2 aria-live="polite">
            {loading
              ? "Loading prices…"
              : `${matches.length} ${matches.length === 1 ? "pair" : "pairs"}`}
          </h2>
          <span>Same colourway. Size-specific prices.</span>
        </div>
        {rows.some((r) => r.fixture) && (
          <p className="fixture-banner">
            TEST FIXTURES — not real retailer prices.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error} <button onClick={reload}>Retry</button>
          </p>
        )}
        {!loading && !rows.length && (
          <p className="data-notice">
            No verified size-level prices have been recorded yet. You can
            explore looks; size and budget filters only include confirmed
            in-stock offers.
          </p>
        )}
        {!loading && (
          <div className="product-grid">
            {matches.map((shoe, i) => {
              const prices = sizePrices(rows, identityFor(shoe), now)
                .filter((p) => filters.size === null || p.size === filters.size)
                .sort((a, b) => a.pricePaise - b.pricePaise);
              const best = prices[0];
              return (
                <ProductCard
                  key={shoe.id}
                  shoe={shoe}
                  index={i}
                  href={`/shoes/${shoe.id}?${filterQuery(filters)}`}
                  price={best ? best.pricePaise / 100 : undefined}
                  retailer={best?.offers.map((o) => o.retailer).join(" / ")}
                />
              );
            })}
          </div>
        )}
        {!loading && !matches.length && (
          <div className="empty-state">
            <h3>No pairs meet all these filters.</h3>
            <p>
              A cheaper price in another size won’t qualify. Remove a filter
              above or clear them to keep exploring.
            </p>
            <button
              className="button outline"
              onClick={() =>
                update({
                  styles: [],
                  height: "",
                  size: null,
                  budgetPaise: null,
                })
              }
            >
              Clear filters
            </button>
          </div>
        )}
      </main>
    </>
  );
}
