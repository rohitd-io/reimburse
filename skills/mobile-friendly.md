# Skill: Always Mobile Friendly and Responsive UI

Ensure all UI views, pages, and components in the application are designed with a mobile-first, fully responsive layout.

## Objective
The application must render perfectly on all screen sizes, from mobile phones (down to 320px wide) to large desktops, with no horizontal scrolling or broken layouts.

## Guidelines

### 1. Viewport & Layouts
- Use relative units like `rem`, `em`, `vh`, `vw`, or percentage values instead of hardcoded pixel sizes for component widths.
- Ensure layouts wrap gracefully. Use CSS Flexbox (`flex-wrap: wrap`) or CSS Grid (`grid-template-columns: repeat(auto-fit, minmax(..., 1fr))`) to handle column stacking automatically.

### 2. Media Queries
- Implement media queries in `globals.css` or component-specific stylesheets to handle changes in layout at typical breakpoints (e.g., `max-width: 768px` for mobile/tablet).
- In mobile viewports:
  - Stack multi-column grids (`grid-template-columns: 1fr !important`).
  - Stack side-by-side buttons or controls vertically (`flex-direction: column !important`).
  - Set buttons to take full width (`width: 100%`) for easy tap targets.

### 3. Touch Targets & Spacing
- Ensure all interactive elements (buttons, inputs, select fields) have a minimum height/width of `44px` or `2.75rem` for comfortable touch interaction on mobile devices.
- Provide ample spacing between form controls (`gap: 1rem` or `margin-bottom: 1rem`) to prevent accidental taps.

### 4. Text & Images
- Use scalable font sizes. Adjust headings (`h1`, `h2`, `h3`) down on mobile screens (e.g., using media queries).
- All images must use `max-width: 100%` and `height: auto` to prevent them from overflowing their containers.

### 5. Verification
- Test all UI changes using the browser's developer tools in responsive design mode.
- Verify layouts down to `320px` width.
- Ensure no horizontal scrollbar appears on the main document body.
