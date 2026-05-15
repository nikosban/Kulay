import { useState, Fragment } from 'react'
import { resolveColors, TOKEN_PATHS, TOKEN_LABELS, type TokenColors, type Tokens } from './tokenColors'
import { StepPicker } from './TokenEditor'
import { useProjectStore } from '../../store/useProjectStore'
import { getActiveSteps } from '../../types/project'
import type { Palette } from '../../types/project'
import type { Theme, TokenRef } from '../../types/tokens'

export type ComponentType =
  | 'button' | 'input' | 'badge' | 'alert'
  | 'card' | 'table' | 'navigation' | 'surfaces'
  | 'checkbox' | 'radio' | 'toggle' | 'textarea'
  | 'select' | 'tabs' | 'avatar' | 'progress'
  | 'modal' | 'tooltip'

export const COMPONENTS: { id: ComponentType; label: string }[] = [
  { id: 'button',     label: 'Button' },
  { id: 'input',      label: 'Input' },
  { id: 'textarea',   label: 'Textarea' },
  { id: 'select',     label: 'Select' },
  { id: 'checkbox',   label: 'Checkbox' },
  { id: 'radio',      label: 'Radio' },
  { id: 'toggle',     label: 'Toggle' },
  { id: 'badge',      label: 'Badge' },
  { id: 'alert',      label: 'Alert' },
  { id: 'tabs',       label: 'Tabs' },
  { id: 'avatar',     label: 'Avatar' },
  { id: 'progress',   label: 'Progress' },
  { id: 'tooltip',    label: 'Tooltip' },
  { id: 'modal',      label: 'Modal' },
  { id: 'card',       label: 'Card' },
  { id: 'table',      label: 'Table' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'surfaces',   label: 'Surfaces' },
]

const COMPONENT_TOKENS: Record<ComponentType, (keyof TokenColors)[]> = {
  button:     ['brand', 'onBrand', 'brandSub', 'brandText', 'border', 'textSec', 'danger', 'focusRing', 'disabled', 'textPh'],
  input:      ['raisedBg', 'border', 'textPri', 'textSec', 'textPh', 'focusRing', 'danger', 'dangerText', 'sunkenBg'],
  textarea:   ['raisedBg', 'border', 'textPri', 'textSec', 'textPh', 'focusRing', 'danger', 'dangerText', 'sunkenBg'],
  select:     ['raisedBg', 'border', 'textPri', 'textPh', 'focusRing', 'brandSub', 'brandText', 'sunkenBg'],
  checkbox:   ['brand', 'onBrand', 'border', 'raisedBg', 'textPri'],
  radio:      ['brand', 'border', 'raisedBg', 'textPri'],
  toggle:     ['brand', 'border'],
  badge:      ['brandSub', 'brandText', 'infoSub', 'infoText', 'successSub', 'successText', 'warningSub', 'warningText', 'dangerSub', 'dangerText', 'sunkenBg', 'textSec'],
  alert:      ['info', 'infoSub', 'infoText', 'success', 'successSub', 'successText', 'warning', 'warningSub', 'warningText', 'danger', 'dangerSub', 'dangerText'],
  tabs:       ['raisedBg', 'sunkenBg', 'border', 'brand', 'brandText', 'brandSub', 'textSec', 'textPri'],
  avatar:     ['brandSub', 'brandText', 'successSub', 'successText', 'warningSub', 'warningText', 'dangerSub', 'dangerText', 'success', 'border', 'pageBg'],
  progress:   ['brand', 'brandSub', 'success', 'successSub', 'warning', 'warningSub', 'danger', 'dangerSub'],
  tooltip:    ['neutralStrong', 'pageBg', 'brand', 'warning'],
  modal:      ['raisedBg', 'border', 'textPri', 'textSec', 'textPh', 'brand', 'onBrand', 'danger'],
  card:       ['raisedBg', 'border', 'brand', 'onBrand', 'textPri', 'textSec', 'successSub', 'successText'],
  table:      ['raisedBg', 'sunkenBg', 'border', 'textPri', 'textSec', 'successSub', 'successText', 'warningSub', 'warningText'],
  navigation: ['raisedBg', 'border', 'brand', 'brandText', 'brandSub', 'onBrand', 'textSec'],
  surfaces:   ['pageBg', 'raisedBg', 'sunkenBg', 'neutralStrong', 'border', 'borderStrong', 'brandSub', 'successSub', 'warningSub', 'dangerSub', 'infoSub'],
}

