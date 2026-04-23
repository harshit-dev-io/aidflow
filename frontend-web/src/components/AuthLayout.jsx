import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useWorkspace } from '../context/WorkspaceContext';
import { Activity, LayoutDashboard, User, LogOut, ChevronDown, Menu, X } from 'lucide-react';

export default function AuthLayout({ userData }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeOrgId, userOrganizations, switchWorkspace } = useWorkspace();
  
  // --- RESPONSIVE STATE ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) setIsSidebarOpen(false); 
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleWorkspaceChange = (e) => {
    const orgId = e.target.value;
    const selectedOrg = userOrganizations.find(o => o.org_id === orgId);
    if (selectedOrg) switchWorkspace(orgId, selectedOrg.role);
  };

  // --- ROLE CHECK LOGIC ---
  const activeOrg = userOrganizations.find(o => o.org_id === activeOrgId);
  const activeOrgName = activeOrg ? `${activeOrg.name}` : 'Select Workspace';
  
  // Check if the user is an admin globally OR an admin in the currently selected workspace
  const isAdmin = userData?.role === 'admin' || activeOrg?.role === 'admin';

  // --- STYLES ---
  const sidebarStyle = {
    width: '260px', background: '#121212', borderRight: '1px solid #27272a', padding: '24px', 
    display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    position: isMobile ? 'fixed' : 'sticky',
    top: 0, left: 0, height: '100vh', zIndex: 100,
    transform: isMobile && !isSidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  };

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
    zIndex: 90, display: isMobile && isSidebarOpen ? 'block' : 'none',
    transition: 'opacity 0.3s ease'
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a', color: '#ededed', margin: 0, padding: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      <div style={overlayStyle} onClick={() => setIsSidebarOpen(false)} />

      <aside style={sidebarStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', fontWeight: '700', fontSize: '1.25rem', textDecoration: 'none', letterSpacing: '-0.02em' }}>
            <div style={{ background: '#3b82f6', padding: '6px', borderRadius: '8px' }}><Activity size={20} color="white" /></div>
            AidFlow
          </Link>
          {isMobile && <X size={24} color="#a1a1aa" onClick={() => setIsSidebarOpen(false)} style={{cursor: 'pointer'}} />}
        </div>

        {/* Workspace Switcher */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Active NGO</label>
          <div style={{ position: 'relative' }}>
            <select value={activeOrgId} onChange={handleWorkspaceChange} className="premium-input" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #27272a', background: '#18181b', color: '#fff', fontWeight: 500, fontSize: '0.9rem', appearance: 'none', outline: 'none' }}>
              <option value="" disabled>Switch NGO...</option>
              {userOrganizations.map(org => <option key={org.org_id} value={org.org_id}>{org.name}</option>)}
            </select>
            <ChevronDown size={16} color="#71717a" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Navigation Menu - CONDITIONALLY RENDERED */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          
          {/* Only show Data Center if user is an Admin */}
          {isAdmin && (
            <Link to="/org-dashboard" onClick={() => setIsMobile && setIsSidebarOpen(false)} style={navItemStyle(location.pathname === '/org-dashboard')}>
              <LayoutDashboard size={18} /> Admin Dashboard
            </Link>
          )}

          {/* Everyone sees their own assignments */}
          <Link to="/user-dashboard" onClick={() => setIsMobile && setIsSidebarOpen(false)} style={navItemStyle(location.pathname === '/user-dashboard')}>
            <User size={18} /> Dashboard
          </Link>
        </nav>
        
        <button onClick={handleLogout} style={{ ...navItemStyle(false), color: '#ef4444', marginTop: 'auto', width: '100%' }}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      <main style={{ flex: 1, padding: isMobile ? '16px' : '32px 48px', boxSizing: 'border-box', overflowX: 'hidden', display: 'flex', flexDirection: 'column', background: '#0a0a0a', width: '100%' }}>
        
        <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121212', padding: '16px', borderRadius: '12px', border: '1px solid #27272a', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {isMobile && <Menu size={24} color="#ededed" onClick={() => setIsSidebarOpen(true)} style={{cursor: 'pointer'}} />}
            <div>
              <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase' }}>Active Organization</span>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>{activeOrgName}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!isMobile && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>{userData?.name || 'User'}</div>
                <div style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>{userData?.email}</div>
              </div>
            )}
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#1e3a8a', border: '1px solid #1e40af', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
              {userData?.name?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        <div style={{ flex: 1 }}>
          <Outlet />
        </div>

      </main>
    </div>
  );
}

function navItemStyle(isActive) {
  return {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '6px',
    background: isActive ? '#27272a' : 'transparent', color: isActive ? '#ffffff' : '#a1a1aa',
    cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem', textDecoration: 'none', transition: 'all 0.2s',
    border: 'none', textAlign: 'left'
  };
}