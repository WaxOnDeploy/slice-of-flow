import { useState, useMemo, useRef } from "react";
import {
  products,
  categories,
  budgetTiers,
  roomSetup,
  proTips,
  HERO_IMAGE,
  WOOD_TEXTURE,
  type Product,
} from "@/data/jungleCruiseProducts";

/* ── Design Philosophy: Jungle Cruise Ride Queue Board ──
   Weathered wood plank textures, hand-painted sign lettering,
   tropical dockside aesthetic. Warm browns, jungle greens,
   sun-bleached cream, faded red price tags, river blue accents.
   Fonts: Permanent Marker (headers), Bebas Neue (sub), Work Sans (body)
   ────────────────────────────────────────────────────────── */

const COLORS = {
  wood: "#6B4226",
  woodLight: "#8B6914",
  cream: "#FFF8E7",
  creamDark: "#F5E6C8",
  jungle: "#1B4332",
  jungleLight: "#2D5A27",
  red: "#C0392B",
  blue: "#2980B9",
  gold: "#C4963A",
  brown: "#3C2415",
};

function CategoryNav({
  activeCategory,
  onSelect,
}: {
  activeCategory: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="sticky top-0 z-30 overflow-x-auto"
      style={{
        background: `linear-gradient(180deg, ${COLORS.brown} 0%, ${COLORS.wood} 100%)`,
        borderBottom: `4px solid ${COLORS.gold}`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 flex gap-1 py-2">
        <button
          onClick={() => onSelect("all")}
          className="shrink-0 px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "1.1rem",
            letterSpacing: "0.05em",
            color: activeCategory === "all" ? COLORS.brown : COLORS.cream,
            background: activeCategory === "all" ? COLORS.gold : "transparent",
            borderRadius: "4px",
          }}
        >
          ALL SUPPLIES
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="shrink-0 px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "1.1rem",
              letterSpacing: "0.05em",
              color: activeCategory === cat.id ? COLORS.brown : COLORS.cream,
              background: activeCategory === cat.id ? COLORS.gold : "transparent",
              borderRadius: "4px",
            }}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const category = categories.find((c) => c.id === product.category);
  return (
    <div
      className="relative flex flex-col"
      style={{
        background: COLORS.cream,
        border: `2px solid ${COLORS.wood}`,
        borderRadius: "2px",
        boxShadow: "4px 4px 0 rgba(60,36,21,0.3)",
        overflow: "hidden",
      }}
    >
      {/* Thumbtack */}
      <div
        className="absolute top-2 right-2 w-5 h-5 rounded-full z-10"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${COLORS.red} 0%, #8B2020 100%)`,
          boxShadow: "1px 2px 3px rgba(0,0,0,0.4)",
        }}
      />

      {/* Category tag */}
      <div
        className="px-3 py-1 text-xs font-bold"
        style={{
          background: COLORS.wood,
          color: COLORS.cream,
          fontFamily: "'Work Sans', sans-serif",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {category?.icon} {category?.name}
      </div>

      <div className="p-4 flex flex-col flex-1">
        {/* Product name */}
        <h3
          className="text-lg leading-tight mb-2"
          style={{
            fontFamily: "'Permanent Marker', cursive",
            color: COLORS.brown,
          }}
        >
          {product.name}
        </h3>

        {/* Description */}
        <p
          className="text-sm mb-3 flex-1"
          style={{
            fontFamily: "'Work Sans', sans-serif",
            color: "#5A4A3A",
            lineHeight: 1.5,
          }}
        >
          {product.description}
        </p>

        {/* Retro stop tag */}
        {product.retroStop && (
          <div
            className="inline-flex items-center gap-1 px-2 py-1 mb-3 text-xs font-bold w-fit"
            style={{
              background: COLORS.blue + "20",
              color: COLORS.blue,
              border: `1px solid ${COLORS.blue}40`,
              borderRadius: "2px",
              fontFamily: "'Work Sans', sans-serif",
            }}
          >
            🗺️ Ties to: {product.retroStop}
          </div>
        )}

        {/* Tier badges */}
        {product.tier.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {product.tier.map((t) => {
              const tier = budgetTiers.find((bt) => bt.id === t);
              return (
                <span
                  key={t}
                  className="px-2 py-0.5 text-xs font-bold"
                  style={{
                    background: tier?.color + "20",
                    color: tier?.color,
                    border: `1px solid ${tier?.color}40`,
                    borderRadius: "2px",
                    fontFamily: "'Work Sans', sans-serif",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {tier?.name}
                </span>
              );
            })}
          </div>
        )}

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: `1px dashed ${COLORS.wood}40` }}>
          <span
            className="text-2xl font-bold"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              color: COLORS.red,
            }}
          >
            {product.priceDisplay}
          </span>
          <a
            href={product.amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-bold transition-all hover:scale-105"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: "0.05em",
              background: COLORS.gold,
              color: COLORS.brown,
              borderRadius: "2px",
              boxShadow: "2px 2px 0 rgba(60,36,21,0.3)",
              fontSize: "1rem",
            }}
          >
            VIEW ON AMAZON →
          </a>
        </div>
      </div>

      {/* Recommended badge */}
      {product.recommended && (
        <div
          className="absolute top-8 -left-1 px-3 py-1 text-xs font-bold"
          style={{
            background: COLORS.jungleLight,
            color: COLORS.cream,
            fontFamily: "'Work Sans', sans-serif",
            letterSpacing: "0.05em",
            boxShadow: "2px 2px 0 rgba(0,0,0,0.2)",
          }}
        >
          ⭐ SKIPPER'S PICK
        </div>
      )}
    </div>
  );
}

