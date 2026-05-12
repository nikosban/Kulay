import { useRef, useState } from "react";
import { IconLayoutGrid, IconTable } from "@tabler/icons-react";
import { useProjectStore } from "../../store/useProjectStore";
import { getActiveSteps } from "../../types/project";
import type { Palette, LabelScale } from "../../types/project";
import { DEFAULT_LABEL_SCALE } from "../../types/project";
import { useTheme } from "../../contexts/ThemeContext";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useBeforeUnload } from "../../hooks/useBeforeUnload";
import { ConfirmLeaveModal } from "../ui/ConfirmLeaveModal";
import { StepDetailPanel } from "./StepDetailPanel";
import { ExportModal } from "./ExportModal";
import { ThemeToggle } from "../ui/ThemeToggle";
import { ProjectSidebar } from "./ProjectSidebar";
import { relativeLuminance } from "../../lib/wcag";
import { sanitizeHex } from "../../lib/hexInput";
import { toast } from "sonner";

const MIN_STEPS = 2;
const MAX_STEPS = 20;

// ── Compact background picker for the header ─────────────────────────────────

function CompactBgInput({ value, label, onCommit }: {
  value: string
  label: string
  onCommit: (hex: string) => void
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(value.slice(1));

  function commit(raw: string) {
    const result = sanitizeHex(raw);
    if (!result) { setEditing(false); setInputVal(value.slice(1)); return; }
    if (result.alphaStripped) toast.info("Alpha value removed. Kulay works with solid colors only.");
    setEditing(false);
    setInputVal(result.hex.slice(1));
    onCommit(result.hex);
  }

  return (
    <div className="flex items-center gap-1.5">
      <div
        className="relative w-4 h-4 rounded flex-shrink-0 overflow-hidden cursor-pointer border border-bd-base dark:border-bd-hover-dark"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onCommit(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          title={label}
        />
      </div>
      <div className="flex items-center">
        <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark select-none mr-0.5">#</span>
        <input
          type="text"
          className="w-16 text-[11px] font-mono text-fg-subtle dark:text-fg-subtle-dark bg-transparent outline-none"
          value={editing ? inputVal : value.slice(1).toUpperCase()}
          maxLength={8}
          spellCheck={false}
          onFocus={(e) => { setInputVal(value.slice(1)); setEditing(true); e.target.select(); }}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") { setEditing(false); setInputVal(value.slice(1)); }
          }}
        />
      </div>
    </div>
  );
}

// ── Color table (expanded + collapsed) ───────────────────────────────────────

