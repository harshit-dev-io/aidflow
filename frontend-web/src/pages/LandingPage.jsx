import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Shield, Zap, ChevronRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="animate-slide-up" style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#ededed', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Premium Navbar */}
      <nav style={{ padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', fontWeight: '700', fontSize: '1.25rem', textDecoration: 'none', letterSpacing: '-0.02em' }}>
          <div style={{ background: '#3b82f6', padding: '6px', borderRadius: '8px' }}><Activity size={20} color="white" /></div>
          AidFlow
        </Link>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <Link to="/login" style={{ color: '#a1a1aa', fontWeight: 500, fontSize: '0.95rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e=>e.target.style.color='#fff'} onMouseOut={e=>e.target.style.color='#a1a1aa'}>Log in</Link>
          <Link to="/signup" style={{ padding: '8px 16px', fontSize: '0.95rem', background: '#ffffff', color: '#000000', textDecoration: 'none', borderRadius: '6px', fontWeight: 600, transition: 'opacity 0.2s' }} onMouseOver={e=>e.target.style.opacity='0.9'} onMouseOut={e=>e.target.style.opacity='1'}>Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '6px 12px', borderRadius: '20px', color: '#60a5fa', fontSize: '0.85rem', fontWeight: 600, marginBottom: '24px' }}>
          ✨ AidFlow 2.0 is now live
        </div>
        
        <h1 style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', fontWeight: 800, color: '#ffffff', marginBottom: '24px', maxWidth: '900px', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
          Transform field data into <br/>
          <span style={{ background: 'linear-gradient(to right, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>actionable intelligence.</span>
        </h1>
        
        <p style={{ fontSize: '1.25rem', color: '#a1a1aa', maxWidth: '600px', marginBottom: '48px', lineHeight: 1.6, fontWeight: 400 }}>
          The unified workspace for NGOs. Automatically parse unstructured field notes into dynamic assignments using Gemini AI.
        </p>
        
        <Link to="/signup" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 32px', fontSize: '1.1rem', borderRadius: '8px', background: '#3b82f6', color: '#ffffff', textDecoration: 'none', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}>
          Start your workspace <ChevronRight size={18} />
        </Link>

        {/* Feature Cards */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '100px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { icon: <Zap size={24} color="#60a5fa"/>, title: 'Instantly Triaged', desc: 'No more manual sorting. Our AI extracts meaning instantly from chaos.' },
            { icon: <Shield size={24} color="#34d399"/>, title: 'Secure Scoping', desc: 'Multi-tenant organization isolation is mathematically enforced by Firebase.' }
          ].map((feat, i) => (
            <div key={i} style={{ padding: '32px', width: '320px', textAlign: 'left', background: '#121212', border: '1px solid #27272a', borderRadius: '12px', transition: 'border-color 0.3s', cursor: 'default' }} onMouseOver={e=>e.currentTarget.style.borderColor='#52525b'} onMouseOut={e=>e.currentTarget.style.borderColor='#27272a'}>
              <div style={{ background: '#18181b', border: '1px solid #27272a', display: 'inline-flex', padding: '10px', borderRadius: '10px', marginBottom: '20px' }}>
                {feat.icon}
              </div>
              <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', color: '#ffffff', fontWeight: 600 }}>{feat.title}</h3>
              <p style={{ color: '#a1a1aa', lineHeight: 1.6, fontSize: '0.95rem' }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}