import {useEffect, useMemo, useRef, useState} from 'react';
import axios from 'axios';
import {ShieldCheck, LockKeyhole, Plus, Search, Eye, EyeOff, Copy, Download, Trash2, LogOut, KeyRound, ArrowUpRight, X, Check, RefreshCw, Pencil, Wand2, Upload, Share2, Activity, ShieldAlert, Gauge, Timer, Lock, HelpCircle, Settings, Calendar, Shield, AlertTriangle, FileText, Skull, Menu, Sun, Moon, History, Monitor, Star, Tag, Hash} from 'lucide-react';
import './App.css';
import './brand.css';
import {Toaster, toast} from 'sonner';
import AdminPanel from './AdminPanel';
import LandingPage from './LandingPage';
import LoadingScreen from './LoadingScreen';
import VaultItems from './VaultItems';
import SettingsPanel from './SettingsPanel';

const API=`${process.env.REACT_APP_BACKEND_URL}/api`;
const client=axios.create({baseURL:API});
const authHeader=(extra={})=>({headers:{Authorization:`Bearer ${localStorage.getItem('vault_token')}`,...extra}});
const copyText=async(text)=>{try{await navigator.clipboard.writeText(text)}catch{const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}};
const hashPin=async(p)=>{const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p+'tp5-pin-salt'));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')};
const formatApiError=detail=>{if(!detail)return 'Something went wrong. Please try again.';if(typeof detail==='string')return detail;if(Array.isArray(detail))return detail.map(e=>e?.msg||String(e)).join(' ');return detail?.msg||String(detail)};
const strengthOf=value=>{let s=0;if(!value)return{label:'Empty',level:'empty',score:0};if(value.length>=8)s++;if(value.length>=12)s++;if(/[A-Z]/.test(value)&&/[a-z]/.test(value))s++;if(/\d/.test(value))s++;if(/[^A-Za-z0-9]/.test(value))s++;if(s<=2)return{label:'Weak',level:'weak',score:28};if(s<=4)return{label:'Fair',level:'fair',score:62};return{label:'Strong',level:'strong',score:100}};
const _WORDS="able also area army back ball band bank base bath bear beat bell best bird bite blue boat body bold bolt bond bone book boot born boss both bowl calm camp card care cart cast cave cell chat chip chop clay clip coal coat code coil cold come cord core corn cost cozy crab crop cure cute dark dawn dear deck deed deep deny desk dice disk dock dome door dove dusk each ease east edge epic even exam face fact fail fall fame farm fast feel fell felt fern firm fish fist flex flip flow foam fold folk fond font foot ford form fort fuel full fund fuse gale game gate gear glow glue goal gold golf grab gulf gust half hall hand hard haze head heat heel helm help hero high hill hint hold hole home hood hook hope horn hour husk icon idea inch iris iron isle jade jest join joke jolt jump just keen keep kick kind king knob lace lamp land lane last late leaf lean lend life lift like lime line link lion list loom loop lore loss loud love luck make mall mane mark mask mass meat meet mesh milk mine mint mode moon more most much mule muse nail name navy neck need nest news nice node none norm nose note null oath obey once only open oval oven over page pair palm part past path pave peak peel pick pier pine ping pipe plan play plot plow plum pole pond pool port pose prep prey pull pump pure push rack rain rank read real reed reef rely rent rest rice rich ride ring risk road role roll roof rope rose rule rush safe sage sail same sand silk sing sink site size skin slam slim snap snow soil sole song sort soul span spin star stay stem step stir stop suit surf swap tale tall tank tape task tear text tick tide time tilt toad toll tomb tool torn town tree trim true tube tuck tusk unit user vast veil view vine volt walk wall wave west wide wild wind wise wish wolf wood word work wrap yell zero zone zoom".split(' ');

function Auth({onLogin}){
  const [mode,setMode]=useState('login');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);
  const [authError,setAuthError]=useState('');
  const [loginStage,setLoginStage]=useState(null);
  const [stageToken,setStageToken]=useState(null);
  const [birthdayInput,setBirthdayInput]=useState('');
  const [quizIndices,setQuizIndices]=useState([]);
  const [quizAnswers,setQuizAnswers]=useState({});
  const [regBirthday,setRegBirthday]=useState('');
  const [regBirthdayConfirm,setRegBirthdayConfirm]=useState('');
  const [loginStatus,setLoginStatus]=useState(null);
  const checkLoginStatus=async(em)=>{if(!em||mode!=='login')return;try{const r=await client.get(`/auth/login-status?email=${encodeURIComponent(em)}`);setLoginStatus(r.data)}catch{setLoginStatus(null)}};

  const submit=async(e)=>{
    e.preventDefault();setBusy(true);setAuthError('');
    try{
      if(mode==='register'){
        if(!regBirthday){toast.error('Birthday is required');setBusy(false);return}
        if(regBirthday!==regBirthdayConfirm){toast.error('Birthdays do not match');setBusy(false);return}
        const r=await client.post('/auth/register',{email,password,birthday:regBirthday});
        localStorage.setItem('vault_token',r.data.token);
        if('credentials' in navigator&&window.PasswordCredential){try{const c=new window.PasswordCredential({id:email,password,name:r.data.user.name});await navigator.credentials.store(c)}catch{}}
        toast.success('Vault created! Your Crypto Type Pass is waiting for you in Settings whenever you want it.');
        onLogin(r.data.user);
      }else{
        const r=await client.post('/auth/login',{email,password});
        if(r.data.stage==='birthday'){
          setStageToken(r.data.token);setLoginStage('birthday');setBirthdayInput('');
        }else{
          localStorage.setItem('vault_token',r.data.token);
          if('credentials' in navigator&&window.PasswordCredential){try{const c=new window.PasswordCredential({id:email,password,name:r.data.user?.name});await navigator.credentials.store(c)}catch{}}
          onLogin(r.data.user);
        }
      }
    }catch(e){const msg=formatApiError(e.response?.data?.detail)||'Could not sign in';setAuthError(msg);toast.error(msg)}finally{setBusy(false)}
  };

  const submitBirthday=async()=>{
    setBusy(true);
    try{
      const r=await client.post('/auth/verify-birthday',{birthday:birthdayInput},{headers:{Authorization:`Bearer ${stageToken}`}});
      if(r.data.stage==='layer3'){
        setStageToken(r.data.token);setQuizIndices(r.data.quiz_indices);setQuizAnswers({});setLoginStage('layer3');
      }else{
        localStorage.setItem('vault_token',r.data.token);onLogin(r.data.user);setLoginStage(null);
      }
    }catch(e){const msg=formatApiError(e.response?.data?.detail)||'Birthday verification failed';setAuthError(msg);toast.error(msg)}finally{setBusy(false)}
  };

  const submitLayer3Quiz=async()=>{
    setBusy(true);
    try{
      const r=await client.post('/auth/verify-layer3',{answers:quizAnswers},{headers:{Authorization:`Bearer ${stageToken}`}});
      localStorage.setItem('vault_token',r.data.token);onLogin(r.data.user);setLoginStage(null);
    }catch(e){const msg=formatApiError(e.response?.data?.detail)||'Layer 3 verification failed';setAuthError(msg);toast.error(msg)}finally{setBusy(false)}
  };

  if(loginStage==='birthday')return(
    <main className="auth-shell"><section className="auth-art"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/></div><div className="art-copy"><p className="eyebrow">LAYER 2 VERIFICATION</p><h1>Verify your<br/><em>identity.</em></h1><p>Enter your birthday to continue. This is a security checkpoint.</p></div><div className="security-stamp"><Calendar size={17}/><span>Birthday verification<br/><b>No forgot option — by design</b></span></div></section>
    <section className="auth-panel"><div className="auth-card"><div className="mobile-brand brand"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/></div>
      <p className="eyebrow">LAYER 2 — BIRTHDAY</p><h2>Confirm your birthday</h2><p className="muted">Enter the exact birthday you registered with. There is no recovery for this.</p>
      <label>Birthday<input data-testid="birthday-verify-input" type="date" value={birthdayInput} onChange={e=>setBirthdayInput(e.target.value)} required/></label>
      <button className="primary wide" data-testid="birthday-verify-submit" disabled={busy||!birthdayInput} onClick={submitBirthday}>{busy?'Verifying…':'Verify Birthday'} <ArrowUpRight size={17}/></button>
      <button className="link-btn" data-testid="birthday-back-btn" onClick={()=>{setLoginStage(null);setStageToken(null)}}>← Back to login</button>
    </div></section><Toaster theme="dark"/></main>
  );

  if(loginStage==='layer3')return(
    <main className="auth-shell"><section className="auth-art"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/></div><div className="art-copy"><p className="eyebrow">LAYER 3 VERIFICATION</p><h1>Crypto<br/><em>Type Pass.</em></h1><p>Answer correctly to access your vault. These are your 5-character crypto passwords.</p></div><div className="security-stamp"><Shield size={17}/><span>Layer 3 crypto type pass<br/><b>Fail = access denied</b></span></div></section>
    <section className="auth-panel"><div className="auth-card"><div className="mobile-brand brand"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/></div>
      <p className="eyebrow">LAYER 3 — CRYPTO TYPE PASS</p><h2>What are your passwords?</h2><p className="muted">Enter the exact 5-character passwords for each position shown below.</p>
      {quizIndices.map(idx=><label key={idx}>Pass #{idx+1}<input data-testid={`quiz-answer-${idx}`} type="text" maxLength={5} value={quizAnswers[String(idx)]||''} onChange={e=>setQuizAnswers(p=>({...p,[String(idx)]:e.target.value}))} placeholder="e.g. k8#mQ" autoComplete="off" style={{fontFamily:"'DM Mono',monospace",letterSpacing:'0.15em'}}/></label>)}
      <button className="primary wide" data-testid="quiz-submit-btn" disabled={busy||quizIndices.some(i=>!(quizAnswers[String(i)]||'').trim())} onClick={submitLayer3Quiz}>{busy?'Verifying…':'Verify & Unlock'} <Lock size={16}/></button>
      <button className="link-btn" data-testid="quiz-back-btn" onClick={()=>{setLoginStage(null);setStageToken(null)}}>← Back to login</button>
    </div></section><Toaster theme="dark"/></main>
  );

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/></div>
        <div className="art-copy"><p className="eyebrow">PRIVATE BY DESIGN</p><h1>Your secrets.<br/><em>Only yours.</em></h1><p>One quiet place for the values that matter. Encrypted before they leave your device.</p></div>
        <div className="security-stamp"><LockKeyhole size={17}/><span>Zero-knowledge architecture<br/><b>Built for calm control</b></span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand brand"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/></div>
          <p className="eyebrow">SECURE ACCESS</p>
          <div className="auth-title-row"><h2>{mode==='login'?'Welcome back':'Create your vault'}</h2><button type="button" className="auth-plus-btn" data-testid="auth-plus-toggle" onClick={()=>{setAuthError('');setMode(mode==='login'?'register':'login')}} title={mode==='login'?'Create account':'Back to login'}>{mode==='login'?<Plus size={18}/>:<Lock size={16}/>}</button></div>
          <p className="muted">{mode==='login'?'Your private command center is waiting.':'Start protecting what matters in under a minute.'}</p>
          <form onSubmit={submit} data-testid="auth-form">
            <label>Email<input data-testid="auth-email-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} onBlur={e=>checkLoginStatus(e.target.value)} required placeholder="you@example.com"/></label>
            <label>Password<input data-testid="auth-password-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength="8" placeholder="At least 8 characters"/></label>
            {mode==='login'&&loginStatus&&loginStatus.hardcore&&<div className="login-attempts-warn" data-testid="login-attempts-warning"><AlertTriangle size={14}/><div><b>Hardcore Mode Active</b><p>Today: {loginStatus.daily_used}/{loginStatus.daily_limit} tries used &bull; Total fails: {loginStatus.total_fails}/{loginStatus.total_limit} &bull; Consecutive days: {loginStatus.consecutive_days}/{loginStatus.days_limit}</p></div></div>}
            {mode==='register'&&<><label>Birthday <span className="birthday-warn">Please enter correctly — used for login verification</span><input data-testid="reg-birthday-input" type="date" value={regBirthday} onChange={e=>setRegBirthday(e.target.value)} required/></label><label>Confirm Birthday<input data-testid="reg-birthday-confirm" type="date" value={regBirthdayConfirm} onChange={e=>setRegBirthdayConfirm(e.target.value)} required/></label></>}
            {mode==='login'&&<p className="birthday-login-hint" data-testid="birthday-hint">Birthday is required. Crypto Type Pass appears only if you turned it on.</p>}
            {mode==='login'&&loginStatus?.layer3_enabled&&<div className="crypto-active-note" data-testid="crypto-pass-active-note"><Shield size={14}/><span>Crypto Type Pass is ON for this vault.</span></div>}
            {authError&&<div className="auth-error-box" data-testid="auth-error-message"><AlertTriangle size={15}/><span>{authError}</span></div>}
            <button className="primary wide" data-testid="auth-submit-button" disabled={busy}>{busy?'Securing…':mode==='login'?'Unlock vault':'Create vault'} <ArrowUpRight size={17}/></button>
          </form>
          <button className="link-btn" data-testid="auth-mode-toggle" onClick={()=>{setAuthError('');setMode(mode==='login'?'register':'login')}}>{mode==='login'?"I don't have an account":"I already have an account"}</button>
        </div>
      </section>
      <Toaster theme="dark"/>
    </main>
  );
}

