import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuth } from '../store';
import { formatINR } from '../lib/productPresentation';

gsap.registerPlugin(ScrollTrigger);

const trustedBrands = ['Reliance Fresh', 'Daily Mart', 'Urban Kirana', 'FreshCart', 'CounterPay'];

const heroMetrics = [
  { value: 42, suffix: '%', label: 'faster counter checkout' },
  { value: 7, suffix: 'd', label: 'live inventory history' },
  { value: 3.8, prefix: '₹', suffix: 'L', label: 'demo monthly GMV tracked' },
];

const features = [
  {
    kicker: 'Catalog',
    title: 'Launch buyer-ready listings in minutes',
    body: 'Add products, categories, pricing, stock thresholds, photos, SKUs, and QR storefront links from one owner workspace.',
  },
  {
    kicker: 'Inventory',
    title: 'Sell without stock anxiety',
    body: 'Atomic stock updates, low-stock states, and audit logs keep every shelf movement traceable across cash and online orders.',
  },
  {
    kicker: 'Checkout',
    title: 'Razorpay and cash in the same flow',
    body: 'Let shoppers pay online or at the counter while orders, receipts, and revenue analytics stay connected.',
  },
  {
    kicker: 'Analytics',
    title: 'Know what sells before the day ends',
    body: 'Track revenue, top sellers, low-stock items, and order velocity with dashboards built for fast owner decisions.',
  },
];

const steps = [
  ['01', 'Create your store', 'Set location, contact details, categories, and the catalog structure your team already uses.'],
  ['02', 'List products', 'Publish polished product cards with stock status, photos, prices, and QR-ready buyer paths.'],
  ['03', 'Sell everywhere', 'Customers scan, browse, pay, and receive receipts while your inventory updates in real time.'],
];

const benefits = [
  'Premium storefront without building a custom website',
  'Clear product presentation that increases buyer confidence',
  'Operational visibility for stock, payments, and daily sales',
  'Self-hostable stack with one app for owners and shoppers',
];

const faqs = [
  ['Can customers buy without logging in?', 'Yes. QR storefront shoppers can browse and check out anonymously, while logged-in customers can keep order history.'],
  ['Does stock update automatically?', 'Yes. Stock is decremented during checkout and every movement is recorded in the inventory log.'],
  ['Can I accept cash orders?', 'Yes. Storeapp supports cash and Razorpay so online and counter sales stay in one system.'],
  ['Is this built for small shops or larger teams?', 'Both. The flow is simple for one shop, and the data model already supports owners, staff, stores, products, and orders.'],
];

const showcaseProducts = [
  {
    name: 'Kurkure Masala 90g',
    category: 'Snacks',
    price: 20,
    stock: 'Low stock',
    img: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=600&q=82',
  },
  {
    name: 'Coca-Cola 750ml',
    category: 'Drinks',
    price: 40,
    stock: 'In stock',
    img: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=82',
  },
  {
    name: 'Dairy Milk 50g',
    category: 'Snacks',
    price: 45,
    stock: 'In stock',
    img: 'https://images.unsplash.com/photo-1548907040-4baa42d10919?auto=format&fit=crop&w=600&q=82',
  },
];

