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

  const fetchUserOrgs = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const res = await axios.get('https://aidflow-api-477640439294.us-central1.run.app/api/user/orgs/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUserOrganizations(res.data);
      
      // Sync role if org is already active
      if (activeOrgId) {
        const currentOrg = res.data.find(o => o.org_id === activeOrgId);
        if (currentOrg) {
          setActiveRole(currentOrg.role);
          localStorage.setItem('activeRole', currentOrg.role);
        }
      }

      // Default to first org if none active
      if (!activeOrgId && res.data.length > 0) {
        switchWorkspace(res.data[0].org_id, res.data[0].role);
      }
    } catch (err) {
      console.error("Failed to fetch user organizations", err);
    } finally {
      setLoading(false);
    }
  };

  const switchWorkspace = (orgId, role) => {
    setActiveOrgId(orgId);
    setActiveRole(role);
    localStorage.setItem('activeOrgId', orgId);
    localStorage.setItem('activeRole', role);
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
