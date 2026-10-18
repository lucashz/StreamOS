---
name: frontend-ui-engineering
description: Builds and refactors production-quality, accessible, responsive user-facing UIs. Use when auditing, polishing segments, adjusting CSS/box-sizing/parameters, fixing UI flaws, verifying component functions, meeting responsive breakpoints, or eliminating generic AI aesthetic bugs.
---

# Frontend UI Engineering & Systematic Polish

## Overview

Build and polish production-quality user interfaces that are accessible, performant, visually cohesive, and functionally robust. The goal is UI that looks like it was built by a senior design-aware engineer — eliminating layout overflows, unaligned box sizes, broken CSS parameters, unhandled interaction states, and generic AI aesthetic flaws.

## Core Directives

### 1. Systematic Box Sizing & Layout Constraints
- **Box model consistency:** Ensure `box-sizing: border-box` is respected across all containers, inputs, buttons, and cards.
- **Prevent overflow:** Guard all flex and grid items with `min-width: 0` / `min-height: 0` and `overflow-wrap: break-word` to eliminate unexpected horizontal scrolls.
- **Card and container alignment:** Use CSS Grid or Flexbox with consistent `gap` and alignment rules. Don't let adjacent cards have uneven heights when they contain varying content lengths; use flex-grow or grid row alignment.
- **Viewport stability:** Avoid `100vh` on mobile web; use `100dvh` or `min-height: 100%` to prevent mobile address bar jumping.

### 2. Design System & CSS Token Adherence
- **Spacing scale:** Adhere strictly to the project's spacing scale (e.g., 4px/8px/12px/16px/24px/32px). Never inject random pixel values like `padding: 13px` or `margin: 27px`.
- **Typography hierarchy:** Respect heading levels (`h1` -> `h2` -> `h3` -> `body` -> `small`). Check font sizes, line heights, and letter spacing so labels remain legible at 320px without word truncations or awkward wrapping.
- **Color tokens & contrast:** Use semantic color tokens (`--surface`, `--border`, `--text`, `--accent`) instead of hardcoded hex values. Ensure contrast ratio meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text).
- **Reject AI Aesthetic defaults:** Avoid gratuitous purple/indigo gradients, oversized border-radii (`rounded-3xl` on small badges), excessive layered box-shadows, and template card grids.

### 3. Functional Verification & States
- **Full lifecycle states:** Every segment/component must explicitly handle:
  - Default / Idle
  - Hover / Focus-visible
  - Active / Pressed
  - Loading / Pending (with skeleton or discreet spinner)
  - Success state
  - Empty state (with helpful call-to-action)
  - Error state (with readable error message and retry action)
  - Disabled state (with clear visual cue and disabled pointer events)
- **Form parameters & validation:** Verify input parameters, boundary numbers (min, max, step), character limits, sanitize inputs, and validate error messages.
- **Interactive keyboard navigation:** Every clickable control must be focusable via `Tab` and triggerable via `Enter` or `Space`.

### 4. Responsive Breakpoint Matrix
Test and polish every segment across:
- **Mobile (320px - 390px):** Single-column flows, touch-friendly tap targets (min 44x44px), zero horizontal overflow.
- **Tablet (768px):** Balanced multi-column cards, readable line lengths.
- **Desktop (1024px - 1366px):** Standard dashboard/content views with sidebars and modals aligned.
- **Wide (1440px - 1920px):** Max container width constraint (`max-width`) preventing stretched content.

## Step-by-Step Polish Audit Workflow

1. **Segment Inventory:** List every distinct page, modal, card group, and form in the target area.
2. **Defect Inspection:**
   - Visual: layout shifts, box padding misalignments, overflowing text, inconsistent borders.
   - Functional: broken event handlers, missing loading feedback, unhandled rejection in async calls, stale state.
3. **Targeted Refactor:**
   - Adjust CSS rules and component props one segment at a time.
   - Normalize box dimensions, padding, margins, and flex/grid rules.
4. **Verification & Proof:**
   - Typecheck & linter pass.
   - Responsive inspection at desktop and mobile widths.
   - Functional click-through test.

