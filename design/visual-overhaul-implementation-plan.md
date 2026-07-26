# Rolodexian Visual Overhaul — Implementation Plan

## Objective

Implement the approved retrofuturist command-center visual direction across the
existing React application while preserving all current contact, relationship,
image-upload, graph, and persistence behavior.

The approved mockups are:

- `design/mockups/01-personnel-index.png`
- `design/mockups/02-contact-dossier.png`
- `design/mockups/03-relationship-network.png`
- `design/mockups/04-record-input-console.png`

## Design principles

1. **Operational, not ornamental.** Dense telemetry and framing must strengthen
   hierarchy, status recognition, and navigation.
2. **Color has meaning.**
   - Hazard orange: structure, navigation, active controls, panel frames.
   - Phosphor green: verified, connected, current, or strong.
   - Signal red: weak/stale relationships, faults, destructive actions.
   - Amber: moderate strength, warnings, unsaved state.
   - Violet: sparse focus or selected-node accent.
3. **Typography has two jobs.**
   - Condensed industrial display face for page and panel headings.
   - Monospace face for data, controls, labels, and telemetry.
4. **CRT effects remain restrained.** Scanlines, bloom, noise, and vignette must
   never reduce text legibility or interaction clarity.
5. **Responsive behavior is a first-class requirement.** Desktop operational
   rails collapse into a linear, touch-friendly layout on narrow screens.
6. **No franchise assets.** Do not use copied logos, insignia, characters, or
   exact interface layouts from the visual references.

## Scope

### In scope

- Shared application shell and navigation
- Personnel/contact index
- Contact cards
- Contact dossier
- Contact editor
- Relationship graph and graph HUD
- Forms, buttons, meters, modals, tags, image tiles, timelines, and empty/error
  states
- Desktop, tablet, and mobile responsive states
- Reduced-motion support
- Visual regression screenshots

### Out of scope

- Database or API schema changes
- Contact/relationship feature changes
- Authentication or encryption implementation
- Replacing the existing graph library
- Deployment
- Changes to existing unrelated edits in `.env.example`, `README.md`, or
  `server/index.js`

## Current-state constraints

- The worktree already contains user changes in `.env.example`, `README.md`, and
  `server/index.js`. They must be preserved and left untouched.
- The generated mockups and design documentation under `design/` are intentional
  additions.
- The application uses React, React Router, Three.js, and
  `react-force-graph-3d`.
- The current interface already has CRT and terminal motifs, but its system is
  overwhelmingly green and lacks the approved page-level operational rails.

## Implementation phases

### Phase 1 — Establish the design-system foundation

Primary files:

- `src/styles.css`
- `src/App.tsx`

Tasks:

1. Replace the current green-first tokens with semantic command-center tokens:
   background, panel, orange frame, green live, amber warning, red danger,
   violet focus, text, muted text, and line variants.
2. Add display and data font stacks using locally available/system fonts.
3. Define reusable geometry and effects:
   - Chamfered panel corners
   - Double-line frames
   - Registration ticks
   - Segmented meters
   - Subtle scanlines/noise
   - Focus and hover states
4. Replace the prominent Matrix-style falling glyph background with a restrained
   technical grid/data-field treatment.
5. Rework the global header into the approved compact product chrome:
   `ROLODEXIAN`, `PERSONNEL`, `RELATION MAP`, local-vault status, encryption
   status, and clearance indicator.
6. Add consistent page subtitles, status labels, and command bars.
7. Add `prefers-reduced-motion` behavior for background animation, hover
   movement, bloom, and graph particles where possible.

Acceptance criteria:

- Shared chrome visually matches the mockup family.
- Orange is the dominant structural color; green is reserved for data/status.
- Keyboard focus states remain obvious.
- Body copy and form labels meet practical contrast and legibility standards.
- No functional navigation changes.

### Phase 2 — Implement the Personnel Index

Primary files:

- `src/pages/ContactsPage.tsx`
- `src/components/ContactCard.tsx`
- `src/components/Avatar.tsx`
- `src/components/StrengthMeter.tsx`
- `src/styles.css`

Tasks:

1. Rename presentation labels from generic “Contacts / People” to
   “Personnel Index” while retaining existing routes and data calls.
2. Introduce a desktop operational rail containing:
   - Search
   - Relationship filters
   - Visible relationship counts
   - System summary
3. Keep the main contact area as a responsive dossier-card grid.
4. Restyle each card to include:
   - Record/status line
   - Identification scan/avatar
   - Name and relationship type
   - Last interaction and social counts
   - Segmented strength meter
   - Edit action
5. Encode relationship strength semantically:
   - Strong: green
   - Moderate: amber
   - Weak: red
