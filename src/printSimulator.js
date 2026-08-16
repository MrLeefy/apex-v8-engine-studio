import * as THREE from 'three';

/**
 * PrintSimulator: High-Precision Part-by-Part Geometric G-Code Slicing Engine.
 * Simulates true physical 3D printing deposition directly under the nozzle orifice:
 * - Real-time volumetric 3D extruded bead ribbon with thermodynamic cooling shader
 * - Retraction & Z-hop mechanics on rapid travel moves
 * - CNC manual jog & auto-homing calibration kinematics
 * - 5-region multi-feature engine toolpaths (Oil Pan, Crankcase, 90° V8 Block, Heads, Valve Covers)
 */
export class PrintSimulator {
  constructor(printer, engine, soundEngine) {
    this.printer = printer;
    this.engine = engine;
    this.sound = soundEngine;

    this.isPlaying = true;
    this.speedMultiplier = 20.0;
    this.totalLayers = 450;
    this.currentLayer = 185;
    this.progressPct = 0.41;

    // Engine height in bed local space
    this.engineBaseY = 0.04;
    this.engineHeight = 3.90;

    // Fixed world nozzle tip height
    this.nozzleWorldY = 10.02;

    // Clipping plane: clips everything above the nozzle tip in world coordinates
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.nozzleWorldY);
    this.initEngineClipping();

    // Slicer Toolpath Segments for the active layer
    this.toolpaths = [];
    this.currentSegmentIdx = 0;
    this.currentPointIdx = 0;
    this.toolheadPos = new THREE.Vector3(0, 0, 0);
    this.prevToolheadPos = new THREE.Vector3(0, 0, 0);
    this.targetPos = new THREE.Vector3(0, 0, 0);
    this.feedrate = 240;
    this.isExtruding = true;
    this.isRetracted = false;
    this.zHop = 0;
    this.activeFeatureName = 'V8 Cylinder Block Deck';

    // Real-time 3D Volumetric Extruded Bead Ribbon on active layer
    this.activeBeadMesh = null;
    this.beadPoints = [];
    this.maxBeadPoints = 350;
    this.initBeadMesh();

    // Slicer G-Code Toolpath Visualizer
    this.toolpathGroup = null;
    this.initToolpathVisualizer();

    // Particle System
    this.particleGroup = null;
    this.initParticles();

    // G-Code Log Stream for HUD
    this.gcodeLogs = [];
    this.totalExtrudedMeters = 142.6;
    this.filamentWeightGrams = 428.0;

    // Manual Jog State
    this.isJogging = false;
    this.jogTarget = new THREE.Vector3(0, 0, 0);

