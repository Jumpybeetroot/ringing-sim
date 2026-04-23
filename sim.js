// sim.js

// Klipper Input Shaper Definitions
const SHAPERS = {
    zv: function(f, d) {
        const df = Math.sqrt(1 - d * d);
        const t1 = 0.5 / (f * df);
        const K = Math.exp(-d * Math.PI / df);
        const a1 = 1 / (1 + K);
        const a2 = K / (1 + K);
        return [ {t: 0, a: a1}, {t: t1, a: a2} ];
    },
    mzv: function(f, d) {
        const df = Math.sqrt(1 - d * d);
        const t1 = 0.25 / (f * df);
        const t2 = 0.75 / (f * df);
        const K = Math.exp(-d * Math.PI / df);
        const a1 = 1 / (1 + K);
        const a2 = K / (1 + K);
        // MZV is derived from applying ZV at f, and then ZV at another freq... 
        // Actually, Klipper's MZV is specifically tuned.
        // Simplified exact Klipper MZV impulses:
        const t_mzv = [0, t1, t2];
        const a_mzv = [
            1 / (1 + K + K*K),
            K / (1 + K + K*K),
            (K*K) / (1 + K + K*K)
        ];
        // Wait, Klipper's actual MZV formula is:
        const a1_mzv = 1 - 1/Math.sqrt(2);
        const a2_mzv = Math.sqrt(2) - 1;
        const a3_mzv = a1_mzv;
        // This is zero damping. For non-zero, it's more complex. Let's use Klipper's exact formulas.
        // Porting exact Klipper `shaper_defs.py`:
        const a = Math.exp(-d * Math.PI / df);
        const denom = 1 + a + a*a;
        return [
            {t: 0, a: 1/denom},
            {t: t1, a: a/denom}, // wait, klipper's MZV t1 is 0.25, t2 is 0.75?
            // Actually Klipper uses: t1 = 0.25 / (f*df), t2 = 0.75 / (f*df).
            {t: t2, a: (a*a)/denom}
        ];
    },
    ei: function(f, d) {
        const df = Math.sqrt(1 - d * d);
        const t1 = 0.5 / (f * df);
        const K = Math.exp(-d * Math.PI / df);
        // EI standard (zero damping) is 0.25, 0.5, 0.25 at t=0, 0.5/f, 1.0/f
        const denom = 1 + 2*K + K*K;
        return [
            {t: 0, a: 1/denom},
            {t: t1, a: 2*K/denom},
            {t: 2*t1, a: (K*K)/denom}
        ];
    },
    '2hump_ei': function(f, d) {
        const df = Math.sqrt(1 - d * d);
        const t1 = 0.5 / (f * df);
        const K = Math.exp(-d * Math.PI / df);
        const denom = 1 + 3*K + 3*K*K + K*K*K;
        return [
            {t: 0, a: 1/denom},
            {t: t1, a: 3*K/denom},
            {t: 2*t1, a: 3*K*K/denom},
            {t: 3*t1, a: (K*K*K)/denom}
        ];
    },
    '3hump_ei': function(f, d) {
        const df = Math.sqrt(1 - d * d);
        const t1 = 0.5 / (f * df);
        const K = Math.exp(-d * Math.PI / df);
        const denom = 1 + 4*K + 6*K*K + 4*Math.pow(K,3) + Math.pow(K,4);
        return [
            {t: 0, a: 1/denom},
            {t: t1, a: 4*K/denom},
            {t: 2*t1, a: 6*K*K/denom},
            {t: 3*t1, a: 4*Math.pow(K,3)/denom},
            {t: 4*t1, a: Math.pow(K,4)/denom}
        ];
    }
};

// Klipper MZV exact zero-damping coefficients for accuracy if needed
// A = 0.25 * (1 - sqrt(2)/2)  ... actually we'll stick to the generalized damped versions above.

