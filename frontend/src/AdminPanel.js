import {useEffect, useState} from 'react';
import axios from 'axios';
import {Toaster, toast} from 'sonner';
import {Shield, Users, Lock, Activity, AlertCircle, Check, X, LogOut} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const client = axios.create({baseURL: API});
const hdr = () => ({headers: {Authorization: 'Bearer ' + localStorage.getItem('vault_token')}});

export default function AdminPanel({user, onLogout}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    client.get('/admin/stats', hdr()).then(r => {
      setStats(r.data);
      setError('');
      setLoading(false);
    }).catch((e) => {
      const msg=e.response?.status===403?'Owner access only. Sign in with the admin account.':'Failed to load stats';
      setError(msg);
      toast.error(msg);
      setLoading(false);
    });
  };

  useEffect(() => { load() }, []);

  const resolve = async (req) => {
    try {
      await client.patch(`/admin/recovery/${req._id || req.created_at}`, {status: 'resolved'}, hdr());
      toast.success('Marked as resolved');
      load();
    } catch {
      toast.error('Failed to update');
    }
  };

  if (loading) return (
    <div className="admin-loading"><div className="loading-ring"/></div>
  );

  return (
    <div className="admin-panel" data-testid="admin-panel">
      <div className="admin-header">
        <div className="admin-brand"><Shield size={22}/><span>Owner Panel</span></div>
        <button className="icon-btn" onClick={onLogout} title="Logout"><LogOut size={18}/></button>
      </div>

      {error && <div className="admin-denied" data-testid="admin-access-denied"><AlertCircle size={22}/><h2>{error}</h2><button className="primary" data-testid="admin-denied-logout" onClick={onLogout}>Sign in again</button></div>}

      {!error && stats && (
        <>
          <div className="admin-stats-grid">
            <div className="admin-stat-card" data-testid="stat-total-users">
              <Users size={20}/>
              <span className="admin-stat-n">{stats.total_users}</span>
              <span>Total Users</span>
            </div>
            <div className="admin-stat-card" data-testid="stat-total-items">
              <Lock size={20}/>
              <span className="admin-stat-n">{stats.total_items}</span>
              <span>Total Vault Items</span>
            </div>
            <div className="admin-stat-card" data-testid="stat-adv-items">
              <Shield size={20}/>
              <span className="admin-stat-n">{stats.adv_items}</span>
              <span>Advance Mode Items</span>
            </div>
            <div className="admin-stat-card" data-testid="stat-today-logins">
              <Activity size={20}/>
              <span className="admin-stat-n">{stats.today_logins}</span>
              <span>Logins Today</span>
            </div>
            <div className="admin-stat-card" data-testid="stat-week-logins">
              <Activity size={20}/>
              <span className="admin-stat-n">{stats.week_logins}</span>
              <span>Logins This Week</span>
            </div>
            <div className="admin-stat-card" data-testid="stat-online-today">
              <Users size={20}/>
              <span className="admin-stat-n" style={{color:'var(--green)'}}>{stats.online_today ?? '—'}</span>
              <span>Members Online Today</span>
            </div>
            <div className="admin-stat-card" data-testid="stat-online-now">
              <Users size={20}/>
              <span className="admin-stat-n" style={{color:'#34d399'}}>{stats.online_now ?? '—'}</span>
              <span>Active Last Hour</span>
            </div>
            <div className="admin-stat-card" data-testid="stat-pending-recovery">
              <AlertCircle size={20}/>
              <span className="admin-stat-n" style={{color: stats.pending_recovery > 0 ? 'var(--red)' : 'var(--green)'}}>{stats.pending_recovery}</span>
              <span>Pending Recovery</span>
            </div>
          </div>

          <div className="admin-section">
            <h3>Recovery Requests</h3>
            {stats.recovery_requests.length === 0 ? (
              <p className="muted">No pending recovery requests.</p>
            ) : (
              <div className="recovery-list">
                {stats.recovery_requests.map((req, i) => (
                  <div key={i} className="recovery-card" data-testid={`recovery-req-${i}`}>
                    <div className="recovery-info">
                      <b>{req.app_name}</b>
                      <span className="muted">{req.email}</span>
                      {req.user_id_hint && <span className="muted">User hint: {req.user_id_hint}</span>}
                      <p>{req.description}</p>
                      <span className="recovery-time">{new Date(req.created_at).toLocaleString()}</span>
                    </div>
                    <button className="primary" onClick={() => resolve(req)} style={{flexShrink:0}}>
                      <Check size={14}/> Resolve
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <Toaster theme="dark"/>
    </div>
  );
}
