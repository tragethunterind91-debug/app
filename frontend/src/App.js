import {useEffect, useMemo, useState} from 'react';
import axios from 'axios';
import {ShieldCheck, LockKeyhole, Plus, Search, Eye, EyeOff, Copy, Download, Trash2, LogOut, KeyRound, ArrowUpRight, X, Check, RefreshCw, Pencil, Wand2, Upload, Share2, Activity, ShieldAlert, Gauge, Timer, ExternalLink, Lock, HelpCircle, Settings} from 'lucide-react';
import './App.css';
import './brand.css';
import {Toaster, toast} from 'sonner';
import AdminPanel from './AdminPanel';

const API=`${process.env.REACT_APP_BACKEND_URL}/api`;
const client=axios.create({baseURL:API});
const authHeader=()=>({headers:{Authorization:`Bearer ${localStorage.getItem('vault_token')}`} });
const copyText=async(text)=>{try{await navigator.clipboard.writeText(text)}catch{const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}};

function Auth({onLogin}){
  const [mode,setMode]=useState('login');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);
  const [phraseModal,setPhraseModal]=useState(null);const [phraseMode,setPhraseMode]=useState(false);const [phraseWords,setPhraseWords]=useState('');const [phraseNewPwd,setPhraseNewPwd]=useState('');const [phraseAction,setPhraseAction]=useState('login');
  const [forgotModal,setForgotModal]=useState(null);

  const submit=async(e)=>{
    e.preventDefault();setBusy(true);
    try{
      if(mode==='forgot'){
        const r=await client.post('/auth/recovery',{email});
        setForgotModal({link:`${window.location.origin}/?reset=${r.data.reset_code}`});
      }else{
        const r=await client.post(`/auth/${mode==='login'?'login':'register'}`,{email,password});
        localStorage.setItem('vault_token',r.data.token);
        if(r.data.phrase)setPhraseModal({phrase:r.data.phrase,user:r.data.user});else onLogin(r.data.user);
      }
    }catch(e){toast.error(e.response?.data?.detail||'Could not sign in')}finally{setBusy(false)}
  };

  const submitPhrase=async(e)=>{e.preventDefault();setBusy(true);try{if(phraseAction==='login'){const r=await client.post('/auth/phrase-login',{email,phrase:phraseWords});localStorage.setItem('vault_token',r.data.token);onLogin(r.data.user)}else{await client.post('/auth/phrase-reset',{email,phrase:phraseWords,new_password:phraseNewPwd});toast.success('Password reset! Please sign in.');setPhraseMode(false);setMode('login')}}catch(e){toast.error(e.response?.data?.detail||'Recovery failed')}finally{setBusy(false)}};

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
          {!phraseMode?(
            mode==='forgot'?(
              <>
                <p className="eyebrow">PASSWORD RESET</p>
                <h2>Forgot password?</h2>
                <p className="muted">Enter your email and we'll generate a reset link you can open in your browser.</p>
                <form onSubmit={submit} data-testid="forgot-form">
                  <label>Email<input data-testid="forgot-email-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label>
                  <button className="primary wide" data-testid="forgot-submit" disabled={busy}>{busy?'Generating…':'Get Reset Link'} <ArrowUpRight size={17}/></button>
                </form>
                <button className="link-btn" data-testid="back-to-login" onClick={()=>setMode('login')}>← Back to login</button>
              </>
            ):(
              <>
                <p className="eyebrow">SECURE ACCESS</p>
                <h2>{mode==='login'?'Welcome back':'Create your vault'}</h2>
                <p className="muted">{mode==='login'?'Your private command center is waiting.':'Start protecting what matters in under a minute.'}</p>
                <form onSubmit={submit} data-testid="auth-form">
                  <label>Email<input data-testid="auth-email-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label>
                  <label>Password<input data-testid="auth-password-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength="8" placeholder="At least 8 characters"/></label>
                  <button className="primary wide" data-testid="auth-submit-button" disabled={busy}>{busy?'Securing…':mode==='login'?'Unlock vault':'Create vault'} <ArrowUpRight size={17}/></button>
                </form>
                <div className="or"><span>or continue with</span></div>
                <a className="google-btn" data-testid="google-login-button" href={`${API}/auth/google?frontend_origin=${encodeURIComponent(window.location.origin)}`}><span className="google-g">G</span> Continue with Google</a>
                <button className="link-btn" data-testid="auth-mode-toggle" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?"I don't have an account":"I already have an account"}</button>
                <div className="auth-links">
                  {mode==='login'&&<button className="recovery-link" data-testid="forgot-password-button" onClick={()=>{setEmail('');setMode('forgot')}}>Forgot password?</button>}
                  <button className="link-btn phrase-link" data-testid="phrase-login-button" onClick={()=>setPhraseMode(true)}>Use Recovery Phrase</button>
                </div>
              </>
            )
          ):(
            <>
              <p className="eyebrow">LAYER 3 RECOVERY</p>
              <h2>Recovery Phrase</h2>
              <p className="muted">Enter your 12-word backup phrase to access your vault or reset your password.</p>
              <div className="phrase-action-tabs">
                <button type="button" className={phraseAction==='login'?'active':''} data-testid="phrase-tab-login" onClick={()=>setPhraseAction('login')}>Sign In</button>
                <button type="button" className={phraseAction==='reset'?'active':''} data-testid="phrase-tab-reset" onClick={()=>setPhraseAction('reset')}>Reset Password</button>
              </div>
              <form onSubmit={submitPhrase} data-testid="phrase-form">
                <label>Email<input data-testid="phrase-email-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label>
                <label>Recovery Phrase (12 words)<textarea data-testid="phrase-words-input" value={phraseWords} onChange={e=>setPhraseWords(e.target.value)} required placeholder="word1 word2 word3 ... word12" rows="3" style={{resize:'none',fontFamily:'monospace'}}/></label>
                {phraseAction==='reset'&&<label>New Password<input data-testid="phrase-newpwd-input" type="password" value={phraseNewPwd} onChange={e=>setPhraseNewPwd(e.target.value)} required minLength="8" placeholder="New password (8+ chars)"/></label>}
                <button className="primary wide" data-testid="phrase-submit-button" disabled={busy}>{busy?'Verifying…':phraseAction==='login'?'Unlock with Phrase':'Reset Password'} <ArrowUpRight size={17}/></button>
              </form>
              <button className="link-btn" data-testid="phrase-back-button" onClick={()=>setPhraseMode(false)}>← Back to login</button>
            </>
          )}
        </div>
      </section>
      {phraseModal&&<div className="modal-backdrop"><div className="modal phrase-reveal-modal" data-testid="phrase-reveal-modal"><p className="eyebrow">LAYER 3 BACKUP</p><h2>Your Recovery Phrase</h2><p className="muted phrase-warn">Write these 12 words in order. Store them safely offline (paper, safe, password manager). This is the ONLY backup if you lose your email password.</p><div className="phrase-grid" data-testid="phrase-grid">{phraseModal.phrase.split(' ').map((w,i)=><div key={i} className="phrase-word" data-testid={`phrase-word-${i}`}><span className="phrase-num">{i+1}</span><span>{w}</span></div>)}</div><div className="phrase-actions"><button className="secondary" data-testid="copy-phrase-button" onClick={()=>{copyText(phraseModal.phrase);toast.success('Recovery phrase copied!')}}><Copy size={14}/> Copy All Words</button><button className="primary" data-testid="phrase-confirm-button" onClick={()=>{onLogin(phraseModal.user);setPhraseModal(null)}}>I've saved it — Enter vault</button></div></div></div>}
      {forgotModal&&<div className="modal-backdrop"><div className="modal forgot-modal" data-testid="forgot-modal"><button type="button" className="modal-close icon-btn" onClick={()=>{setForgotModal(null);setMode('login')}}><X/></button><p className="eyebrow">PASSWORD RESET</p><h2>Reset Link Ready</h2><p className="muted">Copy this link and open it in your browser to set a new password. It expires in 1 hour.</p><div className="share-link-box" data-testid="reset-link-display">{forgotModal.link}</div><button className="primary wide" data-testid="copy-reset-link" onClick={()=>{copyText(forgotModal.link);toast.success('Reset link copied to clipboard!')}}><Copy size={15}/> Copy Reset Link</button><p className="reset-note">Tip: Configure an email service provider so this link is sent automatically.</p></div></div>}
    </main>
  );
}