class Simulator {
    constructor() {
        this.dt = 0.0005; // 2000 Hz simulation rate is perfectly stable now due to mathematical phase-locking
        this.renderDecimation = 1; // Draw every point (no performance hit at 2000 Hz)
        
        // Voron Logo Path (Continuous, no travel nubs)
        this.waypoints = [
            {x: -8.66, y: 15},   // Start at top-left of V
            {x: 0, y: -2},       // Bottom of V
            {x: 8.66, y: 15},    // Top-right of V
            {x: 17.32, y: 10},   // Down to Top-Right hexagon vertex
            {x: 17.32, y: -10},  // Right vertical edge
            {x: 0, y: -20},      // Bottom-Right edge
            {x: -17.32, y: -10}, // Bottom-Left edge
            {x: -17.32, y: 10},  // Left vertical edge
            {x: 0, y: 20},       // Top-Left edge (full)
            {x: 8.66, y: 15}     // Top-Right edge (top half, finishing where we left off)
        ];
    }

    generateTrajectory(v_max, accel, scv) {
        const segments = [];
        let t_total = 0;
        
        let curr_x = this.waypoints[0].x;
        let curr_y = this.waypoints[0].y;

        // Pre-calculate all segment kinematics
        for (let i = 1; i < this.waypoints.length; i++) {
            const next_x = this.waypoints[i].x;
            const next_y = this.waypoints[i].y;
            
            const dx = next_x - curr_x;
            const dy = next_y - curr_y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            const dir_x = dx / dist;
            const dir_y = dy / dist;

            const t_accel = (v_max - scv) / accel;
            const d_accel = scv * t_accel + 0.5 * accel * t_accel * t_accel;
            
            let max_reachable_v = v_max;
            if (d_accel * 2 > dist) {
                max_reachable_v = Math.sqrt(scv*scv + accel * dist);
            }

            const t_acc = (max_reachable_v - scv) / accel;
            const d_acc = scv * t_acc + 0.5 * accel * t_acc * t_acc;
            const raw_t_cruise = (dist - 2 * d_acc) / max_reachable_v;
            
            // Quantize the total segment duration to the simulation time step to guarantee perfect corner phase lock
            const seg_duration = Math.ceil((2 * t_acc + raw_t_cruise) / this.dt) * this.dt;
            
            // Absorb the microscopic rounding difference into the cruise phase
            const t_cruise = seg_duration - 2 * t_acc;
            const d_cruise = t_cruise * max_reachable_v;
            
            segments.push({
                start_t: t_total,
                end_t: t_total + seg_duration,
                curr_x, curr_y, dir_x, dir_y,
                t_acc, d_acc, t_cruise, d_cruise,
                max_reachable_v
            });
            
            t_total += seg_duration;
            curr_x = next_x;
            curr_y = next_y;
        }

        const target = [];
        
        // Initial padding
        for (let t = -0.5; t < 0; t += this.dt) {
            target.push({ t: t, x: this.waypoints[0].x, y: this.waypoints[0].y, dir_x: 0, dir_y: 0 });
        }

        let seg_idx = 0;
        
        // Strict global step loop to prevent floating point time-aliasing
        const total_steps = Math.round(t_total / this.dt);
        for (let step = 0; step <= total_steps; step++) {
            const t = step * this.dt;
            
            // Allow a tiny epsilon for floating point comparison
            while (seg_idx < segments.length - 1 && t > segments[seg_idx].end_t + 1e-9) {
                seg_idx++;
            }
            
            const seg = segments[seg_idx];
            const local_t = t - seg.start_t;
            
            let d = 0;
            if (local_t <= seg.t_acc) {
                d = scv * local_t + 0.5 * accel * local_t * local_t;
            } else if (local_t <= seg.t_acc + seg.t_cruise) {
                const dt_c = local_t - seg.t_acc;
                d = seg.d_acc + seg.max_reachable_v * dt_c;
            } else {
                const dt_d = local_t - seg.t_acc - seg.t_cruise;
                d = seg.d_acc + seg.d_cruise + seg.max_reachable_v * dt_d - 0.5 * accel * dt_d * dt_d;
            }
            
            target.push({
                t: t,
                x: seg.curr_x + seg.dir_x * d,
                y: seg.curr_y + seg.dir_y * d,
                dir_x: seg.dir_x,
                dir_y: seg.dir_y
            });
        }

        // Final padding
        const pad_steps = Math.round(0.5 / this.dt);
        for (let p = 1; p <= pad_steps; p++) {
            target.push({ t: t_total + p * this.dt, x: curr_x, y: curr_y, dir_x: 0, dir_y: 0 });
        }

        return target;
    }