6. Preserve search, filtering, navigation, loading, error, and empty-state
   behavior.

Acceptance criteria:

- Desktop closely matches `01-personnel-index.png`.
- Search and relationship filtering still work.
- Cards remain usable from 320 px through wide desktop.
- No data fields are removed.

### Phase 3 — Implement the Contact Dossier

Primary files:

- `src/pages/ContactDetailPage.tsx`
- `src/components/Avatar.tsx`
- `src/components/StrengthMeter.tsx`
- `src/styles.css`

Tasks:

1. Reframe the header as an active contact dossier with record ID and status.
2. Convert the summary band into compact telemetry cells.
3. Preserve and restyle:
   - Notes and traits
   - Social accounts
   - Interaction timeline
   - Relationships
   - Appearance
   - Preferences
   - Images
   - Custom fields
4. Make the profile image feel like an identification scan without altering
   image upload behavior.
5. Style relationship rows and meters with strength-dependent colors.
6. Restyle the add/edit relationship modal using the same command-center
   geometry and status language.
7. Keep destructive actions clearly red and visually separated from ordinary
   controls.

Acceptance criteria:

- Desktop hierarchy closely matches `02-contact-dossier.png`.
- All edit, delete, upload, social-link, and relationship operations still work.
- Long text, missing images, missing fields, and large tag sets do not break the
  layout.

### Phase 4 — Implement the Record Input Console

Primary files:

- `src/pages/ContactEditPage.tsx`
- `src/components/ContactForm.tsx`
- `src/styles.css`

Tasks:

1. Reframe create/edit pages as a “Record Input Console.”
2. Add a desktop section navigator for:
   - Profile
   - Appearance
   - Social Accounts
   - Interactions
   - Preferences
   - Notes
3. Add stable section IDs and accessible in-page navigation.
4. Add a non-blocking diagnostic/preview rail showing:
   - Current record identity
   - Relationship classification
   - Completion state
   - Local validation indicators
5. Keep the form state architecture intact; preview data should be derived from
   the same current form state rather than duplicated state.
6. If necessary, lift form state or add a controlled change callback so the
   preview remains live without changing submission behavior.
7. Convert the save area into a sticky command bar with a prominent commit
   action.
8. Ensure all input, select, textarea, range, add-row, remove-row, and date
   controls remain keyboard accessible.

Acceptance criteria:

- Desktop hierarchy closely matches `04-record-input-console.png`.
- Both create and edit flows submit successfully.
- Dynamic social-account and interaction rows still add and remove correctly.
- Section navigation does not obscure headings beneath the sticky header.
- Mobile presents a linear form without sticky rails consuming the viewport.

### Phase 5 — Implement the Relationship Network Console

Primary files:

- `src/pages/GraphPage.tsx`
- `src/styles.css`

Tasks:

1. Reframe the page as “Relationship Network / Local Social Topology.”
2. Add a left diagnostics rail containing:
   - Node/edge summary
   - Strength distribution
   - Selected/hovered record
3. Add a right diagnostics rail containing:
   - Strength legend
   - Camera state
   - Network metrics
4. Keep the existing Three.js graph and bounded-orbit behavior.
5. Update graph rendering:
   - Orange grid and structural rings
   - Reticle-like nodes
   - Green strong links
   - Amber moderate links
   - Red weak links
   - Violet selected/focus accent
   - Reduced bloom and controlled particles
6. Ensure hovered and selected nodes remain readable.
7. Preserve node-click navigation to contact dossiers.
8. Collapse diagnostics rails below or above the graph at tablet/mobile widths.

Acceptance criteria:

- Desktop composition closely matches `03-relationship-network.png`.
- The graph loads, rotates, zooms within bounds, highlights links, and navigates
  on node click.
- Link strength is legible without relying on color alone; retain thickness,
  labels, or legend support.
- The graph remains usable on touch devices.

### Phase 6 — Responsive and accessibility pass

Primary file:

- `src/styles.css`

Tasks:

1. Verify layouts at approximately:
   - 1440×900
   - 1280×800
   - 1024×768
   - 768×1024
   - 390×844
2. Collapse operational rails in a deliberate order.
3. Maintain 44 px touch targets where practical.
4. Verify visible focus, logical tab order, heading hierarchy, form labels,
   modal focus behavior, and status semantics.
5. Ensure decorative overlays use `pointer-events: none`.
6. Disable or reduce nonessential motion for `prefers-reduced-motion`.
7. Check overflow with long names, handles, notes, dates, and custom-field keys.

Acceptance criteria:

- No horizontal page overflow at 320 px.
- Critical controls are reachable without hover.
- Text remains readable above decorative effects.
- Responsive screenshots retain the same visual identity.

