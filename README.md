# Kalico Ringing Simulator

A high-performance, browser-based diagnostic tool for visualizing mechanical vibration (ringing) and input shaper smoothing in 3D printers. 

## Overview

In FDM 3D printing, rapid acceleration and deceleration at corners cause the printer's physical frame and belts to vibrate like a spring. This mechanical oscillation manifests as "ringing" or "ghosting" on the walls of your printed parts. 

While **Input Shapers** (like MZV, EI) can successfully cancel out this ringing by splitting the motor commands into delayed impulses, they introduce a tradeoff: corner smoothing. 

The Kalico Ringing Simulator accurately visualizes both of these phenomena by running a mathematical **Mass-Spring-Damper** physics simulation overlaid with Klipper-style kinematics and Input Shapers.

## Features

* **Real-time Physics Simulation:** Adjust mechanical frequency, damping ratio, and belt tension (peak width) to see exactly how your printer behaves dynamically.
* **Input Shaper Comparison:** Select between standard Klipper input shapers (`mzv`, `ei`, `2hump_ei`, `3hump_ei`) to visually observe how well they cancel ringing, and exactly how much they round the corners.
* **Accurate Spatial Deviation:** The simulator's heatmap mathematically eliminates temporal tracking lag (group delay) to exclusively highlight true geometric deviation (perpendicular ringing wobble and corner cutting). 
* **High-Performance 3D Waterfall View:** Hardware-accelerated wireframe rendering allows you to visualize variable resonant frequencies ("Peak Width") without dropping frames.
* **Dynamic Heatmap Tuning:** Calibrate the heatmap threshold (e.g., `0.02mm` to `0.5mm`) to visually isolate the physical magnitude of error that is unacceptable for your specific aesthetic requirements.

## Getting Started

Because the simulator runs entirely client-side in the browser, no installation or compilation is required.

1. Clone or download this repository.
2. Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari).
3. Adjust the sliders in the control panel to match your 3D printer's measured resonances (via ADXL345 or manual tuning).

## How to Interpret the Heatmap

The color of the toolpath represents the physical tracking error (in millimeters) of the toolhead compared to the ideal geometric path:

* 🟦 **Cyan:** 0 error. The toolhead is perfectly tracing the line.
* 🟨 **Yellow:** 50% of your configured `Heatmap Max Error`.
* 🟥 **Red:** 100%+ of your configured `Heatmap Max Error`. 

**Why did my corners turn red?**
If you apply an Input Shaper, the straight lines will remain Cyan, but the corners will turn Yellow or Red. This is the **Smoothing Error**. The shaper intentionally cuts the corner slightly to avoid injecting violent kinetic energy into the frame.

## Advanced Math & Physics
Curious about how the simulator perfectly subtracts the shaper's group delay and the physical viscous tracking lag? Check out [PHYSICS.md](PHYSICS.md) for an in-depth breakdown of the math driving the visualization.

## License
MIT License
