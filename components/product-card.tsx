/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight, Bookmark } from "lucide-react";
import { money, type Shoe } from "@/lib/catalog";
export function ProductCard({
  shoe,
  index = 0,
  href,
  onPick,
  saved,
  onSave,
  price,
  retailer,
  preview = false,
}: {
  shoe: Shoe;
  index?: number;
  href?: string;
  onPick?: () => void;
  saved?: boolean;
  onSave?: () => void;
  price?: number;
  retailer?: string;
  preview?: boolean;
}) {
  const content = (
    <>
      <img
        src={shoe.image}
        width="800"
        height="480"
        alt={`${shoe.name}, ${shoe.color}`}
        loading="lazy"
      />
      <span className="card-action">
        Compare pair <ArrowUpRight size={16} />
      </span>
    </>
  );
  return (
    <article className="product-card">
      <div className={`product-image ${shoe.tone}`}>
        {href ? (
          <Link
            className="product-open"
            href={href}
            aria-label={`Compare ${shoe.name}`}
          >
            {content}
          </Link>
        ) : (
          <button
            className="product-open"
            onClick={onPick}
            aria-label={`Compare ${shoe.name}`}
          >
            {content}
          </button>
        )}
        {onSave && (
          <button
            className={`save-button ${saved ? "is-saved" : ""}`}
            aria-label={`${saved ? "Unsave" : "Save"} ${shoe.name}`}
            aria-pressed={!!saved}
            onClick={onSave}
          >
            <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
          </button>
        )}
        <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="product-info">
        {href ? (
          <Link className="product-title" href={href}>
            {shoe.name}
          </Link>
        ) : (
          <button onClick={onPick}>{shoe.name}</button>
        )}
        <p>{shoe.color}</p>
        <div className="product-price">
          {price !== undefined ? (
            <>
              <strong>{money(price)}</strong>
              <span>
                {preview ? "at " : "at "}
                {retailer}
              </span>
            </>
          ) : (
            <span>No confirmed price for these filters</span>
          )}
        </div>
      </div>
    </article>
  );
}
