import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  getTasks, ingestData, getOrgMembers, matchVolunteers, 
  assignTask, addMember, editMemberRole, patchTask, 
  createTask, deleteTask, getIntelligenceFeed 
} from '../services/api';
import { storage, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  UploadCloud, LayoutDashboard, Users, FileText, 
  MapPin, Zap, AlertCircle, CheckCircle, UserPlus, 
  Edit2, X, Plus, Trash2, UserCheck, 
  Activity, Layers, AlertTriangle, Search, ExternalLink, ChevronDown, Image as ImageIcon, Download, Loader2 
} from 'lucide-react';

// --- PREMIUM SKELETON COMPONENT ---
const Skeleton = ({ width, height, borderRadius = '6px', style }) => (
  <div className="animate-pulse" style={{ background: '#27272a', width, height, borderRadius, ...style }} />
);

export default function OrgDashboard() {
  const { activeOrgId } = useWorkspace();
  
  // 1. Core Navigation & Data
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('mission-control');
  const [dataHubView, setDataHubView] = useState('intelligence');
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [feedData, setFeedData] = useState({ unique_reports: [], duplicates: [] });
  const [isLoading, setIsLoading] = useState(true);

  // 2. Task Management & Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null); 
  const [taskForm, setTaskForm] = useState({ summary: '', urgency: 'medium', location: '', issue_type: 'general' });

  // 3. Assignment Logic
  const [selectedTask, setSelectedTask] = useState(null);
  const [matches, setMatches] = useState(null); 
  const [showManualAssign, setShowManualAssign] = useState(null); 

  // 4. File & Member State
  const [isUploading, setIsUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('volunteer');
  const [isProcessingMember, setIsProcessingMember] = useState(false);
  const [editMember, setEditMember] = useState(null); 
  const [editRole, setEditRole] = useState('');

  // --- Logic for AI Match Button ---
  const handleAiMatch = async (task) => {
    setSelectedTask(task);
    try {
      const res = await matchVolunteers(task.id);
      setMatches(res.data); 
    } catch (err) {
      alert("AI Matching failed. Check backend logs.");
    }
  };

  // --- Logic for Manual Assignment Button ---
  const handleManualAssignAction = async (taskId, volunteerUid) => {
    try {
      await assignTask(taskId, volunteerUid);
      setShowManualAssign(null); 
      loadDashboardData(); 
      alert("Task successfully assigned!");
    } catch (err) {
      alert("Assignment failed.");
    }
  };

  // 1. Auth Listener & Data Loading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && activeOrgId) {
        loadDashboardData();
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [activeOrgId, activeTab, dataHubView]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'mission-control' || activeTab === 'task-management') {
        const res = await getTasks();
        setTasks(res.data);
      } else if (activeTab === 'members') {
        const res = await getOrgMembers();
        setMembers(res.data);
      } else if (activeTab === 'data-hub') {
        const res = await getIntelligenceFeed();
        setFeedData(res.data);
      }
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    }
    setIsLoading(false);
  };

  // --- Task Handlers ---
  const handleSaveTask = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await patchTask(editingTask.id, taskForm);
      } else {
        await createTask(taskForm);
      }
      setShowTaskModal(false);
      setEditingTask(null);
      setTaskForm({ summary: '', urgency: 'medium', location: '', issue_type: 'general' });
      loadDashboardData();
    } catch (err) { alert("Task action failed"); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteTask(taskId);
      loadDashboardData();
    } catch (err) { alert("Delete failed"); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `uploads/${activeOrgId}/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      
      const fileUrl = await getDownloadURL(storageRef);
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const res = await ingestData({ 
            file: reader.result.split(',')[1], 
            mime_type: file.type,
            file_url: fileUrl,
            file_size: file.size,
            file_name: file.name
          });
          
          if (res.data?.is_duplicate) {
            alert("Data ingested! Flagged as a DUPLICATE of an existing report.");
          } else {
            alert("Data ingested and categorized successfully.");
          }
          
          setActiveTab('data-hub'); 
          loadDashboardData(); 
        } catch (apiErr) {
          alert(apiErr.response?.data?.error || "Analysis failed.");
        }
      };
    } catch (err) { alert("Upload failed."); } 
    finally { setIsUploading(false); }
  };

  // --- Matching Handlers ---
  const handleAssign = async (volunteerUid) => {
    try {
      await assignTask(selectedTask.id, volunteerUid);
      setMatches(null);
      loadDashboardData();
    } catch (err) { alert("Assignment failed"); }
  };

  // --- Member Handlers ---
  const handleAddMember = async (e) => {
    e.preventDefault();
    setIsProcessingMember(true);
    try {
      await addMember({ email: newMemberEmail, role: newMemberRole });
      setShowAddModal(false);
      setNewMemberEmail('');
      loadDashboardData();
    } catch (err) { alert(err.response?.data?.error || "Failed to add member."); }
    setIsProcessingMember(false);
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      await patchTask(taskId, { status: newStatus });
      loadDashboardData(); 
    } catch (err) {
      alert("Failed to move task");
      loadDashboardData(); 
    }
  };

  // --- Drag and Drop Logic ---
  const onDragStart = (e, taskId) => { e.dataTransfer.setData("taskId", taskId); };
  const onDragOver = (e) => { e.preventDefault(); };
  const onDrop = (e, newStatus) => {
    const taskId = e.dataTransfer.getData("taskId");
    handleUpdateStatus(taskId, newStatus); 
  };

  const submitEditRole = async (e) => {
    e.preventDefault();
    setIsProcessingMember(true);
    try {
      await editMemberRole({ uid: editMember.uid, role: editRole });
      setEditMember(null);
      loadDashboardData();
    } catch (err) { alert(err.response?.data?.error || "Update blocked."); }
    setIsProcessingMember(false);
  };

  // --- PREMIUM LOADING SKELETON ---
  if (isLoading) return (
    <div style={{ padding: '40px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div style={{ display: 'flex', gap: '16px' }}><Skeleton width="120px" height="36px" /><Skeleton width="120px" height="36px" /></div>
        <Skeleton width="150px" height="36px" />
      </div>
      <div style={{ display: 'flex', gap: '24px' }}>
        <Skeleton width="300px" height="400px" borderRadius="12px" />
        <Skeleton width="300px" height="400px" borderRadius="12px" />
        <Skeleton width="300px" height="400px" borderRadius="12px" />
      </div>
    </div>
  );

  const criticalTasks = tasks.filter(t => t.urgency === 'critical').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const groupedReports = (feedData.unique_reports || []).reduce((acc, report) => {
    const cat = report.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(report);
    return acc;
  }, {});

  return (
    <div className="animate-slide-up" style={{ width: '100%', boxSizing: 'border-box', color: '#ededed', fontFamily: 'Inter, sans-serif' }}>
      
      {/* HEADER ACTION BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #27272a', marginBottom: '32px', paddingBottom: '16px', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#18181b', padding: '4px', borderRadius: '8px', border: '1px solid #27272a' }}>
          {[
            { id: 'mission-control', icon: <LayoutDashboard size={16}/>, label: 'Overview' },
            { id: 'task-management', icon: <CheckCircle size={16}/>, label: 'Pipeline' },
            { id: 'data-hub', icon: <Activity size={16}/>, label: 'Data Hub' },
            { id: 'members', icon: <Users size={16}/>, label: 'Team' }
          ].map(tab => (
            <button 
              key={tab.id} onClick={() => setActiveTab(tab.id)} 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', border: 'none', background: activeTab === tab.id ? '#27272a' : 'transparent', color: activeTab === tab.id ? '#fff' : '#a1a1aa', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem', transition: 'all 0.2s' }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => { setEditingTask(null); setTaskForm({ summary: '', urgency: 'medium', location: '', issue_type: 'general' }); setShowTaskModal(true); }} style={premiumBtnStyle('secondary')}>
            <Plus size={18} /> Create Task
          </button>
          <input type="file" id="globalFileIn" hidden onChange={handleFileUpload} />
          <button onClick={() => document.getElementById('globalFileIn').click()} disabled={isUploading} style={premiumBtnStyle('primary')}>
            {isUploading ? <Loader2 size={18} className="animate-pulse" /> : <UploadCloud size={18} />} 
            {isUploading ? 'Processing...' : 'Ingest Data'}
          </button>
        </div>
      </div>

      {/* 1. MISSION CONTROL TAB */}
      {activeTab === 'mission-control' && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            <KpiCard icon={<AlertCircle color="#ef4444" size={28}/>} value={criticalTasks} label="Critical Action Needed" bg="#450a0a" border="#7f1d1d" />
            <KpiCard icon={<LayoutDashboard color="#60a5fa" size={28}/>} value={tasks.length} label="Total Tasks" bg="#1e3a8a" border="#1e40af" />
            <KpiCard icon={<CheckCircle color="#34d399" size={28}/>} value={completedTasks} label="Tasks Resolved" bg="#064e3b" border="#065f46" />
          </div>

          <h2 style={{ fontSize: '1.2rem', margin: '0 0 20px 0', color: '#fff', fontWeight: 600, letterSpacing: '-0.02em' }}>Active Deployment Queue</h2>
          <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '20px', width: '100%' }}>
            {['pending', 'assigned', 'in_progress', 'completed'].map(status => (
              <div key={status} style={{ minWidth: '320px', background: '#121212', borderRadius: '12px', padding: '16px', border: '1px solid #27272a', flexShrink: 0 }}>
                <h4 style={{ textTransform: 'capitalize', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  {status.replace('_', ' ')}
                  <span style={{ background: '#27272a', color: '#e4e4e7', padding: '2px 8px', borderRadius: '10px' }}>{tasks.filter(t => t.status === status).length}</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {tasks.filter(t => t.status === status).map(task => (
                    <div key={task.id} style={{ background: '#18181b', padding: '16px', borderRadius: '8px', borderLeft: `4px solid ${getUrgencyColor(task.urgency)}`, borderTop: '1px solid #27272a', borderRight: '1px solid #27272a', borderBottom: '1px solid #27272a' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <span style={{ background: '#27272a', color: '#a1a1aa', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{task.issue_type}</span>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <Edit2 size={14} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => { setEditingTask(task); setTaskForm(task); setShowTaskModal(true); }} />
                          <Trash2 size={14} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => handleDeleteTask(task.id)} />
                        </div>
                      </div>
                      <h5 style={{ fontWeight: 500, margin: '0 0 8px 0', fontSize: '0.95rem', color: '#fff' }}>{task.summary}</h5>
                      <div style={{ fontSize: '0.8rem', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {task.location}</div>
                      {status !== 'completed' && (
                        <button onClick={() => handleAiMatch(task)} style={{ width: '100%', marginTop: '12px', padding: '8px', fontSize: '0.8rem', background: '#1e3a8a', color: '#60a5fa', border: '1px solid #1e40af', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <Zap size={14} /> Smart Match Volunteers
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. TASK MANAGEMENT (KANBAN) TAB */}
      {activeTab === 'task-management' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', fontWeight: 600, letterSpacing: '-0.02em' }}>Task Pipeline</h2>
              <p style={{ color: '#a1a1aa', margin: '4px 0 0 0', fontSize: '0.95rem' }}>Drag and drop cards to update status. Manage assignments and lifecycle.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '30px' }}>
            {['pending', 'assigned', 'in_progress', 'completed'].map(status => (
              <div 
                key={status} 
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, status)}
                style={{ minWidth: '320px', background: '#121212', borderRadius: '16px', padding: '16px', border: '2px dashed transparent', transition: 'all 0.2s' }}
                onDragEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onDragLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '0 8px' }}>
                  <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 800, color: '#a1a1aa', letterSpacing: '1px' }}>{status.replace('_', ' ')}</h4>
                  <span style={{ background: '#27272a', color: '#e4e4e7', padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>{tasks.filter(t => t.status === status).length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '500px' }}>
                  {tasks.filter(t => t.status === status).map(task => (
                    <div 
                      key={task.id} 
                      draggable 
                      onDragStart={(e) => onDragStart(e, task.id)}
                      style={{ background: '#18181b', padding: '16px', borderRadius: '12px', cursor: 'grab', border: '1px solid #27272a', borderLeft: `5px solid ${getUrgencyColor(task.urgency)}`, transition: 'transform 0.1s, border-color 0.2s' }}
                      onMouseOver={e=>e.currentTarget.style.borderColor='#3f3f46'}
                      onMouseOut={e=>e.currentTarget.style.borderColor='#27272a'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ background: '#27272a', color: '#a1a1aa', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>{task.issue_type}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Edit2 size={14} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => { setEditingTask(task); setTaskForm(task); setShowTaskModal(true); }} />
                          <Trash2 size={14} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => handleDeleteTask(task.id)} />
                        </div>
                      </div>
                      <h5 style={{ fontWeight: 500, margin: '0 0 8px 0', fontSize: '0.95rem', color: '#fff' }}>{task.summary}</h5>
                      <div style={{ fontSize: '0.8rem', color: '#71717a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}><MapPin size={14} /> {task.location}</div>
                      
                      <div style={{ borderTop: '1px solid #27272a', paddingTop: '12px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleAiMatch(task)} style={actionBtnStyle()}>
                          <Zap size={12} color="#60a5fa" /> AI Match
                        </button>
                        <button onClick={() => setShowManualAssign(task)} style={actionBtnStyle()}>
                          <UserCheck size={12} /> Manual
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. AI DATA HUB TAB */}
      {activeTab === 'data-hub' && (
        <div style={{ width: '100%' }}>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #27272a', paddingBottom: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button onClick={() => setDataHubView('intelligence')} style={subTabStyle(dataHubView === 'intelligence')}><Activity size={18}/> Verified Intelligence</button>
              <button onClick={() => setDataHubView('duplicates')} style={subTabStyle(dataHubView === 'duplicates')}><Layers size={18}/> Flagged Duplicates</button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '6px 12px', minWidth: '250px' }}>
              <Search size={16} color="#71717a" style={{ marginRight: '8px' }} />
              <input 
                type="text" 
                placeholder="Search keywords or location..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="premium-input"
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem', background: 'transparent', color: '#fff' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {['intelligence', 'duplicates'].includes(dataHubView) && (
              Object.entries(
                (dataHubView === 'intelligence' ? feedData.unique_reports : feedData.duplicates || [])
                .filter(report => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  const inKeywords = report.keywords?.some(k => k.toLowerCase().includes(query));
                  const inLocation = report.location?.toLowerCase().includes(query);
                  const inSummary = report.summary?.toLowerCase().includes(query);
                  return inKeywords || inLocation || inSummary;
                })
                .reduce((acc, report) => {
                  const cat = report.category || 'general';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(report);
                  return acc;
                }, {})
              ).map(([category, reports]) => (
                <div key={category} style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', overflow: 'hidden', alignSelf: 'start' }}>
                  <div style={{ background: '#121212', padding: '16px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, textTransform: 'capitalize', fontSize: '1.1rem', color: '#fff', fontWeight: 600 }}>{category}</h3>
                    <span style={{ background: '#27272a', color: '#e4e4e7', padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>{reports.length}</span>
                  </div>
                  
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {reports.map(report => (
                      <div key={report.id} style={{ borderLeft: `4px solid ${getUrgencyColor(report.urgency)}`, paddingLeft: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: '#a1a1aa', fontWeight: 600 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12}/> {report.location}</span>
                          <span style={{ color: getUrgencyColor(report.urgency), textTransform: 'uppercase' }}>{report.urgency}</span>
                        </div>

                        {report.keywords && report.keywords.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                            {report.keywords.map(kw => (
                              <span key={kw} onClick={() => setSearchQuery(kw)} style={{ background: '#27272a', color: '#a1a1aa', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e=>e.currentTarget.style.color='#fff'} onMouseOut={e=>e.currentTarget.style.color='#a1a1aa'}>#{kw}</span>
                            ))}
                          </div>
                        )}

                        <details style={{ cursor: 'pointer', outline: 'none' }}>
                          <summary style={{ fontSize: '0.85rem', fontWeight: 600, color: '#60a5fa', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            View Summary <ChevronDown size={14}/>
                          </summary>
                          <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#e4e4e7', lineHeight: '1.5' }}>
                            {report.summary}
                          </p>
                        </details>

                        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#a1a1aa', fontWeight: 500 }}>
                            {report.mime_type?.includes('image') ? <ImageIcon size={16} color="#a78bfa" /> : <FileText size={16} color="#60a5fa" />}
                            <span style={{ maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={report.file_name}>
                              {report.file_name || 'Document'}
                            </span>
                          </div>

                          {report.file_url && (
                            <a 
                              href={report.file_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#34d399', background: '#064e3b', padding: '6px 12px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, transition: 'background 0.2s' }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#065f46'}
                              onMouseOut={(e) => e.currentTarget.style.background = '#064e3b'}
                            >
                              <Download size={14} /> Open
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            
            {feedData.unique_reports.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#71717a', background: '#18181b', borderRadius: '12px', border: '1px dashed #3f3f46' }}>
                <UploadCloud size={48} color="#3f3f46" style={{ margin: '0 auto 16px' }} />
                No reports match your current search.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MEMBERS TAB */}
      {activeTab === 'members' && (
        <div style={{ background: '#18181b', borderRadius: '12px', border: '1px solid #27272a', overflow: 'hidden' }}>
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #27272a' }}>
            <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 600 }}>NGO Roster</h4>
            <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#27272a', color: '#fff', border: '1px solid #3f3f46', padding: '8px 16px', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#3f3f46'} onMouseOut={e=>e.currentTarget.style.background='#27272a'}>
              <UserPlus size={16} /> Direct Add Member
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#121212' }}>
              <tr>
                <th style={{ padding: '16px 24px', color: '#a1a1aa', fontSize: '0.85rem', fontWeight: 500 }}>Name</th>
                <th style={{ padding: '16px 24px', color: '#a1a1aa', fontSize: '0.85rem', fontWeight: 500 }}>Role</th>
                <th style={{ padding: '16px 24px', color: '#a1a1aa', fontSize: '0.85rem', fontWeight: 500 }}>Location</th>
                <th style={{ padding: '16px 24px', color: '#a1a1aa', fontSize: '0.85rem', fontWeight: 500 }}>Skills</th>
                <th style={{ padding: '16px 24px', color: '#a1a1aa', fontSize: '0.85rem', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.uid} style={{ borderBottom: '1px solid #27272a' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 500, color: '#e4e4e7' }}>{m.name}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ background: m.role === 'admin' ? '#450a0a' : '#1e3a8a', color: m.role === 'admin' ? '#fca5a5' : '#93c5fd', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{m.role}</span>
                  </td>
                  <td style={{ padding: '16px 24px', color: '#a1a1aa' }}>{m.location || 'N/A'}</td>
                  <td style={{ padding: '16px 24px' }}>{m.skills?.map(s => <span key={s} style={{ background: '#27272a', color: '#a1a1aa', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', marginRight: '4px' }}>{s}</span>)}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <button onClick={() => { setEditMember(m); setEditRole(m.role); }} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, fontSize: '0.85rem', transition: 'color 0.2s' }} onMouseOver={e=>e.currentTarget.style.color='#fff'} onMouseOut={e=>e.currentTarget.style.color='#71717a'}>
                      <Edit2 size={14} /> Edit Role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- MODALS SECTION --- */}
      
      {/* Task Modal */}
      {showTaskModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontWeight: 600 }}>{editingTask ? 'Edit Task' : 'Manual Task Entry'}</h3>
              <X size={20} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => setShowTaskModal(false)} />
            </div>
            <form onSubmit={handleSaveTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input className="premium-input" style={inputStyle} placeholder="Summary" value={taskForm.summary} onChange={e => setTaskForm({...taskForm, summary: e.target.value})} required />
              <input className="premium-input" style={inputStyle} placeholder="Location" value={taskForm.location} onChange={e => setTaskForm({...taskForm, location: e.target.value})} required />
              <select className="premium-input" style={inputStyle} value={taskForm.urgency} onChange={e => setTaskForm({...taskForm, urgency: e.target.value})}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
              <button type="submit" style={primaryButtonStyle}>Save Task</button>
            </form>
          </div>
        </div>
      )}

      {/* Smart Match Modal */}
      {matches && (
        <div style={modalOverlayStyle} onClick={() => setMatches(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontWeight: 600 }}>Smart Match Results</h3>
              <X size={20} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => setMatches(null)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
              {matches.map((match, idx) => (
                <div key={match.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '12px', border: idx === 0 ? '1px solid #065f46' : '1px solid #27272a', background: idx === 0 ? '#064e3b' : '#121212' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{match.name} <span style={{ background: '#34d399', color: '#064e3b', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '12px', marginLeft: '8px', fontWeight: 700 }}>{match.score} pts</span></div>
                    <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginTop: '4px' }}>{match.skills?.join(', ')}</div>
                  </div>
                  <button onClick={() => handleAssign(match.uid)} style={{ background: '#fff', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseOver={e=>e.currentTarget.style.opacity='0.8'} onMouseOut={e=>e.currentTarget.style.opacity='1'}>Deploy</button>
                </div>
              ))}
            </div>
            <button style={{ width: '100%', marginTop: '20px', padding: '10px', background: 'transparent', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#27272a'} onMouseOut={e=>e.currentTarget.style.background='transparent'} onClick={() => setMatches(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'24px'}}><h3 style={{margin:0, color:'#fff', fontWeight:600}}>Add Member</h3><X size={20} onClick={()=>setShowAddModal(false)} style={{cursor:'pointer', color:'#a1a1aa'}}/></div>
            <form onSubmit={handleAddMember} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
              <input className="premium-input" style={inputStyle} type="email" placeholder="Email" value={newMemberEmail} onChange={e=>setNewMemberEmail(e.target.value)} required/>
              <select className="premium-input" style={inputStyle} value={newMemberRole} onChange={e=>setNewMemberRole(e.target.value)}><option value="volunteer">Volunteer</option><option value="admin">Admin</option></select>
              <button style={primaryButtonStyle} type="submit">{isProcessingMember ? 'Adding...' : 'Add Member'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editMember && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'24px'}}><h3 style={{margin:0, color:'#fff', fontWeight:600}}>Edit {editMember.name}</h3><X size={20} onClick={()=>setEditMember(null)} style={{cursor:'pointer', color:'#a1a1aa'}}/></div>
            <form onSubmit={submitEditRole} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
              <select className="premium-input" style={inputStyle} value={editRole} onChange={e=>setEditRole(e.target.value)}><option value="volunteer">Volunteer</option><option value="admin">Admin</option></select>
              <button style={primaryButtonStyle} type="submit">{isProcessingMember ? 'Saving...' : 'Save Changes'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Manual Assignment Modal */}
      {showManualAssign && (
        <div style={modalOverlayStyle} onClick={() => setShowManualAssign(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontWeight: 600 }}>Select Volunteer</h3>
              <X size={20} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => setShowManualAssign(null)} />
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {members.map(m => (
                <div 
                  key={m.uid} 
                  onClick={() => handleManualAssignAction(showManualAssign.id, m.uid)}
                  style={{ padding: '12px', border: '1px solid #27272a', background: '#121212', borderRadius: '8px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseOver={e=>e.currentTarget.style.borderColor='#3f3f46'}
                  onMouseOut={e=>e.currentTarget.style.borderColor='#27272a'}
                >
                  <div style={{ fontWeight: 600, color: '#e4e4e7' }}>{m.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '4px' }}>{m.role} • {m.email}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- PREMIUM STYLES & HELPERS ---
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContentStyle = { background: '#18181b', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '480px', border: '1px solid #27272a', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #27272a', background: '#121212', color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box', transition: 'border-color 0.2s' };
const primaryButtonStyle = { width: '100%', background: '#ededed', color: '#0a0a0a', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', transition: 'background 0.2s' };

const KpiCard = ({ icon, value, label, bg, border }) => (
  <div style={{ background: '#18181b', padding: '24px', borderRadius: '12px', border: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: '16px' }}>
    <div style={{ background: bg, border: `1px solid ${border}`, padding: '16px', borderRadius: '12px' }}>{icon}</div>
    <div><div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{value}</div><div style={{ color: '#a1a1aa', fontSize: '0.9rem', fontWeight: 500, marginTop: '8px' }}>{label}</div></div>
  </div>
);

function premiumBtnStyle(type) {
  return {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
    background: type === 'primary' ? '#ededed' : '#18181b',
    color: type === 'primary' ? '#0a0a0a' : '#ededed',
    border: type === 'primary' ? 'none' : '1px solid #3f3f46',
  };
}

function subTabStyle(isActive) {
  return {
    background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: isActive ? 600 : 500,
    color: isActive ? '#fff' : '#71717a', padding: '0 4px', transition: 'color 0.2s',
    borderBottom: isActive ? '2px solid #fff' : '2px solid transparent', marginBottom: '-9px'
  };
}

function actionBtnStyle() {
  return {
    flex: 1, padding: '8px 0', fontSize: '0.75rem', background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 0.2s'
  };
}

function getUrgencyColor(urgency) {
  const map = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#10b981' };
  return map[urgency] || '#3f3f46';
}