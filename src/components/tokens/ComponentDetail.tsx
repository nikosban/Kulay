import { useState, Fragment } from 'react'
import { resolveColors, type TokenColors, type Tokens } from './tokenColors'

export type ComponentType =
  | 'button' | 'input' | 'badge' | 'alert'
  | 'card' | 'table' | 'navigation' | 'surfaces'

export const COMPONENTS: { id: ComponentType; label: string }[] = [
  { id: 'button',     label: 'Button' },
  { id: 'input',      label: 'Input' },
  { id: 'badge',      label: 'Badge' },
  { id: 'alert',      label: 'Alert' },
  { id: 'card',       label: 'Card' },
  { id: 'table',      label: 'Table' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'surfaces',   label: 'Surfaces' },
]

interface Props {
  type: ComponentType
  tokens: Tokens
  mode: 'light' | 'dark'
}

export function ComponentDetail({ type, tokens, mode }: Props) {
  const c = resolveColors(tokens, mode)
  return (
    <div className="flex flex-col flex-1 overflow-y-auto" style={{ backgroundColor: c.pageBg }}>
      <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto w-full">
        {type === 'button'     && <ButtonDetail c={c} />}
        {type === 'input'      && <InputDetail c={c} />}
        {type === 'badge'      && <BadgeDetail c={c} />}
        {type === 'alert'      && <AlertDetail c={c} />}
        {type === 'card'       && <CardDetail c={c} />}
        {type === 'table'      && <TableDetail c={c} />}
        {type === 'navigation' && <NavigationDetail c={c} />}
        {type === 'surfaces'   && <SurfacesDetail c={c} tokens={tokens} mode={mode} />}
      </div>
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Icon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="4" height="4" rx="0.8" fill={color} />
      <rect x="7.5" y="2.5" width="4" height="4" rx="0.8" fill={color} opacity="0.6" />
      <rect x="2.5" y="7.5" width="4" height="4" rx="0.8" fill={color} opacity="0.6" />
      <rect x="7.5" y="7.5" width="4" height="4" rx="0.8" fill={color} opacity="0.35" />
    </svg>
  )
}

function DetailHeader({ label, desc, c }: { label: string; desc: string; c: TokenColors }) {
  return (
    <div style={{ paddingBottom: 16, borderBottom: `1px solid ${c.border}` }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: c.textPri, margin: '0 0 4px', lineHeight: 1.2 }}>{label}</h2>
      <p style={{ fontSize: 13, color: c.textSec, margin: 0 }}>{desc}</p>
    </div>
  )
}

function DetailSection({ label, c, children }: { label: string; c: TokenColors; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span style={{ fontSize: 10, fontWeight: 600, color: c.textSec, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      {children}
    </div>
  )
}

function PropControls({ c, children }: { c: TokenColors; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5" style={{ backgroundColor: c.raisedBg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 14px' }}>
      {children}
    </div>
  )
}

function PropRow({ label, c, children }: { label: string; c: TokenColors; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ fontSize: 11, color: c.textPh, minWidth: 50, flexShrink: 0 }}>{label}</span>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  )
}

function PropPill({ active, onClick, c, children }: {
  active: boolean; onClick: () => void; c: TokenColors; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', fontSize: 11, borderRadius: 99, border: 'none', cursor: 'pointer',
      lineHeight: 1.5,
      backgroundColor: active ? c.brand : c.sunkenBg,
      color: active ? c.onBrand : c.textSec,
      fontWeight: active ? 500 : 400,
    }}>
      {children}
    </button>
  )
}

function Canvas({ c, children }: { c: TokenColors; children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: c.sunkenBg, border: `1px solid ${c.border}`, borderRadius: 10,
      padding: '28px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80,
    }}>
      {children}
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'outline' | 'subtle' | 'ghost' | 'danger'
type BtnSize = 'sm' | 'md' | 'lg'
type BtnState = 'rest' | 'hover' | 'focus' | 'active' | 'disabled'

