import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = { title: 'Terms of Service | ANANVI ElectroDeal' };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">Legal</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Terms of Service</h1>
          <p className="text-silver-500 text-sm font-mono">Last updated: November 2025</p>
        </div>

        <div className="space-y-8 text-silver-300 text-sm leading-relaxed">
          {[
            {
              title: '1. Acceptance of Terms',
              content: `By accessing or using ANANVI ElectroDeal, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.`,
            },
            {
              title: '2. Service Description',
              content: `ANANVI ElectroDeal is a price comparison and research platform for electronics in the UAE. We aggregate pricing data from third-party retailers but do not directly sell products. All purchases are made directly with the respective retailers.`,
            },
            {
              title: '3. Price Accuracy',
              content: `While we strive to maintain accurate pricing information, prices and availability may change frequently. We cannot guarantee that prices displayed on our platform match those on retailer websites at the time of purchase. Always verify the final price on the retailer's website before completing a purchase.`,
            },
            {
              title: '4. Coupon Codes',
              content: `Coupon codes listed on our platform are sourced from public sources and retailer partners. We verify codes regularly, but cannot guarantee their validity at the time of use. Code success rates are displayed based on historical user data.`,
            },
            {
              title: '5. User Accounts',
              content: `You are responsible for maintaining the security of your account credentials. You must not share your account with others or use another person's account. We reserve the right to suspend or terminate accounts that violate our terms.`,
            },
            {
              title: '6. Intellectual Property',
              content: `All content on this platform, including text, graphics, logos, and software, is the property of ANANVI FZ-LLC or its content suppliers. You may not reproduce, distribute, or create derivative works without written permission.`,
            },
            {
              title: '7. Limitation of Liability',
              content: `ANANVI ElectroDeal is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of our service, including but not limited to incorrect pricing, failed coupon codes, or losses from purchasing decisions based on our data.`,
            },
            {
              title: '8. Governing Law',
              content: `These terms are governed by the laws of the United Arab Emirates. Any disputes shall be subject to the exclusive jurisdiction of the courts of Dubai, UAE.`,
            },
          ].map(({ title, content }) => (
            <div key={title} className="glass-card rounded-xl p-6 border border-white/8">
              <h2 className="font-display font-bold text-white mb-3 text-base">{title}</h2>
              <p>{content}</p>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  );
}
