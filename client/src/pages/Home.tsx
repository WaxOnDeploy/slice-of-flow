/**
 * Release Train Chronicles - The Deck Shop
 * Design: Terminal/Dev Console Aesthetic
 * - Dark GitHub-style background
 * - JetBrains Mono typography
 * - Products as "packages/modules"
 * - CTAs as terminal commands
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Package, 
  Terminal, 
  Zap, 
  Users, 
  Target, 
  BarChart3, 
  Layers,
  CheckCircle2,
  ArrowRight,
  Mail,
  ExternalLink
} from "lucide-react";

// Typewriter effect component
function TypewriterText({ text, className = "" }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [text]);

  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorTimer);
  }, []);

  return (
    <span className={className}>
      {displayText}
      <span className={`inline-block w-3 h-6 bg-terminal-green ml-1 align-middle ${showCursor ? 'opacity-100' : 'opacity-0'}`} />
    </span>
  );
}

// Terminal window component
function TerminalWindow({ children, title = "terminal" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="terminal-window">
      <div className="terminal-header">
        <div className="terminal-dot terminal-dot-red" />
        <div className="terminal-dot terminal-dot-yellow" />
        <div className="terminal-dot terminal-dot-green" />
        <span className="ml-4 text-muted-foreground text-sm font-mono">{title}</span>
      </div>
      <div className="p-6 font-mono text-sm">
        {children}
      </div>
    </div>
  );
}

// Product bundle data
const bundles = [
  {
    id: "sprint-ceremonies",
    name: "Sprint Ceremonies Pack",
    description: "Planning, Daily Standups, Reviews, Retrospectives",
    slides: 75,
    price: 29,
    icon: Target,
    color: "text-terminal-green"
  },
  {
    id: "team-foundations",
    name: "Team Foundations Pack",
    description: "Working Agreements, DoR, DoD, Capacity Planning",
    slides: 60,
    price: 29,
    icon: Users,
    color: "text-terminal-blue"
  },
  {
    id: "metrics-reporting",
    name: "Metrics & Reporting Pack",
    description: "Velocity, Burndown, CFD, Team Health",
    slides: 50,
    price: 29,
    icon: BarChart3,
    color: "text-terminal-orange"
  },
  {
    id: "safe-scaling",
    name: "SAFe & Scaling Pack",
    description: "PI Planning, ARTs, Program Increment",
    slides: 80,
    price: 39,
    icon: Layers,
    color: "text-terminal-purple"
  },
  {
    id: "coaching-training",
    name: "Coaching & Training Pack",
    description: "Icebreakers, Workshops, Anti-Patterns",
    slides: 65,
    price: 29,
    icon: Zap,
    color: "text-terminal-green"
  },
  {
    id: "full-library",
    name: "The Full Arsenal",
    description: "All 500+ slides. Everything. Forever.",
    slides: 500,
    price: 149,
    icon: Package,
    color: "text-accent",
    featured: true
  }
];

// Sample decks for preview
const sampleDecks = [
  {
    title: "Team Activation",
    description: "Get new teams aligned on Working Agreements, DoR, DoD, and Capacity",
    slides: 25,
    preview: "/images/sample-team-activation.png"
  },
  {
    title: "Backlog Refinement",
    description: "Run effective refinement sessions and avoid common anti-patterns",
    slides: 15,
    preview: "/images/sample-refinement.png"
  }
];

export default function Home() {
  const handlePurchase = (bundleName: string) => {
    toast.info(`Purchase flow coming soon for: ${bundleName}`, {
      description: "Contact us directly for early access pricing."
    });
  };

  const handleCustomDeck = () => {
    toast.info("Custom Deck Service", {
      description: "Email us your requirements and we'll build your deck in 24-48 hours."
    });
  };

  return (
    <div className="min-h-screen bg-background grid-bg relative">
      {/* Scanlines overlay */}
      <div className="scanlines fixed inset-0 pointer-events-none z-50" />
      
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-40">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-terminal-green" />
            <div>
              <h1 className="font-mono font-bold text-lg">Release Train Chronicles</h1>
              <p className="text-xs text-muted-foreground font-mono">the_deck_shop</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 font-mono text-sm">
            <a href="#bundles" className="text-muted-foreground hover:text-foreground transition-colors">./bundles</a>
            <a href="#samples" className="text-muted-foreground hover:text-foreground transition-colors">./samples</a>
            <a href="#custom" className="text-muted-foreground hover:text-foreground transition-colors">./custom</a>
            <Button variant="outline" size="sm" className="font-mono">
              <Mail className="w-4 h-4 mr-2" />
              contact
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container">
          <div className="max-w-4xl">
            <div className="font-mono text-terminal-green text-sm mb-4">
              $ cat /about/mission.txt
            </div>
            <h2 className="text-4xl md:text-6xl font-bold font-mono mb-6 leading-tight">
              <TypewriterText text="500+ Battle-Tested Agile Slides" />
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
              From the trenches, for the trenches. Real-world presentations built by practitioners 
              who've survived the daily compromises of hybrid waterfall-agile environments.
            </p>
            
            <TerminalWindow title="quick_start.sh">
              <div className="space-y-2 text-foreground">
                <div><span className="text-terminal-green">$</span> npm install @rtc/agile-slides</div>
                <div className="text-muted-foreground"># Or grab individual packs below</div>
                <div><span className="text-terminal-green">$</span> rtc --list-bundles</div>
                <div className="text-terminal-blue">Found 6 available packages...</div>
              </div>
            </TerminalWindow>
            
            <div className="flex flex-wrap gap-4 mt-8">
              <Button size="lg" className="font-mono" onClick={() => document.getElementById('bundles')?.scrollIntoView({ behavior: 'smooth' })}>
                <Package className="w-5 h-5 mr-2" />
                Browse Bundles
              </Button>
              <Button size="lg" variant="outline" className="font-mono" onClick={() => document.getElementById('custom')?.scrollIntoView({ behavior: 'smooth' })}>
                <Terminal className="w-5 h-5 mr-2" />
                Custom Deck Service
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Bundles Section */}
      <section id="bundles" className="py-20">
        <div className="container">
          <div className="font-mono text-terminal-green text-sm mb-2">
            $ ls -la ./bundles/
          </div>
          <h3 className="text-3xl font-bold font-mono mb-2">Available Packages</h3>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            Each bundle is a curated collection of presentation-ready slides. 
            Download once, use forever. No subscriptions, no nonsense.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundles.map((bundle) => {
              const Icon = bundle.icon;
              return (
                <Card 
                  key={bundle.id} 
                  className={`p-6 bg-card border-border hover:border-primary/50 transition-all ${bundle.featured ? 'md:col-span-2 lg:col-span-1 ring-2 ring-accent/50' : ''}`}
                >
                  {bundle.featured && (
                    <Badge className="mb-4 bg-accent text-accent-foreground font-mono">
                      BEST VALUE
                    </Badge>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <Icon className={`w-8 h-8 ${bundle.color}`} />
                    <div className="text-right">
                      <div className="text-3xl font-bold font-mono">${bundle.price}</div>
                      <div className="text-xs text-muted-foreground font-mono">one-time</div>
                    </div>
                  </div>
                  <h4 className="font-mono font-bold text-lg mb-2">{bundle.name}</h4>
                  <p className="text-sm text-muted-foreground mb-4">{bundle.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-terminal-blue">
                      {bundle.slides} slides
                    </span>
                    <Button 
                      variant={bundle.featured ? "default" : "outline"} 
                      size="sm" 
                      className="font-mono"
                      onClick={() => handlePurchase(bundle.name)}
                    >
                      $ purchase
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <Separator />

      {/* Sample Decks Section */}
      <section id="samples" className="py-20">
        <div className="container">
          <div className="font-mono text-terminal-green text-sm mb-2">
            $ cat ./samples/README.md
          </div>
          <h3 className="text-3xl font-bold font-mono mb-2">Sample Decks</h3>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            See the quality before you buy. These complete presentations demonstrate 
            our battle-tested approach to Agile training materials.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {sampleDecks.map((deck, index) => (
              <Card key={index} className="overflow-hidden bg-card border-border">
                <div className="aspect-video bg-secondary flex items-center justify-center">
                  <div className="text-center p-8">
                    <Terminal className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground font-mono">Preview Coming Soon</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-terminal-green" />
                    <h4 className="font-mono font-bold text-lg">{deck.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{deck.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-terminal-blue">{deck.slides} slides</span>
                    <Button variant="ghost" size="sm" className="font-mono" onClick={() => toast.info("Preview coming soon!")}>
                      View Sample <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* Custom Deck Service */}
      <section id="custom" className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="font-mono text-terminal-green text-sm mb-2">
              $ ./services/custom-deck --help
            </div>
            <h3 className="text-3xl font-bold font-mono mb-2">Done-For-You Custom Decks</h3>
            <p className="text-muted-foreground mb-8">
              Need something specific? Tell us your topic, audience, and timeline. 
              We'll build a custom presentation using our 500+ slide library.
            </p>

            <TerminalWindow title="custom_deck_service.sh">
              <div className="space-y-3">
                <div><span className="text-terminal-green">$</span> rtc custom --describe</div>
                <div className="text-foreground pl-4">
                  <div className="mb-2">How it works:</div>
                  <div className="text-terminal-blue">1.</div> You tell us your topic and requirements<br/>
                  <div className="text-terminal-blue">2.</div> We pull from our 500+ slide library<br/>
                  <div className="text-terminal-blue">3.</div> Custom deck delivered in 24-48 hours<br/>
                  <div className="text-terminal-blue">4.</div> One round of revisions included
                </div>
                <div className="mt-4">
                  <span className="text-terminal-green">$</span> rtc custom --pricing
                </div>
                <div className="text-foreground pl-4">
                  <div><span className="text-terminal-orange">$99</span> - Quick Deck (10-15 slides)</div>
                  <div><span className="text-terminal-orange">$199</span> - Standard Deck (20-30 slides)</div>
                  <div><span className="text-terminal-orange">$299</span> - Workshop Kit (30+ slides + facilitator notes)</div>
                </div>
              </div>
            </TerminalWindow>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button size="lg" className="font-mono" onClick={handleCustomDeck}>
                <Mail className="w-5 h-5 mr-2" />
                Request Custom Deck
              </Button>
              <Button size="lg" variant="outline" className="font-mono" onClick={() => toast.info("Email: hello@releasetrainchronicles.com")}>
                <ArrowRight className="w-5 h-5 mr-2" />
                See Examples
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-terminal-green" />
              <div>
                <div className="font-mono font-bold">Release Train Chronicles</div>
                <div className="text-xs text-muted-foreground">Agile Leadership from the Trenches</div>
              </div>
            </div>
            <div className="font-mono text-sm text-muted-foreground">
              <span className="text-terminal-green">$</span> echo "Built by practitioners, for practitioners"
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground font-mono">
            © {new Date().getFullYear()} Release Train Chronicles. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