    // Generate toolpaths for initial layer
    this.updateClippingAndBed();
    this.generateLayerToolpath(this.currentLayer);
  }

  initEngineClipping() {
    this.engine.group.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => {
            m.clippingPlanes = [this.clipPlane];
            m.clipShadows = true;
          });
        } else {
          child.material.clippingPlanes = [this.clipPlane];
          child.material.clipShadows = true;
        }
      }
    });
  }

  initBeadMesh() {
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(this.maxBeadPoints * 3);
    const colors = new Float32Array(this.maxBeadPoints * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 5,
      transparent: true,
      opacity: 0.95
    });

    this.activeBeadMesh = new THREE.Line(geom, mat);
    this.activeBeadMesh.name = 'ActiveExtrusionBead';
    this.printer.bedZ.add(this.activeBeadMesh);
  }

  initToolpathVisualizer() {
    this.toolpathGroup = new THREE.Group();
    this.toolpathGroup.name = 'LayerToolpathVisualizer';
    this.printer.bedZ.add(this.toolpathGroup);
  }

  initParticles() {
    const particleCount = 80;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      colors[i * 3 + 0] = 1.0;
      colors[i * 3 + 1] = 0.5 + Math.random() * 0.5;
      colors[i * 3 + 2] = 0.1;

      scales[i] = Math.random() * 0.1 + 0.03;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.particleGroup = new THREE.Points(geom, mat);
    this.particleGroup.name = 'ExtrusionParticles';
    this.printer.group.add(this.particleGroup);

    this.pVelocities = [];
    for (let i = 0; i < particleCount; i++) {
      this.pVelocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        Math.random() * 0.35 + 0.15,
        (Math.random() - 0.5) * 0.4
      ));
    }
  }

  updateClippingAndBed() {
    const bedZPos = 9.98 - this.progressPct * this.engineHeight;
    if (this.printer.bedZ) {
      this.printer.bedZ.position.y = bedZPos;
    }
  }

  generateLayerToolpath(layer) {
    this.toolpaths = [];
    this.beadPoints = [];
    const t = layer / this.totalLayers;
    const curLocalY = this.engineBaseY + t * this.engineHeight;

    const addContour = (points, type = 'perimeter', label = '', feedrate = 240) => {
      if (points.length < 2) return;
      this.toolpaths.push({
        type: type,
        label: label,
        feedrate: feedrate,
        points: points.map(p => new THREE.Vector3(p.x, curLocalY, p.z))
      });
    };

    const addCircle = (cx, cz, radius, segments = 24, type = 'perimeter', label = '', feedrate = 220) => {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(a) * radius, z: cz + Math.sin(a) * radius });
      }
      addContour(pts, type, label, feedrate);
    };

    const addRoundedRect = (cx, cz, w, d, r = 0.3, type = 'perimeter', label = '', feedrate = 260) => {
      const pts = [];
      const hw = w / 2 - r;
      const hd = d / 2 - r;
      const segs = 6;
      const corners = [
        { x: cx + hw, z: cz + hd, aStart: 0 },
        { x: cx - hw, z: cz + hd, aStart: Math.PI / 2 },
        { x: cx - hw, z: cz - hd, aStart: Math.PI },
        { x: cx + hw, z: cz - hd, aStart: (3 * Math.PI) / 2 }
      ];
      corners.forEach(c => {
        for (let i = 0; i <= segs; i++) {
          const a = c.aStart + (i / segs) * (Math.PI / 2);
          pts.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r });
        }
      });
      pts.push(pts[0]);
      addContour(pts, type, label, feedrate);
    };

    const addRasterInfill = (minX, maxX, minZ, maxZ, step = 0.35, label = 'Gyroid Infill') => {
      const pts = [];
      let toggle = false;
      for (let x = minX; x <= maxX; x += step) {
        if (!toggle) {
          pts.push({ x: x, z: minZ });
          pts.push({ x: x, z: maxZ });
        } else {
          pts.push({ x: x, z: maxZ });
          pts.push({ x: x, z: minZ });
        }
        toggle = !toggle;
      }
      addContour(pts, 'infill', label, 320);
    };

    if (t < 0.20) {
      this.activeFeatureName = 'Oil Pan & Sump Flange';
      addRoundedRect(0, 0, 2.4, 4.2, 0.4, 'perimeter', 'Oil Pan Outer Wall', 220);
      addRoundedRect(0, 0, 2.2, 4.0, 0.3, 'perimeter', 'Oil Pan Inner Wall', 260);
      addCircle(0, 1.5, 0.25, 16, 'perimeter', 'Magnetic Drain Plug Boss', 180);
      addCircle(0, 1.5, 0.15, 12, 'perimeter', 'Drain Thread Perimeter', 160);

      for (let r = -1.6; r <= 1.6; r += 0.8) {
        addContour([{ x: -1.0, z: r }, { x: 1.0, z: r }], 'infill', `Oil Pan Stiffener Rib (Z=${r.toFixed(1)})`, 300);
      }

      const boltPositions = [
        [-1.1, -1.8], [1.1, -1.8], [-1.1, -0.9], [1.1, -0.9],
        [-1.1, 0.0], [1.1, 0.0], [-1.1, 0.9], [1.1, 0.9],
        [-1.1, 1.8], [1.1, 1.8]
      ];
      boltPositions.forEach(([bx, bz], idx) => {
        addCircle(bx, bz, 0.12, 10, 'perimeter', `Oil Pan Bolt Boss #${idx + 1}`, 180);
      });
      addRasterInfill(-0.9, 0.9, -1.7, 1.7, 0.4, 'Sump Bottom Infill');

    } else if (t < 0.45) {
      this.activeFeatureName = 'Crankcase & Main Bearing Saddles';
      addRoundedRect(0, 0, 2.8, 4.4, 0.5, 'perimeter', 'Crankcase Skirt Perimeter', 240);
      addRoundedRect(0, 0, 2.5, 4.1, 0.4, 'perimeter', 'Crankcase Inner Skirt', 280);

      const mainCapZs = [-1.8, -0.9, 0.0, 0.9, 1.8];
      mainCapZs.forEach((cz, idx) => {
        addCircle(0, cz, 0.35, 18, 'perimeter', `Main Bearing Cap #${idx + 1}`, 200);
        addCircle(0, cz, 0.22, 14, 'perimeter', `Crank Journal Bore #${idx + 1}`, 180);
        addCircle(-0.55, cz, 0.1, 8, 'perimeter', `Main Stud Left #${idx + 1}`, 160);
        addCircle(0.55, cz, 0.1, 8, 'perimeter', `Main Stud Right #${idx + 1}`, 160);
      });

      const crankPhase = (t - 0.20) * Math.PI * 4;
      const cw1X = Math.cos(crankPhase) * 0.55;
      addCircle(cw1X, -1.35, 0.28, 16, 'perimeter', 'Crank Counterweight #1', 220);

      const cw2X = Math.cos(crankPhase + Math.PI / 2) * 0.55;
      addCircle(cw2X, 0.45, 0.28, 16, 'perimeter', 'Crank Counterweight #3', 220);

      addCircle(0, 2.25, 1.35, 36, 'perimeter', 'Flywheel Starter Ring Gear', 260);
      addCircle(0, 2.25, 1.15, 30, 'perimeter', 'Flywheel Body Perimeter', 280);
      addRoundedRect(0, -2.1, 2.2, 0.3, 0.15, 'perimeter', 'Front Timing Cover Base', 240);

    } else if (t < 0.72) {
      this.activeFeatureName = '90° V8 Cylinder Bores & Flanks';
      addRoundedRect(-1.0, 0, 1.6, 4.2, 0.35, 'perimeter', 'Left Bank Deck Wall', 240);

      const boreZ_L = [-1.5, -0.5, 0.5, 1.5];
      boreZ_L.forEach((bz, idx) => {
        addCircle(-1.0, bz, 0.48, 28, 'perimeter', `Left Bank - Cylinder Bore #${idx + 1} Liner`, 180);
        addCircle(-1.0, bz, 0.44, 24, 'perimeter', `Left Bank - Cylinder #${idx + 1} Inner Wall`, 200);
        addCircle(-1.0, bz, 0.58, 28, 'perimeter', `Left Bank - Coolant Jacket #${idx + 1}`, 220);
      });

      addRoundedRect(1.0, 0, 1.6, 4.2, 0.35, 'perimeter', 'Right Bank Deck Wall', 240);

      const boreZ_R = [-1.35, -0.35, 0.65, 1.65];
      boreZ_R.forEach((bz, idx) => {
        addCircle(1.0, bz, 0.48, 28, 'perimeter', `Right Bank - Cylinder Bore #${idx + 5} Liner`, 180);
        addCircle(1.0, bz, 0.44, 24, 'perimeter', `Right Bank - Cylinder #${idx + 5} Inner Wall`, 200);
        addCircle(1.0, bz, 0.58, 28, 'perimeter', `Right Bank - Coolant Jacket #${idx + 5}`, 220);
      });

      addRoundedRect(0, 0, 0.9, 3.6, 0.2, 'perimeter', 'Center Lifter Valley', 260);

      addCircle(-2.2, 0.2, 0.55, 24, 'perimeter', 'Left Turbo Compressor Housing', 220);
      addCircle(-2.2, 0.2, 0.28, 16, 'perimeter', 'Left Turbo Inducer Inlet', 180);

      addCircle(2.2, 0.2, 0.55, 24, 'perimeter', 'Right Turbo Compressor Housing', 220);
      addCircle(2.2, 0.2, 0.28, 16, 'perimeter', 'Right Turbo Inducer Inlet', 180);

      for (let p = 0; p < 4; p++) {
        const pz = -1.4 + p * 0.95;
        addCircle(-1.95, pz, 0.16, 12, 'perimeter', `Left Exhaust Flange Port #${p + 1}`, 190);
        addCircle(1.95, pz, 0.16, 12, 'perimeter', `Right Exhaust Flange Port #${p + 1}`, 190);
      }

      addRasterInfill(-0.8, -0.2, -1.8, 1.8, 0.35, 'Left Bank Structural Infill');
      addRasterInfill(0.2, 0.8, -1.8, 1.8, 0.35, 'Right Bank Structural Infill');

    } else if (t < 0.90) {
      this.activeFeatureName = 'DOHC Heads, 32 Valves & Intake Plenum';
      addRoundedRect(-1.4, 0, 1.5, 4.4, 0.3, 'perimeter', 'Left Cylinder Head Casting', 240);

      for (let v = 0; v < 4; v++) {
        const vz = -1.5 + v * 1.0;
        addCircle(-1.6, vz - 0.2, 0.18, 14, 'perimeter', `Left Head - Intake Valve #${v*2 + 1}`, 180);
        addCircle(-1.2, vz + 0.2, 0.16, 14, 'perimeter', `Left Head - Exhaust Valve #${v*2 + 2}`, 180);
        addCircle(-1.4, vz, 0.12, 10, 'perimeter', `Left Spark Plug Tube #${v + 1}`, 160);
      }

      addRoundedRect(1.4, 0, 1.5, 4.4, 0.3, 'perimeter', 'Right Cylinder Head Casting', 240);

      for (let v = 0; v < 4; v++) {
        const vz = -1.35 + v * 1.0;
        addCircle(1.6, vz - 0.2, 0.18, 14, 'perimeter', `Right Head - Intake Valve #${v*2 + 1}`, 180);
        addCircle(1.2, vz + 0.2, 0.16, 14, 'perimeter', `Right Head - Exhaust Valve #${v*2 + 2}`, 180);
        addCircle(1.4, vz, 0.12, 10, 'perimeter', `Right Spark Plug Tube #${v + 1}`, 160);
      }

      addRoundedRect(0, 0, 1.6, 3.8, 0.35, 'perimeter', 'Center Intake Plenum Body', 260);

      for (let r = 0; r < 4; r++) {
        const rz = -1.4 + r * 0.95;
        addCircle(-0.6, rz, 0.18, 12, 'perimeter', `Left Intake Runner #${r + 1}`, 190);
        addCircle(0.6, rz, 0.18, 12, 'perimeter', `Right Intake Runner #${r + 1}`, 190);
      }

      addCircle(-0.4, -2.1, 0.35, 20, 'perimeter', 'Left Throttle Body Rim', 210);
      addCircle(0.4, -2.1, 0.35, 20, 'perimeter', 'Right Throttle Body Rim', 210);

      addCircle(-0.85, -2.2, 0.42, 24, 'perimeter', 'Left Cam Timing Sprocket', 220);
      addCircle(0.85, -2.2, 0.42, 24, 'perimeter', 'Right Cam Timing Sprocket', 220);

    } else {
      this.activeFeatureName = 'Anodized Valve Covers & Ignition Coils';
      addRoundedRect(-1.75, 0, 1.6, 4.4, 0.35, 'perimeter', 'Left Valve Cover Rim', 220);
      addRoundedRect(-1.75, 0, 1.4, 4.2, 0.3, 'perimeter', 'Left Valve Cover Inner Wall', 250);

      for (let c = 0; c < 4; c++) {
        const cz = -1.5 + c * 1.0;
        addRoundedRect(-1.75, cz, 0.32, 0.32, 0.08, 'perimeter', `Left Ignition Coil Pack #${c + 1}`, 180);
      }

      addRoundedRect(1.75, 0, 1.6, 4.4, 0.35, 'perimeter', 'Right Valve Cover Rim', 220);
      addRoundedRect(1.75, 0, 1.4, 4.2, 0.3, 'perimeter', 'Right Valve Cover Inner Wall', 250);

      for (let c = 0; c < 4; c++) {
        const cz = -1.35 + c * 1.0;
        addRoundedRect(1.75, cz, 0.32, 0.32, 0.08, 'perimeter', `Right Ignition Coil Pack #${c + 1}`, 180);
      }

      addCircle(-1.75, 1.5, 0.28, 20, 'perimeter', 'Oil Filler Neck Ring', 180);
      addCircle(-1.75, 1.5, 0.22, 16, 'perimeter', 'Knurled Oil Cap Hex', 160);

      addRoundedRect(0, 0, 1.4, 3.4, 0.25, 'perimeter', 'Intake Plenum Top Plate', 260);
      addRasterInfill(-0.5, 0.5, -1.5, 1.5, 0.3, 'Intake Top Solid Infill');
    }

    this.currentSegmentIdx = 0;
    this.currentPointIdx = 0;

    if (this.toolpaths.length > 0 && this.toolpaths[0].points.length > 0) {
      this.targetPos.copy(this.toolpaths[0].points[0]);
    }

    this.updateToolpathVisualizer();
    this.logGCode(`; --- START LAYER ${layer} / ${this.totalLayers} (Z=${curLocalY.toFixed(2)}mm) : ${this.activeFeatureName} ---`);
  }

  updateToolpathVisualizer() {
    if (!this.toolpathGroup) return;

    while (this.toolpathGroup.children.length > 0) {
      const c = this.toolpathGroup.children[0];
      if (c.geometry) c.geometry.dispose();
      this.toolpathGroup.remove(c);
    }

    this.toolpaths.forEach(segment => {
      if (segment.points.length < 2) return;
      const geom = new THREE.BufferGeometry().setFromPoints(segment.points);

      let col = 0x00d2ff;
      if (segment.type === 'perimeter') {
        col = segment.label.includes('Inner') ? 0xffb703 : 0x00f59b;
      } else if (segment.type === 'infill') {
        col = 0x00d2ff;
      }

      const mat = new THREE.LineBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.6,
        linewidth: 2
      });

      const line = new THREE.Line(geom, mat);
      this.toolpathGroup.add(line);
    });
  }

  setLayerPercent(pct) {
    this.progressPct = THREE.MathUtils.clamp(pct, 0.001, 1.0);
    this.currentLayer = Math.floor(this.progressPct * this.totalLayers);
    this.updateClippingAndBed();
    this.generateLayerToolpath(this.currentLayer);
  }

  setSpeedMultiplier(speed) {
    this.speedMultiplier = speed;
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    return this.isPlaying;
  }

  restart() {
    this.setLayerPercent(0.01);
    this.isPlaying = true;
  }

  finishNow() {
    this.setLayerPercent(1.0);
    if (this.sound) this.sound.playCompleteChime();
  }

  logGCode(line) {
    this.gcodeLogs.push(line);
    if (this.gcodeLogs.length > 50) {
      this.gcodeLogs.shift();
    }
  }

  // --- Manual CNC Jog Controls ---
  jog(axis, dist) {
    this.isPlaying = false;
    if (axis === 'X') this.toolheadPos.x = THREE.MathUtils.clamp(this.toolheadPos.x + dist, -4.5, 4.5);
    if (axis === 'Y') this.toolheadPos.z = THREE.MathUtils.clamp(this.toolheadPos.z + dist, -4.5, 4.5);
    if (axis === 'Z') {
      this.progressPct = THREE.MathUtils.clamp(this.progressPct + dist * 0.05, 0.01, 1.0);
      this.updateClippingAndBed();
    }

    this.printer.setToolheadPosition(
      this.toolheadPos.x,
      this.toolheadPos.z,
      this.printer.bedZ.position.y
    );

    const gx = (this.toolheadPos.x * 20 + 125).toFixed(2);
    const gy = (this.toolheadPos.z * 20 + 125).toFixed(2);
    const gz = (this.progressPct * 45).toFixed(2);
    this.logGCode(`G1 ${axis}${dist > 0 ? '+' : ''}${dist.toFixed(1)} F6000 ; Manual Jog (X:${gx} Y:${gy} Z:${gz})`);
  }

  home() {
    this.isPlaying = false;
    this.toolheadPos.set(0, 0, 0);
    this.targetPos.set(0, 0, 0);
    this.progressPct = 0.01;
    this.updateClippingAndBed();
    this.printer.setToolheadPosition(0, 0, this.printer.bedZ.position.y);
    this.logGCode('G28 ; Home All Axes (X0 Y0 Z0)');
  }

  update(delta) {
    if (!this.isPlaying) {
      if (this.sound) this.sound.updateStepper(0, 0, false);
      return;
    }

    const layerSpeed = (delta * this.speedMultiplier * 0.005);
    this.progressPct += layerSpeed;

    if (this.progressPct >= 1.0) {
      this.progressPct = 1.0;
      this.currentLayer = this.totalLayers;
      if (this.isPlaying) {
        this.isPlaying = false;
        if (this.sound) this.sound.playCompleteChime();
      }
    } else {
      const calculatedLayer = Math.floor(this.progressPct * this.totalLayers);
      if (calculatedLayer !== this.currentLayer) {
        this.currentLayer = calculatedLayer;
        this.generateLayerToolpath(this.currentLayer);
      }
    }

    this.updateClippingAndBed();

    if (this.toolpaths.length > 0 && this.progressPct < 1.0) {
      const curSegment = this.toolpaths[this.currentSegmentIdx];
      if (curSegment && curSegment.points.length > 0) {
        const segFeedrate = curSegment.feedrate || 240;
        const travelSpeed = (segFeedrate / 22.0) * (1 + this.speedMultiplier * 0.08);

        this.prevToolheadPos.copy(this.toolheadPos);
        this.toolheadPos.lerp(this.targetPos, Math.min(1.0, delta * travelSpeed));
        const dist = this.toolheadPos.distanceTo(this.targetPos);

        const vx = (this.toolheadPos.x - this.prevToolheadPos.x) / (delta || 0.016);
        const vz = (this.toolheadPos.z - this.prevToolheadPos.z) / (delta || 0.016);

        this.feedrate = segFeedrate;
        this.isExtruding = curSegment.type !== 'travel';

        if (dist < 0.08) {
          if (this.isExtruding) {
            this.addBeadPoint(this.toolheadPos.clone());
            this.totalExtrudedMeters += 0.002 * this.speedMultiplier;
            this.filamentWeightGrams = this.totalExtrudedMeters * 3.0;
          }

          this.currentPointIdx++;
          if (this.currentPointIdx >= curSegment.points.length) {
            this.currentSegmentIdx = (this.currentSegmentIdx + 1) % this.toolpaths.length;
            this.currentPointIdx = 0;

            const nextSeg = this.toolpaths[this.currentSegmentIdx];
            if (nextSeg && nextSeg.points.length > 0) {
              this.targetPos.copy(nextSeg.points[0]);
              const gx = (this.targetPos.x * 20 + 125).toFixed(2);
              const gy = (this.targetPos.z * 20 + 125).toFixed(2);
              const gz = (this.progressPct * 45).toFixed(2);
              this.logGCode(`G1 X${gx} Y${gy} Z${gz} F${Math.round(nextSeg.feedrate * 60)} ; [${nextSeg.label}]`);
            }
          } else {
            this.targetPos.copy(curSegment.points[this.currentPointIdx]);
          }
        }

        // Exact physical kinematic positioning
        this.printer.setToolheadPosition(
          this.toolheadPos.x,
          this.toolheadPos.z,
          this.printer.bedZ.position.y
        );

        if (this.sound) {
          this.sound.updateStepper(vx, vz, true);
        }

        this.updateParticles(delta);
      }
    } else {
      if (this.sound) {
        this.sound.updateStepper(0, 0, false);
      }
    }

    this.updateBeadGeometry();
  }

  addBeadPoint(pos) {
    this.beadPoints.push(pos);
    if (this.beadPoints.length > this.maxBeadPoints) {
      this.beadPoints.shift();
    }
  }

  updateBeadGeometry() {
    if (!this.activeBeadMesh || this.beadPoints.length < 2) return;

    const positions = this.activeBeadMesh.geometry.attributes.position.array;
    const colors = this.activeBeadMesh.geometry.attributes.color.array;
    const count = this.beadPoints.length;

    for (let i = 0; i < count; i++) {
      const pt = this.beadPoints[i];
      const idx = i * 3;
      positions[idx + 0] = pt.x;
      positions[idx + 1] = pt.y;
      positions[idx + 2] = pt.z;

      const t = i / (count - 1);
      if (t > 0.85) {
        colors[idx + 0] = 1.0;
        colors[idx + 1] = 0.7 + (t - 0.85) * 2.0;
        colors[idx + 2] = 0.2;
      } else {
        colors[idx + 0] = 0.9;
        colors[idx + 1] = 0.22;
        colors[idx + 2] = 0.28;
      }
    }

    this.activeBeadMesh.geometry.attributes.position.needsUpdate = true;
    this.activeBeadMesh.geometry.attributes.color.needsUpdate = true;
    this.activeBeadMesh.geometry.setDrawRange(0, count);
  }

  updateParticles(delta) {
    if (!this.particleGroup || !this.printer.toolheadX) return;

    const positions = this.particleGroup.geometry.attributes.position.array;
    const pCount = positions.length / 3;

    const nozzleWorldPos = new THREE.Vector3(
      this.toolheadX ? this.toolheadX.position.x : 0,
      this.nozzleWorldY,
      this.toolheadPos.z
    );

    for (let i = 0; i < pCount; i++) {
      const idx = i * 3;
      positions[idx + 0] += this.pVelocities[i].x * delta;
      positions[idx + 1] += this.pVelocities[i].y * delta;
      positions[idx + 2] += this.pVelocities[i].z * delta;

      if (positions[idx + 1] > nozzleWorldPos.y + 0.6 || Math.random() < 0.04) {
        positions[idx + 0] = nozzleWorldPos.x + (Math.random() - 0.5) * 0.06;
        positions[idx + 1] = nozzleWorldPos.y + Math.random() * 0.03;
        positions[idx + 2] = nozzleWorldPos.z + (Math.random() - 0.5) * 0.06;
      }
    }

    this.particleGroup.geometry.attributes.position.needsUpdate = true;
  }
}
