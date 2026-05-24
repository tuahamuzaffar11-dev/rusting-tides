'use strict';

// Polyfill roundRect for older browsers / headless environments
if (typeof CanvasRenderingContext2D.prototype.roundRect !== 'function') {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    return this;
  };
}

// ============================================================
// ParticleSystem
// ============================================================
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 2000;
  }

  emit(config) {
    const {
      x, y, count, color, speedMin, speedMax, life, sizeMin, sizeMax,
      spread, gravity, type
    } = config;
    const colors = Array.isArray(color) ? color : [color];
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        // Reuse the oldest particle
        const oldest = this.particles.reduce((a, b) => (a.life < b.life ? a : b), this.particles[0]);
        const idx = this.particles.indexOf(oldest);
        this.particles[idx] = this._createParticle(x, y, colors, speedMin, speedMax, life, sizeMin, sizeMax, spread, gravity, type);
      } else {
        this.particles.push(this._createParticle(x, y, colors, speedMin, speedMax, life, sizeMin, sizeMax, spread, gravity, type));
      }
    }
  }

  _createParticle(x, y, colors, speedMin, speedMax, life, sizeMin, sizeMax, spread, gravity, type) {
    const angle = (Math.random() - 0.5) * (spread || Math.PI * 2);
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    const sz = sizeMin + Math.random() * (sizeMax - sizeMin);
    const lifeVal = life * (0.7 + Math.random() * 0.6);
    return {
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: lifeVal,
      maxLife: lifeVal,
      size: sz,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      gravity: gravity || 0,
      type: type || 'circle'
    };
  }

  emitRain(width) {
    this.emit({
      x: Math.random() * width,
      y: -10,
      count: 3,
      color: ['#aabbdd', '#99aacc', '#ccddef'],
      speedMin: 400,
      speedMax: 600,
      life: 1.5,
      sizeMin: 1,
      sizeMax: 2,
      spread: 0.15,
      gravity: 200,
      type: 'line'
    });
  }

  emitSparks(x, y) {
    this.emit({
      x, y,
      count: 12,
      color: ['#ffee44', '#ffffff', '#ffcc00', '#ffdd88'],
      speedMin: 100,
      speedMax: 350,
      life: 0.5,
      sizeMin: 1,
      sizeMax: 3,
      spread: Math.PI * 2,
      gravity: 150,
      type: 'circle'
    });
  }

  emitToxic(x, y) {
    this.emit({
      x, y,
      count: 5,
      color: ['#00ff44', '#22dd44', '#44ff66', '#00cc33'],
      speedMin: 10,
      speedMax: 40,
      life: 2.0,
      sizeMin: 3,
      sizeMax: 8,
      spread: Math.PI,
      gravity: -20,
      type: 'glow'
    });
  }

  emitRust(x, y) {
    this.emit({
      x, y,
      count: 6,
      color: ['#cc6622', '#aa5500', '#884400', '#bb7733'],
      speedMin: 10,
      speedMax: 50,
      life: 1.5,
      sizeMin: 2,
      sizeMax: 5,
      spread: Math.PI * 0.6,
      gravity: 60,
      type: 'circle'
    });
  }

  emitFire(x, y) {
    this.emit({
      x, y,
      count: 8,
      color: ['#ff3300', '#ff6600', '#ffaa00', '#ffcc33', '#ff4411'],
      speedMin: 30,
      speedMax: 120,
      life: 1.0,
      sizeMin: 3,
      sizeMax: 9,
      spread: Math.PI * 0.5,
      gravity: -100,
      type: 'glow'
    });
  }

  emitNebula(width, height) {
    this.emit({
      x: Math.random() * width,
      y: Math.random() * height,
      count: 1,
      color: ['#8844cc', '#4466ff', '#ff66aa', '#44ddff', '#aa44ff'],
      speedMin: 2,
      speedMax: 15,
      life: 5.0,
      sizeMin: 15,
      sizeMax: 40,
      spread: Math.PI * 2,
      gravity: 0,
      type: 'glow'
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.alpha <= 0) continue;
      ctx.globalAlpha = p.alpha;

      if (p.type === 'glow') {
        ctx.shadowBlur = p.size * 3;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (p.type === 'line') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.5;
        ctx.beginPath();
        const len = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 0.04;
        const nx = p.vx / (Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1);
        const ny = p.vy / (Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + nx * len, p.y + ny * len);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  clear() {
    this.particles.length = 0;
  }
}

// ============================================================
// AudioManager
// ============================================================
class AudioManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;
    this.nodes = [];
    this.masterGain = null;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('AudioManager: Web Audio API not supported', e);
    }
  }

  _ensureCtx() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.initialized;
  }

  createNoise(duration) {
    if (!this._ensureCtx()) return null;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  createTone(freq, type, duration, volume) {
    if (!this._ensureCtx()) return null;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = volume !== undefined ? volume : 0.3;
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
    this.nodes.push(osc);
    osc.onended = () => {
      const idx = this.nodes.indexOf(osc);
      if (idx !== -1) this.nodes.splice(idx, 1);
      try { gain.disconnect(); } catch (_) {}
    };
    return { oscillator: osc, gain: gain };
  }

  playRain() {
    if (!this._ensureCtx()) return;
    const noise = this.createNoise(10);
    if (!noise) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.06;
    noise.loop = true;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(this.ctx.currentTime);
    this.nodes.push(noise);
    return noise;
  }

  playThunder() {
    if (!this._ensureCtx()) return;
    // Low rumble
    const rumble = this.createTone(60, 'sawtooth', 1.0, 0.4);
    if (rumble) {
      rumble.gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      rumble.gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.0);
    }
    // Noise burst
    const noise = this.createNoise(0.5);
    if (noise) {
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      nGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      noise.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(this.ctx.currentTime);
      noise.stop(this.ctx.currentTime + 0.5);
      this.nodes.push(noise);
      noise.onended = () => {
        const idx = this.nodes.indexOf(noise);
        if (idx !== -1) this.nodes.splice(idx, 1);
        try { nGain.disconnect(); } catch (_) {}
      };
    }
  }

  playHit(intensity) {
    if (!this._ensureCtx()) return;
    const dur = 0.1 + intensity * 0.1;
    const noise = this.createNoise(dur);
    if (!noise) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 200 + intensity * 2000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3 + intensity * 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(this.ctx.currentTime);
    noise.stop(this.ctx.currentTime + dur);
    this.nodes.push(noise);
    noise.onended = () => {
      const idx = this.nodes.indexOf(noise);
      if (idx !== -1) this.nodes.splice(idx, 1);
      try { gain.disconnect(); filter.disconnect(); } catch (_) {}
    };
  }

  playBlock() {
    if (!this._ensureCtx()) return;
    // Metallic high-frequency ping
    const t = this.createTone(4200, 'square', 0.08, 0.15);
    if (t) {
      t.gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      t.gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    }
    const t2 = this.createTone(6800, 'sine', 0.06, 0.1);
    if (t2) {
      t2.gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      t2.gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    }
  }

  playWhoosh() {
    if (!this._ensureCtx()) return;
    const noise = this.createNoise(0.3);
    if (!noise) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.3);
    filter.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(this.ctx.currentTime);
    noise.stop(this.ctx.currentTime + 0.3);
    this.nodes.push(noise);
    noise.onended = () => {
      const idx = this.nodes.indexOf(noise);
      if (idx !== -1) this.nodes.splice(idx, 1);
      try { gain.disconnect(); filter.disconnect(); } catch (_) {}
    };
  }

  playVictory() {
    if (!this._ensureCtx()) return;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const convolver = this.ctx.createConvolver();
    // Simple reverb impulse
    const reverbLen = this.ctx.sampleRate * 1.5;
    const reverbBuf = this.ctx.createBuffer(2, reverbLen, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = reverbBuf.getChannelData(ch);
      for (let i = 0; i < reverbLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLen, 2.5);
      }
    }
    convolver.buffer = reverbBuf;
    const wetGain = this.ctx.createGain();
    wetGain.gain.value = 0.3;
    convolver.connect(wetGain);
    wetGain.connect(this.masterGain);

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      const startT = this.ctx.currentTime + idx * 0.5;
      gain.gain.setValueAtTime(0, startT);
      gain.gain.linearRampToValueAtTime(0.25, startT + 0.05);
      gain.gain.setValueAtTime(0.25, startT + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      gain.connect(convolver);
      osc.start(startT);
      osc.stop(startT + 0.5);
      this.nodes.push(osc);
      osc.onended = () => {
        const i2 = this.nodes.indexOf(osc);
        if (i2 !== -1) this.nodes.splice(i2, 1);
        try { gain.disconnect(); } catch (_) {}
      };
    });
  }

  playAmbient() {
    if (!this._ensureCtx()) return;
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 58;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    osc1.start(this.ctx.currentTime);
    osc2.start(this.ctx.currentTime);
    this.nodes.push(osc1);
    this.nodes.push(osc2);
    return { osc1, osc2, gain };
  }

  playBossFight() {
    if (!this._ensureCtx()) return;
    const now = this.ctx.currentTime;
    // Create a rhythmic bass pulse: repeating 80Hz hits every 0.5s for 30 seconds
    for (let i = 0; i < 60; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 80;
      const gain = this.ctx.createGain();
      const t = now + i * 0.5;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
      this.nodes.push(osc);
      osc.onended = () => {
        const idx = this.nodes.indexOf(osc);
        if (idx !== -1) this.nodes.splice(idx, 1);
        try { gain.disconnect(); } catch (_) {}
      };
    }
  }

  stopAll() {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      try {
        this.nodes[i].stop(0);
      } catch (_) {}
      try {
        this.nodes[i].disconnect();
      } catch (_) {}
    }
    this.nodes.length = 0;
  }

  setVolume(v) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, v));
    }
  }
}

