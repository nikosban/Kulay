// UI component showcase — styles derived from resolved token hex values

interface Tokens { [key: string]: string | undefined }

function t(tokens: Tokens, id: string, fallback = '#888888'): string {
  return tokens[id] ?? fallback
}

function fallbackMode(mode: 'light' | 'dark', light: string, dark: string) {
  return mode === 'dark' ? dark : light
}

interface Props {
  tokens: Tokens
  mode: 'light' | 'dark'
}

export function TokenPreview({ tokens, mode }: Props) {
  const m = (l: string, d: string) => fallbackMode(mode, l, d)

  const pageBg     = t(tokens, 'surface/neutral/base',    m('#f5f5f5', '#141414'))
  const raisedBg   = t(tokens, 'surface/neutral/subtle',  m('#ffffff', '#1c1c1c'))
  const sunkenBg   = t(tokens, 'surface/neutral/muted',   m('#efefef', '#0f0f0f'))
  const textPri    = t(tokens, 'fg/base',                 m('#111111', '#efefef'))
  const textSec    = t(tokens, 'fg/muted',                m('#555555', '#aaaaaa'))
  const textPh     = t(tokens, 'fg/placeholder',          m('#999999', '#666666'))
  const border     = t(tokens, 'border/default',          m('#e0e0e0', '#333333'))
  const brand      = t(tokens, 'interactive/brand/rest',  m('#3b82f6', '#60a5fa'))
  const brandSub   = t(tokens, 'surface/brand/subtle',    m('#eff6ff', '#1e3a5f'))
  const brandText  = t(tokens, 'fg/brand/base',           m('#1d4ed8', '#93c5fd'))
  const onBrand    = t(tokens, 'fg/on-brand',             '#ffffff')
  const danger     = t(tokens, 'interactive/danger/rest', m('#ef4444', '#f87171'))
  const dangerSub  = t(tokens, 'surface/danger/subtle',   m('#fef2f2', '#2a0f0f'))
  const dangerText = t(tokens, 'fg/danger/alt',           m('#b91c1c', '#fca5a5'))
  const success    = t(tokens, 'surface/success/strong',  m('#22c55e', '#4ade80'))
  const successSub = t(tokens, 'surface/success/subtle',  m('#f0fdf4', '#0f2a1a'))
  const successText = t(tokens, 'fg/success/alt',         m('#15803d', '#86efac'))
  const warning    = t(tokens, 'surface/warning/strong',  m('#f59e0b', '#fbbf24'))
  const warningSub = t(tokens, 'surface/warning/subtle',  m('#fffbeb', '#2a1f0f'))
  const warningText = t(tokens, 'fg/warning/alt',         m('#92400e', '#fde68a'))
  const info       = t(tokens, 'surface/informative/strong', m('#3b82f6', '#60a5fa'))
  const infoSub    = t(tokens, 'surface/informative/subtle', m('#eff6ff', '#0f1e2a'))
  const infoText   = t(tokens, 'fg/informative/alt',      m('#1d4ed8', '#93c5fd'))
  const focusRing  = t(tokens, 'focus/ring',              m('#3b82f6', '#60a5fa'))
  const disabled   = t(tokens, 'interactive/disabled/rest', m('#e5e5e5', '#262626'))
  const borderStrong = t(tokens, 'border/strong',         m('#a3a3a3', '#525252'))

  return (
    <div className="flex flex-col flex-1 overflow-y-auto" style={{ backgroundColor: pageBg }}>
      <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">

        {/* Buttons */}
        <Section label="Buttons" textColor={textSec}>
          <div className="flex flex-wrap gap-2">
            <button style={{ backgroundColor: brand, color: onBrand, border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Primary
            </button>
            <button style={{ backgroundColor: 'transparent', color: brandText, border: `1.5px solid ${brand}`, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Outline
            </button>
            <button style={{ backgroundColor: brandSub, color: brandText, border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Subtle
            </button>
            <button style={{ backgroundColor: 'transparent', color: textSec, border: `1.5px solid ${border}`, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Default
            </button>
            <button style={{ backgroundColor: danger, color: onBrand, border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Danger
            </button>
            <button style={{ backgroundColor: disabled, color: textPh, border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 400, cursor: 'not-allowed' }}>
              Disabled
            </button>
          </div>
        </Section>

        {/* Focus ring demo */}
        <Section label="Focus" textColor={textSec}>
          <div className="flex gap-2 flex-wrap">
            <button style={{ backgroundColor: 'transparent', color: brandText, border: `1.5px solid ${border}`, padding: '7px 16px', borderRadius: 8, fontSize: 13, outline: `2px solid ${focusRing}`, outlineOffset: 2, cursor: 'pointer' }}>
              Focused button
            </button>
            <div style={{ backgroundColor: raisedBg, border: `2px solid ${focusRing}`, borderRadius: 8, padding: '7px 12px', color: textPri, fontSize: 13, flex: 1 }}>
              Focused input
            </div>
          </div>
        </Section>

        {/* Input */}
        <Section label="Input" textColor={textSec}>
          <div className="flex flex-col gap-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: textSec, fontWeight: 500 }}>Default</label>
              <div style={{ backgroundColor: raisedBg, border: `1.5px solid ${border}`, borderRadius: 8, padding: '7px 12px', color: textPri, fontSize: 13 }}>Input value</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: textSec, fontWeight: 500 }}>Error</label>
              <div style={{ backgroundColor: raisedBg, border: `1.5px solid ${danger}`, borderRadius: 8, padding: '7px 12px', color: textPri, fontSize: 13 }}>Invalid value</div>
              <span style={{ fontSize: 11, color: dangerText }}>This field is required.</span>
            </div>
            <div style={{ backgroundColor: sunkenBg, border: `1.5px solid ${border}`, borderRadius: 8, padding: '7px 12px', color: textPh, fontSize: 13 }}>Placeholder text</div>
          </div>
        </Section>

        {/* Badges */}
        <Section label="Badges" textColor={textSec}>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Info',    bg: infoSub,    text: infoText },
              { label: 'Success', bg: successSub, text: successText },
              { label: 'Warning', bg: warningSub, text: warningText },
              { label: 'Danger',  bg: dangerSub,  text: dangerText },
              { label: 'Brand',   bg: brandSub,   text: brandText },
            ].map(({ label, bg, text }) => (
              <span key={label} style={{ backgroundColor: bg, color: text, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {label}
              </span>
            ))}
          </div>
        </Section>

        {/* Alerts */}
        <Section label="Alerts" textColor={textSec}>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Information', borderColor: info,    bg: infoSub,    text: infoText,    msg: 'Your changes have been saved.' },
              { label: 'Success',     borderColor: success, bg: successSub, text: successText, msg: 'Account created successfully.' },
              { label: 'Warning',     borderColor: warning, bg: warningSub, text: warningText, msg: 'Your session expires in 5 minutes.' },
              { label: 'Error',       borderColor: danger,  bg: dangerSub,  text: dangerText,  msg: 'Failed to connect. Please retry.' },
            ].map(({ label, borderColor, bg, text, msg }) => (
              <div key={label} style={{ backgroundColor: bg, borderTop: `1px solid ${borderColor}20`, borderRight: `1px solid ${borderColor}20`, borderBottom: `1px solid ${borderColor}20`, borderLeft: `4px solid ${borderColor}`, borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: text }}>{label}</span>
                <span style={{ fontSize: 11, color: text, opacity: 0.8 }}>{msg}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Card */}
        <Section label="Card" textColor={textSec}>
          <div style={{ backgroundColor: raisedBg, border: `1.5px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ backgroundColor: brand, padding: '14px 16px' }}>
              <span style={{ color: onBrand, fontSize: 13, fontWeight: 600 }}>Card header</span>
            </div>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
              <p style={{ color: textPri, fontSize: 13, margin: 0 }}>Card body content. This area holds the main information.</p>
            </div>
            <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={{ backgroundColor: 'transparent', color: textSec, border: `1.5px solid ${border}`, padding: '5px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button style={{ backgroundColor: brand, color: onBrand, border: 'none', padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </Section>

        {/* Table */}
        <Section label="Table" textColor={textSec}>
          <div style={{ backgroundColor: raisedBg, border: `1.5px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', backgroundColor: sunkenBg, borderBottom: `1px solid ${border}`, padding: '8px 14px' }}>
              {['Name', 'Role', 'Status'].map((h) => (
                <span key={h} style={{ fontSize: 10, fontWeight: 600, color: textSec, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {[
              { name: 'Alex Kim',     role: 'Designer', status: 'Active',   statusColor: successText, statusBg: successSub },
              { name: 'Sam Lee',      role: 'Engineer', status: 'Active',   statusColor: successText, statusBg: successSub },
              { name: 'Jordan Smith', role: 'PM',       status: 'Away',     statusColor: warningText, statusBg: warningSub },
            ].map((row, i) => (
              <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', padding: '9px 14px', borderBottom: i < 2 ? `1px solid ${border}` : 'none', backgroundColor: i % 2 === 1 ? sunkenBg : raisedBg }}>
                <span style={{ fontSize: 12, color: textPri, fontWeight: 500 }}>{row.name}</span>
                <span style={{ fontSize: 12, color: textSec }}>{row.role}</span>
                <span style={{ fontSize: 11, color: row.statusColor, fontWeight: 600, backgroundColor: row.statusBg, padding: '1px 6px', borderRadius: 99, width: 'fit-content' }}>{row.status}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Navigation */}
        <Section label="Navigation" textColor={textSec}>
          <div style={{ backgroundColor: raisedBg, border: `1.5px solid ${border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: brandText }}>Brand</span>
            <div style={{ display: 'flex', gap: 12, flex: 1 }}>
              {['Home', 'Projects', 'Settings'].map((item, i) => (
                <span key={item} style={{ fontSize: 12, color: i === 0 ? brandText : textSec, fontWeight: i === 0 ? 600 : 400, borderBottom: i === 0 ? `2px solid ${brand}` : 'none', paddingBottom: 2, cursor: 'pointer' }}>
                  {item}
                </span>
              ))}
            </div>
            <button style={{ backgroundColor: brand, color: onBrand, border: 'none', padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Sign in
            </button>
          </div>
        </Section>

        {/* Surfaces */}
        <Section label="Surfaces" textColor={textSec}>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'subtle',  bg: t(tokens, 'surface/neutral/subtle',  m('#ffffff','#1c1c1c')) },
              { label: 'base',    bg: t(tokens, 'surface/neutral/base',    m('#f5f5f5','#141414')) },
              { label: 'muted',   bg: t(tokens, 'surface/neutral/muted',   m('#efefef','#0f0f0f')) },
              { label: 'strong',  bg: t(tokens, 'surface/neutral/strong',  m('#262626','#d4d4d4')) },
            ].map(({ label, bg }) => (
              <div key={label} style={{ backgroundColor: bg, border: `1px solid ${borderStrong}`, borderRadius: 8, padding: '8px 12px', minWidth: 60 }}>
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
