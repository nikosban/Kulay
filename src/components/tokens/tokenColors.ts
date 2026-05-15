export interface Tokens { [key: string]: string | undefined }

export function resolveColors(tokens: Tokens, mode: 'light' | 'dark') {
  const m = (l: string, d: string) => mode === 'dark' ? d : l
  const t = (id: string, fb: string) => tokens[id] ?? fb
  return {
    pageBg:         t('surface/neutral/base',              m('#f5f5f5', '#141414')),
    raisedBg:       t('surface/neutral/subtle',            m('#ffffff', '#1c1c1c')),
    sunkenBg:       t('surface/neutral/muted',             m('#efefef', '#0f0f0f')),
    neutralStrong:  t('surface/neutral/strong',            m('#262626', '#d4d4d4')),
    textPri:        t('fg/base',                           m('#111111', '#efefef')),
    textSec:        t('fg/muted',                          m('#555555', '#aaaaaa')),
    textPh:         t('fg/placeholder',                    m('#999999', '#666666')),
    border:         t('border/default',                    m('#e0e0e0', '#333333')),
    borderStrong:   t('border/strong',                     m('#a3a3a3', '#525252')),
    brand:          t('interactive/brand/rest',            m('#3b82f6', '#60a5fa')),
    brandSub:       t('surface/brand/subtle',              m('#eff6ff', '#1e3a5f')),
    brandText:      t('fg/brand/base',                     m('#1d4ed8', '#93c5fd')),
    onBrand:        t('fg/on-brand',                       '#ffffff'),
    danger:         t('interactive/danger/rest',           m('#ef4444', '#f87171')),
    dangerSub:      t('surface/danger/subtle',             m('#fef2f2', '#2a0f0f')),
    dangerText:     t('fg/danger/alt',                     m('#b91c1c', '#fca5a5')),
    success:        t('surface/success/strong',            m('#22c55e', '#4ade80')),
    successSub:     t('surface/success/subtle',            m('#f0fdf4', '#0f2a1a')),
    successText:    t('fg/success/alt',                    m('#15803d', '#86efac')),
    warning:        t('surface/warning/strong',            m('#f59e0b', '#fbbf24')),
    warningSub:     t('surface/warning/subtle',            m('#fffbeb', '#2a1f0f')),
    warningText:    t('fg/warning/alt',                    m('#92400e', '#fde68a')),
    info:           t('surface/informative/strong',        m('#3b82f6', '#60a5fa')),
    infoSub:        t('surface/informative/subtle',        m('#eff6ff', '#0f1e2a')),
    infoText:       t('fg/informative/alt',                m('#1d4ed8', '#93c5fd')),
    focusRing:      t('focus/ring',                        m('#3b82f6', '#60a5fa')),
    disabled:       t('interactive/disabled/rest',         m('#e5e5e5', '#262626')),
  }
}

export type TokenColors = ReturnType<typeof resolveColors>
