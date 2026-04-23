import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function Navbar({ user, userData }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <nav className="navbar" style={{ padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--primary-accent)', fontWeight: 'bold', fontSize: '1.2rem' }}>
        <Activity size={24} /> AidFlow
      </Link>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        {user ? (
          <>
            {userData?.role === 'admin' ? (
              <Link to="/org-dashboard" className="nav-link">Org Dashboard</Link>
            ) : (
              <Link to="/user-dashboard" className="nav-link">Volunteer Portal</Link>
            )}
            <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link" style={{ fontWeight: 500, color: 'var(--text-main)', textDecoration: 'none' }}>Login</Link>
            <Link to="/signup" className="btn-primary" style={{ textDecoration: 'none', padding: '8px 16px' }}>Get Started</Link>
          </>
        )}
      </div>
    </nav>
  );
}
