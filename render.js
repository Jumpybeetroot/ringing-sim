// render.js

class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.zoom = null;
        this.panX = 0;
        this.panY = 0;
        
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this._rafId = 0;
        this._dirty = false;

        // Handle resizing
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Mouse Events for Pan/Zoom
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());
    }

    requestDraw() {
        if (!this.lastData) return;
        this._dirty = true;
        if (this._rafId) return;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = 0;
            if (!this._dirty) return;
            this._dirty = false;
            this.draw(this.lastData, this.lastExaggerate, this.lastIs3D, this.lastHeatmapMax);
        });
    }

    handleWheel(e) {
        e.preventDefault();
        const zoomFactor = 1.1;
        
        // Mouse position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // World coordinates of mouse
        const worldX = (mouseX - this.panX) / this.zoom;
        const worldY = (mouseY - this.panY) / this.zoom;

        if (e.deltaY < 0) {
            this.zoom *= zoomFactor;
        } else {
            this.zoom /= zoomFactor;
        }

        // Adjust pan to zoom around mouse
        this.panX = mouseX - worldX * this.zoom;
        this.panY = mouseY - worldY * this.zoom;

        this.requestDraw();
    }

    handleMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.panX += dx;
        this.panY += dy;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.requestDraw();
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.requestDraw();
    }

    autoFit(simData) {
        if (!simData || simData.target.length === 0) return;
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (let i = 0; i < simData.target.length; i++) {
            const p = simData.target[i];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        const width = maxX - minX;
        const height = maxY - minY;
        
        // Leave some margin
        const zoomX = (this.canvas.width * 0.8) / width;
        const zoomY = (this.canvas.height * 0.8) / height;
        this.zoom = Math.min(zoomX, zoomY);

        // Center it
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        this.panX = this.canvas.width / 2 - centerX * this.zoom;
        this.panY = this.canvas.height / 2 + centerY * this.zoom; // + because Y is inverted
    }

    draw(simData, exaggerate = 1, is3D = false, heatmapMax = 0.1) {
        this.lastData = simData;
        this.lastExaggerate = exaggerate;
        this.lastIs3D = is3D;
        this.lastHeatmapMax = heatmapMax;
        
        if (!this.zoom) {
            this.autoFit(simData);
        }

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);

        if (!simData || simData.t.length === 0) return;
        
        const numOscillators = simData.actual[0].length;
        const actualPaths = [];
        for (let j = 0; j < numOscillators; j++) {
            actualPaths.push([]);
        }
        
        const idealPoints = [];
        
        for (let i = 0; i < simData.t.length; i++) {
            const id = simData.target[i];
            const actuals = simData.actual[i];

            if (is3D) {
                idealPoints.push({ x: id.x, y: id.y });
                for (let j = 0; j < numOscillators; j++) {
                    let ax = actuals[j].x;
                    let ay = actuals[j].y;
                    if (exaggerate > 1) {
                        ax = id.x + (ax - id.x) * exaggerate;
                        ay = id.y + (ay - id.y) * exaggerate;
                    }
                    actualPaths[j].push({ x: ax, y: ay });
                }
            } else {
                const id_px = this.panX + id.x * this.zoom;
                const id_py = this.panY - id.y * this.zoom; // Invert Y
                idealPoints.push({ x: id_px, y: id_py });

                for (let j = 0; j < numOscillators; j++) {
                    let ax = actuals[j].x;
                    let ay = actuals[j].y;
                    if (exaggerate > 1) {
                        ax = id.x + (ax - id.x) * exaggerate;
                        ay = id.y + (ay - id.y) * exaggerate;
                    }
                    const px = this.panX + ax * this.zoom;
                    const py = this.panY - ay * this.zoom; // Invert Y
                    actualPaths[j].push({ x: px, y: py });
                }
            }
        }

        if (is3D) {
            this.draw3DWall(ctx, actualPaths, idealPoints, heatmapMax);
        } else {
            this.drawTopDown(ctx, actualPaths, idealPoints, heatmapMax);
        }
        
        // Draw scale bar on both views
        this.drawScaleBar(ctx, w, h);
    }

    draw3DWall(ctx, actualPathsWorld, idealPointsWorld, heatmapMax) {
        const layerHeight = 0.4;
        const pxPerLayer = layerHeight * this.zoom;
        const numLayers = pxPerLayer < 1 ? 3 : (pxPerLayer < 2 ? 5 : 10);

        const cos30 = Math.cos(Math.PI / 6);
        const sin30 = Math.sin(Math.PI / 6);
        const zoom = this.zoom;
        const panX = this.panX;
        const panY = this.panY;

        const numStrokes = actualPathsWorld.length; // 1 or 2
        const N = actualPathsWorld[0].length;
        const BUCKETS = 10;

        // 1. Project every actual vertex once at z=0; per-layer draw just translates vertically.
        const projX = new Float32Array(numStrokes * N);
        const projY = new Float32Array(numStrokes * N);
        for (let s = 0; s < numStrokes; s++) {
            const stride = s * N;
            const src = actualPathsWorld[s];
            for (let i = 0; i < N; i++) {
                const px = src[i].x;
                const py = src[i].y;
                projX[stride + i] = panX + (px - py) * cos30 * zoom;
                projY[stride + i] = panY + (px + py) * sin30 * zoom;
            }
        }

        // 2. Classify each segment into an error bucket once (layer-invariant).
        const segBuckets = new Uint8Array(N - 1);
        const targetData = this.lastData.target;
        const actualData = this.lastData.actual;
        const bucketScale = BUCKETS / heatmapMax;
        for (let i = 1; i < N; i++) {
            const rawTarget = targetData[i];
            const rawActuals = actualData[i];
            let vx, vy;
            if (numStrokes === 2) {
                vx = (rawActuals[0].x + rawActuals[rawActuals.length - 1].x) * 0.5 - rawTarget.x;
                vy = (rawActuals[0].y + rawActuals[rawActuals.length - 1].y) * 0.5 - rawTarget.y;
            } else {
                vx = rawActuals[0].x - rawTarget.x;
                vy = rawActuals[0].y - rawTarget.y;
            }
            const err_tangent = vx * rawTarget.dir_x + vy * rawTarget.dir_y;
            const err_total_sq = vx * vx + vy * vy;
            const err_perp = Math.sqrt(Math.max(0, err_total_sq - err_tangent * err_tangent));
            let b = (err_perp * bucketScale) | 0;
            if (b >= BUCKETS) b = BUCKETS - 1;
            segBuckets[i - 1] = b;
        }

        // 3. Build one Path2D per (stroke, bucket) as contiguous polylines — only `moveTo`
        //    when the bucket changes, so consecutive same-bucket segments stroke as a real polyline.
        const bucketPaths = new Array(numStrokes);
        for (let s = 0; s < numStrokes; s++) {
            const perStroke = new Array(BUCKETS);
            for (let b = 0; b < BUCKETS; b++) perStroke[b] = new Path2D();
            const stride = s * N;
            let prevBucket = -1;
            for (let i = 1; i < N; i++) {
                const b = segBuckets[i - 1];
                const p = perStroke[b];
                if (b !== prevBucket) {
                    p.moveTo(projX[stride + i - 1], projY[stride + i - 1]);
                }
                p.lineTo(projX[stride + i], projY[stride + i]);
                prevBucket = b;
            }
            bucketPaths[s] = perStroke;
        }

        // 4. Build ideal ghost path once.
        const idealPath = new Path2D();
        {
            const first = idealPointsWorld[0];
            idealPath.moveTo(
                panX + (first.x - first.y) * cos30 * zoom,
                panY + (first.x + first.y) * sin30 * zoom
            );
            for (let i = 1; i < idealPointsWorld.length; i++) {
                const p = idealPointsWorld[i];
                idealPath.lineTo(
                    panX + (p.x - p.y) * cos30 * zoom,
                    panY + (p.x + p.y) * sin30 * zoom
                );
            }
        }

        // 5. Precompute per-bucket heatmap colours.
        const colors = new Array(BUCKETS);
        for (let b = 0; b < BUCKETS; b++) {
            const error = (b + 0.5) * (heatmapMax / BUCKETS);
            colors[b] = this._heatmapColor(error, heatmapMax, 1.0);
        }

        const lineWidth = Math.max(1, 0.4 * zoom);
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';

        // 6. Ghost wall — two layers max (top + bottom).
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        const ghostStep = Math.max(1, (numLayers / 2) | 0);
        for (let layer = 0; layer < numLayers; layer += ghostStep) {
            const dy = -layer * layerHeight * zoom;
            ctx.save();
            ctx.translate(0, dy);
            ctx.stroke(idealPath);
            ctx.restore();
        }

        // 7. Actual path layers — reuse same pre-built Path2Ds, translate in screen space.
        for (let layer = 0; layer < numLayers; layer++) {
            const dy = -layer * layerHeight * zoom;
            ctx.save();
            ctx.translate(0, dy);
            for (let b = 0; b < BUCKETS; b++) {
                ctx.strokeStyle = colors[b];
                for (let s = 0; s < numStrokes; s++) {
                    ctx.stroke(bucketPaths[s][b]);
                }
            }
            ctx.restore();
        }
    }

    _heatmapColor(error, heatmapMax, alpha) {
        const t = Math.min(1.0, error / heatmapMax);
        let r, g, b;
        if (t < 0.5) {
            const f = t * 2;
            r = (f * 255) | 0;
            g = 255;
            b = ((1 - f) * 255) | 0;
        } else {
            const f = (t - 0.5) * 2;
            r = 255;
            g = (255 * (1 - f)) | 0;
            b = 0;
        }
        return `rgba(${r},${g},${b},${alpha})`;
    }

    drawScaleBar(ctx, w, h) {
        let exaggerate = this.lastExaggerate || 1;
        
        // Target scale bar width in pixels: roughly 100px
        const targetPixels = 100;
        // The physical size this would represent in the EXAGGERATED error space
        const targetPhysical = targetPixels / (this.zoom * exaggerate);

        // Find a nice round number for the physical size
        const magnitudes = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100];
        let bestPhysical = magnitudes[0];
        let minDiff = Math.abs(targetPhysical - magnitudes[0]);

        for (let i = 1; i < magnitudes.length; i++) {
            const diff = Math.abs(targetPhysical - magnitudes[i]);
            if (diff < minDiff) {
                minDiff = diff;
                bestPhysical = magnitudes[i];
            }
        }

        // The drawn bar width is scaled by zoom AND exaggerate so it can be used to visually measure the ringing
        const barWidth = bestPhysical * this.zoom * exaggerate;
        
        const text = exaggerate > 1 ? `Error Scale: ${bestPhysical} mm` : `Scale: ${bestPhysical} mm`;

        const padding = 20;
        const x = w - padding - barWidth;
        const y = h - padding;

        ctx.strokeStyle = '#fff';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'right';

        // Draw bar
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + barWidth, y);
        // Ticks
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.moveTo(x + barWidth, y - 5);
        ctx.lineTo(x + barWidth, y + 5);
        ctx.stroke();

        // Text
        ctx.fillText(text, x + barWidth, y - 10);
    }

    drawTopDown(ctx, actualPaths, idealPoints, heatmapMax) {
        // Draw ideal path (dashed)
        ctx.beginPath();
        ctx.moveTo(idealPoints[0].x, idealPoints[0].y);
        for (let i = 1; i < idealPoints.length; i++) {
            ctx.lineTo(idealPoints[i].x, idealPoints[i].y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = Math.max(1, 0.4 * this.zoom);
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw all actual paths with transparency
        ctx.lineWidth = Math.max(1, 0.4 * this.zoom);

        const BUCKETS = 10;
        const getBucket = (err) => Math.min(BUCKETS - 1, Math.floor((err / heatmapMax) * BUCKETS));

        if (actualPaths.length === 2) {
            // 1. Draw a single contiguous filled ribbon (extremely fast for a single 2D layer)
            ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
            ctx.beginPath();
            ctx.moveTo(actualPaths[0][0].x, actualPaths[0][0].y);
            for (let i = 1; i < actualPaths[0].length; i++) {
                ctx.lineTo(actualPaths[0][i].x, actualPaths[0][i].y);
            }
            for (let i = actualPaths[1].length - 1; i >= 0; i--) {
                ctx.lineTo(actualPaths[1][i].x, actualPaths[1][i].y);
            }
            ctx.closePath();
            ctx.fill();

            // 2. Draw the dynamic heatmap edges using bucketing
            const pathsStroke0 = new Array(BUCKETS).fill().map(() => new Path2D());
            const pathsStroke1 = new Array(BUCKETS).fill().map(() => new Path2D());

            for (let i = 1; i < actualPaths[0].length; i++) {
                const rawTarget = this.lastData.target[i];
                const rawActuals = this.lastData.actual[i];
                const vx = (rawActuals[0].x + rawActuals[rawActuals.length-1].x) / 2 - rawTarget.x;
                const vy = (rawActuals[0].y + rawActuals[rawActuals.length-1].y) / 2 - rawTarget.y;
                
                const err_tangent = vx * rawTarget.dir_x + vy * rawTarget.dir_y;
                const err_total_sq = vx*vx + vy*vy;
                const err_perp_sq = Math.max(0, err_total_sq - err_tangent*err_tangent);
                const error_mm = Math.sqrt(err_perp_sq);

                const b = getBucket(error_mm);
                
                pathsStroke0[b].moveTo(actualPaths[0][i-1].x, actualPaths[0][i-1].y);
                pathsStroke0[b].lineTo(actualPaths[0][i].x, actualPaths[0][i].y);
                
                pathsStroke1[b].moveTo(actualPaths[1][i-1].x, actualPaths[1][i-1].y);
                pathsStroke1[b].lineTo(actualPaths[1][i].x, actualPaths[1][i].y);
            }



            ctx.lineWidth = Math.max(1, 0.4 * this.zoom);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let b = 0; b < BUCKETS; b++) {
                const colorErr = (b + 0.5) * (heatmapMax / BUCKETS);
                ctx.strokeStyle = this._heatmapColor(colorErr, heatmapMax, 1.0);
                ctx.stroke(pathsStroke0[b]);
                ctx.stroke(pathsStroke1[b]);
            }
        } else {
            const pathsStroke = new Array(BUCKETS).fill().map(() => new Path2D());
            
            for (let i = 1; i < actualPaths[0].length; i++) {
                const rawTarget = this.lastData.target[i];
                const rawActuals = this.lastData.actual[i];
                const vx = rawActuals[0].x - rawTarget.x;
                const vy = rawActuals[0].y - rawTarget.y;
                
                const err_tangent = vx * rawTarget.dir_x + vy * rawTarget.dir_y;
                const err_total_sq = vx*vx + vy*vy;
                const err_perp_sq = Math.max(0, err_total_sq - err_tangent*err_tangent);
                const error_mm = Math.sqrt(err_perp_sq);

                const b = getBucket(error_mm);
                pathsStroke[b].moveTo(actualPaths[0][i-1].x, actualPaths[0][i-1].y);
                pathsStroke[b].lineTo(actualPaths[0][i].x, actualPaths[0][i].y);
            }

            ctx.lineWidth = Math.max(1, 0.4 * this.zoom);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let b = 0; b < BUCKETS; b++) {
                const colorErr = (b + 0.5) * (heatmapMax / BUCKETS);
                ctx.strokeStyle = this._heatmapColor(colorErr, heatmapMax, 1.0);
                ctx.stroke(pathsStroke[b]);
            }
        }
    }
}

window.Renderer = Renderer;
