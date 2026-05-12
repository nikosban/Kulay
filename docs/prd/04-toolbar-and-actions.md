# PRD: Toolbar & Actions

## Overview
The floating toolbar is the primary control surface for project-level settings but has several usability gaps: the background input lacks context, the Export action has no keyboard shortcut, dark mode palettes aren't generated proactively, the toolbar can obscure content on short screens, and the color adder gives no visual feedback before committing.

---

## Tasks

### A. Background input label
- [ ] In `ProjectScreen.tsx`, inside the `CompactBgInput` wrapper div in the floating toolbar, add a label above or beside the swatch+hex input
- [ ] The label reads `"Light bg"` when `!isDark` and `"Dark bg"` when `isDark`
- [ ] Style: `text-[9px] text-fg-placeholder dark:text-fg-placeholder-dark uppercase tracking-wide select-none`
- [ ] The label and swatch+hex should be stacked vertically (flex-col) within the bordered container so the container grows slightly in height
- [ ] Verify both light and dark mode show the correct label when toggling the theme toggle

### B. Cmd+E / Ctrl+E keyboard shortcut for Export
- [ ] In `ProjectScreen.tsx`, add a `useEffect` that registers a `keydown` listener on `document`
- [ ] When `(e.metaKey || e.ctrlKey) && e.key === 'e'` fires and `palettes.length > 0`, call `setShowExport(true)` and `e.preventDefault()`
- [ ] Remove the listener on unmount
- [ ] Add a small keyboard shortcut hint to the Export button label: `"Export ⌘E"` on Mac, `"Export Ctrl+E"` on non-Mac (detect via `navigator.platform` or `navigator.userAgent`)

### C. Auto-generate dark palette on theme switch
- [ ] In `switchProjectPaletteMode()` in `useProjectStore.ts`, when switching to `'dark'`, check each palette: if `palette.modes.dark === null`, call `generateDarkMode(palette, backgrounds, lRange)` before switching
- [ ] This replaces the current behavior where `dark` mode is shown with null and relies on a separate explicit action
- [ ] Show a brief non-blocking toast: `"Dark palettes generated."` (only if at least one palette had no dark mode yet)
- [ ] Verify: toggling the theme toggle in the project screen for the first time generates dark steps for all palettes before switching the view

### D. Prevent toolbar from covering last content row
- [ ] In `ProjectScreen.tsx`, add `pb-20` to both the `ColorTable` scroll container and the palette detail view flex container
- [ ] The `pb-20` (80px) provides enough clearance for the floating toolbar (approx 44px tall) plus a 36px margin
- [ ] Verify on a viewport of 700px height that the last row of the color table is fully scrollable into view above the toolbar

### E. Live color swatch preview in the sidebar hex adder
- [ ] In `ProjectSidebar.tsx`, add state: `adderPreview: string | null` (null = no valid hex typed yet)
- [ ] On every `onChange` of the hex input, call `sanitizeHex(adderValue)`:
  - If valid: set `adderPreview` to the resolved hex
  - If not: set `adderPreview` to null
- [ ] Render a small color swatch (12×12px, rounded, same border style as `CompactBgInput`) inside the adder row, to the left of the `#` prefix
  - When `adderPreview` is not null: swatch has `backgroundColor: adderPreview`
  - When null: swatch has a dashed border and `bg-surface-neutral-subtle` background (placeholder state)
- [ ] The swatch does not affect the commit logic — Enter/blur still calls `commitAdd(adderValue)` unchanged

---

## Acceptance Criteria

- The background input in the floating toolbar shows "Light bg" or "Dark bg" text depending on the current theme, and the correct label is always visible without hovering
- Pressing Cmd+E (Mac) or Ctrl+E (Windows/Linux) on the project screen opens the Export modal when at least one palette exists; it does nothing on the library screen
- The Export button shows a keyboard shortcut hint (⌘E or Ctrl+E) in its label
- Switching from light to dark mode on a project where no dark palettes exist auto-generates dark mode steps for all palettes before the view switches
- On a 700px tall viewport, scrolling the color table to the last row brings it fully into view above the toolbar with no overlap
- Typing a valid hex string in the sidebar adder immediately shows a correctly-colored swatch to the left of the `#` character
- Typing an invalid string shows a neutral placeholder swatch, not the previous valid color
- No regression: the adder still closes on Escape and commits on Enter; the toolbar layout is unchanged at normal (1080p+) viewport heights
