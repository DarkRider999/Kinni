import { Users, Smartphone, Laptop, Headphones, Watch, Gamepad2, Tv } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { featuredProducts } from '@/lib/mockData';
import ProductCard from '@/components/ui/ProductCard';

export const metadata = { title: 'Family Shopping Guide | ANANVI ElectroDeal' };

const personas = [
  {
    emoji: '👦',
    title: 'For Kids',
    desc: 'Educational tablets, entry-level gaming, and durable devices with parental controls.',
    icon: Gamepad2,
    tags: ['Kids Tablet', 'Nintendo Switch', 'Educational Apps'],
  },
  {
    emoji: '🎓',
    title: 'For Students',
    desc: 'Powerful laptops, noise-cancelling earbuds, and budget smartphones for campus life.',
    icon: Laptop,
    tags: ['Student Laptop', 'ANC Earbuds', 'Budget Phone'],
  },
  {
    emoji: '👩‍💼',
    title: 'For Professionals',
    desc: 'Premium MacBooks, flagship phones, and smart accessories for the modern workplace.',
    icon: Smartphone,
    tags: ['MacBook Pro', 'iPhone 17 Pro', 'Smart Watch'],
  },
  {
    emoji: '🧓',
    title: 'For Seniors',
    desc: 'Large-screen devices, easy-to-use interfaces, and health-monitoring wearables.',
    icon: Watch,
    tags: ['Large Screen Phone', 'Smart TV', 'Health Watch'],
  },
];

const bundles = [
  {
    title: 'Work From Home Bundle',
    emoji: '🏠',
    items: ['MacBook Pro M4', 'Sony WH-1000XM6', 'Ergonomic Mouse & Keyboard'],
    total: 'AED 7,800',
    save: 'Save AED 650',
  },
  {
    title: 'Gaming Setup Bundle',
    emoji: '🎮',
    items: ['PS5 Slim', 'Samsung 65" OLED TV', 'DualSense Wireless Controller'],
    total: 'AED 9,200',
    save: 'Save AED 800',
  },
  {
    title: 'Smart Home Starter',
    emoji: '📱',
    items: ['iPhone 17 Pro Max', 'Apple Watch Series 10', 'AirPods Pro 3'],
    total: 'AED 8,500',
    save: 'Save AED 700',
  },
];

export default function FamilyShoppingPage() {
  const topPicks = featuredProducts.slice(0, 4);

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-electric-blue mb-4 shadow-electric">
            <Users size={24} className="text-white" />
          </div>
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">Shop Smarter Together</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Family Shopping Guide</h1>
          <p className="text-silver-400 max-w-lg mx-auto text-sm leading-relaxed">
            Curated picks for every member of your family — kids, students, professionals, and seniors.
            Find the right device at the best UAE price.
          </p>
        </div>

        {/* Persona grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {personas.map((persona) => (
            <div key={persona.title} className="glass-card rounded-2xl p-6 border border-white/8 hover:border-electric-blue/30 transition-colors group cursor-pointer">
              <span className="text-3xl mb-3 block">{persona.emoji}</span>
              <h2 className="font-display font-bold text-white text-base mb-2 group-hover:text-electric-cyan transition-colors">
                {persona.title}
              </h2>
              <p className="text-xs text-silver-400 mb-4 leading-relaxed">{persona.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {persona.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-silver-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bundle deals */}
        <div className="mb-16">
          <h2 className="font-display font-bold text-white text-xl mb-6">
            <span className="text-electric-cyan">Bundle</span> Deals
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {bundles.map((bundle) => (
              <div key={bundle.title} className="glass-card rounded-2xl p-6 border border-white/8">
                <span className="text-3xl mb-3 block">{bundle.emoji}</span>
                <h3 className="font-display font-bold text-white text-sm mb-3">{bundle.title}</h3>
                <ul className="space-y-1.5 mb-4">
                  {bundle.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-silver-400">
                      <span className="w-1 h-1 rounded-full bg-electric-cyan flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="font-display font-bold text-white text-sm">{bundle.total}</span>
                  <span className="text-xs font-mono text-green-400">{bundle.save}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top picks */}
        <div>
          <h2 className="font-display font-bold text-white text-xl mb-6">
            Top <span className="text-electric-cyan">Family</span> Picks
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {topPicks.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
