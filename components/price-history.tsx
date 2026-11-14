"use client";
import { useState } from "react";
import { money, ukSizes, type Shoe } from "@/lib/catalog";
import {
  historyGrid,
  identityFor,
  indiaDay,
  type Observation,
  type HistoryCell,
} from "@/lib/observations";
const colors = ["#9265b4", "#267a79", "#b76c2e"];
export function PriceHistory({
  shoe,
  rows,
  selectedSize,
  now,
}: {
  shoe: Shoe;
  rows: Observation[];
  selectedSize: number;
  now: number;
}) {
  const [sizes, setSizes] = useState([selectedSize]),
    [table, setTable] = useState(false),
    [point, setPoint] = useState<HistoryCell | null>(null);
  const end = indiaDay(new Date(now || 0).toISOString());
  const start = indiaDay(new Date((now || 0) - 29 * 86400000).toISOString());
  const grid = historyGrid(rows, identityFor(shoe), sizes, start, end);
  const all = historyGrid(rows, identityFor(shoe), ukSizes, start, end);
  const prices = grid.flatMap((c) =>
    c.pricePaise === null ? [] : [c.pricePaise],
  );
  const low = prices.length ? Math.min(...prices) : 0,
    high = prices.length ? Math.max(...prices) : 1;
  const x = (day: string) =>
      35 + ((Date.parse(day) - Date.parse(start)) / 86400000) * (630 / 29),
    y = (price: number) =>
      140 - ((price - low) / Math.max(high - low, 100)) * 110;
  return (
    <section className="history-feature">
      <div className="section-header">
        <div>
          <div className="eyebrow">Recorded, never estimated</div>
          <h2>Price history</h2>
        </div>
        <button
          className="button outline"
          aria-expanded={table}
          onClick={() => setTable(!table)}
        >
          All sizes
        </button>
      </div>
      <p className="feature-intro">
        Daily lowest confirmed in-stock price · India calendar days · Last 30
        days. Blank days are gaps, not carried-forward prices.
      </p>
      <fieldset className="history-sizes">
        <legend>Compare up to three UK sizes</legend>
        {ukSizes.map((size) => (
          <label
            key={size}
            style={{
              borderColor: sizes.includes(size)
                ? colors[sizes.indexOf(size)]
                : undefined,
            }}
          >
            <input
              type="checkbox"
              checked={sizes.includes(size)}
              disabled={!sizes.includes(size) && sizes.length === 3}
              onChange={() => {
                setSizes(
                  sizes.includes(size)
                    ? sizes.filter((s) => s !== size)
                    : [...sizes, size],
                );
                setPoint(null);
              }}
            />
            UK {size}
          </label>
        ))}
      </fieldset>
      {!sizes.length ? (
        <p className="data-notice">Select a size to view its history.</p>
      ) : (
        <>
          <div className="history-chart" aria-label="Size price history">
            <svg
              viewBox="0 0 700 175"
              role="img"
              aria-label={`Price history for ${sizes.map((s) => `UK ${s}`).join(", ")}`}
            >
              <path
                className="gridline"
                d="M35 30H665 M35 85H665 M35 140H665"
              />
              {sizes.map((size, i) => {
                const line = grid.filter((c) => c.size === size);
                return (
                  <g key={size} style={{ color: colors[i] }}>
                    {line.map((cell, index) =>
                      cell.pricePaise !== null ? (
                        <g key={cell.day}>
                          {index > 0 && line[index - 1].pricePaise !== null && (
                            <line
                              x1={x(line[index - 1].day)}
                              y1={y(line[index - 1].pricePaise!)}
                              x2={x(cell.day)}
                              y2={y(cell.pricePaise)}
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          )}
                          <circle
                            cx={x(cell.day)}
                            cy={y(cell.pricePaise)}
                            r="4"
                            fill="currentColor"
                          >
                            <title>{`UK ${size}, ${cell.day}, ${money(cell.pricePaise / 100)}`}</title>
                          </circle>
                        </g>
                      ) : cell.status === "sold_out" ? (
                        <text
                          key={cell.day}
                          x={x(cell.day)}
                          y={158}
                          fontSize="13"
                          textAnchor="middle"
                          fill="currentColor"
                        >
                          ×
                        </text>
                      ) : null,
                    )}
                  </g>
                );
              })}
              <text x="35" y="172" fontSize="9" fill="#737077">
                {start}
              </text>
              <text
                x="665"
                y="172"
                fontSize="9"
                textAnchor="end"
                fill="#737077"
              >
                {end}
              </text>
            </svg>
          </div>
          {prices.length === 0 && (
            <p className="data-notice">
              No confirmed in-stock price points for these sizes in this period.
            </p>
          )}
          <div className="history-legend">
            {sizes.map((s, i) => (
              <span key={s} style={{ color: colors[i] }}>
                ● UK {s}
              </span>
            ))}
            <span>× Observed sold out · blank = no confirmed observation</span>
          </div>
          <div
            className="history-points"
            aria-label="Inspect recorded history points"
          >
            {grid
              .filter((c) => c.status !== "no_observation")
              .map((c) => (
                <button
                  key={`${c.day}-${c.size}`}
                  onClick={() => setPoint(c)}
                  aria-pressed={point?.day === c.day && point?.size === c.size}
                >
                  {c.day} · UK {c.size} ·{" "}
                  {c.pricePaise === null
                    ? "Observed sold out"
                    : money(c.pricePaise / 100)}
                </button>
              ))}
          </div>
          {point && (
            <div className="point-evidence" role="status">
              <strong>
                {point.day} · UK {point.size} ·{" "}
                {point.pricePaise === null
                  ? "Observed sold out"
                  : money(point.pricePaise / 100)}
              </strong>
              {point.evidence.map((e) => (
                <p key={e.id}>
                  {e.retailer} ·{" "}
                  {new Date(e.observedAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST · Variant {e.variantId}
                </p>
              ))}
            </div>
          )}
        </>
      )}
      {table && (
        <div className="all-sizes">
          <h3>All UK sizes</h3>
          <p>
            Scroll horizontally on small screens. “—” means no confirmed
            observation; “Sold out” is an observed state.
          </p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="All sizes daily history"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">India day</th>
                  {ukSizes.map((s) => (
                    <th scope="col" key={s}>
                      UK {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Set(all.map((c) => c.day))].reverse().map((day) => (
                  <tr key={day}>
                    <th scope="row">{day}</th>
                    {ukSizes.map((s) => {
                      const cell = all.find(
                        (c) => c.day === day && c.size === s,
                      )!;
                      return (
                        <td key={s}>
                          {cell.status === "no_observation" ? (
                            "—"
                          ) : (
                            <button onClick={() => setPoint(cell)}>
                              {cell.pricePaise === null
                                ? "Sold out"
                                : money(cell.pricePaise / 100)}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
