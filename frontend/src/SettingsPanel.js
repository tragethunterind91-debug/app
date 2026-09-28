import { useState } from 'react';
import { Moon, Sun, History, Monitor, Calendar, Check, ArrowUpRight, Download, RefreshCw, Skull, FileText, LogOut, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPanel({
  user, settings, onSaveSettings, onSaveTheme, onSaveAutoLock, onLogout, onClose,
  pinEnabled, onSetupPin, onDisablePin,
  l3Enabled, onToggleL3, onExportL3, onRegenL3,
  onOpenHardcore, hasBirthday, onSetupBirthday,
  disclaimerEnabled, onToggleDisclaimer,
  loginHistory, onLoadHistory, historyLoaded,
}) {
  const [setupPinMode, setSetupPinMode] = useState(false);
  const [setupPinValue, setSetupPinValue] = useState('');
  const [setupPinConfirm, setSetupPinConfirm] = useState('');
  const [setupPinErr, setSetupPinErr] = useState('');

  return (
    <div className="modal-backdrop">
      <div className="modal settings-modal" data-testid="settings-modal" style={{ maxHeight: '88vh', overflowY: 'auto' }}>
        <button type="button" className="modal-close icon-btn" data-testid="close-settings" onClick={onClose}><X /></button>
        <p className="eyebrow">PREFERENCES</p>
        <h2>Settings</h2>
        <div className="settings-list">
          {/* Theme */}
          <div className="settings-row" data-testid="theme-setting">
            <div className="settings-info"><b>Theme</b><p>Choose the vault look that feels best for this device.</p></div>
            <div className="theme-toggle" role="group" aria-label="Theme">
              <button type="button" data-testid="theme-dark-button" className={settings.theme !== 'light' ? 'active' : ''} onClick={() => onSaveTheme('dark')}><Moon size={14} /> Dark</button>
              <button type="button" data-testid="theme-light-button" className={settings.theme === 'light' ? 'active' : ''} onClick={() => onSaveTheme('light')}><Sun size={14} /> Light</button>
            </div>
          </div>
          {/* Autofill */}
          <div className="settings-row" data-testid="autofill-setting">
            <div className="settings-info"><b>Browser Autofill</b><p>Allow browser to autofill and suggest saving vault values in forms.</p></div>
            <label className="toggle-switch"><input type="checkbox" checked={settings.autofill} onChange={e => onSaveSettings({ ...settings, autofill: e.target.checked })} /><span className="toggle-slider" /></label>
          </div>
          {/* PIN */}
          <div className="settings-row" data-testid="pin-setting">
            <div className="settings-info"><b>Vault PIN Lock</b><p>Auto-locks vault after your selected inactivity timeout.</p></div>
            <label className="toggle-switch">
              <input type="checkbox" checked={pinEnabled} onChange={e => {
                if (!e.target.checked) { onDisablePin(); setSetupPinMode(false); }
                else setSetupPinMode(true);
              }} /><span className="toggle-slider" />
            </label>
          </div>
          {/* Auto-lock timer */}
          <div className="settings-row" data-testid="auto-lock-setting">
            <div className="settings-info"><b>Auto-Lock Timer</b><p>Lock the vault after inactivity when PIN Lock is enabled.</p></div>
            <select data-testid="auto-lock-select" className="settings-select" value={settings.autoLockMinutes || 5} onChange={e => onSaveAutoLock(Number(e.target.value))}>
              <option value="1">1 min</option><option value="5">5 min</option><option value="15">15 min</option><option value="30">30 min</option>
            </select>
          </div>
          {setupPinMode && (
            <div className="pin-setup-section">
              <p className="muted" style={{ fontSize: '12px', margin: '0 0 10px' }}>Set your 4-digit PIN:</p>
              <div className="pin-setup-row">
                <input type="password" maxLength="4" inputMode="numeric" data-testid="pin-setup-input" value={setupPinValue} onChange={e => setSetupPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" className="pin-input-field" />
                <input type="password" maxLength="4" inputMode="numeric" data-testid="pin-confirm-input" value={setupPinConfirm} onChange={e => setSetupPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Confirm" className="pin-input-field" />
                <button className="primary" data-testid="pin-confirm-btn" onClick={() => {
                  if (setupPinValue.length !== 4 || setupPinValue !== setupPinConfirm) { setSetupPinErr('PINs must be 4 digits and match'); return; }
                  onSetupPin(setupPinValue);
                  setSetupPinMode(false); setSetupPinValue(''); setSetupPinConfirm(''); setSetupPinErr('');
                }}>Set PIN</button>
              </div>
              {setupPinErr && <p style={{ color: 'var(--red)', fontSize: '12px', marginTop: '6px' }}>{setupPinErr}</p>}
            </div>
          )}

          {/* Login History */}
          <div className="settings-divider"><span>LOGIN HISTORY</span></div>
          <div className="settings-row login-history-panel" data-testid="login-history-setting">
            <div className="settings-info">
              <b><History size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Last 5 Logins</b>
              <p>Recent successful access events for this vault.</p>
              {historyLoaded && (
                <div className="login-history-list" data-testid="login-history-list">
                  {loginHistory.length ? loginHistory.map((h, i) => (
                    <div className="login-history-item" key={h.id} data-testid={`login-history-${i}`}>
                      <Monitor size={13} /><span>{new Date(h.ts).toLocaleString()}</span><b>{h.device}</b>
                    </div>
                  )) : <span className="muted-sm">No login history yet.</span>}
                </div>
              )}
            </div>
            <button type="button" className="secondary" data-testid="load-login-history" onClick={onLoadHistory}>Load</button>
          </div>

          {/* Layer 2 */}
          <div className="settings-divider"><span>LAYER 2 — BIRTHDAY</span></div>
          {!hasBirthday ? (
            <div className="settings-row clickable" data-testid="birthday-setup-btn" onClick={onSetupBirthday}>
              <div className="settings-info"><b>Set Birthday</b><p>Add Layer 2 protection. You'll verify your birthday on every login.</p></div>
              <Calendar size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
            </div>
          ) : (
            <div className="settings-row">
              <div className="settings-info"><b>Birthday Set</b><p>Layer 2 is active. You verify your birthday on every login.</p></div>
              <Check size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
            </div>
          )}

          {/* Layer 3 */}
          <div className="settings-divider"><span>LAYER 3 — CRYPTO TYPE PASS</span></div>
          <div className="settings-row" data-testid="l3-toggle-setting">
            <div className="settings-info"><b>Layer 3 Lock</b><p>Require crypto type pass verification on every login. You must pass a quiz to enable.</p></div>
            <label className="toggle-switch"><input type="checkbox" checked={l3Enabled} onChange={e => onToggleL3(e.target.checked)} /><span className="toggle-slider" /></label>
          </div>
          <div className="settings-row clickable" data-testid="l3-export-btn" onClick={onExportL3}>
            <div className="settings-info"><b>Export Crypto Pass</b><p>Download the only offline copy of your 20 crypto type passwords.</p></div>
            <Download size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          </div>
          <div className="settings-row clickable" data-testid="l3-regen-btn" onClick={onRegenL3}>
            <div className="settings-info"><b>Regenerate Passwords</b><p>Get new random passwords. Max 3 changes per month. Requires password.</p></div>
            <RefreshCw size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          </div>

          {/* Security */}
          <div className="settings-divider"><span>SECURITY</span></div>
          <div className="settings-row" data-testid="disclaimer-toggle-setting">
            <div className="settings-info"><b>Disclaimer Notice</b><p>Show disclaimer about password leak responsibility on login.</p></div>
            <label className="toggle-switch"><input type="checkbox" checked={disclaimerEnabled} onChange={e => onToggleDisclaimer(e.target.checked)} /><span className="toggle-slider" /></label>
          </div>

          {/* Hardcore */}
          <div className="settings-divider"><span>HARDCORE MODE</span></div>
          <div className="settings-row clickable" data-testid="hardcore-btn" onClick={onOpenHardcore}>
            <div className="settings-info">
              <b><Skull size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Hardcore Mode</b>
              <p>Auto-delete account on too many failures. Customize limits.</p>
            </div>
            <ArrowUpRight size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
          </div>

          {/* Legal */}
          <div className="settings-divider"><span>LEGAL & ACCOUNT</span></div>
          <div className="settings-row clickable" data-testid="terms-btn" onClick={() => window.__showTerms?.()}>
            <div className="settings-info"><b>Terms & Conditions</b></div>
            <FileText size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          </div>
          <div className="settings-row clickable" data-testid="privacy-btn" onClick={() => window.__showPrivacy?.()}>
            <div className="settings-info"><b>Privacy Policy</b></div>
            <FileText size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          </div>
          <div className="settings-row clickable danger-row" data-testid="logout-settings-btn" onClick={onLogout}>
            <div className="settings-info"><b style={{ color: 'var(--red)' }}>Log Out</b><p>Sign out of your vault.</p></div>
            <LogOut size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
