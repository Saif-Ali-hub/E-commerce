/**
 * MiniStore Festive Firecrackers Background Engine
 * High-performance, luminous HTML5 canvas firecrackers blasting animation.
 * File: frontend/firecrackers.js
 */

(function (window, document) {
  'use strict';

  // Festive color palettes (Radiant Saffron, Shimmering Gold, Ruby Crimson, Emerald, Royal Violet, Electric Cyan, Diamond White)
  const FESTIVE_PALETTES = [
    { name: 'Saffron & Gold', colors: ['#f59e0b', '#fbbf24', '#fde047', '#ff7800', '#ffffff'] },
    { name: 'Ruby & Rose', colors: ['#ef4444', '#f43f5e', '#fb7185', '#fda4af', '#fef08a'] },
    { name: 'Emerald & Mint', colors: ['#10b981', '#34d399', '#6ee7b7', '#fde047', '#ffffff'] },
    { name: 'Royal Purple & Cyan', colors: ['#8b5cf6', '#a855f7', '#06b6d4', '#38bdf8', '#fef08a'] },
    { name: 'Golden Brocade', colors: ['#fbbf24', '#f59e0b', '#d97706', '#fef08a', '#ffffff'] },
    { name: 'Carnival Rainbow', colors: ['#ff4444', '#ffbb00', '#00e676', '#00e5ff', '#d500f9', '#ffffff'] }
  ];

  function randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randomColor(palette) {
    const p = palette || FESTIVE_PALETTES[Math.floor(Math.random() * FESTIVE_PALETTES.length)];
    return p.colors[Math.floor(Math.random() * p.colors.length)];
  }

  // Flash flare at detonation
  class Flash {
    constructor(x, y, radius, color) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.color = color;
      this.alpha = 0.45;
      this.decay = 0.08;
    }

    update() {
      this.alpha -= this.decay;
      return this.alpha > 0;
    }

    draw(ctx) {
      if (this.alpha <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${this.alpha * 0.9})`);
      grad.addColorStop(0.3, this.color.replace(')', `, ${this.alpha * 0.6})`).replace('rgb', 'rgba').replace('#', 'rgba('));
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Single explosive firecracker spark particle
  class Particle {
    constructor(x, y, color, vx, vy, options = {}) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.vx = vx;
      this.vy = vy;
      this.friction = options.friction || 0.965;
      this.gravity = options.gravity !== undefined ? options.gravity : 0.08;
      this.alpha = 1;
      this.decay = options.decay || randomRange(0.012, 0.024);
      this.size = options.size || randomRange(2, 3.5);
      this.flicker = options.flicker || Math.random() > 0.3;
      this.history = [];
      this.maxHistory = options.trailLength || 4;
      this.secondary = options.secondary || false;
      this.hasPopped = false;
    }

    update() {
      this.history.push({ x: this.x, y: this.y, alpha: this.alpha });
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      this.vx *= this.friction;
      this.vy *= this.friction;
      this.vy += this.gravity;

      this.x += this.vx;
      this.y += this.vy;

      this.alpha -= this.decay;
      this.size = Math.max(0.6, this.size * 0.992);

      return this.alpha > 0;
    }

    draw(ctx) {
      if (this.alpha <= 0) return;

      const currentAlpha = this.flicker && this.alpha < 0.6
        ? this.alpha * (0.6 + Math.random() * 0.5)
        : this.alpha;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Draw luminous motion trail
      if (this.history.length > 1) {
        ctx.beginPath();
        ctx.moveTo(this.history[0].x, this.history[0].y);
        for (let i = 1; i < this.history.length; i++) {
          ctx.lineTo(this.history[i].x, this.history[i].y);
        }
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = Math.max(0, currentAlpha * 0.65);
        ctx.lineWidth = Math.max(1, this.size * 0.85);
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Draw particle glowing head
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = currentAlpha;
      ctx.fill();

      // Diamond sparkle center
      if (this.size > 2) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = Math.min(1, currentAlpha * 1.2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // Rising rocket shell
  class Rocket {
    constructor(startX, startY, targetX, targetY, palette, onDetonate) {
      this.x = startX;
      this.y = startY;
      this.targetX = targetX;
      this.targetY = targetY;
      this.palette = palette;
      this.onDetonate = onDetonate;

      const angle = Math.atan2(targetY - startY, targetX - startX);
      const distance = Math.hypot(targetX - startX, targetY - startY);
      const speed = Math.min(9.5, Math.max(6, distance * 0.024));

      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.history = [];
      this.maxHistory = 6;
      this.sparks = [];
    }

    update() {
      this.history.push({ x: this.x, y: this.y });
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      this.x += this.vx;
      this.y += this.vy;

      // Rocket decelerates slightly near its apogee
      this.vy *= 0.985;

      // Emit rising tail sparks
      if (Math.random() > 0.25) {
        this.sparks.push(new Particle(
          this.x + randomRange(-1.5, 1.5),
          this.y + randomRange(0, 4),
          Math.random() > 0.5 ? '#f59e0b' : '#fef08a',
          randomRange(-0.8, 0.8),
          randomRange(0.5, 2),
          { decay: 0.07, size: 1.5, gravity: 0.04, trailLength: 2 }
        ));
      }

      // Update tail sparks
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        if (!this.sparks[i].update()) {
          this.sparks.splice(i, 1);
        }
      }

      // Detonate if reached target Y or velocity has flipped downward
      if (this.y <= this.targetY || this.vy >= -0.5) {
        this.detonate();
        return false;
      }

      return true;
    }

    detonate() {
      if (this.onDetonate) {
        this.onDetonate(this.x, this.y, this.palette);
      }
    }

    draw(ctx) {
      // Draw rising tail sparks
      for (const spark of this.sparks) {
        spark.draw(ctx);
      }

      // Draw rocket head & streak
      if (this.history.length > 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.moveTo(this.history[0].x, this.history[0].y);
        for (let i = 1; i < this.history.length; i++) {
          ctx.lineTo(this.history[i].x, this.history[i].y);
        }
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 0.85;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
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
      this.particles = [];
      this.flashes = [];
      this.isRunning = false;
      this.animId = null;
      this.width = 0;
      this.height = 0;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.autoTimer = null;
      this.isVisible = true;

      this.init();
    }

    init() {
      this.resize();

      window.addEventListener('resize', () => this.resize(), { passive: true });
      if (window.ResizeObserver && this.container) {
        new ResizeObserver(() => this.resize()).observe(this.container);
      }

      // Pause when out of screen to save battery/CPU
      if (window.IntersectionObserver && this.container) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            this.isVisible = entry.isIntersecting;
            if (this.isVisible && !this.isRunning) {
              this.start();
            } else if (!this.isVisible && this.isRunning && this.rockets.length === 0 && this.particles.length === 0) {
              this.stop();
            }
          });
        }, { threshold: 0.1 });
        observer.observe(this.container);
      }

      // Interactive: click on container triggers instant burst!
      if (this.container) {
        this.container.addEventListener('click', (e) => {
          // Don't trigger if clicked on interactive buttons or links
          if (e.target.closest('a, button, input, select, textarea, .btn-copy-coupon, #festive-shop-now-btn')) {
            return;
          }
          const rect = this.canvas.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          this.createBurst(clickX, clickY);
        });
      }

      this.start();
      this.scheduleNextLaunch();
    }

    resize() {
      if (!this.canvas || !this.container) return;
      const rect = this.container.getBoundingClientRect();
      const w = Math.max(rect.width, 300);
      const h = Math.max(rect.height, 180);

      this.width = w;
      this.height = h;

      this.canvas.width = Math.floor(w * this.dpr);
      this.canvas.height = Math.floor(h * this.dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;

      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    launchRocket(customTargetX, customTargetY) {
      if (!this.isVisible) return;

      const palette = FESTIVE_PALETTES[Math.floor(Math.random() * FESTIVE_PALETTES.length)];
      const startX = customTargetX !== undefined
        ? customTargetX + randomRange(-40, 40)
        : randomRange(this.width * 0.1, this.width * 0.9);
      const startY = this.height + 10;

      const targetX = customTargetX !== undefined
        ? customTargetX
        : randomRange(this.width * 0.15, this.width * 0.85);
      const targetY = customTargetY !== undefined
        ? customTargetY
        : randomRange(this.height * 0.15, this.height * 0.55);

      const rocket = new Rocket(startX, startY, targetX, targetY, palette, (x, y, pal) => {
        this.explode(x, y, pal);
      });

      this.rockets.push(rocket);

      if (!this.isRunning) {
        this.start();
      }
    }

    createBurst(x, y) {
      const palette = FESTIVE_PALETTES[Math.floor(Math.random() * FESTIVE_PALETTES.length)];
      this.explode(x, y, palette);
      if (!this.isRunning) this.start();
    }

    explode(x, y, palette) {
      const pal = palette || FESTIVE_PALETTES[Math.floor(Math.random() * FESTIVE_PALETTES.length)];
      const blastTypes = ['peony', 'willow', 'crackle', 'doubleRing'];
      const chosenType = blastTypes[Math.floor(Math.random() * blastTypes.length)];

      // Detonation flash
      this.flashes.push(new Flash(x, y, randomRange(60, 95), pal.colors[0]));

      switch (chosenType) {
        case 'willow':
          // Golden weeping willow cascading sparks
          this.generateWillowBurst(x, y, pal);
          break;
        case 'crackle':
          // Crackling star burst
          this.generateCrackleBurst(x, y, pal);
          break;
        case 'doubleRing':
          // Dual color concentric rings
          this.generateDoubleRingBurst(x, y, pal);
          break;
        case 'peony':
        default:
          // Classic rich radial explosion
          this.generatePeonyBurst(x, y, pal);
          break;
      }
    }

    generatePeonyBurst(x, y, palette) {
      const count = Math.floor(randomRange(55, 75));
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + randomRange(-0.15, 0.15);
        const speed = randomRange(2.2, 6.2);
        const color = randomColor(palette);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        this.particles.push(new Particle(x, y, color, vx, vy, {
          decay: randomRange(0.014, 0.026),
          size: randomRange(2.2, 3.4),
          gravity: 0.08,
          trailLength: 4,
          flicker: true
        }));
      }
    }

    generateWillowBurst(x, y, palette) {
      const goldColors = ['#f59e0b', '#fbbf24', '#fef08a', '#d97706'];
      const count = Math.floor(randomRange(60, 80));
      for (let i = 0; i < count; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(1.8, 4.8);
        const color = goldColors[Math.floor(Math.random() * goldColors.length)];
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        this.particles.push(new Particle(x, y, color, vx, vy, {
          decay: randomRange(0.009, 0.016), // Long lingering trail
          size: randomRange(2, 3),
          friction: 0.978,
          gravity: 0.045, // Soft floating droop
          trailLength: 5,
          flicker: true
        }));
      }
    }

    generateDoubleRingBurst(x, y, palette) {
      const count = 40;
      const color1 = palette.colors[0];
      const color2 = palette.colors[1] || '#fef08a';

      // Outer ring
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 4.8;
        this.particles.push(new Particle(x, y, color1, Math.cos(angle) * speed, Math.sin(angle) * speed, {
          decay: 0.018,
          size: 2.8,
          trailLength: 4
        }));
      }

      // Inner ring
      for (let i = 0; i < count * 0.7; i++) {
        const angle = (Math.PI * 2 * i) / (count * 0.7);
        const speed = 2.8;
        this.particles.push(new Particle(x, y, color2, Math.cos(angle) * speed, Math.sin(angle) * speed, {
          decay: 0.022,
          size: 2.2,
          trailLength: 3
        }));
      }
    }

    generateCrackleBurst(x, y, palette) {
      const count = 45;
      for (let i = 0; i < count; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(2.5, 5.5);
        const color = randomColor(palette);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        const p = new Particle(x, y, color, vx, vy, {
          decay: randomRange(0.015, 0.024),
          size: randomRange(2, 3),
          secondary: true
        });
        this.particles.push(p);
      }
    }

    scheduleNextLaunch() {
      if (this.autoTimer) clearTimeout(this.autoTimer);

      // Random delay between 900ms and 2200ms
      const delay = randomRange(900, 2200);

      this.autoTimer = setTimeout(() => {
        if (this.isVisible) {
          // Sometimes launch 2 firecrackers in tandem
          this.launchRocket();
          if (Math.random() > 0.6) {
            setTimeout(() => this.launchRocket(), randomRange(150, 400));
          }
        }
        this.scheduleNextLaunch();
      }, delay);
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.loop();
    }

    stop() {
      this.isRunning = false;
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
    }

    loop() {
      if (!this.isRunning) return;

      // Transparent clear to keep banner gradient & decorative glows intact
      this.ctx.clearRect(0, 0, this.width, this.height);

      // 1. Update & draw flashes
      for (let i = this.flashes.length - 1; i >= 0; i--) {
        if (!this.flashes[i].update()) {
          this.flashes.splice(i, 1);
        } else {
          this.flashes[i].draw(this.ctx);
        }
      }

      // 2. Update & draw rockets
      for (let i = this.rockets.length - 1; i >= 0; i--) {
        if (!this.rockets[i].update()) {
          this.rockets.splice(i, 1);
        } else {
          this.rockets[i].draw(this.ctx);
        }
      }

      // 3. Update & draw particles
      const newSecondarySparks = [];
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        if (!p.update()) {
          // If particle was marked for secondary micro-crackles, pop small sparks
          if (p.secondary && !p.hasPopped && Math.random() > 0.4) {
            for (let s = 0; s < 3; s++) {
              newSecondarySparks.push(new Particle(
                p.x,
                p.y,
                Math.random() > 0.5 ? '#ffffff' : '#fde047',
                randomRange(-1.5, 1.5),
                randomRange(-1.5, 1.5),
                { decay: 0.06, size: 1.4, gravity: 0.05, trailLength: 2 }
              ));
            }
          }
          this.particles.splice(i, 1);
        } else {
          p.draw(this.ctx);
        }
      }

      if (newSecondarySparks.length > 0) {
        this.particles.push(...newSecondarySparks);
      }

      // If nothing left on screen and not visible, pause loop
      if (!this.isVisible && this.rockets.length === 0 && this.particles.length === 0 && this.flashes.length === 0) {
        this.stop();
        return;
      }

      this.animId = requestAnimationFrame(() => this.loop());
    }
  }

  // Global initializer helper
  window.initFestiveFirecrackers = function (canvasId, containerId) {
    // Respect user's reduced-motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      console.log('Festive firecrackers skipped: prefers-reduced-motion is active');
      return null;
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const container = containerId ? document.getElementById(containerId) : canvas.parentElement;
    return new FirecrackerStage(canvas, container);
  };

  // Auto-boot if elements are already in the DOM on load
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('festive-firecrackers-canvas')) {
      window.initFestiveFirecrackers('festive-firecrackers-canvas', 'festival-sale-banner');
    }
    if (document.getElementById('festive-page-firecrackers-canvas')) {
      window.initFestiveFirecrackers('festive-page-firecrackers-canvas', 'festive-page-hero');
    }
  });

})(window, document);