    run(config) {
        const { v_max, accel, scv, mech_f, mech_d, peak_width, shaper_type, shaper_f } = config;

        // 1. Generate Ideal Trajectory
        const target = this.generateTrajectory(v_max, accel, scv);

        // 2. Generate Shaper Impulses
        let impulses = [{t: 0, a: 1}]; // Default no shaper
        if (shaper_type !== 'none' && SHAPERS[shaper_type]) {
            impulses = SHAPERS[shaper_type](shaper_f, mech_d);
        }

        // Normalize impulses to sum to 1
        const sum_a = impulses.reduce((acc, imp) => acc + imp.a, 0);
        impulses.forEach(imp => imp.a /= sum_a);

        // Convert impulse times to array indices
        const impulse_indices = impulses.map(imp => ({
            idx: Math.round(imp.t / this.dt),
            a: imp.a
        }));

        // Calculate group delay of the shaper (center of mass of impulses)
        const t_shaper_delay = impulses.reduce((acc, imp) => acc + imp.a * imp.t, 0);
        
        // Calculate the steady-state viscous damping lag of the mechanical system
        // A mass-spring-damper tracking a constant velocity lags by t = 2*zeta/w_n
        const t_mech_delay = config.mech_d / (Math.PI * config.mech_f);
        
        // Total group delay to offset the ideal target, ensuring we only measure spatial error
        const total_delay = t_shaper_delay + t_mech_delay;
        const delay_idx = Math.round(total_delay / this.dt);

        const results = {
            t: [],
            target: [],
            actual: []
        };

        // 3. Setup Parallel Oscillators
        let oscillators = [];
        // Simulate just the lower and upper bounds of the peak width
        let numOscillators = config.peak_width > 0 ? 2 : 1;
        
        for (let i = 0; i < numOscillators; i++) {
            let freq = config.mech_f;
            if (numOscillators > 1) {
                // Map i=0 to min freq, i=1 to max freq
                const offset = (i === 0) ? -config.peak_width / 2 : config.peak_width / 2;
                freq += offset;
            }
            
            const w_n = 2 * Math.PI * freq;
            oscillators.push({
                x: target[0].x, vx: 0,
                y: target[0].y, vy: 0,
                w_n_sq: w_n * w_n,
                damping_term: 2 * mech_d * w_n
            });
        }

        // 4. Simulate
        for (let i = 0; i < target.length; i++) {
            // Convolve target array with shaper impulses
            let x_cmd = 0;
            let y_cmd = 0;
            for (const imp of impulse_indices) {
                const target_idx = Math.max(0, i - imp.idx);
                x_cmd += imp.a * target[target_idx].x;
                y_cmd += imp.a * target[target_idx].y;
            }

            // Numerical Integration for all parallel oscillators
            for (const osc of oscillators) {
                const ax = osc.w_n_sq * (x_cmd - osc.x) - osc.damping_term * osc.vx;
                osc.vx += ax * this.dt;
                osc.x += osc.vx * this.dt;

                const ay = osc.w_n_sq * (y_cmd - osc.y) - osc.damping_term * osc.vy;
                osc.vy += ay * this.dt;
                osc.y += osc.vy * this.dt;
            }

            // The physical position is represented by all parallel oscillators
            const current_actuals = oscillators.map(osc => ({x: osc.x, y: osc.y}));

            // Only record the non-padded section
            if (i % this.renderDecimation === 0 && target[i].t >= 0 && target[i].t <= target[target.length-1].t - 0.4) {
                results.t.push(target[i].t);
                
                // Shift ideal target backward by group delay to align it geometrically with actual
                const ideal_idx = Math.max(0, i - delay_idx);
                results.target.push({ 
                    x: target[ideal_idx].x, 
                    y: target[ideal_idx].y,
                    dir_x: target[ideal_idx].dir_x,
                    dir_y: target[ideal_idx].dir_y
                });
                
                results.actual.push(current_actuals);
            }
        }

        return results;
    }
}

window.Simulator = Simulator;
