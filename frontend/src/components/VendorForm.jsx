import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { locationService, uploadService } from '../services/api';
import {
  Lock, Upload, CheckCircle2, AlertCircle, Store, User,
  FileText, CreditCard, CheckCircle,
  ChevronRight, ChevronLeft, Eye, EyeOff, X,
  Camera, BadgeCheck, Image as ImageIcon, Clock, Sparkles
} from 'lucide-react';

const CATEGORIES = [
  'Services', 'Products', 'Daily Needs', 'Food', 'Stay', 'Travel', 'Jobs'
];

const STEPS = [
  { id: 1, label: 'Business',  icon: Store },
  { id: 2, label: 'Owner',     icon: User },
  { id: 3, label: 'Documents', icon: FileText },
  { id: 4, label: 'Bank',      icon: CreditCard },
  { id: 5, label: 'Review',    icon: BadgeCheck },
];

const phoneOk     = v => /^[6-9]\d{9}$/.test(v.replace(/\s/g, ''));
const panOk       = v => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.toUpperCase());
const aadhaarOk   = v => /^\d{12}$/.test(v.replace(/\s/g, ''));
const ifscOk      = v => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase());
const maskAadhaar = v => v ? v.replace(/\d(?=\d{4})/g, 'X') : '';
const maskAccount = v => v && v.length > 4 ? 'X'.repeat(v.length - 4) + v.slice(-4) : v;
function StepBar({ current }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      padding: '14px 18px',
      background: '#ffffff',
      borderRadius: 14,
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
      marginBottom: 24
    }}>
      {STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        const Icon = s.icon;
        return (
          <React.Fragment key={s.id}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
              minWidth: 54
            }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: done
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : active
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : '#f1f5f9',
                border: done || active ? 'none' : '1.5px solid #cbd5e1',
                boxShadow: active
                  ? '0 0 0 4px rgba(245, 158, 11, 0.22), 0 2px 6px rgba(245, 158, 11, 0.35)'
                  : done
                  ? '0 2px 6px rgba(16, 185, 129, 0.3)'
                  : 'none',
                transition: 'all 0.25s ease'
              }}>
                {done ? (
                  <CheckCircle size={18} color="#ffffff" strokeWidth={2.5} />
                ) : (
                  <Icon
                    size={17}
                    color={active ? '#ffffff' : '#64748b'}
                    strokeWidth={active ? 2.3 : 2}
                  />
                )}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: active ? 800 : done ? 700 : 600,
                marginTop: 6,
                whiteSpace: 'nowrap',
                color: active ? '#b45309' : done ? '#059669' : '#64748b'
              }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1,
                height: 3,
                margin: '0 8px',
                marginBottom: 18,
                background: done ? '#10b981' : '#e2e8f0',
                borderRadius: 2,
                transition: 'background 0.3s ease'
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">
        {label}{required && <span style={{ color:'#ef4444',marginLeft:2 }}>*</span>}
      </label>
      {children}
      {error && (
        <p style={{ marginTop:4,fontSize:11,color:'#ef4444',display:'flex',alignItems:'center',gap:4 }}>
          <AlertCircle size={11}/>{error}
        </p>
      )}
    </div>
  );
}

const RRow = ({ label, value }) => (
  <div style={{ marginBottom:6 }}>
    <div style={{ fontSize:10,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',fontWeight:600 }}>{label}</div>
    <div style={{ fontSize:12,fontWeight:500,color:'var(--text-primary)',marginTop:2,wordBreak:'break-all' }}>{value||'—'}</div>
  </div>
);

const RSection = ({ title, icon: Icon, children }) => (
  <div style={{ borderRadius:10,border:'1px solid var(--border)',overflow:'hidden',marginBottom:10 }}>
    <div style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'var(--surface)',borderBottom:'1px solid var(--border)' }}>
      <Icon size={13} color="var(--primary)"/>
      <span style={{ fontSize:12,fontWeight:700,color:'var(--text-primary)' }}>{title}</span>
    </div>
    <div style={{ padding:'10px 14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px' }}>{children}</div>
  </div>
);


const TIME_SLOT_OPTIONS = [
  '05:00 AM', '05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM',
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM',
  '11:00 PM', '11:30 PM', '12:00 AM'
];

