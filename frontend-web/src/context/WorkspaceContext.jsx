import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import axios from 'axios';

const WorkspaceContext = createContext();

export const useWorkspace = () => useContext(WorkspaceContext);

export const WorkspaceProvider = ({ children }) => {
  const [activeOrgId, setActiveOrgId] = useState(localStorage.getItem('activeOrgId') || '');
  const [activeRole, setActiveRole] = useState(localStorage.getItem('activeRole') || '');
  const [userOrganizations, setUserOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);

  const switchWorkspace = (orgId, role) => {
    setActiveOrgId(orgId);
    setActiveRole(role);
    localStorage.setItem('activeOrgId', orgId);
    localStorage.setItem('activeRole', role);
  };

  const fetchUserOrgs = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const res = await axios.get('http://localhost:8000/api/user/orgs/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const orgs = res.data;
      setUserOrganizations(orgs);
      
      // --- BULLETPROOF AUTO-SELECT LOGIC ---
      const storedOrgId = localStorage.getItem('activeOrgId');
      
      if (orgs.length > 0) {
        // Check if the stored org actually exists in their current list
        const isValidOrg = orgs.some(o => o.org_id === storedOrgId);
        
        if (!storedOrgId || !isValidOrg) {
          // If no valid org is selected, force select the first one
          switchWorkspace(orgs[0].org_id, orgs[0].role);
        } else {
          // Ensure role is synced for the valid stored org
          const currentOrg = orgs.find(o => o.org_id === storedOrgId);
          if (currentOrg) {
            setActiveRole(currentOrg.role);
            localStorage.setItem('activeRole', currentOrg.role);
          }
        }
      } else {
        // User has no organizations
        setActiveOrgId('');
        setActiveRole('');
        localStorage.removeItem('activeOrgId');
        localStorage.removeItem('activeRole');
      }
    } catch (err) {
      console.error("Failed to fetch user organizations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchUserOrgs();
      } else {
        setUserOrganizations([]);
        setActiveOrgId('');
        setActiveRole('');
        localStorage.removeItem('activeOrgId');
        localStorage.removeItem('activeRole');
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  return (
    <WorkspaceContext.Provider value={{ 
      activeOrgId, 
      activeRole,
      userOrganizations, 
      switchWorkspace, 
      refreshOrgs: fetchUserOrgs,
      loading 
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};