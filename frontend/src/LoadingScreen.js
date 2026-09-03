import {useEffect, useState} from 'react';
import {motion} from 'framer-motion';
import {ShieldCheck, Lock, Shield, Fingerprint, Skull, KeyRound} from 'lucide-react';
import './LoadingScreen.css';

const MESSAGES=[
  'Initializing zero-knowledge core…',
  'Generating AES-256 cipher keys…',
  'Booting multi-layer authentication…',
  'Calibrating Crypto Type Pass engine…',
  'Hardening Hardcore Mode failsafes…',
  'Sealing Advance Mode passphrase vault…',
  'Running integrity & breach diagnostics…',
  'Vault fortress ready.'
];

const letterVariants={hidden:{opacity:0,y:24,rotateX:-90},visible:{opacity:1,y:0,rotateX:0,transition:{duration:.6,ease:[0.16,1,0.3,1]}}};
const titleContainer={hidden:{},visible:{transition:{staggerChildren:.08}}};

export default function LoadingScreen({duration=14000}){
  const [pct,setPct]=useState(0);
  const [msgIdx,setMsgIdx]=useState(0);
  useEffect(()=>{
    const stepMs=duration/100;
    const t1=setInterval(()=>setPct(p=>p<100?p+1:p),stepMs);
    const stepMs2=duration/MESSAGES.length;
    const t2=setInterval(()=>setMsgIdx(i=>i<MESSAGES.length-1?i+1:i),stepMs2);
    return ()=>{clearInterval(t1);clearInterval(t2)};
  },[duration]);
  const title='TOPPASS5';
  return (
    <div className="tp5-load" data-testid="loading-screen">
      <div className="tp5-load-grid"/>
      <div className="tp5-load-beam"/>
      <div className="tp5-load-center">
        <motion.div className="tp5-load-shield" animate={{scale:[1,1.08,1],opacity:[1,.85,1]}} transition={{duration:2,repeat:Infinity,ease:'easeInOut'}}>
          <ShieldCheck size={40}/>
          <div className="tp5-load-orbit"><Lock size={13}/></div>
          <div className="tp5-load-orbit o2"><KeyRound size={13}/></div>
          <div className="tp5-load-orbit o3"><Skull size={13}/></div>
        </motion.div>
        <motion.h1 className="tp5-load-title" initial="hidden" animate="visible" variants={titleContainer}>
          {title.split('').map((c,i)=><motion.span key={i} variants={letterVariants}>{c}</motion.span>)}
        </motion.h1>
        <div className="tp5-load-status" data-testid="loading-status-message">{MESSAGES[msgIdx]}<span className="tp5-load-cursor"/></div>
        <div className="tp5-load-bar-wrap"><div className="tp5-load-bar" style={{width:`${pct}%`}} data-testid="loading-progress-bar"/></div>
        <div className="tp5-load-pct" data-testid="loading-percentage">{pct}%</div>
        <div className="tp5-load-features"><span><Lock size={11}/> AES-256</span><span><Shield size={11}/> 3-Layer Auth</span><span><Fingerprint size={11}/> Zero-Knowledge</span></div>
      </div>
      <div className="tp5-load-footer"><img src="https://img.sanishtech.com/u/7ad9ec964e6da7120bb20b71fd4cbcb3.png" alt="ZNQ NETWORK" className="tp5-load-znq"/><p>by ZNQ NETWORK</p><p className="tp5-load-safety">Safety First • Security Always • Data Protected</p></div>
    </div>
  );
}
