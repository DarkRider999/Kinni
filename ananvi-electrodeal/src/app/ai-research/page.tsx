'use client';

import { useState, useRef, useEffect } from 'react';
import { Brain, Zap, Send, ArrowRight, CheckCircle, TrendingDown, AlertTriangle, Star } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { featuredProducts } from '@/lib/mockData';

const examplePrompts = [
  'Should I buy an iPhone 17 Pro Max now or wait for iPhone 18?',
  'What\'s the best laptop under AED 5,000 for video editing?',
  'Compare PS5 Slim vs Xbox Series X for someone in Dubai',
  'Is the Samsung S26 Ultra worth the upgrade from S24?',
  'Best noise-canceling headphones under AED 1,000',
];

type Message = { role: 'user' | 'assistant'; content: string };

const mockResponse = (query: string): string => {
  return `## AI Research Report

**Query:** "${query}"

### Quick Verdict
Based on current UAE market data across 11 retailers, here's my analysis:

**🟢 Recommendation: Buy Now** — Prices are at a 3-month low.

---

### Price Analysis
- **Best price today:** AED 3,899 at Noon.com
- **Historical low (90 days):** AED 3,750 (6 weeks ago)
- **Price trend:** ↓ Declining — down 8% over last 30 days
- **Expected trajectory:** Stable for next 2–3 weeks, may drop 5% before Expo season

---

### Why Now?
1. Current coupon **NOON10** gives 10% off, bringing it to ~AED 3,509
2. No major product refresh expected in next 60 days
3. Sharaf DG has an open-box certified unit at AED 3,200 — excellent value
4. Retailer competition is high this week — Carrefour UAE is matching Noon prices

---

### Risk Factors
- ⚠️ New model rumored in Q2 2026 — if you can wait 4+ months, worth it
- ✅ 2-year UAE warranty available from multiple sellers
- ✅ Free delivery from Amazon.ae and Noon

---

### Best Deals Right Now
| Retailer | Condition | Price | Delivery |
|----------|-----------|-------|----------|
| Noon.com | Brand New | AED 3,899 | Free, 2d |
| Amazon.ae | Brand New | AED 3,950 | Free, 1d |
| Sharaf DG | Open Box | AED 3,200 | AED 25, 3d |
| Cartlow | Refurbished | AED 2,800 | AED 15, 4d |

---

*Analysis based on live data from 11 UAE retailers. Updated 23 minutes ago.*`;
};

export default function AIResearchPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    await new Promise((r) => setTimeout(r, 1500));
    const assistantMsg: Message = { role: 'assistant', content: mockResponse(text) };
    setMessages((prev) => [...prev, assistantMsg]);
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-electric-gradient mb-4 shadow-electric">
            <Brain size={24} className="text-white" />
          </div>
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">Powered by AI</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">AI Research Reports</h1>
          <p className="text-silver-400 max-w-lg mx-auto text-sm leading-relaxed">
            Ask anything about electronics in the UAE market. Get price analysis, buy vs wait recommendations,
            and retailer comparisons — all backed by live data.
          </p>
        </div>

        {/* Feature chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { icon: TrendingDown, text: 'Price History' },
            { icon: CheckCircle, text: 'Buy vs Wait' },
            { icon: Star, text: 'Best Deals' },
            { icon: AlertTriangle, text: 'Risk Factors' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 px-3 py-1.5 glass-card rounded-full border border-white/10 text-xs font-mono text-silver-400">
              <Icon size={11} className="text-electric-cyan" /> {text}
            </div>
          ))}
        </div>

        {/* Chat area */}
        <div className="glass-card rounded-2xl border border-white/8 overflow-hidden">
          {/* Messages */}
          <div className="min-h-80 max-h-[500px] overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-silver-400 text-sm mb-6">Ask me anything about buying electronics in the UAE</p>
                <div className="space-y-2">
                  {examplePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="block w-full text-left px-4 py-2.5 glass-card rounded-xl border border-white/5 hover:border-electric-blue/30 text-xs text-silver-400 hover:text-silver-200 font-mono transition-all"
                    >
                      <ArrowRight size={12} className="inline mr-2 text-electric-cyan" />
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-electric-gradient flex items-center justify-center shrink-0 mt-1 shadow-electric">
                    <Brain size={14} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-electric-gradient text-white font-medium'
                      : 'glass-card border border-white/8 text-silver-200 font-mono whitespace-pre-wrap'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-electric-gradient flex items-center justify-center shrink-0 shadow-electric">
                  <Brain size={14} className="text-white" />
                </div>
                <div className="glass-card border border-white/8 rounded-2xl px-4 py-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 bg-electric-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-electric-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-electric-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-silver-500 font-mono ml-2">Analyzing 11 UAE retailers...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/5 p-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about any product, price trend, or buying decision..."
                className="flex-1 bg-navy-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 font-mono"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex items-center gap-2 px-5 py-3 bg-electric-gradient rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity shadow-electric"
              >
                <Zap size={15} />
                <span className="hidden sm:inline">Research</span>
              </button>
            </form>
            <p className="text-xs text-silver-600 font-mono mt-2 text-center">
              AI analysis based on live data from 11 UAE retailers · Updated hourly
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
