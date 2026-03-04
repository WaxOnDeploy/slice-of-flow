import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/* ============================================================
 * DESIGN: The Conductor's Platform (Concept C)
 * Navy (#0B1D3A) + Brass (#B8860B) + Off-white (#FAFAF5) + Vermillion (#E23D28)
 * Typography: Space Grotesk (display), DM Sans (body), Space Mono (accents)
 * Fatal Five section uses Dispatch Board (Concept A) palette
 * ============================================================ */

// CDN URLs for Jeff's photos
const PHOTOS = {
  blazer: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/headshot-blazer_814e01cd.jpg",
  blazerWarm: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/headshot-blazer-warm_6b619efe.jpg",
  blueshirt: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/headshot-blueshirt_3e0fad17.jpg",
  blueshirtCasual: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/headshot-blueshirt-casual_cdbac4a5.jpg",
  quarterzip: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/headshot-quarterzip_b554cee2.jpg",
  quarterzipConcrete: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/headshot-quarterzip-concrete_5dc5dc85.jpg",
  speaking: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/speaking-stage_5a1bf21a.jpg",
  ems1: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/ems-firestation-1_0f3dbf5a.jpg",
  ems2: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/ems-firestation-2_790bfdf1.jpg",
};

const IMAGES = {
  heroStation: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/hero-station_1b837b2e.jpg",
  departureBoard: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/departure-board-bg_a37c2dec.jpg",
  dispatchOps: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/dispatch-ops-bg_6bc3e4a2.jpg",
  armoryTools: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/armory-tools-bg_f9990731.jpg",
  tracks: "https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/tracks-perspective_f0326484.jpg",
};

// Scroll-triggered animation hook
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// Split-flap text component
function FlapText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split("").map((ch, i) =>
        ch === " " ? (
          <span key={i} style={{ width: "0.4em", display: "inline-block" }} />
        ) : (
          <span key={i} className="flap-char">{ch}</span>
        )
      )}
    </span>
  );
}

// Platform number badge
function PlatformBadge({ num }: { num: number }) {
  return (
    <span className="platform-badge text-brass shrink-0">{num}</span>
  );
}

// Brass horizontal rule
function BrassRule() {
  return <div className="brass-rule w-full my-8" />;
}

// Navigation
const NAV_ITEMS = [
  { label: "Home", href: "#hero" },
  { label: "About", href: "#about" },
  { label: "Articles", href: "#articles" },
  { label: "Fatal Five", href: "#fatal-five" },
  { label: "The Armory", href: "#armory" },
  { label: "Shop", href: "#shop" },
  { label: "Contact", href: "#contact" },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const handleClick = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[oklch(0.14_0.04_250/0.95)] backdrop-blur-md shadow-lg"
          : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between py-4">
        {/* Logo */}
        <button onClick={() => handleClick("#hero")} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brass flex items-center justify-center">
            <span className="font-mono text-brass font-bold text-sm">RC</span>
          </div>
          <span className="font-display font-bold text-lg tracking-wide text-offwhite hidden sm:block">
            RELEASE TRAIN CHRONICLES
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleClick(item.href)}
              className="station-nav-item text-offwhite/80 hover:text-brass transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden text-offwhite p-2"
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M6 6l12 12M6 18L18 6" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-[oklch(0.14_0.04_250/0.98)] backdrop-blur-md border-t border-border">
          <div className="container py-4 flex flex-col gap-3">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.label}
                onClick={() => handleClick(item.href)}
                className="station-nav-item text-offwhite/80 hover:text-brass text-left py-3"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── HERO SECTION ───
