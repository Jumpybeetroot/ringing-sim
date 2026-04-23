// app.js

document.addEventListener('DOMContentLoaded', () => {
    const sim = new window.Simulator();
    const renderer = new window.Renderer('simCanvas');

    // DOM Elements
    const els = {
        printSpeed: document.getElementById('print-speed'),
        accel: document.getElementById('accel'),
        scv: document.getElementById('scv'),
        mechFreq: document.getElementById('mech-freq'),
        damping: document.getElementById('damping'),
        peakWidth: document.getElementById('peak-width'),
        shaperType: document.getElementById('shaper-type'),
        shaperFreq: document.getElementById('shaper-freq'),
        exaggerate: document.getElementById('exaggerate'),
        viewMode: document.getElementById('view-mode'),
        heatmapMax: document.getElementById('heatmap-max')
    };

    // Value display elements
    const displays = {
        printSpeed: document.getElementById('speed-val'),
        accel: document.getElementById('accel-val'),
        scv: document.getElementById('scv-val'),
        mechFreq: document.getElementById('freq-val'),
        damping: document.getElementById('damping-val'),
        peakWidth: document.getElementById('width-val'),
        shaperFreq: document.getElementById('shaper-freq-val'),
        exaggerate: document.getElementById('exaggerate-val'),
        heatmapMax: document.getElementById('heatmap-max-val')
    };

    function updateDisplays() {
        displays.printSpeed.textContent = els.printSpeed.value + ' mm/s';
        displays.accel.textContent = els.accel.value + ' mm/s²';
        displays.scv.textContent = els.scv.value + ' mm/s';
        displays.mechFreq.textContent = els.mechFreq.value + ' Hz';
        displays.damping.textContent = parseFloat(els.damping.value).toFixed(2);
        displays.peakWidth.textContent = els.peakWidth.value + ' Hz';
        displays.shaperFreq.textContent = els.shaperFreq.value + ' Hz';
        if(displays.exaggerate) displays.exaggerate.textContent = els.exaggerate.value + 'x';
        if(displays.heatmapMax) displays.heatmapMax.textContent = parseFloat(els.heatmapMax.value).toFixed(2) + ' mm';
        
        // Hide shaper freq if shaper is none
        const shaperGroup = document.getElementById('shaper-freq-group');
        if (els.shaperType.value === 'none') {
            shaperGroup.style.opacity = '0.3';
            shaperGroup.style.pointerEvents = 'none';
        } else {
            shaperGroup.style.opacity = '1';
            shaperGroup.style.pointerEvents = 'auto';
        }
    }

    function runSimulation() {
        const config = {
            v_max: parseFloat(els.printSpeed.value),
            accel: parseFloat(els.accel.value),
            scv: parseFloat(els.scv.value),
            mech_f: parseFloat(els.mechFreq.value),
            mech_d: parseFloat(els.damping.value),
            peak_width: parseFloat(els.peakWidth.value),
            shaper_type: els.shaperType.value,
            shaper_f: parseFloat(els.shaperFreq.value)
        };

        const exaggerate = els.exaggerate ? parseFloat(els.exaggerate.value) : 1;
        const is3D = els.viewMode ? (els.viewMode.value === '3d') : false;
        const heatmapMax = els.heatmapMax ? parseFloat(els.heatmapMax.value) : 0.1;
        
        const results = sim.run(config);
        renderer.draw(results, exaggerate, is3D, heatmapMax);
    }

    function handleInput() {
        updateDisplays();
        runSimulation();
    }

    // Attach listeners
    Object.values(els).forEach(el => {
        if (!el) return;
        el.addEventListener('input', handleInput);
        if (el.tagName === 'SELECT') {
            el.addEventListener('change', handleInput);
        }
    });

    // Initial run
    handleInput();
});
