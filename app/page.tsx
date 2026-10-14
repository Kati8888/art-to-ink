import { TattooDesignGallery } from "@/components/TattooDesignGallery";
import { tattooDesigns } from "@/lib/mock-data";
import { LICENSES, formatEuro } from "@/lib/products";

export default function HomePage() {
  return <>
    <header className="site-header">
      <nav className="nav-shell" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="ART TO INK — Kateřina Pohnetalová, home">
          <span className="brand-name">ART <em>TO</em> INK</span>
          <span className="brand-subtitle">KATEŘINA POHNETALOVÁ</span>
        </a>
        <div className="nav-links">
          <a href="#gallery">Artwork</a>
          <a href="#licences">Studio licences</a>
          <a href="#artist">The artist</a>
        </div>
        <div className="nav-tools" aria-label="Language and quick links">
          <div className="language-switch" aria-label="Choose language">
            <a href="?lang=en" aria-current="page" lang="en">EN</a>
            <span aria-hidden="true">/</span>
            <a href="?lang=cs" lang="cs">CZ</a>
          </div>
          <a className="nav-icon" href="#gallery" aria-label="Browse artwork" title="Browse artwork">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.2 4.2"/></svg>
          </a>
          <a className="nav-icon" href="#artist" aria-label="Meet the artist" title="Meet the artist">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5.2 20c.4-3.6 3.1-5.8 6.8-5.8s6.4 2.2 6.8 5.8"/></svg>
          </a>
        </div>
      </nav>
    </header>
    <main>
      <section className="hero" id="home"><div className="hero-copy"><span className="eyebrow">Original tattoo art · by Kateřina Pohnetalová</span><h1>Same shape.<br/><em>New story.</em></h1><p>Original artwork created to become personal, meaningful tattoos. Explore each design in colour, black and white, and realistic placement previews.</p><a className="button" href="#gallery">Explore the artwork</a></div></section>
      <section className="section" id="gallery"><div className="section-inner"><div className="section-head"><div><span className="eyebrow">The collection</span><h2>Choose your design</h2></div><p className="muted">Every published design includes clearly labelled image views and transparent, secure digital delivery for the purchased file.</p></div><TattooDesignGallery designs={tattooDesigns}/></div></section>
      <section className="section" id="licences" style={{ background: "linear-gradient(120deg,#15110b,#090908)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}><div className="section-inner"><div className="section-head"><div><span className="eyebrow">For professionals</span><h2>Tattoo studio licences</h2></div><p className="muted">Annual, non-exclusive licences for professional client work. Copyright always remains with the artist.</p></div><div className="licence-grid">{LICENSES.map((licence) => <article className="licence-card" key={licence.id}><span className="eyebrow">{licence.id.replace("-", " ")}</span><h3>{licence.title}</h3><div className="licence-price">{formatEuro(licence.price)} <span className="muted" style={{ fontSize: 13 }}>/ year</span></div><ul><li>{licence.allowance}</li><li>{licence.audience}</li><li>Non-exclusive use for client tattoos</li><li>No resale or redistribution of source files</li></ul><p>{licence.description}</p><form action="/api/checkout" method="post"><input type="hidden" name="type" value="license"/><input type="hidden" name="licenseId" value={licence.id}/><button className="button" type="submit">Choose licence</button></form></article>)}</div><p className="legal-note">The licences do not transfer copyright or grant exclusive rights. The full catalogue licence covers one studio location only. Local tax and consumer-law requirements must be configured before live sales.</p></div></section>
      <section className="section" id="artist"><div className="section-inner"><span className="eyebrow">About the artist</span><h2>One artwork.<br/>A thousand personal stories.</h2><p className="muted" style={{ maxWidth: 720 }}>ART TO INK turns Kateřina Pohnetalová’s original visual art into tattoo designs that clients and artists can explore together. Every design is published only when its matching image variants and downloadable file have been checked.</p></div></section>
    </main><footer className="site-footer"><div className="footer-inner"><span>© ART TO INK · Kateřina Pohnetalová</span><span>Original artwork · Personal meaning · Worldwide collection</span><a href="#home">Back to top ↑</a></div></footer>
  </>;
}
