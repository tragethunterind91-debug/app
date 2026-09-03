import {useEffect, useRef, useState} from 'react';
import {motion, useInView} from 'framer-motion';
import {ShieldCheck, Lock, Shield, KeyRound, Skull, EyeOff, ShieldAlert, ArrowUpRight, ArrowRight, Check, X as XIcon, ChevronDown, Sparkles, Zap, Fingerprint, ScrollText} from 'lucide-react';
import {Accordion, AccordionItem, AccordionTrigger, AccordionContent} from './components/ui/accordion';
import './LandingPage.css';

const fadeUp={hidden:{opacity:0,y:32},visible:{opacity:1,y:0,transition:{duration:.7,ease:[0.16,1,0.3,1]}}};
const stagger={hidden:{},visible:{transition:{staggerChildren:.12}}};

function Reveal({children,className,delay=0}){
  return <motion.div className={className} initial="hidden" whileInView="visible" viewport={{once:true,margin:'-80px'}}
    variants={{hidden:{opacity:0,y:36},visible:{opacity:1,y:0,transition:{duration:.7,delay,ease:[0.16,1,0.3,1]}}}}>{children}</motion.div>;
}

function Counter({to,suffix='',prefix=''}){
  const ref=useRef(null);
  const inView=useInView(ref,{once:true,margin:'-40px'});
  const [val,setVal]=useState(0);
  useEffect(()=>{
    if(!inView)return;
    let start=null;const duration=1300;
    const step=(ts)=>{if(!start)start=ts;const p=Math.min((ts-start)/duration,1);setVal(Math.round(to*p));if(p<1)requestAnimationFrame(step)};
    requestAnimationFrame(step);
  },[inView,to]);
  return <span ref={ref}>{prefix}{val}{suffix}</span>;
}

function Hero({onGetStarted}){
  const ref=useRef(null);
  const onMove=(e)=>{const r=ref.current.getBoundingClientRect();ref.current.style.setProperty('--mx',`${e.clientX-r.left}px`);ref.current.style.setProperty('--my',`${e.clientY-r.top}px`)};
  return (
    <section className="tp5-hero" ref={ref} onMouseMove={onMove} data-testid="landing-hero">
      <div className="tp5-hero-glow"/>
      <div className="tp5-grid-overlay"/>
      <motion.div className="tp5-hero-inner" initial="hidden" animate="visible" variants={stagger}>
        <motion.p className="tp5-eyebrow" variants={fadeUp}><Sparkles size={12}/> ZERO-KNOWLEDGE · MILITARY GRADE</motion.p>
        <motion.h1 variants={fadeUp}>Your secrets.<br/><em>Fortified beyond reason.</em></motion.h1>
        <motion.p className="tp5-hero-sub" variants={fadeUp}>TopPass5 wraps every password, key and secret in AES-256 encryption, three independent identity layers, and a self-destruct failsafe most vaults do not dare offer.</motion.p>
        <motion.div className="tp5-hero-ctas" variants={fadeUp}>
          <button className="tp5-btn-primary" data-testid="landing-cta-create" onClick={onGetStarted}><Lock size={17}/> Create Your Vault <ArrowUpRight size={16}/></button>
          <button className="tp5-btn-ghost" data-testid="landing-cta-explore" onClick={()=>document.getElementById('tp5-features')?.scrollIntoView({behavior:'smooth'})}>Explore The Architecture</button>
        </motion.div>
        <motion.div className="tp5-hero-badges" variants={fadeUp}>{['AES-256','3-Layer Auth','Zero-Knowledge','Hardcore Mode'].map(b=><span key={b} className="tp5-chip">{b}</span>)}</motion.div>
      </motion.div>
      <div className="tp5-hero-orb">
        <div className="tp5-orb-ring r1"/><div className="tp5-orb-ring r2"/><div className="tp5-orb-ring r3"/>
        <div className="tp5-orb-core"><ShieldCheck size={44}/></div>
        {['AES-256','ZERO-KNOWLEDGE','3-LAYER','HARDCORE'].map((t,i)=><span key={t} className={`tp5-orb-badge b${i}`}>{t}</span>)}
      </div>
      <button className="tp5-scroll-cue" data-testid="landing-scroll-cue" onClick={()=>document.getElementById('tp5-marquee')?.scrollIntoView({behavior:'smooth'})}><ChevronDown size={20}/></button>
    </section>
  );
}

function TrustMarquee(){
  const items=['AES-256 ENCRYPTION','ZERO-KNOWLEDGE ARCHITECTURE','BCRYPT PASSWORD HASHING','SHA-256 HASHING','JWT SESSION SECURITY','TOTP 2FA SUPPORT','TLS IN TRANSIT','TIME-LIMITED SHARE LINKS'];
  const loop=[...items,...items];
  return <div className="tp5-marquee" id="tp5-marquee" data-testid="landing-marquee"><div className="tp5-marquee-track">{loop.map((t,i)=><span key={i} className="tp5-marquee-item"><Zap size={12}/>{t}</span>)}</div></div>;
}

