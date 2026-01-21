/**
 * CONCEPT B: "THE FIELD JOURNAL"
 * Design Philosophy: Warm, weathered, storytelling vibe
 * - Well-worn notebook meets memoir
 * - Authentic, personal, human
 * - Paper textures, handwritten accents
 * - Colors: Warm cream, aged paper, ink blue, leather brown, burnt sienna
 * - Typography: Serif headers, readable body, occasional handwritten touches
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  BookOpen, 
  PenTool, 
  Bookmark,
  Quote,
  ChevronRight,
  Mail,
  Linkedin,
  ArrowRight,
  Calendar,
  MapPin,
  Coffee
} from "lucide-react";

// Article data from Jeff's LinkedIn
const articles = [
  {
    id: 1,
    title: "Before You Reboot, Audit What You Already Built",
    excerpt: "The system isn't broken—the discipline is. I've seen this cycle play out multiple times. And the most valuable people in the room during these moments are the ones who've been there before.",
    category: "Reflection",
    readTime: "7 min read",
    date: "October 2025",
    featured: true
  },
  {
    id: 2,
    title: "Your Sprint is Failing Before It Even Begins",
    excerpt: "Sprint Planning ends. Everyone's optimistic. Two days later... chaos. Here's the story of how we cut rollover from 40% to under 5%.",
    category: "Lessons Learned",
    readTime: "5 min read",
    date: "October 2025"
  },
  {
    id: 3,
    title: "The PI Planning Over/Under",
    excerpt: "Why the unofficial betting pool isn't just office humor—it's your fastest feedback loop.",
    category: "Field Notes",
    readTime: "4 min read",
    date: "October 2025"
  },
  {
    id: 4,
    title: "Your Best Scrum Team Is About to Get Their Budget Cut",
    excerpt: "The most dangerous role for a Scrum Master isn't facilitator or coach—it's promoter. Here's how to make excellence visible.",
    category: "Hard Truths",
    readTime: "6 min read",
    date: "September 2025"
  },
  {
    id: 5,
    title: "Stop Playing Fantasy Football with Your Dev Teams",
    excerpt: "As millions draft their fantasy teams, a similar game is being played in Agile development—and it's a guaranteed way to lose.",
    category: "Observations",
    readTime: "5 min read",
    date: "September 2025"
  }
];

export default function ConceptB() {
  const handleContact = () => {
    toast.info("Contact form coming soon", {
      description: "For now, connect on LinkedIn."
    });
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2c2416]">
      {/* Paper texture overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Header - Notebook Spine */}
      <header className="border-b-2 border-[#d4c4a8] bg-[#faf8f5]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#8b4513] rounded flex items-center justify-center shadow-md">
                <BookOpen className="w-6 h-6 text-[#faf8f5]" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold text-[#2c2416]">Release Train Chronicles</h1>
                <p className="text-sm text-[#6b5c4c] italic">Stories from the trenches</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-8 text-sm">
              <a href="#about" className="text-[#6b5c4c] hover:text-[#8b4513] transition-colors">About</a>
              <a href="#writings" className="text-[#6b5c4c] hover:text-[#8b4513] transition-colors">Writings</a>
              <a href="#book" className="text-[#6b5c4c] hover:text-[#8b4513] transition-colors">The Book</a>
              <a href="#resources" className="text-[#6b5c4c] hover:text-[#8b4513] transition-colors">Resources</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero - Opening Page */}
      <section className="relative py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-5 gap-12 items-center">
            {/* Photo with polaroid effect */}
            <div className="lg:col-span-2 order-2 lg:order-1">
              <div className="bg-white p-3 pb-12 shadow-xl rotate-2 hover:rotate-0 transition-transform duration-300">
                <img 
                  src="/images/jeff-speaking.jpg" 
                  alt="Jeff Bourke" 
                  className="w-full aspect-square object-cover object-top"
                />
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <span className="font-handwriting text-[#6b5c4c] text-lg" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                    Jeff, 2025
                  </span>
                </div>
              </div>
            </div>

            {/* Opening text */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 text-[#8b4513] mb-6">
                <Coffee className="w-4 h-4" />
                <span className="text-sm uppercase tracking-wider">A personal note</span>
              </div>
              
              <h2 className="font-serif text-4xl md:text-5xl leading-tight mb-6 text-[#2c2416]">
                Real stories from someone who's been in the room when it all went sideways.
              </h2>
              
              <p className="text-lg text-[#6b5c4c] mb-8 leading-relaxed">
                After years of navigating enterprise Agile transformations—the wins, the failures, 
                and everything in between—I started writing it all down. Not the polished conference 
                version. The real stuff. The messy middle. The lessons that only come from experience.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  className="bg-[#8b4513] hover:bg-[#6b3410] text-[#faf8f5] font-medium"
                  onClick={() => document.getElementById('writings')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <PenTool className="w-5 h-5 mr-2" />
                  Read the Stories
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-[#8b4513] text-[#8b4513] hover:bg-[#8b4513]/10"
                  onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  About Me
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider - Torn paper effect */}
      <div className="h-8 bg-[#f0e6d3] relative">
        <div className="absolute inset-x-0 top-0 h-4 bg-[#faf8f5]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 95% 60%, 90% 100%, 85% 50%, 80% 100%, 75% 70%, 70% 100%, 65% 40%, 60% 100%, 55% 60%, 50% 100%, 45% 50%, 40% 100%, 35% 70%, 30% 100%, 25% 40%, 20% 100%, 15% 60%, 10% 100%, 5% 50%, 0 100%)' }} />
      </div>

      {/* About - Personal Story */}
      <section id="about" className="py-20 bg-[#f0e6d3]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <Bookmark className="w-5 h-5 text-[#8b4513]" />
              <span className="text-sm text-[#8b4513] uppercase tracking-wider">Chapter One</span>
            </div>
            
            <h3 className="font-serif text-3xl mb-8 text-[#2c2416]">The Journey So Far</h3>
            
            <div className="prose prose-lg text-[#6b5c4c] space-y-6">
              <p className="first-letter:text-5xl first-letter:font-serif first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-[#8b4513]">
                I've spent my career in the space between theory and reality. The place where 
                Agile frameworks meet enterprise politics. Where transformation roadmaps collide 
                with quarterly targets. Where well-intentioned coaches discover that change is 
                harder than any certification prepared them for.
              </p>
              
              <p>
                Through it all, I've kept notes. Not just the what, but the why. The patterns 
                that repeat across organizations. The mistakes I've made (and watched others make). 
                The small wins that compound into real change.
              </p>
              
              <p>
                <strong className="text-[#2c2416]">Release Train Chronicles</strong> is where those notes become stories. 
                Written for Scrum Masters, RTEs, coaches, and anyone else trying to make Agile 
                actually work in the real world.
              </p>
            </div>

            {/* Credentials as handwritten notes */}
            <div className="mt-12 bg-[#faf8f5] p-6 border-l-4 border-[#8b4513] shadow-sm">
              <div className="text-sm text-[#6b5c4c] italic mb-3">Credentials & Experience:</div>
              <div className="flex flex-wrap gap-3">
                {['PMP', 'PMI-ACP', 'CSM', 'SAFe RTE', 'SDP', 'POPM', 'SP'].map(cert => (
                  <span key={cert} className="px-3 py-1 bg-[#f0e6d3] text-[#6b5c4c] text-sm rounded">
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Writings - Journal Entries */}
      <section id="writings" className="py-20 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <PenTool className="w-5 h-5 text-[#8b4513]" />
                <span className="text-sm text-[#8b4513] uppercase tracking-wider">Recent Entries</span>
              </div>
              <h3 className="font-serif text-3xl text-[#2c2416]">From the Journal</h3>
            </div>
            <a 
              href="https://www.linkedin.com/in/jeffreybourke" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 text-[#8b4513] hover:underline text-sm"
            >
              View all entries
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Featured Entry */}
          {articles.filter(a => a.featured).map(article => (
            <Card 
              key={article.id}
              className="bg-white border-none shadow-lg mb-10 overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
            >
              <div className="p-8 md:p-10">
                <div className="flex items-center gap-4 mb-4 text-sm text-[#6b5c4c]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {article.date}
                  </span>
                  <span>·</span>
                  <span>{article.readTime}</span>
                  <span>·</span>
                  <Badge variant="outline" className="border-[#d4c4a8] text-[#8b4513]">
                    {article.category}
                  </Badge>
                </div>
                
                <h4 className="font-serif text-2xl md:text-3xl mb-4 text-[#2c2416]">{article.title}</h4>
                
                <div className="flex items-start gap-3 mb-6">
                  <Quote className="w-8 h-8 text-[#d4c4a8] flex-shrink-0 mt-1" />
                  <p className="text-lg text-[#6b5c4c] italic leading-relaxed">{article.excerpt}</p>
                </div>
                
                <Button variant="link" className="text-[#8b4513] p-0 h-auto font-medium">
                  Continue reading
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          ))}

          {/* Entry List */}
          <div className="space-y-6">
            {articles.filter(a => !a.featured).map(article => (
              <Card 
                key={article.id}
                className="bg-white border-none shadow-md hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="p-6 flex gap-6">
                  <div className="hidden md:block w-24 text-center flex-shrink-0 border-r border-[#d4c4a8] pr-6">
                    <div className="text-2xl font-serif text-[#8b4513]">{article.date.split(' ')[0]}</div>
                    <div className="text-sm text-[#6b5c4c]">{article.date.split(' ')[1]}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 text-sm text-[#6b5c4c]">
                      <Badge variant="outline" className="border-[#d4c4a8] text-[#6b5c4c] text-xs">
                        {article.category}
                      </Badge>
                      <span>{article.readTime}</span>
                    </div>
                    <h4 className="font-serif text-xl mb-2 text-[#2c2416] hover:text-[#8b4513] transition-colors">
                      {article.title}
                    </h4>
                    <p className="text-[#6b5c4c] text-sm">{article.excerpt}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* The Fatal Five - Book Section */}
      <section id="book" className="py-20 bg-[#2c2416] text-[#faf8f5]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Book Cover */}
            <div className="relative">
              <div className="bg-[#8b4513] p-8 shadow-2xl transform -rotate-2">
                <div className="border-4 border-[#d4c4a8] p-8 text-center">
                  <div className="text-6xl font-serif mb-4">V</div>
                  <div className="text-3xl font-serif mb-2">The Fatal Five</div>
                  <div className="text-sm tracking-wider uppercase mb-6">Silent Killers of Agile Transformation</div>
                  <div className="w-16 h-0.5 bg-[#d4c4a8] mx-auto mb-6" />
                  <div className="text-sm">Jeff Bourke</div>
                </div>
              </div>
            </div>

            {/* Book Description */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <BookOpen className="w-5 h-5 text-[#d4c4a8]" />
                <span className="text-sm text-[#d4c4a8] uppercase tracking-wider">The Book</span>
              </div>
              
              <h3 className="font-serif text-4xl mb-6">The Fatal Five</h3>
              
              <p className="text-lg text-[#d4c4a8] mb-6 leading-relaxed">
                Five patterns I've seen kill Agile transformations over and over again. 
                Not the obvious ones—the silent killers that creep in slowly, eroding 
                discipline until one day you realize you're not doing Agile anymore.
              </p>
              
              <ul className="space-y-3 mb-8 text-[#d4c4a8]">
                {[
                  "The 'Just This Once' trap",
                  "The Déjà Vu moment",
                  "The invisible erosion of discipline",
                  "Why auditing beats rebooting",
                  "Building change that actually sticks"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full border border-[#d4c4a8] flex items-center justify-center text-sm">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              
              <Button 
                size="lg"
                className="bg-[#d4c4a8] hover:bg-[#c4b498] text-[#2c2416] font-medium"
                onClick={() => toast.info("Book coming soon!", { description: "Join the waitlist for early access." })}
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Join the Waitlist
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Resources - The Armory Link */}
      <section id="resources" className="py-20 bg-[#f0e6d3]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-[#faf8f5] p-10 md:p-12 shadow-lg border-t-4 border-[#8b4513]">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Bookmark className="w-5 h-5 text-[#8b4513]" />
                  <span className="text-sm text-[#8b4513] uppercase tracking-wider">Resources</span>
                </div>
                <h3 className="font-serif text-3xl mb-4 text-[#2c2416]">The Armory</h3>
                <p className="text-[#6b5c4c] mb-6 leading-relaxed">
                  500+ presentation slides I've built and refined over the years. Sprint ceremonies, 
                  team foundations, metrics, SAFe scaling—ready-to-use decks for the real work.
                </p>
                <Button 
                  size="lg"
                  className="bg-[#8b4513] hover:bg-[#6b3410] text-[#faf8f5]"
                  onClick={() => window.location.href = '/'}
                >
                  Browse the Collection
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#f0e6d3] p-6 text-center">
                  <div className="text-3xl font-serif text-[#8b4513]">500+</div>
                  <div className="text-sm text-[#6b5c4c]">Slides</div>
                </div>
                <div className="bg-[#f0e6d3] p-6 text-center">
                  <div className="text-3xl font-serif text-[#8b4513]">6</div>
                  <div className="text-sm text-[#6b5c4c]">Bundles</div>
                </div>
                <div className="bg-[#f0e6d3] p-6 text-center">
                  <div className="text-3xl font-serif text-[#8b4513]">$29</div>
                  <div className="text-sm text-[#6b5c4c]">Starting at</div>
                </div>
                <div className="bg-[#f0e6d3] p-6 text-center">
                  <div className="text-3xl font-serif text-[#8b4513]">Custom</div>
                  <div className="text-sm text-[#6b5c4c]">Decks available</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="max-w-xl mx-auto">
            <h3 className="font-serif text-3xl mb-4 text-[#2c2416]">Let's Connect</h3>
            <p className="text-[#6b5c4c] mb-8">
              Whether you're looking for a speaking engagement, consulting help, 
              or just want to swap war stories—I'd love to hear from you.
            </p>
            <div className="flex justify-center gap-4">
              <Button 
                size="lg"
                className="bg-[#8b4513] hover:bg-[#6b3410] text-[#faf8f5]"
                onClick={handleContact}
              >
                <Mail className="w-5 h-5 mr-2" />
                Get in Touch
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-[#0077b5] text-[#0077b5] hover:bg-[#0077b5]/10"
                onClick={() => window.open('https://www.linkedin.com/in/jeffreybourke', '_blank')}
              >
                <Linkedin className="w-5 h-5 mr-2" />
                LinkedIn
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#d4c4a8] py-8 bg-[#f0e6d3]">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-[#6b5c4c]">
            <BookOpen className="w-4 h-4 text-[#8b4513]" />
            Release Train Chronicles © 2025
          </div>
          <div className="flex items-center gap-6 text-sm text-[#6b5c4c]">
            <a href="/" className="hover:text-[#8b4513] transition-colors">The Armory</a>
            <a href="#writings" className="hover:text-[#8b4513] transition-colors">Writings</a>
            <a href="#contact" className="hover:text-[#8b4513] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