// ============================================================
// CinematicEngine
// ============================================================
class CinematicEngine {
  constructor(canvas, particleSystem, audioManager) {
    this.canvas = canvas;
    this.particles = particleSystem;
    this.audio = audioManager;
    this.currentScene = 0;
    this.sceneTime = 0;
    this.complete = false;
    this.images = {};
    this.fadeAlpha = 1;
    this.typewriterText = '';
    this.typewriterIndex = 0;
    this.typewriterTimer = 0;
    this.typewriterSpeed = 40;
    this.shakeX = 0;
    this.shakeY = 0;
    this.sceneInited = false;
    this.sceneDurations = [7, 7, 8, 6, 8];
    this.transitioning = false;
    this.transitionTime = 0;
    this.lightningTimer = 0;
    this.lightningAlpha = 0;
    this.lightningBolt = null;
    this.waterColor = { r: 13, g: 27, b: 42 };
    this.rustProgress = 0;
    this.monsterCount = 1;
    this.rainNode = null;
  }

  start(images) {
    this.images = images || {};
    this.currentScene = 0;
    this.sceneTime = 0;
    this.complete = false;
    this.fadeAlpha = 1;
    this.sceneInited = false;
    this.transitioning = false;
    this.transitionTime = 0;
    this.particles.clear();
  }