function StatsSection(){
  return (
    <section className="tp5-stats">
      <Reveal className="tp5-stats-grid">
        <div className="tp5-stat" data-testid="stat-layers"><h3><Counter to={3}/></h3><p>Independent auth layers</p></div>
        <div className="tp5-stat" data-testid="stat-bit"><h3><Counter to={256} suffix="-bit"/></h3><p>Encryption standard</p></div>
        <div className="tp5-stat" data-testid="stat-passes"><h3><Counter to={20}/></h3><p>Unique crypto type passes</p></div>
        <div className="tp5-stat" data-testid="stat-response"><h3>&lt;<Counter to={40} suffix="ms"/></h3><p>Average vault response</p></div>
      </Reveal>
    </section>
  );
}

function FeatureGrid(){
  const feats=[
    {icon:Lock,title:'AES-256 Encryption',big:true,desc:"Every password and value is encrypted before it ever touches our servers. Even we can't read your data."},
    {icon:Shield,title:'Multi-Layer Auth',desc:'Email + Password, Birthday verification, and Crypto Type Pass — three checkpoints, one vault.'},
    {icon:KeyRound,title:'Crypto Type Pass',desc:'20 unique passwords generated for you. Enable it yourself from Settings, whenever you choose — never forced on you at signup.'},
    {icon:Skull,title:'Hardcore Mode',big:true,danger:true,desc:'Optional self-destruct. Exceed your own failure limits and the vault erases itself. No mercy, no recovery.'},
    {icon:EyeOff,title:'Zero-Knowledge',desc:'We never see your passwords in plaintext. Birthdays and crypto passes live only as one-way hashes.'},
    {icon:ShieldAlert,title:'Advance Mode',desc:'A second passphrase gate on view, copy, edit AND delete for your most sensitive items. Miss it four times, it locks for 3 days.'},
  ];
  return (
    <section className="tp5-features" id="tp5-features">
      <Reveal className="tp5-section-head"><p className="tp5-eyebrow">WHY TOPPASS5</p><h2>Security that never sleeps</h2></Reveal>
      <div className="tp5-bento">
        {feats.map((f,i)=><Reveal key={f.title} delay={i*0.06} className={`tp5-bento-card${f.big?' big':''}${f.danger?' danger':''}`}>
          <div className="tp5-bento-icon"><f.icon size={26}/></div><h3>{f.title}</h3><p>{f.desc}</p>
        </Reveal>)}
      </div>
    </section>
  );
}

function HowItWorks(){
  const steps=[
    {n:'01',title:'Create your vault',desc:'Register with email, password, and a birthday checkpoint that can never be recovered by anyone but you.'},
    {n:'02',title:'Unlock Crypto Type Pass — on your terms',desc:"It's waiting in Settings. Nobody hands it to you at signup — you go get it, and enable it, when you're ready."},
    {n:'03',title:'Encrypt every secret',desc:'Every value is sealed with AES-256 before it leaves your browser. Plaintext never touches our database.'},
    {n:'04',title:'Access through layers you control',desc:'Choose PIN lock, Advance Mode, Hardcore Mode. Your vault, your rules, no shortcuts.'},
  ];
  return (
    <section className="tp5-how">
      <Reveal className="tp5-section-head"><p className="tp5-eyebrow">HOW IT WORKS</p><h2>Four steps to a fortress</h2></Reveal>
      <div className="tp5-timeline">
        {steps.map((s,i)=><Reveal key={s.n} delay={i*0.1} className="tp5-timeline-step"><div className="tp5-timeline-num">{s.n}</div><div><h3>{s.title}</h3><p>{s.desc}</p></div></Reveal>)}
      </div>
    </section>
  );
}

function SecurityDeepDive(){
  return (
    <section className="tp5-deep">
      <Reveal className="tp5-deep-text">
        <p className="tp5-eyebrow">UNDER THE HOOD</p>
        <h2>Zero-knowledge, by architecture — not by promise.</h2>
        <p>Your birthday, your Crypto Type Pass, and your Advance Mode passphrases are never stored as readable text. They live as one-way cryptographic hashes — the same math that secures crypto wallets. If a database were ever exposed, there would be nothing usable inside.</p>
        <ul className="tp5-deep-list">
          <li><Fingerprint size={15}/> Bcrypt-hashed passwords &amp; passphrases</li>
          <li><ScrollText size={15}/> SHA-256 hashed birthdays — no forgot option, by design</li>
          <li><Lock size={15}/> Fernet (AES + HMAC) encrypted vault values</li>
        </ul>
      </Reveal>
      <Reveal delay={.15} className="tp5-deep-visual"><div className="tp5-cipher"><div className="tp5-cipher-ring c1"/><div className="tp5-cipher-ring c2"/><div className="tp5-cipher-ring c3"/><div className="tp5-cipher-core"><Lock size={32}/></div></div></Reveal>
    </section>
  );
}

