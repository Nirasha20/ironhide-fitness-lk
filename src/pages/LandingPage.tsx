import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';

const GYM_IMAGE = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80';

export default function LandingPage() {
  return (
    <PageWrapper>
      {/* Hero */}
      <section className="relative h-screen w-full flex items-start pt-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={GYM_IMAGE} alt="IronHide Fitness Gym" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 100%)' }} />
        </div>
        <div className="relative z-10 w-full max-w-container mx-auto px-margin-mobile md:px-margin-desktop text-center md:text-left">
          <h1 className="font-display text-[60px] md:text-display-lg leading-tight mb-8">
            <span className="text-on-surface block">WHERE</span>
            <span className="text-primary-container block -mt-4">CHAMPIONS</span>
            <span className="text-on-surface block -mt-4">ARE BUILT</span>
          </h1>
          <div className="flex flex-col md:flex-row gap-4 justify-center md:justify-start">
            <Link to="/signup" className="bg-primary-container text-on-primary-container px-10 py-4 font-display text-headline-md tracking-widest crimson-glow transition-all active:scale-95 hover:scale-105 text-center">
              JOIN NOW
            </Link>
            <Link to="/login" className="border-2 border-on-surface text-on-surface px-10 py-4 font-display text-headline-md tracking-widest hover:bg-on-surface hover:text-background transition-all active:scale-95 text-center">
              MEMBER LOGIN
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 z-10">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Explore</span>
          <div className="flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ animation: 'bounce 1.5s infinite' }}>keyboard_arrow_down</span>
            <span className="material-symbols-outlined text-primary-container opacity-70" style={{ animation: 'bounce 1.5s infinite 0.2s' }}>keyboard_arrow_down</span>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(6px); opacity: 1; }
        }
      `}</style>

      {/* Stats Strip */}
      <section className="py-section-gap px-margin-mobile md:px-margin-desktop max-w-container mx-auto">
        <div className="flex flex-col items-center mb-16">
          <h2 className="font-display text-headline-lg text-on-surface mb-4">WHY IRONHIDE FITNESS</h2>
          <div className="w-24 h-1 bg-primary-container" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
          {[
            { icon: 'calendar_today', title: '7 DAYS A WEEK', desc: 'The grind never stops. Train whenever your schedule demands.' },
            { icon: 'ac_unit', title: 'AC FACILITY', desc: 'Maintain peak performance in a climate-controlled environment.' },
            { icon: 'fitness_center', title: 'ELITE EQUIPMENT', desc: 'Access to specialized machines and competition-grade iron.' },
            { icon: 'groups', title: 'CHAMPION COMMUNITY', desc: 'Surround yourself with individuals as dedicated as you.' },
          ].map(item => (
            <div key={item.title} className="bg-surface-container border-t-2 border-primary-container p-8 flex flex-col items-center text-center transition-transform hover:-translate-y-2">
              <span className="material-symbols-outlined text-primary-container text-5xl mb-4">{item.icon}</span>
              <h3 className="font-display text-headline-md text-on-surface mb-2">{item.title}</h3>
              <p className="text-body-md text-on-surface-variant font-body">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Membership Plans */}
      <section className="py-section-gap px-margin-mobile md:px-margin-desktop max-w-container mx-auto">
        <div className="flex flex-col items-center mb-16 text-center">
          <h2 className="font-display text-headline-lg text-on-surface mb-4">MEMBERSHIP PLANS</h2>
          <p className="text-body-lg text-on-surface-variant max-w-2xl font-body">Choose your path to excellence. No contracts, no excuses.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { tier: 'Trial', name: 'DAILY', price: 'LKR 500', period: '/DAY', popular: false },
            { tier: 'Foundation', name: 'MONTHLY', price: 'LKR 5,000', period: '/MO', popular: false },
            { tier: 'Elite', name: 'ANNUAL', price: 'LKR 48,000', period: '/YR', popular: true },
            { tier: 'Duo', name: 'ANNUAL — COUPLE', price: 'LKR 80,000', period: '/YR', popular: false },
          ].map(plan => (
            <div key={plan.name} className={`bg-[#111111] p-8 flex flex-col items-center relative transition-all hover:-translate-y-2 ${plan.popular ? 'border-2 border-primary-container scale-105 z-10 crimson-glow' : 'border-t-2 border-t-primary-container border border-[#333333]'}`}>
              {plan.popular && <div className="absolute -top-4 bg-primary-container text-white font-label-sm text-label-sm px-4 py-1 uppercase font-extrabold tracking-widest">MOST POPULAR</div>}
              <span className="bg-[#000000] border border-primary-container text-primary-container font-label-sm text-label-sm px-4 py-1 mb-6 uppercase tracking-widest">{plan.tier}</span>
              <h3 className="font-display text-headline-lg mb-2 text-center">{plan.name}</h3>
              <div className="flex items-baseline mb-8">
                <span className="font-display text-4xl">{plan.price}</span>
                <span className="font-label-sm text-label-sm text-on-secondary-container ml-2">{plan.period}</span>
              </div>
              <div className="w-full mb-10 flex items-center gap-3 text-on-secondary-container font-body text-body-md">
                <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Locker Room
              </div>
              <Link to="/signup" className="w-full bg-primary-container text-white py-4 font-display text-headline-md uppercase hover:scale-105 active:scale-95 transition-all text-center block mt-auto">
                JOIN NOW
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Location */}
      <section className="py-section-gap bg-surface-container-low">
        <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 md:grid-cols-2 gap-section-gap items-center">
          <div>
            <h2 className="font-display text-headline-lg text-on-surface mb-8">FIND US</h2>
            <div className="space-y-8">
              {[
                { icon: 'location_on', title: 'HEADQUARTERS', body: '114C Negombo Rd, Wattala 32350, Sri Lanka' },
                { icon: 'schedule', title: 'HOURS', body: 'Mon–Fri: 5AM–10PM\nSat: 7AM–11AM\nSun: 5AM–10PM' },
                { icon: 'call', title: 'CONTACT', body: '070 322 2211\nironhide.fitness@gmail.com' },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-primary-container text-4xl">{item.icon}</span>
                  <div>
                    <h4 className="font-display text-headline-md text-on-surface uppercase mb-2">{item.title}</h4>
                    <p className="text-body-lg text-on-surface-variant font-body whitespace-pre-line">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <a
            href="https://maps.google.com/maps?q=114C+Negombo+Road,+Wattala,+Sri+Lanka"
            target="_blank"
            rel="noopener noreferrer"
            className="h-[450px] border-2 border-primary-container overflow-hidden flex flex-col items-center justify-center gap-4 bg-surface-container group hover:border-primary-container transition-all"
          >
            <span className="material-symbols-outlined text-primary-container text-6xl group-hover:scale-110 transition-transform">location_on</span>
            <p className="font-display text-headline-md uppercase">View on Google Maps</p>
            <p className="font-body text-body-md text-on-surface-variant text-center px-8">114C Negombo Rd, Wattala 32350, Sri Lanka</p>
            <span className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest border border-primary-container px-4 py-2">Open Maps →</span>
          </a>
        </div>
      </section>
    </PageWrapper>
  );
}
