/**
 * CONCEPT C: "THE MODERN PRACTITIONER"
 * Design Philosophy: Clean, confident, professional
 * - Consulting firm meets thought leader
 * - Premium, authoritative, trustworthy
 * - Generous whitespace, strong typography hierarchy
 * - Colors: Deep navy, warm white, gold accents, slate gray
 * - Typography: Modern sans-serif, bold headlines, refined body
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowRight,
  BookOpen, 
  Briefcase,
  ChevronRight,
  ExternalLink,
  Linkedin,
  Mail,
  MessageSquare,
  Play,
  Sparkles,
  TrendingUp,
  Users,
  Zap
} from "lucide-react";

// Article data from Jeff's LinkedIn
const articles = [
  {
    id: 1,
    title: "Before You Reboot, Audit What You Already Built",
    excerpt: "The system isn't broken—the discipline is. Here's how to stop the reboot cycle and leverage what you've already created.",
    category: "Strategy",
    readTime: "7 min",
    date: "Oct 2025",
    featured: true
  },
  {
    id: 2,
    title: "Your Sprint is Failing Before It Even Begins",
    excerpt: "How Definition of Ready transformed our rollover rate from 40% to under 5%.",
    category: "Execution",
    readTime: "5 min",
    date: "Oct 2025"
  },
  {
    id: 3,
    title: "The PI Planning Over/Under",
    excerpt: "Transform team humor into actionable improvement data.",
    category: "Insights",
    readTime: "4 min",
    date: "Oct 2025"
  },
  {
    id: 4,
    title: "Your Best Scrum Team Is About to Get Their Budget Cut",
    excerpt: "Why the Scrum Master's most critical role is promoter, not facilitator.",
    category: "Leadership",
    readTime: "6 min",
    date: "Sep 2025"
  },
  {
    id: 5,
    title: "Stop Playing Fantasy Football with Your Dev Teams",
    excerpt: "The anti-pattern of resource shuffling and why stability drives delivery.",
    category: "Teams",
    readTime: "5 min",
    date: "Sep 2025"
  }
];

const credentials = [
  "SAFe Release Train Engineer",
  "Certified Scrum Master",
  "PMP & PMI-ACP",
  "SAFe SDP, POPM, SP"
];

export default function ConceptC() {
  const handleContact = () => {
    toast.info("Contact form coming soon", {
      description: "For now, connect on LinkedIn."
    });
  };

  return (
    <div className="min-h-screen bg-white text-[#1a1a2e]">
      {/* Header - Clean Professional */}
      <header className="border-b border-[#e5e5e5] bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1a1a2e] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">RTC</span>
              </div>
              <div>
                <h1 className="font-semibold text-lg text-[#1a1a2e]">Release Train Chronicles</h1>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a href="#about" className="text-[#666] hover:text-[#1a1a2e] transition-colors">About</a>
              <a href="#insights" className="text-[#666] hover:text-[#1a1a2e] transition-colors">Insights</a>
              <a href="#book" className="text-[#666] hover:text-[#1a1a2e] transition-colors">The Book</a>
              <a href="#resources" className="text-[#666] hover:text-[#1a1a2e] transition-colors">Resources</a>
              <Button size="sm" className="bg-[#1a1a2e] hover:bg-[#2a2a4e] text-white">
                Get in Touch
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero - Bold Statement */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-[#f8f9fa] to-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-[#fef3c7] text-[#92400e] border-0 font-medium">
                <Sparkles className="w-3 h-3 mr-1" />
                Agile Leadership & Transformation
              </Badge>
              
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6 text-[#1a1a2e]">
                Practical wisdom for the practitioners in the arena.
              </h2>
              
              <p className="text-xl text-[#666] mb-8 leading-relaxed">
                I help organizations navigate the messy reality of Agile transformation—where 
                frameworks meet politics, and theory meets quarterly targets.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  className="bg-[#1a1a2e] hover:bg-[#2a2a4e] text-white font-medium"
                  onClick={() => document.getElementById('insights')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Read My Insights
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-[#1a1a2e] text-[#1a1a2e] hover:bg-[#1a1a2e]/5"
                  onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Learn More
                </Button>
              </div>

              {/* Social Proof */}
              <div className="mt-12 pt-8 border-t border-[#e5e5e5]">
                <div className="flex items-center gap-8">
                  <div>
                    <div className="text-3xl font-bold text-[#1a1a2e]">15+</div>
                    <div className="text-sm text-[#666]">Years Experience</div>
                  </div>
                  <div className="w-px h-12 bg-[#e5e5e5]" />
                  <div>
                    <div className="text-3xl font-bold text-[#1a1a2e]">24+</div>
                    <div className="text-sm text-[#666]">Published Articles</div>
                  </div>
                  <div className="w-px h-12 bg-[#e5e5e5]" />
                  <div>
                    <div className="text-3xl font-bold text-[#1a1a2e]">500+</div>
                    <div className="text-sm text-[#666]">Slide Resources</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Headshot */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-[#c9a227]/20 via-transparent to-[#1a1a2e]/10 rounded-3xl blur-2xl" />
              <div className="relative">
                <img 
                  src="/images/jeff-skyline.jpg" 
                  alt="Jeff Bourke" 
                  className="w-full aspect-[4/5] object-cover object-top rounded-2xl shadow-2xl"
                />
                <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-lg max-w-xs">
                  <div className="text-sm text-[#666] mb-1">Jeff Bourke</div>
                  <div className="font-semibold text-[#1a1a2e]">Agile Transformation Leader</div>
                  <div className="text-xs text-[#999] mt-2">PMP · PMI-ACP · CSM · SAFe RTE</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About - Professional Bio */}
      <section id="about" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-16">
            <div className="lg:col-span-2">
              <div className="text-sm font-medium text-[#c9a227] uppercase tracking-wider mb-4">About</div>
              <h3 className="text-3xl font-bold mb-6 text-[#1a1a2e]">From the Trenches, For the Trenches</h3>
              
              <div className="space-y-6 text-[#666] text-lg leading-relaxed">
                <p>
                  I've spent my career at the intersection of Agile theory and enterprise reality. 
                  The place where transformation roadmaps meet organizational politics. Where 
                  well-intentioned frameworks collide with the messy complexity of real teams 
                  doing real work.
                </p>
                <p>
                  Through Release Train Chronicles, I share the lessons that only come from 
                  experience—the patterns that repeat, the pitfalls to avoid, and the practical 
                  strategies that actually move the needle.
                </p>
                <p className="font-medium text-[#1a1a2e]">
                  No theory for theory's sake. No certification-speak. Just honest insights 
                  from someone who's been in the room when things went sideways—and helped 
                  teams find their way back.
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <Card className="p-6 border-[#e5e5e5] bg-[#f8f9fa]">
                <div className="text-sm font-medium text-[#c9a227] uppercase tracking-wider mb-4">Credentials</div>
                <div className="space-y-3">
                  {credentials.map((cred, i) => (
                    <div key={i} className="flex items-center gap-3 text-[#1a1a2e]">
                      <div className="w-2 h-2 bg-[#c9a227] rounded-full" />
                      {cred}
                    </div>
                  ))}
                </div>
              </Card>
              
              <Card className="p-6 border-[#e5e5e5]">
                <div className="text-sm font-medium text-[#c9a227] uppercase tracking-wider mb-4">Focus Areas</div>
                <div className="flex flex-wrap gap-2">
                  {['SAFe Implementation', 'Team Coaching', 'Transformation Strategy', 'Leadership Development'].map(area => (
                    <Badge key={area} variant="outline" className="border-[#e5e5e5] text-[#666]">
                      {area}
                    </Badge>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Insights - Thought Leadership */}
      <section id="insights" className="py-20 bg-[#f8f9fa]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="text-sm font-medium text-[#c9a227] uppercase tracking-wider mb-4">Insights</div>
              <h3 className="text-3xl font-bold text-[#1a1a2e]">Latest Thinking</h3>
            </div>
            <a 
              href="https://www.linkedin.com/in/jeffreybourke" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 text-[#1a1a2e] hover:text-[#c9a227] transition-colors font-medium"
            >
              View all on LinkedIn
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Featured Article */}
          {articles.filter(a => a.featured).map(article => (
            <Card 
              key={article.id}
              className="mb-8 overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer bg-white"
            >
              <div className="grid md:grid-cols-5">
                <div className="md:col-span-3 p-8 md:p-10">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className="bg-[#c9a227]/10 text-[#92400e] border-0">Featured</Badge>
                    <span className="text-sm text-[#999]">{article.category}</span>
                    <span className="text-sm text-[#999]">·</span>
                    <span className="text-sm text-[#999]">{article.readTime}</span>
                  </div>
                  <h4 className="text-2xl md:text-3xl font-bold mb-4 text-[#1a1a2e]">{article.title}</h4>
                  <p className="text-[#666] text-lg mb-6">{article.excerpt}</p>
                  <Button className="bg-[#1a1a2e] hover:bg-[#2a2a4e] text-white">
                    Read Article
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <div className="md:col-span-2 bg-gradient-to-br from-[#1a1a2e] to-[#2a2a4e] p-10 flex items-center justify-center">
                  <div className="text-center text-white">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <div className="text-sm opacity-70">Most Read This Month</div>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {/* Article Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {articles.filter(a => !a.featured).map(article => (
              <Card 
                key={article.id}
                className="p-6 border-[#e5e5e5] hover:border-[#c9a227] transition-colors cursor-pointer bg-white group"
              >
                <div className="flex items-center gap-3 mb-3 text-sm">
                  <Badge variant="outline" className="border-[#e5e5e5] text-[#666]">
                    {article.category}
                  </Badge>
                  <span className="text-[#999]">{article.readTime}</span>
                </div>
                <h4 className="font-bold text-lg mb-2 text-[#1a1a2e] group-hover:text-[#c9a227] transition-colors">
                  {article.title}
                </h4>
                <p className="text-[#666] text-sm">{article.excerpt}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* The Fatal Five - Book Section */}
      <section id="book" className="py-20 bg-[#1a1a2e] text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-6 bg-[#c9a227]/20 text-[#c9a227] border-0">
                Coming Soon
              </Badge>
              <h3 className="text-4xl md:text-5xl font-bold mb-6">The Fatal Five</h3>
              <p className="text-xl text-[#a0a0b0] mb-6 leading-relaxed">
                The five patterns that silently kill Agile transformations—and the 
                practical strategies to recognize and overcome them.
              </p>
              
              <div className="space-y-4 mb-8">
                {[
                  "Why 70% of transformations fail in year one",
                  "The 'Just This Once' discipline erosion trap",
                  "How to audit before you reboot",
                  "Building sustainable change that sticks",
                  "Real case studies from the field"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-[#a0a0b0]">
                    <div className="w-6 h-6 rounded-full bg-[#c9a227]/20 flex items-center justify-center text-[#c9a227] text-sm font-medium">
                      {i + 1}
                    </div>
                    {item}
                  </div>
                ))}
              </div>
              
              <Button 
                size="lg"
                className="bg-[#c9a227] hover:bg-[#b8911f] text-[#1a1a2e] font-semibold"
                onClick={() => toast.info("Book coming soon!", { description: "Join the waitlist for early access and exclusive content." })}
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Join the Waitlist
              </Button>
            </div>
            
            {/* Book Visual */}
            <div className="relative">
              <div className="bg-gradient-to-br from-[#c9a227] to-[#92400e] p-1 rounded-lg shadow-2xl transform rotate-3 hover:rotate-0 transition-transform">
                <div className="bg-[#1a1a2e] p-10 rounded-lg">
                  <div className="text-center">
                    <div className="text-8xl font-bold text-[#c9a227] mb-4">V</div>
                    <div className="text-3xl font-bold mb-2">The Fatal Five</div>
                    <div className="text-[#a0a0b0] mb-6">Silent Killers of Agile Transformation</div>
                    <div className="w-20 h-0.5 bg-[#c9a227] mx-auto mb-6" />
                    <div className="text-sm text-[#a0a0b0]">Jeff Bourke</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resources - The Armory */}
      <section id="resources" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-sm font-medium text-[#c9a227] uppercase tracking-wider mb-4">Resources</div>
              <h3 className="text-3xl font-bold mb-6 text-[#1a1a2e]">The Armory</h3>
              <p className="text-xl text-[#666] mb-6 leading-relaxed">
                500+ presentation-ready slides built from years of real-world experience. 
                Sprint ceremonies, team foundations, metrics, SAFe scaling—everything 
                you need to run effective Agile practices.
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#f8f9fa] p-4 rounded-lg">
                  <div className="text-2xl font-bold text-[#1a1a2e]">500+</div>
                  <div className="text-sm text-[#666]">Ready-to-use slides</div>
                </div>
                <div className="bg-[#f8f9fa] p-4 rounded-lg">
                  <div className="text-2xl font-bold text-[#1a1a2e]">6</div>
                  <div className="text-sm text-[#666]">Curated bundles</div>
                </div>
                <div className="bg-[#f8f9fa] p-4 rounded-lg">
                  <div className="text-2xl font-bold text-[#1a1a2e]">$29</div>
                  <div className="text-sm text-[#666]">Starting price</div>
                </div>
                <div className="bg-[#f8f9fa] p-4 rounded-lg">
                  <div className="text-2xl font-bold text-[#1a1a2e]">24hr</div>
                  <div className="text-sm text-[#666]">Custom deck turnaround</div>
                </div>
              </div>
              
              <Button 
                size="lg"
                className="bg-[#1a1a2e] hover:bg-[#2a2a4e] text-white font-medium"
                onClick={() => window.location.href = '/'}
              >
                Browse The Armory
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            
            <div className="relative">
              <img 
                src="/images/jeff-trophy.jpg" 
                alt="Professional presentation" 
                className="w-full aspect-[4/3] object-cover rounded-2xl shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 bg-[#f8f9fa]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold mb-4 text-[#1a1a2e]">Let's Work Together</h3>
          <p className="text-[#666] text-lg mb-8">
            Whether you need a keynote speaker, transformation consulting, or custom 
            training materials—I'm here to help.
          </p>
          <div className="flex justify-center gap-4">
            <Button 
              size="lg"
              className="bg-[#1a1a2e] hover:bg-[#2a2a4e] text-white font-medium"
              onClick={handleContact}
            >
              <Mail className="w-5 h-5 mr-2" />
              Get in Touch
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-[#0077b5] text-[#0077b5] hover:bg-[#0077b5]/5"
              onClick={() => window.open('https://www.linkedin.com/in/jeffreybourke', '_blank')}
            >
              <Linkedin className="w-5 h-5 mr-2" />
              Connect on LinkedIn
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e5e5e5] py-8 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-[#666]">
            <div className="w-8 h-8 bg-[#1a1a2e] rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">RTC</span>
            </div>
            Release Train Chronicles © 2025
          </div>
          <div className="flex items-center gap-6 text-sm text-[#666]">
            <a href="/" className="hover:text-[#1a1a2e] transition-colors">The Armory</a>
            <a href="#insights" className="hover:text-[#1a1a2e] transition-colors">Insights</a>
            <a href="#book" className="hover:text-[#1a1a2e] transition-colors">The Book</a>
            <a href="#contact" className="hover:text-[#1a1a2e] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