interface Props {
  type: ComponentType
  tokens: Tokens
  mode: 'light' | 'dark'
}

export function ComponentDetail({ type, tokens, mode }: Props) {
  const palettes    = useProjectStore(s => s.activeProject?.palettes ?? [])
  const theme       = useProjectStore(s => s.activeProject?.theme ?? null)
  const assignToken = useProjectStore(s => s.assignToken)
  const c = resolveColors(tokens, mode)

  return (
    <div className="flex flex-col flex-1 overflow-y-auto" style={{ backgroundColor: c.pageBg }}>
      <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto w-full">
        {type === 'button'     && <ButtonDetail c={c} />}
        {type === 'input'      && <InputDetail c={c} />}
        {type === 'textarea'   && <TextareaDetail c={c} />}
        {type === 'select'     && <SelectDetail c={c} />}
        {type === 'checkbox'   && <CheckboxDetail c={c} />}
        {type === 'radio'      && <RadioDetail c={c} />}
        {type === 'toggle'     && <ToggleDetail c={c} />}
        {type === 'badge'      && <BadgeDetail c={c} />}
        {type === 'alert'      && <AlertDetail c={c} />}
        {type === 'tabs'       && <TabsDetail c={c} />}
        {type === 'avatar'     && <AvatarDetail c={c} />}
        {type === 'progress'   && <ProgressDetail c={c} />}
        {type === 'tooltip'    && <TooltipDetail c={c} />}
        {type === 'modal'      && <ModalDetail c={c} />}
        {type === 'card'       && <CardDetail c={c} />}
        {type === 'table'      && <TableDetail c={c} />}
        {type === 'navigation' && <NavigationDetail c={c} />}
        {type === 'surfaces'   && <SurfacesDetail c={c} tokens={tokens} mode={mode} />}
        <TokenTable
          keys={COMPONENT_TOKENS[type]} c={c}
          palettes={palettes} theme={theme} mode={mode}
          assignToken={assignToken}
        />
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

// ── Checkbox ──────────────────────────────────────────────────────────────────

function CheckboxDetail({ c }: { c: TokenColors }) {
  const [checked1, setChecked1] = useState(true)
  const [checked2, setChecked2] = useState(false)
  const [checked3, setChecked3] = useState(false)

  function Checkbox({ checked, onChange, label, disabled, indeterminate }: {
    checked: boolean; onChange?: () => void; label?: string; disabled?: boolean; indeterminate?: boolean
  }) {
    const bg = checked || indeterminate ? c.brand : c.raisedBg
    const border = checked || indeterminate ? c.brand : c.border
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
        <div
          onClick={!disabled ? onChange : undefined}
          style={{
            width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${border}`,
            backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {indeterminate && <span style={{ width: 8, height: 2, borderRadius: 1, backgroundColor: c.onBrand, display: 'block' }} />}
          {checked && !indeterminate && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke={c.onBrand} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {label && <span style={{ fontSize: 13, color: c.textPri }}>{label}</span>}
      </label>
    )
  }

  return (
    <>
      <DetailHeader label="Checkbox" desc="Binary selection control for one or multiple options." c={c} />

      <DetailSection label="Playground" c={c}>
        <Canvas c={c}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Checkbox checked={checked1} onChange={() => setChecked1(v => !v)} label="Receive email notifications" />
            <Checkbox checked={checked2} onChange={() => setChecked2(v => !v)} label="Subscribe to newsletter" />
            <Checkbox checked={checked3} onChange={() => setChecked3(v => !v)} label="Agree to terms of service" />
          </div>
        </Canvas>
      </DetailSection>

      <DetailSection label="States" c={c}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {[
            { label: 'Unchecked', checked: false },
            { label: 'Checked', checked: true },
            { label: 'Indeterminate', checked: false, indeterminate: true },
            { label: 'Disabled', checked: false, disabled: true },
            { label: 'Disabled checked', checked: true, disabled: true },
          ].map(({ label, ...props }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
              <Checkbox {...props} />
              <span style={{ fontSize: 9, color: c.textPh, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            </div>
          ))}
        </div>
      </DetailSection>
    </>
  )
}

// ── Radio ─────────────────────────────────────────────────────────────────────

function RadioDetail({ c }: { c: TokenColors }) {
  const [selected, setSelected] = useState('email')
  const options = [
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'push', label: 'Push notification' },
  ]

  function RadioBtn({ label, checked, onChange, disabled }: {
    value?: string; label: string; checked: boolean; onChange?: () => void; disabled?: boolean
  }) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
        <div
          onClick={!disabled ? onChange : undefined}
          style={{
            width: 16, height: 16, borderRadius: 99, border: `1.5px solid ${checked ? c.brand : c.border}`,
            backgroundColor: c.raisedBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {checked && <div style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: c.brand }} />}
        </div>
        <span style={{ fontSize: 13, color: c.textPri }}>{label}</span>
      </label>
    )
  }

  return (
    <>
      <DetailHeader label="Radio" desc="Single selection from a mutually exclusive set." c={c} />

      <DetailSection label="Playground" c={c}>
        <Canvas c={c}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: c.textSec, marginBottom: 2 }}>Notification method</span>
            {options.map(opt => (
              <RadioBtn key={opt.value} {...opt} checked={selected === opt.value} onChange={() => setSelected(opt.value)} />
            ))}
          </div>
        </Canvas>
      </DetailSection>

      <DetailSection label="States" c={c}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {[
            { value: 'a', label: 'Unselected', checked: false },
            { value: 'b', label: 'Selected', checked: true },
            { value: 'c', label: 'Disabled', checked: false, disabled: true },
            { value: 'd', label: 'Disabled sel.', checked: true, disabled: true },
          ].map(({ label, ...props }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
              <RadioBtn {...props} label={label} />
              <span style={{ fontSize: 9, color: c.textPh, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            </div>
          ))}
        </div>
      </DetailSection>
    </>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function ToggleDetail({ c }: { c: TokenColors }) {
  const [on1, setOn1] = useState(true)
  const [on2, setOn2] = useState(false)
  const [on3, setOn3] = useState(true)

  function Toggle({ on, onChange, label, disabled, size = 'md' }: {
    on: boolean; onChange?: () => void; label?: string; disabled?: boolean; size?: 'sm' | 'md'
  }) {
    const w = size === 'sm' ? 28 : 36
    const h = size === 'sm' ? 16 : 20
    const dot = size === 'sm' ? 10 : 14
    const travel = w - h + 2
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
        <div
          onClick={!disabled ? onChange : undefined}
          style={{
            width: w, height: h, borderRadius: 99, position: 'relative', flexShrink: 0,
            backgroundColor: on ? c.brand : c.border,
            transition: 'background-color 0.15s',
          }}
        >
          <div style={{
            position: 'absolute', top: (h - dot) / 2, left: on ? travel : (h - dot) / 2,
            width: dot, height: dot, borderRadius: 99, backgroundColor: '#fff',
            transition: 'left 0.15s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }} />
        </div>
        {label && <span style={{ fontSize: 13, color: c.textPri }}>{label}</span>}
      </label>
    )
  }

  return (
    <>
      <DetailHeader label="Toggle" desc="Switch for binary on/off settings." c={c} />

      <DetailSection label="Playground" c={c}>
        <Canvas c={c}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Toggle on={on1} onChange={() => setOn1(v => !v)} label="Email notifications" />
            <Toggle on={on2} onChange={() => setOn2(v => !v)} label="Dark mode" />
            <Toggle on={on3} onChange={() => setOn3(v => !v)} label="Two-factor authentication" />
          </div>
        </Canvas>
      </DetailSection>

      <DetailSection label="Sizes & states" c={c}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          {[
            { on: true,  label: 'On (md)', size: 'md' as const },
            { on: false, label: 'Off (md)', size: 'md' as const },
            { on: true,  label: 'On (sm)', size: 'sm' as const },
            { on: false, label: 'Off (sm)', size: 'sm' as const },
            { on: true,  label: 'Disabled on', size: 'md' as const, disabled: true },
            { on: false, label: 'Disabled off', size: 'md' as const, disabled: true },
          ].map(({ label, ...props }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
              <Toggle {...props} />
              <span style={{ fontSize: 9, color: c.textPh, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            </div>
          ))}
        </div>
      </DetailSection>
    </>
  )
}

// ── Textarea ──────────────────────────────────────────────────────────────────

function TextareaDetail({ c }: { c: TokenColors }) {
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [hasError, setHasError] = useState(false)
  const maxLen = 200

  return (
    <>
      <DetailHeader label="Textarea" desc="Multi-line text input for longer content." c={c} />

      <DetailSection label="Playground" c={c}>
        <PropControls c={c}>
          <PropRow label="State" c={c}>
            <PropPill active={!hasError} onClick={() => setHasError(false)} c={c}>Default</PropPill>
            <PropPill active={hasError} onClick={() => setHasError(true)} c={c}>Error</PropPill>
          </PropRow>
        </PropControls>
        <Canvas c={c}>
          <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: c.textSec, fontWeight: 500 }}>Description</label>
            <div style={{
              backgroundColor: c.raisedBg,
              border: `1.5px solid ${hasError ? c.danger : isFocused ? c.focusRing : c.border}`,
              borderRadius: 8, padding: '8px 12px',
              outline: isFocused && !hasError ? `2px solid ${c.focusRing}` : 'none', outlineOffset: 2,
            }}>
              <textarea
                value={value}
                onChange={e => setValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                maxLength={maxLen}
                placeholder="Tell us about yourself…"
                rows={4}
                style={{
                  display: 'block', width: '100%', background: 'none', border: 'none', outline: 'none',
                  resize: 'none', color: c.textPri, fontSize: 13, lineHeight: 1.55, fontFamily: 'inherit',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {hasError
                ? <span style={{ fontSize: 11, color: c.dangerText }}>Description is required.</span>
                : <span style={{ fontSize: 11, color: c.textPh }}>Max {maxLen} characters.</span>
              }
              <span style={{ fontSize: 11, color: c.textPh }}>{value.length}/{maxLen}</span>
            </div>
          </div>
        </Canvas>
      </DetailSection>

      <DetailSection label="States" c={c}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Default', border: c.border, bg: c.raisedBg, val: 'Some text' },
            { label: 'Focused', border: c.focusRing, bg: c.raisedBg, val: 'Typing…', focused: true },
            { label: 'Error',   border: c.danger,    bg: c.raisedBg, val: '' },
            { label: 'Disabled',border: c.border,    bg: c.sunkenBg, val: 'Cannot edit', disabled: true },
          ].map(({ label, border, bg, val, focused, disabled }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 11, color: c.textSec, minWidth: 60, paddingTop: 7 }}>{label}</span>
              <div style={{
                flex: 1, backgroundColor: bg, border: `1.5px solid ${border}`, borderRadius: 7,
                padding: '7px 10px', fontSize: 12, color: val ? c.textPri : c.textPh,
                outline: focused ? `2px solid ${c.focusRing}` : 'none', outlineOffset: 2,
                opacity: disabled ? 0.6 : 1, minHeight: 48,
              }}>
                {val || 'Placeholder text…'}
              </div>
            </div>
          ))}
        </div>
      </DetailSection>
    </>
  )
}

// ── Select ────────────────────────────────────────────────────────────────────

function SelectDetail({ c }: { c: TokenColors }) {
  const [value, setValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const options = ['Design', 'Engineering', 'Product', 'Marketing', 'Sales']

  const ChevronDown = ({ color }: { color: string }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  return (
    <>
      <DetailHeader label="Select" desc="Dropdown for selecting one option from a list." c={c} />

      <DetailSection label="Playground" c={c}>
        <Canvas c={c}>
          <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: c.textSec, fontWeight: 500 }}>Department</label>
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setIsOpen(v => !v)}
                onBlur={() => { setIsOpen(false); setIsFocused(false) }}
                tabIndex={0}
                onFocus={() => setIsFocused(true)}
                style={{
                  backgroundColor: c.raisedBg, border: `1.5px solid ${isFocused ? c.focusRing : c.border}`,
                  borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  color: value ? c.textPri : c.textPh,
                  outline: isFocused ? `2px solid ${c.focusRing}` : 'none', outlineOffset: 2,
                }}
              >
                <span>{value || 'Select a department…'}</span>
                <ChevronDown color={c.textPh} />
              </div>
              {isOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
                  backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden',
                }}>
                  {options.map(opt => (
                    <div
                      key={opt}
                      onMouseDown={() => { setValue(opt); setIsOpen(false) }}
                      style={{
                        padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                        color: opt === value ? c.brandText : c.textPri,
                        backgroundColor: opt === value ? c.brandSub : 'transparent',
                      }}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Canvas>
      </DetailSection>

      <DetailSection label="States" c={c}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Default',     val: '', border: c.border,    bg: c.raisedBg },
            { label: 'Selected',    val: 'Engineering', border: c.border, bg: c.raisedBg },
            { label: 'Focused',     val: 'Design', border: c.focusRing, bg: c.raisedBg, focused: true },
            { label: 'Disabled',    val: 'Disabled', border: c.border, bg: c.sunkenBg, disabled: true },
          ].map(({ label, val, border, bg, focused, disabled }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: c.textSec, minWidth: 60 }}>{label}</span>
              <div style={{
                flex: 1, backgroundColor: bg, border: `1.5px solid ${border}`, borderRadius: 7,
                padding: '6px 10px', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                color: val ? c.textPri : c.textPh,
                outline: focused ? `2px solid ${c.focusRing}` : 'none', outlineOffset: 2,
                opacity: disabled ? 0.6 : 1,
              }}>
                <span>{val || 'Select…'}</span>
                <ChevronDown color={c.textPh} />
              </div>
            </div>
          ))}
        </div>
      </DetailSection>
    </>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function TabsDetail({ c }: { c: TokenColors }) {
  const [activeLine, setActiveLine] = useState(0)
  const [activePill, setActivePill] = useState(0)
  const tabs = ['Overview', 'Analytics', 'Reports', 'Settings']

  return (
    <>
      <DetailHeader label="Tabs" desc="Organises content into switchable panels." c={c} />

      <DetailSection label="Underline style" c={c}>
        <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${c.border}`, padding: '0 12px' }}>
            {tabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveLine(i)} style={{
                fontSize: 13, padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
                color: i === activeLine ? c.brandText : c.textSec,
                fontWeight: i === activeLine ? 600 : 400,
                borderBottom: i === activeLine ? `2px solid ${c.brand}` : '2px solid transparent',
                marginBottom: -1,
              }}>
                {tab}
              </button>
            ))}
          </div>
          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: 13, color: c.textSec, margin: 0 }}>Content for {tabs[activeLine]} tab.</p>
          </div>
        </div>
      </DetailSection>

      <DetailSection label="Pill style" c={c}>
        <div style={{ backgroundColor: c.raisedBg, border: `1.5px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${c.border}` }}>
            <div style={{ display: 'inline-flex', gap: 2, backgroundColor: c.sunkenBg, borderRadius: 8, padding: 3 }}>
              {tabs.slice(0, 3).map((tab, i) => (
                <button key={tab} onClick={() => setActivePill(i)} style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  backgroundColor: i === activePill ? c.raisedBg : 'transparent',
                  color: i === activePill ? c.textPri : c.textSec,
                  fontWeight: i === activePill ? 500 : 400,
                  boxShadow: i === activePill ? `0 1px 3px rgba(0,0,0,0.08)` : 'none',
                }}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: 13, color: c.textSec, margin: 0 }}>Content for {tabs[activePill]} tab.</p>
          </div>
        </div>
      </DetailSection>
    </>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function AvatarDetail({ c }: { c: TokenColors }) {
  const initials = [
    { label: 'AK', bg: c.brandSub, text: c.brandText },
    { label: 'SL', bg: c.successSub, text: c.successText },
    { label: 'JW', bg: c.warningSub, text: c.warningText },
    { label: 'CR', bg: c.dangerSub, text: c.dangerText },
  ]

  function Avatar({ initials, bg, text, size = 32, online }: { initials: string; bg: string; text: string; size?: number; online?: boolean }) {
    return (
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <div style={{
          width: size, height: size, borderRadius: 99, backgroundColor: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.35, fontWeight: 600, color: text, flexShrink: 0,
        }}>
          {initials}
        </div>
        {online !== undefined && (
          <span style={{
            position: 'absolute', bottom: 1, right: 1,
            width: size * 0.28, height: size * 0.28, borderRadius: 99,
            backgroundColor: online ? c.success : c.border,
            border: `2px solid ${c.pageBg}`,
          }} />
        )}
      </div>
    )
  }

  return (
    <>
      <DetailHeader label="Avatar" desc="Visual representation of a user or entity." c={c} />

      <DetailSection label="Initials" c={c}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {initials.map(({ label, bg, text }) => (
            <Avatar key={label} initials={label} bg={bg} text={text} />
          ))}
        </div>
      </DetailSection>

      <DetailSection label="Sizes" c={c}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          {[{ size: 24, label: 'xs' }, { size: 32, label: 'sm' }, { size: 40, label: 'md' }, { size: 52, label: 'lg' }, { size: 64, label: 'xl' }].map(({ size, label }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <Avatar initials="AK" bg={c.brandSub} text={c.brandText} size={size} />
              <span style={{ fontSize: 9, color: c.textPh }}>{label}</span>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection label="With status indicator" c={c}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <Avatar initials="AK" bg={c.brandSub} text={c.brandText} size={40} online={true} />
            <span style={{ fontSize: 9, color: c.textPh }}>Online</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <Avatar initials="SL" bg={c.successSub} text={c.successText} size={40} online={false} />
            <span style={{ fontSize: 9, color: c.textPh }}>Offline</span>
          </div>
        </div>
      </DetailSection>

      <DetailSection label="Avatar group" c={c}>
        <div style={{ display: 'flex' }}>
          {initials.map(({ label, bg, text }, i) => (
            <div key={label} style={{ marginLeft: i === 0 ? 0 : -8, border: `2px solid ${c.pageBg}`, borderRadius: 99 }}>
              <Avatar initials={label} bg={bg} text={text} size={32} />
            </div>
          ))}
          <div style={{ marginLeft: -8, width: 36, height: 36, borderRadius: 99, backgroundColor: c.sunkenBg, border: `2px solid ${c.pageBg}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: c.textSec, fontWeight: 600 }}>+5</span>
          </div>
        </div>
      </DetailSection>
    </>
  )
}

// ── Progress ──────────────────────────────────────────────────────────────────

function ProgressDetail({ c }: { c: TokenColors }) {
  const [value, setValue] = useState(65)

  function ProgressBar({ pct, color, bg, height = 8 }: { pct: number; color: string; bg: string; height?: number }) {
    return (
      <div style={{ backgroundColor: bg, borderRadius: 99, height, overflow: 'hidden', width: '100%' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
    )
  }

  return (
    <>
      <DetailHeader label="Progress" desc="Visual indicator of task completion or loading." c={c} />

      <DetailSection label="Playground" c={c}>
        <Canvas c={c}>
          <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: c.textSec }}>Uploading…</span>
              <span style={{ fontSize: 12, color: c.textPri, fontWeight: 500 }}>{value}%</span>
            </div>
            <ProgressBar pct={value} color={c.brand} bg={c.brandSub} />
            <input type="range" min={0} max={100} value={value} onChange={e => setValue(Number(e.target.value))}
              style={{ width: '100%', accentColor: c.brand }} />
          </div>
        </Canvas>
      </DetailSection>

      <DetailSection label="Semantic variants" c={c}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Brand',   pct: 65, color: c.brand,   bg: c.brandSub   },
            { label: 'Success', pct: 100, color: c.success, bg: c.successSub },
            { label: 'Warning', pct: 40,  color: c.warning, bg: c.warningSub },
            { label: 'Danger',  pct: 15,  color: c.danger,  bg: c.dangerSub  },
          ].map(({ label, pct, color, bg }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: c.textSec, minWidth: 54 }}>{label}</span>
              <div style={{ flex: 1 }}><ProgressBar pct={pct} color={color} bg={bg} /></div>
              <span style={{ fontSize: 11, color: c.textPh, minWidth: 28, textAlign: 'right' as const }}>{pct}%</span>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection label="Sizes" c={c}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'xs (4px)', height: 4 },
            { label: 'sm (6px)', height: 6 },
            { label: 'md (8px)', height: 8 },
            { label: 'lg (12px)', height: 12 },
          ].map(({ label, height }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: c.textSec, minWidth: 60 }}>{label}</span>
              <div style={{ flex: 1 }}><ProgressBar pct={65} color={c.brand} bg={c.brandSub} height={height} /></div>
            </div>
          ))}
        </div>
      </DetailSection>
    </>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function TooltipDetail({ c }: { c: TokenColors }) {
  const [hovered, setHovered] = useState<string | null>(null)

  function TooltipWrap({ id, tip, children }: { id: string; tip: string; children: React.ReactNode }) {
    const isOpen = hovered === id
    return (
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <div onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)}>
          {children}
        </div>
        {isOpen && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
            transform: 'translateX(-50%)', zIndex: 50,
            backgroundColor: c.neutralStrong, color: c.pageBg,
            fontSize: 11, padding: '5px 9px', borderRadius: 6, whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {tip}
            <div style={{
              position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
              borderTop: `5px solid ${c.neutralStrong}`,
            }} />
          </div>
        )}
      </div>
    )
  }

  const btnBase: React.CSSProperties = {
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', border: `1.5px solid ${c.border}`, background: 'transparent', color: c.textSec,
  }

  return (
    <>
      <DetailHeader label="Tooltip" desc="Brief contextual help shown on hover." c={c} />

      <DetailSection label="Playground — hover the buttons" c={c}>
        <Canvas c={c}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <TooltipWrap id="save" tip="Save your changes (⌘S)">
              <button style={btnBase}>Save</button>
            </TooltipWrap>
            <TooltipWrap id="delete" tip="Permanently delete this item">
              <button style={{ ...btnBase, color: c.dangerText, borderColor: c.danger }}>Delete</button>
            </TooltipWrap>
            <TooltipWrap id="share" tip="Copy a shareable link">
              <button style={{ ...btnBase, color: c.brandText, borderColor: c.brand }}>Share</button>
            </TooltipWrap>
          </div>
        </Canvas>
      </DetailSection>

      <DetailSection label="Static previews" c={c}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {['Default', 'Warning', 'Info'].map((label, i) => {
            const bg = i === 0 ? c.neutralStrong : i === 1 ? c.warning : c.brand
            const fg = c.pageBg
            return (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  backgroundColor: bg, color: fg,
                  fontSize: 11, padding: '5px 10px', borderRadius: 6,
                }}>
                  Tooltip text
                </div>
                <span style={{ fontSize: 9, color: c.textPh, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              </div>
            )
          })}
        </div>
      </DetailSection>
    </>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ModalDetail({ c }: { c: TokenColors }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDanger, setIsDanger] = useState(false)

  function Modal({ title, body, onClose, danger }: { title: string; body: string; onClose: () => void; danger?: boolean }) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
      }} onClick={onClose}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            backgroundColor: c.raisedBg, border: `1px solid ${c.border}`, borderRadius: 12,
            width: 380, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c.textPri }}>{title}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textPh, fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 13, color: c.textSec, margin: 0, lineHeight: 1.6 }}>{body}</p>
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: `1px solid ${c.border}` }}>
            <button onClick={onClose} style={{ backgroundColor: 'transparent', color: c.textSec, border: `1.5px solid ${c.border}`, padding: '7px 16px', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={onClose} style={{ backgroundColor: danger ? c.danger : c.brand, color: c.onBrand, border: 'none', padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {danger ? 'Delete' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <DetailHeader label="Modal" desc="Focused dialog requiring user attention or input." c={c} />

      <DetailSection label="Playground" c={c}>
        <PropControls c={c}>
          <PropRow label="Type" c={c}>
            <PropPill active={!isDanger} onClick={() => setIsDanger(false)} c={c}>Default</PropPill>
            <PropPill active={isDanger} onClick={() => setIsDanger(true)} c={c}>Destructive</PropPill>
          </PropRow>
        </PropControls>
        <Canvas c={c}>
          <button
            onClick={() => setIsOpen(true)}
            style={{ backgroundColor: c.brand, color: c.onBrand, border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Open modal
          </button>
        </Canvas>
        {isOpen && (
          <Modal
            title={isDanger ? 'Delete account' : 'Confirm changes'}
            body={isDanger
              ? 'This action is permanent and cannot be undone. All your data will be deleted.'
              : 'You are about to save changes to your profile. Do you want to continue?'
            }
            onClose={() => setIsOpen(false)}
            danger={isDanger}
          />
        )}
      </DetailSection>

      <DetailSection label="Static preview" c={c}>
        <div style={{ backgroundColor: c.raisedBg, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', maxWidth: 380 }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: c.textPri }}>Modal title</span>
            <span style={{ color: c.textPh, fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</span>
          </div>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}` }}>
            <p style={{ fontSize: 13, color: c.textSec, margin: 0, lineHeight: 1.6 }}>
              Modal body content goes here. This can describe a confirmation, a form, or any contextual action.
            </p>
          </div>
          <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button style={{ backgroundColor: 'transparent', color: c.textSec, border: `1.5px solid ${c.border}`, padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button style={{ backgroundColor: c.brand, color: c.onBrand, border: 'none', padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Confirm</button>
          </div>
        </div>
      </DetailSection>
    </>
  )
}

// ── Token table ───────────────────────────────────────────────────────────────

function TokenRow({ colorKey, c, palettes, theme, mode, assignToken, isLast }: {
  colorKey: keyof TokenColors
  c: TokenColors
  palettes: Palette[]
  theme: Theme | null
  mode: 'light' | 'dark'
  assignToken: (tokenId: string, mode: 'light' | 'dark', ref: TokenRef | null) => void
  isLast: boolean
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  const path  = TOKEN_PATHS[colorKey]
  const label = TOKEN_LABELS[colorKey]
  const hex   = c[colorKey] as string

  // Current ref from theme
  let currentRef: TokenRef | null = null
  if (theme) {
    for (const group of theme.groups) {
      const tok = group.tokens.find(t => t.id === path)
      if (tok) { currentRef = mode === 'dark' ? tok.dark : tok.light; break }
    }
  }

  // Display label: "PaletteName · step"
  let stepDisplay = '—'
  if (currentRef) {
    const pal = palettes.find(p => p.id === currentRef!.paletteId)
    const steps = pal ? getActiveSteps(pal) : []
    const step  = steps.find(s => s.label === currentRef!.stepLabel)
    if (pal && step) stepDisplay = `${pal.name} · ${step.label}`
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr',
      gap: '0 12px', alignItems: 'center', padding: '5px 0',
      borderBottom: isLast ? 'none' : `1px solid ${c.border}`,
    }}>
      <span style={{ fontSize: 12, color: c.textPri }}>{label}</span>
      <code style={{ fontSize: 10, color: c.textPh }}>{path}</code>

      {/* Step button — opens picker on click */}
      <button
        onClick={e => setAnchor(e.currentTarget.getBoundingClientRect())}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: `1px solid ${c.border}`, borderRadius: 6,
          padding: '3px 8px', cursor: 'pointer', textAlign: 'left',
          backgroundColor: c.raisedBg,
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: hex, border: `1px solid ${c.borderStrong}`, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: currentRef ? c.textPri : c.textPh }}>{stepDisplay}</span>
      </button>

      {anchor && (
        <StepPicker
          anchorRect={anchor}
          palettes={palettes}
          current={currentRef}
          onSelect={ref => { assignToken(path, mode, ref); setAnchor(null) }}
          onClear={() => { assignToken(path, mode, null); setAnchor(null) }}
          onClose={() => setAnchor(null)}
        />
      )}
    </div>
  )
}

function TokenTable({ keys, c, palettes, theme, mode, assignToken }: {
  keys: (keyof TokenColors)[]
  c: TokenColors
  palettes: Palette[]
  theme: Theme | null
  mode: 'light' | 'dark'
  assignToken: (tokenId: string, mode: 'light' | 'dark', ref: TokenRef | null) => void
}) {
  return (
    <DetailSection label="Color tokens" c={c}>
      <div style={{ backgroundColor: c.raisedBg, border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '0 12px',
          padding: '6px 14px', backgroundColor: c.sunkenBg, borderBottom: `1px solid ${c.border}`,
        }}>
          {['Token', 'Path', 'Color step'].map(h => (
            <span key={h} style={{ fontSize: 9, fontWeight: 600, color: c.textSec, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>
        <div style={{ padding: '0 14px' }}>
          {keys.map((key, i) => (
            <TokenRow
              key={key} colorKey={key} c={c}
              palettes={palettes} theme={theme} mode={mode}
              assignToken={assignToken} isLast={i === keys.length - 1}
            />
          ))}
        </div>
      </div>
    </DetailSection>
  )
}
