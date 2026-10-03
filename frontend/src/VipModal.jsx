import {useEffect, useState} from 'react';
import {Crown, X, Check, Sparkles, ShieldCheck, Zap, KeyRound, Share2, Monitor, Globe, LogOut, Fingerprint, HardDrive, Loader2} from 'lucide-react';

// VIP highlights (spec: VIP = VIP core + all Updates. UI showcase only — no functionality yet.)
const VIP_HIGHLIGHTS = [
  {icon: ShieldCheck, label: 'All future updates included'},
  {icon: KeyRound,    label: 'Unlimited Advance Mode items'},
  {icon: Share2,      label: 'Share links with view-limit + password'},
  {icon: Monitor,     label: 'Up to 2 trusted devices per account'},
  {icon: Globe,       label: 'IP + country login lock'},
  {icon: LogOut,      label: 'Remote "logout all devices" kill-switch'},
  {icon: Zap,         label: 'Custom session auto-off timeout'},
  {icon: Fingerprint, label: 'Scheduled self-destruct date'},
  {icon: HardDrive,   label: 'Engineer Mode + 500 KB per-user storage'},
  {icon: Sparkles,    label: 'VIP badge, custom themes, priority support'},
];

export default function VipModal({client, authHeader, onClose, onPurchased}){
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    let on = true;
    client.get('/vip/status', authHeader())
      .then(r => { if (on) setStatus(r.data); })
      .catch(()=>{});
    return ()=>{ on = false; };
  }, [client, authHeader]);

  const purchase = async ()=>{
    setLoading(true);
    try {
      const r = await client.post('/vip/purchase', {}, authHeader());
      setStatus(s => ({
        ...(s||{}),
        is_vip: true,
        vip_until: r.data.user.vip_until,
        days_remaining: s ? (s.days_remaining||0) + 75 : 75,
        purchases: (s?.purchases || 0) + 1,
      }));
      onPurchased && onPurchased(r.data.user);
    } catch (e) {
      // keep silent; a toast is handled by caller if needed
    } finally {
      setLoading(false);
    }
  };

  const active = !!status?.is_vip;
  const daysLeft = status?.days_remaining ?? 0;
  const price = status?.price_usd ?? 1.5;
  const days = status?.duration_days ?? 75;
  const untilDate = status?.vip_until ? new Date(status.vip_until).toLocaleDateString() : null;

  return (
    <div className="modal-backdrop" data-testid="vip-modal-backdrop">
      <div className="modal vip-modal" data-testid="vip-modal" role="dialog" aria-label="VIP upgrade">
        <button type="button" className="modal-close icon-btn" data-testid="vip-modal-close" onClick={onClose}><X/></button>

        <div className="vip-hero">
          <div className="vip-hero-icon"><Crown size={30}/></div>
          <p className="eyebrow">TOPPASS5 · VIP</p>
          <h2>Unlock every lock.</h2>
          <p className="vip-sub">One flat price. All current VIP features. All future updates. No subscription traps.</p>
        </div>

        {active ? (
          <div className="vip-status-card" data-testid="vip-status-active">
            <div className="vip-status-row"><Check size={18}/><div><b>VIP active</b><small>{daysLeft} day{daysLeft === 1 ? '' : 's'} remaining{untilDate ? ` · until ${untilDate}` : ''}</small></div></div>
            <small className="vip-status-note">Thanks for supporting TopPass5. Tap "Extend" to add another {days} days.</small>
          </div>
        ) : (
          <div className="vip-price-row">
            <div className="vip-price"><span className="vip-price-cur">$</span><span className="vip-price-amt">{price.toFixed(2)}</span></div>
            <div className="vip-price-sub"><b>for {days} days</b><small>2 months + 15 days · one-time</small></div>
          </div>
        )}

        <ul className="vip-feature-list" data-testid="vip-feature-list">
          {VIP_HIGHLIGHTS.map(({icon:Icon, label}, i)=>(
            <li key={i}><Icon size={14}/> <span>{label}</span></li>
          ))}
        </ul>

        <button
          className="primary wide vip-cta"
          data-testid={active ? 'vip-extend-btn' : 'vip-upgrade-btn'}
          onClick={purchase}
          disabled={loading}
        >
          {loading ? <><Loader2 size={16} className="spin"/> Processing…</> : (active ? <>Extend {days} more days — ${price.toFixed(2)}</> : <><Crown size={16}/> Upgrade for ${price.toFixed(2)}</>)}
        </button>

        <p className="vip-fineprint">
          Demo mode — this is a fake payment button for testing. No card is charged.
          Real payments will swap in when the production provider is wired.
        </p>
      </div>
    </div>
  );
}
