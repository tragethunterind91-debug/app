import {useEffect, useMemo, useRef, useState} from 'react';
import axios from 'axios';
import {ShieldCheck, LockKeyhole, Plus, Search, Eye, EyeOff, Copy, Download, Trash2, LogOut, KeyRound, ArrowUpRight, X, Check, RefreshCw, Pencil, Wand2, Upload, Share2, Activity, ShieldAlert, Gauge, Timer, ExternalLink, Lock, HelpCircle, Settings, Calendar, Shield, AlertTriangle, ToggleLeft, ToggleRight, FileText, Skull} from 'lucide-react';
import './App.css';
import './brand.css';
import {Toaster, toast} from 'sonner';
import AdminPanel from './AdminPanel';

const API=`${process.env.REACT_APP_BACKEND_URL}/api`;
const client=axios.create({baseURL:API});
const authHeader=()=>({headers:{Authorization:`Bearer ${localStorage.getItem('vault_token')}`} });
const copyText=async(text)=>{try{await navigator.clipboard.writeText(text)}catch{const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}};
const hashPin=async(p)=>{const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p+'tp5-pin-salt'));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')};

function Auth({onLogin}){
  const [mode,setMode]=useState('login');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);
  // Multi-stage login
  const [loginStage,setLoginStage]=useState(null);
  const [stageToken,setStageToken]=useState(null);
  const [birthdayInput,setBirthdayInput]=useState('');
  const [quizIndices,setQuizIndices]=useState([]);
  const [quizAnswers,setQuizAnswers]=useState({});
  // Registration extras
  const [regBirthday,setRegBirthday]=useState('');
  const [regBirthdayConfirm,setRegBirthdayConfirm]=useState('');
  const [l3Modal,setL3Modal]=useState(null); // {passwords, user}
  // Login attempts display
  const [loginStatus,setLoginStatus]=useState(null);
  const checkLoginStatus=async(em)=>{if(!em||mode!=='login')return;try{const r=await client.get(`/auth/login-status?email=${encodeURIComponent(em)}`);setLoginStatus(r.data)}catch{setLoginStatus(null)}};

  const submit=async(e)=>{
    e.preventDefault();setBusy(true);
    try{
      if(mode==='register'){
        if(!regBirthday){toast.error('Birthday is required');setBusy(false);return}
        if(regBirthday!==regBirthdayConfirm){toast.error('Birthdays do not match');setBusy(false);return}
        const r=await client.post('/auth/register',{email,password,birthday:regBirthday});
        localStorage.setItem('vault_token',r.data.token);
        setL3Modal({passwords:r.data.layer3_passwords,user:r.data.user});
      }else{
        const r=await client.post('/auth/login',{email,password});
        if(r.data.stage==='birthday'){
          setStageToken(r.data.token);setLoginStage('birthday');setBirthdayInput('');
        }else{
          localStorage.setItem('vault_token',r.data.token);onLogin(r.data.user);
        }
      }
    }catch(e){toast.error(e.response?.data?.detail||'Could not sign in')}finally{setBusy(false)}
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
    }catch(e){toast.error(e.response?.data?.detail||'Birthday verification failed')}finally{setBusy(false)}
  };

  const submitLayer3Quiz=async()=>{
    setBusy(true);
    try{
      const r=await client.post('/auth/verify-layer3',{answers:quizAnswers},{headers:{Authorization:`Bearer ${stageToken}`}});
      localStorage.setItem('vault_token',r.data.token);onLogin(r.data.user);setLoginStage(null);
    }catch(e){toast.error(e.response?.data?.detail||'Layer 3 verification failed')}finally{setBusy(false)}
  };

  // Birthday verification stage
  if(loginStage==='birthday')return(
    <main className="auth-shell"><section className="auth-art"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/></div><div className="art-copy"><p className="eyebrow">LAYER 2 VERIFICATION</p><h1>Verify your<br/><em>identity.</em></h1><p>Enter your birthday to continue. This is a security checkpoint.</p></div><div className="security-stamp"><Calendar size={17}/><span>Birthday verification<br/><b>No forgot option — by design</b></span></div></section>
    <section className="auth-panel"><div className="auth-card"><div className="mobile-brand brand"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/></div>
      <p className="eyebrow">LAYER 2 — BIRTHDAY</p><h2>Confirm your birthday</h2><p className="muted">Enter the exact birthday you registered with. There is no recovery for this.</p>
      <label>Birthday<input data-testid="birthday-verify-input" type="date" value={birthdayInput} onChange={e=>setBirthdayInput(e.target.value)} required/></label>
      <button className="primary wide" data-testid="birthday-verify-submit" disabled={busy||!birthdayInput} onClick={submitBirthday}>{busy?'Verifying…':'Verify Birthday'} <ArrowUpRight size={17}/></button>
      <button className="link-btn" data-testid="birthday-back-btn" onClick={()=>{setLoginStage(null);setStageToken(null)}}>← Back to login</button>
    </div></section><Toaster theme="dark"/></main>
  );

  // Layer 3 quiz stage
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
          <h2>{mode==='login'?'Welcome back':'Create your vault'}</h2>
          <p className="muted">{mode==='login'?'Your private command center is waiting.':'Start protecting what matters in under a minute.'}</p>
          <form onSubmit={submit} data-testid="auth-form">
            <label>Email<input data-testid="auth-email-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} onBlur={e=>checkLoginStatus(e.target.value)} required placeholder="you@example.com"/></label>
            <label>Password<input data-testid="auth-password-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength="8" placeholder="At least 8 characters"/></label>
            {mode==='login'&&loginStatus&&loginStatus.hardcore&&<div className="login-attempts-warn" data-testid="login-attempts-warning"><AlertTriangle size={14}/><div><b>Hardcore Mode Active</b><p>Today: {loginStatus.daily_used}/{loginStatus.daily_limit} tries used &bull; Total fails: {loginStatus.total_fails}/{loginStatus.total_limit} &bull; Consecutive days: {loginStatus.consecutive_days}/{loginStatus.days_limit}</p></div></div>}
            {mode==='register'&&<><label>Birthday <span className="birthday-warn">Please enter correctly — used for login verification</span><input data-testid="reg-birthday-input" type="date" value={regBirthday} onChange={e=>setRegBirthday(e.target.value)} required/></label><label>Confirm Birthday<input data-testid="reg-birthday-confirm" type="date" value={regBirthdayConfirm} onChange={e=>setRegBirthdayConfirm(e.target.value)} required/></label></>}
            {mode==='login'&&<p className="birthday-login-hint" data-testid="birthday-hint">You will need your birthday to complete sign-in.</p>}
            <button className="primary wide" data-testid="auth-submit-button" disabled={busy}>{busy?'Securing…':mode==='login'?'Unlock vault':'Create vault'} <ArrowUpRight size={17}/></button>
          </form>
          <button className="link-btn" data-testid="auth-mode-toggle" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?"I don't have an account":"I already have an account"}</button>
        </div>
      </section>
      {/* Registration: L3 passwords reveal (no recovery phrase) */}
      {l3Modal&&<div className="modal-backdrop"><div className="modal phrase-reveal-modal l3-reveal-modal" data-testid="l3-reveal-modal"><p className="eyebrow">ACCOUNT CREATED — SAVE THESE NOW</p><h2>Your Crypto Type Passwords</h2>
        <p className="muted phrase-warn">These are shown ONCE. Write them down or store offline. You need these to log in when Layer 3 is enabled.</p>
        <div className="l3-section"><h3 style={{fontSize:'13px',color:'#6f9bff',marginBottom:'8px'}}>20 Crypto Type Passwords (Layer 3)</h3><div className="l3-grid" data-testid="l3-passwords-grid">{l3Modal.passwords.map((p,i)=><div key={i} className="l3-pass-card" data-testid={`l3-pass-${i}`}><span className="l3-num">{i+1}</span><span className="l3-val">{p}</span></div>)}</div>
        <button className="secondary" style={{marginTop:'10px',width:'100%'}} data-testid="copy-l3-passwords" onClick={()=>{copyText(l3Modal.passwords.map((p,i)=>`${i+1}: ${p}`).join('\n'));toast.success('All 20 passwords copied!')}}><Copy size={14}/> Copy All Passwords</button></div>
        <p className="muted" style={{marginTop:'12px',fontSize:'11px',color:'#5a6a80'}}>You can enable Layer 3 protection from Settings after entering your vault. These passwords will be required during login.</p>
        <button className="primary wide" style={{marginTop:'16px'}} data-testid="l3-confirm-button" onClick={()=>{onLogin(l3Modal.user);setL3Modal(null)}}>I've saved everything — Enter vault</button>
      </div></div>}
      <Toaster theme="dark"/>
    </main>
  );
}

