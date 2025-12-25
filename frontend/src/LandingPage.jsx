import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  // Scroll listener for glass navbar effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-fuchsia-500/30">

      {/* Background Ambient Glows (Fixed) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[100px] animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-500/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[700px] h-[700px] bg-rose-500/20 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      {/* Glass Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-900/70 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl filter drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]">🎐</span>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Invitewala
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">How it works</a>
            <a href="#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Features</a>
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-full backdrop-blur-md transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_25px_rgba(217,70,239,0.2)] hover:-translate-y-0.5"
            >
              Member Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Cinematic & Intimate */}
      <section className="relative h-screen flex items-center justify-center px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10">

          {/* Badge */}
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-800/80 border border-white/10 backdrop-blur-md mb-12 shadow-[0_0_20px_rgba(0,0,0,0.5)] animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-slate-300 tracking-widest uppercase">Production Ready System</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-white mb-8 leading-[0.9] drop-shadow-2xl mix-blend-overlay opacity-90">
            Personalize. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 animate-gradient-x">
              Distribute.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-400 mb-14 max-w-2xl mx-auto font-light leading-relaxed tracking-wide">
            Turn one template into thousands of warm, personal invitations. Delivered securely via WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <button
              onClick={() => navigate('/login')}
              className="group relative px-10 py-5 rounded-full bg-white text-slate-900 font-bold text-lg shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:shadow-[0_0_80px_rgba(255,255,255,0.4)] transition-all transform hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-fuchsia-500/0 group-hover:bg-fuchsia-500/10 rounded-full transition-colors duration-500"></div>
              <span className="relative z-10">Start Free Batch</span>
            </button>

            <button className="text-slate-400 hover:text-white transition-colors flex items-center gap-3 text-sm font-medium tracking-widest uppercase group">
              <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center group-hover:bg-white/10 transition-colors">▶</div>
              Watch the magic
            </button>
          </div>
        </div>

        {/* Micro-parallax floating elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-10 w-64 h-80 rounded-2xl bg-slate-800/30 border border-white/5 backdrop-blur-sm -rotate-6 animate-float-slow"></div>
          <div className="absolute bottom-1/4 right-10 w-72 h-48 rounded-2xl bg-slate-800/30 border border-white/5 backdrop-blur-sm rotate-3 animate-float-slower"></div>
        </div>
      </section>

      {/* How It Works (Glass Cards) */}
      <section id="how-it-works" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Magic in Three Steps</h2>
            <p className="text-slate-400 text-lg">From static PDF to personalized experience.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '📂', title: 'Upload Design', desc: 'Drag & drop your invitation PDF or image. Supports high-res print files.' },
              { icon: '🪄', title: 'Style Match', desc: 'Draw zones. Our AI auto-removes placeholder text and matches the fonts.' },
              { icon: '🚀', title: 'WhatsApp Blast', desc: 'Connect your cloud API or Web session and send thousands in minutes.' }
            ].map((step, i) => (
              <div key={i} className="group relative p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-lg hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300 border border-white/10">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / Stats */}
      <section className="py-20 border-y border-white/5 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'Cards Delivered', value: '1.2M+' },
            { label: 'Happy Couples', value: '850+' },
            { label: 'Uptime', value: '99.9%' },
            { label: 'Time Saved', value: '25k Hrs' }
          ].map((stat, i) => (
            <div key={i}>
              <div className="text-4xl font-bold text-white mb-2 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">{stat.value}</div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl text-slate-500 grayscale opacity-50">🎐</span>
            <span className="text-sm text-slate-500">© 2024 Invitewala Labs.</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {/* Styles for animation */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}
