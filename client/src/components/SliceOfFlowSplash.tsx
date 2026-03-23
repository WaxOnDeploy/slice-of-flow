import { useState, useEffect } from 'react';

const HERO_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/sof-hero-bg-GAkzomYox6u7BrLN2cai9V.webp';

// ─── OPTION A: NEON DINER SIGN ─────────────────────
function NeonSplash({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState(0); // 0=dark, 1=flicker, 2=glow, 3=subtitle

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div
      onClick={onEnter}
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0d0907 0%, #1a110d 40%, #2d1810 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Brick wall texture overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.02) 30px, rgba(255,255,255,0.02) 31px), repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(255,255,255,0.02) 60px, rgba(255,255,255,0.02) 61px)',
        opacity: 0.5,
      }} />

      {/* Window glow from below */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80%',
        height: '200px',
        background: 'radial-gradient(ellipse at center bottom, rgba(217,79,59,0.15) 0%, transparent 70%)',
      }} />

      {/* Neon title */}
      <div style={{
        position: 'relative',
        fontFamily: "'Lilita One', cursive",
        fontSize: 'clamp(48px, 10vw, 96px)',
        letterSpacing: '4px',
        color: phase >= 2 ? '#ff6b4a' : phase >= 1 ? '#ff6b4a' : '#331a10',
        textShadow: phase >= 2
          ? '0 0 10px #ff6b4a, 0 0 20px #ff6b4a, 0 0 40px #ff4422, 0 0 80px #ff4422, 0 0 120px rgba(255,68,34,0.5)'
          : phase >= 1
          ? '0 0 5px #ff6b4a, 0 0 10px rgba(255,68,34,0.3)'
          : 'none',
        transition: 'all 0.3s ease',
        animation: phase === 1 ? 'neonFlicker 0.15s ease-in-out 3' : 'none',
        marginBottom: '8px',
      }}>
        Slice of Flow
      </div>

      {/* Subtitle */}
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 'clamp(14px, 2.5vw, 22px)',
        color: phase >= 3 ? 'rgba(255,200,180,0.7)' : 'transparent',
        letterSpacing: '6px',
        textTransform: 'uppercase',
        transition: 'color 0.8s ease',
        marginBottom: '48px',
      }}>
        A Kanban Pizza Shop
      </div>

      {/* Enter button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEnter(); }}
        style={{
          fontFamily: "'Lilita One', cursive",
          fontSize: '18px',
          padding: '14px 40px',
          background: 'transparent',
          color: phase >= 3 ? '#ff6b4a' : 'transparent',
          border: phase >= 3 ? '2px solid #ff6b4a' : '2px solid transparent',
          borderRadius: '8px',
          cursor: 'pointer',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          textShadow: phase >= 3 ? '0 0 10px rgba(255,107,74,0.5)' : 'none',
          boxShadow: phase >= 3 ? '0 0 15px rgba(255,107,74,0.2), inset 0 0 15px rgba(255,107,74,0.1)' : 'none',
          transition: 'all 0.8s ease',
        }}
      >
        Enter Kitchen
      </button>

      <style>{`
        @keyframes neonFlicker {
          0%, 100% { opacity: 1; }
          25% { opacity: 0.4; }
          50% { opacity: 0.9; }
          75% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ─── OPTION B: PIZZA BOX UNBOXING ──────────────────
function PizzaBoxSplash({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState(0); // 0=closed, 1=opening, 2=open, 3=content

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1400);
    const t3 = setTimeout(() => setPhase(3), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Checkered tablecloth background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'repeating-conic-gradient(#f5efe8 0% 25%, #faf7f2 0% 50%)',
        backgroundSize: '40px 40px',
        opacity: 0.4,
      }} />

      {/* Pizza box */}
      <div style={{
        position: 'relative',
        width: 'min(500px, 85vw)',
        perspective: '1000px',
      }}>
        {/* Box lid */}
        <div style={{
          position: 'relative',
          width: '100%',
          paddingBottom: phase >= 2 ? '15%' : '100%',
          background: phase >= 2
            ? 'linear-gradient(180deg, #d4a574 0%, #c49464 100%)'
            : 'linear-gradient(180deg, #e8c9a0 0%, #d4a574 100%)',
          borderRadius: phase >= 2 ? '8px 8px 0 0' : '8px',
          border: '3px solid #b8844a',
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformOrigin: 'top center',
          transform: phase >= 1 ? 'rotateX(0deg)' : 'rotateX(0deg)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 2,
          overflow: 'hidden',
        }}>
          {/* Lid text (visible when closed) */}
          {phase < 2 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* Circle stamp */}
              <div style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                border: '4px solid #D94F3B',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'rotate(-5deg)',
              }}>
                <div style={{
                  fontFamily: "'Lilita One', cursive",
                  fontSize: '28px',
                  color: '#D94F3B',
                  lineHeight: 1.1,
                  textAlign: 'center',
                }}>
                  Slice<br/>of<br/>Flow
                </div>
              </div>
              <div style={{
                fontFamily: "'Caveat', cursive",
                fontSize: '16px',
                color: '#8B6914',
                marginTop: '12px',
              }}>
                Est. 2025 — Fresh from the Kanban Kitchen
              </div>
            </div>
          )}
        </div>

        {/* Box base (revealed content) */}
        <div style={{
          width: '100%',
          background: 'linear-gradient(180deg, #f5e6d0 0%, #eddcc4 100%)',
          borderRadius: '0 0 8px 8px',
          border: '3px solid #b8844a',
          borderTop: 'none',
          padding: phase >= 3 ? '40px 30px' : '0px 30px',
          maxHeight: phase >= 2 ? '400px' : '0px',
          opacity: phase >= 2 ? 1 : 0,
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          overflow: 'hidden',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
        }}>
          {/* Grease stain circle */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '250px',
            height: '250px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,170,120,0.15) 0%, transparent 70%)',
          }} />

          <div style={{
            fontFamily: "'Lilita One', cursive",
            fontSize: 'clamp(32px, 6vw, 52px)',
            color: '#D94F3B',
            marginBottom: '8px',
            position: 'relative',
          }}>
            Slice of Flow
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '16px',
            color: '#8B6914',
            marginBottom: '24px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}>
            A Kanban Pizza Shop Simulation
          </div>

          <button
            onClick={onEnter}
            style={{
              fontFamily: "'Lilita One', cursive",
              fontSize: '18px',
              padding: '14px 36px',
              background: '#D94F3B',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(217,79,59,0.4)',
              letterSpacing: '1px',
              position: 'relative',
            }}
          >
            Open the Box
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OPTION C: ORDER TICKET DROP ───────────────────
function OrderTicketSplash({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState(0); // 0=empty, 1=drop, 2=landed, 3=stamp

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1000);
    const t3 = setTimeout(() => setPhase(3), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #2d1810 0%, #1a110d 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Kitchen counter surface */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40%',
        background: 'linear-gradient(180deg, #3d2518 0%, #2a1a10 100%)',
        borderTop: '3px solid #5a3a28',
      }} />

      {/* Order ticket */}
      <div style={{
        position: 'relative',
        width: 'min(380px, 85vw)',
        transform: phase >= 2
          ? 'translateY(0) rotate(-2deg)'
          : phase >= 1
          ? 'translateY(0) rotate(-2deg)'
          : 'translateY(-120vh) rotate(15deg)',
        transition: phase >= 1 && phase < 2
          ? 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)'
          : 'transform 0.3s ease',
        zIndex: 2,
      }}>
        {/* Ticket paper */}
        <div style={{
          background: '#FFFEF5',
          padding: '32px 28px',
          position: 'relative',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}>
          {/* Perforated top edge */}
          <div style={{
            position: 'absolute',
            top: '-6px',
            left: 0,
            right: 0,
            height: '12px',
            backgroundImage: 'radial-gradient(circle at 10px 6px, #2d1810 5px, transparent 5px)',
            backgroundSize: '20px 12px',
            backgroundRepeat: 'repeat-x',
          }} />

          {/* Order header */}
          <div style={{
            textAlign: 'center',
            borderBottom: '2px dashed #ccc',
            paddingBottom: '16px',
            marginBottom: '20px',
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              color: '#999',
              letterSpacing: '3px',
              textTransform: 'uppercase',
            }}>
              Order #001
            </div>
            <div style={{
              fontFamily: "'Lilita One', cursive",
              fontSize: 'clamp(36px, 7vw, 48px)',
              color: '#D94F3B',
              lineHeight: 1.1,
              marginTop: '8px',
            }}>
              Slice of Flow
            </div>
          </div>

          {/* Order details */}
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            color: '#666',
            lineHeight: 2,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>TYPE:</span>
              <span style={{ color: '#333', fontWeight: 600 }}>Kanban Pizza Simulation</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>TABLE:</span>
              <span style={{ color: '#333', fontWeight: 600 }}>Your Kitchen</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>ROUNDS:</span>
              <span style={{ color: '#333', fontWeight: 600 }}>2 (Push → Pull)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>PIZZAS:</span>
              <span style={{ color: '#333', fontWeight: 600 }}>12 Orders</span>
            </div>
          </div>

          {/* Dashed separator */}
          <div style={{
            borderTop: '2px dashed #ccc',
            margin: '20px 0',
          }} />

          {/* FIRE IT UP stamp */}
          <div style={{
            textAlign: 'center',
            position: 'relative',
          }}>
            <div style={{
              display: 'inline-block',
              fontFamily: "'Lilita One', cursive",
              fontSize: '28px',
              color: '#D94F3B',
              border: '4px solid #D94F3B',
              borderRadius: '8px',
              padding: '8px 24px',
              transform: phase >= 3 ? 'rotate(-8deg) scale(1)' : 'rotate(-8deg) scale(3)',
              opacity: phase >= 3 ? 1 : 0,
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              letterSpacing: '2px',
              cursor: 'pointer',
            }}
              onClick={onEnter}
            >
              FIRE IT UP!
            </div>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            marginTop: '20px',
            fontFamily: "'Caveat', cursive",
            fontSize: '14px',
            color: '#bbb',
          }}>
            Stop starting. Start finishing.
          </div>

          {/* Perforated bottom edge */}
          <div style={{
            position: 'absolute',
            bottom: '-6px',
            left: 0,
            right: 0,
            height: '12px',
            backgroundImage: 'radial-gradient(circle at 10px 6px, #2d1810 5px, transparent 5px)',
            backgroundSize: '20px 12px',
            backgroundRepeat: 'repeat-x',
          }} />
        </div>
      </div>

      {/* Click anywhere hint */}
      <div style={{
        position: 'absolute',
        bottom: '40px',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '13px',
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: '2px',
        opacity: phase >= 3 ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}>
        click the stamp to begin
      </div>
    </div>
  );
}

// ─── SPLASH SCREEN SELECTOR ────────────────────────
type SplashVariant = 'neon' | 'pizzabox' | 'ticket';

interface SplashScreenProps {
  onEnter: () => void;
  variant?: SplashVariant;
}

export default function SliceOfFlowSplash({ onEnter, variant = 'ticket' }: SplashScreenProps) {
  switch (variant) {
    case 'neon':
      return <NeonSplash onEnter={onEnter} />;
    case 'pizzabox':
      return <PizzaBoxSplash onEnter={onEnter} />;
    case 'ticket':
      return <OrderTicketSplash onEnter={onEnter} />;
    default:
      return <OrderTicketSplash onEnter={onEnter} />;
  }
}

export type { SplashVariant };
