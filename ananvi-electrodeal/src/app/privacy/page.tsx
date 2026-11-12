import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = { title: 'Privacy Policy | ANANVI ElectroDeal' };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">Legal</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Privacy Policy</h1>
          <p className="text-silver-500 text-sm font-mono">Last updated: November 2025</p>
        </div>

        <div className="space-y-8 text-silver-300 text-sm leading-relaxed">
          {[
            {
              title: '1. Information We Collect',
              content: `We collect information you provide directly to us (such as when you create an account, set up deal alerts, or contact us), information collected automatically (such as usage data, search queries, and device information), and information from third-party partners.`,
            },
            {
              title: '2. How We Use Your Information',
              content: `We use your information to provide and improve our services, send price alerts and notifications you've requested, personalize your experience, analyze usage trends, and comply with legal obligations. We do not sell your personal data to third parties.`,
            },
            {
              title: '3. Data Sharing',
              content: `We may share your data with retailer partners when you click through to their sites (they receive your session for tracking purposes), service providers who help us operate our platform, and law enforcement when required by UAE law.`,
            },
            {
              title: '4. Cookies and Tracking',
              content: `We use cookies and similar technologies for session management, analytics, and personalization. You can control cookie settings through your browser. Disabling cookies may affect some features of our service.`,
            },
            {
              title: '5. Data Retention',
              content: `We retain your account data for as long as your account is active. Search history and price alerts are retained for 12 months. You may request deletion of your data at any time by contacting privacy@ananvi.ae.`,
            },
            {
              title: '6. UAE Data Protection',
              content: `ANANVI ElectroDeal complies with UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL). Your data is processed and stored in accordance with UAE data protection regulations.`,
            },
            {
              title: '7. Contact Us',
              content: `For privacy-related inquiries, please contact us at privacy@ananvi.ae or write to ANANVI FZ-LLC, Dubai Silicon Oasis, Dubai, UAE.`,
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