function ColorTable({ palettes, collapsed, onSelectPalette, onSelectAndOpenStep, paletteRefs }: {
  palettes: Palette[]
  collapsed: boolean
  onSelectPalette: (id: string) => void
  onSelectAndOpenStep: (paletteId: string, stepLabel: number) => void
  paletteRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
}) {
  const columnLabels = palettes[0] ? getActiveSteps(palettes[0]).map((s) => s.label) : [];

  function attachRef(el: HTMLDivElement | null, paletteId: string) {
    if (el) paletteRefs.current.set(paletteId, el);
    else paletteRefs.current.delete(paletteId);
  }

  // ── Collapsed: tight color strips ──────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex-1 overflow-y-auto">
        {palettes.map((palette) => {
          const steps = getActiveSteps(palette);
          return (
            <div
              key={palette.id}
              ref={(el) => attachRef(el, palette.id)}
              className="flex"
              title={palette.name}
            >
              {steps.map((step) => (
                <div
                  key={step.label}
                  className="flex-1 cursor-pointer"
                  style={{ backgroundColor: step.hex, height: 28 }}
                  onClick={() => onSelectAndOpenStep(palette.id, step.label)}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Expanded: table with name column + labelled step cells ─────────────────
  return (
    <div className="flex-1 overflow-auto">
      {/* Sticky header row */}
      <div className="flex sticky top-0 z-10 bg-surface-page dark:bg-surface-page-dark border-b border-bd-base dark:border-bd-base-dark">
        <div className="w-36 flex-shrink-0" />
        {columnLabels.map((label) => (
          <div
            key={label}
            className="flex-1 py-2 text-center text-[10px] font-mono text-fg-placeholder dark:text-fg-placeholder-dark select-none"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Palette rows */}
      {palettes.map((palette) => {
        const steps = getActiveSteps(palette);
        return (
          <div
            key={palette.id}
            ref={(el) => attachRef(el, palette.id)}
            className="flex items-stretch border-b border-bd-base dark:border-bd-base-dark group"
          >
            {/* Name cell */}
            <div
              className="w-36 flex-shrink-0 flex items-center px-4 cursor-pointer hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
              onClick={() => onSelectPalette(palette.id)}
            >
              <span className="text-[12px] font-medium text-fg-subtle dark:text-fg-subtle-dark truncate">
                {palette.name}
              </span>
            </div>

            {/* Step cells */}
            {steps.map((step) => {
              const lum = relativeLuminance(step.hex);
              const textColor = lum > 0.18 ? "#111111" : "#ffffff";
              return (
                <div
                  key={step.label}
                  className="flex-1 cursor-pointer relative flex items-end justify-center pb-1.5 group/cell"
                  style={{ backgroundColor: step.hex, height: 44 }}
                  onClick={() => onSelectAndOpenStep(palette.id, step.label)}
                >
                  <span
                    className="text-[9px] font-mono select-none opacity-0 group-hover/cell:opacity-60 transition-opacity"
                    style={{ color: textColor }}
                  >
                    {step.hex.slice(1).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function ProjectScreen() {
  const isDirty = useProjectStore((s) => s.isDirty);
  const closeProject = useProjectStore((s) => s.closeProject);
  const saveNow = useProjectStore((s) => s.saveNow);
  const palettes = useProjectStore((s) => s.activeProject?.palettes ?? []);
  const stepCount = useProjectStore((s) => s.activeProject?.stepCount ?? 10);
  const backgrounds = useProjectStore((s) => s.activeProject?.backgrounds);
  const updateBackgrounds = useProjectStore((s) => s.updateBackgrounds);
  const updateProjectStepCount = useProjectStore((s) => s.updateProjectStepCount);
  const switchProjectPaletteMode = useProjectStore((s) => s.switchProjectPaletteMode);
  const labelScale = useProjectStore((s) => s.activeProject?.labelScale ?? DEFAULT_LABEL_SCALE);
  const setLabelScale = useProjectStore((s) => s.setLabelScale);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [tableCollapsed, setTableCollapsed] = useState(false);
  const [openPanelKey, setOpenPanelKey] = useState<{ paletteId: string; stepLabel: number } | null>(null);
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null);

  const paletteRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  function handleOpenStep(paletteId: string, stepLabel: number | null) {
    setOpenPanelKey(stepLabel === null ? null : { paletteId, stepLabel });
  }

  function handleSelectPalette(id: string | null) {
    setSelectedPaletteId(id);
    setOpenPanelKey(null);
    if (id) {
      const el = paletteRefs.current.get(id);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function handleSelectAndOpenStep(paletteId: string, stepLabel: number) {
    setSelectedPaletteId(paletteId);
    setOpenPanelKey({ paletteId, stepLabel });
    const el = paletteRefs.current.get(paletteId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const selectedPalette = selectedPaletteId
    ? (palettes.find((p) => p.id === selectedPaletteId) ?? null)
    : null;

  const openPalette = openPanelKey
    ? (palettes.find((p) => p.id === openPanelKey.paletteId) ?? null)
    : null;
  const openStep =
    openPalette && openPanelKey
      ? (getActiveSteps(openPalette).find((s) => s.label === openPanelKey.stepLabel) ?? null)
      : null;

  const { isDark, toggle } = useTheme();
  const swatchCount = stepCount + 1;

  useAutoSave();
  useBeforeUnload();

  function handleBack() {
    if (isDirty) setShowLeaveModal(true);
    else closeProject();
  }

  return (
    <div className="h-screen flex overflow-hidden bg-surface-page dark:bg-surface-page-dark">

      {/* ── Left sidebar ── */}
      <ProjectSidebar
        onBack={handleBack}
        selectedPaletteId={selectedPaletteId}
        onSelectPalette={handleSelectPalette}
      />

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Detail view: selected palette steps fill the content area ── */}
          {selectedPalette ? (
            <div className="flex flex-row flex-1 overflow-hidden">
              {getActiveSteps(selectedPalette).map((step) => {
                const lum = relativeLuminance(step.hex);
                const textColor = lum > 0.18 ? "#111111" : "#ffffff";
                const isOpen = openPanelKey?.paletteId === selectedPalette.id && openPanelKey.stepLabel === step.label;
                return (
                  <div
                    key={step.label}
                    className="flex-1 flex flex-col items-center justify-end pb-3 cursor-pointer relative"
                    style={{ backgroundColor: step.hex }}
                    onClick={() => handleOpenStep(selectedPalette.id, isOpen ? null : step.label)}
                  >
                    {isOpen && (
                      <div
                        className="absolute inset-x-0 top-0 h-[3px]"
                        style={{ backgroundColor: textColor, opacity: 0.5 }}
                      />
                    )}
                    <span
                      className="text-[10px] font-mono select-none"
                      style={{ color: textColor, opacity: isOpen ? 1 : 0.5 }}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

          ) : (
            /* ── All colors view ── */
            <main className="flex-1 overflow-hidden flex flex-col">

              {palettes.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-fg-placeholder dark:text-fg-placeholder-dark">
                    Add a color from the sidebar to get started.
                  </p>
                </div>
              ) : (
                <>
                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-bd-base dark:border-bd-base-dark flex-shrink-0">

                    {/* Label scale selector */}
                    <div className="flex items-center rounded-md border border-bd-base dark:border-bd-base-dark overflow-hidden">
                      {(["0-10", "0-100", "0-1000"] as LabelScale[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setLabelScale(s)}
                          className={`px-2.5 h-7 text-[11px] font-mono transition-colors ${
                            labelScale === s
                              ? "bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark text-fg-base dark:text-fg-base-dark"
                              : "text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    {/* View toggle */}
                    <div className="flex items-center rounded-md border border-bd-base dark:border-bd-base-dark overflow-hidden">
                      <button
                        onClick={() => setTableCollapsed(false)}
                        title="Expanded"
                        className={`w-7 h-7 flex items-center justify-center transition-colors ${
                          !tableCollapsed
                            ? "bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark text-fg-base dark:text-fg-base-dark"
                            : "text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark"
                        }`}
                      >
                        <IconTable size={13} stroke={1.75} />
                      </button>
                      <button
                        onClick={() => setTableCollapsed(true)}
                        title="Collapsed"
                        className={`w-7 h-7 flex items-center justify-center transition-colors ${
                          tableCollapsed
                            ? "bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark text-fg-base dark:text-fg-base-dark"
                            : "text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark"
                        }`}
                      >
                        <IconLayoutGrid size={13} stroke={1.75} />
                      </button>
                    </div>
                  </div>

                  <ColorTable
                    palettes={palettes}
                    collapsed={tableCollapsed}
                    onSelectPalette={handleSelectPalette}
                    onSelectAndOpenStep={handleSelectAndOpenStep}
                    paletteRefs={paletteRefs}
                  />
                </>
              )}
            </main>
          )}

        </div>
      </div>

      {/* ── Right panel (step detail) — sibling column, same level as left sidebar ── */}
      {openStep && openPalette && (
        <StepDetailPanel
          palette={openPalette}
          step={openStep}
          onClose={() => setOpenPanelKey(null)}
          onDeletePalette={() => handleSelectPalette(null)}
        />
      )}

      {/* ── Floating toolbar ── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-1.5 rounded-2xl border border-bd-base dark:border-bd-base-dark bg-surface-base dark:bg-surface-base-dark shadow-lg shadow-black/10 dark:shadow-black/40">

        {palettes.length > 0 && backgrounds && (
          <>
            <CompactBgInput
              value={isDark ? backgrounds.dark : backgrounds.light}
              label={isDark ? "Dark bg" : "Light bg"}
              onCommit={(hex) => updateBackgrounds(isDark
                ? { ...backgrounds, dark: hex }
                : { ...backgrounds, light: hex }
              )}
            />
            <div className="w-px h-4 bg-bd-base dark:bg-bd-base-dark mx-1 flex-shrink-0" />
          </>
        )}

        {palettes.length > 0 && (
          <>
            <button
              onClick={() => updateProjectStepCount(stepCount - 1)}
              disabled={stepCount <= MIN_STEPS}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-base-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
            >−</button>
            <span className="text-xs text-fg-muted dark:text-fg-muted-dark w-14 text-center tabular-nums">
              {swatchCount} steps
            </span>
            <button
              onClick={() => updateProjectStepCount(stepCount + 1)}
              disabled={stepCount >= MAX_STEPS}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-base-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
            >+</button>
            <div className="w-px h-4 bg-bd-base dark:bg-bd-base-dark mx-1 flex-shrink-0" />
          </>
        )}

        <ThemeToggle
          isDark={isDark}
          onToggle={() => {
            const nextMode = isDark ? "light" : "dark";
            if (palettes.length > 0) switchProjectPaletteMode(nextMode);
            toggle();
          }}
        />

        {palettes.length > 0 && (
          <>
            <div className="w-px h-4 bg-bd-base dark:bg-bd-base-dark mx-1 flex-shrink-0" />
            <button
              onClick={() => setShowExport(true)}
              className="text-sm text-fg-muted dark:text-fg-muted-dark hover:text-fg-base dark:hover:text-fg-base-dark px-2 py-1 rounded-lg hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
            >
              Export
            </button>
          </>
        )}
      </div>

      {showLeaveModal && (
        <ConfirmLeaveModal
          onSave={() => { saveNow(); setShowLeaveModal(false); closeProject(); }}
          onDiscard={() => { setShowLeaveModal(false); closeProject(); }}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}
      {showExport && (
        <ExportModal scope="project" onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
