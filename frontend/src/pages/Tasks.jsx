import React, { useState, useEffect } from 'react';
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
  Pause
} from 'lucide-react';
import { taskService, agentService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Tasks = ({ onNavigate }) => {
  const { user } = useAuth();
  const isPincodeManager = (user?.role || '').toLowerCase().includes('pincode');
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
  const [reworkMode, setReworkMode] = useState(false);
  const [reworkPhoto, setReworkPhoto] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [reworkAudio, setReworkAudio] = useState(null);
  const [reworkRecording, setReworkRecording] = useState(false);
  const reworkMediaRef = React.useRef(null);

  // Task allocation & agents list state
  const [agentsList, setAgentsList] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    title: '',
    vendor: '',
    category: 'Physical QC Audit',
    priority: 'Medium',
    dueDate: '',
    description: '',
    assignedToId: '',
    remarks: ''
  });
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  // Fetch real tasks from backend API
  const fetchTasks = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await taskService.getTasks();
      if (res && res.success && Array.isArray(res.data)) {
        const mapped = res.data.map(t => {
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
            status: t.status || 'Assigned',
            progress: t.progress !== undefined ? t.progress : (['Completed', 'Closed'].includes(t.status) ? 100 : t.status === 'In Progress' ? 50 : 0),
            assignedTo: t.assignedAgentName || t.assignedManagerName || user?.name || 'Assigned Agent',
            assignedManagerRole: t.assignedAgentRole || t.assignedManagerRole || user?.role || 'pincode_agent',
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
            description: t.description || 'Field operational deliverable and compliance task.',
            remarks: t.remarks || '',
            completionDetails: t.completionDetails,
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
    // Load available subordinate agents for task allocation
    agentService.getAgents().then(res => {
      if (res && res.success && Array.isArray(res.data)) {
        setAgentsList(res.data);
      }
    }).catch(() => {});
  }, []);

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!assignForm.description && !assignForm.title) {
      setAssignError('Please provide a task title or description.');
      return;
    }
    const selectedAgent = agentsList.find(a => String(a._id || a.id) === String(assignForm.assignedToId));
    setAssigning(true);
    setAssignError('');
    setAssignSuccess('');
    try {
      const payload = {
        vendor: assignForm.vendor || (selectedAgent ? `Field Deliverable: ${selectedAgent.name}` : 'General Operation'),
        category: assignForm.category || 'Physical QC Audit',
        priority: assignForm.priority || 'Medium',
        dueDate: assignForm.dueDate ? new Date(assignForm.dueDate).toISOString() : new Date(Date.now() + 86400000 * 3).toISOString(),
        description: assignForm.title ? `${assignForm.title} - ${assignForm.description}` : assignForm.description,
        remarks: assignForm.remarks || '',
        assignedTo: selectedAgent?.name || user?.name,
        assignedAgentId: selectedAgent?._id || selectedAgent?.id || null,
        assignedAgentName: selectedAgent?.name || null,
        assignedAgentRole: selectedAgent?.role || selectedAgent?.roleLevel || 'pincode_agent',
        state: selectedAgent?.state || user?.state || 'Tamil Nadu',
        district: selectedAgent?.district || user?.district || '',
        division: selectedAgent?.division || user?.division || '',
        pincode: selectedAgent?.pincode || user?.pincode || null,
        location: selectedAgent ? `${selectedAgent.district || ''}, ${selectedAgent.state || ''}`.trim() : (user?.district || 'Tamil Nadu')
      };
      const res = await taskService.createTask(payload);
      if (res && res.success) {
        setAssignSuccess('Task allocated successfully!');
        setShowAssignModal(false);
        setAssignForm({
          title: '',
          vendor: '',
          category: 'Physical QC Audit',
          priority: 'Medium',
          dueDate: '',
          description: '',
          assignedToId: '',
          remarks: ''
        });
        await fetchTasks(true);
      } else {
        setAssignError(res?.message || 'Failed to allocate task');
      }
    } catch (err) {
      setAssignError(err.message || 'Error creating task');
    } finally {
      setAssigning(false);
    }
  };

  const handleDirectStatusChange = async (taskId, nextStatus) => {
    setActionLoading(true);
    try {
      const res = await taskService.updateTaskStatus(taskId, undefined, { status: nextStatus });
      if (res && res.success) {
        setSelectedTask(prev => prev ? { ...prev, status: nextStatus, progress: nextStatus === 'Completed' ? 100 : prev.progress } : null);
        await fetchTasks();
      }
    } catch (err) {
      console.error('Failed to change status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  
  const openTaskModal = (taskItem) => {
    setSelectedTask(taskItem);
    const prevRemarks = taskItem.completionDetails?.workCompleted || 
                        taskItem.completionDetails?.resolutionDetails || 
                        taskItem.previousWork?.workCompleted || 
                        taskItem.remarks || '';
    const prevPhoto = taskItem.shopPhoto || 
                      (taskItem.photos && taskItem.photos[0]) || 
                      taskItem.completionDetails?.completionPhotos?.[0] || 
                      taskItem.previousWork?.shopPhoto || '';
    setActionReason(prevRemarks);
    setActionPhoto(prevPhoto);
    setReworkMode(false);
    setReworkPhoto(taskItem.reworkDetails?.reworkPhoto || '');
    setReworkReason(taskItem.reworkDetails?.reworkRemarks || '');
    setReworkAudio(taskItem.reworkDetails?.reworkAudio || null);
    setReworkRecording(false);
  };

  // ── Rework audio recording helpers ──
  const startReworkRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = (ev) => setReworkAudio(ev.target.result);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      reworkMediaRef.current = mr;
      setReworkRecording(true);
    } catch {
      alert('Microphone access denied. Please allow microphone to record audio.');
    }
  };

  const stopReworkRecording = () => {
    if (reworkMediaRef.current && reworkRecording) {
      reworkMediaRef.current.stop();
      setReworkRecording(false);
    }
  };

  const handleReworkPhotoUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setReworkPhoto(uploadEvent.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setActionPhoto(uploadEvent.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReworkSubmit = async () => {
    if (!selectedTask) return;
    const taskId = selectedTask._id || selectedTask.id;
    setActionLoading(true);
    try {
      await taskService.updateTaskStatus(taskId, 'start', {
        remarks: reworkReason || 'Rework initiated on field',
        reworkPhoto: reworkPhoto || '',
        reworkAudio: reworkAudio || '',
        reworkRemarks: reworkReason || 'Rework started'
      });
      setSelectedTask(prev => ({
        ...prev,
        status: 'In Progress',
        reworkDetails: {
          reworkPhoto,
          reworkAudio,
          reworkRemarks: reworkReason
        }
      }));
      setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? {
        ...t,
        status: 'In Progress',
        reworkDetails: {
          reworkPhoto,
          reworkAudio,
          reworkRemarks: reworkReason
        }
      } : t));
      setReworkMode(false);
      fetchTasks();
    } catch (e) {
      console.warn('Rework submit notice:', e.message);
      setSelectedTask(prev => ({ ...prev, status: 'In Progress' }));
      setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? { ...t, status: 'In Progress' } : t));
      setReworkMode(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTaskAction = async (decision) => {
    if (!selectedTask) return;
    const taskId = selectedTask._id || selectedTask.id;
    setActionLoading(true);
    try {
      if (decision === 'start') {
        const isReworkDecision = selectedTask?.status === 'Rework Required';
        await taskService.updateTaskStatus(taskId, 'start', {
          remarks: actionReason || (isReworkDecision ? 'Rework initiated on field' : 'Work started on field'),
          ...(isReworkDecision ? {
            reworkPhoto: actionPhoto || selectedTask.shopPhoto || '',
            reworkAudio: reworkAudio || '',
            reworkRemarks: actionReason || 'Rework started'
          } : {})
        });
        setSelectedTask(prev => ({ ...prev, status: 'In Progress' }));
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? { ...t, status: 'In Progress' } : t));
      } else if (decision === 'solved') {
        const photoToSave = actionPhoto || selectedTask.shopPhoto;
        await taskService.updateTaskStatus(taskId, 'complete', {
          workCompleted: actionReason || 'Field deliverable completed and verified',
          resolutionDetails: actionReason || 'Resolved on ground',
          completionPhotos: photoToSave ? [photoToSave] : [],
          remarks: actionReason || 'Task Solved'
        });
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? { 
          ...t, 
          status: 'Completed', 
          isResolved: true, 
          resolutionStatus: 'Resolved',
          shopPhoto: photoToSave || t.shopPhoto 
        } : t));
        setSelectedTask(null);
        fetchTasks();
      } else if (decision === 'suspend') {
        const photoToSave = actionPhoto || selectedTask.shopPhoto;
        await taskService.submitSuspendRequest(taskId, {
          suspendReason: actionReason || 'Field operation obstructed / requires review',
          explanation: actionReason || 'Suspension requested by field manager',
          supportingPhotos: photoToSave ? [photoToSave] : [],
          remarks: actionReason || ''
        });
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? { ...t, status: 'Suspend Requested' } : t));
        setSelectedTask(null);
        fetchTasks();
      } else if (decision === 'not_solved') {
        const photoToSave = actionPhoto || selectedTask.shopPhoto;
        await taskService.updateTaskStatus(taskId, 'not_solved', {
          workCompleted: 'Field inspection conducted — task pending resolution',
          remarks: actionReason || 'Task Not Solved / In Progress',
          completionPhotos: photoToSave ? [photoToSave] : []
        });
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? { ...t, status: 'In Progress' } : t));
        setSelectedTask(null);
        fetchTasks();
      }
    } catch (e) {
      console.warn('Task action notice:', e.message);
      if (decision === 'solved') {
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? { ...t, status: 'Completed', isResolved: true, resolutionStatus: 'Resolved' } : t));
        setSelectedTask(null);
      } else if (decision === 'suspend') {
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? { ...t, status: 'Suspend Requested' } : t));
        setSelectedTask(null);
      } else if (decision === 'not_solved') {
        setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? { ...t, status: 'In Progress' } : t));
        setSelectedTask(null);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (taskItem, targetAction = null) => {
    const taskId = taskItem._id || taskItem.id;
    let action = targetAction;
    let nextStatus = taskItem.status;

    if (!action) {
      if (taskItem.status === 'Pending Acceptance') {
        action = 'accept';
        nextStatus = 'Accepted';
      } else if (taskItem.status === 'Accepted' || taskItem.status === 'Assigned') {
        action = 'start';
        nextStatus = 'In Progress';
      } else if (taskItem.status === 'In Progress') {
        action = 'complete';
        nextStatus = 'Completed';
      } else if (taskItem.status === 'Completed') {
        return;
      }
    } else {
      if (action === 'accept') nextStatus = 'Accepted';
      else if (action === 'start') nextStatus = 'In Progress';
      else if (action === 'complete') nextStatus = 'Completed';
    }

    if (action) {
      try {
        await taskService.updateTaskStatus(taskId, action, {
          workCompleted: 'Field action updated from Manager Portal',
          remarks: `Task transitioned to ${nextStatus}`
        });
      } catch (e) {
        console.warn('Server task update warning:', e.message);
      }
    }

    setTasks(prev => prev.map(t => {
      if ((t._id || t.id) !== taskId) return t;
      return { 
        ...t, 
        status: nextStatus,
        completedAt: nextStatus === 'Completed' ? new Date().toISOString() : t.completedAt
      };
    }));

    if (selectedTask && (selectedTask._id || selectedTask.id) === taskId) {
      setSelectedTask(prev => ({
        ...prev,
        status: nextStatus,
        completedAt: nextStatus === 'Completed' ? new Date().toISOString() : prev.completedAt
      }));
    }
  };

  const categories = ['All', 'Compliance', 'Sanitation Issue', 'Infrastructure Repair', 'Vendor Verification', 'KYC Verification', 'Kit Delivery', 'Merchant Support', 'Onboarding', 'Territory Survey', 'General'];

  const filteredTasks = tasks.filter(t => {
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
            Field deliverables and operational tasks assigned by Administrators (Pincode Admin: Kumar)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowAssignModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Plus size={15} />
            <span>Assign New Task</span>
          </button>

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
          <option value="Assigned">Assigned</option>
          <option value="Accepted">Accepted</option>
          <option value="In Progress">In Progress</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
          <option value="Rejected">Rejected</option>
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
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>No tasks match your filters</div>
                      <div style={{ fontSize: '0.8rem' }}>Try clearing filters or search keywords</div>
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
                              <span>{item.territory}</span>
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
                          {isPincodeManager && item.status === 'Pending Acceptance' && (
                            <button
                              onClick={() => handleUpdateStatus(item, 'accept')}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: 'none',
                                background: '#2563eb',
                                color: '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              Accept
                            </button>
                          )}
                          {isPincodeManager && ['Assigned', 'Accepted'].includes(item.status) && (
                            <button
                              onClick={() => openTaskModal(item)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: 'none',
                                background: '#4f46e5',
                                color: '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              Start
                            </button>
                          )}
                          {isPincodeManager && item.status === 'Rework Required' && (
                            <button
                              onClick={() => openTaskModal(item)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: 'none',
                                background: '#e11d48',
                                color: '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              Start Rework
                            </button>
                          )}
                          {isPincodeManager && item.status === 'In Progress' && (
                            <button
                              onClick={() => handleUpdateStatus(item, 'complete')}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: 'none',
                                background: '#10b981',
                                color: '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              Complete
                            </button>
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
                        Assigned To: <strong>{selectedTask.assignedTo || 'Unassigned'}</strong> • Role: <span style={{ textTransform: 'capitalize' }}>{(selectedTask.assignedManagerRole || 'Agent').replace('_', ' ')}</span>
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
                    <strong style={{ color: 'var(--text-main)' }}>{selectedTask.state || selectedTask.raw?.state || 'Tamil Nadu'}</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>District</span>
                    <strong style={{ color: 'var(--text-main)' }}>{selectedTask.district || selectedTask.raw?.district || 'Krishnagiri'}</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Division</span>
                    <strong style={{ color: 'var(--text-main)' }}>{selectedTask.division || selectedTask.raw?.division || 'Central'}</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Pincode</span>
                    <strong style={{ color: 'var(--text-main)' }}>{selectedTask.pincode || selectedTask.raw?.pincode || '635109'}</strong>
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
                    <span>{selectedTask.territory}</span>
                    {selectedTask.raw?.location && selectedTask.raw.location !== selectedTask.territory && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
                        • {selectedTask.raw.location}
                      </span>
                    )}
                  </div>
                )}
              </div>

                            {/* 2. Start Work Action / Status Banner */}
              {(() => {
                const status = selectedTask?.status;
                const isSuspended = ['Suspend Requested', 'Suspended'].includes(status);
                const isCompleted = ['Completed', 'Resolved', 'Closed'].includes(status);
                const isClosed = status === 'Closed';
                const isInProgress = status === 'In Progress';
                const isRework = status === 'Rework Required';
                const canStart = !isSuspended && !isCompleted && !isInProgress;

                let bg = '#eff6ff';
                let border = '1px solid #bfdbfe';
                let titleColor = '#1e40af';
                let subColor = '#3b82f6';
                let title = `Field Work Status: ${status || 'Pending'}`;
                let subtitle = 'Click Start Work when you begin on-ground inspection.';

                if (isSuspended) {
                  bg = 'linear-gradient(135deg, #fff7ed, #ffedd5)';
                  border = '1px solid #fed7aa';
                  titleColor = '#c2410c';
                  subColor = '#ea580c';
                  title = status === 'Suspend Requested' ? '⏸️ Field Work Status: Suspend Requested' : '⏸️ Field Work Status: Suspended';
                  subtitle = 'Suspension request has been submitted and is awaiting review. Work is paused.';
                } else if (isClosed) {
                  bg = 'linear-gradient(135deg, #f8fafc, #f1f5f9)';
                  border = '1px solid #cbd5e1';
                  titleColor = '#334155';
                  subColor = '#475569';
                  title = '✔ Field Work Status: Closed';
                  subtitle = 'Admin has accepted the completion details and closed the task.';
                } else if (isCompleted) {
                  bg = 'linear-gradient(135deg, #f0fdf4, #dcfce7)';
                  border = '1px solid #86efac';
                  titleColor = '#15803d';
                  subColor = '#16a34a';
                  title = '✅ Field Work Status: Completed';
                  subtitle = 'Field verification and inspection completed successfully.';
                } else if (isRework) {
                  bg = 'linear-gradient(135deg, #fff1f2, #ffe4e6)';
                  border = '1px solid #fecdd3';
                  titleColor = '#be123c';
                  subColor = '#e11d48';
                  title = '⚠️ Field Work Status: Rework Required';
                  subtitle = 'Admin has requested rework. Click Start Rework to begin correcting findings.';
                } else if (isInProgress) {
                  bg = '#f5f3ff';
                  border = '1px solid #ddd6fe';
                  titleColor = '#6d28d9';
                  subColor = '#7c3aed';
                  title = '🟢 Work In Progress';
                  subtitle = 'Task execution is active. Capture proof and submit resolution below.';
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

                    {canStart && !isRework && (
                      <button
                        type="button"
                        onClick={handleReworkSubmit}
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
                        <span>{actionLoading ? 'Starting...' : 'Start Work'}</span>
                      </button>
                    )}
                    {isPincodeManager && canStart && isRework && !reworkMode && (
                      <button
                        type="button"
                        onClick={() => { setReworkMode(true); setReworkPhoto(''); setReworkReason(''); setReworkAudio(null); }}
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
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(225, 29, 72, 0.3)'
                        }}
                      >
                        <RefreshCw size={14} />
                        <span>Start Rework</span>
                      </button>
                    )}

                    {isInProgress && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#ede9fe',
                        color: '#6d28d9',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: '1px solid #ddd6fe'
                      }}>
                        IN PROGRESS
                      </span>
                    )}

                    {isSuspended && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#ffedd5',
                        color: '#c2410c',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: '1px solid #fed7aa'
                      }}>
                        {status === 'Suspend Requested' ? 'SUSPEND REQUESTED' : 'SUSPENDED'}
                      </span>
                    )}

                    {isCompleted && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        background: isClosed ? '#f1f5f9' : '#dcfce7',
                        color: isClosed ? '#334155' : '#15803d',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: isClosed ? '1px solid #cbd5e1' : '1px solid #86efac'
                      }}>
                        {isClosed ? 'CLOSED' : 'COMPLETED'}
                      </span>
                    )}
                  </div>
                );
              })()}


              {/* Rework Form — shown after clicking Start Rework */}
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

              {isPincodeManager && selectedTask?.status === 'Rework Required' && reworkMode && (
                <div style={{
                  background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)',
                  border: '1.5px solid #fecdd3',
                  borderRadius: '14px',
                  padding: '18px 18px 14px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={16} style={{ color: '#be123c' }} />
                      <span style={{ fontSize: '0.87rem', fontWeight: 800, color: '#be123c' }}>Rework Submission Form</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setReworkMode(false); stopReworkRecording(); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#be123c', fontSize: '18px', lineHeight: 1, fontWeight: 700 }}
                    >×</button>
                  </div>

                  {/* Rework Photo */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#be123c' }}>
                        <Camera size={15} /> Rework Photo
                      </div>
                      <label htmlFor="rework-photo-input" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '6px', background: '#fecdd3',
                        color: '#be123c', border: '1px solid #fda4af', fontSize: '0.75rem',
                        fontWeight: 700, cursor: 'pointer'
                      }}>
                        <Upload size={12} /> {reworkPhoto ? 'Change' : 'Upload Photo'}
                      </label>
                      <input id="rework-photo-input" type="file" accept="image/*" onChange={handleReworkPhotoUpload} style={{ display: 'none' }} />
                    </div>
                    {reworkPhoto ? (
                      <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid #fecdd3' }}>
                        <img src={reworkPhoto} alt="Rework proof" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} onError={e => { e.target.src = '/uploads/1790060901073_a21a2daf887d32a695cca12147ab6006.jpg'; }} />
                        <span style={{ position: 'absolute', bottom: 6, left: 8, fontSize: '10px', fontWeight: 700, background: 'rgba(190,18,60,0.75)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>Rework Proof Attached</span>
                      </div>
                    ) : (
                      <label htmlFor="rework-photo-input" style={{ height: '90px', background: '#fff', borderRadius: '10px', border: '2px dashed #fda4af', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer', color: '#be123c' }}>
                        <Camera size={24} style={{ color: '#fda4af' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Click to upload rework inspection photo</span>
                        <span style={{ fontSize: '0.7rem', color: '#fda4af' }}>PNG, JPG or JPEG</span>
                      </label>
                    )}
                  </div>

                  {/* Rework Reason */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#be123c', marginBottom: '6px' }}>
                      <FileText size={15} /> Rework Reason / Field Remarks
                    </div>
                    <textarea
                      rows={3}
                      value={reworkReason}
                      onChange={(e) => setReworkReason(e.target.value)}
                      placeholder="Describe rework findings, corrective steps taken, or issues identified during rework..."
                      style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1.5px solid #fda4af', background: '#fff', fontSize: '0.83rem', color: '#1e293b', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Rework Audio */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#be123c', marginBottom: '8px' }}>
                      <Mic size={15} /> Audio Note
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {!reworkRecording ? (
                        <button
                          type="button"
                          onClick={startReworkRecording}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: reworkAudio ? '#fecdd3' : 'linear-gradient(135deg, #be123c, #9f1239)', color: reworkAudio ? '#be123c' : '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          <Mic size={14} /> {reworkAudio ? 'Re-record Audio' : 'Start Recording'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopReworkRecording}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', animation: 'pulse 1s infinite' }}
                        >
                          ⏹ Stop Recording
                        </button>
                      )}
                      {reworkRecording && (
                        <span style={{ fontSize: '0.75rem', color: '#be123c', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🔴 Recording...
                        </span>
                      )}
                    </div>
                    {reworkAudio && !reworkRecording && (
                      <div style={{ marginTop: '10px', background: '#fff', borderRadius: '8px', padding: '8px 12px', border: '1px solid #fda4af' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#be123c', marginBottom: '4px' }}>🎙 Rework Audio Recorded</div>
                        <audio controls src={reworkAudio} style={{ width: '100%', height: '32px' }} />
                      </div>
                    )}
                  </div>

                  {/* Submit Rework */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => { setReworkMode(false); stopReworkRecording(); }}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #fda4af', background: '#fff', color: '#be123c', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}
                    >Cancel</button>
                    <button
                      type="button"
                      onClick={() => handleTaskAction('start')}
                      disabled={actionLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '8px', border: 'none', background: actionLoading ? '#fda4af' : 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff', fontSize: '0.83rem', fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', boxShadow: '0 2px 6px rgba(225,29,72,0.3)' }}
                    >
                      <RefreshCw size={14} />
                      <span>{actionLoading ? 'Submitting...' : 'Submit & Start Rework'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Photo Upload Section */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    <Camera size={16} style={{ color: selectedTask?.status === 'Rework Required' ? '#be123c' : '#2563eb' }} />
                    <span>{!isPincodeManager ? 'Pincode Manager Field Photo (Read-Only)' : selectedTask?.status === 'Rework Required' ? 'Previous Field Photo (Read-Only)' : ['Completed','Resolved','Closed'].includes(selectedTask?.status) ? 'Photo Proof (Read-Only)' : 'Photo Upload'}</span>
                    {selectedTask?.status === 'Rework Required' && (
                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '20px', border: '1px solid #fecaca' }}>ORIGINAL WORK</span>
                    )}
                  </div>
                  {isPincodeManager && !['Completed','Resolved','Closed','Rework Required'].includes(selectedTask?.status) && (
                    <>
                      <label
                        htmlFor="task-action-photo-input"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Upload size={13} />
                        <span>{actionPhoto ? 'Change Photo' : 'Upload Photo'}</span>
                      </label>
                      <input
                        id="task-action-photo-input"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        style={{ display: 'none' }}
                      />
                    </>
                  )}
                </div>

                {actionPhoto ? (
                  <div style={{ position: 'relative', width: '100%', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <img 
                      src={actionPhoto} 
                      alt="Field verification capture"
                      style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }}
                      onError={(e) => {
                        e.target.src = '/uploads/1790060901073_a21a2daf887d32a695cca12147ab6006.jpg';
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      right: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        background: 'rgba(0,0,0,0.65)',
                        color: '#ffffff',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        Field Proof Attached
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto(actionPhoto)}
                        style={{
                          background: 'rgba(0,0,0,0.65)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 8px',
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
                ) : (
                  (!isPincodeManager || ['Completed','Resolved','Closed','Rework Required'].includes(selectedTask?.status)) ? (
                    <div style={{ height: '70px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94a3b8' }}>
                      <Camera size={20} style={{ color: '#cbd5e1' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{!isPincodeManager ? 'No field photo submitted yet by Pincode Manager' : selectedTask?.status === 'Rework Required' ? 'No previous field photo recorded' : 'No field photo captured'}</span>
                    </div>
                  ) : (
                    <label
                      htmlFor="task-action-photo-input"
                      style={{
                        height: '110px',
                        background: '#f8fafc',
                        borderRadius: '10px',
                        border: '2px dashed #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <Camera size={26} style={{ color: '#94a3b8' }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Click to upload shop or storefront inspection photo</span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>PNG, JPG or JPEG from field device</span>
                    </label>
                  )
                )}
              </div>

              {/* 4. Reason / Field Remarks Input */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                  <FileText size={16} style={{ color: '#d97706' }} />
                  <span>
                    {!isPincodeManager ? 'Pincode Manager Field Remarks (Read-Only)' : selectedTask?.status === 'Rework Required' ? 'Previous Field Remarks (Read-Only)' : ['Completed','Resolved','Closed'].includes(selectedTask?.status) ? 'Field Remarks (Read-Only)' : 'Reason / Field Remarks'}
                  </span>
                  {selectedTask?.status === 'Rework Required' && (
                    <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 700, background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '20px', border: '1px solid #fecaca' }}>ORIGINAL SUBMISSION</span>
                  )}
                  {['Completed','Resolved','Closed'].includes(selectedTask?.status) && (
                    <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 700, background: selectedTask?.status === 'Closed' ? '#f1f5f9' : '#dcfce7', color: selectedTask?.status === 'Closed' ? '#334155' : '#15803d', padding: '2px 8px', borderRadius: '20px', border: selectedTask?.status === 'Closed' ? '1px solid #cbd5e1' : '1px solid #86efac' }}>{selectedTask?.status === 'Closed' ? 'CLOSED' : 'COMPLETED'}</span>
                  )}
                </div>
                {(!isPincodeManager || ['Completed','Resolved','Closed','Rework Required'].includes(selectedTask?.status)) ? (
                  <div style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid ' + (selectedTask?.status === 'Rework Required' ? '#fecdd3' : '#e2e8f0'),
                    background: selectedTask?.status === 'Rework Required' ? '#fff1f2' : '#f0fdf4',
                    fontSize: '0.84rem',
                    color: selectedTask?.status === 'Rework Required' ? '#881337' : '#374151',
                    minHeight: '72px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: '1.5',
                    boxSizing: 'border-box'
                  }}>
                    {actionReason || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No previous remarks recorded.</span>}
                  </div>
                ) : (
                  <textarea
                    rows={3}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Enter reason, inspection findings, resolution summary, or suspend justification..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: '#f8fafc',
                      fontSize: '0.84rem',
                      color: 'var(--text-main)',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                )}
              </div>

              {/* 5. Voice note & Meta info */}
              {selectedTask.voiceNote && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <Volume2 size={16} style={{ color: '#4f46e5', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4f46e5', marginBottom: '4px' }}>Field Audio Note</div>
                    <audio controls src={selectedTask.voiceNote} style={{ width: '100%', height: '32px' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer: Solved, Suspend, Not Solved, and Close */}
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
              {/* Decision Action Buttons — hidden for completed/terminal tasks */}
              {(() => {
                if (!isPincodeManager) {
                  return (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#475569'
                    }}>
                      <ShieldCheck size={16} style={{ color: '#0284c7' }} />
                      <span>Viewing Work of Pincode Manager: {selectedTask.assignedTo || 'Shiva'}</span>
                    </div>
                  );
                }
                if (selectedTask?.status === 'Rework Required') {
                  return (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)',
                      border: '1.5px solid #fecdd3',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#be123c'
                    }}>
                      <RefreshCw size={14} /> Rework Required — Previous work is preserved above
                    </div>
                  );
                }
                const isTerminal = ['Completed', 'Resolved', 'Closed', 'Suspend Requested', 'Suspended'].includes(selectedTask?.status);
                if (isTerminal) {
                  const isCompleted = selectedTask?.status === 'Completed' || selectedTask?.status === 'Resolved';
                  return (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 18px',
                      borderRadius: '10px',
                      background: isCompleted ? 'linear-gradient(135deg, #dcfce7, #f0fdf4)' : 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                      border: isCompleted ? '1.5px solid #86efac' : '1.5px solid #fed7aa',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: isCompleted ? '#15803d' : '#c2410c'
                    }}>
                      {selectedTask?.status === 'Closed' ? (
                        <><CheckCircle2 size={16} /> Task Closed (Accepted by Admin) — No further actions required</>
                      ) : isCompleted ? (
                        <><CheckCircle2 size={16} /> Task Completed — No further actions required</>
                      ) : (
                        <><AlertCircle size={16} /> Suspension Requested — Awaiting Review</>
                      )}
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Status Changer Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status:</span>
                      <select
                        value={selectedTask.status}
                        disabled={actionLoading}
                        onChange={(e) => handleDirectStatusChange(selectedTask._id, e.target.value)}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          background: '#ffffff',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Assigned">Assigned</option>
                        <option value="Accepted">Accepted</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Overdue">Overdue</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </div>

                    {/* Quick Complete */}
                    {selectedTask.status !== 'Completed' && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleDirectStatusChange(selectedTask._id, 'Completed')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: actionLoading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>Complete</span>
                      </button>
                    )}

                    {/* Quick In Progress */}
                    {selectedTask.status !== 'In Progress' && selectedTask.status !== 'Completed' && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleDirectStatusChange(selectedTask._id, 'In Progress')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: actionLoading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Play size={14} />
                        <span>In Progress</span>
                      </button>
                    )}

                    {/* Quick Accept */}
                    {selectedTask.status === 'Assigned' && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleDirectStatusChange(selectedTask._id, 'Accepted')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: actionLoading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Check size={14} />
                        <span>Accept</span>
                      </button>
                    )}
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

      {/* 5. Assign New Task Modal */}
      {showAssignModal && (
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
            onClick={() => setShowAssignModal(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,40,0.65)', backdropFilter: 'blur(5px)' }}
          />

          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '620px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Assign New Field Deliverable / Task
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Allocate targets and deliverables hierarchically to lower-level agents
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAssignTask} style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              {assignError && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.82rem', marginBottom: '14px', fontWeight: 600 }}>
                  {assignError}
                </div>
              )}
              {assignSuccess && (
                <div style={{ padding: '10px 14px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', color: '#15803d', fontSize: '0.82rem', marginBottom: '14px', fontWeight: 600 }}>
                  {assignSuccess}
                </div>
              )}

              {/* Task Title */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Task / Target Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Onboard Milk & Milk shop"
                  value={assignForm.title}
                  onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Assign To Agent */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Assign To Subordinate Agent *
                </label>
                <select
                  required
                  value={assignForm.assignedToId}
                  onChange={(e) => setAssignForm({ ...assignForm, assignedToId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.85rem',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Select an agent in your territory...</option>
                  {agentsList.map(a => (
                    <option key={a._id || a.id} value={a._id || a.id}>
                      {a.name} — {(a.role || a.roleLevel || 'Agent').replace('_', ' ')} ({a.district || a.pincode || a.state || 'Assigned Territory'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Vendor / Business Name & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Target Merchant / Shop Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Milk & Milk Store"
                    value={assignForm.vendor}
                    onChange={(e) => setAssignForm({ ...assignForm, vendor: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    value={assignForm.category}
                    onChange={(e) => setAssignForm({ ...assignForm, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Physical QC Audit">Physical QC Audit</option>
                    <option value="Vendor Onboarding">Vendor Onboarding</option>
                    <option value="Compliance Verification">Compliance Verification</option>
                    <option value="Merchant Inspection">Merchant Inspection</option>
                  </select>
                </div>
              </div>

              {/* Priority & Due Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Priority *
                  </label>
                  <select
                    value={assignForm.priority}
                    onChange={(e) => setAssignForm({ ...assignForm, priority: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      background: '#ffffff',
                      fontWeight: 700,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="High">HIGH</option>
                    <option value="Medium">MEDIUM</option>
                    <option value="Low">LOW</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={assignForm.dueDate}
                    onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Description / Instructions */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Deliverable Description & Instructions *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide detailed instructions for the field agent..."
                  value={assignForm.description}
                  onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    color: 'var(--text-main)',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: '#ffffff',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: assigning ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
                  }}
                >
                  <Plus size={15} />
                  <span>{assigning ? 'Assigning...' : 'Assign Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Tasks;