function HeroSection() {
  const anim = useInView(0.1);
  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={IMAGES.heroStation}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.10_0.04_250/0.92)] via-[oklch(0.10_0.04_250/0.75)] to-[oklch(0.10_0.04_250/0.50)]" />
      </div>

      <div
        ref={anim.ref}
        className={`container relative z-10 pt-24 pb-16 fade-in-up ${anim.visible ? "visible" : ""}`}
      >
        <div className="max-w-2xl">
          {/* Departure board style tagline */}
          <div className="mb-6">
            <FlapText text="NOW BOARDING" className="text-sm tracking-[0.3em]" />
          </div>

          <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl text-offwhite leading-[1.05] mb-6">
            Release Train<br />
            <span className="text-brass">Chronicles</span>
          </h1>

          <p className="font-sans text-xl sm:text-2xl text-offwhite/80 leading-relaxed mb-4 max-w-xl">
            Agile leadership from the trenches. Battle-tested strategies for Scrum Masters, RTEs, and program leaders who ship.
          </p>

          <p className="font-mono text-sm text-brass/70 mb-10 tracking-wide">
            BY JEFF BOURKE &middot; PMP &middot; PMI-ACP &middot; CSM &middot; SAFe RTE &middot; SDP
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => document.querySelector("#armory")?.scrollIntoView({ behavior: "smooth" })}
              className="font-display font-semibold text-sm uppercase tracking-wider bg-vermillion hover:bg-vermillion-light text-white px-8 py-4 transition-colors"
            >
              Enter The Armory
            </button>
            <button
              onClick={() => document.querySelector("#articles")?.scrollIntoView({ behavior: "smooth" })}
              className="font-display font-semibold text-sm uppercase tracking-wider border-2 border-brass text-brass hover:bg-brass hover:text-navy px-8 py-4 transition-colors"
            >
              Read Articles
            </button>
          </div>
        </div>
      </div>

      {/* Brass rule at bottom */}
      <div className="absolute bottom-0 left-0 right-0 brass-rule" />
    </section>
  );
}