export default function Landing() {
  const token = useAuth((s) => s.token);
  const nav = useNavigate();
  const rootRef = useRef(null);

  useEffect(() => {
    if (token) nav('/admin', { replace: true });
  }, [token, nav]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      if (reduceMotion) {
        gsap.set('[data-reveal], .hero-line > span, .showcase-panel, .hero-metric', {
          opacity: 1,
          y: 0,
          clearProps: 'transform',
        });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.landing-nav', { y: -18, opacity: 0, duration: 0.55 })
        .from('.hero-kicker', { y: 14, opacity: 0, duration: 0.55 }, '-=0.2')
        .from('.hero-line > span', { yPercent: 110, duration: 0.9, stagger: 0.08 }, '-=0.1')
        .from('.hero-copy, .hero-cta-row, .hero-trust', { y: 20, opacity: 0, duration: 0.65, stagger: 0.08 }, '-=0.35')
        .from('.showcase-panel', { y: 34, opacity: 0, scale: 0.985, duration: 0.8 }, '-=0.35')
        .from('.hero-metric', { y: 18, opacity: 0, duration: 0.55, stagger: 0.06 }, '-=0.4');

      gsap.to('.scroll-progress-bar', {
        scaleX: 1,
        transformOrigin: 'left center',
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.2,
        },
      });

      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 34, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 84%' },
          }
        );
      });

      gsap.utils.toArray('.float-ui').forEach((el, index) => {
        gsap.to(el, {
          y: index % 2 ? -10 : 10,
          duration: 2.8 + index * 0.25,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });

      gsap.to('.inventory-ribbon-track', {
        xPercent: -50,
        duration: 24,
        ease: 'none',
        repeat: -1,
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="landing-v2" ref={rootRef}>
      <div className="scroll-progress" aria-hidden="true">
        <div className="scroll-progress-bar" />
      </div>

      <header className="landing-nav">
        <Link to="/" className="landing-brand" aria-label="Storeapp home">
          <span className="landing-brand-mark">S</span>
          <span>Storeapp</span>
        </Link>
        <nav aria-label="Primary navigation">
          <a href="#features">Features</a>
          <a href="#showcase">Listings</a>
          <a href="#analytics">Analytics</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="landing-nav-actions">
          <Link to="/login"><button className="btn-v2 subtle">Log in</button></Link>
          <Link to="/register"><button className="btn-v2 dark">Start Selling</button></Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-content">
            <span className="hero-kicker">QR storefronts · live stock · owner analytics</span>
            <h1>
              <span className="hero-line"><span>Storefront OS</span></span>
              <span className="hero-line"><span>for local retailers</span></span>
            </h1>
            <p className="hero-copy">
              Turn every shelf into a shoppable product listing, every QR scan into an order path,
              and every sale into reliable inventory intelligence.
            </p>
            <div className="hero-cta-row">
              <Link to="/register"><button className="btn-v2 primary">Start Selling</button></Link>
              <Link to="/shop"><button className="btn-v2 glass">View Demo</button></Link>
            </div>
            <div className="hero-trust" aria-label="Trust indicators">
              <span>Built for owner-led stores</span>
              <span>Razorpay-ready</span>
              <span>Atomic inventory</span>
            </div>
          </div>

          <HeroShowcase />

          <div className="hero-metrics" aria-label="Storeapp platform statistics">
            {heroMetrics.map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
          </div>
        </section>

        <section className="trusted-strip" data-reveal>
          <span>Trusted marketplace patterns for modern stores</span>
          <div>
            {trustedBrands.map((brand) => (
              <strong key={brand}>{brand}</strong>
            ))}
          </div>
        </section>

        <section className="landing-section" id="features">
          <SectionHeader
            eyebrow="Owner command center"
            title="A polished selling system, not just a catalog."
            body="The landing page, listing cards, checkout, and dashboards are designed as one conversion path for shop owners and their customers."
          />
          <div className="feature-v2-grid" data-reveal>
            {features.map((feature) => (
              <article key={feature.title} className="feature-v2-card">
                <span>{feature.kicker}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section split-band" id="how-it-works">
          <SectionHeader
            eyebrow="How it works"
            title="From counter to checkout in three clean steps."
            body="Designed around the real workflow of a shop owner: create the store, list inventory, then let customers buy through a QR-first storefront."
          />
          <div className="steps-v2" data-reveal>
            {steps.map(([num, title, body]) => (
              <article key={num}>
                <span>{num}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section product-showcase-section" id="showcase">
          <SectionHeader
            eyebrow="Product showcase"
            title="Listings that look credible before a buyer taps."
            body="High-quality imagery, category context, ratings, stock status, price clarity, and quick actions make products feel ready for purchase."
          />
          <div className="showcase-listings" data-reveal>
            {showcaseProducts.map((product) => (
              <article key={product.name} className="showcase-product-card">
                <img src={product.img} alt={product.name} loading="lazy" />
                <div>
                  <span>{product.category}</span>
                  <h3>{product.name}</h3>
                  <div>
                    <strong>{formatINR(product.price)}</strong>
                    <small>{product.stock}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section benefits-section">
          <div className="benefits-copy" data-reveal>
            <span className="section-eyebrow">Benefits for shop owners</span>
            <h2>Look bigger, sell faster, operate with less guesswork.</h2>
            <p>
              Storeapp gives small and mid-sized retailers the product presentation quality of a
              national marketplace while preserving the speed of counter sales.
            </p>
            <Link to="/register"><button className="btn-v2 primary">Start Selling</button></Link>
          </div>
          <div className="benefits-list" data-reveal>
            {benefits.map((benefit) => (
              <div key={benefit}>
                <span aria-hidden="true" />
                <p>{benefit}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section analytics-section" id="analytics">
          <SectionHeader
            eyebrow="Analytics dashboard preview"
            title="Owner-grade reporting without enterprise complexity."
            body="Daily revenue, top sellers, payment mix, and low-stock alerts stay visible in one calm, scannable dashboard."
          />
          <AnalyticsPreview />
        </section>

        <section className="landing-section testimonials-section">
          <SectionHeader
            eyebrow="Social proof"
            title="Built for the pace of real stores."
            body="Owners need systems that feel trustworthy at first glance and stay fast during rush hours."
          />
          <div className="testimonial-grid" data-reveal>
            <Testimonial
              quote="The product listing finally looks like something my customers trust. The stock status alone saves counter confusion."
              name="Aarav Mehta"
              role="Grocery owner, Mumbai"
            />
            <Testimonial
              quote="We can publish items, share the QR, and see sales without stitching together three different tools."
              name="Neha Rao"
              role="Store operator, Pune"
            />
            <Testimonial
              quote="It has the polish of a marketplace, but the workflow still feels made for a shop floor."
              name="Kiran Shah"
              role="Retail manager, Bengaluru"
            />
          </div>
        </section>

        <section className="landing-section faq-section" id="faq">
          <SectionHeader
            eyebrow="FAQ"
            title="Questions shop owners ask before going live."
            body="Clear answers for the moments that decide whether a retailer trusts the platform."
          />
          <div className="faq-grid" data-reveal>
            {faqs.map(([q, a]) => (
              <article key={q}>
                <h3>{q}</h3>
                <p>{a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="final-cta" data-reveal>
          <span>Ready to list your first shelf?</span>
          <h2>Launch a premium storefront for your shop today.</h2>
          <div>
            <Link to="/register"><button className="btn-v2 primary">Start Selling</button></Link>
            <Link to="/shop"><button className="btn-v2 glass">View Demo</button></Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <strong>Storeapp</strong>
        <span>QR storefronts, inventory, checkout, and analytics for modern retailers.</span>
        <Link to="/admin">Owner dashboard</Link>
      </footer>
    </div>
  );
}

function HeroShowcase() {
  return (
    <div className="showcase-panel" aria-label="Animated Storeapp dashboard and product showcase">
      <div className="dashboard-topline">
        <div>
          <span>Owner dashboard</span>
          <strong>Reliance Fresh Andheri</strong>
        </div>
        <div className="dashboard-status">Live</div>
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-card revenue-card float-ui">
          <span>Today revenue</span>
          <strong>₹48,220</strong>
          <small>+18.4% vs yesterday</small>
        </div>
        <div className="dashboard-card chart-card">
          <div className="chart-head">
            <span>14-day sales</span>
            <strong>₹3.8L</strong>
          </div>
          <div className="bar-chart" aria-hidden="true">
            {[42, 58, 48, 72, 64, 82, 74, 90, 68, 78].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="dashboard-card orders-card float-ui">
          <span>Orders</span>
          <strong>186</strong>
          <small>Razorpay + cash</small>
        </div>
        <div className="dashboard-card product-feed-card">
          <div className="chart-head">
            <span>Top listings</span>
            <strong>Live stock</strong>
          </div>
          {showcaseProducts.map((product) => (
            <div key={product.name} className="mini-product-row">
              <img src={product.img} alt="" loading="lazy" />
              <div>
                <strong>{product.name}</strong>
                <span>{product.category} · {formatINR(product.price)}</span>
              </div>
              <small>{product.stock}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="inventory-ribbon" aria-hidden="true">
        <div className="inventory-ribbon-track">
          {['Inventory synced', 'QR storefront live', 'Low-stock alerts', 'Razorpay ready', 'Receipt generated', 'Top sellers updated', 'Inventory synced', 'QR storefront live'].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ value, prefix = '', suffix = '', label }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      el.textContent = `${prefix}${value}${suffix}`;
      return;
    }

    const state = { value: 0 };
    const tween = gsap.to(state, {
      value,
      duration: 1.2,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate: () => {
        const next = Number.isInteger(value) ? Math.round(state.value) : state.value.toFixed(1);
        el.textContent = `${prefix}${next}${suffix}`;
      },
    });
    return () => tween.kill();
  }, [value, prefix, suffix]);

  return (
    <div className="hero-metric">
      <strong ref={ref}>{prefix}0{suffix}</strong>
      <span>{label}</span>
    </div>
  );
}

function SectionHeader({ eyebrow, title, body }) {
  return (
    <div className="section-header-v2" data-reveal>
      <span className="section-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function AnalyticsPreview() {
  return (
    <div className="analytics-preview" data-reveal>
      <div className="analytics-main">
        <div className="analytics-head">
          <div>
            <span>Revenue</span>
            <strong>₹1,28,460</strong>
          </div>
          <small>Last 30 days</small>
        </div>
        <div className="analytics-line" aria-hidden="true">
          {[36, 44, 42, 58, 62, 54, 74, 82, 78, 88, 92, 86].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="analytics-side">
        <div>
          <span>Top seller</span>
          <strong>Coca-Cola 750ml</strong>
          <small>312 units</small>
        </div>
        <div>
          <span>Low stock</span>
          <strong>2 products</strong>
          <small>Restock before evening rush</small>
        </div>
        <div>
          <span>Payment mix</span>
          <strong>68% online</strong>
          <small>Razorpay, cash</small>
        </div>
      </div>
    </div>
  );
}

function Testimonial({ quote, name, role }) {
  return (
    <article>
      <p>"{quote}"</p>
      <div>
        <strong>{name}</strong>
        <span>{role}</span>
      </div>
    </article>
  );
}