  skip() {
    this.complete = true;
    this.particles.clear();
    this.audio.stopAll();
  }

  isComplete() {
    return this.complete;
  }

  typewrite(text, speed) {
    this.typewriterText = text;
    this.typewriterIndex = 0;
    this.typewriterTimer = 0;
    this.typewriterSpeed = speed || 40;
  }

  renderTypewriter(ctx) {
    if (!this.typewriterText) return;
    const visibleText = this.typewriterText.substring(0, this.typewriterIndex);
    if (!visibleText) return;
    ctx.save();
    ctx.font = 'bold 24px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'black';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(visibleText, this.canvas.width / 2, this.canvas.height - 80);
    ctx.restore();
  }

  _initScene(sceneIdx) {
    this.sceneInited = true;
    this.lightningTimer = 0;
    this.lightningAlpha = 0;
    this.lightningBolt = null;
    this.shakeX = 0;
    this.shakeY = 0;

    switch (sceneIdx) {
      case 0:
        this.typewrite('In a world drowning in darkness... a village fights to survive.', 40);
        this.rainNode = this.audio.playRain();
        break;
      case 1:
        this.typewrite('A visitor from beyond the stars... brings poison to the waters.', 40);
        this.waterColor = { r: 13, g: 27, b: 42 };
        break;
      case 2:
        this.typewrite('The poison corrupts steel and flesh alike... a boy becomes a nightmare.', 40);
        this.rustProgress = 0;
        break;
      case 3:
        this.typewrite('The horde multiplies... the village falls.', 40);
        this.monsterCount = 1;
        break;
      case 4:
        this.typewrite('The hero boards his spaceship, launching into the dark void towards Mars...', 40);
        break;
    }
  }

