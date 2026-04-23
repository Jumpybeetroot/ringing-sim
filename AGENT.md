# AI Agent Instructions (ringing-sim)

Hello, fellow AI coding assistant! If you are reading this, you are working on the **Kalico Ringing Simulator**. This file contains critical architectural rules and mathematical context to prevent regressions in this codebase. Read this carefully before modifying any code.

## 1. Tech Stack & Philosophy
* **Pure Vanilla:** This project uses vanilla HTML, CSS, and JavaScript. 
* **No Frameworks:** DO NOT introduce React, Vue, Svelte, TailwindCSS, or any build tools (Webpack/Vite). The app must be able to run by simply opening `index.html` in a browser.
* **Performance First:** The 3D view renders thousands of polygons. Any changes to `render.js` must prioritize framerate. Avoid `ctx.fill()` for overlapping transparent layers (use `Path2D` strokes instead).

## 2. Architecture
The project is strictly separated into three domains:
1. **`app.js` (UI & State):** Reads sliders, formats text, and orchestrates the simulation/render loop.
2. **`sim.js` (Physics):** Pure math. Generates ideal toolpaths and applies Input Shaper convolutions and Mass-Spring-Damper differential equations. It does NOT know about pixels or rendering.
3. **`render.js` (Graphics):** Pure Canvas API. It receives raw simulation data, applies coordinate transformations (pan, zoom, isometric projection), and draws the heatmap.

## 3. Mathematical "Gotchas" (CRITICAL)

### A. Spatial vs Temporal Error
DO NOT calculate tracking error as the simple Euclidean distance between the ideal target and the physical toolhead at time `t`. Because Input Shapers introduce a "Group Delay" and springs introduce viscous lag, the toolhead is *always* temporally late.

* **The Rule:** Error MUST be calculated as **Perpendicular Deviation**.
* **The Math:** `sim.js` exports the geometric Tangent Vector (`dir_x, dir_y`) of the path. You must take the dot product of the raw error vector against this tangent to find the "Tangential Lag", and then subtract it using the Pythagorean theorem. 
* **Reference:** See `PHYSICS.md` for the exact formulas.

### B. Canvas Y-Axis Inversion
The physics engine operates in a standard Cartesian plane (Y goes UP). 
The HTML Canvas API operates in screen-space (Y goes DOWN).
* DO NOT invert the Y-axis inside the physics engine.
* DO NOT perform error/vector math using pixel coordinates, because the inverted Y-axis will destroy the dot product calculations.
* **The Rule:** All geometric error math (calculating deviations) must be performed on the raw `this.lastData` arrays *before* the coordinates are projected into pixel space by the camera.

## 4. Modifying the UI
When adding new sliders to `index.html`:
1. Add the `<input>` slider.
2. Add the corresponding `<span>` for the value display.
3. Map both elements in the `els` and `displays` objects at the top of `app.js`.
4. Ensure `handleInput()` extracts the value and passes it into the `config` object for the simulator.
