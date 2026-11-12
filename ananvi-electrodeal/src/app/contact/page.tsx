'use client';

import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Mail, MessageSquare, Building, Send, Check } from 'lucide-react';

const contactOptions = [
  { icon: Mail, title: 'General Enquiries', desc: 'Questions about our platform or services', email: 'hello@ananvi.ae' },
  { icon: Building, title: 'Retailer Partnerships', desc: 'Join our partner network', email: 'partners@ananvi.ae' },
  { icon: MessageSquare, title: 'Support', desc: 'Technical help and account issues', email: 'support@ananvi.ae' },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="font-display font-black text-4xl text-white mb-3">Get in Touch</h1>
          <p className="text-silver-400 max-w-lg mx-auto text-sm">
            We&apos;d love to hear from you. Reach out for any questions, partnerships, or support.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {contactOptions.map(({ icon: Icon, title, desc, email }) => (
            <div key={title} className="glass-card rounded-xl p-5 border border-white/8 text-center">
              <div className="w-10 h-10 rounded-lg bg-electric-blue/10 border border-electric-blue/20 flex items-center justify-center mx-auto mb-3">
                <Icon size={18} className="text-electric-cyan" />
              </div>
              <h3 className="font-display font-semibold text-sm text-white mb-1">{title}</h3>
              <p className="text-xs text-silver-500 mb-2">{desc}</p>
              <a href={`mailto:${email}`} className="text-xs font-mono text-electric-cyan hover:underline">{email}</a>
            </div>
          ))}
        </div>

        {submitted ? (
          <div className="glass-card rounded-2xl p-10 border border-green-400/20 text-center">
            <div className="w-16 h-16 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-green-400" />
            </div>
            <h2 className="font-display font-bold text-xl text-white mb-2">Message Sent!</h2>
            <p className="text-silver-400 text-sm">We&apos;ll get back to you within 1 business day.</p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-8 border border-white/8">
            <h2 className="font-display font-bold text-xl text-white mb-6">Send us a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-silver-500 mb-1.5 uppercase tracking-wider">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-navy-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 font-mono"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-silver-500 mb-1.5 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-navy-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 font-mono"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-silver-500 mb-1.5 uppercase tracking-wider">Subject</label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full bg-navy-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 font-mono"
                  placeholder="How can we help?"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-silver-500 mb-1.5 uppercase tracking-wider">Message</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-navy-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 font-mono resize-none"
                  placeholder="Tell us more..."
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-electric-gradient rounded-xl text-sm font-bold text-white shadow-electric hover:opacity-90 transition-opacity"
              >
                <Send size={15} />
                Send Message
              </button>
            </form>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
