import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Building2,
  Tag,
  Search,
  Plus,
  Filter,
  X,
  User,
  MapPin,
  Store,
  ChevronRight,
  ClipboardList,
  Sparkles,
  Check,
  RefreshCw,
  Play,
  CheckCircle,
  ShieldCheck,
  FileText,
  Camera,
  Mic,
  Volume2,
  Maximize2,
  ExternalLink,
  Upload,
  Pause,
  AlertTriangle,
  RotateCcw,
  Ban
} from 'lucide-react';
import { taskService, agentService, uploadService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../realtime';
import { getDisplayValue, normalizeString } from '../utils/normalize';
import { resolveUserTerritoryProfile, isTaskInManagerTerritory, buildTerritoryQueryParams } from '../utils/territoryScoping';
import VoiceRecorder from '../components/VoiceRecorder';

const Tasks = ({ onNavigate }) => {
  const { user } = useAuth();
  const territoryProfile = useMemo(() => resolveUserTerritoryProfile(user), [user]);
  const isPincodeManager = territoryProfile.level === 'pincode';

  // Ownership rule: Only the assigned manager gets task execution rights.
  // Hierarchical managers get territory visibility but read-only access.
  const isAssignedToUser = (task) => {
    if (!task || !user) return false;
    const taskMgrId = String(task.assignedManagerId || task.raw?.assignedManagerId || task.raw?.assignedAgentId || '');
    const myIds = [
      String(user?.id || ''),
      String(user?._id || ''),
      String(user?.managerId || ''),
      String(user?.scope?.managerId || '')
    ].filter(Boolean);
    const idMatch = myIds.some(id => id && taskMgrId && id.toLowerCase() === taskMgrId.toLowerCase());
    const userName = (user?.name || '').trim().toLowerCase();
    const taskAssignedTo = (task.assignedTo || '').trim().toLowerCase();
    const rawMgrName = (task.raw?.assignedManagerName || '').trim().toLowerCase();
    const rawAgentName = (task.raw?.assignedAgentName || '').trim().toLowerCase();
    const isNamed = userName && taskAssignedTo && taskAssignedTo !== 'unassigned' && taskAssignedTo !== 'assigned agent';
    const nameMatch = Boolean(isNamed && taskAssignedTo === userName);
    const rawNameMatch = Boolean(userName && ((rawMgrName && rawMgrName === userName) || (rawAgentName && rawAgentName === userName)));
    return Boolean(idMatch || nameMatch || rawNameMatch);
  };
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [selectedTask, setSelectedTask] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionPhoto, setActionPhoto] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Reject Modal state
  const [rejectModalTask, setRejectModalTask] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Completion / Rework Modal state
  const [completionModalTask, setCompletionModalTask] = useState(null);
  const [completionPhoto, setCompletionPhoto] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [completionAudio, setCompletionAudio] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [completionLoading, setCompletionLoading] = useState(false);
  const [isReworkMode, setIsReworkMode] = useState(false);

  // Agents list (kept for task display use only)
  const [agentsList, setAgentsList] = useState([]);

  // Fetch real tasks from backend API strictly scoped to authenticated manager territory
  const fetchTasks = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const queryParams = buildTerritoryQueryParams(territoryProfile);
      const res = await taskService.getTasks(queryParams);
      if (res && res.success && Array.isArray(res.data)) {
        // Enforce strict territory boundaries & exclude mock/test tasks
        const territoryScoped = res.data.filter(t => isTaskInManagerTerritory(t, territoryProfile));

        const mapped = territoryScoped.map(t => {
          let formattedDue = 'Pending';
          if (t.dueDate) {
            try {
              if (t.dueDate.includes('T')) {
                formattedDue = new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              } else {
                formattedDue = t.dueDate;
              }
            } catch {
              formattedDue = t.dueDate;
            }
          }

          let territoryStr = 'Assigned Territory';
          if (t.pincode) {
            territoryStr = `PIN ${t.pincode}${t.division || t.district ? ' (' + (t.division || t.district) + ')' : ''}`;
          } else if (t.location) {
            territoryStr = t.location;
          }

          let vendorStr = 'General Field Operation';
          if (t.vendor) vendorStr = t.vendor;
          else if (t.merchantName) vendorStr = t.merchantName;
          else if (t.location) vendorStr = t.location.split(',')[0].trim();

          const isResolved = t.status === 'Completed' || t.status === 'Resolved' || t.status === 'Closed';
          const defaultPhoto = '/uploads/1790060901073_a21a2daf887d32a695cca12147ab6006.jpg';
          const defaultVoice = '/uploads/1790052036893_voicenote_1790052036886.webm';

          return {
            _id: t._id || t.id,
            id: t.taskNumber || t.id || `TSK-${(t._id || '').slice(-6)}`,
            taskNumber: t.taskNumber || t.id,
            title: t.title,
            vendor: vendorStr,
            shopName: vendorStr,
            shopPhoto: t.shopPhoto || (t.photos && t.photos[0]) || defaultPhoto,
            photos: (t.photos && t.photos.length > 0) ? t.photos : [t.shopPhoto || defaultPhoto],
            voiceNote: t.voiceNote || defaultVoice,
            isResolved: isResolved,
            resolutionStatus: isResolved ? 'Resolved' : 'Not Resolved',
            category: t.category || 'General',
            territory: territoryStr,
            priority: t.priority || 'Medium',
            dueDate: formattedDue,
            status: t.status || 'Pending Acceptance',
            progress: t.progress !== undefined ? t.progress : (['Completed', 'Closed'].includes(t.status) ? 100 : t.status === 'In Progress' ? 50 : 0),
            assignedTo: t.assignedAgentName || t.assignedManagerName || 'Unassigned',
            assignedManagerRole: t.assignedAgentRole || t.assignedManagerRole || '',
            assignedDate: t.assignedDate || t.createdAt,
            completedDate: t.completedDate || t.completionDetails?.completedAt || null,
            lastUpdate: t.lastUpdate || t.updatedAt || null,
            state: t.state || 'Tamil Nadu',
            district: t.district || '',
            division: t.division || '',
            pincode: t.pincode || '',
            createdByAdminName: t.createdByAdminName || 'System Admin',
            createdByAdminRole: t.createdByAdminRole || 'State Manager',
            qcIssueId: t.qcIssueId,
            assignedManagerId: t.assignedManagerId || t.assignedAgentId || null,
            assignmentStatus: t.assignmentStatus || (['Assigned', 'Accepted', 'In Progress', 'Completed', 'Closed'].includes(t.status) ? 'ACCEPTED' : 'PENDING'),
            executionStatus: t.executionStatus || (['Completed', 'Closed', 'Resolved'].includes(t.status) ? 'COMPLETED' : t.status === 'In Progress' ? 'IN_PROGRESS' : 'NOT_STARTED'),
            description: t.description || 'Field operational deliverable and compliance task.',
            remarks: t.remarks || '',
            completionDetails: t.completionDetails,
            previousWork: t.previousWork,
            rejectionDetails: t.rejectionDetails,
            rejectionReason: t.rejectionReason,
            adminReview: t.adminReview,
            raw: t
          };
        });
        setTasks(mapped);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Failed to fetch tasks from database:', err);
      setTasks([]);
    } finally {
      setLoading(false);
      if (showSpinner) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [territoryProfile]);

  // Listen for ecosystem-wide real-time task events with zero page reload
  useRealtime('task', (event) => {
    fetchTasks(false);
    if (selectedTask && String(selectedTask._id || selectedTask.id) === String(event.entityId)) {
      if (event.action === 'deleted') {
        setSelectedTask(null);
      } else if (event.data) {
        setSelectedTask(prev => ({ ...prev, ...event.data }));
      }
    }
  });

  // Tasks are generated by system workflows only â€” no manual assignment.

  const openTaskModal = (taskItem) => {
    setSelectedTask(taskItem);
    const prevRemarks = taskItem.completionDetails?.workCompleted || 
                        taskItem.completionDetails?.resolutionDetails || 
                        taskItem.previousWork?.remarks || 
                        taskItem.remarks || '';
    const prevPhoto = taskItem.shopPhoto || 
                      (taskItem.photos && taskItem.photos[0]) || 
                      taskItem.completionDetails?.completionPhotos?.[0] || 
                      taskItem.previousWork?.shopPhoto || '';
    setActionReason(prevRemarks);
    setActionPhoto(prevPhoto);
  };

  const handleAccept = async (taskItem) => {
    const taskId = taskItem._id || taskItem.id;
    setActionLoading(true);
    try {
      const res = await taskService.updateTaskStatus(taskId, 'accept');
      if (res && res.success) {
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? {
          ...t,
          status: 'Accepted',
          assignmentStatus: 'ACCEPTED'
        } : t));
        if (selectedTask && (selectedTask._id || selectedTask.id) === taskId) {
          setSelectedTask(prev => ({ ...prev, status: 'Accepted', assignmentStatus: 'ACCEPTED' }));
        }
        await fetchTasks();
      } else {
        alert(res?.message || 'Failed to accept task.');
      }
    } catch (err) {
      console.error('Accept task error:', err);
      alert(err.message || 'Failed to accept task.');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (taskItem) => {
    setRejectModalTask(taskItem);
    setRejectReason('');
    setRejectError('');
  };

  const handleRejectSubmit = async () => {
    if (!rejectModalTask) return;
    const trimmed = (rejectReason || '').trim();
    if (!trimmed) {
      setRejectError('Rejection reason is mandatory.');
      return;
    }
    const taskId = rejectModalTask._id || rejectModalTask.id;
    setRejectLoading(true);
    setRejectError('');
    try {
      const res = await taskService.updateTaskStatus(taskId, 'reject', { reason: trimmed });
      if (res && res.success) {
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? {
          ...t,
          status: 'Rejected',
          assignmentStatus: 'REJECTED',
          rejectionReason: trimmed,
          remarks: trimmed
        } : t));
        if (selectedTask && (selectedTask._id || selectedTask.id) === taskId) {
          setSelectedTask(prev => ({
            ...prev,
            status: 'Rejected',
            assignmentStatus: 'REJECTED',
            rejectionReason: trimmed,
            remarks: trimmed
          }));
        }
        setRejectModalTask(null);
        await fetchTasks();
      } else {
        setRejectError(res?.message || 'Failed to reject task.');
      }
    } catch (err) {
      console.error('Reject task error:', err);
      setRejectError(err.message || 'Failed to reject task.');
    } finally {
      setRejectLoading(false);
    }
  };

  const handleStart = async (taskItem) => {
    const taskId = taskItem._id || taskItem.id;
    setActionLoading(true);
    try {
      const res = await taskService.updateTaskStatus(taskId, 'start');
      if (res && res.success) {
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? {
          ...t,
          status: 'In Progress',
          executionStatus: 'IN_PROGRESS',
          progress: 50
        } : t));
        if (selectedTask && (selectedTask._id || selectedTask.id) === taskId) {
          setSelectedTask(prev => ({
            ...prev,
            status: 'In Progress',
            executionStatus: 'IN_PROGRESS',
            progress: 50
          }));
        }
        await fetchTasks();
      } else {
        alert(res?.message || 'Failed to start task.');
      }
    } catch (err) {
      console.error('Start task error:', err);
      alert(err.message || 'Failed to start task.');
    } finally {
      setActionLoading(false);
    }
  };

  const compressImage = (file, maxWidth = 1200, quality = 0.75) => {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const openCompletionModal = (taskItem, rework = false) => {
    setCompletionModalTask(taskItem);
    setIsReworkMode(rework || taskItem.status === 'Rework Required');
    setCompletionPhoto('');
    setPhotoPreview('');
    setPhotoUploading(false);
    setCompletionRemarks('');
    setCompletionAudio('');
    setCompletionError('');
  };

  const handleCompletionPhotoUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setPhotoUploading(true);
    setCompletionError('');

    try {
      // 1. Immediately create compressed data URL for instant client-side preview
      const compressedDataUrl = await compressImage(file, 1200, 0.75);
      setPhotoPreview(compressedDataUrl);
      setCompletionPhoto(compressedDataUrl);

      // 2. Upload file to server via uploadService for clean server URL
      try {
        const uploadRes = await uploadService.uploadDocument(file);
        if (uploadRes && uploadRes.success && uploadRes.file?.url) {
          setCompletionPhoto(uploadRes.file.url);
        }
      } catch (uploadErr) {
        console.warn('Server photo upload fallback to compressed image:', uploadErr);
        // Fallback remains compressedDataUrl (~100-200kb), which passes easily
      }
    } catch (err) {
      console.error('Photo processing error:', err);
      setCompletionError('Failed to process image file. Please try another image.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const removeCompletionPhoto = () => {
    setCompletionPhoto('');
    setPhotoPreview('');
  };

  const handleCompletionSubmit = async () => {
    if (!completionModalTask) return;
    if (photoUploading) {
      setCompletionError('Photo proof is still uploading. Please wait a moment.');
      return;
    }
    const taskId = completionModalTask._id || completionModalTask.id;
    const trimmedRemarks = (completionRemarks || '').trim();

    if (!completionPhoto) {
      setCompletionError('Field photo proof is required to complete the task.');
      return;
    }
    if (!trimmedRemarks) {
      setCompletionError('Field remarks are required to complete the task.');
      return;
    }
    if (!completionAudio) {
      setCompletionError('Field audio note is required. Please record or upload a voice note.');
      return;
    }

    setCompletionLoading(true);
    setCompletionError('');

    try {
      const payload = {
        completionPhoto,
        completionPhotos: [completionPhoto],
        remarks: trimmedRemarks,
        workCompleted: trimmedRemarks,
        resolutionDetails: trimmedRemarks,
        completionAudio,
        voiceNote: completionAudio
      };
      if (isReworkMode) {
        payload.reworkPhoto = completionPhoto;
        payload.reworkRemarks = trimmedRemarks;
        payload.reworkAudio = completionAudio;
      }

      const res = await taskService.updateTaskStatus(taskId, 'complete', payload);
      if (res && res.success) {
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? {
          ...t,
          status: 'Completed',
          executionStatus: 'COMPLETED',
          progress: 100,
          isResolved: true,
          resolutionStatus: 'Resolved',
          shopPhoto: completionPhoto,
          voiceNote: completionAudio,
          remarks: trimmedRemarks,
          completionDetails: {
            completionPhoto,
            completionPhotos: [completionPhoto],
            workCompleted: trimmedRemarks,
            completionAudio,
            completedBy: user?.name || 'Assigned Manager',
            completedAt: new Date().toISOString()
          }
        } : t));
        if (selectedTask && (selectedTask._id || selectedTask.id) === taskId) {
          setSelectedTask(null);
        }
        setCompletionModalTask(null);
        await fetchTasks();
      } else {
        setCompletionError(res?.message || 'Failed to complete task.');
      }
    } catch (err) {
      console.error('Complete task error:', err);
      setCompletionError(err.message || 'Failed to complete task.');
    } finally {
      setCompletionLoading(false);
    }
  };

  const categories = ['All', 'Compliance', 'Sanitation Issue', 'Infrastructure Repair', 'Vendor Verification', 'KYC Verification', 'Kit Delivery', 'Merchant Support', 'Onboarding', 'Territory Survey', 'General'];

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Secondary safety guard: double-check task is strictly within manager territory
      if (!isTaskInManagerTerritory(t.raw || t, territoryProfile)) return false;

      if (statusFilter !== 'All') {
        if (statusFilter === 'Pending') {
          if (!['Pending', 'Pending Acceptance', 'Assigned', 'Accepted'].includes(t.status)) return false;
        } else if (t.status !== statusFilter) {
          return false;
        }
      }
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const match = (t.title && t.title.toLowerCase().includes(q)) ||
                      (t.id && t.id.toLowerCase().includes(q)) ||
                      (t.vendor && t.vendor.toLowerCase().includes(q)) ||
                      (t.territory && t.territory.toLowerCase().includes(q)) ||
                      (t.category && t.category.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [tasks, territoryProfile, statusFilter, categoryFilter, priorityFilter, search]);

  const totalCount = tasks.length;
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
  const pendingCount = tasks.filter(t => ['Pending', 'Pending Acceptance', 'Assigned', 'Accepted'].includes(t.status)).length;
  const completedCount = tasks.filter(t => t.status === 'Completed' || t.status === 'Closed').length;

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'Urgent':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca', dot: '#dc2626' };
      case 'High':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', dot: '#d97706' };
      case 'Medium':
        return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', dot: '#0284c7' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', dot: '#64748b' };
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return { bg: '#d1fae5', text: '#065f46', label: 'Completed' };
      case 'Closed':
        return { bg: '#f1f5f9', text: '#334155', label: 'Closed' };
      case 'In Progress':
        return { bg: '#ede9fe', text: '#5b21b6', label: 'In Progress' };
      case 'Assigned':
        return { bg: '#e0e7ff', text: '#3730a3', label: 'Assigned' };
      case 'Pending Acceptance':
        return { bg: '#fef3c7', text: '#92400e', label: 'Pending Acceptance' };
      case 'Accepted':
        return { bg: '#dbeafe', text: '#1e40af', label: 'Accepted' };
      case 'Rejected':
        return { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' };
      case 'Rework Required':
        return { bg: '#fff1f2', text: '#be123c', label: 'Rework Required' };
      default:
        return { bg: '#fef3c7', text: '#92400e', label: status || 'Pending' };
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* 1. Page Header */}
      <div style={{ 
        marginBottom: '24px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: '16px' 
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Territory Tasks & Action Items
            </h2>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 700, 
              background: '#fef3c7', 
              color: '#d97706', 
              padding: '2px 8px', 
              borderRadius: '20px',
              border: '1px solid #fde68a'
            }}>
              {pendingCount + inProgressCount} Active
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
            {territoryProfile.level === 'pincode' && `Field deliverables strictly scoped to PIN ${territoryProfile.pincode || 'Assigned Territory'}${territoryProfile.division ? ' (' + territoryProfile.division + ')' : ''}`}
            {territoryProfile.level === 'division' && `Field deliverables strictly scoped to ${territoryProfile.division || 'Assigned'} Division`}
            {territoryProfile.level === 'district' && `Field deliverables strictly scoped to ${territoryProfile.district || 'Assigned'} District`}
            {territoryProfile.level === 'state' && `Field deliverables strictly scoped to ${territoryProfile.state || 'Assigned'} State`}
            {territoryProfile.level === 'admin' && 'Central Field Operations & System Tasks (All Territories)'}
            {!['pincode', 'division', 'district', 'state', 'admin'].includes(territoryProfile.level) && 'Field deliverables and operational tasks'}
            {user?.targetAdminName ? ` • Admin: ${user.targetAdminName}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchTasks(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: '#ffffff',
              color: 'var(--text-main)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: refreshing ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Tasks'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Total */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Total Tasks
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              {totalCount}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={20} />
          </div>
        </div>

        {/* In Progress */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              In Progress
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#4f46e5', marginTop: '4px' }}>
              {inProgressCount}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
        </div>

        {/* Pending Action */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Pending Action
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
              {pendingCount}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={20} />
          </div>
        </div>

        {/* Completed */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Completed
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
              {completedCount}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        padding: '14px 18px',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search task title, vendor, ID, or territory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              fontSize: '0.84rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: '#f8fafc',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            fontSize: '0.84rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: '#ffffff',
            outline: 'none',
            color: 'var(--text-main)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <option value="All">All Statuses</option>
          <option value="Pending Acceptance">Pending Acceptance</option>
          <option value="Accepted">Accepted</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Rework Required">Rework Required</option>
          <option value="Rejected">Rejected</option>
          <option value="Assigned">Assigned</option>
          <option value="Pending">Pending</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Overdue">Overdue</option>
          <option value="Suspended">Suspended</option>
          <option value="Closed">Closed</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            fontSize: '0.84rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: '#ffffff',
            outline: 'none',
            color: 'var(--text-main)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            fontSize: '0.84rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: '#ffffff',
            outline: 'none',
            color: 'var(--text-main)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <option value="All">All Priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {(search || statusFilter !== 'All' || categoryFilter !== 'All' || priorityFilter !== 'All') && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('All');
              setCategoryFilter('All');
              setPriorityFilter('All');
            }}
            style={{
              padding: '8px 12px',
              fontSize: '0.8rem',
              borderRadius: '8px',
              border: '1px dashed var(--border)',
              background: '#f8fafc',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* 4. Tasks Table */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Task ID & Summary</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Shop Name and Location</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Priority</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Due Date</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <ClipboardList size={36} style={{ color: '#cbd5e1' }} />
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                        {tasks.length === 0 ? 'No tasks found for your assigned territory.' : 'No tasks match your filters'}
                      </div>
                      <div style={{ fontSize: '0.8rem' }}>
                        {tasks.length === 0 ? 'Any new tasks created or assigned for your territory will appear here automatically.' : 'Try clearing filters or search keywords'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((item) => {
                  const pStyle = getPriorityStyle(item.priority);
                  const sStyle = getStatusBadge(item.status);
                  const isDone = item.status === 'Completed' || item.status === 'Closed';

                  return (
                    <tr 
                      key={item._id || item.id}
                      style={{ 
                        borderBottom: '1px solid var(--border)',
                        background: isDone ? '#fafbfc' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Task ID & Summary */}
                      <td style={{ padding: '14px 16px', maxWidth: '320px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <div>
                            <div style={{ 
                              fontWeight: 700, 
                              fontSize: '0.88rem', 
                              color: 'var(--text-main)',
                              lineHeight: '1.3'
                            }}>
                              {item.title}
                            </div>
                            {item.description && (
                              <div style={{ 
                                fontSize: '0.78rem', 
                                color: 'var(--text-muted)', 
                                marginTop: '3px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '300px'
                              }}>
                                {item.description}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: '#f1f5f9',
                                color: '#475569',
                                padding: '1px 6px',
                                borderRadius: '4px'
                              }}>
                                {item.id}
                              </span>
                              {item.qcIssueId && (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  background: '#eff6ff',
                                  color: '#2563eb',
                                  border: '1px solid #bfdbfe',
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}>
                                  QC Linked
                                </span>
                              )}
                              <span style={{ 
                                fontSize: '11px', 
                                color: 'var(--text-muted)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                <Tag size={11} />
                                {item.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Shop Name and Location */}
                      <td style={{ padding: '14px 16px', minWidth: '180px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem' }}>
                            <Store size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span>{item.vendor}</span>
                          </div>
                          {item.territory && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              <MapPin size={12} style={{ color: '#0284c7', flexShrink: 0 }} />
                              <span>{getDisplayValue(item.territory)}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: pStyle.bg,
                          color: pStyle.text,
                          border: `1px solid ${pStyle.border}`
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pStyle.dot }} />
                          {item.priority}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={13} />
                          <span>{item.dueDate}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '12px',
                          background: sStyle.bg,
                          color: sStyle.text
                        }}>
                          {sStyle.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Only the assigned manager gets task execution action buttons */}
                          {isAssignedToUser(item) && (
                            <>
                              {/* 1. Pending Acceptance: Accept & Reject */}
                              {['Pending Acceptance', 'Pending'].includes(item.status) && (
                                <>
                                  <button
                                    onClick={() => handleAccept(item)}
                                    disabled={actionLoading}
                                    title="Accept Task Allocation"
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '0.74rem',
                                      fontWeight: 700,
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: '#10b981',
                                      color: '#ffffff',
                                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Check size={12} />
                                    <span>Accept</span>
                                  </button>
                                  <button
                                    onClick={() => openRejectModal(item)}
                                    disabled={actionLoading}
                                    title="Reject Task Allocation"
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '0.74rem',
                                      fontWeight: 700,
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: '#ef4444',
                                      color: '#ffffff',
                                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <X size={12} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {/* 2. Accepted (or Assigned for High priority): Start */}
                              {(item.status === 'Accepted' || (item.status === 'Assigned' && item.priority === 'High')) && (
                                <button
                                  onClick={() => handleStart(item)}
                                  disabled={actionLoading}
                                  title="Start Work on Task"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: '#4f46e5',
                                    color: '#ffffff',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Play size={12} />
                                  <span>Start</span>
                                </button>
                              )}

                              {/* 3. In Progress: Complete (Opens completion form modal) */}
                              {item.status === 'In Progress' && (
                                <button
                                  onClick={() => openCompletionModal(item, false)}
                                  disabled={actionLoading}
                                  title="Complete Task with Proof"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: '#059669',
                                    color: '#ffffff',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <CheckCircle2 size={12} />
                                  <span>Complete</span>
                                </button>
                              )}

                              {/* 4. Rework Required: Submit Rework */}
                              {['Rework Required', 'Rework'].includes(item.status) && (
                                <button
                                  onClick={() => openCompletionModal(item, true)}
                                  disabled={actionLoading}
                                  title="Submit Rework"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: '#e11d48',
                                    color: '#ffffff',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <RefreshCw size={12} />
                                  <span>Rework</span>
                                </button>
                              )}
                            </>
                          )}

                          <button
                            onClick={() => openTaskModal(item)}
                            style={{
                              padding: '4px 9px',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: '#ffffff',
                              color: 'var(--text-main)',
                              cursor: 'pointer'
                            }}
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Photo Preview Lightbox */}
      {previewPhoto && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(5px)',
          padding: '20px'
        }}>
          <div style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh' }}>
            <button
              onClick={() => setPreviewPhoto(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <img 
              src={previewPhoto} 
              alt="Full Preview" 
              style={{
                maxWidth: '85vw',
                maxHeight: '85vh',
                borderRadius: '12px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                display: 'block'
              }} 
            />
          </div>
        </div>
      )}

      {/* 5. Task Action & Details Modal */}
      {selectedTask && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div 
            onClick={() => setSelectedTask(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,40,0.65)', backdropFilter: 'blur(5px)' }}
          />

          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            background: '#ffffff',
            borderRadius: '18px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.28)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 22px',
              borderBottom: '1px solid var(--border)',
              background: '#f8fafc'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#e2e8f0',
                    color: '#334155',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    {selectedTask.id}
                  </span>
                  {selectedTask.qcIssueId && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      QC Linked: {selectedTask.qcIssueId}
                    </span>
                  )}
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: getStatusBadge(selectedTask.status).bg,
                    color: getStatusBadge(selectedTask.status).text
                  }}>
                    {selectedTask.status}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '6px 0 0', color: 'var(--text-main)' }}>
                  {selectedTask.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                title="Close"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
              {/* Comprehensive Task Allocation & Lifecycle Metadata */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid var(--border)',
                borderRadius: '14px',
                padding: '16px',
                marginBottom: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ClipboardList size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        Task Allocation & Hierarchy
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Assigned To: <strong>{selectedTask.assignedTo || 'Unassigned'}</strong> â€¢ Role: <span style={{ textTransform: 'capitalize' }}>{(selectedTask.assignedManagerRole || 'Agent').replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      ...getPriorityStyle(selectedTask.priority)
                    }}>
                      {selectedTask.priority || 'Medium'} Priority
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: getStatusBadge(selectedTask.status).bg,
                      color: getStatusBadge(selectedTask.status).text
                    }}>
                      {selectedTask.status}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Completion Progress</span>
                    <span style={{ color: 'var(--text-main)' }}>{selectedTask.progress || (selectedTask.status === 'Completed' ? 100 : selectedTask.status === 'In Progress' ? 50 : 0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${selectedTask.progress || (selectedTask.status === 'Completed' ? 100 : selectedTask.status === 'In Progress' ? 50 : 0)}%`,
                      height: '100%',
                      background: selectedTask.status === 'Completed' ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.78rem' }}>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>State / Jurisdiction</span>
                    <strong style={{ color: 'var(--text-main)' }}>{getDisplayValue(selectedTask.state || selectedTask.raw?.state, 'Tamil Nadu')}</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>District</span>
                    <strong style={{ color: 'var(--text-main)' }}>{getDisplayValue(selectedTask.district || selectedTask.raw?.district, 'Krishnagiri')}</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Division</span>
                    <strong style={{ color: 'var(--text-main)' }}>{getDisplayValue(selectedTask.division || selectedTask.raw?.division, 'Central')}</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Pincode</span>
                    <strong style={{ color: 'var(--text-main)' }}>{getDisplayValue(selectedTask.pincode || selectedTask.raw?.pincode, '635109')}</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Assigned Date</span>
                    <strong style={{ color: 'var(--text-main)' }}>{selectedTask.assignedDate ? new Date(selectedTask.assignedDate).toLocaleDateString('en-IN') : 'Recently'}</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Due Date</span>
                    <strong style={{ color: '#b45309' }}>{selectedTask.dueDate || 'Standard 3 days'}</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Last Update</span>
                    <strong style={{ color: 'var(--text-main)' }}>{selectedTask.lastUpdate ? new Date(selectedTask.lastUpdate).toLocaleDateString('en-IN') : 'N/A'}</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Completed Date</span>
                    <strong style={{ color: selectedTask.completedDate ? '#15803d' : 'var(--text-muted)' }}>{selectedTask.completedDate ? new Date(selectedTask.completedDate).toLocaleDateString('en-IN') : 'Pending'}</strong>
                  </div>
                </div>

                {selectedTask.description && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.8rem', color: '#334155' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Description / Deliverable</span>
                    {selectedTask.description}
                  </div>
                )}
              </div>

              {/* 1. Shop Name and Location */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Shop Name and Location
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                  <Store size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span>{selectedTask.vendor || selectedTask.shopName}</span>
                </div>
                {selectedTask.territory && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#0284c7', marginTop: '4px' }}>
                    <MapPin size={13} style={{ flexShrink: 0 }} />
                    <span>{getDisplayValue(selectedTask.territory)}</span>
                    {selectedTask.raw?.location && selectedTask.raw.location !== selectedTask.territory && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
                        â€¢ {getDisplayValue(selectedTask.raw.location)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Status Banner */}
              {(() => {
                const status = selectedTask?.status;
                const isAssigned = isAssignedToUser(selectedTask);
                const isCompleted = ['Completed', 'Resolved', 'Closed'].includes(status);
                const isClosed = status === 'Closed';
                const isInProgress = status === 'In Progress';
                const isRework = ['Rework Required', 'Rework'].includes(status);
                const isPendingAcceptance = ['Pending Acceptance', 'Pending'].includes(status);
                const isAccepted = status === 'Accepted' || (status === 'Assigned' && selectedTask.priority === 'High');
                const isRejected = status === 'Rejected';

                let bg = '#eff6ff';
                let border = '1px solid #bfdbfe';
                let titleColor = '#1e40af';
                let subColor = '#3b82f6';
                let title = `Field Work Status: ${status || 'Pending'}`;
                let subtitle = 'Review the task details and status.';

                if (isPendingAcceptance) {
                  bg = 'linear-gradient(135deg, #fffbeb, #fef3c7)';
                  border = '1px solid #fde68a';
                  titleColor = '#92400e';
                  subColor = '#b45309';
                  title = '⏳ Status: Pending Acceptance';
                  subtitle = isAssigned 
                    ? 'Review the task requirements below and either Accept or Reject this allocation.'
                    : `Awaiting acceptance by assigned manager (${selectedTask.assignedTo}).`;
                } else if (isAccepted) {
                  bg = 'linear-gradient(135deg, #eff6ff, #dbeafe)';
                  border = '1px solid #bfdbfe';
                  titleColor = '#1e40af';
                  subColor = '#2563eb';
                  title = '📋 Status: Accepted & Ready to Start';
                  subtitle = isAssigned
                    ? 'Task accepted. Click Start Work when you are ready to begin on-ground inspection.'
                    : `Task accepted by ${selectedTask.assignedTo}. Work will start on ground.`;
                } else if (isInProgress) {
                  bg = '#f5f3ff';
                  border = '1px solid #ddd6fe';
                  titleColor = '#6d28d9';
                  subColor = '#7c3aed';
                  title = '🟢 Status: Work In Progress';
                  subtitle = isAssigned
                    ? 'Task execution is active. When done, click Complete Task to submit photo proof, remarks, and voice note.'
                    : `Inspection is actively underway by assigned manager (${selectedTask.assignedTo}).`;
                } else if (isRework) {
                  bg = 'linear-gradient(135deg, #fff1f2, #ffe4e6)';
                  border = '1px solid #fecdd3';
                  titleColor = '#be123c';
                  subColor = '#e11d48';
                  title = '⚠️ Status: Rework Required';
                  subtitle = 'Admin has requested rework. Check notes and submit corrected deliverables.';
                } else if (isCompleted) {
                  bg = 'linear-gradient(135deg, #f0fdf4, #dcfce7)';
                  border = '1px solid #86efac';
                  titleColor = '#15803d';
                  subColor = '#16a34a';
                  title = isClosed ? '✔ Status: Closed' : '✅ Status: Completed';
                  subtitle = 'Field verification deliverables submitted and verified successfully.';
                } else if (isRejected) {
                  bg = 'linear-gradient(135deg, #fef2f2, #fee2e2)';
                  border = '1px solid #fca5a5';
                  titleColor = '#991b1b';
                  subColor = '#dc2626';
                  title = '🚫 Status: Rejected';
                  subtitle = 'This task allocation was rejected. Rejection details are shown below.';
                }

                return (
                  <div style={{
                    background: bg,
                    border: border,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: titleColor }}>
                        {title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: subColor, marginTop: '2px' }}>
                        {subtitle}
                      </div>
                    </div>

                    {/* Banner Action Buttons for Assigned Manager */}
                    {isAssigned && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {isPendingAcceptance && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAccept(selectedTask)}
                              disabled={actionLoading}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#10b981',
                                color: '#ffffff',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              <Check size={14} />
                              <span>Accept Task</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openRejectModal(selectedTask)}
                              disabled={actionLoading}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#ef4444',
                                color: '#ffffff',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
                              }}
                            >
                              <X size={14} />
                              <span>Reject Task</span>
                            </button>
                          </>
                        )}

                        {isAccepted && (
                          <button
                            type="button"
                            onClick={() => handleStart(selectedTask)}
                            disabled={actionLoading}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                              color: '#ffffff',
                              fontSize: '0.84rem',
                              fontWeight: 700,
                              cursor: actionLoading ? 'not-allowed' : 'pointer',
                              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)'
                            }}
                          >
                            <Play size={14} />
                            <span>Start Work</span>
                          </button>
                        )}

                        {isInProgress && (
                          <button
                            type="button"
                            onClick={() => openCompletionModal(selectedTask, false)}
                            disabled={actionLoading}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #059669, #047857)',
                              color: '#ffffff',
                              fontSize: '0.84rem',
                              fontWeight: 700,
                              cursor: actionLoading ? 'not-allowed' : 'pointer',
                              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)'
                            }}
                          >
                            <CheckCircle2 size={14} />
                            <span>Complete Task</span>
                          </button>
                        )}

                        {isRework && (
                          <button
                            type="button"
                            onClick={() => openCompletionModal(selectedTask, true)}
                            disabled={actionLoading}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #e11d48, #be123c)',
                              color: '#ffffff',
                              fontSize: '0.84rem',
                              fontWeight: 700,
                              cursor: actionLoading ? 'not-allowed' : 'pointer',
                              boxShadow: '0 2px 6px rgba(225, 29, 72, 0.3)'
                            }}
                          >
                            <RefreshCw size={14} />
                            <span>Submit Rework</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Rework Reason / Admin Review Notice */}
              {selectedTask?.adminReview?.remarks && (
                <div style={{
                  background: '#fff1f2',
                  border: '1.5px solid #fecdd3',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase', marginBottom: '4px' }}>
                    <AlertCircle size={14} /> Admin Rework Reason / Instructions
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#881337', fontWeight: 600 }}>
                    {selectedTask.adminReview.remarks}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#9f1239', marginTop: '4px' }}>
                    Feedback by {selectedTask.adminReview.reviewedBy || 'Admin'}
                  </div>
                </div>
              )}

              {/* Rejection Notice if rejected */}
              {(selectedTask?.status === 'Rejected' || selectedTask?.rejectionDetails) && (
                <div style={{
                  background: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    <Ban size={14} /> Rejection Reason & Details
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#7f1d1d', fontWeight: 600 }}>
                    {selectedTask.rejectionDetails?.rejectionReason || selectedTask.rejectionReason || selectedTask.remarks || 'No specific reason provided.'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#991b1b', marginTop: '4px' }}>
                    Rejected by {selectedTask.rejectionDetails?.rejectingManagerName || selectedTask.assignedTo || 'Assigned Manager'}
                    {selectedTask.rejectionDetails?.timestamp ? ` on ${new Date(selectedTask.rejectionDetails.timestamp).toLocaleString('en-IN')}` : ''}
                  </div>
                </div>
              )}

              {/* Completed Task Deliverables Section (Read-Only proof of work) */}
              {(['Completed', 'Closed', 'Resolved'].includes(selectedTask?.status) || selectedTask?.completionDetails) && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 800, color: '#166534' }}>
                      <CheckCircle2 size={16} style={{ color: '#15803d' }} />
                      <span>Completed Deliverables Proof</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', border: '1px solid #86efac' }}>
                      VERIFIED ON GROUND
                    </span>
                  </div>

                  {/* Photo Proof */}
                  {(selectedTask.completionDetails?.completionPhoto || selectedTask.shopPhoto) && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Field Photo Proof
                      </div>
                      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #86efac' }}>
                        <img
                          src={selectedTask.completionDetails?.completionPhoto || selectedTask.shopPhoto}
                          alt="Verification Proof"
                          style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }}
                          onError={(e) => { e.target.src = '/uploads/1790060901073_a21a2daf887d32a695cca12147ab6006.jpg'; }}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto(selectedTask.completionDetails?.completionPhoto || selectedTask.shopPhoto)}
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            background: 'rgba(0,0,0,0.65)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Maximize2 size={12} /> View Full
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Field Remarks */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Field Remarks & Resolution
                    </div>
                    <div style={{
                      padding: '8px 12px',
                      background: '#ffffff',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      color: '#1e293b'
                    }}>
                      {selectedTask.completionDetails?.workCompleted || selectedTask.completionDetails?.resolutionDetails || selectedTask.remarks || 'Deliverable conducted and verified.'}
                    </div>
                  </div>

                  {/* Audio Note */}
                  {(selectedTask.completionDetails?.completionAudio || selectedTask.voiceNote) && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Field Audio Note
                      </div>
                      <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                        <audio controls src={selectedTask.completionDetails?.completionAudio || selectedTask.voiceNote} style={{ width: '100%', height: '32px' }} />
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600, marginTop: '8px', borderTop: '1px dashed #86efac', paddingTop: '6px' }}>
                    Completed by: <strong>{selectedTask.completionDetails?.completedBy || selectedTask.assignedTo || 'Assigned Manager'}</strong>
                    {selectedTask.completionDetails?.completedAt ? ` • ${new Date(selectedTask.completionDetails.completedAt).toLocaleString('en-IN')}` : ''}
                  </div>
                </div>
              )}

              {/* Previous Submission (for tasks that underwent Rework) */}
              {selectedTask?.previousWork && (
                <div style={{
                  background: '#fff1f2',
                  border: '1.5px solid #fecdd3',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 800, color: '#9f1239' }}>
                      <RotateCcw size={15} />
                      <span>Previous Submission (Prior to Rework)</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
                      READ-ONLY ARCHIVE
                    </span>
                  </div>

                  {selectedTask.previousWork.shopPhoto && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239', marginBottom: '3px' }}>PREVIOUS PHOTO</div>
                      <img
                        src={selectedTask.previousWork.shopPhoto}
                        alt="Previous Work"
                        style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #fecdd3' }}
                        onError={(e) => { e.target.src = '/uploads/1790060901073_a21a2daf887d32a695cca12147ab6006.jpg'; }}
                      />
                    </div>
                  )}

                  {selectedTask.previousWork.remarks && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239', marginBottom: '3px' }}>PREVIOUS REMARKS</div>
                      <div style={{ padding: '8px 10px', background: '#fff', borderRadius: '6px', border: '1px solid #fecdd3', fontSize: '0.8rem', color: '#4c0519' }}>
                        {selectedTask.previousWork.remarks}
                      </div>
                    </div>
                  )}

                  {selectedTask.previousWork.voiceNote && (
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239', marginBottom: '3px' }}>PREVIOUS AUDIO NOTE</div>
                      <audio controls src={selectedTask.previousWork.voiceNote} style={{ width: '100%', height: '30px' }} />
                    </div>
                  )}
                </div>
              )}

              {/* In Progress Callout */}
              {selectedTask?.status === 'In Progress' && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                    <ClipboardList size={16} style={{ color: '#4f46e5' }} />
                    <span>Inspection Deliverable Requirements</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 10px', lineHeight: 1.5 }}>
                    To mark this task as completed, the assigned manager must record all 3 deliverables: a field inspection photo, notes/remarks, and a voice note recording.
                  </p>
                  {isAssignedToUser(selectedTask) && (
                    <button
                      type="button"
                      onClick={() => openCompletionModal(selectedTask, false)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#059669',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Open Completion Form</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--border)',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              {/* Ownership & Action Controls */}
              {(() => {
                const isAssigned = isAssignedToUser(selectedTask);
                const status = selectedTask?.status;

                // Rule: Non-assigned Managers get NO execution action buttons. Read-only only.
                if (!isAssigned) {
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#475569'
                      }}>
                        <ShieldCheck size={15} style={{ color: '#0284c7' }} />
                        <span>Assigned Manager: {selectedTask.assignedTo || 'Unassigned'} (Read-Only)</span>
                      </div>
                    </div>
                  );
                }

                // If Assigned: show contextual buttons based on workflow stage
                if (['Pending Acceptance', 'Pending'].includes(status)) {
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => openRejectModal(selectedTask)}
                        disabled={actionLoading}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#ef4444',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: actionLoading ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <X size={14} />
                        <span>Reject Task</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAccept(selectedTask)}
                        disabled={actionLoading}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#10b981',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: actionLoading ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <Check size={14} />
                        <span>Accept Task</span>
                      </button>
                    </div>
                  );
                }

                if (status === 'Accepted' || (status === 'Assigned' && selectedTask.priority === 'High')) {
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleStart(selectedTask)}
                        disabled={actionLoading}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: actionLoading ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)'
                        }}
                      >
                        <Play size={14} />
                        <span>Start Work</span>
                      </button>
                    </div>
                  );
                }

                if (status === 'In Progress') {
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => openCompletionModal(selectedTask, false)}
                        disabled={actionLoading}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #059669, #047857)',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: actionLoading ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)'
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>Complete Task</span>
                      </button>
                    </div>
                  );
                }

                if (['Rework Required', 'Rework'].includes(status)) {
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => openCompletionModal(selectedTask, true)}
                        disabled={actionLoading}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #e11d48, #be123c)',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: actionLoading ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(225, 29, 72, 0.3)'
                        }}
                      >
                        <RefreshCw size={14} />
                        <span>Submit Rework</span>
                      </button>
                    </div>
                  );
                }

                // Terminal states
                return (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: status === 'Rejected' ? '#dc2626' : '#15803d'
                  }}>
                    {status === 'Rejected' ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                    <span>Status: {status}</span>
                  </div>
                );
              })()}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: '#ffffff',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Rejection Reason Modal */}
      {rejectModalTask && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div 
            onClick={() => !rejectLoading && setRejectModalTask(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '480px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid #fee2e2',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 800, margin: 0, color: '#991b1b' }}>
                    Reject Task Allocation
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: '#b91c1c' }}>
                    {rejectModalTask.taskNumber || rejectModalTask.id} • {rejectModalTask.vendor || rejectModalTask.shopName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !rejectLoading && setRejectModalTask(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 12px', lineHeight: 1.5 }}>
                Please provide the mandatory reason for rejecting this task. This reason will be recorded in the task history and reviewed by administration.
              </p>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Rejection Reason <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this task cannot be accepted (e.g., outside territory, merchant unavailable, wrong location)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #fca5a5',
                    fontSize: '0.84rem',
                    color: '#0f172a',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {rejectError && (
                <div style={{
                  padding: '8px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '14px'
                }}>
                  <AlertCircle size={14} />
                  <span>{rejectError}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRejectModalTask(null)}
                  disabled={rejectLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: rejectLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectSubmit}
                  disabled={rejectLoading}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: rejectLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                  }}
                >
                  {rejectLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Dedicated Completion / Rework Modal */}
      {completionModalTask && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div 
            onClick={() => !completionLoading && setCompletionModalTask(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '580px',
            maxHeight: '90vh',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--border)',
              background: isReworkMode ? '#fff1f2' : '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: isReworkMode ? '#fecdd3' : '#dcfce7',
                  color: isReworkMode ? '#be123c' : '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {isReworkMode ? <RefreshCw size={18} /> : <CheckCircle2 size={18} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: isReworkMode ? '#9f1239' : '#14532d' }}>
                    {isReworkMode ? 'Submit Task Rework Deliverables' : 'Complete Task Deliverables'}
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: isReworkMode ? '#be123c' : '#166534' }}>
                    {completionModalTask.taskNumber || completionModalTask.id} • {completionModalTask.vendor || completionModalTask.shopName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !completionLoading && setCompletionModalTask(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '0.78rem',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={15} style={{ color: '#0284c7', flexShrink: 0 }} />
                <span>All 3 fields below (<strong>Photo</strong>, <strong>Remarks</strong>, and <strong>Audio Note</strong>) are mandatory to complete field verification.</span>
              </div>

              {/* Field 1: Photo Proof */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Camera size={14} style={{ color: '#2563eb' }} />
                    <span>1. Field Photo Proof <span style={{ color: '#dc2626' }}>*</span></span>
                  </label>
                  {(completionPhoto || photoPreview) && (
                    <button
                      type="button"
                      onClick={removeCompletionPhoto}
                      style={{ fontSize: '0.72rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {photoUploading ? (
                  <div style={{
                    height: '110px',
                    borderRadius: '10px',
                    border: '1.5px dashed #3b82f6',
                    background: '#eff6ff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    color: '#2563eb'
                  }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Optimizing and uploading photo proof...</span>
                  </div>
                ) : (completionPhoto || photoPreview) ? (
                  <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                    <img src={photoPreview || completionPhoto} alt="Completion Proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: 6, left: 8, fontSize: '10px', fontWeight: 700, background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
                      Photo Proof Attached
                    </span>
                  </div>
                ) : (
                  <label style={{
                    height: '100px',
                    borderRadius: '10px',
                    border: '2px dashed #cbd5e1',
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}>
                    <Camera size={22} style={{ color: '#94a3b8' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Click to upload storefront or inspection photo</span>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>PNG, JPG or JPEG from device</span>
                    <input type="file" accept="image/*" onChange={handleCompletionPhotoUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>

              {/* Field 2: Remarks */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  <FileText size={14} style={{ color: '#d97706' }} />
                  <span>2. Field Remarks & Inspection Findings <span style={{ color: '#dc2626' }}>*</span></span>
                </label>
                <textarea
                  rows={3}
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  placeholder="Detail on-ground findings, verification actions conducted, status of compliance deliverables..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.84rem',
                    color: '#0f172a',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Field 3: Voice Note */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  <Mic size={14} style={{ color: '#7c3aed' }} />
                  <span>3. Field Audio Note (Voice Recording) <span style={{ color: '#dc2626' }}>*</span></span>
                </label>
                <VoiceRecorder
                  onVoiceNoteUploaded={(url) => setCompletionAudio(url)}
                  onAudioRecorded={(url) => setCompletionAudio(url)}
                />
                {completionAudio && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#16a34a', fontWeight: 700 }}>
                    <CheckCircle size={14} />
                    <span>Audio note successfully attached and ready for submission.</span>
                  </div>
                )}
              </div>

              {/* Error Banner */}
              {completionError && (
                <div style={{
                  padding: '9px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '10px'
                }}>
                  <AlertCircle size={15} />
                  <span>{completionError}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--border)',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setCompletionModalTask(null)}
                disabled={completionLoading}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: completionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompletionSubmit}
                disabled={completionLoading}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isReworkMode ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: completionLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isReworkMode ? '0 2px 6px rgba(225, 29, 72, 0.3)' : '0 2px 6px rgba(16, 185, 129, 0.3)'
                }}
              >
                {completionLoading ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>{isReworkMode ? 'Submit Rework' : 'Complete & Submit Task'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Tasks;
