import { useRef, useState, useEffect } from "react";
import { IconChevronLeft, IconChevronRight, IconLayoutGrid, IconTable } from "@tabler/icons-react";
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
import { CurveEditor } from "./CurveEditor";
import { IsolatedCurveEditor } from "./IsolatedCurveEditor";
import { CurveDetailPanel } from "./CurveDetailPanel";
import { TokenComponentsInspector, TokensView } from "../tokens/TokensView";
import type { ComponentType } from "../tokens/ComponentDetail";
import { relativeLuminance } from "../../lib/wcag";
import { sanitizeHex } from "../../lib/hexInput";
import { realizeCurvePreview } from "../../lib/savedCurves";
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
      <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark select-none">{label}</span>
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
          className="w-14 text-[11px] font-mono text-fg-subtle dark:text-fg-subtle-dark bg-transparent outline-none"
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
  const savedCurves = useProjectStore((s) => s.activeProject?.savedCurves ?? []);
  const stepCount = useProjectStore((s) => s.activeProject?.stepCount ?? 10);
  const backgrounds = useProjectStore((s) => s.activeProject?.backgrounds);
  const updateBackgrounds = useProjectStore((s) => s.updateBackgrounds);
  const updateProjectStepCount = useProjectStore((s) => s.updateProjectStepCount);
  const switchProjectPaletteMode = useProjectStore((s) => s.switchProjectPaletteMode);
  const labelScale = useProjectStore((s) => s.activeProject?.labelScale ?? DEFAULT_LABEL_SCALE);
  const setLabelScale = useProjectStore((s) => s.setLabelScale);
  const insertStep = useProjectStore((s) => s.insertStep);
  const updateCurveStep = useProjectStore((s) => s.updateCurveStep);
  const updateCurveStrategy = useProjectStore((s) => s.updateCurveStrategy);
  const updateSavedCurvePoint = useProjectStore((s) => s.updateSavedCurvePoint);
  const updateSavedCurveStrategy = useProjectStore((s) => s.updateSavedCurveStrategy);
  const previewSavedCurvePoint = useProjectStore((s) => s.previewSavedCurvePoint);
  const detachSavedCurve = useProjectStore((s) => s.detachSavedCurve);
  const curvePreview = useProjectStore((s) => s.curvePreview);
  const curvePreviewKind = useProjectStore((s) => s.curvePreviewKind);
  const curveHistoryPast = useProjectStore((s) => s.curveHistoryPast);
  const curveHistoryFuture = useProjectStore((s) => s.curveHistoryFuture);
  const previewCurveShapePreset = useProjectStore((s) => s.previewCurveShapePreset);
  const commitCurvePreview = useProjectStore((s) => s.commitCurvePreview);
  const cancelCurvePreview = useProjectStore((s) => s.cancelCurvePreview);
  const undoCurveEdit = useProjectStore((s) => s.undoCurveEdit);
  const redoCurveEdit = useProjectStore((s) => s.redoCurveEdit);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeTab, setActiveTab] = useState<'colors' | 'tokens'>('colors');
  const [tableCollapsed, setTableCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [openPanelKey, setOpenPanelKey] = useState<{ paletteId: string; stepLabel: number } | null>(null);
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null);
  const [selectedCurveId, setSelectedCurveId] = useState<string | null>(null);
  const [selectedCurvePointId, setSelectedCurvePointId] = useState<string | null>(null);
  const [selectedTokenComponent, setSelectedTokenComponent] = useState<ComponentType | null>(null);

  const paletteRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  function handleOpenStep(paletteId: string, stepLabel: number | null) {
    setOpenPanelKey(stepLabel === null ? null : { paletteId, stepLabel });
    if (stepLabel !== null) setInspectorCollapsed(false);
  }

  function handleSelectPalette(id: string | null) {
    cancelCurvePreview();
    setSelectedCurveId(null);
    setSelectedCurvePointId(null);
    setSelectedPaletteId(id);
    setOpenPanelKey(null);
    if (id) {
      const el = paletteRefs.current.get(id);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function handleSelectCurve(id: string) {
    cancelCurvePreview();
    setActiveTab('colors');
    setSelectedCurveId(id);
    setSelectedCurvePointId(null);
    setOpenPanelKey(null);
    setInspectorCollapsed(false);
  }

  function handleSelectAndOpenStep(paletteId: string, stepLabel: number) {
    setSelectedPaletteId(paletteId);
    setOpenPanelKey({ paletteId, stepLabel });
    const el = paletteRefs.current.get(paletteId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleInsertStep(paletteId: string, leftLabel: number | null, rightLabel: number | null) {
    if (!selectedPalette) return
    const oldStepIds = new Set(getActiveSteps(selectedPalette).map((step) => step.id))
    insertStep(paletteId, leftLabel, rightLabel)
    const updated = useProjectStore.getState().activeProject?.palettes.find((p) => p.id === paletteId)
    if (!updated) return
    const newStep = getActiveSteps(updated).find((step) => !oldStepIds.has(step.id))
    if (newStep) handleOpenStep(paletteId, newStep.label)
  }

  const selectedPalette = selectedPaletteId
    ? (palettes.find((p) => p.id === selectedPaletteId) ?? null)
    : null;
  const selectedCurve = selectedCurveId
    ? (savedCurves.find((curve) => curve.id === selectedCurveId) ?? null)
    : null;
  const linkedReferencePalette = selectedCurve
    ? (selectedPalette?.curveBindings?.[selectedCurve.type] === selectedCurve.id
        ? selectedPalette
        : palettes.find((palette) => palette.curveBindings?.[selectedCurve.type] === selectedCurve.id) ?? null)
    : null;
  const referencePalette = linkedReferencePalette ?? selectedPalette ?? palettes[0] ?? null;
  const displayedCurve = selectedCurve && curvePreview?.id === selectedCurve.id ? curvePreview : selectedCurve;
  const displayedCurvePreview = displayedCurve && referencePalette && backgrounds
    ? realizeCurvePreview(referencePalette, displayedCurve, backgrounds)
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'e' && palettes.length > 0) {
        e.preventDefault();
        setShowExport(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [palettes.length]);

  useEffect(() => {
    function onCurveHistoryKeyDown(event: KeyboardEvent) {
      if (!selectedCurveId || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      if (event.shiftKey) redoCurveEdit();
      else undoCurveEdit();
    }
    document.addEventListener('keydown', onCurveHistoryKeyDown);
    return () => document.removeEventListener('keydown', onCurveHistoryKeyDown);
  }, [redoCurveEdit, selectedCurveId, undoCurveEdit]);

  function handleBack() {
    if (isDirty) setShowLeaveModal(true);
    else closeProject();
  }

  return (
    <div className="h-screen flex overflow-hidden bg-surface-page dark:bg-surface-page-dark">

      {/* ── Left sidebar ── */}
      <ProjectSidebar
        onBack={handleBack}
        activeTab={activeTab}
        onTabChange={(tab) => { cancelCurvePreview(); setActiveTab(tab); }}
        selectedPaletteId={selectedPaletteId}
        onSelectPalette={(id) => { setActiveTab('colors'); handleSelectPalette(id); }}
        selectedCurveId={selectedCurveId}
        onSelectCurve={handleSelectCurve}
      />

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {activeTab === 'tokens' && <TokensView selected={selectedTokenComponent} />}

          {/* ── Colors tab content ── */}
          {activeTab === 'colors' && displayedCurve ? (
            <IsolatedCurveEditor
              curve={displayedCurve}
              preview={displayedCurvePreview}
              selectedPointId={selectedCurvePointId}
              onSelectPoint={(pointId) => { setSelectedCurvePointId(pointId); setInspectorCollapsed(false); }}
              onPreviewPoint={(pointId, value) => previewSavedCurvePoint(displayedCurve.id, pointId, value)}
              onCommitPreview={commitCurvePreview}
              onCancelPreview={cancelCurvePreview}
            />
          ) : activeTab === 'colors' && selectedPalette ? (
            <CurveEditor
              palette={selectedPalette}
              onUpdateCurveStep={updateCurveStep}
              onUpdateCurveStrategy={updateCurveStrategy}
              onSelectStep={(stepLabel) => handleOpenStep(selectedPalette.id, stepLabel)}
              onInsertStep={(leftLabel, rightLabel) => handleInsertStep(selectedPalette.id, leftLabel, rightLabel)}
            />
          ) : activeTab === 'colors' ? (
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
          ) : null}

        </div>
      </div>

      {/* ── Persistent right inspector ── */}
      {inspectorCollapsed ? (
        <aside className="w-9 flex-shrink-0 border-l border-bd-base dark:border-bd-base-dark bg-surface-sunken dark:bg-surface-sunken-dark flex flex-col items-center">
          <button
            type="button"
            onClick={() => setInspectorCollapsed(false)}
            title="Expand inspector"
            aria-label="Expand inspector"
            className="mt-2 w-7 h-7 flex items-center justify-center rounded text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark hover:bg-surface-neutral-subtle-active dark:hover:bg-surface-neutral-subtle-active-dark transition-colors"
          >
            <IconChevronLeft size={14} stroke={1.75} />
          </button>
        </aside>
      ) : activeTab === 'tokens' ? (
        <aside className="flex w-[300px] flex-shrink-0 flex-col overflow-hidden border-l border-bd-base bg-surface-sunken dark:border-bd-base-dark dark:bg-surface-sunken-dark">
          <div className="flex items-center gap-2 border-b border-bd-base px-3 py-2.5 dark:border-bd-base-dark">
            <span className="flex-1 text-[13px] font-semibold text-fg-base dark:text-fg-base-dark">Components</span>
            <button
              type="button"
              onClick={() => setInspectorCollapsed(true)}
              title="Collapse inspector"
              aria-label="Collapse inspector"
              className="flex h-7 w-7 items-center justify-center rounded text-fg-placeholder transition-colors hover:bg-surface-neutral-subtle-active hover:text-fg-subtle dark:text-fg-placeholder-dark dark:hover:bg-surface-neutral-subtle-active-dark dark:hover:text-fg-subtle-dark"
            >
              <IconChevronRight size={14} stroke={1.75} />
            </button>
          </div>
          <TokenComponentsInspector selected={selectedTokenComponent} onSelect={setSelectedTokenComponent} />
        </aside>
      ) : activeTab === 'colors' && displayedCurve && selectedCurve ? (
        <CurveDetailPanel
          curve={displayedCurve}
          samples={displayedCurvePreview?.samples ?? []}
          palettes={palettes}
          selectedPointId={selectedCurvePointId}
          onSelectPoint={setSelectedCurvePointId}
          onUpdatePoint={(pointId, value) => updateSavedCurvePoint(selectedCurve.id, pointId, value)}
          onUpdateStrategy={(strategy) => updateSavedCurveStrategy(selectedCurve.id, strategy)}
          onPreviewPreset={(preset) => previewCurveShapePreset(selectedCurve.id, preset)}
          previewing={curvePreviewKind === 'preset' && curvePreview?.id === selectedCurve.id}
          onCommitPreview={commitCurvePreview}
          onCancelPreview={cancelCurvePreview}
          canUndo={curveHistoryPast.length > 0}
          canRedo={curveHistoryFuture.length > 0}
          onUndo={undoCurveEdit}
          onRedo={redoCurveEdit}
          onDetach={(paletteId) => detachSavedCurve(paletteId, selectedCurve.type)}
          onClose={() => setInspectorCollapsed(true)}
        />
      ) : activeTab === 'colors' && openStep && openPalette ? (
        <StepDetailPanel
          palette={openPalette}
          step={openStep}
          onClose={() => setInspectorCollapsed(true)}
        />
      ) : (
        <aside className="w-[300px] flex-shrink-0 border-l border-bd-base dark:border-bd-base-dark bg-surface-sunken dark:bg-surface-sunken-dark flex flex-col overflow-y-auto">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-bd-base dark:border-bd-base-dark">
            <span className="flex-1 text-[13px] font-semibold text-fg-base dark:text-fg-base-dark">
              Inspector
            </span>
            <button
              type="button"
              onClick={() => setInspectorCollapsed(true)}
              title="Collapse inspector"
              aria-label="Collapse inspector"
              className="w-7 h-7 flex items-center justify-center rounded text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark hover:bg-surface-neutral-subtle-active dark:hover:bg-surface-neutral-subtle-active-dark transition-colors"
            >
              <IconChevronRight size={14} stroke={1.75} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-6 text-center">
            <p className="text-[11px] leading-relaxed text-fg-placeholder dark:text-fg-placeholder-dark">
              {selectedPalette
                  ? 'Select a curve point or color step to inspect and edit it.'
                  : 'Select a color or saved curve to begin editing.'}
            </p>
          </div>
        </aside>
      )}

      {/* ── Floating toolbar ── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 rounded-2xl border border-bd-base dark:border-bd-base-dark bg-surface-base dark:bg-surface-base-dark shadow-lg shadow-black/10 dark:shadow-black/40">

        {palettes.length > 0 && backgrounds && (
          <>
            <div className="flex items-center rounded-lg border border-bd-base dark:border-bd-base-dark h-7 px-2">
              <CompactBgInput
                value={isDark ? backgrounds.dark : backgrounds.light}
                label={isDark ? "Dark bg" : "Light bg"}
                onCommit={(hex) => updateBackgrounds(isDark
                  ? { ...backgrounds, dark: hex }
                  : { ...backgrounds, light: hex }
                )}
              />
            </div>
            <div className="w-px h-4 bg-bd-base dark:bg-bd-base-dark flex-shrink-0" />
          </>
        )}

        {palettes.length > 0 && (
          <>
            <div className="flex items-center rounded-lg border border-bd-base dark:border-bd-base-dark overflow-hidden">
              <button
                onClick={() => updateProjectStepCount(stepCount - 1)}
                disabled={stepCount <= MIN_STEPS}
                className="w-7 h-7 flex items-center justify-center text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-base-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
              >−</button>
              <div className="w-px h-4 bg-bd-base dark:bg-bd-base-dark flex-shrink-0" />
              <span className="text-xs text-fg-muted dark:text-fg-muted-dark w-9 text-center tabular-nums select-none">
                {swatchCount}
              </span>
              <div className="w-px h-4 bg-bd-base dark:bg-bd-base-dark flex-shrink-0" />
              <button
                onClick={() => updateProjectStepCount(stepCount + 1)}
                disabled={stepCount >= MAX_STEPS}
                className="w-7 h-7 flex items-center justify-center text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-base-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
              >+</button>
            </div>
            <div className="w-px h-4 bg-bd-base dark:bg-bd-base-dark flex-shrink-0" />
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
            <div className="w-px h-4 bg-bd-base dark:bg-bd-base-dark flex-shrink-0" />
            <button
              onClick={() => setShowExport(true)}
              className="text-sm font-medium px-3 py-1 rounded-lg bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark text-fg-inverted dark:text-fg-inverted-dark hover:bg-surface-neutral-strong-hover dark:hover:bg-surface-neutral-strong-hover-dark transition-colors"
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
