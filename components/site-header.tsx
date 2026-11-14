import Link from "next/link";
import { Search } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="LaceRelay home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      LaceRelay
    </Link>
  );
}
export function SiteHeader() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Brand />
        <nav aria-label="Main navigation">
          <Link href="/">Discover</Link>
          <Link href="/#trending">Trending</Link>
          <Link href="/#community">Community</Link>
        </nav>
        <div className="header-actions">
          <Link className="browse-entry" href="/browse">
            Browse by style
          </Link>
          <Link
            className="icon-button"
            href="/?search=1"
            aria-label="Search sneakers"
          >
            <Search size={17} />
          </Link>
        </div>
      </div>
    </header>
  );
}