const PRESET_TIME_SLOTS = [
  { label: 'General Retail', slot: '09:00 AM - 09:00 PM' },
  { label: 'Commercial / Mall', slot: '10:00 AM - 10:00 PM' },
  { label: 'Daily Needs / Grocery', slot: '08:00 AM - 08:00 PM' },
  { label: 'Morning Shift', slot: '06:00 AM - 02:00 PM' },
  { label: 'Food & Dining', slot: '11:00 AM - 11:00 PM' },
  { label: 'Open 24/7', slot: 'Open 24/7' },
];
const VendorForm = ({ initialData, onSubmit, isEditing = false, onCancel }) => {
  const { user } = useAuth();
  const getBlank = () => ({
    businessName:'',logo:null,logoPreview:null,category:CATEGORIES[0],mobile:'',email:'',
    address:'',website:'',operatingHours:'09:00 AM - 09:00 PM',businessImages:[],businessImagePreviews:[],
    stateId:'',districtId:'',divisionId:'',pincodeId:'',
    name:'',alternatePhone:'',agentName:'',coPartnerName:'',password:'',confirmPassword:'',
    panNumber:'',aadhaarNumber:'',companyRegNumber:'',
    gstStatus:'Registered',msmeStatus:'Not Registered',businessLicense:null,
    gstNumber:'',subCategory:'',description:'',documents:[],
    accountHolderName:'',bankName:'',bankBranch:'',bankStreet:'',bankCity:'',
    accountNumber:'',ifsc:'',declaration:false,...initialData
  });
  const [step,setStep]=useState(1);
    const [formData,setFormData]=useState(getBlank);
  const [errors,setErrors]=useState({});
    const upd = (k, v) => {
    setFormData(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => { const e = { ...p }; delete e[k]; return e; });
  };
  const onChange = e => {
    const { name, value, type, checked } = e.target;
    upd(name, type === "checkbox" ? checked : value);
  };

  // Time Slot State & Handlers
  const [slotFrom, setSlotFrom] = useState('09:00 AM');
  const [slotTo, setSlotTo] = useState('09:00 PM');
  const [slotDays, setSlotDays] = useState('All Days');
  const [slotAppliedMessage, setSlotAppliedMessage] = useState('');

  const applySlot = (from, to, days) => {
    let result = '';
    if (from === 'Open 24/7' || to === 'Open 24/7') {
      result = 'Open 24/7';
    } else {
      result = `${from} - ${to}`;
      if (days && days !== 'All Days') {
        result += ` (${days})`;
      }
    }
    upd('operatingHours', result);
    setSlotAppliedMessage('Time slot set to ' + result);
    setTimeout(() => setSlotAppliedMessage(''), 2500);
  };

  const handlePresetClick = (preset) => {
    if (preset.slot === 'Open 24/7') {
      setSlotFrom('Open 24/7');
      setSlotTo('Open 24/7');
      applySlot('Open 24/7', 'Open 24/7', slotDays);
      return;
    }
    const match = preset.slot.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/);
    if (match) {
      setSlotFrom(match[1]);
      setSlotTo(match[2]);
      applySlot(match[1], match[2], slotDays);
    }
  };
  const [showPw,setShowPw]=useState(false);
  const [showCPw,setShowCPw]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [globalError,setGlobalError]=useState('');
  const [uploadingDoc,setUploadingDoc]=useState(false);
  const [districts,setDistricts]=useState([]);
  const [divisions,setDivisions]=useState([]);
  const [pincodes,setPincodes]=useState([]);
  const logoRef=useRef(null),imgRef=useRef(null),licenseRef=useRef(null);

  useEffect(()=>{
    const init=async()=>{
      try{
        setFormData(p=>({...p,stateId:user?.stateId||p.stateId,districtId:user?.districtId||p.districtId,divisionId:user?.divisionId||p.divisionId,pincodeId:user?.pincodeId||p.pincodeId}));
        if(user?.role==='state_manager'||user?.role==='State Manager'||user?.role?.includes('state')){
          const r=await locationService.getDistricts(user.stateId);
          if(r&&r.success)setDistricts(Array.isArray(r.data)?r.data:Array.isArray(r.districts)?r.districts:[]);
        }
        if(user?.districtId){
          const r=await locationService.getDivisions(user.districtId);
          if(r&&r.success)setDivisions(Array.isArray(r.data)?r.data:Array.isArray(r.divisions)?r.divisions:[]);
        }
        if(user?.divisionId){
          const r=await locationService.getPincodes(user.divisionId);
          if(r&&r.success)setPincodes(Array.isArray(r.data)?r.data:Array.isArray(r.pincodes)?r.pincodes:[]);
        }
      }catch(e){console.error(e);}
    };
    init();
  },[user]);

  
  const handleDistrictChange=async(e)=>{
    const id=e.target.value;
    setFormData(p=>({...p,districtId:id,divisionId:'',pincodeId:''}));
    setDivisions([]);
    setPincodes([]);
    if(id){
      const r=await locationService.getDivisions(id);
      if(r&&r.success)setDivisions(Array.isArray(r.data)?r.data:Array.isArray(r.divisions)?r.divisions:[]);
    }
  };
  const handleDivisionChange=async(e)=>{
    const id=e.target.value;
    setFormData(p=>({...p,divisionId:id,pincodeId:''}));
    setPincodes([]);
    if(id){
      const r=await locationService.getPincodes(id);
      if(r&&r.success)setPincodes(Array.isArray(r.data)?r.data:Array.isArray(r.pincodes)?r.pincodes:[]);
    }
  };
  const onLogo=e=>{const f=e.target.files[0];if(f){upd('logo',f);upd('logoPreview',URL.createObjectURL(f));}};
  const onImgs=e=>{const files=Array.from(e.target.files);const all=[...formData.businessImages,...files].slice(0,5);const prev=[...formData.businessImagePreviews,...files.map(f=>URL.createObjectURL(f))].slice(0,5);upd('businessImages',all);upd('businessImagePreviews',prev);};
  const rmImg=idx=>{upd('businessImages',formData.businessImages.filter((_,i)=>i!==idx));upd('businessImagePreviews',formData.businessImagePreviews.filter((_,i)=>i!==idx));};
  const onLicense=e=>{if(e.target.files[0])upd('businessLicense',e.target.files[0]);};
  const handleFileUpload=async(e)=>{const file=e.target.files?.[0];if(!file)return;setUploadingDoc(true);try{const r=await uploadService.uploadDocument(file);if(r.success&&r.file)upd('documents',[...formData.documents,r.file]);}catch(err){setGlobalError(err.message||'Upload failed');}finally{setUploadingDoc(false);}};

  const validate=s=>{
    const e={};
    if(s===1){
      if(!formData.businessName.trim())e.businessName='Business name is required';
      if(!formData.mobile.trim())e.mobile='Phone number is required';
      else if(!phoneOk(formData.mobile))e.mobile='Must be 10 digits starting with 6-9';
      if(!formData.email.trim())e.email='Email is required';
      else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))e.email='Invalid email';
      if(!formData.address.trim())e.address='Business address is required';
      if(!formData.pincodeId)e.pincodeId='Please select a pincode within your scope';
    }
    if(s===2){
      if(!formData.name.trim())e.name='Owner name is required';
      if(formData.alternatePhone.trim()&&!phoneOk(formData.alternatePhone))e.alternatePhone='Must be 10 digits starting with 6-9';
      if(!isEditing){
        if(!formData.password)e.password='Password is required';
        else if(formData.password.length<8)e.password='At least 8 characters';
        if(!formData.confirmPassword)e.confirmPassword='Please confirm password';
        else if(formData.password!==formData.confirmPassword)e.confirmPassword='Passwords do not match';
      }
    }
    if(s===3){
      if(formData.panNumber.trim()&&!panOk(formData.panNumber))e.panNumber='Invalid PAN (e.g. ABCDE1234F)';
      if(formData.aadhaarNumber.trim()&&!aadhaarOk(formData.aadhaarNumber))e.aadhaarNumber='Must be 12 digits';
    }
    if(s===4){
      if(formData.accountNumber.trim()&&(formData.accountNumber.length<9||formData.accountNumber.length>18))e.accountNumber='Must be 9-18 digits';
      if(formData.ifsc.trim()&&!ifscOk(formData.ifsc))e.ifsc='Invalid IFSC (e.g. HDFC0001234)';
    }
    if(s===5&&!formData.declaration)e.declaration='Please accept the declaration to proceed';
    return e;
  };

  const next=()=>{const e=validate(step);if(Object.keys(e).length){setErrors(e);return;}setErrors({});setStep(s=>s+1);};
  const prev=()=>{setErrors({});setStep(s=>s-1);};
  const handleSubmit=async()=>{const e=validate(5);if(Object.keys(e).length){setErrors(e);return;}setGlobalError('');setSubmitting(true);try{await onSubmit(formData);}catch(err){setGlobalError(err.message||'Failed to submit');}finally{setSubmitting(false);};};

  const isStateLocked=!!user?.stateId,isDistrictLocked=!!user?.districtId,isDivisionLocked=!!user?.divisionId,isPincodeLocked=!!user?.pincodeId;
  const inp=(err=false)=>({width:'100%',padding:'8px 12px',fontSize:13,border:'1px solid '+(err?'#f87171':'var(--border)'),borderRadius:'var(--radius-sm)',background:'var(--surface)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'});
  const dashedBox={display:'flex',alignItems:'center',gap:12,padding:'10px 14px',border:'2px dashed var(--border)',borderRadius:'var(--radius-sm)',cursor:'pointer',transition:'border-color 0.2s'};
  const hb={onMouseEnter:e=>e.currentTarget.style.borderColor='var(--primary)',onMouseLeave:e=>e.currentTarget.style.borderColor='var(--border)'};
  const step1=(
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={{gridColumn:'1/-1'}}><Field label="Business / Shop Name" required error={errors.businessName}><input type="text" name="businessName" value={formData.businessName} onChange={onChange} placeholder="e.g. Spice Route Bistro" className="form-input" style={inp(!!errors.businessName)}/></Field></div>
      <div style={{gridColumn:'1/-1'}}>
        <label className="form-label">Shop / Brand Logo</label>
        <div onClick={()=>logoRef.current?.click()} style={dashedBox} {...hb}>
          {formData.logoPreview?<img src={formData.logoPreview} alt="logo" style={{width:40,height:40,borderRadius:8,objectFit:'cover',border:'1px solid var(--border)',flexShrink:0}}/>:<div style={{width:40,height:40,borderRadius:8,background:'var(--surface)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Camera size={18} color="var(--text-muted)"/></div>}
          <div><div style={{fontSize:12,fontWeight:600,color:'var(--primary)'}}>{formData.logo?formData.logo.name:'Click to upload logo'}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>PNG, JPG up to 2MB</div></div>
          <input ref={logoRef} type="file" accept="image/*" style={{display:'none'}} onChange={onLogo}/>
        </div>
      </div>
      <Field label="Product / Service Category" required><select name="category" value={formData.category} onChange={onChange} className="form-select" style={inp()}>{(CATEGORIES || []).map(c=><option key={c}>{c}</option>)}</select></Field>
      <Field label="Business Phone" required error={errors.mobile}><input type="tel" name="mobile" value={formData.mobile} maxLength={10} onChange={e=>upd('mobile',e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10-digit mobile number" className="form-input" style={inp(!!errors.mobile)}/></Field>
      <Field label="Email Address" required error={errors.email}><input type="email" name="email" value={formData.email} onChange={onChange} placeholder="vendor@business.com" className="form-input" style={inp(!!errors.email)}/></Field>
      <Field label="Business Website (Optional)"><input type="url" name="website" value={formData.website} onChange={onChange} placeholder="https://yourwebsite.com" className="form-input" style={inp()}/></Field>
      <div style={{gridColumn:'1/-1'}}><Field label="Business Address" required error={errors.address}><input type="text" name="address" value={formData.address} onChange={onChange} placeholder="Street, Area, City" className="form-input" style={inp(!!errors.address)}/></Field></div>
            {/* Business Operating Hours - Set Time Slot Method */}
      <div style={{ gridColumn: '1 / -1', marginTop: 6, marginBottom: 6 }}>
        <div style={{
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1.5px solid #cbd5e1',
          borderRadius: 12,
          padding: '16px 18px',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
        }}>
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)'
              }}>
                <Clock size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Business Operating Hours & Time Slots
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Select or configure the standard working time slot
                </div>
              </div>
            </div>

            {formData.operatingHours && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 20,
                background: '#ecfdf5',
                color: '#059669',
                border: '1.5px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 1px 3px rgba(5, 150, 105, 0.1)'
              }}>
                <CheckCircle size={13} /> Active Slot: {formData.operatingHours}
              </span>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', fontWeight: 700, marginBottom: 8 }}>
              Quick Preset Slots (1-Click Set)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PRESET_TIME_SLOTS.map((p) => {
                const isActive = formData.operatingHours?.startsWith(p.slot);
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePresetClick(p)}
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: isActive ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                      background: isActive ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#ffffff',
                      color: isActive ? '#ffffff' : '#334155',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 2px 8px rgba(99, 102, 241, 0.3)' : '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    <span>{p.label}</span>
                    <span style={{ opacity: isActive ? 0.9 : 0.65, fontSize: 10.5 }}>({p.slot})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Time Slot Selector (From, To, Days + Set Button) */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 10
          }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', fontWeight: 700, marginBottom: 8 }}>
              Custom Time Slot Picker
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
              alignItems: 'flex-end'
            }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  From (Open Time)
                </label>
                <select
                  value={slotFrom}
                  onChange={(e) => setSlotFrom(e.target.value)}
                  className="form-select"
                  style={{ ...inp(), height: 38, fontSize: 12.5, background: '#f8fafc', borderColor: '#cbd5e1' }}
                >
                  {TIME_SLOT_OPTIONS.map((t) => (
                    <option key={'from-' + t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  To (Close Time)
                </label>
                <select
                  value={slotTo}
                  onChange={(e) => setSlotTo(e.target.value)}
                  className="form-select"
                  style={{ ...inp(), height: 38, fontSize: 12.5, background: '#f8fafc', borderColor: '#cbd5e1' }}
                >
                  {TIME_SLOT_OPTIONS.map((t) => (
                    <option key={'to-' + t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Operating Days
                </label>
                <select
                  value={slotDays}
                  onChange={(e) => setSlotDays(e.target.value)}
                  className="form-select"
                  style={{ ...inp(), height: 38, fontSize: 12.5, background: '#f8fafc', borderColor: '#cbd5e1' }}
                >
                  <option value="All Days">All Days (Mon - Sun)</option>
                  <option value="Mon - Sat">Mon - Sat</option>
                  <option value="Mon - Fri">Mon - Fri (Weekdays)</option>
                  <option value="Weekends Only">Weekends (Sat - Sun)</option>
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => applySlot(slotFrom, slotTo, slotDays)}
                  className="btn btn-primary"
                  style={{
                    height: 38,
                    width: '100%',
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(14, 165, 233, 0.3)'
                  }}
                >
                  <Clock size={14} /> Set Time Slot
                </button>
              </div>
            </div>

            {slotAppliedMessage && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12} /> {slotAppliedMessage}
              </div>
            )}
          </div>

          {/* Editable Slot String for Direct Edits */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="text"
              name="operatingHours"
              value={formData.operatingHours}
              onChange={onChange}
              placeholder="e.g. 09:00 AM - 09:00 PM"
              className="form-input"
              style={{ ...inp(), height: 36, fontSize: 12, background: '#ffffff', color: '#0f172a', fontWeight: 600, flex: 1 }}
            />
            <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
              Direct / Manual Override
            </span>
          </div>
        </div>
      </div>
      <div style={{gridColumn:'1/-1'}}><Field label="Business Description"><textarea name="description" value={formData.description} onChange={onChange} rows={2} placeholder="Brief description..." className="form-input" style={{...inp(),resize:'vertical'}}/></Field></div>
      <div style={{gridColumn:'1/-1'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <span style={{fontWeight:700,fontSize:13}}>Location & Field Jurisdiction</span>
          <span style={{fontSize:11,padding:'2px 10px',borderRadius:20,background:'#ede9fe',color:'var(--primary)',fontWeight:600}}>Constrained to your Scope</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label" style={{display:'flex',alignItems:'center',gap:4}}>State {isStateLocked&&<Lock size={11} color="var(--text-muted)"/>}</label>
            <input type="text" disabled className="form-input" value={user?.scope?.stateName||user?.state||'Tamil Nadu'} style={{...inp(),opacity:0.7}}/>
            {isStateLocked&&<p style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>Locked to your state scope</p>}
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label" style={{display:'flex',alignItems:'center',gap:4}}>District {isDistrictLocked&&<Lock size={11} color="var(--text-muted)"/>}</label>
            {isDistrictLocked?<input type="text" disabled className="form-input" value={user?.scope?.districtName||''} style={{...inp(),opacity:0.7}}/>:<select name="districtId" className="form-select" value={formData.districtId} onChange={handleDistrictChange} style={inp()}><option value="">Select District</option>{(districts || []).map(d=><option key={d._id} value={d._id}>{d.name}</option>)}</select>}
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label" style={{display:'flex',alignItems:'center',gap:4}}>Division {isDivisionLocked&&<Lock size={11} color="var(--text-muted)"/>}</label>
            {isDivisionLocked?<input type="text" disabled className="form-input" value={user?.scope?.divisionName||''} style={{...inp(),opacity:0.7}}/>:<select name="divisionId" className="form-select" value={formData.divisionId} onChange={handleDivisionChange} disabled={!formData.districtId&&!user?.districtId} style={inp()}><option value="">Select Division</option>{(divisions || []).map(d=><option key={d._id} value={d._id}>{d.name}</option>)}</select>}
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label" style={{display:'flex',alignItems:'center',gap:4}}>Pincode {isPincodeLocked&&<Lock size={11} color="var(--text-muted)"/>}</label>
            {isPincodeLocked?<input type="text" disabled className="form-input" value={(user?.scope?.pincodeCode||'')+' '+(user?.scope?.pincodeArea?'('+user.scope.pincodeArea+')':'')} style={{...inp(),opacity:0.7}}/>:<select name="pincodeId" className="form-select" value={formData.pincodeId} onChange={onChange} disabled={!formData.divisionId&&!user?.divisionId} style={inp(!!errors.pincodeId)}><option value="">Select Pincode</option>{(pincodes || []).map(p=><option key={p._id} value={p._id}>{p.code} - {p.areaName}</option>)}</select>}
            {errors.pincodeId&&<p style={{fontSize:11,color:'#ef4444',marginTop:3,display:'flex',alignItems:'center',gap:4}}><AlertCircle size={11}/>{errors.pincodeId}</p>}
          </div>
        </div>
      </div>
      <div style={{gridColumn:'1/-1'}}>
        <label className="form-label">Business Images <span style={{color:'var(--text-muted)',fontWeight:400}}>(Optional, max 5)</span></label>
        <div onClick={()=>formData.businessImages.length<5&&imgRef.current?.click()} style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8,padding:'10px 12px',border:'2px dashed var(--border)',borderRadius:'var(--radius-sm)',cursor:'pointer',minHeight:52}} {...hb}>
          {(formData.businessImagePreviews || []).map((src,i)=>(<div key={i} style={{position:'relative',flexShrink:0}}><img src={src} alt="" style={{width:40,height:40,borderRadius:6,objectFit:'cover',border:'1px solid var(--border)'}}/><button type="button" onClick={ev=>{ev.stopPropagation();rmImg(i);}} style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:'#ef4444',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}><X size={10} color="#fff"/></button></div>))}
          {formData.businessImages.length<5&&<div style={{display:'flex',alignItems:'center',gap:6,color:'var(--text-muted)',fontSize:12}}><ImageIcon size={15}/>{formData.businessImages.length===0?'Upload business images':'Add more'}</div>}
          <input ref={imgRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={onImgs}/>
        </div>
      </div>
    </div>
  );
  const step2=(
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={{gridColumn:'1/-1'}}><Field label="Owner / Contact Person Name" required error={errors.name}><input type="text" name="name" value={formData.name} onChange={onChange} placeholder="Full legal name" className="form-input" style={inp(!!errors.name)}/></Field></div>
      <Field label="Alternate Phone (Optional)" error={errors.alternatePhone}><input type="tel" name="alternatePhone" value={formData.alternatePhone||''} maxLength={10} onChange={e=>upd('alternatePhone',e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="Alternate number" className="form-input" style={inp(!!errors.alternatePhone)}/></Field>
      <Field label="Agent Name (Optional)"><input type="text" name="agentName" value={formData.agentName||''} onChange={onChange} placeholder="Agent name" className="form-input" style={inp()}/></Field>
      <div style={{gridColumn:'1/-1'}}><Field label="Co-partner Name (Optional)"><input type="text" name="coPartnerName" value={formData.coPartnerName||''} onChange={onChange} placeholder="Co-partner name" className="form-input" style={inp()}/></Field></div>
      {!isEditing&&(<>
        <Field label="Account Password" required error={errors.password}><div style={{position:'relative'}}><input type={showPw?'text':'password'} name="password" value={formData.password} onChange={onChange} placeholder="Min. 8 characters" className="form-input" style={{...inp(!!errors.password),paddingRight:36}}/><button type="button" onClick={()=>setShowPw(p=>!p)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex'}}>{showPw?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></Field>
        <Field label="Confirm Password" required error={errors.confirmPassword}><div style={{position:'relative'}}><input type={showCPw?'text':'password'} name="confirmPassword" value={formData.confirmPassword} onChange={onChange} placeholder="Re-enter password" className="form-input" style={{...inp(!!errors.confirmPassword),paddingRight:36}}/><button type="button" onClick={()=>setShowCPw(p=>!p)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex'}}>{showCPw?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></Field>
      </>)}
    </div>
  );

  const step3=(
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <Field label="PAN Number" error={errors.panNumber}><input type="text" name="panNumber" value={formData.panNumber} maxLength={10} onChange={e=>upd('panNumber',e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10))} placeholder="e.g. ABCDE1234F" className="form-input" style={{...inp(!!errors.panNumber),textTransform:'uppercase',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.1em'}}/></Field>
      <Field label="Aadhaar Number" error={errors.aadhaarNumber}><input type="text" name="aadhaarNumber" value={formData.aadhaarNumber} maxLength={12} onChange={e=>upd('aadhaarNumber',e.target.value.replace(/\D/g,'').slice(0,12))} placeholder="12-digit Aadhaar" className="form-input" style={{...inp(!!errors.aadhaarNumber),fontFamily:'monospace',fontWeight:700,letterSpacing:'0.1em'}}/></Field>
      <Field label="GST Number"><input type="text" name="gstNumber" value={formData.gstNumber} maxLength={15} onChange={e=>upd('gstNumber',e.target.value.toUpperCase())} placeholder="e.g. 29ABCDE1234F1Z5" className="form-input" style={{...inp(),textTransform:'uppercase',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em'}}/></Field>
      <div style={{gridColumn:'1/-1'}}><Field label="Company Registration Number (Optional)"><input type="text" name="companyRegNumber" value={formData.companyRegNumber||''} onChange={onChange} placeholder="Optional" className="form-input" style={inp()}/></Field></div>
      <Field label="GST Status"><select name="gstStatus" value={formData.gstStatus||'Registered'} onChange={onChange} className="form-select" style={inp()}><option>Registered</option><option>Not Registered</option><option>Applied</option></select></Field>
      <Field label="MSME Status"><select name="msmeStatus" value={formData.msmeStatus||'Not Registered'} onChange={onChange} className="form-select" style={inp()}><option>Registered</option><option>Not Registered</option><option>Applied</option></select></Field>
      <div style={{gridColumn:'1/-1'}}>
        <label className="form-label">Business License / Document</label>
        <div onClick={()=>licenseRef.current?.click()} style={dashedBox} {...hb}>
          <div style={{width:36,height:36,borderRadius:8,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:formData.businessLicense?'#d1fae5':'var(--surface)',border:'1px solid var(--border)'}}>{formData.businessLicense?<CheckCircle2 size={18} color="#10b981"/>:<Upload size={18} color="var(--text-muted)"/>}</div>
          <div>{formData.businessLicense?<><div style={{fontSize:12,fontWeight:600,color:'#10b981'}}>File uploaded</div><div style={{fontSize:11,color:'var(--text-muted)',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{formData.businessLicense.name}</div></>:<><div style={{fontSize:12,fontWeight:600,color:'var(--primary)'}}>Click to upload business document</div><div style={{fontSize:11,color:'var(--text-muted)'}}>PDF, JPG, PNG up to 5MB</div></>}</div>
          <input ref={licenseRef} type="file" accept=".pdf,image/*" style={{display:'none'}} onChange={onLicense}/>
        </div>
      </div>
      <div style={{gridColumn:'1/-1'}}>
        <label className="form-label">Additional KYC Documents (PDF or Images, max 5MB)</label>
        <div style={{border:'2px dashed var(--border-strong)',borderRadius:'var(--radius-md)',padding:'20px',textAlign:'center',background:'#faf5ff'}}>
          <Upload size={24} style={{color:'var(--primary)',marginBottom:6}}/>
          <div style={{fontSize:'0.83rem',color:'var(--text-muted)',marginBottom:10}}>Select PAN card copy, GST registration, or Trade license</div>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploadingDoc} style={{fontSize:'0.83rem'}}/>
          {uploadingDoc&&<span style={{fontSize:'0.8rem',color:'var(--primary)'}}> Uploading...</span>}
        </div>
        {formData.documents?.length>0&&<div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>{(formData.documents || []).map((doc,idx)=>(<div key={idx} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 12px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:6,fontSize:12}}><span style={{display:'flex',alignItems:'center',gap:6}}><CheckCircle2 size={13} color="#10b981"/><strong>{doc.name}</strong></span><a href={doc.url} target="_blank" rel="noreferrer" style={{color:'var(--primary)',fontWeight:600}}>View</a></div>))}</div>}
      </div>
    </div>
  );

  const step4=(
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={{gridColumn:'1/-1'}}><Field label="Account Holder Name" error={errors.accountHolderName}><input type="text" name="accountHolderName" value={formData.accountHolderName} onChange={onChange} placeholder="e.g. Spice Route Bistro LLP" className="form-input" style={inp(!!errors.accountHolderName)}/></Field></div>
      <Field label="Bank Name" error={errors.bankName}><input type="text" name="bankName" value={formData.bankName} onChange={onChange} placeholder="e.g. HDFC Bank" className="form-input" style={inp(!!errors.bankName)}/></Field>
      <Field label="Bank Branch" error={errors.bankBranch}><input type="text" name="bankBranch" value={formData.bankBranch||''} onChange={onChange} placeholder="Branch name" className="form-input" style={inp(!!errors.bankBranch)}/></Field>
      <Field label="Bank Street (Optional)"><input type="text" name="bankStreet" value={formData.bankStreet||''} onChange={onChange} placeholder="Street address" className="form-input" style={inp()}/></Field>
      <Field label="Bank City (Optional)"><input type="text" name="bankCity" value={formData.bankCity||''} onChange={onChange} placeholder="City" className="form-input" style={inp()}/></Field>
      <Field label="Account Number" error={errors.accountNumber}><input type="text" name="accountNumber" value={formData.accountNumber} maxLength={18} onChange={e=>upd('accountNumber',e.target.value.replace(/\D/g,'').slice(0,18))} placeholder="Bank Account Number" className="form-input" style={{...inp(!!errors.accountNumber),fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em'}}/></Field>
      <Field label="IFSC Code" error={errors.ifsc}><input type="text" name="ifsc" value={formData.ifsc} maxLength={11} onChange={e=>upd('ifsc',e.target.value.toUpperCase().slice(0,11))} placeholder="e.g. HDFC0001234" className="form-input" style={{...inp(!!errors.ifsc),textTransform:'uppercase',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em'}}/></Field>
    </div>
  );

  const step5=(
    <div style={{maxHeight:'55vh',overflowY:'auto',paddingRight:4}}>
      <RSection title="Business Information" icon={Store}><RRow label="Business Name" value={formData.businessName}/><RRow label="Category" value={formData.category}/><RRow label="Phone" value={formData.mobile}/><RRow label="Email" value={formData.email}/><RRow label="Address" value={formData.address}/><RRow label="Website" value={formData.website||'Not provided'}/><RRow label="Operating Hours" value={formData.operatingHours||'Not provided'}/></RSection>
      <RSection title="Owner Information" icon={User}><RRow label="Owner Name" value={formData.name}/><RRow label="Alternate Phone" value={formData.alternatePhone||'Not provided'}/><RRow label="Agent Name" value={formData.agentName||'Not provided'}/><RRow label="Co-partner" value={formData.coPartnerName||'Not provided'}/></RSection>
      <RSection title="Documents" icon={FileText}><RRow label="PAN Number" value={formData.panNumber||'Not provided'}/><RRow label="Aadhaar" value={formData.aadhaarNumber?maskAadhaar(formData.aadhaarNumber):'Not provided'}/><RRow label="GST Number" value={formData.gstNumber||'Not provided'}/><RRow label="GST Status" value={formData.gstStatus}/><RRow label="MSME Status" value={formData.msmeStatus}/><RRow label="Business License" value={formData.businessLicense?formData.businessLicense.name:'Not uploaded'}/></RSection>
      <RSection title="Bank Details" icon={CreditCard}><RRow label="Account Holder" value={formData.accountHolderName||'Not provided'}/><RRow label="Bank" value={formData.bankName||'Not provided'}/><RRow label="Branch" value={formData.bankBranch||'Not provided'}/><RRow label="Account No." value={formData.accountNumber?maskAccount(formData.accountNumber):'Not provided'}/><RRow label="IFSC Code" value={formData.ifsc||'Not provided'}/></RSection>
      <div style={{borderRadius:10,border:'2px solid '+(errors.declaration?'#f87171':'var(--primary)'),padding:'14px 16px',background:errors.declaration?'#fef2f2':'rgba(99,102,241,0.04)',marginTop:4}}>
        <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}>
          <input type="checkbox" name="declaration" checked={formData.declaration} onChange={onChange} style={{marginTop:2,width:15,height:15,accentColor:'var(--primary)',flexShrink:0,cursor:'pointer'}}/>
          <span style={{fontSize:12,color:'var(--text-primary)',lineHeight:1.6}}>I declare that all the information provided is true and accurate to the best of my knowledge. I understand that providing false information may result in rejection of this application or legal action.</span>
        </label>
        {errors.declaration&&<p style={{marginTop:8,fontSize:11,color:'#ef4444',display:'flex',alignItems:'center',gap:4}}><AlertCircle size={11}/>{errors.declaration}</p>}
      </div>
    </div>
  );

  const stepContent=[step1,step2,step3,step4,step5];

  return (
    <div>
      <StepBar current={step}/>
      {globalError&&<div style={{padding:'10px 14px',background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:8,color:'#b91c1c',marginBottom:18,display:'flex',alignItems:'center',gap:8,fontSize:13}}><AlertCircle size={16}/><span>{globalError}</span></div>}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><h3 style={{fontSize:'1rem',fontWeight:700,margin:0}}>Step {step} of {STEPS.length} — {STEPS[step-1].label}</h3></div>
        <div className="card-body">{stepContent[step-1]}</div>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <button type="button" className="btn btn-secondary" onClick={step===1?onCancel:prev} style={{display:'flex',alignItems:'center',gap:6}}><ChevronLeft size={15}/>{step===1?'Cancel':'Back'}</button>
        <div style={{display:'flex',alignItems:'center',gap:6}}>{STEPS.map(s=>(<div key={s.id} style={{borderRadius:999,transition:'all 0.3s',width:s.id===step?20:8,height:8,background:s.id===step?'var(--primary)':s.id<step?'#7c3aed':'var(--border)'}}/>))}</div>
        {step<5?(<button type="button" className="btn btn-primary" onClick={next} style={{display:'flex',alignItems:'center',gap:6}}>Next <ChevronRight size={15}/></button>):(<button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{display:'flex',alignItems:'center',gap:6,background:submitting?undefined:'linear-gradient(135deg,#059669,#10b981)',borderColor:'transparent'}}>{submitting?'Saving...':<><BadgeCheck size={15}/>{isEditing?'Update Vendor':'Register Business'}</>}</button>)}
      </div>
    </div>
  );
};

export default VendorForm;