function Vault({user,onLogout}){
  const inactivityRef=useRef(null);
  const [items,setItems]=useState([]);
  const [query,setQuery]=useState('');
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState(null);
  const [visible,setVisible]=useState({});
  const [values,setValues]=useState({});
  const [form,setForm]=useState({name:'',value:'',category:'Secret',totp_secret:'',url:'',advance_mode:false,advance_passphrase:'',tags:[],favorite:false,notes:'',custom_fields:[]});
  const [showGen,setShowGen]=useState(false);
  const [genOpts,setGenOpts]=useState({length:16,upper:true,lower:true,nums:true,syms:false,mode:'random'});
  const [genPwd,setGenPwd]=useState('');
  const [cat,setCat]=useState('All');
  const [shareModal,setShareModal]=useState(null);
  const [showAudit,setShowAudit]=useState(false);
  const [auditLogs,setAuditLogs]=useState([]);
  const [secReport,setSecReport]=useState(null);
  const [showSec,setShowSec]=useState(false);
  const [categories,setCategories]=useState(['Login','API key','Secret','Secure note','Wi-Fi','Bank']);
  const [breachBadge,setBreachBadge]=useState(0);
  const [breachChecking,setBreachChecking]=useState(false);
  const [breachScanned,setBreachScanned]=useState(false);
  const [showSharePicker,setShowSharePicker]=useState(null);
  const [showAdvancePrompt,setShowAdvancePrompt]=useState(null);
  const [advanceInput,setAdvanceInput]=useState('');
  const [advancePassphrases,setAdvancePassphrases]=useState({});
  const [showShares,setShowShares]=useState(false);
  const [activeShares,setActiveShares]=useState([]);
  const [showSettings,setShowSettings]=useState(false);
  const [showHelp,setShowHelp]=useState(false);
  const [settings,setSettings]=useState({autofill:true});
  const [showPinLock,setShowPinLock]=useState(false);
  const [pinInput,setPinInput]=useState('');
  const [pinError,setPinError]=useState('');
  const [pinEnabled,setPinEnabled]=useState(!!localStorage.getItem('vault_pin_hash'));
  const [loginHistory,setLoginHistory]=useState([]);
  const [historyLoaded,setHistoryLoaded]=useState(false);
  const [advanceGlobalLockUntil,setAdvanceGlobalLockUntil]=useState(user.advance_global_locked_until||null);
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const [showItemProps,setShowItemProps]=useState(null);
  const [showDisclaimer,setShowDisclaimer]=useState(false);
  const [disclaimerEnabled,setDisclaimerEnabled]=useState(user.disclaimer_enabled||false);
  const [showTerms,setShowTerms]=useState(false);
  const [showPrivacy,setShowPrivacy]=useState(false);
  const [showSecuritySettings,setShowSecuritySettings]=useState(false);
  const [l3Passwords,setL3Passwords]=useState(null);
  const [l3Enabled,setL3Enabled]=useState(user.layer3_enabled||false);
  const [showL3View,setShowL3View]=useState(false);
  const [showL3Regen,setShowL3Regen]=useState(false);
  const [l3RegenPwd,setL3RegenPwd]=useState('');
  const [l3QuizMode,setL3QuizMode]=useState(null);
  const [hardcoreData,setHardcoreData]=useState(null);
  const [showBirthdaySetup,setShowBirthdaySetup]=useState(false);
  const [bdaySetup,setBdaySetup]=useState('');
  const [bdaySetupConfirm,setBdaySetupConfirm]=useState('');
  const [hasBirthday,setHasBirthday]=useState(user.has_birthday||false);
  const [duplicateIds,setDuplicateIds]=useState([]);
  const [showHistory,setShowHistory]=useState(null);
  const [historyData,setHistoryData]=useState([]);
  const [tagInput,setTagInput]=useState('');
  // L3 password prompt for viewing when locked
  const [l3ViewPwd,setL3ViewPwd]=useState('');
  const [showL3PwdPrompt,setShowL3PwdPrompt]=useState(false);
  const strength=strengthOf(form.value||'');

  useEffect(()=>{document.documentElement.setAttribute('data-theme',settings.theme||localStorage.getItem('tp5_theme')||'dark')},[settings.theme]);
  useEffect(()=>{setAdvanceGlobalLockUntil(user.advance_global_locked_until||null)},[user.advance_global_locked_until]);

  // PIN inactivity timer
  useEffect(()=>{
    if(!pinEnabled)return;
    const minutes=Number(settings.autoLockMinutes||localStorage.getItem('tp5_auto_lock')||5);
    const reset=()=>{if(inactivityRef.current)clearTimeout(inactivityRef.current);inactivityRef.current=setTimeout(()=>setShowPinLock(true),minutes*60*1000)};
    const events=['mousemove','keydown','click','touchstart'];
    events.forEach(e=>document.addEventListener(e,reset));
    reset();
    return()=>{events.forEach(e=>document.removeEventListener(e,reset));if(inactivityRef.current)clearTimeout(inactivityRef.current)};
  },[pinEnabled,settings.autoLockMinutes]);

  useEffect(()=>{
    if(pinInput.length!==4)return;
    (async()=>{
      const h=await hashPin(pinInput);
      const stored=localStorage.getItem('vault_pin_hash');
      if(h===stored){setShowPinLock(false);setPinInput('');setPinError('')}
      else{setPinError('Wrong PIN — try again');setPinInput('')}
    })()
  },[pinInput]);

  // Wire up globals for child components
  useEffect(()=>{
    window.__showTerms=()=>{setShowTerms(true);setShowSettings(false)};
    window.__showPrivacy=()=>{setShowPrivacy(true);setShowSettings(false)};
    window.__bulkAction=async(action,ids)=>{
      try{
        const r=await client.post('/items/bulk-action',{item_ids:ids,action},authHeader());
        if(action==='delete')toast.success(`${r.data.deleted} item(s) deleted`);
        load();
      }catch(e){toast.error(e.response?.data?.detail||'Bulk action failed')}
    };
    return()=>{delete window.__showTerms;delete window.__showPrivacy;delete window.__bulkAction};
  },[]);

  const load=()=>{
    client.get('/items',authHeader()).then(r=>{setItems(r.data);setTimeout(()=>runBackgroundBreachCheck(r.data),800);loadDuplicates()}).catch(()=>onLogout());
    client.get('/preferences',authHeader()).then(r=>{if(r.data.categories)setCategories(r.data.categories);setSettings(s=>({...s,autofill:typeof r.data.autofill==='boolean'?r.data.autofill:s.autofill,theme:r.data.theme||localStorage.getItem('tp5_theme')||'dark',autoLockMinutes:r.data.autoLockMinutes||Number(localStorage.getItem('tp5_auto_lock'))||5}))}).catch(()=>{});
    client.get('/auth/me',authHeader()).then(r=>setAdvanceGlobalLockUntil(r.data.advance_global_locked_until||null)).catch(()=>{});
  };
  useEffect(()=>{load()},[]);

  const loadDuplicates=async()=>{
    try{
      const r=await client.get('/items/duplicates',authHeader());
      const ids=[];
      (r.data.groups||[]).forEach(g=>g.forEach(i=>ids.push(i.id)));
      setDuplicateIds(ids);
    }catch{}
  };

  const save=async(e)=>{
    e.preventDefault();
    try{
      if(!editing&&form.advance_mode&&!(form.advance_passphrase||'').trim()){toast.error('Advance Mode needs a passphrase');return}
      if(editing&&!editing.advance_mode&&form.advance_mode&&!(form.advance_passphrase||'').trim()){toast.error('Set a passphrase before enabling Advance Mode');return}
      const payload={...form,tags:form.tags||[],custom_fields:form.custom_fields||[]};
      const config=editing?.advance_mode?authHeader({'X-Advance-Passphrase':advancePassphrases[editing.id]||''}):authHeader();
      if(editing) await client.put(`/items/${editing.id}`,payload,config);
      else await client.post('/items',payload,authHeader());
      if(form.category&&!categories.includes(form.category))saveCategory(form.category);
      toast.success(editing?'Item updated':'Item encrypted and saved');
      setShowForm(false);setEditing(null);resetForm();load();
    }catch(e){toast.error(e.response?.data?.detail||'Save failed')}
  };

  const resetForm=()=>setForm({name:'',value:'',category:'Secret',totp_secret:'',url:'',advance_mode:false,advance_passphrase:'',tags:[],favorite:false,notes:'',custom_fields:[]});

  const reveal=async(id)=>{const item=items.find(i=>i.id===id);if(item?.advance_mode){if(visible[id]){setVisible(v=>({...v,[id]:false}));return values[id]||null}setAdvanceInput('');setShowAdvancePrompt({item,action:'reveal'});return null}if(values[id]){setVisible(v=>({...v,[id]:!v[id]}));return values[id]} const r=await client.get(`/items/${id}/value`,authHeader()); setValues(v=>({...v,[id]:r.data.value}));setVisible(v=>({...v,[id]:true}));return r.data.value};

  const copy=async(id)=>{const item=items.find(i=>i.id===id);if(item?.advance_mode){setAdvanceInput('');setShowAdvancePrompt({item,action:'copy'});return}const value=values[id]||await reveal(id);if(!value)return;await copyText(value);toast.success('Copied to clipboard')};

  const remove=async(id)=>{const item=items.find(i=>i.id===id);if(item?.advance_mode){setAdvanceInput('');setShowAdvancePrompt({item,action:'delete'});return}if(window.confirm('Delete this item permanently?')){await client.delete(`/items/${id}`,authHeader());toast.success('Item deleted');load()}};

  const startEdit=async(item)=>{if(item.advance_mode){setAdvanceInput('');setShowAdvancePrompt({item,action:'edit'});return}let v=values[item.id];if(!v){const r=await client.get(`/items/${item.id}/value`,authHeader());v=r.data.value;setValues(p=>({...p,[item.id]:v}))}setEditing(item);setForm({name:item.name,value:v,category:item.category,totp_secret:'',url:item.url||'',advance_mode:item.advance_mode||false,advance_passphrase:'',tags:item.tags||[],favorite:item.favorite||false,notes:item.notes||'',custom_fields:item.custom_fields||[]});setShowForm(true)};

  const submitAdvancePassphrase=async()=>{
    if(!showAdvancePrompt)return;
    const {item,action}=showAdvancePrompt;
    try{
      const passphrase=advanceInput;
      if(action==='delete'){
        if(window.confirm('Delete this item permanently?')){
          await client.delete(`/items/${item.id}`,authHeader({'X-Advance-Passphrase':passphrase}));
          setShowAdvancePrompt(null);
          setAdvanceInput('');
          toast.success('Item deleted');
          load();
        }
        return;
      }
      if(action==='totp'){
        const secret=await client.get(`/items/${item.id}/totp`,authHeader({'X-Advance-Passphrase':passphrase}));
        const code=await getTOTP(secret.data.secret);
        setShowAdvancePrompt(null);
        setAdvanceInput('');
        copyText(code).catch(()=>{});
        toast.success(`OTP: ${code.slice(0,3)} ${code.slice(3)} — copied!`,{duration:6000});
        return;
      }
      const r=await client.post(`/items/${item.id}/advance-reveal`,{passphrase},authHeader());
      const val=r.data.value;
      setValues(p=>({...p,[item.id]:val}));
      setAdvancePassphrases(p=>({...p,[item.id]:passphrase}));
      setShowAdvancePrompt(null);
      setAdvanceInput('');
      if(action==='reveal')setVisible(p=>({...p,[item.id]:true}));
      else if(action==='copy'){
        await copyText(val);
        toast.success('Copied!');
      }else if(action==='edit'){
        setEditing(item);
        setForm({name:item.name,value:val,category:item.category,totp_secret:'',url:item.url||'',advance_mode:true,advance_passphrase:'',tags:item.tags||[],favorite:item.favorite||false,notes:item.notes||'',custom_fields:item.custom_fields||[]});
        setShowForm(true);
      }
    }catch(e){
      const status=e.response?.status;
      const msg=e.response?.data?.detail||'Wrong passphrase';
      if(status===423){
        setShowAdvancePrompt(null);
        setAdvanceInput('');
        load();
      }
      toast.error(msg,{duration:msg.includes('lock')||msg.includes('attempt')?8000:3000});
    }
  };

  const toggleFavorite=async(id)=>{
    try{
      const r=await client.patch(`/items/${id}/favorite`,{},authHeader());
      setItems(prev=>prev.map(i=>i.id===id?{...i,favorite:r.data.favorite}:i));
    }catch{toast.error('Failed to update favorite')}
  };

  const loadShares=async()=>{try{const r=await client.get('/shares',authHeader());setActiveShares(r.data);setShowShares(true)}catch{toast.error('Could not load shares')}};
  const revokeShare=async(token)=>{try{await client.delete(`/shares/${token}`,authHeader());setActiveShares(p=>p.filter(s=>s.token!==token));toast.success('Share revoked')}catch{toast.error('Revoke failed')}};

  const mkPwd=(o)=>{
    if(o.mode==='passphrase'){
      const count=Math.max(3,Math.min(12,Math.floor(o.length/4)));
      return Array.from({length:count},()=>_WORDS[Math.floor(Math.random()*_WORDS.length)]).join('-');
    }
    let c='';if(o.upper)c+='ABCDEFGHIJKLMNOPQRSTUVWXYZ';if(o.lower)c+='abcdefghijklmnopqrstuvwxyz';if(o.nums)c+='0123456789';if(o.syms)c+='!@#$%^&*()-_=+[]{}|;:,.<>?';if(!c)c='abcdefghijklmnopqrstuvwxyz0123456789';return Array.from({length:o.length},()=>c[Math.floor(Math.random()*c.length)]).join('');
  };

  const b32d=s=>{const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,val=0,out=[];for(const c of s.toUpperCase().replace(/[^A-Z2-7]/g,'')){val=(val<<5)|a.indexOf(c);bits+=5;if(bits>=8){out.push((val>>>(bits-8))&0xFF);bits-=8}}return new Uint8Array(out)};
  const getTOTP=async secret=>{const key=b32d(secret);const T=Math.floor(Date.now()/30000);const msg=new Uint8Array(8);new DataView(msg.buffer).setUint32(4,T);const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-1'},false,['sign']);const sig=new Uint8Array(await crypto.subtle.sign('HMAC',k,msg));const o=sig[19]&0xf;return(((sig[o]&0x7f)<<24|(sig[o+1]&0xff)<<16|(sig[o+2]&0xff)<<8|(sig[o+3]&0xff))%1000000).toString().padStart(6,'0')};
  const revealTOTP=async(item)=>{if(item.advance_mode){setAdvanceInput('');setShowAdvancePrompt({item,action:'totp'});return}try{const r=await client.get(`/items/${item.id}/totp`,authHeader());const code=await getTOTP(r.data.secret);copyText(code).catch(()=>{});toast.success(`OTP: ${code.slice(0,3)} ${code.slice(3)} — copied!`,{duration:6000})}catch{toast.error('No TOTP configured')}};

  const sha1hex=async str=>{const buf=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(str));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()};
  const checkBreach=async(item)=>{if(item?.advance_mode){toast.error('Advance Mode items cannot be breach-checked automatically.');return}let val=values[item.id];if(!val){const r=await client.get(`/items/${item.id}/value`,authHeader());val=r.data.value;setValues(p=>({...p,[item.id]:val}))}try{const h=await sha1hex(val);const resp=await fetch(`https://api.pwnedpasswords.com/range/${h.slice(0,5)}`);const text=await resp.text();const found=text.split('\n').find(l=>l.startsWith(h.slice(5)));if(found){toast.error(`Leaked in ${parseInt(found.split(':')[1]).toLocaleString()} breaches!`,{duration:6000})}else{toast.success('Not found in any known breach')}}catch{toast.error('Breach check failed')}};

  const runBackgroundBreachCheck=async(itemList)=>{const scannable=(itemList||[]).filter(i=>!i.advance_mode);if(!scannable.length){setBreachScanned(true);return}setBreachChecking(true);let count=0;for(const item of scannable.slice(0,15)){try{const r=await client.get(`/items/${item.id}/value`,authHeader());const val=r.data.value;setValues(p=>({...p,[item.id]:val}));const h=await sha1hex(val);const resp=await fetch(`https://api.pwnedpasswords.com/range/${h.slice(0,5)}`);const text=await resp.text();if(text.split('\n').find(l=>l.startsWith(h.slice(5))))count++}catch{}await new Promise(r=>setTimeout(r,180))}setBreachBadge(count);setBreachChecking(false);setBreachScanned(true);if(count>0)toast.warning(`${count} item${count>1?'s':''} found in known data breaches — check Security Report`,{duration:8000})};

  const loadSecReport=async()=>{try{const r=await client.get('/security/report',authHeader());setSecReport(r.data);setShowSec(true)}catch{toast.error('Could not load report')}};
  const saveCategory=async newCat=>{if(newCat&&!categories.includes(newCat)){const updated=[...categories,newCat];setCategories(updated);client.put('/preferences',{categories:updated},authHeader()).catch(()=>{})}};
  const saveSettingsPref=async(newSettings)=>{setSettings(newSettings);client.put('/preferences',newSettings,authHeader()).catch(()=>{})};
  const saveTheme=theme=>{localStorage.setItem('tp5_theme',theme);saveSettingsPref({...settings,theme})};
  const saveAutoLock=minutes=>{localStorage.setItem('tp5_auto_lock',String(minutes));saveSettingsPref({...settings,autoLockMinutes:minutes})};
  const loadLoginHistory=async()=>{try{const r=await client.get('/auth/login-history',authHeader());setLoginHistory(r.data);setHistoryLoaded(true)}catch{toast.error('Could not load login history')}};

  const importVault=async(e)=>{const file=e.target.files[0];if(!file)return;try{const raw=JSON.parse(await file.text());const arr=Array.isArray(raw)?raw:[raw];const valid=arr.filter(x=>x.name&&x.value).map(x=>({name:x.name,value:x.value,category:x.category||'Secret'}));if(!valid.length){toast.error('No valid items found in file');e.target.value='';return}await client.post('/items/import',{items:valid},authHeader());toast.success(`${valid.length} item(s) imported`);load()}catch{toast.error('Import failed — check file format')}finally{e.target.value=''}};

  const shareItem=async(item,hours)=>{try{const r=await client.post(`/items/${item.id}/share`,{hours},authHeader());const link=`${window.location.origin}/?share=${r.data.token}`;setShowSharePicker(null);setShareModal({item,link,hours:r.data.hours});toast.success('Share link ready!')}catch(e){toast.error(e.response?.data?.detail||'Share failed')}};
  const loadAudit=async()=>{try{const r=await client.get('/audit',authHeader());setAuditLogs(r.data);setShowAudit(true)}catch{toast.error('Could not load activity')}};

  const exportItem=(item)=>{const data=JSON.stringify({name:item.name,value:values[item.id]||'[reveal before export]',category:item.category},null,2);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download=`${item.name.replace(/\s+/g,'-')}.json`;a.click()};
  const exportAll=async()=>{if(!window.confirm('This will download ALL your secrets in plain text. Continue?'))return;const full=await Promise.all(items.map(async i=>{if(i.advance_mode)return{...i,value:'[Protected — Advance Mode]'};const r=await client.get(`/items/${i.id}/value`,authHeader());return{...i,value:r.data.value}}));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(full,null,2)],{type:'application/json'}));a.download='toppass5-backup.json';a.click();toast.success('Vault backup downloaded')};

  // Layer 3 helpers
  const loadL3Passwords=async(password)=>{
    try{
      const params=new URLSearchParams();
      if(password)params.set('password',password);
      const r=await client.get(`/auth/layer3-passwords?${params}`,authHeader());
      setL3Passwords(r.data.passwords);setL3Enabled(r.data.enabled);return r.data;
    }catch(e){
      if(e.response?.status===403&&e.response?.data?.detail==='PASSWORD_REQUIRED'){
        setShowL3PwdPrompt(true);setShowSettings(false);
        return null;
      }
      toast.error(e.response?.data?.detail||'Could not load Layer 3 data');return null;
    }
  };
  const viewL3=async()=>{
    if(l3Enabled){setShowL3PwdPrompt(true);setShowSettings(false);setL3ViewPwd('');return}
    const d=await loadL3Passwords();
    if(d?.passwords){setShowL3View(true);setShowSettings(false)}
  };
  const submitL3ViewPwd=async()=>{
    const d=await loadL3Passwords(l3ViewPwd);
    if(d?.passwords){setShowL3PwdPrompt(false);setShowL3View(true);setL3ViewPwd('')}
  };
  const exportL3Passwords=async()=>{
    try{const r=await client.get('/auth/layer3-passwords?for_export=true',authHeader());
    const data=r.data;if(!data?.passwords){toast.error('Could not load passwords for export');return}
    const lines=['═══════════════════════════════════════','  TOPPASS5 — LAYER 3 CRYPTO TYPE PASS','═══════════════════════════════════════','','  Keep this file OFFLINE and SECURE.','  You need these passwords to log in.','','───────────────────────────────────────'];
    data.passwords.forEach((p,i)=>lines.push(`  Pass #${String(i+1).padStart(2,'0')}:  ${p}`));
    lines.push('','───────────────────────────────────────',`  Generated: ${new Date().toISOString().slice(0,10)}`,`  Account: ${user.email}`,'  WARNING: Do NOT share this file.','═══════════════════════════════════════');
    const blob=new Blob([lines.join('\n')],{type:'text/plain'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`toppass5-layer3-${Date.now()}.txt`;a.click();URL.revokeObjectURL(a.href);toast.success('Crypto type passwords exported!')}
    catch{toast.error('Export failed')}
  };
  const toggleL3=async(enable)=>{
    if(enable){
      const indices=[];while(indices.length<3){const i=Math.floor(Math.random()*20);if(!indices.includes(i))indices.push(i)}
      indices.sort((a,b)=>a-b);
      setL3QuizMode({indices,answers:{}});
    }else{
      try{await client.post('/auth/toggle-layer3',{enabled:false},authHeader());setL3Enabled(false);toast.success('Layer 3 disabled')}catch(e){toast.error(e.response?.data?.detail||'Failed')}
    }
  };
  const submitL3EnableQuiz=async()=>{
    if(!l3QuizMode)return;
    try{
      await client.post('/auth/toggle-layer3',{enabled:true,quiz_answers:l3QuizMode.answers,quiz_indices:l3QuizMode.indices},authHeader());
      setL3Enabled(true);setL3QuizMode(null);toast.success('Layer 3 enabled! You will be quizzed on login.');
    }catch(e){toast.error(e.response?.data?.detail||'Quiz failed — check your answers')}
  };
  const regenL3=async()=>{
    if(!l3RegenPwd){toast.error('Enter your current password');return}
    try{const r=await client.post('/auth/regenerate-layer3',{password:l3RegenPwd},authHeader());setL3Passwords(r.data.passwords);setShowL3Regen(false);setL3RegenPwd('');setShowL3View(true);toast.success(`New passwords generated! ${r.data.changes_remaining} changes left this month.`)}catch(e){toast.error(e.response?.data?.detail||'Failed to regenerate')}
  };
  const loadHardcore=async()=>{try{const r=await client.get('/auth/hardcore-settings',authHeader());setHardcoreData(r.data)}catch{toast.error('Could not load Hardcore settings')}};
  const saveHardcore=async(newData)=>{
    try{await client.put('/auth/hardcore-settings',newData,authHeader());setHardcoreData(d=>({...d,enabled:newData.enabled,settings:{max_login_fail_days:newData.max_login_fail_days,max_login_fails:newData.max_login_fails,max_daily_tries:newData.max_daily_tries,max_layer3_fails:newData.max_layer3_fails}}));toast.success(newData.enabled?'Hardcore Mode enabled — be careful!':'Hardcore Mode disabled')}catch(e){toast.error(e.response?.data?.detail||'Failed')}
  };
  const toggleDisclaimer=async(enable)=>{
    if(enable&&!disclaimerEnabled){setShowDisclaimer(true)}
    try{await client.post('/auth/toggle-disclaimer',{enabled:enable},authHeader());setDisclaimerEnabled(enable);if(!enable)setShowDisclaimer(false)}catch{toast.error('Failed to update')}
  };
  const saveBirthday=async()=>{
    if(!bdaySetup||!bdaySetupConfirm){toast.error('Both fields required');return}
    if(bdaySetup!==bdaySetupConfirm){toast.error('Birthdays do not match');return}
    if(!window.confirm('Are you sure? Birthday CANNOT be changed once set. There is NO recovery.'))return;
    try{await client.post('/auth/set-birthday',{birthday:bdaySetup},authHeader());setHasBirthday(true);setShowBirthdaySetup(false);setBdaySetup('');setBdaySetupConfirm('');toast.success('Birthday set! You will need it on every login.')}catch(e){toast.error(e.response?.data?.detail||'Failed to set birthday')}
  };
  const isItemLocked=(item)=>item.advance_locked_until&&new Date(item.advance_locked_until)>new Date();
  const hasAdvanceGlobalLock=advanceGlobalLockUntil&&new Date(advanceGlobalLockUntil)>new Date();
  const autoComp=settings.autofill?undefined:'off';

  const clickSecItem=(name)=>{const it=items.find(x=>x.name===name);if(it){setShowSec(false);startEdit(it)}};

  // Password history
  const loadHistory=async(item)=>{
    try{const r=await client.get(`/items/${item.id}/history`,authHeader());setHistoryData(r.data);setShowHistory(item)}catch(e){
      if(e.response?.status===403)toast.error('History not available for Advance Mode items');
      else toast.error('Could not load history');
    }
  };

  // Tag helpers
  const addTag=()=>{const t=tagInput.trim();if(t&&!(form.tags||[]).includes(t)){setForm(f=>({...f,tags:[...(f.tags||[]),t]}));setTagInput('')}};
  const removeTag=(t)=>setForm(f=>({...f,tags:(f.tags||[]).filter(x=>x!==t)}));
  // Custom field helpers
  const addCustomField=()=>setForm(f=>({...f,custom_fields:[...(f.custom_fields||[]),{key:'',value:''}]}));
  const updateCustomField=(idx,field,val)=>setForm(f=>({...f,custom_fields:(f.custom_fields||[]).map((cf,i)=>i===idx?{...cf,[field]:val}:cf)}));
  const removeCustomField=(idx)=>setForm(f=>({...f,custom_fields:(f.custom_fields||[]).filter((_,i)=>i!==idx)}));

  return <div className="app-shell">
    <div className="mobile-topbar" data-testid="mobile-topbar"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/><span className="mobile-topbar-title">TOPPASS5</span><button className="icon-btn mobile-menu-btn" data-testid="mobile-menu-toggle" onClick={()=>setMobileNavOpen(true)}><Menu size={20}/></button></div>
    {mobileNavOpen&&<div className="mobile-nav-drawer" data-testid="mobile-nav-drawer">
      <button className="icon-btn mobile-nav-close" data-testid="mobile-nav-close" onClick={()=>setMobileNavOpen(false)}><X size={20}/></button>
      <div className="mobile-nav-user"><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><div><b>{user.email}</b><small>Personal vault</small></div></div>
      <div className="mobile-nav-item active" data-testid="mobile-vault-nav" onClick={()=>setMobileNavOpen(false)}><KeyRound size={18}/>Vault <span>{items.length}</span></div>
      <div className="mobile-nav-item" data-testid="mobile-activity-nav" onClick={()=>{loadAudit();setMobileNavOpen(false)}}><Activity size={18}/>Activity</div>
      <div className="mobile-nav-item" data-testid="mobile-shares-nav" onClick={()=>{loadShares();setMobileNavOpen(false)}}><Share2 size={18}/>My Share Links</div>
      <div className="mobile-nav-item" data-testid="mobile-security-nav" onClick={()=>{loadSecReport();setMobileNavOpen(false)}}><Gauge size={18}/>Security Report</div>
      <div className="mobile-nav-item" data-testid="mobile-settings-nav" onClick={()=>{setShowSettings(true);setMobileNavOpen(false)}}><Settings size={18}/>Settings</div>
      <div className="mobile-nav-item" data-testid="mobile-help-nav" onClick={()=>{setShowHelp(true);setMobileNavOpen(false)}}><HelpCircle size={18}/>Help &amp; Guide</div>
      <div className="mobile-nav-item danger" data-testid="mobile-logout-nav" onClick={onLogout}><LogOut size={18}/>Log Out</div>
    </div>}
    <aside className="sidebar">
      <div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/></div>
      <div className="side-label">YOUR SPACE</div>
      <div className="nav-active" data-testid="vault-nav"><KeyRound size={17}/>Vault <span data-testid="item-count">{items.length}</span></div>
      <div className="nav-item" data-testid="activity-nav" onClick={loadAudit}><Activity size={17}/>Activity</div>
      <div className="nav-item" data-testid="shares-nav" onClick={loadShares}><Share2 size={17}/>My Share Links</div>
      <div className="nav-item" data-testid="security-report-nav" onClick={loadSecReport}>
        <Gauge size={17}/>Security Report
        {breachChecking?<span className="breach-checking"/>:breachScanned?(<span className={`breach-badge${breachBadge>0?'':' breach-ok'}`} data-testid="breach-badge">{breachBadge>0?breachBadge:'✓'}</span>):null}
      </div>
      <div className="side-label lower">SECURITY</div>
      <div className="nav-item" data-testid="settings-nav" onClick={()=>setShowSettings(true)}><Settings size={17}/>Settings</div>
      <div className="nav-item" data-testid="help-nav" onClick={()=>setShowHelp(true)}><HelpCircle size={17}/>Help &amp; Guide</div>
      <div className="side-note"><span className="status-dot"/>All systems protected</div>
      <div className="side-bottom"><div className="user-pill"><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><div><b data-testid="user-email">{user.email}</b><small>Personal vault</small></div></div><button className="icon-btn" data-testid="logout-button" onClick={onLogout} title="Sign out"><LogOut size={17}/></button></div>
    </aside>

    <main className="vault-main">
      <header className="topbar"><div><p className="eyebrow">PERSONAL VAULT / TODAY</p><h1>Good to see you, {user.name?.split(' ')[0]}</h1></div><div className="top-actions"><label className="secondary top-btn" data-testid="import-button" title="Import from backup JSON"><Upload size={16}/> Import<input type="file" accept=".json" style={{display:'none'}} onChange={importVault}/></label><button className="secondary top-btn" data-testid="export-all-button" onClick={exportAll}><Download size={16}/> Export</button><button className="secondary top-btn" data-testid="generator-button" onClick={()=>{setGenPwd(mkPwd(genOpts));setShowGen(true)}}><Wand2 size={16}/> Generator</button><button className="primary" data-testid="add-item-button" onClick={()=>{setEditing(null);setForm({name:'',value:mkPwd(genOpts),category:'Secret',totp_secret:'',url:'',advance_mode:false,advance_passphrase:'',tags:[],favorite:false,notes:'',custom_fields:[]});setShowForm(true)}}><Plus size={17}/> Add value</button></div></header>
      <section className="metrics"><div><span>Protected values</span><strong data-testid="protected-count">{items.length.toString().padStart(2,'0')}</strong></div><div><span>Security health</span><strong className="green">Excellent <Check size={17}/></strong></div><div><span>Duplicates</span><strong className={duplicateIds.length>0?'dup-warn':'green'} data-testid="dup-metric">{duplicateIds.length>0?duplicateIds.length:'0'} {duplicateIds.length===0&&<Check size={17}/>}</strong></div></section>
      {hasAdvanceGlobalLock&&<div className="login-attempts-warn" data-testid="advance-global-lock-banner"><AlertTriangle size={14}/><div><b>Advance Mode safety block active</b><p>Half of your protected items reached the failure limit, so every Advance Mode item is paused until {new Date(advanceGlobalLockUntil).toLocaleString()}.</p></div></div>}

      <VaultItems
        items={items} query={query} setQuery={setQuery} cat={cat} setCat={setCat} categories={categories}
        visible={visible} values={values}
        onReveal={reveal} onCopy={copy} onDelete={remove} onStartEdit={startEdit}
        onShare={item=>setShowSharePicker(item)} onCheckBreach={checkBreach}
        onExportItem={exportItem} onRevealTOTP={revealTOTP} onShowItemProps={item=>setShowItemProps(item)}
        onToggleFavorite={toggleFavorite} onShowHistory={loadHistory}
        isItemLocked={isItemLocked} duplicateIds={duplicateIds}
        showForm={showForm} setShowForm={setShowForm}
      />
    </main>

    {/* Item Form Modal — Enhanced with Tags, Notes, Custom Fields */}
    {showForm&&<div className="modal-backdrop"><form className="modal item-form-modal" onSubmit={save} data-testid="item-form"><button type="button" className="modal-close icon-btn" data-testid="close-item-modal" onClick={()=>{setShowForm(false);setEditing(null);resetForm()}}><X/></button><p className="eyebrow">{editing?'EDIT VALUE':'NEW VALUE'}</p><h2>{editing?'Update protected value':'Add to your vault'}</h2>
      <label>Name<input data-testid="item-name-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="e.g. Wi-Fi password"/></label>
      <label>Value<div className="gen-row"><textarea data-testid="item-value-input" autoComplete={autoComp} value={form.value} onChange={e=>setForm({...form,value:e.target.value})} required placeholder="Your secret value" rows="4"/><button type="button" className="gen-inline" data-testid="generate-inline-button" onClick={()=>setForm({...form,value:mkPwd(genOpts)})} title="Generate password"><Wand2 size={14}/> Generate</button></div>
        <div className="strength-meter" data-testid="password-strength-meter"><div className="strength-top"><span>Password strength</span><b className={`strength-${strength.level}`} data-testid="password-strength-label">{strength.label}</b></div><div className="strength-track"><div className={`strength-fill strength-${strength.level}`} data-testid="password-strength-bar" style={{width:`${strength.score}%`,backgroundColor:strength.level==='strong'?'var(--green)':strength.level==='fair'?'#f59e0b':strength.level==='weak'?'var(--red)':'transparent'}}/></div></div>
      </label>
      <label>Category<input list="cat-opts" data-testid="item-category-input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="e.g. Login, API key…"/><datalist id="cat-opts">{categories.map(c=><option key={c} value={c}/>)}</datalist></label>

      {/* Tags */}
      <div className="form-section" data-testid="tags-section">
        <label className="form-section-label"><Tag size={13}/> Tags</label>
        <div className="tags-input-row">
          <input data-testid="tag-input" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTag()}}} placeholder="Add tag and press Enter"/>
          <button type="button" className="tag-add-btn" data-testid="tag-add-btn" onClick={addTag}><Plus size={14}/></button>
        </div>
        {(form.tags||[]).length>0&&<div className="form-tags">{form.tags.map(t=><span key={t} className="form-tag" data-testid={`form-tag-${t}`}>{t}<button type="button" onClick={()=>removeTag(t)}><X size={10}/></button></span>)}</div>}
      </div>

      {/* Favorite */}
      <label className="fav-toggle-form" data-testid="favorite-toggle">
        <input type="checkbox" checked={form.favorite||false} onChange={e=>setForm({...form,favorite:e.target.checked})}/>
        <Star size={14}/> Mark as favorite
      </label>

      {/* Notes */}
      <label>Notes <span className="muted-sm">(optional)</span>
        <textarea data-testid="item-notes-input" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Add private notes about this item..." rows="3" className="notes-textarea"/>
      </label>

      {/* Custom Fields */}
      <div className="form-section" data-testid="custom-fields-section">
        <div className="form-section-header"><label className="form-section-label"><Hash size={13}/> Custom Fields</label><button type="button" className="cf-add-btn" data-testid="add-custom-field" onClick={addCustomField}><Plus size={13}/> Add field</button></div>
        {(form.custom_fields||[]).map((cf,i)=>(
          <div key={i} className="cf-row" data-testid={`custom-field-${i}`}>
            <input placeholder="Label" value={cf.key} onChange={e=>updateCustomField(i,'key',e.target.value)} className="cf-key"/>
            <input placeholder="Value" value={cf.value} onChange={e=>updateCustomField(i,'value',e.target.value)} className="cf-value"/>
            <button type="button" className="cf-remove" onClick={()=>removeCustomField(i)}><X size={13}/></button>
          </div>
        ))}
      </div>

      <label>Authenticator Secret (TOTP) — optional<input data-testid="item-totp-input" type="text" value={form.totp_secret||''} onChange={e=>setForm({...form,totp_secret:e.target.value})} placeholder="Base32 secret e.g. JBSWY3DPEHPK3PXP"/></label>
      <div className="advance-toggle"><label className="advance-check"><input type="checkbox" data-testid="advance-mode-toggle" checked={form.advance_mode||false} onChange={e=>setForm({...form,advance_mode:e.target.checked,advance_passphrase:''})}/><Lock size={14}/> Enable Advance Mode</label>{form.advance_mode&&<label className="advance-pass">Secret Passphrase (you must remember this — no recovery)<input data-testid="advance-passphrase-input" type="password" autoComplete="new-password" value={form.advance_passphrase||''} onChange={e=>setForm({...form,advance_passphrase:e.target.value})} placeholder="e.g. elephant892"/></label>}</div>
      <button className="primary wide" data-testid="save-item-button">{editing?'Save changes':'Encrypt & save'} <LockKeyhole size={16}/></button>
    </form></div>}

    {/* Password Generator Pro */}
    {showGen&&<div className="modal-backdrop"><div className="modal gen-modal" data-testid="generator-modal"><button type="button" className="modal-close icon-btn" data-testid="close-generator" onClick={()=>setShowGen(false)}><X/></button><p className="eyebrow">SECURITY TOOL</p><h2>Password Generator</h2>
      <div className="gen-mode-tabs">
        <button type="button" className={genOpts.mode!=='passphrase'?'active':''} data-testid="gen-mode-random" onClick={()=>{const o={...genOpts,mode:'random'};setGenOpts(o);setGenPwd(mkPwd(o))}}>Random</button>
        <button type="button" className={genOpts.mode==='passphrase'?'active':''} data-testid="gen-mode-passphrase" onClick={()=>{const o={...genOpts,mode:'passphrase'};setGenOpts(o);setGenPwd(mkPwd(o))}}>Passphrase</button>
      </div>
      <div className="gen-output" data-testid="generated-password">{genPwd||'—'}</div>
      <div className="gen-controls">
        <label className="gen-option">Length: <b>{genOpts.length}</b><input type="range" min="8" max="64" value={genOpts.length} onChange={e=>{const o={...genOpts,length:+e.target.value};setGenOpts(o);setGenPwd(mkPwd(o))}}/></label>
        {genOpts.mode!=='passphrase'&&<><label className="gen-option"><input type="checkbox" checked={genOpts.upper} onChange={e=>{const o={...genOpts,upper:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> A–Z Uppercase</label>
        <label className="gen-option"><input type="checkbox" checked={genOpts.lower} onChange={e=>{const o={...genOpts,lower:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> a–z Lowercase</label>
        <label className="gen-option"><input type="checkbox" checked={genOpts.nums} onChange={e=>{const o={...genOpts,nums:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> 0–9 Numbers</label>
        <label className="gen-option"><input type="checkbox" checked={genOpts.syms} onChange={e=>{const o={...genOpts,syms:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> !@# Symbols</label></>}
      </div>
      <div className="gen-actions"><button type="button" className="secondary" data-testid="regenerate-button" onClick={()=>setGenPwd(mkPwd(genOpts))}><RefreshCw size={15}/> Regenerate</button><button type="button" className="primary" data-testid="copy-generated-button" onClick={()=>{copyText(genPwd);toast.success('Password copied!')}}><Copy size={15}/> Copy</button></div>
    </div></div>}

    {/* Advance Mode Prompt */}
    {showAdvancePrompt&&<div className="modal-backdrop"><div className="modal adv-modal" data-testid="advance-prompt-modal"><button type="button" className="modal-close icon-btn" data-testid="advance-prompt-close" onClick={()=>{setShowAdvancePrompt(null);setAdvanceInput('')}}><X/></button><p className="eyebrow">ADVANCE MODE</p><h2><Lock size={18}/> Enter Passphrase</h2><p className="muted">This item is locked with an extra passphrase. Enter it to proceed.</p><p className="muted" data-testid="advance-prompt-limit-note">4 wrong tries lock only this item. If 50% of your Advance Mode items get locked, all Advance Mode items pause for 3 days.</p><input data-testid="advance-passphrase-field" type="password" className="adv-input" value={advanceInput} onChange={e=>setAdvanceInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&advanceInput.trim()&&submitAdvancePassphrase()} placeholder="Your secret passphrase" autoFocus/><button className="primary wide" data-testid="advance-submit-button" disabled={!advanceInput.trim()} onClick={submitAdvancePassphrase}><Lock size={15}/> Unlock</button></div></div>}

    {/* My Share Links */}
    {showShares&&<div className="modal-backdrop"><div className="modal shares-modal" data-testid="my-shares-modal"><button type="button" className="modal-close icon-btn" data-testid="close-shares-modal" onClick={()=>setShowShares(false)}><X/></button><p className="eyebrow">ACTIVE LINKS</p><h2>My Share Links</h2><p className="muted" style={{fontSize:'12px',marginBottom:'12px'}}>To create a share link: click the <Share2 size={11} style={{display:'inline',verticalAlign:'middle'}}/> icon on any vault item.</p>{activeShares.length===0?<p className="muted">No active share links yet.</p>:<div className="shares-list">{activeShares.map((s,i)=><div key={i} className="share-row" data-testid={`share-row-${i}`}><div><b className="share-item-name">{s.item_name}</b><span className="share-exp">Expires {new Date(s.expires).toLocaleString()}</span></div><button className="icon-btn danger" data-testid={`revoke-share-${i}`} onClick={()=>revokeShare(s.token)} title="Revoke"><Trash2 size={15}/></button></div>)}</div>}</div></div>}

    {/* Share Picker */}
    {showSharePicker&&<div className="modal-backdrop"><div className="modal share-picker-modal" data-testid="share-picker-modal"><button type="button" className="modal-close icon-btn" data-testid="close-share-picker" onClick={()=>setShowSharePicker(null)}><X/></button><p className="eyebrow">SECURE SHARE</p><h2>Share "{showSharePicker.name}"</h2><p className="muted">Choose how long the link stays active:</p><div className="expiry-options">{[{h:1,label:'1 hour'},{h:12,label:'12 hours'},{h:24,label:'24 hours'},{h:168,label:'7 days'}].map(opt=><button key={opt.h} className="expiry-btn" data-testid={`expiry-${opt.h}h`} onClick={()=>shareItem(showSharePicker,opt.h)}>{opt.label}</button>)}</div></div></div>}

    {/* Share Link Display */}
    {shareModal&&<div className="modal-backdrop"><div className="modal" data-testid="share-modal"><button type="button" className="modal-close icon-btn" data-testid="close-share-modal" onClick={()=>setShareModal(null)}><X/></button><p className="eyebrow">SECURE SHARE</p><h2>Share "{shareModal.item.name}"</h2><p className="muted">This link expires in {shareModal.hours} hours.</p><div className="share-link-box" data-testid="share-link-display">{shareModal.link}</div><button className="primary wide" data-testid="copy-share-link-button" onClick={()=>{copyText(shareModal.link);toast.success('Link copied!')}}><Copy size={15}/> Copy link</button></div></div>}

    {/* Security Report */}
    {showSec&&secReport&&<div className="modal-backdrop"><div className="modal sec-modal" data-testid="security-report-modal"><button type="button" className="modal-close icon-btn" data-testid="close-sec-modal" onClick={()=>setShowSec(false)}><X/></button><p className="eyebrow">VAULT HEALTH</p><h2>Security Report</h2><div className="sec-score-ring" data-testid="security-score"><span className="sec-score-num" style={{color:secReport.score>=80?'var(--green)':secReport.score>=50?'#fbbf24':'var(--red)'}}>{secReport.score}</span><span className="sec-score-label">/ 100</span></div><div className="sec-stats"><div className="sec-stat"><span className="sec-stat-n" style={{color:'var(--green)'}}>{secReport.total}</span><span>Total items</span></div><div className="sec-stat"><span className="sec-stat-n" style={{color:secReport.weak.length?'var(--red)':'var(--green)'}}>{secReport.weak.length}</span><span>Weak (&lt;10 chars)</span></div><div className="sec-stat"><span className="sec-stat-n" style={{color:secReport.reused.length?'#fbbf24':'var(--green)'}}>{secReport.reused.length}</span><span>Reused</span></div><div className="sec-stat"><span className="sec-stat-n" style={{color:secReport.old.length?'#fbbf24':'var(--green)'}}>{secReport.old.length}</span><span>Old (90d+)</span></div></div>
      {secReport.weak.length>0&&<div className="sec-list"><p className="sec-list-title danger-text">Weak passwords — click to fix</p>{secReport.weak.map((n,i)=><div key={i} className="sec-item sec-item-btn" data-testid={`weak-item-${i}`} onClick={()=>clickSecItem(n)}>{n} <Pencil size={11}/></div>)}</div>}
      {secReport.reused.length>0&&<div className="sec-list"><p className="sec-list-title warn-text">Reused passwords — click to fix</p>{secReport.reused.map((names,i)=><div key={i} className="sec-item">{names.map((n,j)=><span key={j} className="sec-item-btn" onClick={()=>clickSecItem(n)}>{n}{j<names.length-1?', ':''}</span>)}</div>)}</div>}
      {secReport.old.length>0&&<div className="sec-list"><p className="sec-list-title warn-text">Not updated in 90+ days — click to fix</p>{secReport.old.map((n,i)=><div key={i} className="sec-item sec-item-btn" data-testid={`old-item-${i}`} onClick={()=>clickSecItem(n)}>{n} <Pencil size={11}/></div>)}</div>}
      <button type="button" className="secondary wide" data-testid="recheck-breach-button" onClick={()=>runBackgroundBreachCheck(items)} style={{marginTop:'16px'}}><ShieldAlert size={15}/> Re-check all for breaches</button>
    </div></div>}

    {/* Audit Log */}
    {showAudit&&<div className="modal-backdrop"><div className="modal audit-modal" data-testid="audit-modal"><button type="button" className="modal-close icon-btn" data-testid="close-audit-modal" onClick={()=>setShowAudit(false)}><X/></button><p className="eyebrow">SECURITY</p><h2>Activity Log</h2>{auditLogs.length===0?<p className="muted">No activity yet.</p>:<div className="audit-list">{auditLogs.map((e,i)=><div key={i} className="audit-row" data-testid={`audit-row-${i}`}><span className={`audit-badge ab-${e.action.toLowerCase()}`}>{e.action}</span><span className="audit-detail">{e.detail||'—'}</span><span className="audit-time">{new Date(e.ts).toLocaleString()}</span></div>)}</div>}</div></div>}

    {/* Settings Panel */}
    {showSettings&&<SettingsPanel
      user={user} settings={settings} onSaveSettings={saveSettingsPref} onSaveTheme={saveTheme} onSaveAutoLock={saveAutoLock} onLogout={onLogout} onClose={()=>setShowSettings(false)}
      pinEnabled={pinEnabled}
      onSetupPin={async(pin)=>{const h=await hashPin(pin);localStorage.setItem('vault_pin_hash',h);setPinEnabled(true);toast.success('PIN lock enabled!')}}
      onDisablePin={()=>{localStorage.removeItem('vault_pin_hash');setPinEnabled(false);setShowPinLock(false);if(inactivityRef.current)clearTimeout(inactivityRef.current);toast.success('PIN lock disabled')}}
      l3Enabled={l3Enabled} onToggleL3={toggleL3} onExportL3={exportL3Passwords} onRegenL3={()=>{setShowL3Regen(true);setShowSettings(false)}}
      onOpenHardcore={async()=>{await loadHardcore();setShowSecuritySettings(true);setShowSettings(false)}}
      hasBirthday={hasBirthday} onSetupBirthday={()=>{setShowBirthdaySetup(true);setShowSettings(false)}}
      disclaimerEnabled={disclaimerEnabled} onToggleDisclaimer={toggleDisclaimer}
      loginHistory={loginHistory} onLoadHistory={loadLoginHistory} historyLoaded={historyLoaded}
    />}

    {/* L3 Password View Prompt (when L3 enabled) */}
    {showL3PwdPrompt&&<div className="modal-backdrop"><div className="modal" data-testid="l3-pwd-prompt-modal">
      <button type="button" className="modal-close icon-btn" onClick={()=>{setShowL3PwdPrompt(false);setL3ViewPwd('')}}><X/></button>
      <p className="eyebrow">LAYER 3 — LOCKED</p><h2><Lock size={18}/> Enter Password</h2>
      <p className="muted">Layer 3 is enabled. Enter your account password to view your crypto passwords.</p>
      <label>Account Password<input data-testid="l3-view-pwd-input" type="password" value={l3ViewPwd} onChange={e=>setL3ViewPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitL3ViewPwd()} placeholder="Your account password"/></label>
      <button className="primary wide" data-testid="l3-view-pwd-submit" onClick={submitL3ViewPwd} disabled={!l3ViewPwd}><Lock size={15}/> Unlock & View</button>
    </div></div>}

    {/* L3 Quiz to Enable */}
    {l3QuizMode&&<div className="modal-backdrop"><div className="modal" data-testid="l3-enable-quiz-modal"><button type="button" className="modal-close icon-btn" onClick={()=>setL3QuizMode(null)}><X/></button><p className="eyebrow">LAYER 3 VERIFICATION</p><h2>Prove you know your passwords</h2><p className="muted">Enter the exact passwords for these positions to enable Layer 3.</p>
      {l3QuizMode.indices.map(idx=><label key={idx}>Pass #{idx+1}<input data-testid={`l3-enable-quiz-${idx}`} type="text" maxLength={5} value={l3QuizMode.answers[String(idx)]||''} onChange={e=>setL3QuizMode(p=>({...p,answers:{...p.answers,[String(idx)]:e.target.value}}))} placeholder="e.g. k8#mQ" autoComplete="off" style={{fontFamily:"'DM Mono',monospace",letterSpacing:'0.15em'}}/></label>)}
      <button className="primary wide" data-testid="l3-enable-quiz-submit" onClick={submitL3EnableQuiz} disabled={l3QuizMode.indices.some(i=>!(l3QuizMode.answers[String(i)]||'').trim())}><Lock size={15}/> Enable Layer 3</button>
    </div></div>}

    {/* L3 Passwords View */}
    {showL3View&&l3Passwords&&<div className="modal-backdrop"><div className="modal l3-view-modal" data-testid="l3-view-modal"><button type="button" className="modal-close icon-btn" onClick={()=>setShowL3View(false)}><X/></button><p className="eyebrow">LAYER 3 — YOUR PASSWORDS</p><h2>20 Crypto Type Passwords</h2><p className="muted">Keep these safe. You'll be quizzed on random ones during login.</p>
      <div className="l3-grid" data-testid="l3-view-grid">{l3Passwords.map((p,i)=><div key={i} className="l3-pass-card"><span className="l3-num">{i+1}</span><span className="l3-val">{p}</span></div>)}</div>
      <button className="secondary wide" style={{marginTop:'12px'}} data-testid="copy-l3-all" onClick={()=>{copyText(l3Passwords.map((p,i)=>`${i+1}: ${p}`).join('\n'));toast.success('All 20 passwords copied!')}}><Copy size={14}/> Copy All</button>
    </div></div>}

    {/* L3 Regenerate */}
    {showL3Regen&&<div className="modal-backdrop"><div className="modal" data-testid="l3-regen-modal"><button type="button" className="modal-close icon-btn" onClick={()=>{setShowL3Regen(false);setL3RegenPwd('')}}><X/></button><p className="eyebrow">REGENERATE PASSWORDS</p><h2>New Crypto Type Passwords</h2><p className="muted">This generates 20 new random passwords. Max 3 changes per month. Layer 3 must be disabled first.</p>
      <label>Confirm Your Password<input data-testid="l3-regen-pwd" type="password" value={l3RegenPwd} onChange={e=>setL3RegenPwd(e.target.value)} placeholder="Enter your account password"/></label>
      <button className="primary wide" data-testid="l3-regen-submit" onClick={regenL3} disabled={!l3RegenPwd}><RefreshCw size={15}/> Generate New Passwords</button>
    </div></div>}

    {/* Birthday Setup */}
    {showBirthdaySetup&&<div className="modal-backdrop"><div className="modal" data-testid="birthday-setup-modal"><button type="button" className="modal-close icon-btn" onClick={()=>{setShowBirthdaySetup(false);setBdaySetup('');setBdaySetupConfirm('')}}><X/></button><p className="eyebrow">LAYER 2 SETUP</p><h2>Set Your Birthday</h2>
      <p className="muted">This adds Layer 2 protection. You'll need to verify your birthday on every login. <b style={{color:'var(--red)'}}>This cannot be changed later.</b></p>
      <label>Birthday<input data-testid="bday-setup-input" type="date" value={bdaySetup} onChange={e=>setBdaySetup(e.target.value)} required/></label>
      <label>Confirm Birthday<input data-testid="bday-setup-confirm" type="date" value={bdaySetupConfirm} onChange={e=>setBdaySetupConfirm(e.target.value)} required/></label>
      <button className="primary wide" data-testid="bday-setup-submit" onClick={saveBirthday} disabled={!bdaySetup||!bdaySetupConfirm}><Calendar size={15}/> Set Birthday Permanently</button>
    </div></div>}

    {/* Hardcore Mode Settings */}
    {showSecuritySettings&&hardcoreData&&<div className="modal-backdrop"><div className="modal hardcore-modal" data-testid="hardcore-modal"><button type="button" className="modal-close icon-btn" onClick={()=>setShowSecuritySettings(false)}><X/></button><p className="eyebrow">DANGER ZONE</p><h2><Skull size={20}/> Hardcore Mode</h2>
      <p className="muted" style={{color:'#ff6b74'}}>When enabled, temporary lockouts are bypassed and your account plus ALL saved passwords are PERMANENTLY DELETED the moment these limits are reached.</p>
      <div className="settings-row" style={{marginTop:'16px'}}><div className="settings-info"><b>Enable Hardcore Mode</b></div><label className="toggle-switch"><input type="checkbox" checked={hardcoreData.enabled} onChange={e=>{if(e.target.checked&&!window.confirm('Are you sure? This will permanently delete your account if you fail too many times.'))return;saveHardcore({...hardcoreData.settings,enabled:e.target.checked})}}/><span className="toggle-slider"/></label></div>
      <div className="hardcore-limits">
        <label>Max consecutive fail days<input data-testid="hc-fail-days" type="number" min="1" max="30" value={hardcoreData.settings.max_login_fail_days} onChange={e=>setHardcoreData(d=>({...d,settings:{...d.settings,max_login_fail_days:+e.target.value}}))}/></label>
        <label>Max total login failures<input data-testid="hc-total-fails" type="number" min="4" max="100" value={hardcoreData.settings.max_login_fails} onChange={e=>setHardcoreData(d=>({...d,settings:{...d.settings,max_login_fails:+e.target.value}}))}/></label>
        <label>Max tries per day<input data-testid="hc-daily-tries" type="number" min="1" max="20" value={hardcoreData.settings.max_daily_tries} onChange={e=>setHardcoreData(d=>({...d,settings:{...d.settings,max_daily_tries:+e.target.value}}))}/></label>
        <label>Max Layer 3 failures<input data-testid="hc-l3-fails" type="number" min="1" max="50" value={hardcoreData.settings.max_layer3_fails} onChange={e=>setHardcoreData(d=>({...d,settings:{...d.settings,max_layer3_fails:+e.target.value}}))}/></label>
      </div>
      <button className="primary wide" data-testid="hc-save-btn" style={{marginTop:'12px'}} onClick={()=>saveHardcore({...hardcoreData.settings,enabled:hardcoreData.enabled})}>Save Hardcore Settings</button>
      {hardcoreData.failed_logins&&<div className="hc-status" style={{marginTop:'16px',padding:'12px',background:'rgba(255,107,116,.08)',border:'1px solid rgba(255,107,116,.2)',borderRadius:'8px',fontSize:'12px',color:'var(--muted)'}}>
        <b style={{color:'var(--text)',display:'block',marginBottom:'6px'}}>Current Failure Status</b>
        <span>Total fails: {hardcoreData.failed_logins.count||0}</span><br/>
        <span>Consecutive fail days: {hardcoreData.failed_logins.consecutive_days||0}</span><br/>
        <span>Layer 3 fails: {hardcoreData.failed_logins.layer3_fails||0}</span>
      </div>}
    </div></div>}

    {/* Disclaimer */}
    {showDisclaimer&&<div className="modal-backdrop" style={{zIndex:10}}><div className="modal disclaimer-modal" data-testid="disclaimer-modal">
      <div style={{textAlign:'center',marginBottom:'16px'}}><AlertTriangle size={40} style={{color:'#fbbf24'}}/></div>
      <h2 style={{textAlign:'center'}}>Important Disclaimer</h2>
      <div className="disclaimer-text" data-testid="disclaimer-text">
        <p>By using TopPass5, you acknowledge and agree to the following:</p>
        <ul><li>TopPass5 stores your passwords with AES encryption on our servers.</li><li><b>If any password is leaked, we are not responsible.</b></li><li>You are solely responsible for keeping your credentials safe.</li><li>There is NO password recovery mechanism.</li><li>Hardcore Mode can permanently delete your account.</li></ul>
        <p style={{fontWeight:'600',color:'var(--red)'}}>By clicking "I Understand & Accept", you agree to these terms.</p>
      </div>
      <button className="primary wide" data-testid="disclaimer-accept-btn" onClick={()=>setShowDisclaimer(false)} style={{marginTop:'12px'}}><Check size={16}/> I Understand & Accept</button>
    </div></div>}

    {/* Terms */}
    {showTerms&&<div className="modal-backdrop"><div className="modal legal-modal" data-testid="terms-modal" style={{maxHeight:'88vh',overflowY:'auto'}}><button type="button" className="modal-close icon-btn" onClick={()=>setShowTerms(false)}><X/></button><p className="eyebrow">LEGAL</p><h2>Terms & Conditions</h2><div className="legal-text">
      <p><b>1. Service Description</b><br/>TopPass5 is a password and secure value management service that provides AES-encrypted storage.</p>
      <p><b>2. User Responsibilities</b><br/>You are responsible for maintaining the confidentiality of your account credentials.</p>
      <p><b>3. No Liability for Leaks</b><br/>TopPass5 assumes NO liability for any data breaches or unauthorized access. Use at your own risk.</p>
      <p><b>4. Account Deletion</b><br/>Hardcore Mode may permanently delete your account upon exceeding failure thresholds.</p>
      <p><b>5. No Recovery</b><br/>There is no forgot password mechanism for Layer 1 or Layer 2.</p>
      <p><b>6. Service Changes</b><br/>We reserve the right to modify or discontinue the service at any time.</p>
    </div></div></div>}

    {/* Privacy */}
    {showPrivacy&&<div className="modal-backdrop"><div className="modal legal-modal" data-testid="privacy-modal" style={{maxHeight:'88vh',overflowY:'auto'}}><button type="button" className="modal-close icon-btn" onClick={()=>setShowPrivacy(false)}><X/></button><p className="eyebrow">LEGAL</p><h2>Privacy Policy</h2><div className="legal-text">
      <p><b>1. Data Collection</b><br/>We collect your email, hashed password, hashed birthday, and encrypted vault data.</p>
      <p><b>2. Encryption</b><br/>All vault items are encrypted with AES (Fernet) before storage.</p>
      <p><b>3. Data Usage</b><br/>Your data is used solely to provide the vault service.</p>
      <p><b>4. Data Retention</b><br/>Data is retained for as long as your account is active.</p>
      <p><b>5. Security Measures</b><br/>We employ HTTPS, AES encryption, bcrypt, JWT, and multi-layer verification.</p>
    </div></div></div>}

    {/* Help */}
    {showHelp&&<div className="modal-backdrop"><div className="modal help-modal" data-testid="help-modal"><button type="button" className="modal-close icon-btn" data-testid="close-help" onClick={()=>setShowHelp(false)}><X/></button><p className="eyebrow">FEATURE GUIDE</p><h2>TopPass5 — Complete Guide</h2><div className="help-content">
      <div className="help-section"><div className="help-sec-icon"><LockKeyhole size={18}/></div><div><h3>Vault Items</h3><p>Store any secret — passwords, API keys, notes. Every value is AES-encrypted. Use Reveal, Copy, Edit, Delete from the action icons.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Star size={18}/></div><div><h3>Favorites & Tags</h3><p>Star your most-used items for quick access. Add tags to organize and filter your vault. Use the search bar to find items by name, tag, or notes.</p></div></div>
      <div className="help-section help-section-adv"><div className="help-sec-icon adv-icon"><Lock size={18}/></div><div><h3>Advance Mode</h3><p>Extra passphrase lock for your most sensitive items. 4-attempt lockout, no recovery.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Share2 size={18}/></div><div><h3>Secure Share Links</h3><p>Create time-limited links to share any non-Advance item.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><History size={18}/></div><div><h3>Password History</h3><p>Track the last 10 password changes for any item. Click the clock icon on vault items to view history.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><ShieldAlert size={18}/></div><div><h3>Breach & Duplicate Detection</h3><p>Auto-checks passwords against HaveIBeenPwned. DUP badge shows when multiple items share the same password.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Gauge size={18}/></div><div><h3>Security Report</h3><p>Vault health score 0–100. Detects weak, reused, and old passwords.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Settings size={18}/></div><div><h3>Settings</h3><p>Theme, PIN Lock, Auto-Lock Timer, Layer 3 management, Hardcore Mode, and more.</p></div></div>
    </div></div></div>}

    {/* Item Properties Modal — Enhanced with Tags, Notes, Custom Fields */}
    {showItemProps&&<div className="modal-backdrop"><div className="modal item-props-modal" data-testid="item-props-modal"><button type="button" className="modal-close icon-btn" onClick={()=>setShowItemProps(null)}><X/></button><p className="eyebrow">ITEM PROPERTIES</p><h2>{showItemProps.name}</h2><div className="props-grid">
      <div className="prop-row"><span>Category</span><b>{showItemProps.category}</b></div>
      <div className="prop-row"><span>Favorite</span><b>{showItemProps.favorite?<span style={{color:'var(--blue)'}}><Star size={13}/> Yes</span>:'No'}</b></div>
      <div className="prop-row"><span>Tags</span><b>{(showItemProps.tags||[]).length>0?showItemProps.tags.join(', '):<span className="muted-sm">None</span>}</b></div>
      <div className="prop-row"><span>Advance Mode</span><b>{showItemProps.advance_mode?<span className="adv-badge"><Lock size={11}/> {isItemLocked(showItemProps)?'Locked':'Active'}</span>:<span className="muted-sm">Off</span>}</b></div>
      <div className="prop-row"><span>TOTP</span><b>{showItemProps.has_totp?'Configured':'Not set'}</b></div>
      <div className="prop-row"><span>Created</span><b>{new Date(showItemProps.created_at).toLocaleDateString()}</b></div>
      <div className="prop-row"><span>Last updated</span><b>{new Date(showItemProps.updated_at).toLocaleDateString()}</b></div>
      {(showItemProps.notes||'').trim()&&<div className="prop-row prop-notes"><span>Notes</span><p className="prop-notes-text">{showItemProps.notes}</p></div>}
      {(showItemProps.custom_fields||[]).length>0&&<><div className="prop-divider">Custom Fields</div>{showItemProps.custom_fields.map((cf,i)=><div key={i} className="prop-row"><span>{cf.key}</span><b>{cf.value}</b></div>)}</>}
    </div><button className="primary wide" data-testid="props-edit-button" onClick={()=>{setShowItemProps(null);startEdit(showItemProps)}}><Pencil size={15}/> Edit This Item</button></div></div>}

    {/* Password History Modal */}
    {showHistory&&<div className="modal-backdrop"><div className="modal" data-testid="password-history-modal"><button type="button" className="modal-close icon-btn" onClick={()=>{setShowHistory(null);setHistoryData([])}}><X/></button><p className="eyebrow">PASSWORD HISTORY</p><h2>{showHistory.name}</h2>
      <p className="muted">Previous values for this item (most recent first).</p>
      {historyData.length===0?<p className="muted" style={{marginTop:'16px'}}>No password changes recorded yet.</p>:
      <div className="history-list">{historyData.map((h,i)=>(
        <div key={h.id} className="history-row" data-testid={`history-row-${i}`}>
          <div className="history-meta"><span>{new Date(h.changed_at).toLocaleString()}</span></div>
          <div className="history-value">{h.value}</div>
          <button className="icon-btn" onClick={()=>{copyText(h.value);toast.success('Old value copied!')}}><Copy size={14}/></button>
        </div>
      ))}</div>}
    </div></div>}

    {/* PIN Lock Screen */}
    {showPinLock&&<div className="pin-lock-overlay" data-testid="pin-lock-screen"><div className="pin-lock-card"><div className="pin-lock-icon"><LockKeyhole size={36}/></div><h2>Vault Locked</h2><p>Enter your 4-digit PIN to continue</p><div className="pin-dots">{[0,1,2,3].map(i=><div key={i} className={`pin-dot${pinInput.length>i?' filled':''}`}/>)}</div><div className="pin-numpad">{[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k,i)=><button key={i} className={`pin-key${k===''?' pin-key-empty':''}`} disabled={k===''} data-testid={typeof k==='number'?`pin-key-${k}`:k==='⌫'?'pin-key-del':undefined} onClick={()=>k==='⌫'?setPinInput(p=>p.slice(0,-1)):typeof k==='number'&&setPinInput(p=>p.length<4?p+String(k):p)}>{k}</button>)}</div>{pinError&&<p className="pin-error" data-testid="pin-error">{pinError}</p>}<button className="link-btn pin-forgot" onClick={()=>{localStorage.removeItem('vault_pin_hash');setPinEnabled(false);setShowPinLock(false);toast.info('PIN disabled. Re-enable in Settings.')}}>Forgot PIN (disables lock)</button></div></div>}

    <Toaster theme="dark"/>
  </div>
}

function ResetView({token}){
  const [newPwd,setNewPwd]=useState('');const [done,setDone]=useState(false);const [busy,setBusy]=useState(false);
  const submit=async(e)=>{e.preventDefault();setBusy(true);try{await client.post('/auth/reset-password',{token,new_password:newPwd});setDone(true)}catch(e){toast.error(e.response?.data?.detail||'Reset failed')}finally{setBusy(false)}};
  if(done)return <div className="share-screen"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div><div className="share-card" data-testid="reset-success"><p className="eyebrow">PASSWORD RESET</p><h2>Password Updated!</h2><p className="muted">Your password has been changed. You can now sign in.</p><a href="/" className="primary wide reset-go-login">Go to Login</a></div><Toaster theme="dark"/></div>;
  return <div className="share-screen"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div><div className="share-card" data-testid="reset-view"><p className="eyebrow">PASSWORD RESET</p><h2>Set New Password</h2><form onSubmit={submit}><label style={{display:'block',marginBottom:'16px',fontSize:'13px',color:'var(--muted)'}}>New Password<input data-testid="reset-pwd-input" type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} required minLength="8" autoComplete="new-password" placeholder="At least 8 characters" style={{display:'block',width:'100%',marginTop:'6px',padding:'10px 12px',background:'rgba(255,255,255,.06)',border:'1px solid var(--line)',borderRadius:'8px',color:'#fff',fontSize:'14px'}}/></label><button className="primary wide" data-testid="reset-submit" disabled={busy}>{busy?'Updating…':'Set New Password'} <ArrowUpRight size={17}/></button></form></div><Toaster theme="dark"/></div>
}

function ShareView({token}){
  const [data,setData]=useState(null); const [err,setErr]=useState(''); const [timeLeft,setTimeLeft]=useState('');
  useEffect(()=>{client.get(`/share/${token}`).then(r=>setData(r.data)).catch(e=>setErr(e.response?.data?.detail||'This link has expired or is invalid'))},[token]);
  useEffect(()=>{
    if(!data?.expires)return;
    const tick=()=>{
      const diff=new Date(data.expires)-new Date();
      if(diff<=0){setTimeLeft('Expired');return}
      const h=Math.floor(diff/3600000);const m=Math.floor((diff%3600000)/60000);const s=Math.floor((diff%60000)/1000);
      setTimeLeft(h>0?`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`:`${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`);
    };
    tick();const id=setInterval(tick,1000);return()=>clearInterval(id);
  },[data]);
  const copy=()=>{copyText(data.value);toast.success('Copied!')};
  if(err)return <div className="share-screen"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div><div className="share-card"><p className="eyebrow">SHARE LINK</p><h2>Link Expired</h2><p className="muted">{err}</p></div><Toaster theme="dark"/></div>;
  if(!data)return <LoadingScreen/>;
  return <div className="share-screen"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div><div className="share-card" data-testid="share-view-card"><p className="eyebrow">SHARED WITH YOU</p><h2>{data.name}</h2><div className="share-value-box" data-testid="share-value">{data.value}</div><button className="primary wide" onClick={copy}><Copy size={15}/> Copy value</button><div className="share-timer-box" data-testid="share-countdown"><Timer size={13}/><span>Link expires in: </span><b className={timeLeft==='Expired'?'share-timer-expired':'share-timer-live'}>{timeLeft}</b></div><p className="share-exp">Exact expiry: {new Date(data.expires).toLocaleString()}</p></div><Toaster theme="dark"/></div>
}

export default function App(){
  const [user,setUser]=useState(null); const [booting,setBooting]=useState(true);
  const [showLanding,setShowLanding]=useState(true);
  const [showAuth,setShowAuth]=useState(false);
  useEffect(()=>{
    const minDelay=new Promise(r=>setTimeout(r,14000));
    const t=new URLSearchParams(window.location.search).get('token');if(t){localStorage.setItem('vault_token',t);window.history.replaceState({},'','/')}
    const token=localStorage.getItem('vault_token');
    const authCheck=token?client.get('/auth/me',authHeader()).then(r=>{setUser(r.data);setShowLanding(false);setShowAuth(false)}).catch(()=>localStorage.removeItem('vault_token')):Promise.resolve();
    Promise.all([minDelay,authCheck]).finally(()=>setBooting(false));
  },[]);
  const shareToken=new URLSearchParams(window.location.search).get('share');
  const resetToken=new URLSearchParams(window.location.search).get('reset');
  if(shareToken)return <ShareView token={shareToken}/>;
  if(resetToken)return <ResetView token={resetToken}/>;
  const isAdminRoute=window.location.pathname==='/admin';
  const logout=()=>{localStorage.removeItem('vault_token');setUser(null);setShowLanding(true);setShowAuth(false)};
  if(booting)return <LoadingScreen/>;
  if(isAdminRoute&&!user)return <Auth onLogin={(u)=>{setUser(u);setShowLanding(false);setShowAuth(false)}}/>;
  if(isAdminRoute&&user)return <AdminPanel user={user} onLogout={logout}/>;
  const onLogin=(u)=>{setUser(u);setShowLanding(false);setShowAuth(false)};
  if(user)return <Vault user={user} onLogout={logout}/>;
  if(showAuth)return <Auth onLogin={onLogin}/>;
  return <LandingPage onGetStarted={()=>{setShowLanding(false);setShowAuth(true)}}/>;
}