function ComparisonSection(){
  const rows=['Multi-layer authentication','Self-destruct Hardcore Mode','Per-item Advance passphrase gate','Zero-knowledge identity hashing','Crypto Type Pass quiz on login','No forgot-password backdoor'];
  return (
    <section className="tp5-compare">
      <Reveal className="tp5-section-head"><p className="tp5-eyebrow">THE DIFFERENCE</p><h2>Not your average password app</h2></Reveal>
      <Reveal delay={.1} className="tp5-compare-table" data-testid="landing-compare-table">
        <div className="tp5-compare-row tp5-compare-head"><span/><span>TopPass5</span><span>Typical Manager</span></div>
        {rows.map(label=><div className="tp5-compare-row" key={label}><span>{label}</span><span className="yes"><Check size={16}/></span><span className="no"><XIcon size={16}/></span></div>)}
      </Reveal>
    </section>
  );
}

function FAQSection(){
  const faqs=[
    ['What happens if I forget my birthday or Crypto Type Pass?','There is no recovery — by design. It\'s the price of a vault nobody else can break into, including us.'],
    ['What is Hardcore Mode?','An optional self-destruct. Set your own failure limits, and if they\'re exceeded, your account and every secret inside it are permanently deleted.'],
    ['What is Advance Mode?','A second passphrase you set per item. Viewing, copying, editing, or deleting that item requires it — four wrong tries locks it for three days.'],
    ['Can TopPass5 see my passwords?','No. Every value is AES-encrypted before storage, and identity checkpoints like your birthday are one-way hashed. We could not read them even if asked.'],
    ['When do I get my Crypto Type Pass?','Never automatically. After you create your vault, go to Settings and generate it yourself — you decide when to enable it as Layer 3.'],
  ];
  return (
    <section className="tp5-faq">
      <Reveal className="tp5-section-head"><p className="tp5-eyebrow">QUESTIONS</p><h2>Everything you are wondering</h2></Reveal>
      <Reveal delay={.1} className="tp5-faq-wrap">
        <Accordion type="single" collapsible>
          {faqs.map(([q,a],i)=><AccordionItem value={`faq-${i}`} key={i} className="tp5-faq-item" data-testid={`faq-item-${i}`}>
            <AccordionTrigger className="tp5-faq-trigger" data-testid={`faq-trigger-${i}`}>{q}</AccordionTrigger>
            <AccordionContent className="tp5-faq-content">{a}</AccordionContent>
          </AccordionItem>)}
        </Accordion>
      </Reveal>
    </section>
  );
}

function CTASection({onGetStarted}){
  return (
    <section className="tp5-cta">
      <Reveal className="tp5-cta-inner">
        <h2>Ready to build your fortress?</h2>
        <p>Takes under a minute. No credit card. No compromise.</p>
        <button className="tp5-btn-primary large" data-testid="landing-cta-final" onClick={onGetStarted}><Lock size={18}/> Create Your Vault <ArrowRight size={18}/></button>
      </Reveal>
    </section>
  );
}

function Footer(){
  return (
    <footer className="tp5-footer">
      <div className="tp5-footer-top">
        <div className="tp5-footer-brand"><ShieldCheck size={20}/> TOPPASS5</div>
        <div className="tp5-footer-cols">
          <div><h4>Product</h4><span>Vault</span><span>Advance Mode</span><span>Hardcore Mode</span></div>
          <div><h4>Security</h4><span>AES-256</span><span>Zero-Knowledge</span><span>Crypto Type Pass</span></div>
          <div><h4>Company</h4><span>ZNQ Network</span></div>
        </div>
      </div>
      <div className="tp5-footer-bottom"><img src="https://img.sanishtech.com/u/7ad9ec964e6da7120bb20b71fd4cbcb3.png" alt="ZNQ" className="tp5-znq-logo"/><span>by ZNQ NETWORK — Your secrets. Only yours.</span></div>
    </footer>
  );
}

export default function LandingPage({onGetStarted}){
  return (
    <div className="tp5-landing" data-testid="landing-page">
      <nav className="tp5-nav">
        <div className="tp5-nav-logo"><img src="/toppass5-logo-sm.jpeg" alt="TopPass5" className="brand-logo-mark"/><span>TOPPASS5</span></div>
        <button className="tp5-btn-primary small" data-testid="landing-get-started" onClick={onGetStarted}>Get Started <ArrowUpRight size={15}/></button>
      </nav>
      <Hero onGetStarted={onGetStarted}/>
      <TrustMarquee/>
      <StatsSection/>
      <FeatureGrid/>
      <HowItWorks/>
      <SecurityDeepDive/>
      <ComparisonSection/>
      <FAQSection/>
      <CTASection onGetStarted={onGetStarted}/>
      <Footer/>
    </div>
  );
}
