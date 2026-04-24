import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach Firebase ID Token AND Active Org ID to every request
api.interceptors.request.use(async (config) => {
  // 1. Wait for Firebase to wake up
  await auth.authStateReady(); 

  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Scoped Workspace Header
  const activeOrgId = localStorage.getItem('activeOrgId');
  if (activeOrgId) {
    config.headers['X-Active-Org-Id'] = activeOrgId;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// ==========================================
// Auth & Org Gateway
// ==========================================
export const getUserOrgs = () => api.get('/user/orgs/');
export const createWorkspace = (data) => api.post('/org/create/', data);
export const inviteMember = (data) => api.post('/org/invite/', data);

// THE MISSING DASHBOARD FUNCTIONS:
export const getOrgMembers = () => api.get('/org/members/');
export const getOrgData = () => api.get('/org/data/');
export const addMember = (data) => api.post('/org/members/add/', data);
export const editMemberRole = (data) => api.put('/org/members/edit/', data);
// ==========================================
// Data & Tasks (Scoped)
// ==========================================
export const ingestData = async (payload, orgId = null) => {
  const user = auth.currentUser;
  const token = await user.getIdToken();
  
  const headers = {
    'Authorization': `Bearer ${token}`
    // Notice: We removed 'multipart/form-data'. Axios will automatically set 'application/json'.
  };

  // Dynamically attach the active organization ID so Django's RequiresActiveOrg is happy
  if (orgId) {
    // Note: 'X-Active-Org-Id' is standard, but check your Django middleware if you used a different name!
    headers['X-Active-Org-Id'] = orgId; 
  }

  return await axios.post('http://localhost:8000/api/data/ingest/', payload, { headers });
};
export const getTasks = (params) => api.get('/tasks/', { params });
export const patchTask = (taskId, data) => api.patch(`/tasks/${taskId}/`, data);
export const createTask = (data) => api.post('/tasks/create/', data);
export const deleteTask = (taskId) => api.delete(`/tasks/${taskId}/delete/`);

// ==========================================
// Matching & Assignment
// ==========================================
export const matchVolunteers = (taskId) => api.get(`/tasks/${taskId}/match/`);
export const assignTask = (taskId, volunteerUid) => api.post(`/tasks/${taskId}/assign/`, { volunteer_uid: volunteerUid });

// ==========================================
// Collaboration & Analytics
// ==========================================
export const taskComments = (taskId, data) => {
  if (data) return api.post(`/tasks/${taskId}/comments/`, data);
  return api.get(`/tasks/${taskId}/comments/`);
};
export const getOrgAnalytics = () => api.get('/org/analytics/');

// AI Processing
export const processAISheet = (data) => api.post('/process-data', data);
export const getIntelligenceFeed = () => api.get('/data/feed/')

export default api;