function BudgetTierCard({
  tier,
  isActive,
  onClick,
}: {
  tier: (typeof budgetTiers)[0];
  isActive: boolean;
  onClick: () => void;
}) {
  const tierProducts = products.filter((p) => tier.items.includes(p.id));
  const total = tierProducts.reduce((sum, p) => sum + p.price, 0);

  return (
    <div
      className="cursor-pointer transition-all hover:scale-[1.02]"
      onClick={onClick}
      style={{
        background: isActive ? COLORS.cream : COLORS.creamDark,
        border: isActive ? `3px solid ${tier.color}` : `2px solid ${COLORS.wood}60`,
        borderRadius: "2px",
        boxShadow: isActive ? `6px 6px 0 ${tier.color}40` : "3px 3px 0 rgba(60,36,21,0.2)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="p-4" style={{ background: tier.color, color: COLORS.cream }}>
        <div style={{ fontFamily: "'Permanent Marker', cursive", fontSize: "1.5rem" }}>
          {tier.name}
        </div>
        <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "0.85rem", opacity: 0.9 }}>
          {tier.subtitle}
        </div>
      </div>

      <div className="p-4">
        <div
          className="text-3xl mb-2"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: tier.color }}
        >
          {tier.budget}
        </div>
        <p
          className="text-sm mb-4"
          style={{ fontFamily: "'Work Sans', sans-serif", color: "#5A4A3A" }}
        >
          {tier.description}
        </p>

        <div className="space-y-1">
          {tierProducts.map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center text-sm py-1"
              style={{
                fontFamily: "'Work Sans', sans-serif",
                color: COLORS.brown,
                borderBottom: `1px dotted ${COLORS.wood}30`,
              }}
            >
              <span>{p.name}</span>
              <span style={{ color: COLORS.red, fontWeight: 600 }}>${p.price}</span>
            </div>
          ))}
        </div>

        <div
          className="flex justify-between items-center mt-3 pt-3"
          style={{ borderTop: `2px solid ${tier.color}40` }}
        >
          <span
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "1.1rem",
              color: COLORS.brown,
            }}
          >
            TOTAL
          </span>
          <span
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "1.5rem",
              color: tier.color,
            }}
          >
            ~${total}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function JungleCruiseShop() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const productsRef = useRef<HTMLDivElement>(null);
  const tiersRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (activeCategory !== "all") {
      filtered = filtered.filter((p) => p.category === activeCategory);
    }
    if (activeTier) {
      const tier = budgetTiers.find((t) => t.id === activeTier);
      if (tier) {
        filtered = filtered.filter((p) => tier.items.includes(p.id));
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [activeCategory, activeTier, searchQuery]);

  const scrollToProducts = () => {
    productsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: `url('${WOOD_TEXTURE}')`,
        backgroundSize: "400px",
        backgroundRepeat: "repeat",
      }}
    >
      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden" style={{ minHeight: "520px" }}>
        <img
          src={HERO_IMAGE}
          alt="Expedition Supply Depot"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(60,36,21,0.7) 100%)" }} />
        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
          <div
            className="inline-block px-6 py-2 mb-6"
            style={{
              background: COLORS.red,
              color: COLORS.cream,
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "1rem",
              letterSpacing: "0.15em",
              transform: "rotate(-2deg)",
              boxShadow: "3px 3px 0 rgba(0,0,0,0.3)",
            }}
          >
            JUNGLE CRUISE RETROSPECTIVE
          </div>
          <h1
            className="text-5xl md:text-7xl mb-4 leading-none"
            style={{
              fontFamily: "'Permanent Marker', cursive",
              color: COLORS.cream,
              textShadow: "4px 4px 0 rgba(60,36,21,0.8), 0 0 40px rgba(196,150,58,0.3)",
            }}
          >
            EXPEDITION<br />SUPPLY DEPOT
          </h1>
          <p
            className="text-lg md:text-xl mb-8 max-w-2xl mx-auto"
            style={{
              fontFamily: "'Work Sans', sans-serif",
              color: COLORS.creamDark,
              textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            Everything you need to transform your conference room into an immersive jungle expedition.
            Curated props, decorations, and supplies for the ultimate themed retrospective.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={scrollToProducts}
              className="px-8 py-3 font-bold transition-all hover:scale-105"
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "1.3rem",
                letterSpacing: "0.08em",
                background: COLORS.gold,
                color: COLORS.brown,
                borderRadius: "2px",
                boxShadow: "4px 4px 0 rgba(0,0,0,0.3)",
              }}
            >
              BROWSE SUPPLIES →
            </button>
            <button
              onClick={() => tiersRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="px-8 py-3 font-bold transition-all hover:scale-105"
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "1.3rem",
                letterSpacing: "0.08em",
                background: "transparent",
                color: COLORS.cream,
                border: `2px solid ${COLORS.cream}`,
                borderRadius: "2px",
              }}
            >
              VIEW PACKAGES
            </button>
          </div>
        </div>
      </section>

      {/* ── BUDGET TIERS ── */}
      <section ref={tiersRef} className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2
              className="text-4xl md:text-5xl mb-3"
              style={{
                fontFamily: "'Permanent Marker', cursive",
                color: COLORS.cream,
                textShadow: "3px 3px 0 rgba(60,36,21,0.8)",
              }}
            >
              CHOOSE YOUR EXPEDITION
            </h2>
            <p
              className="text-lg"
              style={{
                fontFamily: "'Work Sans', sans-serif",
                color: COLORS.creamDark,
                textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              Three pre-built packages to match your budget and ambition level
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {budgetTiers.map((tier) => (
              <BudgetTierCard
                key={tier.id}
                tier={tier}
                isActive={activeTier === tier.id}
                onClick={() => {
                  setActiveTier(activeTier === tier.id ? null : tier.id);
                  setActiveCategory("all");
                  setTimeout(() => productsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORY IMAGES STRIP ── */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {categories.filter((c) => c.image).map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setActiveTier(null);
                  setTimeout(() => productsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                }}
                className="relative overflow-hidden group cursor-pointer"
                style={{
                  borderRadius: "2px",
                  border: `2px solid ${COLORS.gold}`,
                  boxShadow: "3px 3px 0 rgba(60,36,21,0.3)",
                  aspectRatio: "16/10",
                }}
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(60,36,21,0.85) 0%, transparent 60%)" }} />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div
                    style={{
                      fontFamily: "'Permanent Marker', cursive",
                      color: COLORS.cream,
                      fontSize: "1rem",
                      textShadow: "2px 2px 0 rgba(0,0,0,0.5)",
                    }}
                  >
                    {cat.icon} {cat.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── STICKY NAV ── */}
      <CategoryNav activeCategory={activeCategory} onSelect={(id) => { setActiveCategory(id); setActiveTier(null); }} />

      {/* ── SEARCH BAR ── */}
      <div ref={productsRef} className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              placeholder="Search supplies... (e.g., hippo, treasure, hat)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-10 text-sm"
              style={{
                fontFamily: "'Work Sans', sans-serif",
                background: COLORS.cream,
                color: COLORS.brown,
                border: `2px solid ${COLORS.wood}`,
                borderRadius: "2px",
                boxShadow: "3px 3px 0 rgba(60,36,21,0.2)",
                outline: "none",
              }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔍</span>
          </div>
          <div
            className="text-sm font-semibold"
            style={{
              fontFamily: "'Work Sans', sans-serif",
              color: COLORS.cream,
              textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            Showing {filteredProducts.length} of {products.length} items
            {activeTier && (
              <button
                onClick={() => setActiveTier(null)}
                className="ml-3 px-3 py-1 text-xs font-bold"
                style={{
                  background: COLORS.red,
                  color: COLORS.cream,
                  borderRadius: "2px",
                }}
              >
                CLEAR TIER FILTER ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── PRODUCT GRID ── */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        {filteredProducts.length === 0 ? (
          <div
            className="text-center py-16"
            style={{
              fontFamily: "'Permanent Marker', cursive",
              color: COLORS.cream,
              fontSize: "1.5rem",
              textShadow: "2px 2px 0 rgba(60,36,21,0.8)",
            }}
          >
            🦛 No supplies found. The hippos must have eaten them.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* ── ROOM SETUP CHECKLIST ── */}
      <section className="py-16 px-4" style={{ background: `${COLORS.jungle}ee` }}>
        <div className="max-w-5xl mx-auto">
          <h2
            className="text-4xl md:text-5xl mb-8 text-center"
            style={{
              fontFamily: "'Permanent Marker', cursive",
              color: COLORS.gold,
              textShadow: "3px 3px 0 rgba(0,0,0,0.5)",
            }}
          >
            🗺️ ROOM SETUP CHECKLIST
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roomSetup.map((zone) => (
              <div
                key={zone.zone}
                className="p-4 flex gap-4 items-start"
                style={{
                  background: COLORS.cream,
                  border: `2px solid ${COLORS.gold}`,
                  borderRadius: "2px",
                  boxShadow: "3px 3px 0 rgba(0,0,0,0.2)",
                }}
              >
                <span className="text-2xl shrink-0">{zone.icon}</span>
                <div>
                  <h4
                    className="text-lg mb-1"
                    style={{
                      fontFamily: "'Permanent Marker', cursive",
                      color: COLORS.brown,
                    }}
                  >
                    {zone.zone}
                  </h4>
                  <p
                    className="text-sm"
                    style={{
                      fontFamily: "'Work Sans', sans-serif",
                      color: "#5A4A3A",
                    }}
                  >
                    {zone.items}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRO TIPS ── */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2
            className="text-4xl md:text-5xl mb-8 text-center"
            style={{
              fontFamily: "'Permanent Marker', cursive",
              color: COLORS.cream,
              textShadow: "3px 3px 0 rgba(60,36,21,0.8)",
            }}
          >
            💡 SKIPPER'S PRO TIPS
          </h2>
          <div className="space-y-4">
            {proTips.map((tip, i) => (
              <div
                key={i}
                className="p-5 flex gap-4 items-start"
                style={{
                  background: COLORS.cream,
                  border: `2px solid ${COLORS.wood}`,
                  borderLeft: `6px solid ${COLORS.gold}`,
                  borderRadius: "2px",
                  boxShadow: "3px 3px 0 rgba(60,36,21,0.2)",
                }}
              >
                <span
                  className="text-2xl font-bold shrink-0 w-10 h-10 flex items-center justify-center"
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    background: COLORS.gold,
                    color: COLORS.brown,
                    borderRadius: "50%",
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <h4
                    className="text-lg mb-1"
                    style={{
                      fontFamily: "'Permanent Marker', cursive",
                      color: COLORS.brown,
                    }}
                  >
                    {tip.title}
                  </h4>
                  <p
                    className="text-sm"
                    style={{
                      fontFamily: "'Work Sans', sans-serif",
                      color: "#5A4A3A",
                      lineHeight: 1.6,
                    }}
                  >
                    {tip.tip}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="py-8 px-4 text-center"
        style={{
          background: COLORS.brown,
          borderTop: `4px solid ${COLORS.gold}`,
        }}
      >
        <p
          style={{
            fontFamily: "'Permanent Marker', cursive",
            color: COLORS.gold,
            fontSize: "1.2rem",
          }}
        >
          Jungle Cruise Retrospective — Expedition Supply Depot
        </p>
        <p
          className="mt-2 text-sm"
          style={{
            fontFamily: "'Work Sans', sans-serif",
            color: COLORS.cream + "99",
          }}
        >
          Release Train Chronicles | Detection & Response Team
        </p>
        <p
          className="mt-2 text-xs"
          style={{
            fontFamily: "'Work Sans', sans-serif",
            color: COLORS.cream + "60",
          }}
        >
          Prices are approximate and may vary. All links point to Amazon.com. Check current prices before purchasing.
        </p>
      </footer>
    </div>
  );
}
