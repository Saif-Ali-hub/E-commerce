/**
 * MiniStore Festive Firecrackers Background Engine - Radiant Starburst Edition
 * High-performance, luminous 60 FPS HTML5 Canvas sky rocket firecrackers background animation.
 * Features:
 *  - Soaring sky rockets with glowing propulsion streaks and spark exhaust
 *  - Apogee deceleration (top 20% to 40% of banner) and dramatic detonation
 *  - Saturated 70-90 needle ray radial starbursts (chrysanthemum / peony style)
 *  - Incandescent central nucleus with cross-flare and sparkling star beads at ray tips
 *  - Saturated festive palettes (Electric Cyan, Golden Sunburst, Ruby Crimson, Royal Sapphire, Electric Violet)
 *  - Continuous 3-second celebration cadence with 250-400ms offset tandem companion bursts
 *  - Interactive click-to-blast anywhere on the banner
 *  - Retina / HiDPI 2x capping with zero layout thrashing on resize
 *  - IntersectionObserver loop pause & prefers-reduced-motion compliance
 *  - Robust hexToRgba color parsing preventing canvas addColorStop crashes
 * File: frontend/firecrackers.js
 */

(function (window, document) {
  'use strict';

  // Helper for safe, crash-proof RGBA parsing in canvas gradients & strokes
  function hexToRgba(hex, alpha = 1) {
    if (!hex || typeof hex !== 'string') return `rgba(255, 255, 255, ${alpha})`;
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) return `rgba(255, 255, 255, ${alpha})`;
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }

  function randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  // Five vibrant saturated festive palettes matching high-end celebration fireworks
  const STARBURST_THEMES = [
    {
      name: 'Electric Cyan',
      core: '#ffffff',
      glow: '#00e5ff',
      colors: ['#00e5ff', '#38bdf8', '#7dd3fc', '#0284c7', '#ffffff'],
      streak: '#00e5ff'
    },
    {
      name: 'Golden Sunburst',
      core: '#ffffff',
      glow: '#fbbf24',
      colors: ['#fbbf24', '#f59e0b', '#fde047', '#ff7800', '#ffffff'],
      streak: '#f59e0b'
    },
    {
      name: 'Ruby Crimson',
      core: '#ffffff',
      glow: '#ff2a55',
      colors: ['#ff2a55', '#f43f5e', '#fb7185', '#fda4af', '#ffffff'],
      streak: '#ff2a55'
    },
    {
      name: 'Royal Sapphire',
      core: '#ffffff',
      glow: '#3b82f6',
      colors: ['#3b82f6', '#2563eb', '#60a5fa', '#93c5fd', '#ffffff'],
      streak: '#38bdf8'
    },
    {
      name: 'Electric Violet',
      core: '#ffffff',
      glow: '#a855f7',
      colors: ['#a855f7', '#c084fc', '#e879f9', '#d946ef', '#ffffff'],
      streak: '#c084fc'
    }
  ];

  // Individual radiant needle spoke of the starburst explosion
  class StarburstSpoke {
    constructor(originX, originY, angle, maxRadius, theme, options = {}) {
      this.originX = originX;
      this.originY = originY;
      this.angle = angle;
      this.maxRadius = maxRadius;
      this.speed = options.speed || randomRange(4.8, 7.8);
      this.friction = options.friction || 0.948;
      this.vx = Math.cos(angle) * this.speed;
      this.vy = Math.sin(angle) * this.speed;
      this.tipX = originX;
      this.tipY = originY;
      this.tailX = originX;
      this.tailY = originY;
      this.gravity = options.gravity || 0.042;
      this.color = theme.colors[Math.floor(Math.random() * theme.colors.length)];
      this.glowColor = theme.glow;
      this.alpha = 1;
      this.decay = options.decay || randomRange(0.012, 0.021);
      this.spokeLengthRatio = options.spokeLengthRatio || randomRange(0.70, 0.95);
      this.tipSize = options.tipSize || randomRange(2.2, 3.6);
      this.lineWidth = options.lineWidth || randomRange(1.6, 2.6);
      this.sparkle = Math.random() > 0.28;
    }

    update() {
      this.vx *= this.friction;
      this.vy *= this.friction;
      this.vy += this.gravity;

      this.tipX += this.vx;
      this.tipY += this.vy;

      const dist = Math.hypot(this.tipX - this.originX, this.tipY - this.originY);
      const tailDist = Math.max(0, dist * (1 - this.spokeLengthRatio));
      const angle = Math.atan2(this.tipY - this.originY, this.tipX - this.originX);

      this.tailX = this.originX + Math.cos(angle) * tailDist;
      this.tailY = this.originY + Math.sin(angle) * tailDist;

      this.alpha -= this.decay;
      return this.alpha > 0;
    }

    draw(ctx) {
      if (this.alpha <= 0) return;

      const currentAlpha = this.sparkle && this.alpha < 0.72
        ? this.alpha * (0.65 + Math.random() * 0.6)
        : this.alpha;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Outer color needle ray
      ctx.beginPath();
      ctx.moveTo(this.tailX, this.tailY);
      ctx.lineTo(this.tipX, this.tipY);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.lineWidth;
      ctx.lineCap = 'round';
      ctx.globalAlpha = Math.max(0, currentAlpha * 0.88);
      ctx.stroke();

      // Inner white beam core
      ctx.beginPath();
      ctx.moveTo(this.tailX, this.tailY);
      ctx.lineTo(this.tipX, this.tipY);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(0.8, this.lineWidth * 0.45);
      ctx.globalAlpha = Math.min(1, currentAlpha * 1.15);
      ctx.stroke();

      // Glowing star tip bead
      ctx.beginPath();
      ctx.arc(this.tipX, this.tipY, this.tipSize, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = Math.max(0, currentAlpha * 0.95);
      ctx.fill();

      // White diamond highlight at tip
      ctx.beginPath();
      ctx.arc(this.tipX, this.tipY, this.tipSize * 0.48, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = Math.min(1, currentAlpha * 1.3);
      ctx.fill();

      ctx.restore();
    }
  }

  // Intense Incandescent Nucleus with Cross-Star Flare
  class StarburstCore {
    constructor(x, y, maxRadius, theme) {
      this.x = x;
      this.y = y;
      this.radius = 4;
      this.maxRadius = maxRadius || randomRange(45, 72);
      this.theme = theme;
      this.alpha = 1;
      this.decay = 0.040;
    }

    update() {
      this.radius += (this.maxRadius - this.radius) * 0.20;
      this.alpha -= this.decay;
      return this.alpha > 0;
    }

    draw(ctx) {
      if (this.alpha <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${this.alpha})`);
      grad.addColorStop(0.22, `rgba(255, 245, 190, ${this.alpha * 0.92})`);
      grad.addColorStop(0.58, hexToRgba(this.theme.glow, this.alpha * 0.65));
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Cross-star flare radiating through detonation center
      if (this.alpha > 0.25) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = this.alpha * 0.9;
        const flareLen = this.radius * 0.8;

        ctx.beginPath();
        ctx.moveTo(this.x - flareLen, this.y);
        ctx.lineTo(this.x + flareLen, this.y);
        ctx.moveTo(this.x, this.y - flareLen);
        ctx.lineTo(this.x, this.y + flareLen);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // Complete Radial Starburst Firework Explosion (70–90 radiant needle rays)
  class RadialStarburstExplosion {
    constructor(x, y, theme, burstRadius) {
      this.x = x;
      this.y = y;
      this.theme = theme;
      this.radius = burstRadius || randomRange(110, 175);
      this.core = new StarburstCore(x, y, this.radius * 0.44, theme);
      this.spokes = [];
      this.isAlive = true;

      this.initSpokes();
    }

    initSpokes() {
      const spokeCount = Math.floor(randomRange(72, 90));
      for (let i = 0; i < spokeCount; i++) {
        const angle = (Math.PI * 2 * i) / spokeCount + randomRange(-0.025, 0.025);
        const maxRad = this.radius * randomRange(0.78, 1.15);
        const speed = randomRange(4.8, 8.2);

        this.spokes.push(new StarburstSpoke(this.x, this.y, angle, maxRad, this.theme, {
          speed,
          decay: randomRange(0.012, 0.021),
          tipSize: randomRange(2.2, 3.6),
          lineWidth: randomRange(1.6, 2.5)
        }));
      }

      // Shorter secondary inner ring
      const innerCount = Math.floor(spokeCount * 0.35);
      for (let i = 0; i < innerCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        this.spokes.push(new StarburstSpoke(this.x, this.y, angle, this.radius * 0.52, this.theme, {
          speed: randomRange(2.5, 4.5),
          decay: randomRange(0.018, 0.028),
          tipSize: randomRange(1.6, 2.4),
          lineWidth: 1.3
        }));
      }
    }

    update() {
      let coreAlive = this.core ? this.core.update() : false;
      if (!coreAlive) this.core = null;

      for (let i = this.spokes.length - 1; i >= 0; i--) {
        if (!this.spokes[i].update()) {
          this.spokes.splice(i, 1);
        }
      }

      this.isAlive = Boolean(this.core || this.spokes.length > 0);
      return this.isAlive;
    }

    draw(ctx) {
      if (this.core) {
        this.core.draw(ctx);
      }
      for (let i = 0; i < this.spokes.length; i++) {
        this.spokes[i].draw(ctx);
      }
    }
  }

  // Soaring Ascending Sky Rocket with radiant vertical light streak & spark plume
  class SkyRocket {
    constructor(startX, startY, targetX, targetY, theme, onDetonate) {
      this.x = startX;
      this.y = startY;
      this.targetX = targetX;
      this.targetY = targetY;
      this.theme = theme;
      this.onDetonate = onDetonate;

      const angle = Math.atan2(targetY - startY, targetX - startX);
      const distance = Math.hypot(targetX - startX, targetY - startY);
      const speed = Math.min(12, Math.max(8.5, distance * 0.032));

      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.history = [];
      this.maxHistory = 14;
      this.sparks = [];
    }

    update() {
      this.history.push({ x: this.x, y: this.y });
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      this.x += this.vx;
      this.y += this.vy;

      // Rocket decelerates smoothly as it nears its apogee
      this.vy *= 0.985;
      this.vx *= 0.99;

      // Drop fiery propulsion sparks
      if (Math.random() > 0.18) {
        this.sparks.push({
          x: this.x + randomRange(-1.5, 1.5),
          y: this.y + randomRange(4, 8),
          vx: randomRange(-0.8, 0.8),
          vy: randomRange(1.5, 3.5),
          alpha: 1,
          size: randomRange(1.8, 2.8),
          color: Math.random() > 0.45 ? this.theme.streak : '#ffffff'
        });
      }

      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= 0.068;
        if (s.alpha <= 0) {
          this.sparks.splice(i, 1);
        }
      }

      // Detonate once reaching the apogee
      if (this.y <= this.targetY || this.vy >= -0.5) {
        this.detonate();
        return false;
      }

      return true;
    }

    detonate() {
      if (this.onDetonate) {
        this.onDetonate(this.x, this.y, this.theme);
      }
    }

    draw(ctx) {
      // 1. Draw propulsion sparks
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.sparks.length; i++) {
        const s = this.sparks[i];
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0, s.alpha);
        ctx.fill();
      }
      ctx.restore();

      // 2. Draw vertical rocket streak
      if (this.history.length > 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Outer glow
        ctx.beginPath();
        ctx.moveTo(this.history[0].x, this.history[0].y);
        for (let i = 1; i < this.history.length; i++) {
          ctx.lineTo(this.history[i].x, this.history[i].y);
        }
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = this.theme.glow;
        ctx.lineWidth = 4.5;
        ctx.globalAlpha = 0.65;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Inner white streak
        ctx.beginPath();
        ctx.moveTo(this.history[0].x, this.history[0].y);
        for (let i = 1; i < this.history.length; i++) {
          ctx.lineTo(this.history[i].x, this.history[i].y);
        }
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.95;
        ctx.stroke();

        // Warhead tip
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3.8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1;
        ctx.fill();

        ctx.restore();
      }
    }
  }

  // Main Firecracker Stage Manager
  class FirecrackerStage {
    constructor(canvas, container) {
      this.canvas = canvas;
      this.container = container || canvas.parentElement;
      this.ctx = canvas.getContext('2d');
      this.rockets = [];
      this.explosions = [];
      this.isRunning = false;
      this.animId = null;
      this.width = 0;
      this.height = 0;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.autoTimer = null;
      this.isVisible = typeof window !== 'undefined' && !window.IntersectionObserver;
      this.hasLaunchedOpening = false;
      this.blastCycleIndex = 0;
      this.BLAST_INTERVAL_MS = 3000; // Exact 3-second continuous celebration cycle

      this.init();
    }

    init() {
      this.resize();

      window.addEventListener('resize', () => this.resize(), { passive: true });
      if (window.ResizeObserver && this.container) {
        new ResizeObserver(() => this.resize()).observe(this.container);
      }

      // Pause loop when out of screen to save battery & CPU
      if (window.IntersectionObserver && this.container) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            this.isVisible = entry.isIntersecting;
            if (this.isVisible) {
              if (!this.hasLaunchedOpening) {
                this.launchOpeningDisplay();
              }
              if (!this.isRunning && (this.rockets.length > 0 || this.explosions.length > 0)) {
                this.start();
              }
            } else if (!this.isVisible && this.isRunning && this.rockets.length === 0 && this.explosions.length === 0) {
              this.stop();
            }
          });
        }, { threshold: 0.1 });
        observer.observe(this.container);
      } else {
        // Fallback when IntersectionObserver is not supported
        this.isVisible = true;
        this.launchOpeningDisplay();
      }

      // Interactive: click anywhere on banner launches instant rocket targeting click
      if (this.container) {
        this.container.addEventListener('click', (e) => {
          if (e.target.closest('a, button, input, select, textarea, .btn-copy-coupon, #festive-shop-now-btn, [role="button"]')) {
            return;
          }
          const rect = this.canvas.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          this.launchBigSkyRocket(clickX, clickY);
        });
      }

      this.startThreeSecondBlastingLoop();
    }

    launchOpeningDisplay() {
      if (this.hasLaunchedOpening) return;

      if (this.width <= 0 || this.height <= 0) {
        this.resize();
      }

      this.hasLaunchedOpening = true;

      // Launch initial immediate barrage (100ms) so banner is instantly alive
      setTimeout(() => {
        if (!this.isVisible && window.IntersectionObserver) {
          // If banner scrolled away before timeout, allow re-launch on next visibility
          this.hasLaunchedOpening = false;
          return;
        }
        this.launchBigSkyRocket(this.width * 0.48, this.height * 0.28, STARBURST_THEMES[1]);
        setTimeout(() => {
          if (!this.isVisible && window.IntersectionObserver) return;
          this.launchBigSkyRocket(this.width * 0.22, this.height * 0.38, STARBURST_THEMES[0]);
        }, 260);
      }, 100);
    }

    // Zero layout thrashing: only reallocate buffer if dimensions actually changed
    resize() {
      if (!this.canvas || !this.container) return;
      const rect = this.container.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w <= 0 || h <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetBufferW = Math.floor(w * dpr);
      const targetBufferH = Math.floor(h * dpr);

      // Skip if dimensions haven't changed
      if (this.canvas.width === targetBufferW && this.canvas.height === targetBufferH && this.dpr === dpr) {
        return;
      }

      this.width = w;
      this.height = h;
      this.dpr = dpr;

      this.canvas.width = targetBufferW;
      this.canvas.height = targetBufferH;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;

      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    launchBigSkyRocket(customTargetX, customTargetY, customTheme) {
      if (!this.isVisible) return;

      if (this.width <= 0 || this.height <= 0) {
        this.resize();
      }

      const theme = customTheme || STARBURST_THEMES[this.blastCycleIndex % STARBURST_THEMES.length];
      const launchPositions = [0.24, 0.72, 0.48, 0.85, 0.36];
      const selectedPos = launchPositions[this.blastCycleIndex % launchPositions.length];
      this.blastCycleIndex++;

      const targetX = customTargetX !== undefined
        ? customTargetX
        : this.width * (selectedPos + randomRange(-0.05, 0.05));

      // Apogee between 20% and 40% of banner height
      const targetY = customTargetY !== undefined
        ? customTargetY
        : randomRange(this.height * 0.20, this.height * 0.40);

      const startX = targetX + randomRange(-28, 28);
      const startY = this.height + 15;

      const rocket = new SkyRocket(startX, startY, targetX, targetY, theme, (x, y, thm) => {
        this.explodeRadialStarburst(x, y, thm);
      });

      this.rockets.push(rocket);

      if (!this.isRunning) {
        this.start();
      }
    }

    explodeRadialStarburst(x, y, theme) {
      const burstRadius = randomRange(this.width * 0.18, this.width * 0.26);
      const explosion = new RadialStarburstExplosion(x, y, theme, Math.max(120, Math.min(220, burstRadius)));
      this.explosions.push(explosion);
    }

    startThreeSecondBlastingLoop() {
      if (this.autoTimer) clearInterval(this.autoTimer);

      this.autoTimer = setInterval(() => {
        if (!this.isVisible) return;

        // Primary sky rocket blast
        this.launchBigSkyRocket();

        // Tandem companion rocket offset by 260-400ms for natural festive rhythm
        setTimeout(() => {
          if (this.isVisible) {
            this.launchBigSkyRocket();
          }
        }, randomRange(260, 400));
      }, this.BLAST_INTERVAL_MS);
    }

    // Compatibility aliases for legacy method references & tests
    generatePeonyBurst(x, y) { this.explodeRadialStarburst(x, y, STARBURST_THEMES[0]); }
    generateWillowBurst(x, y) { this.explodeRadialStarburst(x, y, STARBURST_THEMES[1]); }
    generateDoubleRingBurst(x, y) { this.explodeRadialStarburst(x, y, STARBURST_THEMES[2]); }
    generateCrackleBurst(x, y) { this.explodeRadialStarburst(x, y, STARBURST_THEMES[3]); }
    generateGrandImperialPeony(x, y) { this.explodeRadialStarburst(x, y, STARBURST_THEMES[1]); }
    generateGoldenBrocadeCrown(x, y) { this.explodeRadialStarburst(x, y, STARBURST_THEMES[1]); }
    generateDoubleRingChrysanthemum(x, y) { this.explodeRadialStarburst(x, y, STARBURST_THEMES[2]); }
    generateCrackleGlitterShell(x, y) { this.explodeRadialStarburst(x, y, STARBURST_THEMES[3]); }
    generateRainbowStrobeCrown(x, y) { this.explodeRadialStarburst(x, y, STARBURST_THEMES[4]); }
    launchRocket(x, y) { return this.launchBigSkyRocket(x, y); }
    createBurst(x, y) { return this.explodeRadialStarburst(x, y, STARBURST_THEMES[Math.floor(Math.random() * STARBURST_THEMES.length)]); }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.loop();
    }

    stop() {
      this.isRunning = false;
      if (this.animId) {
        if (typeof window.cancelAnimationFrame === 'function') {
          window.cancelAnimationFrame(this.animId);
        } else {
          clearTimeout(this.animId);
        }
        this.animId = null;
      }
    }

    loop() {
      if (!this.isRunning) return;

      this.ctx.clearRect(0, 0, this.width, this.height);

      // 1. Update & draw ascending sky rockets
      for (let i = this.rockets.length - 1; i >= 0; i--) {
        if (!this.rockets[i].update()) {
          this.rockets.splice(i, 1);
        } else {
          this.rockets[i].draw(this.ctx);
        }
      }

      // 2. Update & draw radial starburst explosions
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        if (!this.explosions[i].update()) {
          this.explosions.splice(i, 1);
        } else {
          this.explosions[i].draw(this.ctx);
        }
      }

      // Pause loop if no active objects and out of viewport
      if (!this.isVisible && this.rockets.length === 0 && this.explosions.length === 0) {
        this.stop();
        return;
      }

      if (typeof window.requestAnimationFrame === 'function') {
        this.animId = window.requestAnimationFrame(() => this.loop());
      } else {
        this.animId = setTimeout(() => this.loop(), 16);
      }
    }
  }

  // Active stages map to prevent duplicate instances
  const activeStages = new Map();

  // Global initializer helper
  window.initFestiveFirecrackers = function (canvasId, containerId) {
    if (activeStages.has(canvasId)) {
      return activeStages.get(canvasId);
    }

    // Respect user's reduced-motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      console.log('Festive firecrackers skipped: prefers-reduced-motion is active');
      return null;
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const container = containerId ? document.getElementById(containerId) : canvas.parentElement;
    const stage = new FirecrackerStage(canvas, container);
    activeStages.set(canvasId, stage);
    return stage;
  };

  // Auto-boot if elements are already in the DOM on load
  function autoBoot() {
    if (document.getElementById('festive-firecrackers-canvas')) {
      window.initFestiveFirecrackers('festive-firecrackers-canvas', 'festival-sale-banner');
    }
    if (document.getElementById('festive-page-firecrackers-canvas')) {
      window.initFestiveFirecrackers('festive-page-firecrackers-canvas', 'festive-page-hero');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoBoot);
  } else {
    autoBoot();
  }

})(window, document);
