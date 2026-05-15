import { resolveColors, type Tokens } from './tokenColors'

interface Props {
  tokens: Tokens
  mode: 'light' | 'dark'
}

export function TokenPreview({ tokens, mode }: Props) {
  const c = resolveColors(tokens, mode)

  return (
    <div className="flex flex-col flex-1 overflow-y-auto" style={{ backgroundColor: c.pageBg }}>
      <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">

        {/* Buttons */}
        <Section label="Buttons" textColor={c.textSec}>
          <div className="flex flex-wrap gap-2">
            <button style={{ backgroundColor: c.brand, color: c.onBrand, border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Primary
            </button>
            <button style={{ backgroundColor: 'transparent', color: c.brandText, border: `1.5px solid ${c.brand}`, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Outline
            </button>
            <button style={{ backgroundColor: c.brandSub, color: c.brandText, border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Subtle
            </button>
            <button style={{ backgroundColor: 'transparent', color: c.textSec, border: `1.5px solid ${c.border}`, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Default
            </button>
            <button style={{ backgroundColor: c.danger, color: c.onBrand, border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Danger
            </button>
            <button style={{ backgroundColor: c.disabled, color: c.textPh, border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 400, cursor: 'not-allowed' }}>
              Disabled
            </button>
          </div>
        </Section>

        {/* Focus ring demo */}
        <Section label="Focus" textColor={c.textSec}>
          <div className="flex gap-2 flex-wrap">
            <button style={{ backgroundColor: 'transparent', color: c.brandText, border: `1.5px solid ${c.border}`, padding: '7px 16px', borderRadius: 8, fontSize: 13, outline: `2px solid ${c.focusRing}`, outlineOffset: 2, cursor: 'pointer' }}>
              Focused button
            </button>
            <div style={{ backgroundColor: c.raisedBg, border: `2px solid ${c.focusRing}`, borderRadius: 8, padding: '7px 12px', color: c.textPri, fontSize: 13, flex: 1 }}>
              Focused input
            </div>
          </div>
        </Section>

        {/* Input */}
        <Section label="Input" textColor={c.textSec}>
          <div className="flex flex-col gap-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: c.textSec, fontWeight: 500 }}>Default</label>
              <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 8, padding: '7px 12px', color: c.textPri, fontSize: 13 }}>Input value</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: c.textSec, fontWeight: 500 }}>Error</label>
              <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.danger}`, borderRadius: 8, padding: '7px 12px', color: c.textPri, fontSize: 13 }}>Invalid value</div>
              <span style={{ fontSize: 11, color: c.dangerText }}>This field is required.</span>
            </div>
            <div style={{ backgroundColor: c.sunkenBg, border: `1.5px solid ${c.border}`, borderRadius: 8, padding: '7px 12px', color: c.textPh, fontSize: 13 }}>Placeholder text</div>
          </div>
        </Section>

        {/* Badges */}
        <Section label="Badges" textColor={c.textSec}>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Info',    bg: c.infoSub,    text: c.infoText },
              { label: 'Success', bg: c.successSub, text: c.successText },
              { label: 'Warning', bg: c.warningSub, text: c.warningText },
              { label: 'Danger',  bg: c.dangerSub,  text: c.dangerText },
              { label: 'Brand',   bg: c.brandSub,   text: c.brandText },
            ].map(({ label, bg, text }) => (
              <span key={label} style={{ backgroundColor: bg, color: text, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {label}
              </span>
            ))}
          </div>
        </Section>

        {/* Alerts */}
        <Section label="Alerts" textColor={c.textSec}>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Information', borderColor: c.info,    bg: c.infoSub,    text: c.infoText,    msg: 'Your changes have been saved.' },
              { label: 'Success',     borderColor: c.success, bg: c.successSub, text: c.successText, msg: 'Account created successfully.' },
              { label: 'Warning',     borderColor: c.warning, bg: c.warningSub, text: c.warningText, msg: 'Your session expires in 5 minutes.' },
              { label: 'Error',       borderColor: c.danger,  bg: c.dangerSub,  text: c.dangerText,  msg: 'Failed to connect. Please retry.' },
            ].map(({ label, borderColor, bg, text, msg }) => (
              <div key={label} style={{ backgroundColor: bg, borderTop: `1px solid ${borderColor}20`, borderRight: `1px solid ${borderColor}20`, borderBottom: `1px solid ${borderColor}20`, borderLeft: `4px solid ${borderColor}`, borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: text }}>{label}</span>
                <span style={{ fontSize: 11, color: text, opacity: 0.8 }}>{msg}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Card */}
        <Section label="Card" textColor={c.textSec}>
          <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ backgroundColor: c.brand, padding: '14px 16px' }}>
              <span style={{ color: c.onBrand, fontSize: 13, fontWeight: 600 }}>Card header</span>
            </div>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${c.border}` }}>
              <p style={{ color: c.textPri, fontSize: 13, margin: 0 }}>Card body content. This area holds the main information.</p>
            </div>
            <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={{ backgroundColor: 'transparent', color: c.textSec, border: `1.5px solid ${c.border}`, padding: '5px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button style={{ backgroundColor: c.brand, color: c.onBrand, border: 'none', padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </Section>

        {/* Table */}
        <Section label="Table" textColor={c.textSec}>
          <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', backgroundColor: c.sunkenBg, borderBottom: `1px solid ${c.border}`, padding: '8px 14px' }}>
              {['Name', 'Role', 'Status'].map((h) => (
                <span key={h} style={{ fontSize: 10, fontWeight: 600, color: c.textSec, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {[
              { name: 'Alex Kim',     role: 'Designer', status: 'Active', sText: c.successText, sBg: c.successSub },
              { name: 'Sam Lee',      role: 'Engineer', status: 'Active', sText: c.successText, sBg: c.successSub },
              { name: 'Jordan Smith', role: 'PM',       status: 'Away',   sText: c.warningText, sBg: c.warningSub },
            ].map((row, i) => (
              <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', padding: '9px 14px', borderBottom: i < 2 ? `1px solid ${c.border}` : 'none', backgroundColor: i % 2 === 1 ? c.sunkenBg : c.raisedBg }}>
                <span style={{ fontSize: 12, color: c.textPri, fontWeight: 500 }}>{row.name}</span>
                <span style={{ fontSize: 12, color: c.textSec }}>{row.role}</span>
                <span style={{ fontSize: 11, color: row.sText, fontWeight: 600, backgroundColor: row.sBg, padding: '1px 6px', borderRadius: 99, width: 'fit-content' }}>{row.status}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Navigation */}
        <Section label="Navigation" textColor={c.textSec}>
          <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: c.brandText }}>Brand</span>
            <div style={{ display: 'flex', gap: 12, flex: 1 }}>
              {['Home', 'Projects', 'Settings'].map((item, i) => (
                <span key={item} style={{ fontSize: 12, color: i === 0 ? c.brandText : c.textSec, fontWeight: i === 0 ? 600 : 400, borderBottom: i === 0 ? `2px solid ${c.brand}` : 'none', paddingBottom: 2, cursor: 'pointer' }}>
                  {item}
                </span>
              ))}
            </div>
            <button style={{ backgroundColor: c.brand, color: c.onBrand, border: 'none', padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Sign in
            </button>
          </div>
        </Section>

        {/* Surfaces */}
        <Section label="Surfaces" textColor={c.textSec}>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'subtle', bg: c.raisedBg },
              { label: 'base',   bg: c.pageBg },
              { label: 'muted',  bg: c.sunkenBg },
              { label: 'strong', bg: c.neutralStrong },
            ].map(({ label, bg }) => (
              <div key={label} style={{ backgroundColor: bg, border: `1px solid ${c.borderStrong}`, borderRadius: 8, padding: '8px 12px', minWidth: 60 }}>
                <span style={{ fontSize: 10, color: mode === 'dark' ? '#fff' : '#000', opacity: 0.6 }}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  )
}

function Section({ label, textColor, children }: { label: string; textColor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span style={{ fontSize: 10, fontWeight: 600, color: textColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      {children}
    </div>
  )
}