function Vault({user,onLogout}){
  const [items,setItems]=useState([]); const [query,setQuery]=useState(''); const [showForm,setShowForm]=useState(false); const [editing,setEditing]=useState(null); const [visible,setVisible]=useState({}); const [values,setValues]=useState({}); const [form,setForm]=useState({name:'',value:'',category:'Secret',totp_secret:'',url:'',advance_mode:false,advance_passphrase:''}); const [showGen,setShowGen]=useState(false); const [genOpts,setGenOpts]=useState({length:16,upper:true,lower:true,nums:true,syms:false}); const [genPwd,setGenPwd]=useState(''); const [cat,setCat]=useState('All'); const [shareModal,setShareModal]=useState(null); const [showAudit,setShowAudit]=useState(false); const [auditLogs,setAuditLogs]=useState([]); const [secReport,setSecReport]=useState(null); const [showSec,setShowSec]=useState(false); const [categories,setCategories]=useState(['Login','API key','Secret','Secure note','Wi-Fi','Bank']); const [breachBadge,setBreachBadge]=useState(0); const [breachChecking,setBreachChecking]=useState(false); const [breachScanned,setBreachScanned]=useState(false); const [showSharePicker,setShowSharePicker]=useState(null); const [showAdvancePrompt,setShowAdvancePrompt]=useState(null); const [advanceInput,setAdvanceInput]=useState(''); const [showShares,setShowShares]=useState(false); const [activeShares,setActiveShares]=useState([]); const [phraseGenModal,setPhraseGenModal]=useState(null); const [showSettings,setShowSettings]=useState(false); const [showHelp,setShowHelp]=useState(false); const [settings,setSettings]=useState({autofill:true});

  const load=()=>{client.get('/items',authHeader()).then(r=>{setItems(r.data);setTimeout(()=>runBackgroundBreachCheck(r.data),800)}).catch(()=>onLogout()); client.get('/preferences',authHeader()).then(r=>{if(r.data.categories)setCategories(r.data.categories);if(typeof r.data.autofill==='boolean')setSettings(s=>({...s,autofill:r.data.autofill}))}).catch(()=>{})}; useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>items.filter(i=>i.name.toLowerCase().includes(query.toLowerCase())&&(cat==='All'||i.category===cat)),[items,query,cat]);

  const save=async(e)=>{e.preventDefault(); try{if(editing) await client.put(`/items/${editing.id}`,form,authHeader()); else await client.post('/items',form,authHeader()); if(form.category&&!categories.includes(form.category))saveCategory(form.category); toast.success(editing?'Item updated':'Item encrypted and saved'); setShowForm(false);setEditing(null);setForm({name:'',value:'',category:'Secret',totp_secret:'',url:'',advance_mode:false,advance_passphrase:''});load()}catch(e){toast.error(e.response?.data?.detail||'Save failed')}};

  const reveal=async(id)=>{const item=items.find(i=>i.id===id);if(item?.advance_mode&&!values[id]){setAdvanceInput('');setShowAdvancePrompt({item,action:'reveal'});return null}if(values[id]){setVisible({...visible,[id]:!visible[id]});return values[id]} const r=await client.get(`/items/${id}/value`,authHeader()); setValues({...values,[id]:r.data.value});setVisible({...visible,[id]:true});return r.data.value};

  const copy=async(id)=>{const item=items.find(i=>i.id===id);if(item?.advance_mode&&!values[id]){setAdvanceInput('');setShowAdvancePrompt({item,action:'copy'});return}const value=values[id]||await reveal(id);if(!value)return;await copyText(value);toast.success('Copied to clipboard')};

  const remove=async(id)=>{if(window.confirm('Delete this item permanently?')){await client.delete(`/items/${id}`,authHeader());toast.success('Item deleted');load()}};

  const startEdit=async(item)=>{if(item.advance_mode&&!values[item.id]){setAdvanceInput('');setShowAdvancePrompt({item,action:'edit'});return}let v=values[item.id];if(!v){const r=await client.get(`/items/${item.id}/value`,authHeader());v=r.data.value;setValues(p=>({...p,[item.id]:v}))}setEditing(item);setForm({name:item.name,value:v,category:item.category,totp_secret:'',url:item.url||'',advance_mode:item.advance_mode||false,advance_passphrase:''});setShowForm(true)};

  const submitAdvancePassphrase=async()=>{if(!showAdvancePrompt)return;const{item,action}=showAdvancePrompt;try{const r=await client.post(`/items/${item.id}/advance-reveal`,{passphrase:advanceInput},authHeader());const val=r.data.value;setValues(p=>({...p,[item.id]:val}));setShowAdvancePrompt(null);setAdvanceInput('');if(action==='reveal'){setVisible(p=>({...p,[item.id]:true}))}else if(action==='copy'){await copyText(val);toast.success('Copied!')}else if(action==='edit'){setEditing(item);setForm({name:item.name,value:val,category:item.category,totp_secret:'',url:item.url||'',advance_mode:true,advance_passphrase:''});setShowForm(true)}}catch(e){toast.error(e.response?.data?.detail||'Wrong passphrase')}};

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
  const genPhrase=async()=>{if(!window.confirm('Generate a new 12-word recovery phrase? This replaces any existing phrase.'))return;try{const r=await client.post('/auth/set-phrase',{},authHeader());setPhraseGenModal(r.data.phrase)}catch{toast.error('Could not generate phrase')}};

  const autoComp=settings.autofill?undefined:'off';

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/></div>
      <div className="side-label">YOUR SPACE</div>
      <div className="nav-active" data-testid="vault-nav"><KeyRound size={17}/>Vault <span data-testid="item-count">{items.length}</span></div>
      <div className="nav-item" data-testid="activity-nav" onClick={loadAudit}><Activity size={17}/>Activity</div>
      <div className="nav-item" data-testid="shares-nav" onClick={loadShares}><Share2 size={17}/>My Shares</div>
      <div className="nav-item" data-testid="security-report-nav" onClick={loadSecReport}>
        <Gauge size={17}/>Security Report
        {breachChecking?<span className="breach-checking"/>:breachScanned?(<span className={`breach-badge${breachBadge>0?'':' breach-ok'}`} data-testid="breach-badge">{breachBadge>0?breachBadge:'✓'}</span>):null}
      </div>
      <div className="side-label lower">SECURITY</div>
      <div className="nav-item" data-testid="phrase-nav" onClick={genPhrase}><ShieldCheck size={17}/>Backup Phrase</div>
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
        {filtered.length===0?<div className="empty-state" data-testid="empty-vault-state"><div className="empty-icon"><LockKeyhole/></div><h3>{query?'Nothing found':'Your vault is quiet'}</h3><p>{query?'Try another name.':'Add your first value and keep it protected.'}</p><button className="primary" data-testid="empty-add-button" onClick={()=>setShowForm(true)}><Plus size={17}/> Add your first value</button></div>:<div className="item-list">{filtered.map(item=><article className="item-row" key={item.id} data-testid={`vault-item-${item.id}`}><div className="item-icon"><LockKeyhole size={18}/></div><div className="item-info"><div className="item-name-row"><b data-testid={`item-name-${item.id}`}>{item.name}</b>{item.advance_mode&&<span className="adv-badge" title="Advance Mode — extra passphrase required"><Lock size={12}/></span>}{item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer" className="url-link" title={item.url} onClick={e=>e.stopPropagation()}><ExternalLink size={13}/></a>}</div><span>{item.category} · Updated {new Date(item.updated_at).toLocaleDateString()}</span></div><div className="secret-preview" data-testid={`item-value-${item.id}`}>{visible[item.id]?values[item.id]:'••••••••••••'}</div><div className="item-actions">{item.has_totp&&<button className="icon-btn totp-btn" data-testid={`totp-item-${item.id}`} onClick={()=>revealTOTP(item)} title="Get OTP code"><Timer size={16}/></button>}<button className="icon-btn" data-testid={`reveal-item-${item.id}`} onClick={()=>reveal(item.id)} title="Reveal"><Eye size={17}/></button><button className="icon-btn" data-testid={`copy-item-${item.id}`} onClick={()=>copy(item.id)} title="Copy"><Copy size={17}/></button><button className="icon-btn" data-testid={`breach-item-${item.id}`} onClick={()=>checkBreach(item)} title="Check breach"><ShieldAlert size={16}/></button>{!item.advance_mode&&<button className="icon-btn" data-testid={`download-item-${item.id}`} onClick={()=>exportItem(item)} title="Download"><Download size={17}/></button>}{!item.advance_mode&&<button className="icon-btn" data-testid={`share-item-${item.id}`} onClick={()=>setShowSharePicker(item)} title="Share"><Share2 size={16}/></button>}<button className="icon-btn" data-testid={`edit-item-${item.id}`} onClick={()=>startEdit(item)} title="Edit"><Pencil size={16}/></button><button className="icon-btn danger" data-testid={`delete-item-${item.id}`} onClick={()=>remove(item.id)} title="Delete"><Trash2 size={17}/></button></div></article>)}</div>}
      </section>
    </main>

    {/* Item Form Modal */}
    {showForm&&<div className="modal-backdrop"><form className="modal" onSubmit={save} data-testid="item-form"><button type="button" className="modal-close icon-btn" data-testid="close-item-modal" onClick={()=>{setShowForm(false);setEditing(null);setForm({name:'',value:'',category:'Secret',totp_secret:'',url:'',advance_mode:false,advance_passphrase:''})}}><X/></button><p className="eyebrow">{editing?'EDIT VALUE':'NEW VALUE'}</p><h2>{editing?'Update protected value':'Add to your vault'}</h2><label>Name<input data-testid="item-name-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="e.g. Wi-Fi password"/></label><label>Value<div className="gen-row"><textarea data-testid="item-value-input" autoComplete={autoComp} value={form.value} onChange={e=>setForm({...form,value:e.target.value})} required placeholder="Your secret value" rows="4"/><button type="button" className="gen-inline" data-testid="generate-inline-button" onClick={()=>setForm({...form,value:mkPwd(genOpts)})} title="Generate password"><Wand2 size={14}/> Generate</button></div></label><label>Category<input list="cat-opts" data-testid="item-category-input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="e.g. Login, API key…"/><datalist id="cat-opts">{categories.map(c=><option key={c} value={c}/>)}</datalist></label><label>Authenticator Secret (TOTP) — optional<input data-testid="item-totp-input" type="text" value={form.totp_secret||''} onChange={e=>setForm({...form,totp_secret:e.target.value})} placeholder="Base32 secret e.g. JBSWY3DPEHPK3PXP"/></label><label>Website URL — optional<input data-testid="item-url-input" type="url" value={form.url||''} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://example.com"/></label><div className="advance-toggle"><label className="advance-check"><input type="checkbox" data-testid="advance-mode-toggle" checked={form.advance_mode||false} onChange={e=>setForm({...form,advance_mode:e.target.checked,advance_passphrase:''})}/><Lock size={14}/> Enable Advance Mode</label>{form.advance_mode&&<label className="advance-pass">Secret Passphrase (you must remember this — no recovery)<input data-testid="advance-passphrase-input" type="password" autoComplete="new-password" value={form.advance_passphrase||''} onChange={e=>setForm({...form,advance_passphrase:e.target.value})} placeholder="e.g. elephant892"/></label>}</div><button className="primary wide" data-testid="save-item-button">{editing?'Save changes':'Encrypt & save'} <LockKeyhole size={16}/></button></form></div>}

    {/* Generator Modal */}
    {showGen&&<div className="modal-backdrop"><div className="modal gen-modal" data-testid="generator-modal"><button type="button" className="modal-close icon-btn" data-testid="close-generator" onClick={()=>setShowGen(false)}><X/></button><p className="eyebrow">SECURITY TOOL</p><h2>Password Generator</h2><div className="gen-output" data-testid="generated-password">{genPwd||'—'}</div><div className="gen-controls"><label className="gen-option">Length: <b>{genOpts.length}</b><input type="range" min="8" max="64" value={genOpts.length} onChange={e=>{const o={...genOpts,length:+e.target.value};setGenOpts(o);setGenPwd(mkPwd(o))}}/></label><label className="gen-option"><input type="checkbox" checked={genOpts.upper} onChange={e=>{const o={...genOpts,upper:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> A–Z Uppercase</label><label className="gen-option"><input type="checkbox" checked={genOpts.lower} onChange={e=>{const o={...genOpts,lower:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> a–z Lowercase</label><label className="gen-option"><input type="checkbox" checked={genOpts.nums} onChange={e=>{const o={...genOpts,nums:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> 0–9 Numbers</label><label className="gen-option"><input type="checkbox" checked={genOpts.syms} onChange={e=>{const o={...genOpts,syms:e.target.checked};setGenOpts(o);setGenPwd(mkPwd(o))}}/> !@# Symbols</label></div><div className="gen-actions"><button type="button" className="secondary" data-testid="regenerate-button" onClick={()=>setGenPwd(mkPwd(genOpts))}><RefreshCw size={15}/> Regenerate</button><button type="button" className="primary" data-testid="copy-generated-button" onClick={()=>{copyText(genPwd);toast.success('Password copied!')}}><Copy size={15}/> Copy</button></div></div></div>}

    {/* Advance Mode Prompt */}
    {showAdvancePrompt&&<div className="modal-backdrop"><div className="modal adv-modal" data-testid="advance-prompt-modal"><button type="button" className="modal-close icon-btn" onClick={()=>{setShowAdvancePrompt(null);setAdvanceInput('')}}><X/></button><p className="eyebrow">ADVANCE MODE</p><h2><Lock size={18}/> Enter Passphrase</h2><p className="muted">This item is locked with an extra passphrase. Enter it to proceed.</p><input data-testid="advance-passphrase-field" type="password" className="adv-input" value={advanceInput} onChange={e=>setAdvanceInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitAdvancePassphrase()} placeholder="Your secret passphrase" autoFocus/><button className="primary wide" data-testid="advance-submit-button" onClick={submitAdvancePassphrase}><Lock size={15}/> Unlock</button></div></div>}

    {/* My Shares Modal */}
    {showShares&&<div className="modal-backdrop"><div className="modal shares-modal" data-testid="my-shares-modal"><button type="button" className="modal-close icon-btn" data-testid="close-shares-modal" onClick={()=>setShowShares(false)}><X/></button><p className="eyebrow">ACTIVE LINKS</p><h2>My Shares</h2>{activeShares.length===0?<p className="muted">No active share links.</p>:<div className="shares-list">{activeShares.map((s,i)=><div key={i} className="share-row" data-testid={`share-row-${i}`}><div><b className="share-item-name">{s.item_name}</b><span className="share-exp">Expires {new Date(s.expires).toLocaleString()}</span></div><button className="icon-btn danger" data-testid={`revoke-share-${i}`} onClick={()=>revokeShare(s.token)} title="Revoke"><Trash2 size={15}/></button></div>)}</div>}</div></div>}

    {/* Share Picker */}
    {showSharePicker&&<div className="modal-backdrop"><div className="modal share-picker-modal" data-testid="share-picker-modal"><button type="button" className="modal-close icon-btn" data-testid="close-share-picker" onClick={()=>setShowSharePicker(null)}><X/></button><p className="eyebrow">SECURE SHARE</p><h2>Share "{showSharePicker.name}"</h2><p className="muted">Choose how long the link stays active:</p><div className="expiry-options">{[{h:1,label:'1 hour'},{h:12,label:'12 hours'},{h:24,label:'24 hours'},{h:168,label:'7 days'}].map(opt=><button key={opt.h} className="expiry-btn" data-testid={`expiry-${opt.h}h`} onClick={()=>shareItem(showSharePicker,opt.h)}>{opt.label}</button>)}</div></div></div>}

    {/* Share Link Modal */}
    {shareModal&&<div className="modal-backdrop"><div className="modal" data-testid="share-modal"><button type="button" className="modal-close icon-btn" data-testid="close-share-modal" onClick={()=>setShareModal(null)}><X/></button><p className="eyebrow">SECURE SHARE</p><h2>Share "{shareModal.item.name}"</h2><p className="muted">This link expires in {shareModal.hours} hours. Anyone with it can view the value.</p><div className="share-link-box" data-testid="share-link-display">{shareModal.link}</div><button className="primary wide" data-testid="copy-share-link-button" onClick={()=>{copyText(shareModal.link);toast.success('Link copied to clipboard!')}}><Copy size={15}/> Copy link</button></div></div>}

    {/* Security Report */}
    {showSec&&secReport&&<div className="modal-backdrop"><div className="modal sec-modal" data-testid="security-report-modal"><button type="button" className="modal-close icon-btn" data-testid="close-sec-modal" onClick={()=>setShowSec(false)}><X/></button><p className="eyebrow">VAULT HEALTH</p><h2>Security Report</h2><div className="sec-score-ring" data-testid="security-score"><span className="sec-score-num" style={{color:secReport.score>=80?'var(--green)':secReport.score>=50?'#fbbf24':'var(--red)'}}>{secReport.score}</span><span className="sec-score-label">/ 100</span></div><div className="sec-stats"><div className="sec-stat"><span className="sec-stat-n" style={{color:'var(--green)'}}>{secReport.total}</span><span>Total items</span></div><div className="sec-stat"><span className="sec-stat-n" style={{color:secReport.weak.length?'var(--red)':'var(--green)'}}>{secReport.weak.length}</span><span>Weak (&lt;10 chars)</span></div><div className="sec-stat"><span className="sec-stat-n" style={{color:secReport.reused.length?'#fbbf24':'var(--green)'}}>{secReport.reused.length}</span><span>Reused</span></div><div className="sec-stat"><span className="sec-stat-n" style={{color:secReport.old.length?'#fbbf24':'var(--green)'}}>{secReport.old.length}</span><span>Old (90d+)</span></div></div>{secReport.weak.length>0&&<div className="sec-list"><p className="sec-list-title danger-text">Weak passwords</p>{secReport.weak.map((n,i)=><div key={i} className="sec-item">{n}</div>)}</div>}{secReport.reused.length>0&&<div className="sec-list"><p className="sec-list-title warn-text">Reused passwords</p>{secReport.reused.map((names,i)=><div key={i} className="sec-item">{names.join(', ')}</div>)}</div>}{secReport.old.length>0&&<div className="sec-list"><p className="sec-list-title warn-text">Not updated in 90+ days</p>{secReport.old.map((n,i)=><div key={i} className="sec-item">{n}</div>)}</div>}<button type="button" className="secondary wide" data-testid="recheck-breach-button" onClick={()=>runBackgroundBreachCheck(items)} style={{marginTop:'16px'}}><ShieldAlert size={15}/> Re-check all for breaches</button></div></div>}

    {/* Audit Log */}
    {showAudit&&<div className="modal-backdrop"><div className="modal audit-modal" data-testid="audit-modal"><button type="button" className="modal-close icon-btn" data-testid="close-audit-modal" onClick={()=>setShowAudit(false)}><X/></button><p className="eyebrow">SECURITY</p><h2>Activity Log</h2>{auditLogs.length===0?<p className="muted">No activity yet.</p>:<div className="audit-list">{auditLogs.map((e,i)=><div key={i} className="audit-row" data-testid={`audit-row-${i}`}><span className={`audit-badge ab-${e.action.toLowerCase()}`}>{e.action}</span><span className="audit-detail">{e.detail||'—'}</span><span className="audit-time">{new Date(e.ts).toLocaleString()}</span></div>)}</div>}</div></div>}

    {/* Backup Phrase Generate Modal */}
    {phraseGenModal&&<div className="modal-backdrop"><div className="modal phrase-reveal-modal" data-testid="phrase-gen-modal"><button type="button" className="modal-close icon-btn" onClick={()=>setPhraseGenModal(null)}><X/></button><p className="eyebrow">CRYPTO BACKUP</p><h2>Your Recovery Phrase</h2><p className="muted phrase-warn">Save these 12 words safely. Use them to log in or reset your password if you ever lose access. Shown ONCE — we cannot recover this.</p><div className="phrase-grid" data-testid="phrase-gen-grid">{phraseGenModal.split(' ').map((w,i)=><div key={i} className="phrase-word"><span className="phrase-num">{i+1}</span><span>{w}</span></div>)}</div><div className="phrase-actions"><button className="secondary" data-testid="copy-gen-phrase-button" onClick={()=>{copyText(phraseGenModal);toast.success('Phrase copied!')}}><Copy size={14}/> Copy All Words</button><button className="primary" onClick={()=>setPhraseGenModal(null)}>Done — I've saved it</button></div></div></div>}

    {/* Settings Modal */}
    {showSettings&&<div className="modal-backdrop"><div className="modal settings-modal" data-testid="settings-modal"><button type="button" className="modal-close icon-btn" data-testid="close-settings" onClick={()=>setShowSettings(false)}><X/></button><p className="eyebrow">PREFERENCES</p><h2>Settings</h2><div className="settings-list"><div className="settings-row" data-testid="autofill-setting"><div className="settings-info"><b>Browser Autofill</b><p>Allow your browser to autofill and suggest saving vault values in forms. Disable on shared or public computers for maximum privacy.</p></div><label className="toggle-switch"><input type="checkbox" checked={settings.autofill} onChange={e=>saveSettingsPref({...settings,autofill:e.target.checked})}/><span className="toggle-slider"/></label></div></div></div></div>}

    {/* Help & Guide Modal */}
    {showHelp&&<div className="modal-backdrop"><div className="modal help-modal" data-testid="help-modal"><button type="button" className="modal-close icon-btn" data-testid="close-help" onClick={()=>setShowHelp(false)}><X/></button><p className="eyebrow">FEATURE GUIDE</p><h2>TopPass5 — Complete Guide</h2><div className="help-content">
      <div className="help-section"><div className="help-sec-icon"><LockKeyhole size={18}/></div><div><h3>Vault Items</h3><p>Store any secret — passwords, API keys, notes, Wi-Fi, bank PINs. Every value is AES-encrypted before saving to the database. Use <b>Reveal</b> to see the value, <b>Copy</b> to copy to clipboard, <b>Edit</b> to update, or <b>Delete</b> to remove permanently. Items are organized by category and searchable.</p></div></div>
      <div className="help-section help-section-adv"><div className="help-sec-icon adv-icon"><Lock size={18}/></div><div><h3>Advance Mode <span className="adv-badge"><Lock size={10}/> Extra Lock</span></h3><p>A super-secret layer for your most sensitive items. When enabled, each item gets its own custom passphrase <em>only you know</em> — separate from your vault password.</p><ul className="help-list"><li><b>What changes:</b> Reveal, Copy, and Edit all require the extra passphrase.</li><li><b>Sharing disabled:</b> Advance Mode items cannot be shared via links.</li><li><b>Download disabled:</b> Cannot be exported individually.</li><li><b>No recovery:</b> If you forget the passphrase, the item is permanently inaccessible. There is no reset option — by design.</li><li><b>Best for:</b> Crypto seed phrases, banking PINs, master passwords.</li></ul></div></div>
      <div className="help-section"><div className="help-sec-icon"><ShieldCheck size={18}/></div><div><h3>Layer 3 — Recovery Phrase</h3><p>Your 12-word crypto-wallet style master backup. Generated automatically during signup. These words are your emergency key — use them to log in OR reset your password without email.</p><ul className="help-list"><li><b>Store offline:</b> Write them on paper, in a safe, or a trusted manager. Never screenshot.</li><li><b>No reset:</b> If lost, we cannot recover it. This is intentional — it means nobody else can either.</li><li><b>Regenerate:</b> Click "Backup Phrase" in the sidebar to get a new one (replaces the old).</li><li><b>Use it:</b> Click "Use Recovery Phrase" on the login page to sign in or reset your password.</li></ul></div></div>
      <div className="help-section"><div className="help-sec-icon"><Share2 size={18}/></div><div><h3>Secure Share Links</h3><p>Share any non-Advance-Mode value via a time-limited link. The recipient needs no account. Choose expiry: <b>1 hour</b>, <b>12 hours</b>, <b>24 hours</b>, or <b>7 days</b>. Go to <b>My Shares</b> in the sidebar to see all active links and revoke any instantly — the link stops working immediately.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Timer size={18}/></div><div><h3>TOTP / Authenticator Codes</h3><p>Store 2FA secrets alongside passwords. When adding an item, paste the <b>Base32 secret</b> (the text code from QR setup). Click the <b>clock icon</b> on any item to generate the current 6-digit code — it copies to clipboard automatically. Compatible with Google Authenticator, Authy, and all TOTP apps.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><ShieldAlert size={18}/></div><div><h3>Breach Monitoring</h3><p>Automatically checks your passwords against HaveIBeenPwned (k-anonymity API) on every login. A badge on the Security Report nav shows how many passwords appear in known data leaks. Click the <b>shield icon</b> on any item to check it individually. Use "Re-check all" inside the Security Report for a fresh full scan.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Gauge size={18}/></div><div><h3>Security Report</h3><p>A vault health score from 0–100. Detects: <b>Weak passwords</b> (under 10 characters), <b>Reused passwords</b> (same value in multiple items), and <b>Old passwords</b> (not changed in 90+ days). Review and fix each issue directly from the report.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Wand2 size={18}/></div><div><h3>Password Generator</h3><p>Generate cryptographically random passwords. Control <b>length</b> (8–64 chars), character sets (uppercase, lowercase, numbers, symbols). Click <b>Generate</b> inside the value field for quick use, or open the full Generator from the toolbar for copy/regenerate options.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><ExternalLink size={18}/></div><div><h3>URL Tags</h3><p>Link any item to a website URL. A <b>link icon</b> appears on the item row — clicking it opens the site in a new tab. Makes it fast to navigate to the login page you need.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Upload size={18}/></div><div><h3>Import / Export</h3><p><b>Export All:</b> Downloads all vault items as a plain-text JSON backup. Keep it encrypted and secure. <b>Import:</b> Restore from backup or import from another source. JSON format: <code>[{`{"name":"Gmail","value":"mypass","category":"Login"}`}]</code>. Individual items can also be exported via the download icon.</p></div></div>
      <div className="help-section"><div className="help-sec-icon"><Settings size={18}/></div><div><h3>Settings — Browser Autofill</h3><p>Controls whether your browser's autofill and password-save features interact with vault forms. <b>On (default):</b> Browser may autofill or offer to save values. <b>Off:</b> Adds <code>autocomplete="off"</code> to all vault forms — ideal for shared or public computers where you don't want any values stored by the browser.</p></div></div>
    </div></div></div>}

    <Toaster theme="dark"/>
  </div>
}

function ResetView({token}){
  const [newPwd,setNewPwd]=useState('');const [done,setDone]=useState(false);const [busy,setBusy]=useState(false);
  const submit=async(e)=>{e.preventDefault();setBusy(true);try{await client.post('/auth/reset-password',{token,new_password:newPwd});setDone(true)}catch(e){toast.error(e.response?.data?.detail||'Reset failed')}finally{setBusy(false)}};
  if(done)return <div className="share-screen"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div><div className="share-card" data-testid="reset-success"><p className="eyebrow">PASSWORD RESET</p><h2>Password Updated!</h2><p className="muted">Your password has been changed successfully. You can now sign in.</p><a href="/" className="primary wide reset-go-login">Go to Login</a></div><Toaster theme="dark"/></div>;
  return <div className="share-screen"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div><div className="share-card" data-testid="reset-view"><p className="eyebrow">PASSWORD RESET</p><h2>Set New Password</h2><p className="muted">Enter your new password. It must be at least 8 characters.</p><form onSubmit={submit}><label style={{display:'block',marginBottom:'16px',fontSize:'13px',color:'var(--muted)'}}>New Password<input data-testid="reset-pwd-input" type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} required minLength="8" placeholder="At least 8 characters" autoComplete="new-password" style={{display:'block',width:'100%',marginTop:'6px',padding:'10px 12px',background:'rgba(255,255,255,.06)',border:'1px solid var(--line)',borderRadius:'8px',color:'#fff',fontSize:'14px'}}/></label><button className="primary wide" data-testid="reset-submit" disabled={busy}>{busy?'Updating…':'Set New Password'} <ArrowUpRight size={17}/></button></form></div><Toaster theme="dark"/></div>
}

function ShareView({token}){
  const [data,setData]=useState(null); const [err,setErr]=useState('');
  useEffect(()=>{client.get(`/share/${token}`).then(r=>setData(r.data)).catch(e=>setErr(e.response?.data?.detail||'This link has expired or is invalid'))},[token]);
  const copy=()=>{copyText(data.value);toast.success('Copied!')};
  if(err)return <div className="share-screen"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div><div className="share-card"><p className="eyebrow">SHARE LINK</p><h2>Link Expired</h2><p className="muted">{err}</p></div><Toaster theme="dark"/></div>;
  if(!data)return <LoadingScreen/>;
  return <div className="share-screen"><div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div><div className="share-card" data-testid="share-view-card"><p className="eyebrow">SHARED WITH YOU</p><h2>{data.name}</h2><div className="share-value-box" data-testid="share-value">{data.value}</div><button className="primary wide" onClick={copy}><Copy size={15}/> Copy value</button><p className="share-exp">Expires {new Date(data.expires).toLocaleString()}</p></div><Toaster theme="dark"/></div>
}

export default function App(){
  const [user,setUser]=useState(null); const [booting,setBooting]=useState(true);
  useEffect(()=>{const t=new URLSearchParams(window.location.search).get('token');if(t){localStorage.setItem('vault_token',t);window.history.replaceState({},'','/')} const token=localStorage.getItem('vault_token');if(token)client.get('/auth/me',authHeader()).then(r=>setUser(r.data)).catch(()=>localStorage.removeItem('vault_token')).finally(()=>setBooting(false));else setBooting(false)},[]);
  const shareToken=new URLSearchParams(window.location.search).get('share');
  const resetToken=new URLSearchParams(window.location.search).get('reset');
  if(shareToken)return <ShareView token={shareToken}/>;
  if(resetToken)return <ResetView token={resetToken}/>;
  const logout=()=>{localStorage.removeItem('vault_token');setUser(null)};
  if(booting)return <LoadingScreen/>;
  const isAdmin=user?.is_admin;
  if(isAdmin&&new URLSearchParams(window.location.search).get('admin')==='1')return <AdminPanel user={user} onLogout={logout}/>;
  return user?<Vault user={user} onLogout={logout}/>:<Auth onLogin={setUser}/>
}

function LoadingScreen(){
  return <div className="loading-screen"><div className="ls-bar"/><div className="ls-center"><div className="ls-title">TOPPASS5</div><div className="ls-sub">SECURING YOUR VAULT<span className="ls-cursor"/></div></div><div className="ls-company"><img src="https://img.sanishtech.com/u/7ad9ec964e6da7120bb20b71fd4cbcb3.png" alt="ZNQ NETWORK" className="znq-logo"/><p className="loading-by">by ZNQ NETWORK</p></div></div>
}
