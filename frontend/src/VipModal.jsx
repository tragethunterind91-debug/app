import {useEffect, useState} from 'react';
import {Crown, X, Check, ShieldCheck, KeyRound, Share2, Monitor, Globe, LogOut, Fingerprint, HardDrive, Sparkles, Zap, Loader2} from 'lucide-react';
import './VipModal.css';

// Grouped VIP capabilities — professional presentation.
const VIP_SECTIONS = [
  {
    title: 'Security',
    items: [
      {icon: KeyRound,    label: 'Unlimited Advance Mode items'},
      {icon: Globe,       label: 'IP and country login lock'},
      {icon: LogOut,      label: 'Remote sign-out across all devices'},
      {icon: Fingerprint, label: 'Scheduled vault self-destruct'},
    ],
  },
  {
    title: 'Access & Sharing',
    items: [
      {icon: Share2,      label: 'Share links with view limits and password'},
      {icon: Monitor,     label: 'Up to two trusted devices per account'},
      {icon: Zap,         label: 'Custom session timeout controls'},
      {icon: HardDrive,   label: 'Engineer Mode and 500 KB per-user storage'},
    ],
  },
  {
    title: 'Experience',
    items: [
      {icon: ShieldCheck, label: 'All current and future VIP updates included'},
      {icon: Sparkles,    label: 'VIP badge, custom themes, priority support'},
    ],
  },
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
      // caller surfaces errors via toast if needed
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
      <div className="modal vip-modal" data-testid="vip-modal" role="dialog" aria-label="TopPass5 Membership">
        <button type="button" className="modal-close icon-btn" data-testid="vip-modal-close" onClick={onClose}><X/></button>

        <header className="vip-hero">
          <div className="vip-hero-icon"><Crown size={26}/></div>
          <p className="eyebrow">Membership</p>
          <h2>TopPass5 Professional</h2>
          <p className="vip-sub">A single, one-time payment unlocks the full feature set and every future update. No recurring charges, no tiered pricing.</p>
        </header>

        {active ? (
          <section className="vip-status-card" data-testid="vip-status-active">
            <div className="vip-status-row">
              <Check size={18}/>
              <div>
                <b>Membership active</b>
                <small>{daysLeft} day{daysLeft === 1 ? '' : 's'} remaining{untilDate ? ` · renews on ${untilDate}` : ''}</small>
              </div>
            </div>
            <small className="vip-status-note">Thank you for supporting TopPass5. Extend your membership to add another {days} days of access.</small>
          </section>
        ) : (
          <section className="vip-price-row">
            <div className="vip-price">
              <span className="vip-price-cur">USD</span>
              <span className="vip-price-amt">{price.toFixed(2)}</span>
            </div>
            <div className="vip-price-sub">
              <b>{days} days of access</b>
              <small>One-time payment · no auto-renewal</small>
            </div>
          </section>
        )}

        <div className="vip-feature-sections" data-testid="vip-feature-list">
          {VIP_SECTIONS.map(section => (
            <section key={section.title} className="vip-feature-section">
              <h4 className="vip-feature-heading">{section.title}</h4>
              <ul className="vip-feature-list">
                {section.items.map(({icon:Icon, label}, i)=>(
                  <li key={i}><Icon size={13}/> <span>{label}</span></li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <button
          className="primary wide vip-cta"
          data-testid={active ? 'vip-extend-btn' : 'vip-upgrade-btn'}
          onClick={purchase}
          disabled={loading}
        >
          {loading
            ? <><Loader2 size={16} className="spin"/> Processing payment</>
            : (active
                ? <>Extend membership — USD {price.toFixed(2)}</>
                : <>Activate membership — USD {price.toFixed(2)}</>
              )
          }
        </button>

        <p className="vip-fineprint">
          Secure checkout · encrypted at rest and in transit. Running in sandbox mode while the payment provider is being provisioned — no card is charged.
        </p>
      </div>
    </div>
  );
}