function getBtnStyle(v: BtnVariant, state: BtnState, size: BtnSize, c: TokenColors): React.CSSProperties {
  const sz: React.CSSProperties =
    size === 'sm' ? { padding: '4px 12px', fontSize: 11, borderRadius: 6 } :
    size === 'lg' ? { padding: '10px 20px', fontSize: 14, borderRadius: 9 } :
                   { padding: '7px 16px',  fontSize: 13, borderRadius: 8 }

  const variantStyles: Record<BtnVariant, React.CSSProperties> = {
    primary: { backgroundColor: c.brand,    color: c.onBrand,   border: 'none' },
    outline: { backgroundColor: 'transparent', color: c.brandText, border: `1.5px solid ${c.brand}` },
    subtle:  { backgroundColor: c.brandSub, color: c.brandText, border: 'none' },
    ghost:   { backgroundColor: 'transparent', color: c.textSec,   border: `1.5px solid ${c.border}` },
    danger:  { backgroundColor: c.danger,   color: c.onBrand,   border: 'none' },
  }

  return {
    ...sz,
    ...variantStyles[v],
    fontWeight: 500,
    cursor: state === 'disabled' ? 'not-allowed' : 'pointer',
    opacity: state === 'disabled' ? 0.45 : 1,
    outline: state === 'focus' ? `2px solid ${c.focusRing}` : 'none',
    outlineOffset: state === 'focus' ? 2 : 0,
    filter: state === 'hover' ? 'brightness(0.92)' : state === 'active' ? 'brightness(0.85)' : 'none',
    display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1,
  }
}

