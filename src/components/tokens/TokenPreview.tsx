// UI component showcase — all styles derived from resolved token hex values

interface Tokens {
  'brand/primary'?: string
  'brand/primary-hover'?: string
  'brand/primary-subtle'?: string
  'brand/on-primary'?: string
  'surface/page'?: string
  'surface/raised'?: string
  'surface/sunken'?: string
  'surface/overlay'?: string
  'text/primary'?: string
  'text/secondary'?: string
  'text/placeholder'?: string
  'text/on-brand'?: string
  'border/default'?: string
  'border/strong'?: string
  'feedback/danger'?: string
  'feedback/success'?: string
  'feedback/warning'?: string
  'feedback/info'?: string
  [key: string]: string | undefined
}

function t(tokens: Tokens, id: keyof Tokens, fallback = '#888888'): string {
  return tokens[id] ?? fallback
}

interface Props {
  tokens: Tokens
  mode: 'light' | 'dark'
}

export function TokenPreview({ tokens, mode }: Props) {
  const pageBg   = t(tokens, 'surface/page',    mode === 'dark' ? '#111' : '#f9f9f9')
  const raised   = t(tokens, 'surface/raised',  mode === 'dark' ? '#1c1c1c' : '#ffffff')
  const sunken   = t(tokens, 'surface/sunken',  mode === 'dark' ? '#0a0a0a' : '#f0f0f0')
  const textPri  = t(tokens, 'text/primary',    mode === 'dark' ? '#f0f0f0' : '#111111')
  const textSec  = t(tokens, 'text/secondary',  mode === 'dark' ? '#aaaaaa' : '#555555')
  const textPh   = t(tokens, 'text/placeholder',mode === 'dark' ? '#666666' : '#999999')
  const border   = t(tokens, 'border/default',  mode === 'dark' ? '#333333' : '#e0e0e0')
  const brand    = t(tokens, 'brand/primary',   '#3b82f6')
  const brandSub = t(tokens, 'brand/primary-subtle', mode === 'dark' ? '#1a2a3a' : '#eff6ff')
  const onBrand  = t(tokens, 'brand/on-primary', '#ffffff')
  const danger   = t(tokens, 'feedback/danger',  '#ef4444')
  const success  = t(tokens, 'feedback/success', '#22c55e')
  const warning  = t(tokens, 'feedback/warning', '#f59e0b')
  const info     = t(tokens, 'feedback/info',    '#3b82f6')

  return (
    <div className="flex flex-col flex-1 overflow-y-auto" style={{ backgroundColor: pageBg }}>
      <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">

        {/* Buttons */}
        <Section label="Buttons" textColor={textSec}>
          <div className="flex flex-wrap gap-2">
            <button style={{ backgroundColor: brand, color: onBrand, border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Primary
            </button>
            <button style={{ backgroundColor: 'transparent', color: brand, border: `1.5px solid ${brand}`, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Outline
            </button>
            <button style={{ backgroundColor: brandSub, color: brand, border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Subtle
            </button>
            <button style={{ backgroundColor: 'transparent', color: textSec, border: `1.5px solid ${border}`, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Default
            </button>
            <button style={{ backgroundColor: danger, color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Danger
            </button>
          </div>
        </Section>

        {/* Input */}
        <Section label="Input" textColor={textSec}>
          <div className="flex flex-col gap-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: textSec, fontWeight: 500 }}>Label</label>
              <div style={{ backgroundColor: raised, border: `1.5px solid ${border}`, borderRadius: 8, padding: '7px 12px', color: textPri, fontSize: 13 }}>
                Input value
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: textSec, fontWeight: 500 }}>Focused</label>
              <div style={{ backgroundColor: raised, border: `2px solid ${brand}`, borderRadius: 8, padding: '7px 12px', color: textPri, fontSize: 13 }}>
                Focused input
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: textSec, fontWeight: 500 }}>Error</label>
              <div style={{ backgroundColor: raised, border: `1.5px solid ${danger}`, borderRadius: 8, padding: '7px 12px', color: textPri, fontSize: 13 }}>
                Invalid value
              </div>
              <span style={{ fontSize: 11, color: danger }}>This field is required.</span>
            </div>
            <div style={{ backgroundColor: sunken, border: `1.5px solid ${border}`, borderRadius: 8, padding: '7px 12px', color: textPh, fontSize: 13 }}>
              Placeholder text
            </div>
          </div>
        </Section>

        {/* Badges */}
        <Section label="Badges" textColor={textSec}>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Info',    bg: info,    text: '#fff' },
              { label: 'Success', bg: success, text: '#fff' },
              { label: 'Warning', bg: warning, text: '#fff' },
              { label: 'Danger',  bg: danger,  text: '#fff' },
            ].map(({ label, bg, text }) => (
              <span key={label} style={{ backgroundColor: bg, color: text, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {label}
              </span>
            ))}
            <span style={{ backgroundColor: brandSub, color: brand, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
              Brand
            </span>
          </div>
        </Section>

        {/* Alerts */}
        <Section label="Alerts" textColor={textSec}>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Information', color: info,    msg: 'Your changes have been saved.' },
              { label: 'Success',     color: success, msg: 'Account created successfully.' },
              { label: 'Warning',     color: warning, msg: 'Your session expires in 5 minutes.' },
              { label: 'Error',       color: danger,  msg: 'Failed to connect. Please retry.' },
            ].map(({ label, color, msg }) => (
              <div key={label} style={{ backgroundColor: raised, border: `1.5px solid ${border}`, borderLeft: `4px solid ${color}`, borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: textPri }}>{label}</span>
                <span style={{ fontSize: 11, color: textSec }}>{msg}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Card */}
        <Section label="Card" textColor={textSec}>
          <div style={{ backgroundColor: raised, border: `1.5px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ backgroundColor: brand, padding: '14px 16px' }}>
              <span style={{ color: onBrand, fontSize: 13, fontWeight: 600 }}>Card header</span>
            </div>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
              <p style={{ color: textPri, fontSize: 13, margin: 0 }}>Card body content goes here. This area holds the main information.</p>
            </div>
            <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={{ backgroundColor: 'transparent', color: textSec, border: `1.5px solid ${border}`, padding: '5px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button style={{ backgroundColor: brand, color: onBrand, border: 'none', padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </Section>

        {/* Table */}
        <Section label="Table" textColor={textSec}>
          <div style={{ backgroundColor: raised, border: `1.5px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', backgroundColor: sunken, borderBottom: `1px solid ${border}`, padding: '8px 14px' }}>
              {['Name', 'Role', 'Status'].map((h) => (
                <span key={h} style={{ fontSize: 10, fontWeight: 600, color: textSec, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {[
              { name: 'Alex Kim',     role: 'Designer',   status: 'Active' },
              { name: 'Sam Lee',      role: 'Engineer',   status: 'Active' },
              { name: 'Jordan Smith', role: 'PM',         status: 'Away'   },
            ].map((row, i) => (
              <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', padding: '9px 14px', borderBottom: i < 2 ? `1px solid ${border}` : 'none', backgroundColor: i % 2 === 1 ? sunken : raised }}>
                <span style={{ fontSize: 12, color: textPri, fontWeight: 500 }}>{row.name}</span>
                <span style={{ fontSize: 12, color: textSec }}>{row.role}</span>
                <span style={{ fontSize: 11, color: row.status === 'Active' ? success : warning, fontWeight: 600 }}>{row.status}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Nav */}
        <Section label="Navigation" textColor={textSec}>
          <div style={{ backgroundColor: raised, border: `1.5px solid ${border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: brand }}>Brand</span>
            <div style={{ display: 'flex', gap: 12, flex: 1 }}>
              {['Home', 'Projects', 'Settings'].map((item, i) => (
                <span key={item} style={{ fontSize: 12, color: i === 0 ? brand : textSec, fontWeight: i === 0 ? 600 : 400, borderBottom: i === 0 ? `2px solid ${brand}` : 'none', paddingBottom: 2, cursor: 'pointer' }}>
                  {item}
                </span>
              ))}
            </div>
            <button style={{ backgroundColor: brand, color: onBrand, border: 'none', padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Sign in
            </button>
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
