import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Activity, Loader2, ArrowRight } from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Create the Auth record in Firebase Authentication
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // 2. Initialize the Base User Profile in Firestore
      await setDoc(doc(db, "users", uid), {
        name: name,
        email: email,
        affiliated_orgs: [], 
        createdAt: serverTimestamp()
      });

      // 3. Send them to the unified dashboard
      navigate('/dashboard'); 
      
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError("An account with this email already exists. Please log in.");
      } else {
        setError(err.message);
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="animate-slide-up" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#ededed', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Premium Minimal Header */}
      <div style={{ padding: '32px 48px', position: 'absolute', top: 0, left: 0, width: '100%', boxSizing: 'border-box' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#ffffff', fontWeight: '700', fontSize: '1.25rem', textDecoration: 'none', letterSpacing: '-0.02em', transition: 'opacity 0.2s' }} onMouseOver={e=>e.currentTarget.style.opacity='0.8'} onMouseOut={e=>e.currentTarget.style.opacity='1'}>
          <div style={{ background: '#3b82f6', padding: '6px', borderRadius: '8px' }}>
            <Activity size={20} color="white" />
          </div>
          AidFlow
        </Link>
      </div>

      {/* Centered Form Layout */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 24px 40px' }}>
        <div style={{ background: '#121212', padding: '48px', width: '100%', maxWidth: '420px', borderRadius: '16px', border: '1px solid #27272a', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', margin: '0 0 8px 0', color: '#ffffff', fontWeight: 700, letterSpacing: '-0.02em' }}>Create an account</h2>
            <p style={{ color: '#a1a1aa', margin: 0, fontSize: '0.95rem' }}>Join AidFlow to start making an impact.</p>
          </div>

          {error && (
            <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', color: '#fca5a5', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '4px', height: '100%', background: '#ef4444', borderRadius: '2px' }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#a1a1aa' }}>Full Name</label>
              <input 
                type="text" 
                className="premium-input" 
                style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #27272a', background: '#18181b', color: '#ffffff', fontSize: '0.95rem', transition: 'all 0.2s' }} 
                placeholder="Jane Doe"
                required 
                onChange={e => setName(e.target.value)} 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#a1a1aa' }}>Email Address</label>
              <input 
                type="email" 
                className="premium-input" 
                style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #27272a', background: '#18181b', color: '#ffffff', fontSize: '0.95rem', transition: 'all 0.2s' }} 
                placeholder="name@organization.org"
                required 
                onChange={e => setEmail(e.target.value)} 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#a1a1aa' }}>Password</label>
              <input 
                type="password" 
                className="premium-input" 
                style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #27272a', background: '#18181b', color: '#ffffff', fontSize: '0.95rem', transition: 'all 0.2s' }} 
                placeholder="••••••••"
                required 
                minLength="6"
                onChange={e => setPassword(e.target.value)} 
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '14px', fontSize: '1rem', marginTop: '12px', border: 'none', borderRadius: '8px', background: '#ededed', color: '#0a0a0a', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: isLoading ? 0.7 : 1 }}
              onMouseOver={e=> { if(!isLoading) e.currentTarget.style.background='#ffffff' }} 
              onMouseOut={e=> { if(!isLoading) e.currentTarget.style.background='#ededed' }}
            >
              {isLoading ? <Loader2 size={18} className="animate-pulse" /> : 'Create Account'}
              {!isLoading && <ArrowRight size={18} />}
            </button>
          </form>

          <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.9rem', color: '#71717a' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#ffffff', fontWeight: 500, textDecoration: 'none', borderBottom: '1px solid #3f3f46', paddingBottom: '2px', transition: 'border-color 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='#ffffff'} onMouseOut={e=>e.currentTarget.style.borderColor='#3f3f46'}>
              Log in here
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}