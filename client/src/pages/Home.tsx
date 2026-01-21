/**
 * Release Train Chronicles - Design Concept Selector
 * Strawman presentation page for Jeff to review 3 design directions
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  BookOpen, 
  Briefcase,
  ArrowRight,
  Crosshair,
  PenTool,
  Sparkles
} from "lucide-react";
import { Link } from "wouter";

const concepts = [
  {
    id: "a",
    name: "The War Room",
    tagline: "Dark, tactical, command-center aesthetic",
    description: "Military operations meets modern SaaS. Strategic briefing room feel with data-driven, mission-critical vibes. Deep charcoal, military green, amber alerts.",
    icon: Crosshair,
    colors: ["#0a0f0a", "#22c55e", "#f59e0b", "#1a2f1a"],
    path: "/concept-a",
    vibe: "Tactical • Authoritative • Mission-Critical"
  },
  {
    id: "b",
    name: "The Field Journal",
    tagline: "Warm, weathered, storytelling vibe",
    description: "Well-worn notebook meets memoir. Authentic, personal, human. Paper textures, handwritten accents. Warm cream, aged paper, ink blue, leather brown.",
    icon: PenTool,
    colors: ["#faf8f5", "#8b4513", "#2c2416", "#d4c4a8"],
    path: "/concept-b",
    vibe: "Personal • Authentic • Story-Driven"
  },
  {
    id: "c",
    name: "The Modern Practitioner",
    tagline: "Clean, confident, professional",
    description: "Consulting firm meets thought leader. Premium, authoritative, trustworthy. Generous whitespace, strong typography. Deep navy, warm white, gold accents.",
    icon: Briefcase,
    colors: ["#ffffff", "#1a1a2e", "#c9a227", "#f8f9fa"],
    path: "/concept-c",
    vibe: "Professional • Premium • Authoritative"
  }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] py-6">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Release Train Chronicles</h1>
              <p className="text-sm text-[#888]">Design Concept Review</p>
            </div>
            <Badge variant="outline" className="border-[#444] text-[#888]">
              Strawman v1.0
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 border-b border-[#2a2a2a]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <Badge className="mb-6 bg-amber-500/20 text-amber-400 border-amber-500/50">
            <Sparkles className="w-3 h-3 mr-1" />
            For Review
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Three Design Directions
          </h2>
          <p className="text-xl text-[#888] max-w-2xl mx-auto mb-8">
            Each concept represents a distinct visual identity for your professional hub. 
            Click through to experience each one, then let me know what resonates—or what 
            elements to mix and match.
          </p>
          <div className="flex justify-center gap-4 text-sm text-[#666]">
            <span>✓ Your real headshots</span>
            <span>•</span>
            <span>✓ Your LinkedIn articles</span>
            <span>•</span>
            <span>✓ The Fatal Five book</span>
            <span>•</span>
            <span>✓ The Armory link</span>
          </div>
        </div>
      </section>

      {/* Concept Cards */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {concepts.map((concept) => {
              const Icon = concept.icon;
              return (
                <Card 
                  key={concept.id}
                  className="bg-[#1a1a1a] border-[#2a2a2a] overflow-hidden hover:border-[#444] transition-all group"
                >
                  {/* Color Preview */}
                  <div className="h-24 flex">
                    {concept.colors.map((color, i) => (
                      <div 
                        key={i} 
                        className="flex-1" 
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-[#2a2a2a] rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Concept {concept.id.toUpperCase()}</h3>
                        <p className="text-sm text-[#888]">{concept.name}</p>
                      </div>
                    </div>
                    
                    <p className="text-[#888] text-sm mb-4 leading-relaxed">
                      {concept.description}
                    </p>
                    
                    <div className="text-xs text-[#666] mb-6 uppercase tracking-wider">
                      {concept.vibe}
                    </div>
                    
                    <Link href={concept.path}>
                      <Button className="w-full bg-white text-black hover:bg-[#eee] font-medium group-hover:bg-amber-400 group-hover:text-black transition-colors">
                        View Concept {concept.id.toUpperCase()}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Instructions */}
      <section className="py-16 border-t border-[#2a2a2a]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h3 className="text-2xl font-bold mb-4">How to Review</h3>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
              <div className="text-3xl font-bold text-amber-400 mb-2">1</div>
              <h4 className="font-semibold mb-2">Explore Each</h4>
              <p className="text-sm text-[#888]">
                Click through all three concepts. Scroll through the full page to see 
                every section.
              </p>
            </div>
            <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
              <div className="text-3xl font-bold text-amber-400 mb-2">2</div>
              <h4 className="font-semibold mb-2">Note Reactions</h4>
              <p className="text-sm text-[#888]">
                What feels right? What feels off? Which elements stand out—good or bad?
              </p>
            </div>
            <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
              <div className="text-3xl font-bold text-amber-400 mb-2">3</div>
              <h4 className="font-semibold mb-2">Share Feedback</h4>
              <p className="text-sm text-[#888]">
                Pick one to refine, mix elements from multiple, or tell me what's missing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-8 border-t border-[#2a2a2a]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/concept-a">
              <Button variant="outline" className="border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444]">
                <Crosshair className="w-4 h-4 mr-2" />
                War Room
              </Button>
            </Link>
            <Link href="/concept-b">
              <Button variant="outline" className="border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444]">
                <PenTool className="w-4 h-4 mr-2" />
                Field Journal
              </Button>
            </Link>
            <Link href="/concept-c">
              <Button variant="outline" className="border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444]">
                <Briefcase className="w-4 h-4 mr-2" />
                Modern Practitioner
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-[#2a2a2a] text-center text-sm text-[#666]">
        <div className="max-w-6xl mx-auto px-6">
          Release Train Chronicles © 2025 · Strawman Design Review
        </div>
      </footer>
    </div>
  );
}