// ─── DEPARTURE BOARD TICKER ───
function DepartureTicker() {
  const items = [
    "PLATFORM 1 → Thought Leadership",
    "PLATFORM 2 → The Fatal Five",
    "PLATFORM 3 → The Armory",
    "PLATFORM 4 → The Shop",
    "NEW → Sprint Hygiene Playbook Available",
    "NEW → Retro-in-a-Box: Firehouse Edition",
  ];

  return (
    <div className="bg-navy overflow-hidden border-y border-brass/20">
      <div className="flex animate-[scroll_40s_linear_infinite] whitespace-nowrap py-3">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="font-mono text-xs text-brass/60 mx-10 tracking-wider uppercase flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brass/30 shrink-0" />
            {item}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ─── ABOUT SECTION ───
function AboutSection() {
  const anim = useInView();
  return (
    <section id="about" className="bg-background py-24">
      <div className="container">
        <div ref={anim.ref} className={`fade-in-up ${anim.visible ? "visible" : ""}`}>
          {/* Section header */}
          <div className="flex items-center gap-4 mb-12">
            <PlatformBadge num={0} />
            <div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-offwhite">
                About the Conductor
              </h2>
              <p className="font-mono text-xs text-brass/60 tracking-wider mt-1">THE PERSON BEHIND THE PLATFORM</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-12 items-start">
            {/* Photo column */}
            <div className="lg:col-span-2">
              <div className="relative">
                <img
                  src={PHOTOS.blazer}
                  alt="Jeff Bourke"
                  className="w-full max-w-lg object-contain"
                  style={{ aspectRatio: "3/4" }}
                />
                <div className="absolute bottom-0 left-0 right-0 max-w-lg bg-gradient-to-t from-[oklch(0.14_0.04_250)] to-transparent h-24" />
              </div>
              {/* Credentials row */}
              <div className="flex flex-wrap gap-2 mt-6 max-w-lg">
                {["PMP", "PMI-ACP", "CSM", "SAFe RTE", "SDP", "POPM", "SP"].map((cert) => (
                  <span
                    key={cert}
                    className="font-mono text-xs border border-brass/40 text-brass/80 px-3 py-1 tracking-wider"
                  >
                    {cert}
                  </span>
                ))}
              </div>
            </div>

            {/* Bio column */}
            <div className="lg:col-span-3 space-y-6">
              <p className="text-lg text-offwhite/90 leading-relaxed">
                Jeff Bourke is an Agile and program leader who has spent over two decades navigating the messy intersection of waterfall governance and agile delivery. He has led release trains, coached Scrum Masters, and built program management offices from the ground up — always with an emphasis on what actually works versus what the textbook says should work.
              </p>
              <p className="text-lg text-offwhite/70 leading-relaxed">
                Before his career in technology leadership, Jeff served as a volunteer firefighter and EMT — an experience that fundamentally shaped how he approaches decision-making under pressure, incident command, and the kind of structured chaos that defines large-scale program delivery. When a sprint goes sideways, he draws on the same triage instincts he learned running calls at 2 AM.
              </p>
              <p className="text-lg text-offwhite/70 leading-relaxed">
                He is the author of <em className="text-brass">The Fatal Five</em> (currently in revision), a framework that applies disaster management principles to the five most common ways Agile transformations fail. His LinkedIn articles on sprint hygiene, retro facilitation, and the realities of hybrid delivery have reached thousands of practitioners.
              </p>

              <BrassRule />

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <span className="font-display font-bold text-3xl text-brass">20+</span>
                  <p className="font-mono text-xs text-offwhite/50 mt-1 tracking-wider">YEARS IN THE FIELD</p>
                </div>
                <div>
                  <span className="font-display font-bold text-3xl text-brass">10+</span>
                  <p className="font-mono text-xs text-offwhite/50 mt-1 tracking-wider">LINKEDIN ARTICLES</p>
                </div>
                <div>
                  <span className="font-display font-bold text-3xl text-brass">7</span>
                  <p className="font-mono text-xs text-offwhite/50 mt-1 tracking-wider">CERTIFICATIONS</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── ARTICLES / THOUGHT LEADERSHIP ───
const ARTICLES = [
  {
    title: "The Art of the Retrospective: Making It Count",
    description: "Why most retros fail and how to run ones that actually change behavior.",
    url: "https://www.linkedin.com/in/jeffreybourke/recent-activity/articles/",
    tag: "Retrospectives",
  },
  {
    title: "Sprint Planning Is Not a Negotiation",
    description: "Capacity-based commitment and why finishing 8 stories beats starting 12.",
    url: "https://www.linkedin.com/in/jeffreybourke/recent-activity/articles/",
    tag: "Sprint Planning",
  },
  {
    title: "Definition of Ready: The Gate Nobody Wants to Enforce",
    description: "How a scoring rubric turned our backlog from a graveyard into a pipeline.",
    url: "https://www.linkedin.com/in/jeffreybourke/recent-activity/articles/",
    tag: "DoR / DoD",
  },
  {
    title: "Standups Are Not Status Reports",
    description: "Walk the board, not the people. A flow-based approach to daily coordination.",
    url: "https://www.linkedin.com/in/jeffreybourke/recent-activity/articles/",
    tag: "Daily Standup",
  },
  {
    title: "The Hybrid Reality: Agile Inside Waterfall Governance",
    description: "How to deliver iteratively when your PMO still wants a Gantt chart.",
    url: "https://www.linkedin.com/in/jeffreybourke/recent-activity/articles/",
    tag: "Hybrid Delivery",
  },
  {
    title: "Why Your Release Train Is Derailing",
    description: "Common anti-patterns in SAFe implementations and how to course-correct.",
    url: "https://www.linkedin.com/in/jeffreybourke/recent-activity/articles/",
    tag: "SAFe / RTE",
  },
];

function ArticlesSection() {
  const anim = useInView();
  return (
    <section id="articles" className="bg-secondary py-24">
      <div className="container">
        <div ref={anim.ref} className={`fade-in-up ${anim.visible ? "visible" : ""}`}>
          <div className="flex items-center gap-4 mb-4">
            <PlatformBadge num={1} />
            <div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-offwhite">
                Thought Leadership
              </h2>
              <p className="font-mono text-xs text-brass/60 tracking-wider mt-1">DISPATCHES FROM THE PLATFORM</p>
            </div>
          </div>

          <p className="text-offwhite/60 text-lg mb-12 max-w-2xl">
            Articles on Agile delivery, sprint mechanics, and the realities of leading programs in organizations that don't read the Scrum Guide.
          </p>

          {/* Speaking photo banner */}
          <div className="relative mb-12 overflow-hidden" style={{ maxHeight: "280px" }}>
            <img
              src={PHOTOS.speaking}
              alt="Jeff Bourke speaking at a conference"
              className="w-full object-cover object-top"
              style={{ height: "280px" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-secondary via-transparent to-transparent" />
            <div className="absolute bottom-4 left-6">
              <span className="font-mono text-xs text-brass bg-navy/80 px-3 py-1 tracking-wider">
                FEATURED ON LINKEDIN
              </span>
            </div>
          </div>

          {/* Article grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ARTICLES.map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block border border-border hover:border-brass/50 p-6 transition-all duration-200 bg-background/50 hover:bg-navy-light/30"
              >
                <span className="font-mono text-xs text-brass tracking-wider">{article.tag}</span>
                <h3 className="font-display font-semibold text-lg text-offwhite mt-2 mb-3 group-hover:text-brass transition-colors leading-snug">
                  {article.title}
                </h3>
                <p className="text-sm text-offwhite/50 leading-relaxed">{article.description}</p>
                <span className="inline-block mt-4 font-mono text-xs text-brass/60 group-hover:text-brass transition-colors tracking-wider">
                  READ ON LINKEDIN →
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FATAL FIVE SECTION (Dispatch Board aesthetic) ───
function FatalFiveSection() {
  const anim = useInView();
  const fiveItems = [
    { num: "01", title: "Failure to Triage", desc: "Not knowing what's critical versus what's noise. The inability to prioritize when everything is on fire." },
    { num: "02", title: "Communication Breakdown", desc: "When the incident commander doesn't talk to the crews. Information silos that kill response time." },
    { num: "03", title: "Scope Creep Under Pressure", desc: "Expanding the mission mid-crisis. Taking on more than your resources can handle." },
    { num: "04", title: "Ignoring the Warning Signs", desc: "The near-misses that nobody documented. The retro action items that nobody followed up on." },
    { num: "05", title: "No Unified Command", desc: "Multiple leaders, no single source of truth. When everyone is in charge, nobody is." },
  ];

  return (
    <section id="fatal-five" className="dispatch-zone py-24 relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img src={IMAGES.dispatchOps} alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-[oklch(0.14_0.01_250/0.85)]" />
      </div>

      <div className="container relative z-10">
        <div ref={anim.ref} className={`fade-in-up ${anim.visible ? "visible" : ""}`}>
          <div className="flex items-center gap-4 mb-4">
            <span className="platform-badge border-amber text-amber shrink-0" style={{ borderColor: "oklch(0.75 0.16 75)", color: "oklch(0.75 0.16 75)" }}>5</span>
            <div>
              <h2 className="font-stencil font-bold text-3xl sm:text-4xl uppercase tracking-wider" style={{ color: "oklch(0.95 0.02 85)" }}>
                The Fatal Five
              </h2>
              <p className="font-mono text-xs tracking-wider mt-1" style={{ color: "oklch(0.75 0.16 75 / 0.6)" }}>
                DISASTER MANAGEMENT MEETS AGILE TRANSFORMATION
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-8 mt-12 items-start">
            {/* Left: EMS photo + book info */}
            <div className="lg:col-span-2 space-y-6">
              <img
                src={PHOTOS.ems1}
                alt="Jeff Bourke at the fire station"
                className="w-full max-w-sm object-contain"
                style={{ aspectRatio: "3/2" }}
              />
              <img
                src={PHOTOS.ems2}
                alt="Jeff Bourke at the fire station"
                className="w-full max-w-sm object-contain mt-4"
                style={{ aspectRatio: "3/2" }}
              />

              <div className="border border-amber/30 p-6" style={{ borderColor: "oklch(0.75 0.16 75 / 0.3)" }}>
                <p className="font-stencil text-sm uppercase tracking-wider mb-2" style={{ color: "oklch(0.75 0.16 75)" }}>
                  Book Status
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(0.95 0.02 85 / 0.7)" }}>
                  Currently in revision with full academic citations and references. Drawing from real-world disaster management frameworks applied to Agile transformation failures.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "oklch(0.75 0.16 75)" }} />
                  <span className="font-mono text-xs tracking-wider" style={{ color: "oklch(0.75 0.16 75 / 0.8)" }}>IN PROGRESS</span>
                </div>
              </div>
            </div>

            {/* Right: The five items */}
            <div className="lg:col-span-3 space-y-4">
              <p className="text-lg leading-relaxed mb-8" style={{ color: "oklch(0.95 0.02 85 / 0.8)" }}>
                What do a five-alarm fire and a failed Agile transformation have in common? More than you'd think. The Fatal Five identifies the five catastrophic failure modes that kill programs — drawn from incident command principles and twenty years of watching organizations repeat the same mistakes.
              </p>
              {fiveItems.map((item) => (
                <div
                  key={item.num}
                  className="flex gap-4 p-4 border-l-2 transition-colors hover:bg-[oklch(0.20_0.01_250/0.5)]"
                  style={{ borderLeftColor: "oklch(0.75 0.16 75 / 0.5)" }}
                >
                  <span className="font-stencil font-bold text-2xl shrink-0" style={{ color: "oklch(0.75 0.16 75)" }}>
                    {item.num}
                  </span>
                  <div>
                    <h3 className="font-stencil font-semibold text-lg uppercase tracking-wide" style={{ color: "oklch(0.95 0.02 85)" }}>
                      {item.title}
                    </h3>
                    <p className="text-sm mt-1 leading-relaxed" style={{ color: "oklch(0.95 0.02 85 / 0.6)" }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── THE ARMORY ───
const ARMORY_ITEMS = [
  {
    title: "Retro-in-a-Box Kits",
    description: "Themed retrospective kits with slides, facilitator guides, and activity cards. Themes include Castaway, Jungle Cruise, Haunted Mansion, Firehouse, and more.",
    tag: "RETRO KITS",
    icon: "🎯",
  },
  {
    title: "Sprint Story Templates",
    description: "ADO-ready user stories for sprint hygiene, planning, standups, and DoR/DoD compliance. Copy, paste, and go.",
    tag: "TEMPLATES",
    icon: "📋",
  },
  {
    title: "AI Prompt Library",
    description: "Curated prompts for Agile practitioners — generate retro themes, write acceptance criteria, build sprint reports, and more.",
    tag: "AI PROMPTS",
    icon: "🤖",
  },
  {
    title: "DoR Scoring Tool",
    description: "An interactive Definition of Ready scoring rubric. Rate your stories against 8 criteria before they enter the sprint.",
    tag: "TOOLS",
    icon: "✅",
  },
  {
    title: "Facilitator Quick Cards",
    description: "Pocket-sized reference cards for ceremonies — sprint planning structure, standup flow, retro formats, and PI planning checklists.",
    tag: "QUICK CARDS",
    icon: "🃏",
  },
  {
    title: "Plaud Meeting Templates",
    description: "Pre-built templates for AI meeting transcription — standup summaries, retro notes, and planning session capture.",
    tag: "TEMPLATES",
    icon: "🎙️",
  },
];

function ArmorySection() {
  const anim = useInView();
  return (
    <section id="armory" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={IMAGES.armoryTools} alt="" className="w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-background/90" />
      </div>

      <div className="container relative z-10">
        <div ref={anim.ref} className={`fade-in-up ${anim.visible ? "visible" : ""}`}>
          <div className="flex items-center gap-4 mb-4">
            <PlatformBadge num={3} />
            <div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-offwhite">
                The Armory
              </h2>
              <p className="font-mono text-xs text-brass/60 tracking-wider mt-1">TOOLS, TEMPLATES & FRAMEWORKS</p>
            </div>
          </div>

          <p className="text-offwhite/60 text-lg mb-12 max-w-2xl">
            Battle-tested resources for practitioners who need to run better ceremonies, write better stories, and build better teams. Not theory — tools.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ARMORY_ITEMS.map((item, i) => (
              <div
                key={i}
                className="group border border-border hover:border-brass/40 p-6 transition-all duration-200 bg-secondary/50 hover:bg-navy-light/30"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="font-mono text-xs text-brass tracking-wider">{item.tag}</span>
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <h3 className="font-display font-semibold text-lg text-offwhite mb-3 group-hover:text-brass transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-offwhite/50 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── THE SHOP ───
const SHOP_ITEMS = [
  {
    title: "Retro-in-a-Box: Firehouse Edition",
    price: "Coming Soon",
    description: "Complete themed retro kit with Fireman Sam slides, facilitator guide, and printable activity cards.",
    tag: "DIGITAL DOWNLOAD",
  },
  {
    title: "Sprint Ceremony Quick Cards (Set of 4)",
    price: "Coming Soon",
    description: "Pocket reference cards for Planning, Standup, Review, and Retro. Print-ready PDF.",
    tag: "DIGITAL DOWNLOAD",
  },
  {
    title: "DoR/DoD Compliance Poster",
    price: "Coming Soon",
    description: "Wall-ready poster with Definition of Ready and Definition of Done checklists. A3 and Letter sizes.",
    tag: "DIGITAL DOWNLOAD",
  },
];

function ShopSection() {
  const anim = useInView();
  return (
    <section id="shop" className="bg-secondary py-24">
      <div className="container">
        <div ref={anim.ref} className={`fade-in-up ${anim.visible ? "visible" : ""}`}>
          <div className="flex items-center gap-4 mb-4">
            <PlatformBadge num={4} />
            <div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-offwhite">
                The Shop
              </h2>
              <p className="font-mono text-xs text-brass/60 tracking-wider mt-1">DIGITAL DOWNLOADS & RESOURCES</p>
            </div>
          </div>

          <p className="text-offwhite/60 text-lg mb-12 max-w-2xl">
            Practical, ready-to-use resources you can download and deploy immediately. No fluff, no filler — just tools that work.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {SHOP_ITEMS.map((item, i) => (
              <div
                key={i}
                className="border border-border p-8 flex flex-col bg-background/50"
              >
                <span className="font-mono text-xs text-brass/60 tracking-wider">{item.tag}</span>
                <h3 className="font-display font-semibold text-xl text-offwhite mt-3 mb-4">{item.title}</h3>
                <p className="text-sm text-offwhite/50 leading-relaxed flex-1">{item.description}</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="font-display font-bold text-lg text-brass">{item.price}</span>
                  <button
                    onClick={() => toast("Shop launching soon — stay tuned!")}
                    className="font-display font-semibold text-xs uppercase tracking-wider border border-brass/40 text-brass px-4 py-2 hover:bg-brass hover:text-navy transition-colors"
                  >
                    Notify Me
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="font-mono text-sm text-offwhite/40 tracking-wider">
              SHOP LAUNCHING SOON &middot; DIGITAL DOWNLOADS &middot; INSTANT DELIVERY
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CONTACT SECTION ───
function ContactSection() {
  const anim = useInView();
  const [formState, setFormState] = useState({ name: "", email: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast("Message received — I'll be in touch. Thanks for reaching out.");
    setFormState({ name: "", email: "", message: "" });
  };

  return (
    <section id="contact" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={IMAGES.tracks} alt="" className="w-full h-full object-cover opacity-15" />
        <div className="absolute inset-0 bg-background/90" />
      </div>

      <div className="container relative z-10">
        <div ref={anim.ref} className={`fade-in-up ${anim.visible ? "visible" : ""}`}>
          <div className="flex items-center gap-4 mb-4">
            <PlatformBadge num={5} />
            <div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-offwhite">
                Contact
              </h2>
              <p className="font-mono text-xs text-brass/60 tracking-wider mt-1">SPEAKING &middot; CONSULTING &middot; COACHING</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 mt-12">
            {/* Left: info */}
            <div className="space-y-8">
              <p className="text-lg text-offwhite/80 leading-relaxed">
                Whether you need a keynote speaker who has actually run a release train, a coach who can diagnose your sprint dysfunction in one standup, or someone to build your Agile practice from scratch — let's talk.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-brass text-sm">→</span>
                  <span className="text-offwhite/70">Conference speaking & workshops</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-brass text-sm">→</span>
                  <span className="text-offwhite/70">Agile coaching & RTE mentoring</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-brass text-sm">→</span>
                  <span className="text-offwhite/70">Program management consulting</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-brass text-sm">→</span>
                  <span className="text-offwhite/70">Custom retro & ceremony design</span>
                </div>
              </div>

              <BrassRule />

              <div className="flex items-center gap-6">
                <a
                  href="https://www.linkedin.com/in/jeffreybourke"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-brass hover:text-brass-light transition-colors tracking-wider"
                >
                  LINKEDIN →
                </a>
                <a
                  href="mailto:jeff@releasetrainchronicles.com"
                  className="font-mono text-sm text-brass hover:text-brass-light transition-colors tracking-wider"
                >
                  EMAIL →
                </a>
              </div>

              {/* Photo */}
              <img
                src={PHOTOS.quarterzipConcrete}
                alt="Jeff Bourke"
                className="w-52 h-52 object-cover object-top grayscale-[20%] hidden lg:block"
              />
            </div>

            {/* Right: form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="font-mono text-xs text-brass/60 tracking-wider block mb-2">NAME</label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="w-full bg-secondary border border-border text-offwhite px-4 py-3 font-sans focus:border-brass focus:outline-none transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="font-mono text-xs text-brass/60 tracking-wider block mb-2">EMAIL</label>
                <input
                  type="email"
                  required
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                  className="w-full bg-secondary border border-border text-offwhite px-4 py-3 font-sans focus:border-brass focus:outline-none transition-colors"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="font-mono text-xs text-brass/60 tracking-wider block mb-2">MESSAGE</label>
                <textarea
                  required
                  rows={5}
                  value={formState.message}
                  onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                  className="w-full bg-secondary border border-border text-offwhite px-4 py-3 font-sans focus:border-brass focus:outline-none transition-colors resize-none"
                  placeholder="Tell me about your project, event, or challenge..."
                />
              </div>
              <button
                type="submit"
                className="font-display font-semibold text-sm uppercase tracking-wider bg-vermillion hover:bg-vermillion-light text-white px-8 py-4 transition-colors w-full"
              >
                Send Message
              </button>
              <p className="font-mono text-xs text-offwhite/30 tracking-wider text-center">
                I RESPOND WITHIN 48 HOURS
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ───
function Footer() {
  return (
    <footer className="bg-navy border-t border-border py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-brass/40 flex items-center justify-center">
              <span className="font-mono text-brass/60 font-bold text-sm">RC</span>
            </div>
            <span className="font-display font-semibold text-sm text-offwhite/60 tracking-wide">
              RELEASE TRAIN CHRONICLES
            </span>
          </div>

          <p className="font-mono text-xs text-offwhite/30 tracking-wider">
            &copy; {new Date().getFullYear()} JEFF BOURKE &middot; ALL RIGHTS RESERVED &middot; RELEASETRAINCHRONICLES.COM
          </p>

          <a
            href="https://www.linkedin.com/in/jeffreybourke"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-brass/50 hover:text-brass transition-colors tracking-wider"
          >
            LINKEDIN →
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── ZONE TRANSITION: Conductor's Platform → Dispatch Board ───
function ZoneTransition() {
  return (
    <div className="relative h-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary to-[oklch(0.14_0.01_250)]" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber to-transparent opacity-60" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-4">
          <div className="h-px w-16 bg-amber/40" />
          <span className="font-stencil text-xs uppercase tracking-[0.4em] text-amber/50">Entering Restricted Zone</span>
          <div className="h-px w-16 bg-amber/40" />
        </div>
      </div>
    </div>
  );
}

// ─── ZONE TRANSITION: Dispatch Board → Conductor's Platform ───
function ZoneTransitionBack() {
  return (
    <div className="relative h-16 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.14_0.01_250)] to-background" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber to-transparent opacity-40" />
    </div>
  );
}

// ─── MAIN PAGE ───
export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <HeroSection />
      <DepartureTicker />
      <AboutSection />
      {/* Quote callout */}
      <div className="bg-secondary py-12">
        <div className="container">
          <div className="brass-rule w-full mb-8" />
          <blockquote className="max-w-3xl mx-auto text-center">
            <p className="font-display text-2xl sm:text-3xl text-offwhite/90 leading-relaxed italic">
              "Finishing 8 stories is better than starting 12."
            </p>
            <cite className="font-mono text-xs text-brass/60 tracking-wider mt-4 block not-italic">
              — RELEASE TRAIN CHRONICLES
            </cite>
          </blockquote>
          <div className="brass-rule w-full mt-8" />
        </div>
      </div>
      <ArticlesSection />
      <ZoneTransition />
      <FatalFiveSection />
      <ZoneTransitionBack />
      <ArmorySection />
      <ShopSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
