"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

const brands = [
  "Nike",
  "adidas",
  "PUMA",
  "ASICS",
  "Converse",
  "New Balance",
  "Reebok",
  "Vans",
  "Skechers",
  "Jordan",
  "On",
  "Under Armour",
];
const stores = [
  "Amazon",
  "Flipkart",
  "Myntra",
  "AJIO",
  "Nykaa Fashion",
  "Tata CLiQ",
  "Superkicks",
  "VegNonVeg",
  "Foot Locker",
  "Sports Station",
  "Shoppers Stop",
  "Lifestyle",
];

export function BrandStrip() {
  const [paused, setPaused] = useState(false);
  return (
    <section
      className="brand-showcase"
      aria-label="Footwear brands and planned shopping coverage"
    >
      <div className="container">
        <div className="brand-showcase-heading">
          <span>Great pairs. A wider world.</span>
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            aria-pressed={paused}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? "Play" : "Pause"}
          </button>
        </div>
        {[
          { label: "Footwear brands", items: brands },
          { label: "Shopping destinations", items: stores },
        ].map(({ label, items }) => (
          <div className="brand-showcase-row" key={label}>
            <span className="brand-showcase-label">{label}</span>
            <div
              className="brand-marquee-window"
              tabIndex={0}
              aria-label={`${label}. Focus to pause scrolling.`}
            >
              <div
                className={`brand-marquee-track${paused ? " is-paused" : ""}`}
              >
                {[0, 1].map((copy) => (
                  <ul
                    className="brand-marquee-group"
                    key={copy}
                    aria-hidden={copy === 1 ? true : undefined}
                  >
                    {items.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>
          </div>
        ))}
        <p className="brand-coverage-note">
          Coverage roadmap · Live search: Myntra + Nykaa Fashion. Other names
          show planned coverage; availability varies by pair.
        </p>
      </div>
    </section>
  );
}
