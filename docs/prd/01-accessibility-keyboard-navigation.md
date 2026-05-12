# PRD: Accessibility & Keyboard Navigation

## Overview
Kulay currently relies almost entirely on mouse interaction. Text inputs handle Enter/Escape but there is no keyboard path for navigating between steps, closing panels, or operating icon-only buttons accessibly. This PRD covers the changes needed to make the core workflow keyboard-operable and screen-reader-compatible.

---

## Tasks

### A. Arrow key navigation between steps
- [ ] In the palette detail view (when a palette is selected and steps are rendered as columns), attach a `keydown` listener to the step container
- [ ] `ArrowRight` moves focus to the next step and opens its detail panel
- [ ] `ArrowLeft` moves focus to the previous step and opens its detail panel
- [ ] Focus wraps at the ends (last step → first step, first step → last step)
- [ ] The focused step column receives a visible focus ring (e.g. 2px outline using `textColor` derived from its luminance)
- [ ] If the detail panel is already open for a step, arrow navigation updates both the panel and the focus

### B. Escape closes the step detail panel
- [ ] When the step detail panel is open and no text input inside it is active/focused, pressing `Escape` calls `onClose`
- [ ] Add a `useEffect` on the panel component with a `keydown` listener on `document` that fires `onClose` when `key === 'Escape'` and no input/textarea in the panel is focused
- [ ] This does not conflict with Escape cancelling edits inside individual inputs (those fire `stopPropagation` already)

### C. `aria-label` on all icon-only buttons
- [ ] Add `aria-label="Add color"` to the `+` icon button in the sidebar header
- [ ] Add `aria-label="Close"` to the `×` button in the step detail panel header
- [ ] Add `aria-label="Delete palette"` to each trash icon in the sidebar palette list
- [ ] Add `aria-label="Rename"` and `aria-label="Delete project"` to the project card hover buttons
- [ ] Add `aria-label="Switch to dark mode"` / `aria-label="Switch to light mode"` to the theme toggle (dynamic based on current state)
- [ ] Verify no icon-only interactive element is left with only a `title` attribute

### D. `role="dialog"` and `aria-modal` on modals
- [ ] Add `role="dialog"` and `aria-modal="true"` to the root element of `ExportModal`
- [ ] Add `role="dialog"` and `aria-modal="true"` to the root element of `ConfirmLeaveModal`
- [ ] Add `aria-labelledby` pointing to the modal's heading element in each case
- [ ] Add `aria-labelledby` to `NewProjectModal` as well

### E. Focus trap in modals
- [ ] When a modal opens, focus is moved to the first focusable element inside it
- [ ] Tab and Shift+Tab cycle only through focusable elements within the modal
- [ ] When the modal closes, focus returns to the element that triggered it
- [ ] Implement as a small reusable `useFocusTrap(ref, isOpen)` hook used by all three modals

### F. Range slider labels
- [ ] Add `aria-label="Lightest"` to the lightest lightness range slider in `StepDetailPanel`
- [ ] Add `aria-label="Darkest"` to the darkest lightness range slider in `StepDetailPanel`

---

## Acceptance Criteria

- A user can navigate from the "All colors" table into a palette detail view and move through every step using only the keyboard (Tab to enter, ArrowLeft/Right to move between steps)
- Pressing Escape while the step detail panel is open (with no active input) closes the panel
- All icon-only buttons are announced correctly by VoiceOver / NVDA with a meaningful label
- Opening ExportModal or ConfirmLeaveModal with VoiceOver active announces the dialog role and label
- Tab key cannot leave a modal while it is open
- When a modal closes, focus returns to the triggering button
- Range sliders in the step detail panel are announced with their label and current value by a screen reader
- No regression: existing Enter/Escape behavior in text inputs is unchanged
