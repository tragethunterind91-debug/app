import {useEffect, useMemo, useState} from 'react';
import {Command, Search, Plus, Wand2, Download, Upload, Settings, ShieldCheck, LogOut, HelpCircle, Star, Copy, X, Printer, Users, Timer, AlertTriangle, Trash2, Check} from 'lucide-react';

// ============================================================
// 1. COMMAND PALETTE (Cmd+K / Ctrl+K)
// ============================================================
export function CommandPalette({open, onClose, items, actions, onSelectItem, onCopyItem}){
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(()=>{if(open){setQ('');setIdx(0)}},[open]);

  const results = useMemo(()=>{
    const query = q.trim().toLowerCase();
    const actionMatches = actions.filter(a => !query || a.label.toLowerCase().includes(query) || a.keywords?.some(k => k.toLowerCase().includes(query)));
    const itemMatches = query ? items.filter(i =>
      i.name.toLowerCase().includes(query) ||
      (i.category||'').toLowerCase().includes(query) ||
      (i.tags||[]).some(t => t.toLowerCase().includes(query))
    ).slice(0, 8) : [];
    return {actions: actionMatches, items: itemMatches};
  }, [q, items, actions]);

  const flatList = useMemo(()=>[
    ...results.actions.map(a => ({type:'action', ...a})),
    ...results.items.map(i => ({type:'item', ...i}))
  ],[results]);

  useEffect(()=>{setIdx(0)},[q]);
  useEffect(()=>{
    if(!open) return;
    const onKey = (e) => {
      if(e.key==='ArrowDown'){e.preventDefault();setIdx(i=>Math.min(i+1, flatList.length-1))}
      else if(e.key==='ArrowUp'){e.preventDefault();setIdx(i=>Math.max(i-1, 0))}
      else if(e.key==='Enter'){
        e.preventDefault();
        const sel = flatList[idx];
        if(!sel) return;
        if(sel.type==='action'){sel.run();onClose()}
        else{onSelectItem(sel);onClose()}
      }
      else if(e.key==='Escape'){onClose()}
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  },[open,flatList,idx,onSelectItem,onClose]);

  if(!open) return null;
  return (
    <div className="cmdk-backdrop" data-testid="cmd-palette" onClick={onClose}>
      <div className="cmdk-modal" onClick={e=>e.stopPropagation()}>
        <div className="cmdk-search">
          <Search size={16}/>
          <input autoFocus data-testid="cmd-palette-input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search actions, items, tags…"/>
          <span className="cmdk-kbd">ESC</span>
        </div>
        <div className="cmdk-list">
          {results.actions.length>0 && <div className="cmdk-section">Actions</div>}
          {results.actions.map((a,i)=>{
            const active = idx===i;
            return (
              <button key={a.id} className={`cmdk-row${active?' active':''}`} data-testid={`cmd-action-${a.id}`} onMouseEnter={()=>setIdx(i)} onClick={()=>{a.run();onClose()}}>
                <span className="cmdk-icon">{a.icon}</span>
                <span className="cmdk-label">{a.label}</span>
                {a.hint && <span className="cmdk-hint">{a.hint}</span>}
              </button>
            );
          })}
          {results.items.length>0 && <div className="cmdk-section">Vault items</div>}
          {results.items.map((it,i)=>{
            const gi = results.actions.length + i;
            const active = idx===gi;
            return (
              <div key={it.id} className={`cmdk-row${active?' active':''}`} data-testid={`cmd-item-${it.id}`} onMouseEnter={()=>setIdx(gi)}>
                <button className="cmdk-item-main" onClick={()=>{onSelectItem(it);onClose()}}>
                  <span className="cmdk-icon"><Star size={14} className={it.favorite?'fav-active':''}/></span>
                  <span className="cmdk-label">{it.name}</span>
                  <span className="cmdk-hint">{it.category}</span>
                </button>
                <button className="cmdk-quick" data-testid={`cmd-copy-${it.id}`} onClick={(e)=>{e.stopPropagation();onCopyItem(it);onClose()}} title="Copy value">
                  <Copy size={13}/>
                </button>
              </div>
            );
          })}
          {flatList.length===0 && <div className="cmdk-empty">No matches. Press ESC to close.</div>}
        </div>
        <div className="cmdk-footer">
          <span><span className="cmdk-kbd">↑</span> <span className="cmdk-kbd">↓</span> navigate</span>
          <span><span className="cmdk-kbd">↵</span> select</span>
          <span><span className="cmdk-kbd">⌘K</span> toggle</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 2. CSV IMPORT — parses Chrome/Firefox/LastPass CSV formats
// ============================================================
function parseCSV(text){
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(inQuotes){
      if(c==='"' && text[i+1]==='"'){cur+='"';i++}
      else if(c==='"'){inQuotes=false}
      else{cur+=c}
    }else{
      if(c==='"'){inQuotes=true}
      else if(c===','){row.push(cur);cur=''}
      else if(c==='\n' || c==='\r'){
        if(cur.length>0 || row.length>0){row.push(cur);rows.push(row);row=[];cur=''}
        if(c==='\r' && text[i+1]==='\n') i++;
      }
      else{cur+=c}
    }
  }
  if(cur.length>0 || row.length>0){row.push(cur);rows.push(row)}
  return rows.filter(r=>r.some(cell=>cell.trim()));
}

export function parseCsvToItems(text){
  const rows = parseCSV(text);
  if(rows.length < 2) return {items:[], detected:'unknown'};
  const headers = rows[0].map(h=>h.trim().toLowerCase().replace(/^"|"$/g,''));
  const idx = (candidates) => {
    for(const c of candidates){
      const i = headers.indexOf(c);
      if(i>=0) return i;
    }
    return -1;
  };
  const nameI = idx(['name','title','account','item','display name']);
  const urlI  = idx(['url','website','login_uri','uri','web site']);
  const userI = idx(['username','user','login','login_username','email']);
  const passI = idx(['password','login_password','pass']);
  const noteI = idx(['note','notes','extra','comment']);
  const catI  = idx(['category','folder','group','grouping']);

  // detect vendor
  let detected = 'generic';
  if(headers.includes('login_uri') || headers.includes('login_password')) detected = 'bitwarden/lastpass';
  else if(headers.includes('httprealm') || headers.includes('formactionorigin')) detected = 'firefox';
  else if(headers.includes('name') && headers.includes('url') && headers.includes('username') && headers.includes('password')) detected = 'chrome';

  const items = [];
  for(let r=1;r<rows.length;r++){
    const row = rows[r];
    const pass = passI>=0 ? (row[passI]||'').trim() : '';
    if(!pass) continue;
    const rawName = nameI>=0 ? (row[nameI]||'').trim() : '';
    const url = urlI>=0 ? (row[urlI]||'').trim() : '';
    const user = userI>=0 ? (row[userI]||'').trim() : '';
    const note = noteI>=0 ? (row[noteI]||'').trim() : '';
    const cat = catI>=0 ? (row[catI]||'').trim() : '';
    let name = rawName;
    if(!name && url){try{name = new URL(url).hostname.replace('www.','')}catch{name=url}}
    if(!name) name = `Imported ${r}`;
    items.push({
      name,
      value: pass,
      category: cat || 'Login',
      url,
      notes: user ? `Username: ${user}${note?`\n\n${note}`:''}` : note,
      tags: ['imported'],
    });
  }
  return {items, detected};
}

export function CSVImportModal({open, onClose, onImport}){
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const text = await file.text();
    const {items, detected} = parseCsvToItems(text);
    setPreview({items, detected, filename:file.name});
    e.target.value='';
  };
  const doImport = async ()=>{
    if(!preview || preview.items.length===0) return;
    setBusy(true);
    try{
      await onImport(preview.items);
      setPreview(null);
      onClose();
    }finally{setBusy(false)}
  };
  if(!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal csv-modal" onClick={e=>e.stopPropagation()} data-testid="csv-import-modal">
        <button className="modal-close icon-btn" onClick={onClose}><X/></button>
        <p className="eyebrow">BULK IMPORT</p>
        <h2>Import from Chrome, Firefox or LastPass</h2>
        <p className="muted">Export your saved passwords from your browser or password manager as a CSV, then drop the file here. All values are encrypted before storage.</p>
        {!preview ? (
          <label className="csv-drop" data-testid="csv-drop-label">
            <Upload size={22}/>
            <b>Choose a CSV file</b>
            <span>Chrome · Firefox · LastPass · Bitwarden · 1Password (CSV)</span>
            <input type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={onFile} data-testid="csv-file-input"/>
          </label>
        ) : (
          <div className="csv-preview" data-testid="csv-preview">
            <div className="csv-preview-head">
              <div>
                <b>{preview.filename}</b>
                <span>{preview.items.length} items · detected: {preview.detected}</span>
              </div>
              <button className="icon-btn" onClick={()=>setPreview(null)} title="Change file"><X size={14}/></button>
            </div>
            <div className="csv-preview-list">
              {preview.items.slice(0,6).map((it,i)=>(
                <div key={i} className="csv-preview-row">
                  <span className="csv-preview-name">{it.name}</span>
                  <span className="csv-preview-cat">{it.category}</span>
                </div>
              ))}
              {preview.items.length>6 && <div className="csv-preview-more">+ {preview.items.length-6} more</div>}
            </div>
            <button className="primary wide" data-testid="csv-import-confirm" onClick={doImport} disabled={busy||preview.items.length===0}>
              {busy?'Importing…':`Import ${preview.items.length} items`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 3. RECOVERY SHEET — printable page of Layer-3 crypto passwords
// ============================================================
export function RecoverySheet({open, onClose, ownerEmail, passwords, generatedAt}){
  useEffect(()=>{
    if(!open) return;
    const onKey = (e)=>{if(e.key==='Escape')onClose()};
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  },[open,onClose]);
  if(!open) return null;
  const doPrint = ()=>window.print();
  return (
    <div className="modal-backdrop recovery-sheet-backdrop" onClick={onClose}>
      <div className="recovery-sheet-wrap" onClick={e=>e.stopPropagation()} data-testid="recovery-sheet">
        <div className="recovery-sheet-toolbar">
          <button className="secondary" onClick={onClose}><X size={14}/> Close</button>
          <button className="primary" data-testid="recovery-print-btn" onClick={doPrint}><Printer size={14}/> Print / Save PDF</button>
        </div>
        <div className="recovery-sheet-paper" data-testid="recovery-sheet-paper">
          <div className="rs-head">
            <div>
              <div className="rs-brand">TOPPASS5</div>
              <div className="rs-sub">by ZNQ NETWORK</div>
            </div>
            <div className="rs-stamp">
              <div>RECOVERY SHEET</div>
              <div>Generated {new Date(generatedAt||Date.now()).toLocaleString()}</div>
            </div>
          </div>
          <h1 className="rs-title">Emergency Recovery Sheet</h1>
          <p className="rs-lead">Keep this sheet in a safe, physical location (locked drawer, deposit box). Anyone who holds this paper can pass your Layer&nbsp;3 verification. Do NOT store it digitally.</p>
          <div className="rs-owner">
            <div><span>Vault owner</span><b>{ownerEmail}</b></div>
            <div><span>Layers</span><b>Password · Birthday · Layer 3 Quiz</b></div>
          </div>
          <h2 className="rs-h2">Layer 3 · Crypto Type Passwords</h2>
          <div className="rs-grid">
            {(passwords||[]).map((p,i)=>(
              <div className="rs-cell" key={i}>
                <span className="rs-num">{String(i+1).padStart(2,'0')}</span>
                <span className="rs-pw">{p}</span>
              </div>
            ))}
          </div>
          <div className="rs-warn">
            <AlertTriangle size={13}/>
            <span>Regenerating your Layer 3 passwords invalidates every previous recovery sheet. Print a fresh copy after each regeneration.</span>
          </div>
          <div className="rs-foot">
            <span>zero-knowledge · AES-256 · 3-layer authentication · hardcore mode compatible</span>
            <span>© ZNQ Network · TopPass5 Secure Vault</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 4. EMERGENCY ACCESS — trusted contact + countdown veto flow
// ============================================================
export function EmergencyAccessModal({open, onClose, client, authHeader, toast}){
  const [contact, setContact] = useState(null);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({contact_email:'', contact_name:'', wait_days:7});
  const [loading, setLoading] = useState(false);

  const load = async ()=>{
    setLoading(true);
    try{
      const [c, r] = await Promise.all([
        client.get('/emergency/contact', authHeader()),
        client.get('/emergency/requests', authHeader()),
      ]);
      setContact(c.data);
      setRequests(r.data||[]);
      if(c.data){setForm({contact_email:c.data.contact_email, contact_name:c.data.contact_name, wait_days:c.data.wait_days})}
    }catch(e){/* silent */}
    finally{setLoading(false)}
  };
  useEffect(()=>{if(open)load()},[open]);

  const save = async ()=>{
    if(!form.contact_email || !form.contact_name){toast.error('Enter contact name and email');return}
    try{
      const r = await client.post('/emergency/contact', form, authHeader());
      setContact(r.data);
      toast.success('Emergency contact saved');
    }catch(e){toast.error(e.response?.data?.detail||'Failed to save')}
  };
  const remove = async ()=>{
    if(!window.confirm('Remove your emergency contact and cancel any pending requests?'))return;
    try{
      await client.delete('/emergency/contact', authHeader());
      setContact(null);setRequests([]);
      setForm({contact_email:'', contact_name:'', wait_days:7});
      toast.success('Emergency contact removed');
    }catch(e){toast.error('Failed to remove')}
  };
  const cancel = async (req)=>{
    if(!window.confirm('Cancel this pending emergency access request? The contact will lose their pending access.'))return;
    try{
      await client.post(`/emergency/cancel/${req.id}`, {}, authHeader());
      toast.success('Request cancelled');
      load();
    }catch(e){toast.error('Failed to cancel')}
  };

  if(!open) return null;
  const pending = requests.filter(r => r.status==='pending');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal emergency-modal" onClick={e=>e.stopPropagation()} data-testid="emergency-access-modal">
        <button className="modal-close icon-btn" onClick={onClose}><X/></button>
        <p className="eyebrow">EMERGENCY ACCESS</p>
        <h2>Trusted contact</h2>
        <p className="muted">Nominate one person who can request a read-only export of your vault after a waiting period you control. You can veto any request during the countdown. Advance Mode items are always excluded.</p>

        {pending.length>0 && (
          <div className="emergency-pending-list" data-testid="emergency-pending-list">
            {pending.map(req => {
              const remaining = new Date(req.unlocks_at) - new Date();
              const days = Math.max(0, Math.ceil(remaining / (1000*60*60*24)));
              return (
                <div key={req.id} className="emergency-pending-row">
                  <AlertTriangle size={16}/>
                  <div>
                    <b>Access request pending</b>
                    <span>{req.contact_email} · unlocks in {days} day{days===1?'':'s'}</span>
                    {req.reason && <em>“{req.reason}”</em>}
                  </div>
                  <button className="icon-btn danger" data-testid={`cancel-emergency-${req.id}`} onClick={()=>cancel(req)} title="Veto & cancel"><Trash2 size={14}/></button>
                </div>
              );
            })}
          </div>
        )}

        <label>Contact name
          <input data-testid="emergency-contact-name" value={form.contact_name} onChange={e=>setForm({...form, contact_name:e.target.value})} placeholder="e.g. Alex Morgan"/>
        </label>
        <label>Contact email
          <input data-testid="emergency-contact-email" type="email" value={form.contact_email} onChange={e=>setForm({...form, contact_email:e.target.value})} placeholder="alex@example.com"/>
        </label>
        <label>Waiting period
          <div className="wait-days-row">
            {[3,7,14,30].map(d=>(
              <button type="button" key={d}
                className={`wait-chip${form.wait_days===d?' active':''}`}
                data-testid={`wait-days-${d}`}
                onClick={()=>setForm({...form, wait_days:d})}>
                {d} days
              </button>
            ))}
          </div>
        </label>

        <div className="emergency-actions">
          <button className="primary wide" data-testid="save-emergency-contact" onClick={save} disabled={loading}>
            <Users size={14}/> {contact?'Update contact':'Set trusted contact'}
          </button>
          {contact && <button className="secondary" data-testid="remove-emergency-contact" onClick={remove}><Trash2 size={14}/> Remove</button>}
        </div>

        <div className="emergency-share-instructions">
          <b>Give your contact these instructions</b>
          <ol>
            <li>Visit <code>{window.location.origin}/#emergency</code></li>
            <li>Enter your email ({contact?.contact_email ? <b>{contact?.contact_email}</b> : 'their address'}) and yours as the vault owner.</li>
            <li>After the countdown ({contact?.wait_days || form.wait_days} days) they receive a one-time export unless you cancel.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EMERGENCY REQUEST PORTAL — for the contact (public route)
// ============================================================
export function EmergencyPortal({client, toast}){
  const [step, setStep] = useState('form'); // form | pending | export
  const [form, setForm] = useState({owner_email:'', contact_email:'', reason:''});
  const [result, setResult] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async ()=>{
    if(!form.owner_email || !form.contact_email){toast.error('Both emails are required');return}
    setBusy(true);
    try{
      const r = await client.post('/emergency/request', form);
      setResult(r.data);
      setStep('pending');
    }catch(e){toast.error(e.response?.data?.detail||'Request failed')}
    finally{setBusy(false)}
  };
  const tryExport = async ()=>{
    if(!token){toast.error('Enter your access token');return}
    setBusy(true);
    try{
      const r = await client.get(`/emergency/export/${token}`);
      setExportData(r.data);
      setStep('export');
      toast.success('Access granted');
    }catch(e){toast.error(e.response?.data?.detail||'Access denied')}
    finally{setBusy(false)}
  };
  const download = ()=>{
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `toppass5-emergency-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="share-screen" data-testid="emergency-portal">
      <div className="brand"><img src="/toppass5-logo-sm.jpeg" alt="" className="brand-logo-mark"/></div>
      <div className="share-card emergency-portal-card">
        <p className="eyebrow">EMERGENCY ACCESS</p>
        <h2>Trusted contact portal</h2>
        {step==='form' && (
          <>
            <p className="muted">If a TopPass5 user nominated you as their trusted contact, you can request read-only access here. The vault owner will have a chance to veto during their configured waiting period.</p>
            <label>Vault owner's email
              <input data-testid="ep-owner-email" type="email" value={form.owner_email} onChange={e=>setForm({...form, owner_email:e.target.value})} placeholder="owner@example.com"/>
            </label>
            <label>Your email (as trusted contact)
              <input data-testid="ep-contact-email" type="email" value={form.contact_email} onChange={e=>setForm({...form, contact_email:e.target.value})} placeholder="you@example.com"/>
            </label>
            <label>Reason (optional)
              <input data-testid="ep-reason" value={form.reason} onChange={e=>setForm({...form, reason:e.target.value})} placeholder="e.g. Owner unreachable since Feb 12"/>
            </label>
            <button className="primary wide" data-testid="ep-submit" onClick={submit} disabled={busy}>
              <Timer size={14}/> {busy?'Requesting…':'Start countdown'}
            </button>
            <div className="ep-divider">Already have a token?</div>
            <label>Access token
              <input data-testid="ep-token" value={token} onChange={e=>setToken(e.target.value)} placeholder="Paste your token"/>
            </label>
            <button className="secondary wide" data-testid="ep-check" onClick={tryExport} disabled={busy}>
              <ShieldCheck size={14}/> {busy?'Checking…':'Check access'}
            </button>
          </>
        )}
        {step==='pending' && (
          <>
            <div className="ep-timer-box">
              <Timer size={20}/>
              <div>
                <b>Countdown started</b>
                <span>{result?.message}</span>
              </div>
            </div>
            <label>Your access token — save it somewhere safe
              <div className="share-link-box" data-testid="ep-token-display">{result?.access_token}</div>
            </label>
            <button className="secondary wide" onClick={()=>{navigator.clipboard.writeText(result?.access_token||'');toast.success('Token copied')}}><Copy size={14}/> Copy token</button>
            <button className="link-btn" onClick={()=>{setStep('form');setResult(null)}}>← Back</button>
          </>
        )}
        {step==='export' && exportData && (
          <>
            <div className="ep-timer-box success">
              <Check size={20}/>
              <div>
                <b>Access granted · {exportData.items.length} items</b>
                <span>{exportData.note}</span>
              </div>
            </div>
            <button className="primary wide" data-testid="ep-download" onClick={download}><Download size={14}/> Download JSON</button>
            <p className="muted" style={{marginTop:16,fontSize:12}}>This token is now spent and cannot be used again.</p>
          </>
        )}
      </div>
    </div>
  );
}

// Re-export icons so App.js can grab if needed
export const NF_ICONS = {Command, Plus, Wand2, Download, Upload, Settings, ShieldCheck, LogOut, HelpCircle, Users, Printer};