function Vault({user,onLogout}){
  const inactivityRef=useRef(null);
  const [items,setItems]=useState([]); const [query,setQuery]=useState(''); const [showForm,setShowForm]=useState(false); const [editing,setEditing]=useState(null); const [visible,setVisible]=useState({}); const [values,setValues]=useState({}); const [form,setForm]=useState({name:'',value:'',category:'Secret',totp_secret:'',url:'',advance_mode:false,advance_passphrase:''}); const [showGen,setShowGen]=useState(false); const [genOpts,setGenOpts]=useState({length:16,upper:true,lower:true,nums:true,syms:false}); const [genPwd,setGenPwd]=useState(''); const [cat,setCat]=useState('All'); const [shareModal,setShareModal]=useState(null); const [showAudit,setShowAudit]=useState(false); const [auditLogs,setAuditLogs]=useState([]); const [secReport,setSecReport]=useState(null); const [showSec,setShowSec]=useState(false); const [categories,setCategories]=useState(['Login','API key','Secret','Secure note','Wi-Fi','Bank']); const [breachBadge,setBreachBadge]=useState(0); const [breachChecking,setBreachChecking]=useState(false); const [breachScanned,setBreachScanned]=useState(false); const [showSharePicker,setShowSharePicker]=useState(null); const [showAdvancePrompt,setShowAdvancePrompt]=useState(null); const [advanceInput,setAdvanceInput]=useState(''); const [showShares,setShowShares]=useState(false); const [activeShares,setActiveShares]=useState([]); const [showSettings,setShowSettings]=useState(false); const [showHelp,setShowHelp]=useState(false); const [settings,setSettings]=useState({autofill:true});
  const [showPinLock,setShowPinLock]=useState(false); const [pinInput,setPinInput]=useState(''); const [pinError,setPinError]=useState(''); const [pinEnabled,setPinEnabled]=useState(!!localStorage.getItem('vault_pin_hash')); const [setupPinMode,setSetupPinMode]=useState(false); const [setupPinValue,setSetupPinValue]=useState(''); const [setupPinConfirm,setSetupPinConfirm]=useState(''); const [setupPinErr,setSetupPinErr]=useState('');
  const [showItemProps,setShowItemProps]=useState(null);
  // Layer 3, Hardcore, Disclaimer states
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
  const [l3QuizMode,setL3QuizMode]=useState(null); // {indices,answers} for enable quiz
  const [hardcoreData,setHardcoreData]=useState(null);
  const [showBirthdaySetup,setShowBirthdaySetup]=useState(false);
  const [bdaySetup,setBdaySetup]=useState('');
  const [bdaySetupConfirm,setBdaySetupConfirm]=useState('');
  const [hasBirthday,setHasBirthday]=useState(user.has_birthday||false);

  // PIN inactivity timer
  useEffect(()=>{
    if(!pinEnabled)return;
    const reset=()=>{if(inactivityRef.current)clearTimeout(inactivityRef.current);inactivityRef.current=setTimeout(()=>setShowPinLock(true),5*60*1000)};
    const events=['mousemove','keydown','click','touchstart'];
    events.forEach(e=>document.addEventListener(e,reset));
    reset();
    return()=>{events.forEach(e=>document.removeEventListener(e,reset));if(inactivityRef.current)clearTimeout(inactivityRef.current)};
  },[pinEnabled]);

  // Auto-verify PIN when 4 digits entered
  useEffect(()=>{
    if(pinInput.length!==4)return;
    (async()=>{
      const h=await hashPin(pinInput);
      const stored=localStorage.getItem('vault_pin_hash');
      if(h===stored){setShowPinLock(false);setPinInput('');setPinError('')}
      else{setPinError('Wrong PIN — try again');setPinInput('')}
    })()
  },[pinInput]);

  const load=()=>{client.get('/items',authHeader()).then(r=>{setItems(r.data);setTimeout(()=>runBackgroundBreachCheck(r.data),800)}).catch(()=>onLogout()); client.get('/preferences',authHeader()).then(r=>{if(r.data.categories)setCategories(r.data.categories);if(typeof r.data.autofill==='boolean')setSettings(s=>({...s,autofill:r.data.autofill}))}).catch(()=>{})}; useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>items.filter(i=>i.name.toLowerCase().includes(query.toLowerCase())&&(cat==='All'||i.category===cat)),[items,query,cat]);

  const save=async(e)=>{e.preventDefault(); try{if(editing) await client.put(`/items/${editing.id}`,form,authHeader()); else await client.post('/items',form,authHeader()); if(form.category&&!categories.includes(form.category))saveCategory(form.category); toast.success(editing?'Item updated':'Item encrypted and saved'); setShowForm(false);setEditing(null);setForm({name:'',value:'',category:'Secret',totp_secret:'',url:'',advance_mode:false,advance_passphrase:''});load()}catch(e){toast.error(e.response?.data?.detail||'Save failed')}};

  const reveal=async(id)=>{const item=items.find(i=>i.id===id);if(item?.advance_mode&&!values[id]){setAdvanceInput('');setShowAdvancePrompt({item,action:'reveal'});return null}if(values[id]){setVisible({...visible,[id]:!visible[id]});return values[id]} const r=await client.get(`/items/${id}/value`,authHeader()); setValues({...values,[id]:r.data.value});setVisible({...visible,[id]:true});return r.data.value};

  const copy=async(id)=>{const item=items.find(i=>i.id===id);if(item?.advance_mode&&!values[id]){setAdvanceInput('');setShowAdvancePrompt({item,action:'copy'});return}const value=values[id]||await reveal(id);if(!value)return;await copyText(value);toast.success('Copied to clipboard')};

  const remove=async(id)=>{if(window.confirm('Delete this item permanently?')){await client.delete(`/items/${id}`,authHeader());toast.success('Item deleted');load()}};

  const startEdit=async(item)=>{if(item.advance_mode&&!values[item.id]){setAdvanceInput('');setShowAdvancePrompt({item,action:'edit'});return}let v=values[item.id];if(!v){const r=await client.get(`/items/${item.id}/value`,authHeader());v=r.data.value;setValues(p=>({...p,[item.id]:v}))}setEditing(item);setForm({name:item.name,value:v,category:item.category,totp_secret:'',url:item.url||'',advance_mode:item.advance_mode||false,advance_passphrase:''});setShowForm(true)};

  const submitAdvancePassphrase=async()=>{if(!showAdvancePrompt)return;const{item,action}=showAdvancePrompt;try{const r=await client.post(`/items/${item.id}/advance-reveal`,{passphrase:advanceInput},authHeader());const val=r.data.value;setValues(p=>({...p,[item.id]:val}));setShowAdvancePrompt(null);setAdvanceInput('');if(action==='reveal'){setVisible(p=>({...p,[item.id]:true}))}else if(action==='copy'){await copyText(val);toast.success('Copied!')}else if(action==='edit'){setEditing(item);setForm({name:item.name,value:val,category:item.category,totp_secret:'',url:item.url||'',advance_mode:true,advance_passphrase:''});setShowForm(true)}}catch(e){const msg=e.response?.data?.detail||'Wrong passphrase';toast.error(msg,{duration:msg.includes('lock')||msg.includes('attempt')?8000:3000})}};

  const loadShares=async()=>{try{const r=await client.get('/shares',authHeader());setActiveShares(r.data);setShowShares(true)}catch{toast.error('Could not load shares')}};
  const revokeShare=async(token)=>{try{await client.delete(`/shares/${token}`,authHeader());setActiveShares(p=>p.filter(s=>s.token!==token));toast.success('Share revoked')}catch{toast.error('Revoke failed')}};

  const mkPwd=(o)=>{let c='';if(o.upper)c+='ABCDEFGHIJKLMNOPQRSTUVWXYZ';if(o.lower)c+='abcdefghijklmnopqrstuvwxyz';if(o.nums)c+='0123456789';if(o.syms)c+='!@#$%^&*()-_=+[]{}|;:,.<>?';if(!c)c='abcdefghijklmnopqrstuvwxyz0123456789';return Array.from({length:o.length},()=>c[Math.floor(Math.random()*c.length)]).join('')};

  const b32d=s=>{const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,val=0,out=[];for(const c of s.toUpperCase().replace(/[^A-Z2-7]/g,'')){val=(val<<5)|a.indexOf(c);bits+=5;if(bits>=8){out.push((val>>>(bits-8))&0xFF);bits-=8}}return new Uint8Array(out)};
  const getTOTP=async secret=>{const key=b32d(secret);const T=Math.floor(Date.now()/30000);const msg=new Uint8Array(8);new DataView(msg.buffer).setUint32(4,T);const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-1'},false,['sign']);const sig=new Uint8Array(await crypto.subtle.sign('HMAC',k,msg));const o=sig[19]&0xf;return(((sig[o]&0x7f)<<24|(sig[o+1]&0xff)<<16|(sig[o+2]&0xff)<<8|(sig[o+3]&0xff))%1000000).toString().padStart(6,'0')};
  const revealTOTP=async(item)=>{try{const r=await client.get(`/items/${item.id}/totp`,authHeader());const code=await getTOTP(r.data.secret);copyText(code).catch(()=>{});toast.success(`OTP: ${code.slice(0,3)} ${code.slice(3)} — copied!`,{duration:6000})}catch{toast.error('No TOTP configured')}};

  const sha1hex=async str=>{const buf=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(str));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()};
  const checkBreach=async(item)=>{let val=values[item.id];if(!val){const r=await client.get(`/items/${item.id}/value`,authHeader());val=r.data.value;setValues(p=>({...p,[item.id]:val}))}try{const h=await sha1hex(val);const resp=await fetch(`https://api.pwnedpasswords.com/range/${h.slice(0,5)}`);const text=await resp.text();const found=text.split('\n').find(l=>l.startsWith(h.slice(5)));if(found){toast.error(`Leaked in ${parseInt(found.split(':')[1]).toLocaleString()} breaches!`,{duration:6000})}else{toast.success('Not found in any known breach')}}catch{toast.error('Breach check failed')}};

  const runBackgroundBreachCheck=async(itemList)=>{if(!itemList?.length){setBreachScanned(true);return}setBreachChecking(true);let count=0;for(const item of itemList.slice(0,15)){try{const r=await client.get(`/items/${item.id}/value`,authHeader());const val=r.data.value;setValues(p=>({...p,[item.id]:val}));const h=await sha1hex(val);const resp=await fetch(`https://api.pwnedpasswords.com/range/${h.slice(0,5)}`);const text=await resp.text();if(text.split('\n').find(l=>l.startsWith(h.slice(5))))count++}catch{}await new Promise(r=>setTimeout(r,180))}setBreachBadge(count);setBreachChecking(false);setBreachScanned(true);if(count>0)toast.warning(`${count} item${count>1?'s':''} found in known data breaches — check Security Report`,{duration:8000})};

  const loadSecReport=async()=>{try{const r=await client.get('/security/report',authHeader());setSecReport(r.data);setShowSec(true)}catch{toast.error('Could not load report')}};
  const saveCategory=async newCat=>{if(newCat&&!categories.includes(newCat)){const updated=[...categories,newCat];setCategories(updated);client.put('/preferences',{categories:updated},authHeader()).catch(()=>{})}};
  const saveSettingsPref=async(newSettings)=>{setSettings(newSettings);client.put('/preferences',newSettings,authHeader()).catch(()=>{})};

  const importVault=async(e)=>{const file=e.target.files[0];if(!file)return;try{const raw=JSON.parse(await file.text());const arr=Array.isArray(raw)?raw:[raw];const valid=arr.filter(x=>x.name&&x.value).map(x=>({name:x.name,value:x.value,category:x.category||'Secret'}));if(!valid.length){toast.error('No valid items found in file');e.target.value='';return}await client.post('/items/import',{items:valid},authHeader());toast.success(`${valid.length} item(s) imported`);load()}catch{toast.error('Import failed — check file format')}finally{e.target.value=''}};

  const shareItem=async(item,hours)=>{try{const r=await client.post(`/items/${item.id}/share`,{hours},authHeader());const link=`${window.location.origin}/?share=${r.data.token}`;setShowSharePicker(null);setShareModal({item,link,hours:r.data.hours});toast.success('Share link ready!')}catch(e){toast.error(e.response?.data?.detail||'Share failed')}};
  const loadAudit=async()=>{try{const r=await client.get('/audit',authHeader());setAuditLogs(r.data);setShowAudit(true)}catch{toast.error('Could not load activity')}};

  const exportItem=(item)=>{const data=JSON.stringify({name:item.name,value:values[item.id]||'[reveal before export]',category:item.category},null,2);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download=`${item.name.replace(/\s+/g,'-')}.json`;a.click()};
  const exportAll=async()=>{if(!window.confirm('This will download ALL your secrets in plain text. Continue?'))return;const full=await Promise.all(items.map(async i=>{const r=await client.get(`/items/${i.id}/value`,authHeader());return {...i,value:r.data.value}}));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(full,null,2)],{type:'application/json'}));a.download='toppass5-backup.json';a.click();toast.success('Vault backup downloaded')};
  // --- Layer 3 & Hardcore helpers ---
  const loadL3Passwords=async()=>{try{const r=await client.get('/auth/layer3-passwords',authHeader());setL3Passwords(r.data.passwords);setL3Enabled(r.data.enabled);return r.data}catch{toast.error('Could not load Layer 3 data');return null}};
  const toggleL3=async(enable)=>{
    if(enable){
      // Need to quiz before enabling
      const data=await loadL3Passwords();
      if(!data)return;
      const indices=[];while(indices.length<3){const i=Math.floor(Math.random()*20);if(!indices.includes(i))indices.push(i)}
      indices.sort((a,b)=>a-b);
      setL3QuizMode({indices,answers:{},passwords:data.passwords});
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
    try{const r=await client.post('/auth/regenerate-layer3',{password:l3RegenPwd},authHeader());setL3Passwords(r.data.passwords);setShowL3Regen(false);setL3RegenPwd('');setShowL3View(true);toast.success(`New passwords generated! ${r.data.changes_remaining} changes left this week.`)}catch(e){toast.error(e.response?.data?.detail||'Failed to regenerate')}
  };
  const loadHardcore=async()=>{try{const r=await client.get('/auth/hardcore-settings',authHeader());setHardcoreData(r.data)}catch{toast.error('Could not load Hardcore settings')}};
  const saveHardcore=async(newData)=>{
    try{await client.put('/auth/hardcore-settings',newData,authHeader());setHardcoreData(d=>({...d,enabled:newData.enabled,settings:{max_login_fail_days:newData.max_login_fail_days,max_login_fails:newData.max_login_fails,max_daily_tries:newData.max_daily_tries,max_layer3_fails:newData.max_layer3_fails}}));toast.success(newData.enabled?'Hardcore Mode enabled — be careful!':'Hardcore Mode disabled')}catch(e){toast.error(e.response?.data?.detail||'Failed')}
  };
  const toggleDisclaimer=async(enable)=>{
    if(enable&&!disclaimerEnabled){setShowDisclaimer(true)}
    try{await client.post('/auth/toggle-disclaimer',{enabled:enable},authHeader());setDisclaimerEnabled(enable);if(!enable)setShowDisclaimer(false)}catch{toast.error('Failed to update')}
  };
  const acceptDisclaimer=()=>{setShowDisclaimer(false)};
  const saveBirthday=async()=>{
    if(!bdaySetup||!bdaySetupConfirm){toast.error('Both fields required');return}
    if(bdaySetup!==bdaySetupConfirm){toast.error('Birthdays do not match');return}
    if(!window.confirm('Are you sure? Birthday CANNOT be changed once set. There is NO recovery.'))return;
    try{await client.post('/auth/set-birthday',{birthday:bdaySetup},authHeader());setHasBirthday(true);setShowBirthdaySetup(false);setBdaySetup('');setBdaySetupConfirm('');toast.success('Birthday set! You will need it on every login.')}catch(e){toast.error(e.response?.data?.detail||'Failed to set birthday')}
  };
  const exportL3Passwords=async()=>{
    const data=await loadL3Passwords();if(!data)return;
    const lines=['═══════════════════════════════════════','  TOPPASS5 — LAYER 3 CRYPTO TYPE PASS','═══════════════════════════════════════','','  Keep this file OFFLINE and SECURE.','  You need these passwords to log in.','','───────────────────────────────────────'];
    data.passwords.forEach((p,i)=>lines.push(`  Pass #${String(i+1).padStart(2,'0')}:  ${p}`));
    lines.push('','───────────────────────────────────────',`  Generated: ${new Date().toISOString().slice(0,10)}`,`  Account: ${user.email}`,'  WARNING: Do NOT share this file.','═══════════════════════════════════════');
    const blob=new Blob([lines.join('\n')],{type:'text/plain'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`toppass5-layer3-${Date.now()}.txt`;a.click();URL.revokeObjectURL(a.href);toast.success('Crypto type passwords exported!');
  };

  const isItemLocked=(item)=>item.advance_locked_until&&new Date(item.advance_locked_until)>new Date();
  const autoComp=settings.autofill?undefined:'off';

  // Clickable item helper for security report
  const clickSecItem=(name)=>{const it=items.find(x=>x.name===name);if(it){setShowSec(false);startEdit(it)}};

  return <div className="app-shell">
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
      {user.is_admin&&<a href="?admin=1" className="nav-item nav-admin" data-testid="admin-nav"><Lock size={17}/>Owner Panel</a>}
      <div className="side-note"><span className="status-dot"/>All systems protected</div>
      <div className="side-bottom"><div className="user-pill"><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><div><b data-testid="user-email">{user.email}</b><small>Personal vault</small></div></div><button className="icon-btn" data-testid="logout-button" onClick={onLogout} title="Sign out"><LogOut size={17}/></button></div>
    </aside>

    <main className="vault-main">
      <header className="topbar"><div><p className="eyebrow">PERSONAL VAULT / TODAY</p><h1>Good to see you, {user.name?.split(' ')[0]}</h1></div><div className="top-actions"><label className="secondary top-btn" data-testid="import-button" title="Import from backup JSON"><Upload size={16}/> Import<input type="file" accept=".json" style={{display:'none'}} onChange={importVault}/></label><button className="secondary top-btn" data-testid="export-all-button" onClick={exportAll}><Download size={16}/> Export</button><button className="secondary top-btn" data-testid="generator-button" onClick={()=>{setGenPwd(mkPwd(genOpts));setShowGen(true)}}><Wand2 size={16}/> Generator</button><button className="primary" data-testid="add-item-button" onClick={()=>{setEditing(null);setForm({name:'',value:'',category:'Secret'});setShowForm(true)}}><Plus size={17}/> Add value</button></div></header>
      <section className="metrics"><div><span>Protected values</span><strong data-testid="protected-count">{items.length.toString().padStart(2,'0')}</strong></div><div><span>Security health</span><strong className="green">Excellent <Check size={17}/></strong></div><div><span>Last activity</span><strong>Just now</strong></div></section>
      <section className="vault-section"><div className="section-head"><div><p className="eyebrow">YOUR COLLECTION</p><h2>Encrypted values</h2></div><label className="search"><Search size={17}/><input data-testid="vault-search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your vault…"/></label></div>
        <div className="cat-filter">{['All',...new Set(categories)].map(c=><button key={c} className={`cat-chip${cat===c?' active':''}`} data-testid={`cat-filter-${c.replace(/\s+/g,'-')}`} onClick={()=>setCat(c)}>{c}</button>)}</div>
        {filtered.length===0?<div className="empty-state" data-testid="empty-vault-state"><div className="empty-icon"><LockKeyhole/></div><h3>{query?'Nothing found':'Your vault is quiet'}</h3><p>{query?'Try another name.':'Add your first value and keep it protected.'}</p><button className="primary" data-testid="empty-add-button" onClick={()=>setShowForm(true)}><Plus size={17}/> Add your first value</button></div>:
        <div className="item-list">{filtered.map(item=><article className="item-row" key={item.id} data-testid={`vault-item-${item.id}`}>
          <div className="item-icon"><LockKeyhole size={18}/></div>
          <div className="item-info">
            <div className="item-name-row">
              <b data-testid={`item-name-${item.id}`}>{item.name}</b>
              {item.advance_mode&&<span className="adv-badge" title={isItemLocked(item)?`Locked until ${new Date(item.advance_locked_until).toLocaleDateString()}`:'Advance Mode — extra passphrase required'}><Lock size={12}/>{isItemLocked(item)?' LOCKED':''}</span>}
              {item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer" className="url-link" title={`Open: ${item.url}`} onClick={e=>e.stopPropagation()}><ExternalLink size={13}/></a>}
            </div>
            <span>{item.category} · Updated {new Date(item.updated_at).toLocaleDateString()}</span>
          </div>
          <div className="secret-preview" data-testid={`item-value-${item.id}`}>{visible[item.id]?values[item.id]:'••••••••••••'}</div>
          <div className="item-actions">
            <button className="icon-btn" data-testid={`props-item-${item.id}`} onClick={()=>setShowItemProps(item)} title="Item properties"><Settings size={15}/></button>
            {item.has_totp&&<button className="icon-btn totp-btn" data-testid={`totp-item-${item.id}`} onClick={()=>revealTOTP(item)} title="Get OTP code"><Timer size={16}/></button>}
            <button className="icon-btn" data-testid={`reveal-item-${item.id}`} onClick={()=>reveal(item.id)} title="Reveal value"><Eye size={17}/></button>
            <button className="icon-btn" data-testid={`copy-item-${item.id}`} onClick={()=>copy(item.id)} title="Copy to clipboard"><Copy size={17}/></button>
            <button className="icon-btn" data-testid={`breach-item-${item.id}`} onClick={()=>checkBreach(item)} title="Check for breaches"><ShieldAlert size={16}/></button>
            {!item.advance_mode&&<button className="icon-btn" data-testid={`download-item-${item.id}`} onClick={()=>exportItem(item)} title="Download as JSON"><Download size={17}/></button>}
            {!item.advance_mode&&!isItemLocked(item)&&<button className="icon-btn share-btn" data-testid={`share-item-${item.id}`} onClick={()=>setShowSharePicker(item)} title="Share via expiring link"><Share2 size={16}/></button>}
            <button className="icon-btn" data-testid={`edit-item-${item.id}`} onClick={()=>startEdit(item)} title="Edit item"><Pencil size={16}/></button>
            <button className="icon-btn danger" data-testid={`delete-item-${item.id}`} onClick={()=>remove(item.id)} title="Delete permanently"><Trash2 size={17}/></button>
          </div>
        </article>)}</div>}
      </section>
    </main>

    {/* Item Form Modal */}
    {showForm&&<div className="modal-backdrop"><form className="modal item-form-modal" onSubmit={save} data-testid="item-form"><button type="button" className="modal-close icon-btn" data-testid="close-item-modal" onClick={()=>{setShowForm(false);setEditing(null);setForm({name:'',value:'',category:'Secret',totp_secret:'',url:'',advance_mode:false,advance_passphrase:''})}}><X/></button><p className="eyebrow">{editing?'EDIT VALUE':'NEW VALUE'}</p><h2>{editing?'Update protected value':'Add to your vault'}</h2><label>Name<input data-testid="item-name-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="e.g. Wi-Fi password"/></label><label>Value<div className="gen-row"><textarea data-testid="item-value-input" autoComplete={autoComp} value={form.value} onChange={e=>setForm({...form,value:e.target.value})} required placeholder="Your secret value" rows="4"/><button type="button" className="gen-inline" data-testid="generate-inline-button" onClick={()=>setForm({...form,value:mkPwd(genOpts)})} title="Generate password"><Wand2 size={14}/> Generate</button></div></label><label>Category<input list="cat-opts" data-testid="item-category-input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="e.g. Login, API key…"/><datalist id="cat-opts">{categories.map(c=><option key={c} value={c}/>)}</datalist></label><label>Authenticator Secret (TOTP) — optional<input data-testid="item-totp-input" type="text" value={form.totp_secret||''} onChange={e=>setForm({...form,totp_secret:e.target.value})} placeholder="Base32 secret e.g. JBSWY3DPEHPK3PXP"/></label><label>Website URL — optional<input data-testid="item-url-input" type="url" value={form.url||''} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://example.com"/></label><div className="advance-toggle"><label className="advance-check"><input type="checkbox" data-testid="advance-mode-toggle" checked={form.advance_mode||false} onChange={e=>setForm({...form,advance_mode:e.target.checked,advance_passphrase:''})}/><Lock size={14}/> Enable Advance Mode</label>{form.advance_mode&&<label className="advance-pass">Secret Passphrase (you must remember this — no recovery)<input data-testid="advance-passphrase-input" type="password" autoComplete="new-password" value={form.advance_passphrase||''} onChange={e=>setForm({...form,advance_passphrase:e.target.value})} placeholder="e.g. elephant892"/></label>}</div><button className="primary wide" data-testid="save-item-button">{editing?'Save changes':'Encrypt & save'} <LockKeyhole size={16}/></button></form></div>}

    {/* Generator */}
    {showGen&&<div className="modal-backdrop"><div className="modal gen-modal" data-testid="generator-modal"><button type="button" className="modal-close icon-btn" data-testid="close-generator" onClick={()=>setShowGen(false)}><X/></button><p className="eyebrow">SECURITY TOOL</p><h2>Password Generator</h2><div className="gen-output" data-testid="generated-password">{genPwd||'—'}</div><div className="gen-controls"><label className="gen-option">Length: <b>{genOpts.length}</b><input type="range" min="8" max="64" value={genOpts.length} onChange={e=>{const o={...genOpts,length:+e.target.value};setGenOpts(o);setGenPwd(mkPwd(o))}}/></label><label className="gen-option"><input type="checkbox" checked={genOpts.upper} onChange={e=>{const o={...genOpts,upper:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> A–Z Uppercase</label><label className="gen-option"><input type="checkbox" checked={genOpts.lower} onChange={e=>{const o={...genOpts,lower:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> a–z Lowercase</label><label className="gen-option"><input type="checkbox" checked={genOpts.nums} onChange={e=>{const o={...genOpts,nums:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> 0–9 Numbers</label><label className="gen-option"><input type="checkbox" checked={genOpts.syms} onChange={e=>{const o={...genOpts,syms:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> !@# Symbols</label></div><div className="gen-actions"><button type="button" className="secondary" data-testid="regenerate-button" onClick={()=>setGenPwd(mkPwd(genOpts))}><RefreshCw size={15}/> Regenerate</button><button type="button" className="primary" data-testid="copy-generated-button" onClick={()=>{copyText(genPwd);toast.success('Password copied!')}}><Copy size={15}/> Copy</button></div></div></div>}

    {/* Advance Mode Prompt */}
    {showAdvancePrompt&&<div className="modal-backdrop"><div className="modal adv-modal" data-testid="advance-prompt-modal"><button type="button" className="modal-close icon-btn" onClick={()=>{setShowAdvancePrompt(null);setAdvanceInput('')}}><X/></button><p className="eyebrow">ADVANCE MODE</p><h2><Lock size={18}/> Enter Passphrase</h2><p className="muted">This item is locked with an extra passphrase. Enter it to proceed.</p><input data-testid="advance-passphrase-field" type="password" className="adv-input" value={advanceInput} onChange={e=>setAdvanceInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitAdvancePassphrase()} placeholder="Your secret passphrase" autoFocus/><button className="primary wide" data-testid="advance-submit-button" onClick={submitAdvancePassphrase}><Lock size={15}/> Unlock</button></div></div>}

    {/* My Share Links */}
    {showShares&&<div className="modal-backdrop"><div className="modal shares-modal" data-testid="my-shares-modal"><button type="button" className="modal-close icon-btn" data-testid="close-shares-modal" onClick={()=>setShowShares(false)}><X/></button><p className="eyebrow">ACTIVE LINKS</p><h2>My Share Links</h2><p className="muted" style={{fontSize:'12px',marginBottom:'12px'}}>To create a share link: click the <Share2 size={11} style={{display:'inline',verticalAlign:'middle'}}/> icon on any vault item.</p>{activeShares.length===0?<p className="muted">No active share links yet.</p>:<div className="shares-list">{activeShares.map((s,i)=><div key={i} className="share-row" data-testid={`share-row-${i}`}><div><b className="share-item-name">{s.item_name}</b><span className="share-exp">Expires {new Date(s.expires).toLocaleString()}</span></div><button className="icon-btn danger" data-testid={`revoke-share-${i}`} onClick={()=>revokeShare(s.token)} title="Revoke"><Trash2 size={15}/></button></div>)}</div>}</div></div>}

    {/* Share Picker */}
    {showSharePicker&&<div className="modal-backdrop"><div className="modal share-picker-modal" data-testid="share-picker-modal"><button type="button" className="modal-close icon-btn" data-testid="close-share-picker" onClick={()=>setShowSharePicker(null)}><X/></button><p className="eyebrow">SECURE SHARE</p><h2>Share "{showSharePicker.name}"</h2><p className="muted">Choose how long the link stays active. Anyone with it can view the value:</p><div className="expiry-options">{[{h:1,label:'1 hour'},{h:12,label:'12 hours'},{h:24,label:'24 hours'},{h:168,label:'7 days'}].map(opt=><button key={opt.h} className="expiry-btn" data-testid={`expiry-${opt.h}h`} onClick={()=>shareItem(showSharePicker,opt.h)}>{opt.label}</button>)}</div></div></div>}

    {/* Share Link Display */}
    {shareModal&&<div className="modal-backdrop"><div className="modal" data-testid="share-modal"><button type="button" className="modal-close icon-btn" data-testid="close-share-modal" onClick={()=>setShareModal(null)}><X/></button><p className="eyebrow">SECURE SHARE</p><h2>Share "{shareModal.item.name}"</h2><p className="muted">This link expires in {shareModal.hours} hours. Anyone with it can view the value.</p><div className="share-link-box" data-testid="share-link-display">{shareModal.link}</div><button className="primary wide" data-testid="copy-share-link-button" onClick={()=>{copyText(shareModal.link);toast.success('Link copied to clipboard!')}}><Copy size={15}/> Copy link</button></div></div>}

    {/* Security Report */}
    {showSec&&secReport&&<div className="modal-backdrop"><div className="modal sec-modal" data-testid="security-report-modal"><button type="button" className="modal-close icon-btn" data-testid="close-sec-modal" onClick={()=>setShowSec(false)}><X/></button><p className="eyebrow">VAULT HEALTH</p><h2>Security Report</h2><div className="sec-score-ring" data-testid="security-score"><span className="sec-score-num" style={{color:secReport.score>=80?'var(--green)':secReport.score>=50?'#fbbf24':'var(--red)'}}>{secReport.score}</span><span className="sec-score-label">/ 100</span></div><div className="sec-stats"><div className="sec-stat"><span className="sec-stat-n" style={{color:'var(--green)'}}>{secReport.total}</span><span>Total items</span></div><div className="sec-stat"><span className="sec-stat-n" style={{color:secReport.weak.length?'var(--red)':'var(--green)'}}>{secReport.weak.length}</span><span>Weak (&lt;10 chars)</span></div><div className="sec-stat"><span className="sec-stat-n" style={{color:secReport.reused.length?'#fbbf24':'var(--green)'}}>{secReport.reused.length}</span><span>Reused</span></div><div className="sec-stat"><span className="sec-stat-n" style={{color:secReport.old.length?'#fbbf24':'var(--green)'}}>{secReport.old.length}</span><span>Old (90d+)</span></div></div>
      {secReport.weak.length>0&&<div className="sec-list"><p className="sec-list-title danger-text">Weak passwords — click to fix</p>{secReport.weak.map((n,i)=><div key={i} className="sec-item sec-item-btn" data-testid={`weak-item-${i}`} onClick={()=>clickSecItem(n)}>{n} <Pencil size={11}/></div>)}</div>}
      {secReport.reused.length>0&&<div className="sec-list"><p className="sec-list-title warn-text">Reused passwords — click to fix</p>{secReport.reused.map((names,i)=><div key={i} className="sec-item">{names.map((n,j)=><span key={j} className="sec-item-btn" onClick={()=>clickSecItem(n)}>{n}{j<names.length-1?', ':''}</span>)}</div>)}</div>}
      {secReport.old.length>0&&<div className="sec-list"><p className="sec-list-title warn-text">Not updated in 90+ days — click to fix</p>{secReport.old.map((n,i)=><div key={i} className="sec-item sec-item-btn" data-testid={`old-item-${i}`} onClick={()=>clickSecItem(n)}>{n} <Pencil size={11}/></div>)}</div>}
      <button type="button" className="secondary wide" data-testid="recheck-breach-button" onClick={()=>runBackgroundBreachCheck(items)} style={{marginTop:'16px'}}><ShieldAlert size={15}/> Re-check all for breaches</button>
    </div></div>}

    {/* Audit Log */}
    {showAudit&&<div className="modal-backdrop"><div className="modal audit-modal" data-testid="audit-modal"><button type="button" className="modal-close icon-btn" data-testid="close-audit-modal" onClick={()=>setShowAudit(false)}><X/></button><p className="eyebrow">SECURITY</p><h2>Activity Log</h2>{auditLogs.length===0?<p className="muted">No activity yet.</p>:<div className="audit-list">{auditLogs.map((e,i)=><div key={i} className="audit-row" data-testid={`audit-row-${i}`}><span className={`audit-badge ab-${e.action.toLowerCase()}`}>{e.action}</span><span className="audit-detail">{e.detail||'—'}</span><span className="audit-time">{new Date(e.ts).toLocaleString()}</span></div>)}</div>}</div></div>}

    {/* Settings Modal — Expanded */}
    {showSettings&&<div className="modal-backdrop"><div className="modal settings-modal" data-testid="settings-modal" style={{maxHeight:'88vh',overflowY:'auto'}}><button type="button" className="modal-close icon-btn" data-testid="close-settings" onClick={()=>setShowSettings(false)}><X/></button><p className="eyebrow">PREFERENCES</p><h2>Settings</h2><div className="settings-list">
      <div className="settings-row" data-testid="autofill-setting"><div className="settings-info"><b>Browser Autofill</b><p>Allow browser to autofill and suggest saving vault values in forms.</p></div><label className="toggle-switch"><input type="checkbox" checked={settings.autofill} onChange={e=>saveSettingsPref({...settings,autofill:e.target.checked})}/><span className="toggle-slider"/></label></div>
      <div className="settings-row" data-testid="pin-setting"><div className="settings-info"><b>Vault PIN Lock</b><p>Auto-locks vault after 5 min of inactivity.</p></div><label className="toggle-switch"><input type="checkbox" checked={pinEnabled} onChange={e=>{if(!e.target.checked){localStorage.removeItem('vault_pin_hash');setPinEnabled(false);setShowPinLock(false);setSetupPinMode(false);if(inactivityRef.current)clearTimeout(inactivityRef.current);toast.success('PIN lock disabled')}else setSetupPinMode(true)}}/><span className="toggle-slider"/></label></div>
      {setupPinMode&&<div className="pin-setup-section"><p className="muted" style={{fontSize:'12px',margin:'0 0 10px'}}>Set your 4-digit PIN:</p><div className="pin-setup-row"><input type="password" maxLength="4" inputMode="numeric" data-testid="pin-setup-input" value={setupPinValue} onChange={e=>setSetupPinValue(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="1234" className="pin-input-field"/><input type="password" maxLength="4" inputMode="numeric" data-testid="pin-confirm-input" value={setupPinConfirm} onChange={e=>setSetupPinConfirm(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="Confirm" className="pin-input-field"/><button className="primary" data-testid="pin-confirm-btn" onClick={async()=>{if(setupPinValue.length!==4||setupPinValue!==setupPinConfirm){setSetupPinErr('PINs must be 4 digits and match');return}const h=await hashPin(setupPinValue);localStorage.setItem('vault_pin_hash',h);setPinEnabled(true);setSetupPinMode(false);setSetupPinValue('');setSetupPinConfirm('');setSetupPinErr('');toast.success('PIN lock enabled!')}}>Set PIN</button></div>{setupPinErr&&<p style={{color:'var(--red)',fontSize:'12px',marginTop:'6px'}}>{setupPinErr}</p>}</div>}
      <div className="settings-divider"><span>LAYER 2 — BIRTHDAY</span></div>
      {!hasBirthday?<div className="settings-row clickable" data-testid="birthday-setup-btn" onClick={()=>{setShowBirthdaySetup(true);setShowSettings(false)}}><div className="settings-info"><b>Set Birthday</b><p>Add Layer 2 protection. You'll verify your birthday on every login.</p></div><Calendar size={16} style={{color:'var(--green)',flexShrink:0}}/></div>
      :<div className="settings-row"><div className="settings-info"><b>Birthday Set</b><p>Layer 2 is active. You verify your birthday on every login.</p></div><Check size={16} style={{color:'var(--green)',flexShrink:0}}/></div>}
      <div className="settings-divider"><span>LAYER 3 — CRYPTO TYPE PASS</span></div>
      <div className="settings-row" data-testid="l3-toggle-setting"><div className="settings-info"><b>Layer 3 Lock</b><p>Require crypto type pass verification on every login. You must pass a quiz to enable.</p></div><label className="toggle-switch"><input type="checkbox" checked={l3Enabled} onChange={e=>toggleL3(e.target.checked)}/><span className="toggle-slider"/></label></div>
      <div className="settings-row clickable" data-testid="l3-view-btn" onClick={async()=>{await loadL3Passwords();setShowL3View(true);setShowSettings(false)}}><div className="settings-info"><b>View My 20 Passwords</b><p>See your current Layer 3 crypto type passwords.</p></div><ArrowUpRight size={16} style={{color:'var(--muted)',flexShrink:0}}/></div>
      <div className="settings-row clickable" data-testid="l3-export-btn" onClick={exportL3Passwords}><div className="settings-info"><b>Export Passwords</b><p>Download your 20 crypto type passwords as a text file.</p></div><Download size={16} style={{color:'var(--muted)',flexShrink:0}}/></div>
      <div className="settings-row clickable" data-testid="l3-regen-btn" onClick={()=>{setShowL3Regen(true);setShowSettings(false)}}><div className="settings-info"><b>Regenerate Passwords</b><p>Get new random passwords. Max 3 changes per month. Requires password.</p></div><RefreshCw size={16} style={{color:'var(--muted)',flexShrink:0}}/></div>
      <div className="settings-divider"><span>SECURITY</span></div>
      <div className="settings-row" data-testid="disclaimer-toggle-setting"><div className="settings-info"><b>Disclaimer Notice</b><p>Show disclaimer about password leak responsibility on login.</p></div><label className="toggle-switch"><input type="checkbox" checked={disclaimerEnabled} onChange={e=>toggleDisclaimer(e.target.checked)}/><span className="toggle-slider"/></label></div>
      <div className="settings-divider"><span>HARDCORE MODE</span></div>
      <div className="settings-row clickable" data-testid="hardcore-btn" onClick={async()=>{await loadHardcore();setShowSecuritySettings(true);setShowSettings(false)}}><div className="settings-info"><b><Skull size={14} style={{display:'inline',verticalAlign:'middle',marginRight:'6px'}}/>Hardcore Mode</b><p>Auto-delete account on too many failures. Customize limits.</p></div><ArrowUpRight size={16} style={{color:'var(--red)',flexShrink:0}}/></div>
      <div className="settings-divider"><span>LEGAL & ACCOUNT</span></div>
      <div className="settings-row clickable" data-testid="terms-btn" onClick={()=>{setShowTerms(true);setShowSettings(false)}}><div className="settings-info"><b>Terms & Conditions</b></div><FileText size={16} style={{color:'var(--muted)',flexShrink:0}}/></div>
      <div className="settings-row clickable" data-testid="privacy-btn" onClick={()=>{setShowPrivacy(true);setShowSettings(false)}}><div className="settings-info"><b>Privacy Policy</b></div><FileText size={16} style={{color:'var(--muted)',flexShrink:0}}/></div>
      <div className="settings-row clickable danger-row" data-testid="logout-settings-btn" onClick={onLogout}><div className="settings-info"><b style={{color:'var(--red)'}}>Log Out</b><p>Sign out of your vault.</p></div><LogOut size={16} style={{color:'var(--red)',flexShrink:0}}/></div>
    </div></div></div>}

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

    {/* Birthday Setup for legacy users */}
    {showBirthdaySetup&&<div className="modal-backdrop"><div className="modal" data-testid="birthday-setup-modal"><button type="button" className="modal-close icon-btn" onClick={()=>{setShowBirthdaySetup(false);setBdaySetup('');setBdaySetupConfirm('')}}><X/></button><p className="eyebrow">LAYER 2 SETUP</p><h2>Set Your Birthday</h2>
      <p className="muted">This adds Layer 2 protection. You'll need to verify your birthday on every login. <b style={{color:'var(--red)'}}>This cannot be changed later.</b></p>
      <label>Birthday<input data-testid="bday-setup-input" type="date" value={bdaySetup} onChange={e=>setBdaySetup(e.target.value)} required/></label>
      <label>Confirm Birthday<input data-testid="bday-setup-confirm" type="date" value={bdaySetupConfirm} onChange={e=>setBdaySetupConfirm(e.target.value)} required/></label>
      <button className="primary wide" data-testid="bday-setup-submit" onClick={saveBirthday} disabled={!bdaySetup||!bdaySetupConfirm}><Calendar size={15}/> Set Birthday Permanently</button>
    </div></div>}

    {/* Hardcore Mode Settings */}
    {showSecuritySettings&&hardcoreData&&<div className="modal-backdrop"><div className="modal hardcore-modal" data-testid="hardcore-modal"><button type="button" className="modal-close icon-btn" onClick={()=>setShowSecuritySettings(false)}><X/></button><p className="eyebrow">DANGER ZONE</p><h2><Skull size={20}/> Hardcore Mode</h2>
      <p className="muted" style={{color:'#ff6b74'}}>When enabled, your account and ALL passwords will be PERMANENTLY DELETED if you exceed the failure limits below. This cannot be undone.</p>
      <div className="settings-row" style={{marginTop:'16px'}}><div className="settings-info"><b>Enable Hardcore Mode</b></div><label className="toggle-switch"><input type="checkbox" checked={hardcoreData.enabled} onChange={e=>{if(e.target.checked&&!window.confirm('Are you sure? This will permanently delete your account if you fail too many times. THIS CANNOT BE UNDONE.'))return;saveHardcore({...hardcoreData.settings,enabled:e.target.checked})}}/><span className="toggle-slider"/></label></div>
      <div className="hardcore-limits">
        <label>Max consecutive fail days before deletion<input data-testid="hc-fail-days" type="number" min="1" max="30" value={hardcoreData.settings.max_login_fail_days} onChange={e=>setHardcoreData(d=>({...d,settings:{...d.settings,max_login_fail_days:+e.target.value}}))}/></label>
        <label>Max total login failures before deletion<input data-testid="hc-total-fails" type="number" min="4" max="100" value={hardcoreData.settings.max_login_fails} onChange={e=>setHardcoreData(d=>({...d,settings:{...d.settings,max_login_fails:+e.target.value}}))}/></label>
        <label>Max tries per day<input data-testid="hc-daily-tries" type="number" min="1" max="20" value={hardcoreData.settings.max_daily_tries} onChange={e=>setHardcoreData(d=>({...d,settings:{...d.settings,max_daily_tries:+e.target.value}}))}/></label>
        <label>Max Layer 3 failures before deletion<input data-testid="hc-l3-fails" type="number" min="1" max="50" value={hardcoreData.settings.max_layer3_fails} onChange={e=>setHardcoreData(d=>({...d,settings:{...d.settings,max_layer3_fails:+e.target.value}}))}/></label>
      </div>
      <button className="primary wide" data-testid="hc-save-btn" style={{marginTop:'12px'}} onClick={()=>saveHardcore({...hardcoreData.settings,enabled:hardcoreData.enabled})}>Save Hardcore Settings</button>
      {hardcoreData.failed_logins&&<div className="hc-status" style={{marginTop:'16px',padding:'12px',background:'rgba(255,107,116,.08)',border:'1px solid rgba(255,107,116,.2)',borderRadius:'8px',fontSize:'12px',color:'var(--muted)'}}>
        <b style={{color:'var(--text)',display:'block',marginBottom:'6px'}}>Current Failure Status</b>
        <span>Total fails: {hardcoreData.failed_logins.count||0}</span><br/>
        <span>Consecutive fail days: {hardcoreData.failed_logins.consecutive_days||0}</span><br/>
        <span>Layer 3 fails: {hardcoreData.failed_logins.layer3_fails||0}</span>
      </div>}
    </div></div>}

    {/* Disclaimer Popup */}
    {showDisclaimer&&<div className="modal-backdrop" style={{zIndex:10}}><div className="modal disclaimer-modal" data-testid="disclaimer-modal">
      <div style={{textAlign:'center',marginBottom:'16px'}}><AlertTriangle size={40} style={{color:'#fbbf24'}}/></div>
      <h2 style={{textAlign:'center'}}>Important Disclaimer</h2>
      <div className="disclaimer-text" data-testid="disclaimer-text">
        <p>By using TopPass5, you acknowledge and agree to the following:</p>
        <ul><li>TopPass5 stores your passwords with AES encryption on our servers.</li><li><b>If any password is leaked, we are not responsible.</b></li><li>You are solely responsible for keeping your recovery phrase, birthday, and Layer 3 crypto type passwords safe.</li><li>There is NO password recovery mechanism — if you lose your credentials, your vault is permanently inaccessible.</li><li>Hardcore Mode can permanently delete your account. Use at your own risk.</li></ul>
        <p style={{fontWeight:'600',color:'var(--red)'}}>By clicking "I Understand & Accept", you agree to these terms.</p>
      </div>
      <button className="primary wide" data-testid="disclaimer-accept-btn" onClick={acceptDisclaimer} style={{marginTop:'12px'}}><Check size={16}/> I Understand & Accept</button>
    </div></div>}

    {/* Terms & Conditions */}
    {showTerms&&<div className="modal-backdrop"><div className="modal legal-modal" data-testid="terms-modal" style={{maxHeight:'88vh',overflowY:'auto'}}><button type="button" className="modal-close icon-btn" onClick={()=>setShowTerms(false)}><X/></button><p className="eyebrow">LEGAL</p><h2>Terms & Conditions</h2><div className="legal-text">
      <p><b>1. Service Description</b><br/>TopPass5 is a password and secure value management service that provides AES-encrypted storage for sensitive data.</p>
      <p><b>2. User Responsibilities</b><br/>You are responsible for maintaining the confidentiality of your account credentials, recovery phrase, birthday verification, and Layer 3 crypto type passwords. You must not share access credentials with unauthorized parties.</p>
      <p><b>3. No Liability for Leaks</b><br/>While we implement industry-standard encryption, TopPass5 and its operators assume NO liability for any data breaches, password leaks, or unauthorized access to your stored values. Use at your own risk.</p>
      <p><b>4. Account Deletion</b><br/>If Hardcore Mode is enabled, your account and all data may be permanently and irreversibly deleted upon exceeding configured failure thresholds. This action cannot be undone.</p>
      <p><b>5. No Recovery</b><br/>There is no forgot password mechanism for Layer 1 (email/password) or Layer 2 (birthday). Recovery is only possible via your 12-word recovery phrase.</p>
      <p><b>6. Service Changes</b><br/>We reserve the right to modify, suspend, or discontinue the service at any time without prior notice.</p>
    </div></div></div>}

    {/* Privacy Policy */}
    {showPrivacy&&<div className="modal-backdrop"><div className="modal legal-modal" data-testid="privacy-modal" style={{maxHeight:'88vh',overflowY:'auto'}}><button type="button" className="modal-close icon-btn" onClick={()=>setShowPrivacy(false)}><X/></button><p className="eyebrow">LEGAL</p><h2>Privacy Policy</h2><div className="legal-text">
      <p><b>1. Data Collection</b><br/>We collect your email address, hashed password, hashed birthday, and encrypted vault data. We do not store plaintext passwords or secrets.</p>
      <p><b>2. Encryption</b><br/>All vault items are encrypted with AES (Fernet) before storage. Birthday and recovery phrases are stored as one-way SHA-256 hashes.</p>
      <p><b>3. Data Usage</b><br/>Your data is used solely to provide the vault service. We do not sell, share, or monetize your personal information.</p>
      <p><b>4. Data Retention</b><br/>Data is retained for as long as your account is active. Upon account deletion (manual or via Hardcore Mode), all data is permanently removed.</p>
      <p><b>5. Security Measures</b><br/>We employ HTTPS, AES encryption, bcrypt password hashing, JWT authentication, and multi-layer verification to protect your data.</p>
      <p><b>6. Third Parties</b><br/>We may use Google OAuth for authentication. No vault data is shared with third parties.</p>
    </div></div></div>}

    {/* Help Modal */}
    {showHelp&&<div className="modal-backdrop"><div className="modal help-modal" data-testid="help-modal"><button type="button" className="modal-close icon-btn" data-testid="close-help" onClick={()=>setShowHelp(false)}><X/></button><p className="eyebrow">FEATURE GUIDE</p><h2>TopPass5 — Complete Guide</h2><div className="help-content">
      <div className="help-section"><div className="help-sec-icon"><LockKeyhole size={18}/></div><div><h3>Vault Items</h3><p>Store any secret — passwords, API keys, notes, Wi-Fi, bank PINs. Every value is AES-encrypted. Use <b>Reveal</b>, <b>Copy</b>, <b>Edit</b>, or <b>Delete</b> from the action icons on each item. Click the <b>gear icon</b> to view item properties quickly.</p></div></div>
      <div className="help-section help-section-adv"><div className="help-sec-icon adv-icon"><Lock size={18}/></div><div><h3>Advance Mode <span className="adv-badge"><Lock size={10}/> Extra Lock</span></h3><p>A super-secret layer for your most sensitive items. Each item gets its own custom passphrase that only you know.</p><ul className="help-list"><li><b>Reveal, Copy, Edit:</b> all require the extra passphrase first.</li><li><b>Sharing disabled:</b> Advance Mode items cannot be shared via links.</li><li><b>Download disabled:</b> Cannot be exported individually.</li><li><b>4-attempt lockout:</b> After 4 wrong passphrases, the item locks for 3 days. No exceptions.</li><li><b>No recovery:</b> If you forget the passphrase, the item is permanently inaccessible.</li><li><b>Best for:</b> Crypto seed phrases, banking PINs, master passwords.</li></ul></div></div>
      <div className="help-section"><div className="help-sec-icon"><ShieldCheck size={18}/></div><div><h3>Layer 3 — Recovery Phrase</h3><p>12-word crypto-wallet style backup generated at signup. Use it to sign in OR reset your password without email. Store offline (paper, safe). We cannot recover this if lost.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Share2 size={18}/></div><div><h3>Secure Share Links</h3><p>Click the <b>share icon</b> on any item (not Advance Mode) to create a time-limited link (1h/12h/24h/7d). Anyone with the link can view the value — no account needed. Manage and revoke active links via <b>My Share Links</b> in the sidebar.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Timer size={18}/></div><div><h3>TOTP / Authenticator</h3><p>Store 2FA Base32 secrets. Click the <b>clock icon</b> to generate the current 6-digit OTP code (auto-copied). Compatible with all TOTP apps.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><ShieldAlert size={18}/></div><div><h3>Breach Monitoring</h3><p>Checks passwords against HaveIBeenPwned automatically on login. Badge on Security Report shows how many are breached. Use the <b>shield icon</b> per item or "Re-check all" for a fresh scan.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Gauge size={18}/></div><div><h3>Security Report</h3><p>Vault health score 0–100. Detects <b>weak</b> (&lt;10 chars), <b>reused</b>, and <b>old</b> (90d+) passwords. <b>Click any item name</b> in the report to jump directly to editing it.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Settings size={18}/></div><div><h3>Settings — PIN Lock &amp; Autofill</h3><p><b>Vault PIN Lock:</b> Set a 4-digit PIN that automatically locks your vault after 5 minutes of inactivity — safe to leave the tab open. <b>Browser Autofill:</b> Disable if you don't want your browser saving vault values.</p></div></div>
    </div></div></div>}

    {/* Item Properties Modal */}
    {showItemProps&&<div className="modal-backdrop"><div className="modal item-props-modal" data-testid="item-props-modal"><button type="button" className="modal-close icon-btn" onClick={()=>setShowItemProps(null)}><X/></button><p className="eyebrow">ITEM PROPERTIES</p><h2>{showItemProps.name}</h2><div className="props-grid">
      <div className="prop-row"><span>Category</span><b>{showItemProps.category}</b></div>
      <div className="prop-row"><span>Website URL</span>{showItemProps.url?<a href={showItemProps.url} target="_blank" rel="noopener noreferrer" className="url-link">{showItemProps.url}<ExternalLink size={11} style={{marginLeft:'4px'}}/></a>:<span className="muted-sm">Not set</span>}</div>
      <div className="prop-row"><span>Advance Mode</span><b>{showItemProps.advance_mode?<span className="adv-badge"><Lock size={11}/> {isItemLocked(showItemProps)?'Locked (3-day)':'Active'}</span>:<span className="muted-sm">Off</span>}</b></div>
      <div className="prop-row"><span>Sharing</span><b>{showItemProps.advance_mode?<span className="muted-sm">Disabled (Advance Mode)</span>:'Enabled'}</b></div>
      <div className="prop-row"><span>TOTP</span><b>{showItemProps.has_totp?'Configured':'Not set'}</b></div>
      <div className="prop-row"><span>Created</span><b>{new Date(showItemProps.created_at).toLocaleDateString()}</b></div>
      <div className="prop-row"><span>Last updated</span><b>{new Date(showItemProps.updated_at).toLocaleDateString()}</b></div>
    </div><button className="primary wide" data-testid="props-edit-button" onClick={()=>{setShowItemProps(null);startEdit(showItemProps)}}><Pencil size={15}/> Edit This Item</button></div></div>}

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
  const [data,setData]=useState(null); const [err,setErr]=useState('');
  useEffect(()=>{client.get(`/share/${token}`).then(r=>setData(r.data)).catch(e=>setErr(e.response?.data?.detail||'This link has expired or is invalid'))},[token]);
  const copy=()=>{copyText(data.value);toast.success('Copied!')};
  if(err)return <div className="share-screen"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div><div className="share-card"><p className="eyebrow">SHARE LINK</p><h2>Link Expired</h2><p className="muted">{err}</p></div><Toaster theme="dark"/></div>;
  if(!data)return <LoadingScreen/>;
  return <div className="share-screen"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div><div className="share-card" data-testid="share-view-card"><p className="eyebrow">SHARED WITH YOU</p><h2>{data.name}</h2><div className="share-value-box" data-testid="share-value">{data.value}</div><button className="primary wide" onClick={copy}><Copy size={15}/> Copy value</button><p className="share-exp">Expires {new Date(data.expires).toLocaleString()}</p></div><Toaster theme="dark"/></div>
}

function LandingPage({onGetStarted}){
  return(
    <div className="landing-page" data-testid="landing-page">
      <nav className="landing-nav"><div className="landing-logo"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/><span>TOPPASS5</span></div><button className="primary" data-testid="landing-get-started" onClick={onGetStarted}>Get Started <ArrowUpRight size={16}/></button></nav>
      <section className="landing-hero"><div className="landing-hero-content"><p className="eyebrow">MILITARY-GRADE ENCRYPTION</p><h1>Your passwords<br/>deserve a <em>fortress.</em></h1><p className="landing-sub">TopPass5 is a zero-knowledge encrypted vault that protects your most sensitive data with multi-layer authentication, crypto-style security, and AES-256 encryption.</p><div className="landing-ctas"><button className="primary landing-cta-main" data-testid="landing-cta-create" onClick={onGetStarted}><LockKeyhole size={18}/> Create Your Vault</button><button className="secondary landing-cta-sec" onClick={()=>document.getElementById('features')?.scrollIntoView({behavior:'smooth'})}><Eye size={16}/> See How It Works</button></div></div><div className="landing-hero-visual"><div className="vault-graphic"><div className="vault-ring ring1"/><div className="vault-ring ring2"/><div className="vault-ring ring3"/><div className="vault-core"><ShieldCheck size={48}/></div></div></div></section>
      <section className="landing-features" id="features"><p className="eyebrow" style={{textAlign:'center'}}>WHY TOPPASS5</p><h2 style={{textAlign:'center',marginBottom:'40px'}}>Security that never sleeps</h2><div className="feature-grid">
        <div className="feature-card" data-testid="feature-encryption"><div className="feature-icon"><Lock size={24}/></div><h3>AES-256 Encryption</h3><p>Every password and value is encrypted before it ever touches our servers. Even we can't read your data.</p></div>
        <div className="feature-card" data-testid="feature-multilayer"><div className="feature-icon"><Shield size={24}/></div><h3>Multi-Layer Auth</h3><p>3 layers of protection: Email + Password, Birthday verification, and Crypto Type Pass quiz — all required to access your vault.</p></div>
        <div className="feature-card" data-testid="feature-crypto"><div className="feature-icon"><KeyRound size={24}/></div><h3>Crypto Type Pass</h3><p>20 unique 5-character passwords generated for you. The system quizzes you on random ones — like a crypto wallet, but for your vault.</p></div>
        <div className="feature-card" data-testid="feature-hardcore"><div className="feature-icon"><Skull size={24}/></div><h3>Hardcore Mode</h3><p>Optional self-destruct. Too many failed attempts? Account and all data permanently deleted. Customizable limits.</p></div>
        <div className="feature-card" data-testid="feature-zero"><div className="feature-icon"><EyeOff size={24}/></div><h3>Zero Knowledge</h3><p>We never see your passwords in plaintext. Your birthday and crypto passes are stored as one-way hashes.</p></div>
        <div className="feature-card" data-testid="feature-advance"><div className="feature-icon"><ShieldAlert size={24}/></div><h3>Advance Mode</h3><p>Extra passphrase protection per item. 4 wrong attempts = 3-day lockout. No exceptions, no recovery.</p></div>
      </div></section>
      <section className="landing-security"><div className="security-badge-row"><div className="sec-badge"><Lock size={20}/><span>AES-256</span></div><div className="sec-badge"><Shield size={20}/><span>3-Layer Auth</span></div><div className="sec-badge"><ShieldCheck size={20}/><span>Zero Knowledge</span></div><div className="sec-badge"><Activity size={20}/><span>Audit Logs</span></div></div><h2>Built for people who take security seriously</h2><p>TopPass5 is designed from the ground up with security as the core principle. No shortcuts, no compromises. Your data stays encrypted, your identity stays verified, and your vault stays yours.</p></section>
      <footer className="landing-footer"><div className="footer-brand"><img src="https://img.sanishtech.com/u/7ad9ec964e6da7120bb20b71fd4cbcb3.png" alt="ZNQ" className="znq-logo"/><span>by ZNQ NETWORK</span></div><p>TopPass5 — Your secrets. Only yours.</p></footer>
    </div>
  );
}

export default function App(){
  const [user,setUser]=useState(null); const [booting,setBooting]=useState(true);
  const [showLanding,setShowLanding]=useState(true);
  const [showAuth,setShowAuth]=useState(false);
  useEffect(()=>{
    const minDelay=new Promise(r=>setTimeout(r,6000));
    const t=new URLSearchParams(window.location.search).get('token');if(t){localStorage.setItem('vault_token',t);window.history.replaceState({},'','/')}
    const token=localStorage.getItem('vault_token');
    const authCheck=token?client.get('/auth/me',authHeader()).then(r=>{setUser(r.data);setShowLanding(false);setShowAuth(false)}).catch(()=>localStorage.removeItem('vault_token')):Promise.resolve();
    Promise.all([minDelay,authCheck]).finally(()=>setBooting(false));
  },[]);
  const shareToken=new URLSearchParams(window.location.search).get('share');
  const resetToken=new URLSearchParams(window.location.search).get('reset');
  if(shareToken)return <ShareView token={shareToken}/>;
  if(resetToken)return <ResetView token={resetToken}/>;
  const logout=()=>{localStorage.removeItem('vault_token');setUser(null);setShowLanding(true);setShowAuth(false)};
  if(booting)return <LoadingScreen/>;
  const isAdmin=user?.is_admin;
  if(isAdmin&&new URLSearchParams(window.location.search).get('admin')==='1')return <AdminPanel user={user} onLogout={logout}/>;
  const onLogin=(u)=>{setUser(u);setShowLanding(false);setShowAuth(false)};
  if(user)return <Vault user={user} onLogout={logout}/>;
  if(showAuth)return <Auth onLogin={onLogin}/>;
  return <LandingPage onGetStarted={()=>{setShowLanding(false);setShowAuth(true)}}/>;
}

function LoadingScreen(){
  return <div className="loading-screen"><div className="ls-bar"/><div className="ls-grid-bg"/>
    <div className="ls-center">
      <div className="ls-shield"><ShieldCheck size={36}/></div>
      <div className="ls-title">TOPPASS5</div>
      <div className="ls-sub">SECURING YOUR VAULT<span className="ls-cursor"/></div>
      <div className="ls-features"><span><Lock size={12}/> AES-256 Encrypted</span><span><Shield size={12}/> 3-Layer Auth</span><span><Activity size={12}/> Zero Knowledge</span></div>
      <div className="ls-tagline">Military-grade security for your passwords</div>
    </div>
    <div className="ls-company"><img src="https://img.sanishtech.com/u/7ad9ec964e6da7120bb20b71fd4cbcb3.png" alt="ZNQ NETWORK" className="znq-logo"/><p className="loading-by">by ZNQ NETWORK</p><p className="ls-safety">Safety First &bull; Security Always &bull; Data Protected</p></div>
  </div>
}