  _drawBuildings(ctx, dark) {
    const baseY = 420;
    
    // Parallax background hills behind buildings
    ctx.save();
    ctx.fillStyle = dark ? '#030308' : '#06061a';
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.quadraticCurveTo(200, baseY - 80, 500, baseY - 30);
    ctx.quadraticCurveTo(800, baseY - 110, 1280, baseY - 50);
    ctx.lineTo(1280, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const buildingColor = dark ? '#050510' : '#0a0a18';
    const buildings = [
      { x: 100, w: 80, h: 180 },
      { x: 220, w: 100, h: 220 },
      { x: 370, w: 70, h: 160 },
      { x: 500, w: 90, h: 200 },
      { x: 650, w: 110, h: 240 },
      { x: 820, w: 75, h: 170 },
      { x: 950, w: 95, h: 210 }
    ];
    
    for (const b of buildings) {
      ctx.fillStyle = buildingColor;
      ctx.fillRect(b.x, baseY - b.h, b.w, b.h);
      
      // Pointed roof
      ctx.beginPath();
      ctx.moveTo(b.x - 5, baseY - b.h);
      ctx.lineTo(b.x + b.w / 2, baseY - b.h - 40);
      ctx.lineTo(b.x + b.w + 5, baseY - b.h);
      ctx.closePath();
      ctx.fill();
      
      // Windows with warm light if not dark scene
      if (!dark) {
        ctx.fillStyle = 'rgba(255, 205, 70, 0.4)';
        ctx.shadowColor = '#ffbb00';
        for (let wy = baseY - b.h + 30; wy < baseY - 20; wy += 40) {
          for (let wx = b.x + 10; wx < b.x + b.w - 15; wx += 25) {
            ctx.shadowBlur = Math.random() < 0.1 ? 6 : 1;
            if (Math.random() < 0.8) {
              ctx.fillRect(wx, wy, 12, 15);
            }
          }
        }
        ctx.shadowBlur = 0;
      }
    }
  }

  _drawWater(ctx, time, colorOverride) {
    const baseY = 480;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Layer 1: Deep back water wave
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= w; x += 10) {
      const y = baseY + Math.sin(x * 0.01 + time * 1.2) * 5
                       + Math.cos(x * 0.005 + time * 0.8) * 3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = colorOverride 
      ? colorOverride 
      : `rgba(${this.waterColor.r - 4}, ${this.waterColor.g - 4}, ${this.waterColor.b - 8}, 0.8)`;
    ctx.fill();
    ctx.restore();

    // Layer 2: Main foreground wave
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= w; x += 4) {
      const y = baseY + Math.sin(x * 0.015 + time * 2) * 8
                       + Math.sin(x * 0.008 + time * 1.3) * 5
                       + Math.sin(x * 0.03 + time * 3) * 3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();

    if (colorOverride) {
      ctx.fillStyle = colorOverride;
    } else {
      ctx.fillStyle = `rgb(${this.waterColor.r}, ${this.waterColor.g}, ${this.waterColor.b})`;
    }
    ctx.fill();

    // Wave highlights
    ctx.strokeStyle = colorOverride
      ? 'rgba(100, 255, 100, 0.18)'
      : 'rgba(100, 180, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const y = baseY + Math.sin(x * 0.015 + time * 2) * 8
                       + Math.sin(x * 0.008 + time * 1.3) * 5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _generateLightning(startX, startY, endY) {
    const points = [{ x: startX, y: startY }];
    let x = startX;
    let y = startY;
    const segments = 12 + Math.floor(Math.random() * 8);
    const stepY = (endY - startY) / segments;
    for (let i = 0; i < segments; i++) {
      x += (Math.random() - 0.5) * 80;
      y += stepY;
      points.push({ x, y });
      // Fork occasionally
      if (Math.random() < 0.25 && i > 2) {
        const forkLen = 3 + Math.floor(Math.random() * 4);
        let fx = x, fy = y;
        const fork = [];
        for (let f = 0; f < forkLen; f++) {
          fx += (Math.random() - 0.5) * 60 + (Math.random() > 0.5 ? 30 : -30);
          fy += stepY * 0.7;
          fork.push({ x: fx, y: fy });
        }
        points.push({ fork: true, forkPoints: [{ x, y }, ...fork] });
      }
    }
    return points;
  }

  _drawLightning(ctx, bolt) {
    if (!bolt) return;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#aaccff';
    ctx.beginPath();
    for (let i = 0; i < bolt.length; i++) {
      if (bolt[i].fork) {
        // Draw fork
        ctx.stroke();
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        const fp = bolt[i].forkPoints;
        ctx.moveTo(fp[0].x, fp[0].y);
        for (let f = 1; f < fp.length; f++) {
          ctx.lineTo(fp[f].x, fp[f].y);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.lineWidth = 3;
      } else {
        if (i === 0) ctx.moveTo(bolt[i].x, bolt[i].y);
        else ctx.lineTo(bolt[i].x, bolt[i].y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawGates(ctx, rustProg) {
    const cx = this.canvas.width / 2;
    const gateW = 80;
    const gateH = 350;
    const gateY = 120;
    const gap = 40;

    // Left gate
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(cx - gap - gateW, gateY, gateW, gateH);
    // Right gate
    ctx.fillRect(cx + gap, gateY, gateW, gateH);

    // Chains (X pattern)
    ctx.strokeStyle = '#555566';
    ctx.lineWidth = 4;
    // Left gate chains
    ctx.beginPath();
    ctx.moveTo(cx - gap - gateW, gateY);
    ctx.lineTo(cx - gap, gateY + gateH);
    ctx.moveTo(cx - gap, gateY);
    ctx.lineTo(cx - gap - gateW, gateY + gateH);
    ctx.stroke();
    // Right gate chains
    ctx.beginPath();
    ctx.moveTo(cx + gap, gateY);
    ctx.lineTo(cx + gap + gateW, gateY + gateH);
    ctx.moveTo(cx + gap + gateW, gateY);
    ctx.lineTo(cx + gap, gateY + gateH);
    ctx.stroke();

    // Rust overlay on chains
    if (rustProg > 0) {
      ctx.strokeStyle = `rgba(204, 102, 34, ${Math.min(1, rustProg)})`;
      ctx.lineWidth = 6;
      const rustLen = Math.min(1, rustProg);
      // Left gate rust
      ctx.beginPath();
      ctx.moveTo(cx - gap - gateW, gateY);
      ctx.lineTo(
        cx - gap - gateW + gateW * rustLen,
        gateY + gateH * rustLen
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - gap, gateY);
      ctx.lineTo(
        cx - gap - gateW * rustLen,
        gateY + gateH * rustLen
      );
      ctx.stroke();
      // Right gate rust
      ctx.beginPath();
      ctx.moveTo(cx + gap, gateY);
      ctx.lineTo(
        cx + gap + gateW * rustLen,
        gateY + gateH * rustLen
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + gap + gateW, gateY);
      ctx.lineTo(
        cx + gap + gateW - gateW * rustLen,
        gateY + gateH * rustLen
      );
      ctx.stroke();
    }
  }

  _drawBoy(ctx, x, y) {
    // Simple silhouette of a boy
    ctx.fillStyle = '#111122';
    // Head
    ctx.beginPath();
    ctx.arc(x, y - 50, 10, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillRect(x - 6, y - 40, 12, 30);
    // Legs
    ctx.fillRect(x - 6, y - 10, 5, 18);
    ctx.fillRect(x + 1, y - 10, 5, 18);
    // Arm reaching out
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 35);
    ctx.lineTo(x + 30, y - 42);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#111122';
    ctx.stroke();
  }

  _drawVeins(ctx, originX, originY, time, progress) {
    ctx.strokeStyle = '#003311';
    ctx.lineWidth = 2;
    const branchCount = 6;
    for (let b = 0; b < branchCount; b++) {
      const angle = -Math.PI / 2 + (b / branchCount - 0.5) * Math.PI * 0.8;
      const maxLen = 60 * progress;
      const segments = 8;
      ctx.beginPath();
      let px = originX, py = originY;
      ctx.moveTo(px, py);
      for (let s = 0; s < segments; s++) {
        const segLen = maxLen / segments;
        px += Math.cos(angle + (Math.random() - 0.5) * 0.4) * segLen;
        py += Math.sin(angle + (Math.random() - 0.5) * 0.4) * segLen;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  update(dt) {
    if (this.complete) return;

    // Fade in from black at scene start
    if (this.sceneTime < 0.5) {
      this.fadeAlpha = 1 - this.sceneTime / 0.5;
    } else {
      this.fadeAlpha = 0;
    }

    // Init scene on first frame
    if (!this.sceneInited) {
      this._initScene(this.currentScene);
    }

    this.sceneTime += dt;

    // Typewriter update
    this.typewriterTimer += dt * 1000;
    if (this.typewriterTimer >= this.typewriterSpeed && this.typewriterIndex < this.typewriterText.length) {
      this.typewriterIndex++;
      this.typewriterTimer = 0;
    }

    // Scene-specific updates
    this._updateScene(this.currentScene, dt);

    // Update particles
    this.particles.update(dt);

    // Check scene end
    const dur = this.sceneDurations[this.currentScene];
    if (this.sceneTime >= dur) {
      // Transition to next scene
      if (this.currentScene >= this.sceneDurations.length - 1) {
        this.complete = true;
        this.particles.clear();
        this.audio.stopAll();
        return;
      }
      this.currentScene++;
      this.sceneTime = 0;
      this.sceneInited = false;
      this.fadeAlpha = 1;
      this.particles.clear();
    }
  }

  _updateScene(idx, dt) {
    switch (idx) {
      case 0: // Flooded Village
        this.particles.emitRain(1280);
        this.lightningTimer += dt;
        if (this.lightningTimer >= 2.5) {
          this.lightningTimer = 0;
          this.lightningAlpha = 0.6;
          this.lightningBolt = this._generateLightning(
            200 + Math.random() * 900, 0, 420
          );
          this.audio.playThunder();
        }
        if (this.lightningAlpha > 0) {
          this.lightningAlpha -= dt * 3;
          if (this.lightningAlpha < 0) {
            this.lightningAlpha = 0;
            this.lightningBolt = null;
          }
        }
        break;

      case 1: // Poisoning
        if (this.sceneTime > 2) {
          // Toxic particles from alien toward water
          const alienX = Math.min(1280, 1280 - (this.sceneTime < 2 ? 0 : (this.sceneTime - 2) * 0) + 200);
          this.particles.emitToxic(1000 + Math.random() * 80, 300 + Math.random() * 100);
          // Interpolate water color to green
          const t = Math.min(1, (this.sceneTime - 2) / 5);
          this.waterColor = {
            r: Math.floor(13 + (30 - 13) * t),
            g: Math.floor(27 + (120 - 27) * t),
            b: Math.floor(42 + (30 - 42) * t)
          };
        }
        break;

      case 2: // Rust & Monster
        if (this.sceneTime < 3) {
          this.rustProgress = this.sceneTime / 3;
          // Rust particles from chains
          const cx = this.canvas.width / 2;
          this.particles.emitRust(cx + (Math.random() - 0.5) * 120, 200 + Math.random() * 200);
        }
        if (this.sceneTime >= 5 && this.sceneTime < 5.3) {
          // Screen shake and flash
          this.shakeX = (Math.random() - 0.5) * 15;
          this.shakeY = (Math.random() - 0.5) * 15;
          this.lightningAlpha = 0.5;
        } else {
          this.shakeX *= 0.9;
          this.shakeY *= 0.9;
          if (this.lightningAlpha > 0) this.lightningAlpha -= dt * 4;
        }
        break;

      case 3: // Outbreak
        // Monster splitting
        if (this.sceneTime >= 1 && this.monsterCount < 2) {
          this.monsterCount = 2;
          this.particles.emitSparks(640, 360);
        }
        if (this.sceneTime >= 2 && this.monsterCount < 4) {
          this.monsterCount = 4;
          this.particles.emitSparks(640, 360);
        }
        if (this.sceneTime >= 3 && this.monsterCount < 8) {
          this.monsterCount = 8;
          this.particles.emitSparks(640, 360);
        }
        // Fire particles
        this.particles.emitFire(Math.random() * 1280, 600 + Math.random() * 120);
        // Constant shake
        this.shakeX = (Math.random() - 0.5) * 8;
        this.shakeY = (Math.random() - 0.5) * 8;
        break;

      case 4: // Launch
        if (this.sceneTime >= 3 && this.sceneTime < 3.1) {
          this.typewrite('Seeking the alien on the red planet Mars to claim the antidote...', 40);
        }
        // Fade out in last 2 seconds
        if (this.sceneTime > 6) {
          this.fadeAlpha = (this.sceneTime - 6) / 2;
        }
        break;
    }
  }

  render(ctx) {
    if (this.complete) return;

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    switch (this.currentScene) {
      case 0:
        this._renderScene0(ctx);
        break;
      case 1:
        this._renderScene1(ctx);
        break;
      case 2:
        this._renderScene2(ctx);
        break;
      case 3:
        this._renderScene3(ctx);
        break;
      case 4:
        this._renderScene4(ctx);
        break;
    }

    // Render particles
    this.particles.render(ctx);

    // Render typewriter
    this.renderTypewriter(ctx);

    ctx.restore();

    // Fade overlay (not affected by shake)
    if (this.fadeAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, this.fadeAlpha)})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  _drawFog(ctx, time) {
    ctx.save();
    ctx.filter = 'blur(45px)';
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#7a8ba8';
    
    for (let i = 0; i < 3; i++) {
      const fx = ((time * 40 + i * 500) % 1600) - 200;
      const fy = 350 + Math.sin(time * 0.8 + i) * 15;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 280, 50, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _renderScene0(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a0a2e');
    grad.addColorStop(0.5, '#1a1a3e');
    grad.addColorStop(1, '#0d1b2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Buildings
    this._drawBuildings(ctx, false);

    // Water
    this._drawWater(ctx, this.sceneTime);

    // Volumetric fog overlay
    this._drawFog(ctx, this.sceneTime);

    // Lightning flash
    if (this.lightningAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.lightningAlpha})`;
      ctx.fillRect(0, 0, w, h);
      this._drawLightning(ctx, this.lightningBolt);
    }
  }

  _renderScene1(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Darker background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#060620');
    grad.addColorStop(0.5, '#111130');
    grad.addColorStop(1, '#0a1520');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Buildings (darker)
    this._drawBuildings(ctx, true);

    // Water (color changes over time)
    this._drawWater(ctx, this.sceneTime);

    // Volumetric fog overlay
    this._drawFog(ctx, this.sceneTime);

    // Green glow on water surface
    if (this.sceneTime > 2) {
      const glowIntensity = Math.min(1, (this.sceneTime - 2) / 3);
      ctx.save();
      ctx.shadowBlur = 20 * glowIntensity;
      ctx.shadowColor = '#00ff44';
      ctx.strokeStyle = `rgba(0, 255, 68, ${0.3 * glowIntensity})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = 480 + Math.sin(x * 0.015 + this.sceneTime * 2) * 8;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Alien sprite slides in from right
    if (this.images.alien) {
      const slideT = Math.min(1, this.sceneTime / 2);
      const alienX = w + 100 - slideT * (w * 0.3 + 100);
      const bobY = 250 + Math.sin(this.sceneTime * 2) * 15;
      const spriteW = 120;
      const spriteH = 160;
      ctx.drawImage(this.images.alien, alienX - spriteW / 2, bobY - spriteH / 2, spriteW, spriteH);
    }
  }

  _renderScene2(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark background
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, w, h);

    // Gates with rust
    this._drawGates(ctx, this.rustProgress);

    // Boy at 3-5s
    if (this.sceneTime >= 3 && this.sceneTime < 5) {
      const cx = this.canvas.width / 2;
      this._drawBoy(ctx, cx + 120, 380);

      // Veins at 4s+
      if (this.sceneTime >= 4) {
        const veinProg = Math.min(1, (this.sceneTime - 4) / 1);
        this._drawVeins(ctx, cx + 150, 345, this.sceneTime, veinProg);
      }
    }

    // Monster appears at 5s+
    if (this.sceneTime >= 5 && this.images.monster) {
      const growT = Math.min(1, (this.sceneTime - 5) / 2);
      const size = 60 + growT * 140;
      const cx = this.canvas.width / 2 + 120;
      const cy = 340;
      ctx.drawImage(this.images.monster, cx - size / 2, cy - size / 2, size, size);
    }

    // Flash
    if (this.lightningAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, this.lightningAlpha)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  _renderScene3(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark red-tinged background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a0808');
    grad.addColorStop(0.5, '#2a0a0a');
    grad.addColorStop(1, '#1a0505');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fire glow at bottom
    const fireGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
    fireGrad.addColorStop(0, 'rgba(255, 80, 0, 0)');
    fireGrad.addColorStop(0.5, 'rgba(255, 80, 0, 0.15)');
    fireGrad.addColorStop(1, 'rgba(255, 40, 0, 0.3)');
    ctx.fillStyle = fireGrad;
    ctx.fillRect(0, 0, w, h);

    // Burning buildings
    ctx.save();
    this._drawBuildings(ctx, true);
    // Orange highlights on buildings
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 100, 20, 0.15)';
    const buildings = [
      { x: 100, w: 80, h: 180 },
      { x: 220, w: 100, h: 220 },
      { x: 370, w: 70, h: 160 },
      { x: 500, w: 90, h: 200 },
      { x: 650, w: 110, h: 240 },
      { x: 820, w: 75, h: 170 },
      { x: 950, w: 95, h: 210 }
    ];
    for (const b of buildings) {
      ctx.fillRect(b.x, 420 - b.h, b.w, b.h);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Draw monsters
    if (this.images.monster) {
      const positions = this._getMonsterPositions(this.monsterCount);
      const sz = Math.max(40, 120 / Math.sqrt(this.monsterCount));
      for (const pos of positions) {
        ctx.drawImage(this.images.monster, pos.x - sz / 2, pos.y - sz / 2, sz, sz);
      }
    }
  }

  _getMonsterPositions(count) {
    const positions = [];
    const cx = this.canvas.width / 2;
    const cy = 340;
    if (count === 1) {
      positions.push({ x: cx, y: cy });
    } else {
      const spacing = Math.min(120, 800 / count);
      const startX = cx - (count - 1) * spacing / 2;
      for (let i = 0; i < count; i++) {
        positions.push({
          x: startX + i * spacing,
          y: cy + (Math.sin(i * 1.5) * 30)
        });
      }
    }
    return positions;
  }

  _renderScene4(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background - night sky with stars
    ctx.fillStyle = '#050515';
    ctx.fillRect(0, 0, w, h);

    // Render some stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 50; i++) {
      const sx = (Math.sin(i * 123) * 0.5 + 0.5) * w;
      const sy = (Math.cos(i * 456) * 0.5 + 0.5) * (h * 0.6);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Land/Ground at bottom
    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    
    // Water line
    this._drawWater(ctx, this.sceneTime, '#0a1a10'); // Greenish-black toxic water

    // Draw launch pad tower (gantry structure)
    const launchX = w / 2;
    const padY = h * 0.72;
    ctx.strokeStyle = '#222233';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(launchX - 60, padY);
    ctx.lineTo(launchX - 60, padY - 200);
    ctx.lineTo(launchX - 30, padY - 200);
    ctx.lineTo(launchX - 30, padY);
    // cross braces
    for (let y = padY - 40; y > padY - 200; y -= 40) {
      ctx.moveTo(launchX - 60, y);
      ctx.lineTo(launchX - 30, y - 40);
      ctx.moveTo(launchX - 30, y);
      ctx.lineTo(launchX - 60, y - 40);
    }
    ctx.stroke();

    // Spaceship position
    let shipX = launchX;
    let shipY = padY - 60;
    
    // Launch logic based on time
    if (this.sceneTime > 2) {
      const t = Math.max(0, this.sceneTime - 2);
      // Accelerating movement upwards
      const accel = 60; // acceleration rate
      shipY -= 0.5 * accel * t * t;
      
      // Screen shake during thruster firing
      if (shipY > -100) {
        this.shakeX = (Math.random() - 0.5) * Math.min(15, t * 5);
        this.shakeY = (Math.random() - 0.5) * Math.min(15, t * 5);
        
        // Emit thruster fire particles
        this.particles.emitFire(shipX, shipY + 30);
      }
    } else {
      // Pre-launch steam/condensation
      if (Math.random() < 0.3) {
        this.particles.emit({
          x: shipX,
          y: shipY + 20,
          count: 2,
          color: ['#cccccc', '#dddddd', '#eeeeee'],
          speedMin: 10,
          speedMax: 30,
          life: 1.5,
          sizeMin: 3,
          sizeMax: 8,
          spread: Math.PI,
          gravity: -5,
          type: 'glow'
        });
      }
    }

    // Draw spaceship sprite (faced upwards)
    if (this.images.spaceship) {
      const shipW = 100;
      const shipH = 120;
      ctx.save();
      ctx.translate(shipX, shipY);
      ctx.rotate(-Math.PI / 2); // Rotate upward
      ctx.drawImage(this.images.spaceship, -shipH / 2, -shipW / 2, shipH, shipW);
      ctx.restore();
    } else {
      // Fallback spaceship shape
      ctx.fillStyle = '#445566';
      ctx.beginPath();
      ctx.moveTo(shipX, shipY - 40);
      ctx.lineTo(shipX - 25, shipY + 20);
      ctx.lineTo(shipX + 25, shipY + 20);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ============================================================
// StarfieldTransition
// ============================================================
class StarfieldTransition {
  constructor(canvas) {
    this.canvas = canvas;
    this.stars = [];
    this.time = 0;
    this.complete = false;
    this.speed = 1;
    this.spaceship = null;

    for (let i = 0; i < 400; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 900,
        z: Math.random() * 1000 + 1,
        prevScreenX: 0,
        prevScreenY: 0
      });
    }
  }

  start(spaceshipImage) {
    this.spaceship = spaceshipImage || null;
    this.time = 0;
    this.complete = false;
    this.speed = 1;
    // Reset stars
    for (let i = 0; i < this.stars.length; i++) {
      this.stars[i].x = (Math.random() - 0.5) * 1600;
      this.stars[i].y = (Math.random() - 0.5) * 900;
      this.stars[i].z = Math.random() * 1000 + 1;
      this.stars[i].prevScreenX = 0;
      this.stars[i].prevScreenY = 0;
    }
  }

  update(dt) {
    if (this.complete) return;
    this.time += dt;
    this.speed = 1 + this.time * 8;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      // Store previous screen position
      s.prevScreenX = centerX + s.x / s.z * 500;
      s.prevScreenY = centerY + s.y / s.z * 500;

      // Move star toward camera
      s.z -= this.speed * dt * 200;

      // Reset stars that pass camera
      if (s.z <= 1) {
        s.x = (Math.random() - 0.5) * 1600;
        s.y = (Math.random() - 0.5) * 900;
        s.z = 800 + Math.random() * 200;
        s.prevScreenX = centerX + s.x / s.z * 500;
        s.prevScreenY = centerY + s.y / s.z * 500;
      }
    }

    if (this.time >= 5) {
      this.complete = true;
    }
  }

  render(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // 1. Draw Earth (shrinking and moving to bottom-left)
    if (this.time < 2.5) {
      const earthAlpha = 1 - (this.time / 2.5);
      // Earth starts at size 150px and shrinks
      const earthSize = 150 * Math.pow(0.5, this.time);
      const earthX = centerX - this.time * 240;
      const earthY = centerY + this.time * 120;

      ctx.save();
      ctx.globalAlpha = earthAlpha;
      
      // Atmospheric glow
      const earthGlow = ctx.createRadialGradient(earthX, earthY, earthSize * 0.8, earthX, earthY, earthSize * 1.25);
      earthGlow.addColorStop(0, 'rgba(0, 160, 255, 0.35)');
      earthGlow.addColorStop(1, 'rgba(0, 0, 255, 0)');
      ctx.fillStyle = earthGlow;
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthSize * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Earth body
      const earthBody = ctx.createRadialGradient(earthX - earthSize * 0.2, earthY - earthSize * 0.2, 0, earthX, earthY, earthSize);
      earthBody.addColorStop(0, '#4da6ff');
      earthBody.addColorStop(0.7, '#004d99');
      earthBody.addColorStop(1, '#001326');
      ctx.fillStyle = earthBody;
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthSize, 0, Math.PI * 2);
      ctx.fill();

      // Continents (green markings)
      ctx.fillStyle = '#33cc59';
      ctx.beginPath();
      ctx.arc(earthX - earthSize * 0.35, earthY - earthSize * 0.15, earthSize * 0.35, 0, Math.PI * 2);
      ctx.arc(earthX + earthSize * 0.15, earthY + earthSize * 0.3, earthSize * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 2. Draw Volcanic Lava Planet (growing in center)
    if (this.time > 1.2) {
      const lavaAlpha = Math.min(1, (this.time - 1.2) / 1.5);
      // Planet grows from 2px to 380px at the end
      const planetSize = 2 + Math.pow((this.time - 1.2) / 3.8, 3.2) * 370;
      const planetX = centerX;
      const planetY = centerY;

      ctx.save();
      ctx.globalAlpha = lavaAlpha;

      // Volcanic boiling atmospheric orange-red glow
      const atmosphereGlow = ctx.createRadialGradient(planetX, planetY, planetSize * 0.8, planetX, planetY, planetSize * 1.25);
      atmosphereGlow.addColorStop(0, 'rgba(255, 60, 0, 0.45)');
      atmosphereGlow.addColorStop(0.5, 'rgba(255, 100, 0, 0.2)');
      atmosphereGlow.addColorStop(1, 'rgba(200, 30, 0, 0)');
      ctx.fillStyle = atmosphereGlow;
      ctx.beginPath();
      ctx.arc(planetX, planetY, planetSize * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Lava planet body (dark obsidian with fiery base)
      const planetBody = ctx.createRadialGradient(planetX - planetSize * 0.15, planetY - planetSize * 0.15, 0, planetX, planetY, planetSize);
      planetBody.addColorStop(0, '#ffbb00'); // Molten center
      planetBody.addColorStop(0.3, '#cc3300'); // Cooling red-orange lava
      planetBody.addColorStop(0.7, '#250802'); // Hardening basalt
      planetBody.addColorStop(1, '#0c0200'); // Dark obsidian crust
      ctx.fillStyle = planetBody;
      ctx.beginPath();
      ctx.arc(planetX, planetY, planetSize, 0, Math.PI * 2);
      ctx.fill();

      // Glowing lava fissures/cracks (intersecting lines)
      ctx.strokeStyle = '#ff3300';
      ctx.lineWidth = Math.max(1, planetSize * 0.03);
      ctx.shadowBlur = Math.max(1, planetSize * 0.15);
      ctx.shadowColor = '#ff6600';
      
      ctx.beginPath();
      // Draw a network of glowing lava fissures across the planet surface
      ctx.arc(planetX - planetSize * 0.2, planetY - planetSize * 0.1, planetSize * 0.5, -Math.PI*0.3, Math.PI*0.7);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(planetX + planetSize * 0.3, planetY + planetSize * 0.2, planetSize * 0.4, Math.PI*0.6, Math.PI*1.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(planetX - planetSize * 0.6, planetY + planetSize * 0.1);
      ctx.quadraticCurveTo(planetX - planetSize * 0.1, planetY - planetSize * 0.3, planetX + planetSize * 0.4, planetY - planetSize * 0.5);
      ctx.stroke();
      
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Draw stars as streaks
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const screenX = centerX + s.x / s.z * 500;
      const screenY = centerY + s.y / s.z * 500;

      // Skip off-screen stars
      if (screenX < -50 || screenX > w + 50 || screenY < -50 || screenY > h + 50) continue;

      const brightness = Math.min(1, (1000 - s.z) / 600);

      // Color: warm white/tinted
      ctx.strokeStyle = `rgba(255, ${230 + Math.floor(brightness * 25)}, ${210 + Math.floor(brightness * 45)}, ${brightness})`;
      ctx.lineWidth = Math.max(0.5, 2 * brightness);

      ctx.beginPath();
      ctx.moveTo(s.prevScreenX, s.prevScreenY);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();
    }

    // Draw spaceship at center
    ctx.save();
    
    // Atmospheric entry glow around the ship (t > 4.2)
    if (this.time > 4.2) {
      const frictionIntensity = (this.time - 4.2) / 0.8; // 0 to 1
      ctx.shadowBlur = 35 * frictionIntensity;
      ctx.shadowColor = '#ff6600';
      
      // Fire shield glow circle
      ctx.fillStyle = `rgba(255, 90, 0, ${0.3 * frictionIntensity})`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 70, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.spaceship) {
      const scale = 0.3 + (this.time / 5) * 0.7; // 0.3 to 1.0
      const shipW = 120 * scale;
      const shipH = 80 * scale;
      ctx.drawImage(this.spaceship, centerX - shipW / 2, centerY - shipH / 2, shipW, shipH);
    } else {
      // Draw a simple ship shape if no image
      const scale = 0.3 + (this.time / 5) * 0.7;
      const sz = 40 * scale;
      ctx.fillStyle = '#aabbcc';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - sz);
      ctx.lineTo(centerX - sz * 0.6, centerY + sz * 0.5);
      ctx.lineTo(centerX + sz * 0.6, centerY + sz * 0.5);
      ctx.closePath();
      ctx.fill();
      // Engine glow
      ctx.fillStyle = '#44aaff';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowColor = '#44aaff';
      ctx.beginPath();
      ctx.arc(centerX, centerY + sz * 0.5, sz * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    
    ctx.restore();

    // White flash growing at time > 4.8s
    if (this.time > 4.8) {
      const flashT = (this.time - 4.8) / 0.2; // 0 to 1 over last 0.2s
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, flashT * flashT)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  isComplete() {
    return this.complete;
  }
}

// ============================================================
// Attach to window
// ============================================================
window.ParticleSystem = ParticleSystem;
window.AudioManager = AudioManager;
window.CinematicEngine = CinematicEngine;
window.StarfieldTransition = StarfieldTransition;