function ButtonDetail({ c }: { c: TokenColors }) {
  const [variant, setVariant] = useState<BtnVariant>('primary')
  const [size, setSize] = useState<BtnSize>('md')
  const [hasIcon, setHasIcon] = useState(false)
  const [liveState, setLiveState] = useState<BtnState>('rest')

  const allVariants: BtnVariant[] = ['primary', 'outline', 'subtle', 'ghost', 'danger']
  const stateColVariants: BtnVariant[] = ['primary', 'outline', 'subtle', 'danger']
  const stateRows: BtnState[] = ['rest', 'hover', 'focus', 'active', 'disabled']
  const iconColor = (v: BtnVariant) => (v === 'primary' || v === 'danger') ? c.onBrand : c.brandText
  const iconSize = size === 'sm' ? 11 : size === 'lg' ? 15 : 13

  return (
    <>
      <DetailHeader label="Button" desc="Triggers an action or event." c={c} />

      <DetailSection label="Playground" c={c}>
        <PropControls c={c}>
          <PropRow label="Variant" c={c}>
            {allVariants.map(v => <PropPill key={v} active={variant === v} onClick={() => setVariant(v)} c={c}>{v}</PropPill>)}
          </PropRow>
          <PropRow label="Size" c={c}>
            {(['sm', 'md', 'lg'] as BtnSize[]).map(s => <PropPill key={s} active={size === s} onClick={() => setSize(s)} c={c}>{s}</PropPill>)}
          </PropRow>
          <PropRow label="Icon" c={c}>
            <PropPill active={hasIcon} onClick={() => setHasIcon(v => !v)} c={c}>Leading icon</PropPill>
          </PropRow>
        </PropControls>
        <Canvas c={c}>
          <button
            style={getBtnStyle(variant, liveState, size, c)}
            onMouseEnter={() => setLiveState('hover')}
            onMouseLeave={() => setLiveState('rest')}
            onMouseDown={() => setLiveState('active')}
            onMouseUp={() => setLiveState('hover')}
            onFocus={() => setLiveState('focus')}
            onBlur={() => setLiveState('rest')}
          >
            {hasIcon && <Icon size={iconSize} color={iconColor(variant)} />}
            Button
          </button>
        </Canvas>
      </DetailSection>

      <DetailSection label="Variants" c={c}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          {allVariants.map(v => (
            <div key={v} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <button style={getBtnStyle(v, 'rest', 'md', c)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
              <span style={{ fontSize: 9, color: c.textPh, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{v}</span>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection label="States" c={c}>
        <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(4, 1fr)', gap: '8px 10px', alignItems: 'center' }}>
          <span />
          {stateColVariants.map(v => (
            <span key={v} style={{ fontSize: 9, color: c.textPh, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{v}</span>
          ))}
          {stateRows.map(state => (
            <Fragment key={state}>
              <span style={{ fontSize: 11, color: c.textSec }}>{state.charAt(0).toUpperCase() + state.slice(1)}</span>
              {stateColVariants.map(v => (
                <div key={v} style={getBtnStyle(v, state, 'sm', c)}>Btn</div>
              ))}
            </Fragment>
          ))}
        </div>
      </DetailSection>
    </>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────

type InputState = 'default' | 'error' | 'disabled'

function InputDetail({ c }: { c: TokenColors }) {
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [state, setState] = useState<InputState>('default')
  const [hasLeading, setHasLeading] = useState(false)
  const [hasTrailing, setHasTrailing] = useState(false)

  const borderColor = state === 'error' ? c.danger : isFocused ? c.focusRing : c.border
  const bgColor = state === 'disabled' ? c.sunkenBg : c.raisedBg

  type StateRow = { label: string; border: string; bg: string; text: string; val: string; focused?: boolean; error?: boolean; disabled?: boolean }
  const stateRows: StateRow[] = [
    { label: 'Default',     border: c.border,    bg: c.raisedBg, text: c.textPri, val: 'Input value' },
    { label: 'Focused',     border: c.focusRing, bg: c.raisedBg, text: c.textPri, val: 'Input value', focused: true },
    { label: 'Placeholder', border: c.border,    bg: c.raisedBg, text: c.textPh,  val: 'Placeholder…' },
    { label: 'Error',       border: c.danger,    bg: c.raisedBg, text: c.textPri, val: 'invalid@',    error: true },
    { label: 'Disabled',    border: c.border,    bg: c.sunkenBg, text: c.textPh,  val: 'Disabled',    disabled: true },
  ]

  return (
    <>
      <DetailHeader label="Input" desc="Accepts text entry from the user." c={c} />

      <DetailSection label="Playground" c={c}>
        <PropControls c={c}>
          <PropRow label="State" c={c}>
            {(['default', 'error', 'disabled'] as InputState[]).map(s => (
              <PropPill key={s} active={state === s} onClick={() => setState(s)} c={c}>{s}</PropPill>
            ))}
          </PropRow>
          <PropRow label="Icons" c={c}>
            <PropPill active={hasLeading} onClick={() => setHasLeading(v => !v)} c={c}>Leading</PropPill>
            <PropPill active={hasTrailing} onClick={() => setHasTrailing(v => !v)} c={c}>Trailing</PropPill>
          </PropRow>
        </PropControls>
        <Canvas c={c}>
          <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: c.textSec, fontWeight: 500 }}>Email address</label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              backgroundColor: bgColor, border: `1.5px solid ${borderColor}`, borderRadius: 8,
              padding: '7px 12px',
              outline: (isFocused && state !== 'error') ? `2px solid ${c.focusRing}` : 'none',
              outlineOffset: 2, opacity: state === 'disabled' ? 0.6 : 1,
            }}>
              {hasLeading && <Icon size={13} color={c.textSec} />}
              <input
                value={value}
                onChange={e => setValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={state === 'disabled'}
                placeholder="you@example.com"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: c.textPri, fontSize: 13,
                  cursor: state === 'disabled' ? 'not-allowed' : 'text',
                }}
              />
              {hasTrailing && <Icon size={13} color={c.textSec} />}
            </div>
            {state === 'error'
              ? <span style={{ fontSize: 11, color: c.dangerText }}>Enter a valid email address.</span>
              : <span style={{ fontSize: 11, color: c.textPh }}>We'll never share your email.</span>
            }
          </div>
        </Canvas>
      </DetailSection>

      <DetailSection label="States" c={c}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stateRows.map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 11, color: c.textSec, minWidth: 80, paddingTop: 7 }}>{row.label}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{
                  backgroundColor: row.bg, border: `1.5px solid ${row.border}`, borderRadius: 7,
                  padding: '6px 10px', fontSize: 12, color: row.text,
                  outline: row.focused ? `2px solid ${c.focusRing}` : 'none', outlineOffset: 2,
                  opacity: row.disabled ? 0.6 : 1,
                }}>
                  {row.val}
                </div>
                {row.error && <span style={{ fontSize: 10, color: c.dangerText }}>This field is required.</span>}
              </div>
            </div>
          ))}
        </div>
      </DetailSection>
    </>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function BadgeDetail({ c }: { c: TokenColors }) {
  const semantic = [
    { label: 'Info',    bg: c.infoSub,    text: c.infoText },
    { label: 'Success', bg: c.successSub, text: c.successText },
    { label: 'Warning', bg: c.warningSub, text: c.warningText },
    { label: 'Danger',  bg: c.dangerSub,  text: c.dangerText },
    { label: 'Brand',   bg: c.brandSub,   text: c.brandText },
    { label: 'Neutral', bg: c.sunkenBg,   text: c.textSec },
  ]

  return (
    <>
      <DetailHeader label="Badge" desc="Short status label for categories and counts." c={c} />

      <DetailSection label="Semantic variants" c={c}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {semantic.map(({ label, bg, text }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span style={{ backgroundColor: bg, color: text, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {label}
              </span>
              <span style={{ fontSize: 9, color: c.textPh, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection label="With dot indicator" c={c}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {semantic.slice(0, 4).map(({ label, bg, text }) => (
            <span key={label} style={{ backgroundColor: bg, color: text, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: text, display: 'inline-block', flexShrink: 0 }} />
              {label}
            </span>
          ))}
        </div>
      </DetailSection>

      <DetailSection label="Sizes" c={c}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          {[
            { label: 'Small',  style: { padding: '1px 6px',  fontSize: 10, borderRadius: 99 as number }, size: 'sm' },
            { label: 'Medium', style: { padding: '3px 9px',  fontSize: 11, borderRadius: 99 as number }, size: 'md' },
            { label: 'Large',  style: { padding: '5px 12px', fontSize: 13, borderRadius: 99 as number }, size: 'lg' },
          ].map(({ label, style, size }) => (
            <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span style={{ backgroundColor: c.brandSub, color: c.brandText, fontWeight: 600, ...style }}>{label}</span>
              <span style={{ fontSize: 9, color: c.textPh }}>{size}</span>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection label="Count badges" c={c}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {[1, 3, 12, 99].map(n => (
            <span key={n} style={{ backgroundColor: c.brand, color: c.onBrand, padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600, minWidth: 22, textAlign: 'center' as const }}>
              {n}
            </span>
          ))}
          <span style={{ backgroundColor: c.danger, color: c.onBrand, padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>99+</span>
        </div>
      </DetailSection>
    </>
  )
}

// ── Alert ─────────────────────────────────────────────────────────────────────

function AlertDetail({ c }: { c: TokenColors }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const alerts = [
    { id: 'info',    label: 'Information', border: c.info,    bg: c.infoSub,    text: c.infoText,    msg: 'Your changes have been saved.' },
    { id: 'success', label: 'Success',     border: c.success, bg: c.successSub, text: c.successText, msg: 'Account created successfully.' },
    { id: 'warning', label: 'Warning',     border: c.warning, bg: c.warningSub, text: c.warningText, msg: 'Your session expires in 5 minutes.' },
    { id: 'error',   label: 'Error',       border: c.danger,  bg: c.dangerSub,  text: c.dangerText,  msg: 'Failed to connect. Please retry.' },
  ]

  function AlertBanner({ id, label, border, bg, text, msg, dismissible }: {
    id: string; label: string; border: string; bg: string; text: string; msg: string; dismissible?: boolean
  }) {
    return (
      <div style={{
        backgroundColor: bg,
        borderTop: `1px solid ${border}20`, borderRight: `1px solid ${border}20`,
        borderBottom: `1px solid ${border}20`, borderLeft: `4px solid ${border}`,
        borderRadius: 8, padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: text }}>{label}</span>
          <p style={{ fontSize: 11, color: text, opacity: 0.85, margin: '2px 0 0' }}>{msg}</p>
        </div>
        {dismissible && (
          <button
            onClick={() => setDismissed(prev => new Set([...prev, id]))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: text, opacity: 0.5, fontSize: 18, lineHeight: 1, padding: '0 0 0 12px', flexShrink: 0 }}
            aria-label="Dismiss"
          >×</button>
        )}
      </div>
    )
  }

  const visible = alerts.filter(a => !dismissed.has(a.id))

  return (
    <>
      <DetailHeader label="Alert" desc="Contextual feedback message for the user." c={c} />

      <DetailSection label="Variants" c={c}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map(a => <AlertBanner key={a.id} {...a} />)}
        </div>
      </DetailSection>

      <DetailSection label="Dismissible" c={c}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(a => <AlertBanner key={a.id} {...a} dismissible />)}
          {visible.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: c.textPh }}>All alerts dismissed.</span>
              <button onClick={() => setDismissed(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.brandText, fontSize: 12, padding: 0 }}>
                Reset
              </button>
            </div>
          )}
        </div>
      </DetailSection>
    </>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

function CardDetail({ c }: { c: TokenColors }) {
  return (
    <>
      <DetailHeader label="Card" desc="Container for related content and actions." c={c} />

      <DetailSection label="With header band" c={c}>
        <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', maxWidth: 380 }}>
          <div style={{ backgroundColor: c.brand, padding: '14px 16px' }}>
            <span style={{ color: c.onBrand, fontSize: 13, fontWeight: 600 }}>Card header</span>
          </div>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${c.border}` }}>
            <p style={{ color: c.textPri, fontSize: 13, margin: 0, lineHeight: 1.55 }}>Card body content. This area holds the main information for the user.</p>
          </div>
          <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button style={{ backgroundColor: 'transparent', color: c.textSec, border: `1.5px solid ${c.border}`, padding: '5px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button style={{ backgroundColor: c.brand, color: c.onBrand, border: 'none', padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Confirm</button>
          </div>
        </div>
      </DetailSection>

      <DetailSection label="Simple" c={c}>
        <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 12, padding: 16, maxWidth: 380 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: c.textPri }}>Card title</span>
            <span style={{ backgroundColor: c.successSub, color: c.successText, padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 600 }}>Active</span>
          </div>
          <p style={{ fontSize: 13, color: c.textSec, margin: '0 0 14px', lineHeight: 1.55 }}>
            A flat card with no header band, suitable for content listing layouts.
          </p>
          <button style={{ backgroundColor: c.brandSub, color: c.brandText, border: 'none', padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            Learn more
          </button>
        </div>
      </DetailSection>
    </>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

function TableDetail({ c }: { c: TokenColors }) {
  const rows = [
    { name: 'Alex Kim',     role: 'Designer', email: 'alex@co.io',  status: 'Active',  sText: c.successText, sBg: c.successSub },
    { name: 'Sam Lee',      role: 'Engineer', email: 'sam@co.io',   status: 'Active',  sText: c.successText, sBg: c.successSub },
    { name: 'Jordan Smith', role: 'PM',       email: 'jord@co.io',  status: 'Away',    sText: c.warningText, sBg: c.warningSub },
    { name: 'Casey Wong',   role: 'Design',   email: 'casey@co.io', status: 'Offline', sText: c.textPh,      sBg: c.sunkenBg  },
  ]

  return (
    <>
      <DetailHeader label="Table" desc="Displays structured data in rows and columns." c={c} />

      <DetailSection label="Default" c={c}>
        <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 80px', backgroundColor: c.sunkenBg, borderBottom: `1px solid ${c.border}`, padding: '8px 14px' }}>
            {['Name', 'Role', 'Email', 'Status'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, color: c.textSec, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {rows.map((row, i) => (
            <div key={row.name} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 1fr 80px',
              padding: '9px 14px', borderBottom: i < rows.length - 1 ? `1px solid ${c.border}` : 'none',
              backgroundColor: i % 2 === 1 ? c.sunkenBg : c.raisedBg,
            }}>
              <span style={{ fontSize: 12, color: c.textPri, fontWeight: 500 }}>{row.name}</span>
              <span style={{ fontSize: 12, color: c.textSec }}>{row.role}</span>
              <span style={{ fontSize: 12, color: c.textSec }}>{row.email}</span>
              <span style={{ fontSize: 11, color: row.sText, fontWeight: 600, backgroundColor: row.sBg, padding: '1px 7px', borderRadius: 99, width: 'fit-content' }}>{row.status}</span>
            </div>
          ))}
        </div>
      </DetailSection>
    </>
  )
}

// ── Navigation ────────────────────────────────────────────────────────────────

function NavigationDetail({ c }: { c: TokenColors }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const items = ['Home', 'Projects', 'Team', 'Settings']

  return (
    <>
      <DetailHeader label="Navigation" desc="Top-level application navigation patterns." c={c} />

      <DetailSection label="Top nav" c={c}>
        <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: c.brandText }}>Brand</span>
          <div style={{ display: 'flex', gap: 2, flex: 1 }}>
            {items.map((item, i) => (
              <button key={item} onClick={() => setActiveIdx(i)} style={{
                fontSize: 12, cursor: 'pointer', background: 'none', border: 'none',
                padding: '4px 10px', lineHeight: 1,
                color: i === activeIdx ? c.brandText : c.textSec,
                fontWeight: i === activeIdx ? 600 : 400,
                borderBottom: i === activeIdx ? `2px solid ${c.brand}` : '2px solid transparent',
                borderRadius: 0,
              }}>
                {item}
              </button>
            ))}
          </div>
          <button style={{ backgroundColor: c.brand, color: c.onBrand, border: 'none', padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            Sign in
          </button>
        </div>
      </DetailSection>

      <DetailSection label="Sidebar nav" c={c}>
        <div style={{ display: 'flex', backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 10, overflow: 'hidden', height: 180 }}>
          <div style={{ width: 150, borderRight: `1px solid ${c.border}`, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
            {items.map((item, i) => (
              <button key={item} onClick={() => setActiveIdx(i)} style={{
                fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: '6px 10px', borderRadius: 6, border: 'none',
                background: i === activeIdx ? c.brandSub : 'transparent',
                color: i === activeIdx ? c.brandText : c.textSec,
                fontWeight: i === activeIdx ? 500 : 400,
              }}>
                {item}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: c.textPri }}>{items[activeIdx]}</span>
            <p style={{ fontSize: 12, color: c.textSec, margin: 0 }}>Content for the {items[activeIdx]?.toLowerCase()} section.</p>
          </div>
        </div>
      </DetailSection>
    </>
  )
}

// ── Surfaces ──────────────────────────────────────────────────────────────────

function SurfacesDetail({ c, tokens, mode }: { c: TokenColors; tokens: Tokens; mode: 'light' | 'dark' }) {
  const m = (l: string, d: string) => mode === 'dark' ? d : l
  const t = (id: string, fb: string) => tokens[id] ?? fb

  const levels = [
    { label: 'subtle', token: 'surface/neutral/subtle', bg: t('surface/neutral/subtle', m('#ffffff', '#1c1c1c')), desc: 'Elevated surfaces, cards' },
    { label: 'base',   token: 'surface/neutral/base',   bg: t('surface/neutral/base',   m('#f5f5f5', '#141414')), desc: 'Page background' },
    { label: 'muted',  token: 'surface/neutral/muted',  bg: t('surface/neutral/muted',  m('#efefef', '#0f0f0f')), desc: 'Sunken areas, table headers' },
    { label: 'strong', token: 'surface/neutral/strong', bg: t('surface/neutral/strong', m('#262626', '#d4d4d4')), desc: 'High-contrast overlays' },
  ]

  const semantic = [
    { label: 'Brand',   bg: c.brandSub,   text: c.brandText },
    { label: 'Success', bg: c.successSub, text: c.successText },
    { label: 'Warning', bg: c.warningSub, text: c.warningText },
    { label: 'Danger',  bg: c.dangerSub,  text: c.dangerText },
    { label: 'Info',    bg: c.infoSub,    text: c.infoText },
  ]

  return (
    <>
      <DetailHeader label="Surfaces" desc="Background elevation levels for layering and depth." c={c} />

      <DetailSection label="Neutral levels" c={c}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {levels.map(({ label, token, bg, desc }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ backgroundColor: bg, border: `1px solid ${c.borderStrong}`, borderRadius: 7, width: 48, height: 32, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: c.textPri, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 11, color: c.textSec }}>{desc}</div>
              </div>
              <code style={{ fontSize: 10, color: c.textPh }}>{token}</code>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection label="Semantic surfaces" c={c}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {semantic.map(({ label, bg, text }) => (
            <div key={label} style={{ backgroundColor: bg, border: `1px solid ${text}20`, borderRadius: 8, padding: '10px 14px', minWidth: 88 }}>
              <div style={{ fontSize: 12, color: text, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 10, color: text, opacity: 0.65 }}>subtle</div>
            </div>
          ))}
        </div>
      </DetailSection>
    </>
  )
}