### Phase 7 — Verification and cleanup

Commands and tools:

- `npm run check`
- `npm run build`
- `npm run seed` if demo data is absent
- `npm run dev`
- Playwright CLI visual inspection and screenshots

Tasks:

1. Run TypeScript checking and the production build.
2. Start the API and Vite application.
3. Verify these flows in a real browser:
   - Personnel search
   - Relationship filter
   - Open dossier
   - Edit and save contact
   - Add/remove social account row
   - Add/remove interaction row
   - Open relationship modal
   - Navigate to graph
   - Hover and click graph nodes
4. Capture final screenshots under `output/playwright/`:
   - Personnel Index desktop
   - Contact Dossier desktop
   - Record Input Console desktop
   - Relationship Network desktop
   - Personnel Index mobile
   - Contact Dossier mobile
5. Compare screenshots against the four approved mockups.
6. Fix visual regressions, overflow, illegible states, and console errors.
7. Review the final diff and confirm unrelated user changes were not modified.

Acceptance criteria:

- TypeScript check passes.
- Production build passes.
- Core browser flows pass.
- No new console errors are introduced.
- Final screenshots demonstrate a cohesive match to the approved direction.
- Only intended source and design files are changed.

## Recommended execution order

1. Shared tokens and application shell
2. Personnel Index
3. Contact Dossier
4. Record Input Console
5. Relationship Network
6. Responsive/accessibility pass
7. Build and browser verification

This order minimizes rework: the shared foundation is stabilized first, ordinary
data surfaces establish the component language next, and the graph—the most
specialized surface—is adapted only after the system is consistent.

## Verification checklist

- [x] Existing unrelated worktree changes preserved
- [x] Shared semantic tokens implemented
- [x] Global navigation matches approved chrome
- [x] Personnel rail and dossier grid implemented
- [x] Dossier panels and relationship modal implemented
- [x] Editor section rail and live diagnostics implemented
- [x] Graph diagnostics and strength encoding implemented
- [x] 320 px layout has no horizontal overflow
- [x] Reduced-motion mode verified
- [x] Keyboard focus states verified
- [x] `npm run check` passes
- [x] `npm run build` passes
- [x] Core browser flows verified
- [x] Final desktop and mobile screenshots captured

## Completion evidence

Completed and audited on July 24, 2026.

- A second native-viewport fidelity pass rebuilt the four desktop compositions
  against the 1680x945 mockups: 3x2 Personnel cards, three-column Dossier,
  scan/form/diagnostics Editor, full-frame Network, and per-screen telemetry
  command bars.
- Personnel pagination preserves access to all eight records while maintaining
  the six-record workstation composition shown in the reference.
- `npm run check` passes.
- `npm run build` passes. Vite reports only its non-blocking large-chunk
  advisory for the existing Three.js graph bundle.
- Fresh Microsoft Edge sessions reported zero console errors on the Personnel
  Index, Contact Dossier, Record Input Console, and Relationship Network. The
  remaining console notice is React Router's future-flag advisory.
- Search, relationship filtering, dossier navigation, contact editing and
  saving, dynamic social/interaction rows, modal opening and Escape dismissal,
  graph hover, graph-node navigation, bounded orbit, and wheel zoom were
  exercised in the browser.
- Contact creation, profile-image upload/delete, and relationship
  create/edit/delete were verified with clearly labeled temporary QA records.
  The temporary records and uploads were removed through the application
  immediately afterward; the archive returned to its original eight records.
- The relationship modal now moves focus into the dialog, loops keyboard focus,
  closes with Escape, and restores focus to its trigger.
- Reduced-motion handling covers CSS animation/transition suppression plus
  graph particle, bloom, and camera-transition suppression.
- Horizontal-overflow checks passed at 1280×800, 1024×768, 768×1024, 390×844,
  and at the 320 px floor for all four core routes.
- Unrelated staged changes in `.env.example`, `README.md`, and
  `server/index.js` were not modified by this implementation.

Final screenshots:

- `output/playwright/personnel-index-desktop.png`
- `output/playwright/contact-dossier-desktop.png`
- `output/playwright/record-input-console-desktop.png`
- `output/playwright/relationship-network-desktop.png`
- `output/playwright/relationship-editor-responsive.png`
- `output/playwright/personnel-index-mobile.png`
- `output/playwright/contact-dossier-mobile.png`

## Definition of done

The overhaul is complete when all four core screens visually form one coherent
command-center product, retain their existing behavior, pass the build and
browser checks, work at desktop and mobile widths, and satisfy every acceptance
criterion above without modifying unrelated user work.
