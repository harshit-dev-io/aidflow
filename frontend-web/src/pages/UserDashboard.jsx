import { useWorkspace } from '../context/WorkspaceContext'; // <-- ADD THIS
import React, { useState, useEffect } from 'react';
import { getTasks, patchTask, createWorkspace } from '../services/api';
import { MapPin, Clock, CheckCircle, Briefcase, Plus, X, User, Activity, Loader2, UploadCloud, FileText } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

// --- PREMIUM SKELETON COMPONENT ---
const Skeleton = ({ width, height, borderRadius = '6px', style }) => (
  <div className="animate-pulse" style={{ background: '#27272a', width, height, borderRadius, ...style }} />
);

export default function UserDashboard() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals State
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Form State
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // --- NEW: Grab the active organization ID from context ---
  const { activeOrgId } = useWorkspace(); 
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Only load assignments if the user is logged in AND has an active org selected
      if (user && activeOrgId) {
        loadMyAssignments(activeOrgId);
      } else {
        setIsLoading(false);
        setTasks([]); // Clear tasks if no org is selected
      }
    });
    return () => unsubscribe();
  }, [activeOrgId]); // <-- NEW: Re-run this effect when the user switches NGOs

  // --- NEW: Pass the activeOrgId into the API call ---
  const loadMyAssignments = async (orgId) => {
    setIsLoading(true);
    try {
      const res = await getTasks(orgId); // <-- Pass the ID here!
      setTasks(res.data);
    } catch (e) {
      console.error("Error loading assignments", e);
    }
    setIsLoading(false);
  };

  const updateStatus = async (taskId, newStatus) => {
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      await patchTask(taskId, { status: newStatus });
    } catch (err) {
      alert("Failed to update status");
      if (activeOrgId) loadMyAssignments(activeOrgId); // Revert on failure
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setIsCreating(true);
    try {
      const res = await createWorkspace({ name: newOrgName });
      localStorage.setItem('activeOrgId', res.data.org_id);
      window.location.reload();
    } catch (err) {
      alert("Failed to create workspace.");
      setIsCreating(false);
    }
  };

  const handleSimulateUpload = (e) => {
    e.preventDefault();
    setIsUploading(true);
    // Simulate AI processing delay
    setTimeout(() => {
      setIsUploading(false);
      setShowUploadModal(false);
      alert("Field report uploaded! Gemini AI is analyzing the data and will generate tasks shortly.");
    }, 2500);
  };

  // --- PREMIUM LOADING SKELETON ---
  if (isLoading) return (
    <div style={{ padding: '20px 40px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', paddingBottom: '24px', borderBottom: '1px solid #27272a' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Skeleton width="64px" height="64px" borderRadius="12px" />
          <div><Skeleton width="200px" height="32px" style={{marginBottom:'8px'}}/><Skeleton width="150px" height="20px" /></div>
        </div>
        <Skeleton width="160px" height="40px" borderRadius="8px" />
      </div>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '40px' }}>
        <Skeleton width="100%" height="100px" borderRadius="12px" />
        <Skeleton width="100%" height="100px" borderRadius="12px" />
      </div>
    </div>
  );

  return (
    <div className="animate-slide-up" style={{ padding: '16px 5%', maxWidth: '1200px', margin: '0 auto', color: '#ededed', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Volunteer Identity Header - MOBILE RESPONSIVE FIX */}
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid #27272a', paddingBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '250px' }}>
          <div style={{ background: '#1e3a8a', padding: '16px', borderRadius: '12px', border: '1px solid #1e40af' }}>
            <User size={28} color="#60a5fa" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>My <span style={{ color: '#60a5fa' }}>Assignments</span></h1>
            <p style={{ color: '#a1a1aa', margin: '4px 0 0 0', fontSize: '0.95rem' }}>Your global volunteer deployment feed.</p>
          </div>
        </div>
        
        {/* Action Buttons Container - Flex Wrap prevents cut-off on mobile */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          <button onClick={() => setShowUploadModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#3b82f6', color: '#fff', border: '1px solid #2563eb', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', flexGrow: 1, justifyContent: 'center', maxWidth: '200px' }} onMouseOver={e=>e.currentTarget.style.background='#2563eb'} onMouseOut={e=>e.currentTarget.style.background='#3b82f6'}>
            <UploadCloud size={18} /> Upload Intel
          </button>
          
          <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#18181b', color: '#fff', border: '1px solid #3f3f46', padding: '10px 16px', borderRadius: '8px', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', flexGrow: 1, justifyContent: 'center', maxWidth: '200px' }} onMouseOver={e=>e.currentTarget.style.background='#27272a'} onMouseOut={e=>e.currentTarget.style.background='#18181b'}>
            <Plus size={18} /> Register NGO
          </button>
        </div>
      </header>

      {/* Simulated Personal Stats Row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '40px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px', padding: '20px', background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Tasks</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{tasks.filter(t => t.status !== 'completed').length}</div>
        </div>
        <div style={{ flex: '1 1 150px', padding: '20px', background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', borderLeft: '4px solid #10b981' }}>
          <div style={{ color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed Impact</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{tasks.filter(t => t.status === 'completed').length}</div>
        </div>
      </div>

      {/* Task Feed */}
      <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 600 }}><Activity size={20} color="#a1a1aa"/> Current Queue</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        {tasks.length > 0 ? (
          tasks.map(task => (
            <div key={task.id} style={{ background: '#18181b', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', border: '1px solid #27272a', borderLeft: `5px solid ${getUrgencyColor(task.urgency)}`, flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ flex: '1 1 250px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ background: '#27272a', color: '#e4e4e7', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    {task.status.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}><Clock size={14}/> {task.urgency} Priority</span>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 12px 0', color: '#fff', lineHeight: '1.4' }}>{task.summary}</h3>
                <div style={{ display: 'flex', gap: '16px', color: '#71717a', fontSize: '0.85rem', fontWeight: 500, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> {task.location}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={14} /> Org: {task.org_id?.substring(0, 6)}...</span>
                </div>
              </div>
              
              <div style={{ width: '100%', maxWidth: '200px' }}>
                {task.status !== 'completed' ? (
                  <select 
                    className="premium-input"
                    onChange={(e) => updateStatus(task.id, e.target.value)} 
                    defaultValue={task.status} 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #3f3f46', background: '#121212', color: '#fff', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="assigned" disabled>Assigned</option>
                    <option value="in_progress">Mark In Progress</option>
                    <option value="completed">Mark Completed</option>
                  </select>
                ) : (
                  <div style={{ width: '100%', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600, background: '#064e3b', border: '1px solid #065f46', padding: '10px 12px', borderRadius: '8px', boxSizing: 'border-box' }}>
                    <CheckCircle size={18} /> Resolved
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: '#121212', borderRadius: '12px', border: '1px dashed #3f3f46' }}>
            <Activity size={40} color="#3f3f46" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 8px 0', fontWeight: 600 }}>No Active Assignments</h3>
            <p style={{ color: '#71717a', margin: 0, fontSize: '0.9rem' }}>You are all caught up! Wait for your organization to deploy you.</p>
          </div>
        )}
      </div>

      {/* --- UPLOAD DATA MODAL --- */}
      {showUploadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#18181b', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '440px', border: '1px solid #27272a', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontWeight: 600, fontSize: '1.25rem' }}>Upload Field Data</h3>
              <X size={20} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => !isUploading && setShowUploadModal(false)} />
            </div>
            
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.5 }}>
              Upload unstructured field reports, audio logs, or images. Gemini AI will automatically parse the data and route it to your Org Dashboard.
            </p>

            <form onSubmit={handleSimulateUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ border: '2px dashed #3f3f46', borderRadius: '12px', padding: '32px', textAlign: 'center', background: '#121212', cursor: 'pointer' }}>
                <FileText size={32} color="#71717a" style={{ margin: '0 auto 12px' }} />
                <div style={{ color: '#fff', fontWeight: 500, fontSize: '0.95rem' }}>Click to browse files</div>
                <div style={{ color: '#71717a', fontSize: '0.8rem', marginTop: '4px' }}>PDF, JPG, PNG, or MP3 (Max 10MB)</div>
              </div>
              
              <button 
                type="submit" 
                disabled={isUploading}
                style={{ width: '100%', background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem', cursor: isUploading ? 'not-allowed' : 'pointer', transition: 'background 0.2s', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: isUploading ? 0.7 : 1 }}
              >
                {isUploading ? <Loader2 size={18} className="animate-pulse" /> : <UploadCloud size={18} />}
                {isUploading ? 'Gemini is Analyzing...' : 'Process with AI'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE WORKSPACE MODAL --- */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#18181b', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '440px', border: '1px solid #27272a', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontWeight: 600, fontSize: '1.25rem' }}>Register New NGO</h3>
              <X size={20} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => setShowModal(false)} />
            </div>
            <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#a1a1aa' }}>Organization Name</label>
                <input 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46', background: '#121212', color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }} 
                  placeholder="e.g. Global Relief Initiative" 
                  value={newOrgName} 
                  onChange={e => setNewOrgName(e.target.value)} 
                  required 
                />
              </div>
              <button type="submit" disabled={isCreating} style={{ width: '100%', background: '#ededed', color: '#0a0a0a', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem', cursor: isCreating ? 'not-allowed' : 'pointer' }}>
                {isCreating ? 'Provisioning...' : 'Create Workspace'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function getUrgencyColor(urgency) {
  const map = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#10b981' };
  return map[urgency] || '#3f3f46';
}