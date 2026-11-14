"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Info } from "lucide-react";
import { money, ukSizes, type Shoe } from "@/lib/catalog";
import { compareOffers } from "@/lib/comparison";
import {
  currentRows,
  identityFor,
  sizeTax,
  type BrowseFilters,
} from "@/lib/observations";
import { filterQuery } from "@/lib/browse-state";
import { useObservations } from "./use-observations";
import { SiteHeader } from "./site-header";
import { PriceHistory } from "./price-history";
export default function ShoeDetail({
  shoe,
  filters,
}: {
  shoe: Shoe;
  filters: BrowseFilters;
}) {
  const [size, setSize] = useState(filters.size ?? 7),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshMessage, setRefreshMessage] = useState("");
  const { rows, loading, error, now, reload } = useObservations(shoe.id);
  const identity = identityFor(shoe),
    offers = compareOffers(currentRows(rows, identity, now), size, now),
    tax = sizeTax(rows, identity, size, now);
  async function refresh(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`/api/shoes/${shoe.id}/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRefreshMessage(
        data.sources
          .map(
            (s: {
              retailer: string;
              status: string;
              limitation: string | null;
            }) =>
              `${s.retailer}: ${s.status}${s.limitation ? ` — ${s.limitation}` : ""}`,
          )
          .join(". "),
      );
      await reload();
    } catch (e) {
      setRefreshMessage(
        e instanceof Error ? e.message : "Could not refresh prices",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="container feature-page">
        <Link className="back-link" href={`/browse?${filterQuery(filters)}`}>
          <ArrowLeft size={15} /> Back to your looks
        </Link>
        <div className="detail-top">
          <div className={`detail-image product-image ${shoe.tone}`}>
            <img
              src={shoe.image}
              alt={`${shoe.name}, ${shoe.color}`}
              width="800"
              height="480"
            />
          </div>
          <div>
            <div className="eyebrow">Exact pair / {shoe.article}</div>
            <h1 className="detail-title">{shoe.name}</h1>
            <p className="feature-intro">
              {shoe.color} · {shoe.edition} · {shoe.range} · {shoe.height} ankle
            </p>
            <label className="detail-size">
              Your UK size
              <select
                aria-label="Detail UK size"
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
            <div className="size-tax" aria-live="polite">
              <div className="eyebrow">
                <Info size={13} /> Size Tax
              </div>
              {loading ? (
                <p>Loading size prices…</p>
              ) : tax.status === "unavailable" ? (
                <h3>Size Tax unavailable for UK {size}</h3>
              ) : tax.status === "one-size" ? (
                <>
                  <h3>Only one size priced</h3>
                  <p>
                    UK {size} · {money(tax.mine.pricePaise / 100)} at{" "}
                    {tax.mine.offers.map((o) => o.retailer).join(" / ")}
                  </p>
                </>
              ) : (
                <>
                  <h3>
                    {money(tax.differencePaise / 100)} size price difference
                  </h3>
                  <p>
                    Your UK {size}:{" "}
                    <strong>{money(tax.mine.pricePaise / 100)}</strong> at{" "}
                    {tax.mine.offers.map((o) => o.retailer).join(" / ")}
                  </p>
                  <p>
                    Lowest:{" "}
                    {tax.benchmarks
                      .map(
                        (b) =>
                          `UK ${b.size}: ${money(b.pricePaise / 100)} at ${b.offers.map((o) => o.retailer).join(" / ")}`,
                      )
                      .join("; ")}
                  </p>
                </>
              )}
              <small>
                This compares size prices. It is not an extra checkout charge.
                Ordinary in-stock listed prices only; delivery may cost extra.
              </small>
            </div>
          </div>
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
        <section className="detail-offers">
          <div className="section-header">
            <h2>Compare stores</h2>
            <span>UK {size} · INR listed prices</span>
          </div>
          {loading ? (
            <p className="data-notice">Loading retailer observations…</p>
          ) : offers.confirmed.length ? (
            offers.confirmed.map((o) => (
              <a
                className="offer-row"
                key={o.id}
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>
                  {o.retailer}
                  {offers.winners.some((w) => w.id === o.id) && (
                    <small>LOWEST</small>
                  )}
                </span>
                <span className="offer-age">
                  Observed{" "}
                  {new Date(o.observedAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST
                </span>
                <strong>{money(o.pricePaise / 100)}</strong>
                <ArrowUpRight size={14} />
              </a>
            ))
          ) : (
            <p className="data-notice">
              No eligible confirmed in-stock offers for UK {size}. No verified
              size-level retailer data is available for this selection.
            </p>
          )}
          {offers.unconfirmed.length > 0 && (
            <details>
              <summary>
                Size-unconfirmed listings ({offers.unconfirmed.length})
              </summary>
              {offers.unconfirmed.map((o) => (
                <p key={o.id}>
                  {o.retailer} · {money(o.pricePaise / 100)} · Check UK {size}{" "}
                  on retailer
                </p>
              ))}
            </details>
          )}
          <p className="collection-note">
            Unknown size, expired observations, conditional discounts and
            ambiguous matches cannot set the lowest price or Size Tax.
          </p>
          <details className="refresh-control">
            <summary>Check live prices</summary>
            <form onSubmit={refresh}>
              <label>
                Private pilot access token
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Not your provider API key"
                />
              </label>
              <button className="button outline" disabled={busy}>
                {busy ? "Checking…" : "Refresh checked retailers"}
              </button>
            </form>
            <p>
              Requires a connected verified retailer listing. Under 24 hours,
              existing observations are reused. Refreshes record every UK size
              supplied, not just UK {size}.
            </p>
            {refreshMessage && <p role="status">{refreshMessage}</p>}
          </details>
        </section>
        {now > 0 && (
          <PriceHistory
            key={size}
            shoe={shoe}
            rows={rows}
            selectedSize={size}
            now={now}
          />
        )}
      </main>
    </>
  );
}
