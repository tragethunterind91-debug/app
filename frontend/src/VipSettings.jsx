import {useEffect, useState} from 'react';
import {X, Shield, Monitor, Timer, Clock, Bomb, Palette, HardDrive, HelpCircle, ListChecks, LogOut, Save, Trash2, Plus, Crown} from 'lucide-react';
import {toast} from 'sonner';
import './VipSettings.css';

const THEMES = [
  {id:'default', label:'Default'},
  {id:'matrix',  label:'Matrix'},
  {id:'neon',    label:'Neon'},
  {id:'pastel',  label:'Pastel'},
];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const SECTIONS = [
  {id:'security', label:'Security',      icon: Shield},
  {id:'devices',  label:'Devices',       icon: Monitor},
  {id:'session',  label:'Session',       icon: Timer},
  {id:'windows',  label:'Login windows', icon: Clock},
  {id:'destruct', label:'Self-destruct', icon: Bomb},
  {id:'theme',    label:'Theme',         icon: Palette},
  {id:'engineer', label:'Engineer Mode', icon: HardDrive},
  {id:'who',      label:'WHO Pass',      icon: HelpCircle},
  {id:'mcq',      label:'MCQ Pass',      icon: ListChecks},
];

export default function VipSettings({client, authHeader, onClose, onLogoutAll, user}){
  const [tab, setTab] = useState('security');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);          // /vip/settings payload
  const [who, setWho] = useState({enabled:false, question:'', answer:'', case_sensitive:true});
  const [mcq, setMcq] = useState({enabled:false, time_limit_sec:60, questions:[]});
  const [engineer, setEngineer] = useState({data:'', bytes:0, max:512000});

  const refresh = async ()=>{
    setLoading(true);
    try {
      const [s, w, m, e] = await Promise.all([
        client.get('/vip/settings', authHeader()),
        client.get('/vip/who-pass', authHeader()),
        client.get('/vip/mcq-pass', authHeader()),
        client.get('/vip/engineer/blob', authHeader()),
      ]);
      setSettings(s.data);
      setWho(prev => ({...prev, ...w.data, answer:''}));
      setMcq({enabled: !!m.data.enabled, time_limit_sec: m.data.time_limit_sec || 60, questions: m.data.questions || []});
      setEngineer({data: e.data.data || '', bytes: e.data.bytes || 0, max: e.data.max_bytes || 512000});
    } catch (err) {
      toast.error('Could not load VIP settings');
    } finally { setLoading(false); }
  };
  useEffect(()=>{ refresh(); /* eslint-disable-next-line */ }, []);

  const patch = (p)=> setSettings(s => ({...(s||{}), ...p}));

  const saveSettings = async ()=>{
    if (!settings) return;
    setSaving(true);
    try {
      await client.put('/vip/settings', {
        allowed_ips: settings.allowed_ips || [],
        allowed_countries: settings.allowed_countries || [],
        session_timeout_min: settings.session_timeout_min,
        self_destruct_at: settings.self_destruct_at,
        theme: settings.theme || 'default',
        login_windows: settings.login_windows || [],
      }, authHeader());
      toast.success('VIP settings saved');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  const saveWho = async ()=>{
    if (!who.question || !who.answer) { toast.error('Question and answer are required'); return; }
    try {
      await client.put('/vip/who-pass', who, authHeader());
      toast.success(who.enabled ? 'WHO Pass enabled' : 'WHO Pass saved');
      setWho(w=>({...w, answer:''}));
    } catch (err) { toast.error(err?.response?.data?.detail || 'WHO Pass save failed'); }
  };

  const saveMcq = async ()=>{
    if (!mcq.questions.length) { toast.error('Add at least one question'); return; }
    try {
      await client.put('/vip/mcq-pass', mcq, authHeader());
      toast.success(mcq.enabled ? 'MCQ Pass enabled' : 'MCQ Pass saved');
    } catch (err) { toast.error(err?.response?.data?.detail || 'MCQ Pass save failed'); }
  };

  const saveEngineer = async ()=>{
    try {
      const r = await client.put('/vip/engineer/blob', {data: engineer.data}, authHeader());
      setEngineer(e=>({...e, bytes: r.data.bytes}));
      toast.success(`Engineer blob saved (${r.data.bytes} bytes)`);
    } catch (err) { toast.error(err?.response?.data?.detail || 'Save failed'); }
  };

  const doLogoutAll = async ()=>{
    if (!window.confirm('Sign out every device immediately? You will need to sign in again.')) return;
    try {
      await client.post('/vip/logout-all', {}, authHeader());
      toast.success('All sessions revoked');
      onLogoutAll && onLogoutAll();
    } catch (err) { toast.error('Logout-all failed'); }
  };

  const removeDevice = async (id)=>{
    try {
      await client.delete(`/vip/devices/${id}`, authHeader());
      await refresh();
      toast.success('Device removed');
    } catch (err) { toast.error('Could not remove device'); }
  };

  // Login window helpers
  const addWindow = ()=> patch({login_windows: [...(settings.login_windows||[]), {days:[0,1,2,3,4], start:'09:00', end:'17:00'}]});
  const updateWindow = (idx, w)=> patch({login_windows: (settings.login_windows||[]).map((x,i)=> i===idx ? {...x, ...w} : x)});
  const removeWindow = (idx)=> patch({login_windows: (settings.login_windows||[]).filter((_,i)=> i!==idx)});
  const toggleDay = (idx, d)=>{
    const w = (settings.login_windows||[])[idx];
    const days = (w.days||[]).includes(d) ? w.days.filter(x=>x!==d) : [...(w.days||[]), d].sort();
    updateWindow(idx, {days});
  };

  // MCQ question editor helpers
  const addMcqQ = ()=> setMcq(m=>({...m, questions:[...m.questions, {q:'', options:['','','',''], correct_idx:0}]}));
  const updateMcqQ = (i, patch)=> setMcq(m=>({...m, questions: m.questions.map((q,idx)=> idx===i ? {...q, ...patch} : q)}));
  const updateMcqOpt = (qi, oi, v)=> setMcq(m=>({...m, questions: m.questions.map((q,idx)=> idx===qi ? {...q, options: q.options.map((o,j)=> j===oi ? v : o)} : q)}));
  const removeMcqQ = (i)=> setMcq(m=>({...m, questions: m.questions.filter((_,idx)=> idx!==i)}));

  if (loading || !settings) {
    return (
      <div className="modal-backdrop" data-testid="vip-settings-backdrop">
        <div className="modal vip-settings-modal"><p className="muted">Loading VIP settings…</p></div>
      </div>
    );
  }

  const bytesPct = Math.min(100, Math.round((engineer.bytes / engineer.max) * 100));

  return (
    <div className="modal-backdrop" data-testid="vip-settings-backdrop">
      <div className="modal vip-settings-modal" data-testid="vip-settings-modal" role="dialog" aria-label="VIP Settings">
        <button type="button" className="modal-close icon-btn" data-testid="vip-settings-close" onClick={onClose}><X/></button>

        <header className="vs-head">
          <div className="vs-head-icon"><Crown size={20}/></div>
          <div>
            <p className="eyebrow">{user?.is_super_vip ? 'Super VIP · Settings' : 'VIP · Settings'}</p>
            <h2>Your membership controls</h2>
          </div>
        </header>

        <div className="vs-layout">
          <nav className="vs-tabs" data-testid="vip-settings-tabs">
            {SECTIONS.map(s => (
              <button key={s.id}
                data-testid={`vs-tab-${s.id}`}
                className={tab===s.id ? 'vs-tab active' : 'vs-tab'}
                onClick={()=>setTab(s.id)}>
                <s.icon size={14}/> {s.label}
              </button>
            ))}
          </nav>

          <div className="vs-body">
            {tab==='security' && (
              <section className="vs-section">
                <h3>IP allowlist</h3>
                <p className="muted">Only these IPs can log in. Leave empty to allow any.</p>
                <TagInput data-testid="vs-ip-input" value={settings.allowed_ips||[]} onChange={v=>patch({allowed_ips:v})} placeholder="Add IP e.g. 203.0.113.42"/>

                <h3 style={{marginTop:22}}>Country allowlist (ISO-2)</h3>
                <p className="muted">Only sign-ins from these countries. Empty = any.</p>
                <TagInput data-testid="vs-country-input" value={settings.allowed_countries||[]} onChange={v=>patch({allowed_countries: v.map(x=>x.toUpperCase())})} placeholder="e.g. IN, US"/>

                <div className="vs-actions">
                  <button className="secondary" data-testid="vs-logout-all" onClick={doLogoutAll}><LogOut size={14}/> Sign out all devices</button>
                  <button className="primary" data-testid="vs-save-security" onClick={saveSettings} disabled={saving}><Save size={14}/> {saving?'Saving…':'Save security'}</button>
                </div>
              </section>
            )}

            {tab==='devices' && (
              <section className="vs-section">
                <h3>Trusted devices</h3>
                <p className="muted">You can be signed in on up to {user?.is_super_vip ? 4 : 2} devices.</p>
                <ul className="vs-device-list" data-testid="vs-device-list">
                  {(settings.devices||[]).length === 0 && <li className="muted">No devices yet.</li>}
                  {(settings.devices||[]).map(d => (
                    <li key={d.id} data-testid={`vs-device-${d.id}`}>
                      <div><b>{d.label}</b><small>IP {d.ip || 'unknown'} · first seen {new Date(d.first_seen).toLocaleString()}</small></div>
                      <button className="icon-btn danger" onClick={()=>removeDevice(d.id)} title="Remove"><Trash2 size={14}/></button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {tab==='session' && (
              <section className="vs-section">
                <h3>Custom session timeout</h3>
                <p className="muted">Idle sign-out time for your account. Default: 720 min (12 h).</p>
                <label>Minutes
                  <input type="number" min={1} max={43200}
                    data-testid="vs-session-timeout"
                    value={settings.session_timeout_min ?? ''}
                    onChange={e=>patch({session_timeout_min: e.target.value ? parseInt(e.target.value,10) : null})}
                    placeholder="e.g. 60"/>
                </label>
                <div className="vs-actions"><button className="primary" data-testid="vs-save-session" onClick={saveSettings} disabled={saving}><Save size={14}/> {saving?'Saving…':'Save session'}</button></div>
              </section>
            )}

            {tab==='windows' && (
              <section className="vs-section">
                <h3>Allowed login time windows</h3>
                <p className="muted">Only these UTC windows can log in. No windows = any time.</p>
                <div className="vs-window-list">
                  {(settings.login_windows||[]).length === 0 && <p className="muted">No restrictions set.</p>}
                  {(settings.login_windows||[]).map((w,i) => (
                    <div className="vs-window" key={i} data-testid={`vs-window-${i}`}>
                      <div className="vs-days">
                        {DAYS.map((d,di)=>(
                          <button key={di} type="button"
                            className={(w.days||[]).includes(di) ? 'vs-day active' : 'vs-day'}
                            onClick={()=>toggleDay(i, di)}>{d}</button>
                        ))}
                      </div>
                      <div className="vs-time-row">
                        <label>Start<input type="time" value={w.start||'09:00'} onChange={e=>updateWindow(i,{start:e.target.value})}/></label>
                        <label>End<input type="time" value={w.end||'17:00'} onChange={e=>updateWindow(i,{end:e.target.value})}/></label>
                        <button className="icon-btn danger" onClick={()=>removeWindow(i)}><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="vs-actions">
                  <button className="secondary" data-testid="vs-add-window" onClick={addWindow}><Plus size={14}/> Add window</button>
                  <button className="primary" data-testid="vs-save-windows" onClick={saveSettings} disabled={saving}><Save size={14}/> {saving?'Saving…':'Save windows'}</button>
                </div>
              </section>
            )}

            {tab==='destruct' && (
              <section className="vs-section">
                <h3>Scheduled vault self-destruct</h3>
                <p className="muted">Set a future date-time. On the first sign-in after that moment, every item and share is wiped.</p>
                <label>Date &amp; time (local)
                  <input type="datetime-local"
                    data-testid="vs-self-destruct"
                    value={settings.self_destruct_at ? settings.self_destruct_at.slice(0,16) : ''}
                    onChange={e=>{
                      const v = e.target.value;
                      patch({self_destruct_at: v ? new Date(v).toISOString() : null});
                    }}/>
                </label>
                {settings.self_destruct_at && <p className="vs-warn">⚠ Scheduled for {new Date(settings.self_destruct_at).toLocaleString()}</p>}
                <div className="vs-actions">
                  <button className="secondary" onClick={()=>patch({self_destruct_at: null})}>Clear</button>
                  <button className="primary" data-testid="vs-save-destruct" onClick={saveSettings} disabled={saving}><Save size={14}/> {saving?'Saving…':'Save schedule'}</button>
                </div>
              </section>
            )}

            {tab==='theme' && (
              <section className="vs-section">
                <h3>Theme</h3>
                <p className="muted">Visual palette for your vault.</p>
                <div className="vs-theme-grid">
                  {THEMES.map(t => (
                    <button key={t.id} type="button"
                      data-testid={`vs-theme-${t.id}`}
                      className={(settings.theme||'default')===t.id ? 'vs-theme active' : 'vs-theme'}
                      onClick={()=>patch({theme: t.id})}>
                      <span className={`vs-theme-swatch vs-theme-${t.id}`}/>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="vs-actions"><button className="primary" data-testid="vs-save-theme" onClick={saveSettings} disabled={saving}><Save size={14}/> {saving?'Saving…':'Save theme'}</button></div>
              </section>
            )}

            {tab==='engineer' && (
              <section className="vs-section">
                <h3>Engineer Mode storage</h3>
                <p className="muted">Up to 500 KB of raw text — snippets, keys, notes.</p>
                <textarea
                  data-testid="vs-engineer-textarea"
                  rows={10}
                  style={{width:'100%', fontFamily:"'DM Mono',monospace", fontSize:12}}
                  value={engineer.data}
                  onChange={e=>setEngineer(x=>({...x, data: e.target.value, bytes: new Blob([e.target.value]).size}))}/>
                <div className="vs-blob-bar"><span style={{width: bytesPct+'%'}}/></div>
                <p className="muted" data-testid="vs-engineer-bytes">{engineer.bytes.toLocaleString()} / {engineer.max.toLocaleString()} bytes ({bytesPct}%)</p>
                <div className="vs-actions"><button className="primary" data-testid="vs-save-engineer" onClick={saveEngineer}><Save size={14}/> Save blob</button></div>
              </section>
            )}

            {tab==='who' && (
              <section className="vs-section">
                <h3>WHO Pass — personal challenge</h3>
                <p className="muted">A question only you can answer. After 4 wrong tries the pass locks for 3 hours.</p>
                <label><input type="checkbox" data-testid="vs-who-enabled" checked={!!who.enabled} onChange={e=>setWho(w=>({...w, enabled:e.target.checked}))}/> Require WHO Pass at login</label>
                <label>Question<input data-testid="vs-who-question" type="text" value={who.question} onChange={e=>setWho(w=>({...w, question:e.target.value}))} placeholder="e.g. First pet's name?"/></label>
                <label>Answer<input data-testid="vs-who-answer" type="text" value={who.answer} onChange={e=>setWho(w=>({...w, answer:e.target.value}))} placeholder="Case-sensitive by default"/></label>
                <label><input type="checkbox" data-testid="vs-who-case" checked={!!who.case_sensitive} onChange={e=>setWho(w=>({...w, case_sensitive:e.target.checked}))}/> Case sensitive</label>
                <div className="vs-actions"><button className="primary" data-testid="vs-save-who" onClick={saveWho}><Save size={14}/> Save WHO Pass</button></div>
              </section>
            )}

            {tab==='mcq' && (
              <section className="vs-section">
                <h3>MCQ Pass — timed multiple choice</h3>
                <p className="muted">A random question from this bank is shown at login. Pick wrong → login denied.</p>
                <label><input type="checkbox" data-testid="vs-mcq-enabled" checked={!!mcq.enabled} onChange={e=>setMcq(m=>({...m, enabled:e.target.checked}))}/> Require MCQ Pass at login</label>
                <label>Time limit per question (sec)<input type="number" min={5} max={600} data-testid="vs-mcq-timelimit" value={mcq.time_limit_sec} onChange={e=>setMcq(m=>({...m, time_limit_sec: parseInt(e.target.value,10)||60}))}/></label>

                {mcq.questions.map((q,qi)=>(
                  <div className="vs-mcq-q" key={qi} data-testid={`vs-mcq-q-${qi}`}>
                    <div className="vs-mcq-q-head">
                      <b>Q{qi+1}</b>
                      <button className="icon-btn danger" onClick={()=>removeMcqQ(qi)} title="Remove"><Trash2 size={14}/></button>
                    </div>
                    <input type="text" placeholder="Question" value={q.q} onChange={e=>updateMcqQ(qi,{q:e.target.value})}/>
                    {q.options.map((opt,oi)=>(
                      <div className="vs-mcq-opt" key={oi}>
                        <input type="radio" name={`mcq-correct-${qi}`} checked={q.correct_idx===oi} onChange={()=>updateMcqQ(qi,{correct_idx:oi})}/>
                        <input type="text" placeholder={`Option ${String.fromCharCode(65+oi)}`} value={opt} onChange={e=>updateMcqOpt(qi,oi,e.target.value)}/>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="vs-actions">
                  <button className="secondary" data-testid="vs-add-mcq-q" onClick={addMcqQ}><Plus size={14}/> Add question</button>
                  <button className="primary" data-testid="vs-save-mcq" onClick={saveMcq}><Save size={14}/> Save MCQ Pass</button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TagInput({value, onChange, placeholder, 'data-testid': dti}){
  const [draft, setDraft] = useState('');
  const add = ()=>{
    const v = draft.trim(); if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="vs-taginput">
      <div className="vs-tags" data-testid={dti ? `${dti}-tags` : undefined}>
        {value.map(v=>(
          <span className="vs-tag" key={v}>{v}
            <button type="button" onClick={()=>onChange(value.filter(x=>x!==v))}><X size={10}/></button>
          </span>
        ))}
      </div>
      <div className="vs-tag-row">
        <input data-testid={dti} type="text" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}} placeholder={placeholder}/>
        <button type="button" className="secondary" onClick={add}><Plus size={14}/> Add</button>
      </div>
    </div>
  );
}
