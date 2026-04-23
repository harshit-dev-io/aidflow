import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { WorkspaceProvider } from './context/WorkspaceContext';

// Public Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Protected Pages
import OrgDashboard from './pages/OrgDashboard';
import UserDashboard from './pages/UserDashboard';

// Layouts
import AuthLayout from './components/AuthLayout';

import { useWorkspace } from './context/WorkspaceContext';

// Protected Route Guard
const ProtectedRoute = ({ children, allowedRole = [], userData }) => {
  const { activeRole, userOrganizations, loading } = useWorkspace();
  const { authUser } = auth; // Use firebase auth directly for base check

  if (loading) return null; // Wait for context
  if (!auth.currentUser) return <Navigate to="/login" />;
  if (!userData) return <div style={{padding: '50px', textAlign: 'center'}}>Syncing profile data...</div>;

  // Admin routing check
  if (allowedRole.includes('admin') && activeRole !== 'admin') {
      return <Navigate to="/user-dashboard" />;
  }

  return children;
};

// Public Route Guard (Redirect if logged in)
const PublicAuthRoute = ({ children, userData }) => {
  const { userOrganizations, loading } = useWorkspace();
  
  if (loading) return null;
  if (auth.currentUser && userData) {
    const hasAnyAdminRole = userOrganizations.some(o => o.role === 'admin');
    return <Navigate to={hasAnyAdminRole ? '/org-dashboard' : '/user-dashboard'} />;
  }
  return children;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setUser(currentUser);
          setUserData(userDoc.data());
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
        <div style={{fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 500}}>Establishing Secure Workspace...</div>
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          
          <Route path="/login" element={<PublicAuthRoute userData={userData}><Login /></PublicAuthRoute>} />
          <Route path="/signup" element={<PublicAuthRoute userData={userData}><Signup /></PublicAuthRoute>} />

          <Route element={<AuthLayout userData={userData} />}>
            <Route path="/org-dashboard" element={
              <ProtectedRoute allowedRole={['admin']} userData={userData}><OrgDashboard userData={userData} /></ProtectedRoute>
            } />
            
            <Route path="/user-dashboard" element={
              <ProtectedRoute userData={userData}><UserDashboard userData={userData} /></ProtectedRoute>
            } />
          </Route>
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </WorkspaceProvider>
  );
}
