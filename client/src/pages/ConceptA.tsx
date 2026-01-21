/**
 * CONCEPT A: "THE WAR ROOM"
 * Design Philosophy: Dark, tactical, command-center aesthetic
 * - Military operations meets modern SaaS
 * - Strategic briefing room feel
 * - Data-driven, mission-critical vibe
 * - Colors: Deep charcoal, military green, amber alerts, steel blue
 * - Typography: Sharp, authoritative, condensed headers
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Target, 
  Shield, 
  Crosshair,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  Mail,
  Linkedin,
  ArrowRight,
  Radio,
  MapPin
} from "lucide-react";

// Article data from Jeff's LinkedIn
const articles = [
  {
    id: 1,
    title: "Before You Reboot, Audit What You Already Built",
    excerpt: "The system isn't broken—the discipline is. Here's how to stop the reboot cycle.",
    category: "STRATEGY",
    readTime: "7 min",
    date: "Oct 2025",
    featured: true
  },
  {
    id: 2,
    title: "Your Sprint is Failing Before It Even Begins",
    excerpt: "How my teams cut rollover work from 40% to under 5% with one discipline change.",
    category: "EXECUTION",
    readTime: "5 min",
    date: "Oct 2025"
  },
  {
    id: 3,
    title: "The PI Planning Over/Under",
    excerpt: "Turn your team's betting pool jokes into actionable improvement data.",
    category: "INTEL",
    readTime: "4 min",
    date: "Oct 2025"
  },
  {
    id: 4,
    title: "Your Best Scrum Team Is About to Get Their Budget Cut",
    excerpt: "The most dangerous role for a Scrum Master isn't coach—it's promoter.",
    category: "SURVIVAL",
    readTime: "6 min",
    date: "Sep 2025"
  },
  {
    id: 5,
    title: "Stop Playing Fantasy Football with Your Dev Teams",
    excerpt: "Why trading developers mid-sprint is a guaranteed way to lose.",
    category: "DEFENSE",
    readTime: "5 min",
    date: "Sep 2025"
  }
];

export default function ConceptA() {
  const handleContact = () => {
    toast.info("Contact form coming soon", {
      description: "For now, connect on LinkedIn."
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-[#e8efe8]">
      {/* Tactical grid overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34, 197, 94, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 197, 94, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Header - Command Bar */}
      <header className="border-b border-[#1a2f1a] bg-[#0a0f0a]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#22c55e]/20 border border-[#22c55e]/50 flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#22c55e]" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight">RELEASE TRAIN CHRONICLES</h1>
                <p className="text-xs text-[#22c55e] tracking-[0.2em] uppercase">Field Operations</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-8 text-sm tracking-wide">
              <a href="#mission" className="text-[#8b9a8b] hover:text-[#22c55e] transition-colors uppercase">Mission</a>
              <a href="#intel" className="text-[#8b9a8b] hover:text-[#22c55e] transition-colors uppercase">Intel</a>
              <a href="#arsenal" className="text-[#8b9a8b] hover:text-[#22c55e] transition-colors uppercase">Arsenal</a>
              <a href="#contact" className="text-[#8b9a8b] hover:text-[#22c55e] transition-colors uppercase">Contact</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero - Mission Briefing */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        {/* Diagonal accent */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-[#22c55e]/5 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/50 uppercase tracking-wider">
                <span className="w-2 h-2 bg-[#22c55e] rounded-full mr-2 animate-pulse" />
                Active Operations
              </Badge>
              
              <h2 className="text-4xl md:text-6xl font-black leading-[0.9] mb-6 tracking-tight">
                AGILE LEADERSHIP<br />
                <span className="text-[#22c55e]">FROM THE TRENCHES</span>
              </h2>
              
              <p className="text-xl text-[#8b9a8b] mb-8 leading-relaxed max-w-xl">
                No theory. No fluff. Battle-tested strategies from someone who's survived 
                the daily compromises of hybrid waterfall-agile environments.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-[#0a0f0a] font-bold uppercase tracking-wider"
                  onClick={() => document.getElementById('intel')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Crosshair className="w-5 h-5 mr-2" />
                  Access Intel
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-[#22c55e]/50 text-[#22c55e] hover:bg-[#22c55e]/10 uppercase tracking-wider"
                  onClick={() => document.getElementById('arsenal')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Shield className="w-5 h-5 mr-2" />
                  The Armory
                </Button>
              </div>
            </div>

            {/* Commander Profile */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-[#22c55e]/20 via-transparent to-transparent blur-2xl" />
              <div className="relative bg-[#0f1a0f] border border-[#1a2f1a] p-1">
                <img 
                  src="/images/jeff-skyline.jpg" 
                  alt="Jeff Bourke" 
                  className="w-full aspect-[4/3] object-cover object-top grayscale hover:grayscale-0 transition-all duration-500"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0f0a] to-transparent p-6">
                  <div className="text-[#22c55e] text-xs tracking-[0.3em] uppercase mb-1">Field Commander</div>
                  <div className="text-2xl font-bold">JEFF BOURKE</div>
                  <div className="text-sm text-[#8b9a8b]">PMP, PMI-ACP, CSM, SAFe RTE, SDP, POPM, SP</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About - Operator Profile */}
      <section id="mission" className="py-20 bg-[#0f1a0f] border-y border-[#1a2f1a]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <div className="text-[#22c55e] text-xs tracking-[0.3em] uppercase mb-4">Mission Brief</div>
              <h3 className="text-3xl font-bold mb-6">THE OPERATOR</h3>
              <div className="space-y-4 text-[#8b9a8b] leading-relaxed">
                <p>
                  After years in the field—navigating the chaos of enterprise Agile transformations, 
                  SAFe implementations, and the inevitable friction between theory and reality—I've 
                  learned one thing: <span className="text-[#e8efe8]">the playbook matters less than the discipline to follow it.</span>
                </p>
                <p>
                  Release Train Chronicles exists to share what actually works. Not the sanitized 
                  conference version. The real stuff. The compromises. The workarounds. The moments 
                  when you have to choose between process purity and getting things done.
                </p>
                <p>
                  Whether you're a Scrum Master trying to protect your team, an RTE herding cats 
                  across multiple trains, or a coach wondering why the transformation isn't 
                  transforming—<span className="text-[#e8efe8]">you're in the right place.</span>
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-[#0a0f0a] border border-[#1a2f1a] p-6">
                <div className="text-[#22c55e] text-xs tracking-[0.3em] uppercase mb-3">Certifications</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#22c55e]" />
                    <span>SAFe Release Train Engineer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#22c55e]" />
                    <span>Certified Scrum Master</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#22c55e]" />
                    <span>PMP & PMI-ACP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#22c55e]" />
                    <span>SAFe SDP, POPM, SP</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-[#0a0f0a] border border-[#1a2f1a] p-6">
                <div className="text-[#22c55e] text-xs tracking-[0.3em] uppercase mb-3">Area of Operations</div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-[#22c55e]" />
                  <span>Enterprise Agile Transformations</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Intel - Thought Leadership */}
      <section id="intel" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="text-[#22c55e] text-xs tracking-[0.3em] uppercase mb-4">Field Reports</div>
              <h3 className="text-3xl font-bold">INTELLIGENCE BRIEFINGS</h3>
            </div>
            <a 
              href="https://www.linkedin.com/in/jeffreybourke" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 text-[#22c55e] hover:underline"
            >
              <Linkedin className="w-4 h-4" />
              Full Archive
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Featured Article */}
          {articles.filter(a => a.featured).map(article => (
            <Card 
              key={article.id}
              className="bg-[#0f1a0f] border-[#22c55e]/30 mb-8 overflow-hidden hover:border-[#22c55e]/60 transition-colors cursor-pointer"
            >
              <div className="grid md:grid-cols-3">
                <div className="md:col-span-2 p-8">
                  <div className="flex items-center gap-4 mb-4">
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      PRIORITY
                    </Badge>
                    <span className="text-xs text-[#8b9a8b] uppercase tracking-wider">{article.category}</span>
                    <span className="text-xs text-[#8b9a8b]">{article.readTime} read</span>
                  </div>
                  <h4 className="text-2xl font-bold mb-3">{article.title}</h4>
                  <p className="text-[#8b9a8b] mb-6">{article.excerpt}</p>
                  <Button variant="outline" className="border-[#22c55e]/50 text-[#22c55e] hover:bg-[#22c55e]/10">
                    Read Briefing
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <div className="bg-[#22c55e]/5 p-8 flex items-center justify-center">
                  <Target className="w-24 h-24 text-[#22c55e]/30" />
                </div>
              </div>
            </Card>
          ))}

          {/* Article Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {articles.filter(a => !a.featured).map(article => (
              <Card 
                key={article.id}
                className="bg-[#0f1a0f] border-[#1a2f1a] p-6 hover:border-[#22c55e]/30 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline" className="text-xs border-[#1a2f1a] text-[#8b9a8b]">
                    {article.category}
                  </Badge>
                  <span className="text-xs text-[#8b9a8b]">{article.readTime}</span>
                </div>
                <h4 className="font-bold mb-2 group-hover:text-[#22c55e] transition-colors">{article.title}</h4>
                <p className="text-sm text-[#8b9a8b]">{article.excerpt}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* The Fatal Five - Book Section */}
      <section className="py-20 bg-[#0f1a0f] border-y border-[#1a2f1a]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-amber-500/20 text-amber-400 border-amber-500/50 uppercase tracking-wider">
                <AlertTriangle className="w-3 h-3 mr-2" />
                Threat Assessment
              </Badge>
              <h3 className="text-4xl font-black mb-6">THE FATAL FIVE</h3>
              <p className="text-xl text-[#8b9a8b] mb-6">
                The five silent killers of Agile transformations—and how to neutralize them 
                before they take down your teams.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Why 70% of transformations fail in year one",
                  "The discipline erosion pattern nobody talks about",
                  "How to audit before you reboot",
                  "Building sustainable change that sticks"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[#8b9a8b]">
                    <Crosshair className="w-4 h-4 text-[#22c55e]" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                size="lg"
                className="bg-amber-500 hover:bg-amber-600 text-[#0a0f0a] font-bold uppercase tracking-wider"
                onClick={() => toast.info("Book coming soon!", { description: "Join the waitlist for early access." })}
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Coming Soon
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-amber-500/20 via-transparent to-transparent blur-2xl" />
              <div className="relative bg-[#0a0f0a] border-2 border-amber-500/30 p-8 text-center">
                <div className="text-6xl font-black text-amber-500 mb-4">5</div>
                <div className="text-2xl font-bold mb-2">THE FATAL FIVE</div>
                <div className="text-[#8b9a8b]">Silent Killers of Agile Transformation</div>
                <div className="mt-4 text-sm text-amber-400">By Jeff Bourke</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Armory - Deck Shop Link */}
      <section id="arsenal" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-r from-[#22c55e]/10 to-transparent border border-[#22c55e]/30 p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="text-[#22c55e] text-xs tracking-[0.3em] uppercase mb-4">Equipment</div>
                <h3 className="text-4xl font-black mb-4">THE ARMORY</h3>
                <p className="text-xl text-[#8b9a8b] mb-6">
                  500+ battle-tested presentation slides. Sprint ceremonies, team foundations, 
                  metrics, SAFe scaling—everything you need to equip your teams.
                </p>
                <Button 
                  size="lg"
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-[#0a0f0a] font-bold uppercase tracking-wider"
                  onClick={() => window.location.href = '/'}
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Enter The Armory
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-[#0a0f0a] border border-[#1a2f1a] p-6">
                  <div className="text-4xl font-black text-[#22c55e]">500+</div>
                  <div className="text-sm text-[#8b9a8b]">Slides</div>
                </div>
                <div className="bg-[#0a0f0a] border border-[#1a2f1a] p-6">
                  <div className="text-4xl font-black text-[#22c55e]">6</div>
                  <div className="text-sm text-[#8b9a8b]">Bundles</div>
                </div>
                <div className="bg-[#0a0f0a] border border-[#1a2f1a] p-6">
                  <div className="text-4xl font-black text-[#22c55e]">$29</div>
                  <div className="text-sm text-[#8b9a8b]">Starting</div>
                </div>
                <div className="bg-[#0a0f0a] border border-[#1a2f1a] p-6">
                  <div className="text-4xl font-black text-[#22c55e]">24h</div>
                  <div className="text-sm text-[#8b9a8b]">Custom Decks</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact - Comms */}
      <section id="contact" className="py-20 bg-[#0f1a0f] border-t border-[#1a2f1a]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="text-[#22c55e] text-xs tracking-[0.3em] uppercase mb-4">Communications</div>
          <h3 className="text-3xl font-bold mb-6">ESTABLISH CONTACT</h3>
          <p className="text-[#8b9a8b] mb-8 max-w-xl mx-auto">
            Need a custom deck? Speaking engagement? Consulting on your transformation? 
            Open a channel.
          </p>
          <div className="flex justify-center gap-4">
            <Button 
              size="lg"
              className="bg-[#22c55e] hover:bg-[#16a34a] text-[#0a0f0a] font-bold uppercase tracking-wider"
              onClick={handleContact}
            >
              <Mail className="w-5 h-5 mr-2" />
              Send Message
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-[#0077b5] text-[#0077b5] hover:bg-[#0077b5]/10 uppercase tracking-wider"
              onClick={() => window.open('https://www.linkedin.com/in/jeffreybourke', '_blank')}
            >
              <Linkedin className="w-5 h-5 mr-2" />
              LinkedIn
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a2f1a] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-[#8b9a8b]">
            <Radio className="w-4 h-4 text-[#22c55e]" />
            Release Train Chronicles © 2025
          </div>
          <div className="flex items-center gap-6 text-sm text-[#8b9a8b]">
            <a href="/" className="hover:text-[#22c55e] transition-colors">The Armory</a>
            <a href="#intel" className="hover:text-[#22c55e] transition-colors">Intel</a>
            <a href="#contact" className="hover:text-[#22c55e] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
