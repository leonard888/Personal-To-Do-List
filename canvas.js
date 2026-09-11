/* ============================================================
   Interactive Cursor Grid / Dot Field Canvas
   GPU-Optimized & Battery Friendly (Auto-sleeps when idle)
   Adopted from Leonard Lesmana Portfolio Design System
   ============================================================ */

(function () {
  function initDotCanvas() {
    const canvas = document.getElementById('cursor-grid-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let dpr = 1;

    const spacing = 32;
    const hoverRadius = 160;
    const targetMouse = { x: -1000, y: -1000 };
    const mouse = { x: -1000, y: -1000 };
    const ripples = [];

    let isLooping = false;
    let idleCounter = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      // Cap DPR to 1.5 to save 44% pixel fillrate while maintaining Retina sharpness
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawStatic();
      wakeLoop();
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();

    function wakeLoop() {
      idleCounter = 0;
      if (!isLooping) {
        isLooping = true;
        requestAnimationFrame(draw);
      }
    }

    window.addEventListener('pointermove', (e) => {
      targetMouse.x = e.clientX;
      targetMouse.y = e.clientY;
      wakeLoop();
    }, { passive: true });

    window.addEventListener('pointerleave', () => {
      targetMouse.x = -1000;
      targetMouse.y = -1000;
      wakeLoop();
    });

    window.addEventListener('pointerdown', (e) => {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius: 260,
        speed: 8
      });
      wakeLoop();
    }, { passive: true });

    window.updateCanvasTheme = () => {
      drawStatic();
      wakeLoop();
    };

    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const offsetX = (width % spacing) / 2;
      const offsetY = (height % spacing) / 2;
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';

      ctx.beginPath();
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * spacing;
        for (let row = 0; row < rows; row++) {
          const y = offsetY + row * spacing;
          ctx.moveTo(x + 0.95, y);
          ctx.arc(x, y, 0.95, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = isLight ? 'rgba(90, 95, 110, 0.085)' : 'rgba(165, 170, 185, 0.035)';
      ctx.fill();
    }

    function draw() {
      // Smooth mouse interpolation (LERP)
      const dx = targetMouse.x - mouse.x;
      const dy = targetMouse.y - mouse.y;
      mouse.x += dx * 0.16;
      mouse.y += dy * 0.16;

      ctx.clearRect(0, 0, width, height);

      // Update active click ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.speed;
        if (r.radius > r.maxRadius) {
          ripples.splice(i, 1);
        }
      }

      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const offsetX = (width % spacing) / 2;
      const offsetY = (height % spacing) / 2;

      const hasMouse = mouse.x > -200 && mouse.y > -200;
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';

      // 1. Grid connecting lines (drawn only within hover bounding box)
      if (hasMouse) {
        ctx.beginPath();
        const minX = Math.max(0, mouse.x - hoverRadius);
        const maxX = Math.min(width, mouse.x + hoverRadius);
        const minY = Math.max(0, mouse.y - hoverRadius);
        const maxY = Math.min(height, mouse.y + hoverRadius);

        const startCol = Math.max(0, Math.floor((minX - offsetX) / spacing));
        const endCol = Math.min(cols - 1, Math.ceil((maxX - offsetX) / spacing));
        for (let c = startCol; c <= endCol; c++) {
          const x = offsetX + c * spacing;
          const dist = Math.abs(x - mouse.x);
          if (dist < hoverRadius) {
            const alpha = (1 - dist / hoverRadius) * (isLight ? 0.055 : 0.035);
            ctx.strokeStyle = isLight ? `rgba(90, 95, 110, ${alpha})` : `rgba(165, 170, 185, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.moveTo(x, minY);
            ctx.lineTo(x, maxY);
          }
        }

        const startRow = Math.max(0, Math.floor((minY - offsetY) / spacing));
        const endRow = Math.min(rows - 1, Math.ceil((maxY - offsetY) / spacing));
        for (let r = startRow; r <= endRow; r++) {
          const y = offsetY + r * spacing;
          const dist = Math.abs(y - mouse.y);
          if (dist < hoverRadius) {
            const alpha = (1 - dist / hoverRadius) * (isLight ? 0.055 : 0.035);
            ctx.strokeStyle = isLight ? `rgba(90, 95, 110, ${alpha})` : `rgba(165, 170, 185, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.moveTo(minX, y);
            ctx.lineTo(maxX, y);
          }
        }
        ctx.stroke();
      }

      // 2. Batch ALL resting dots in ONE SINGLE draw call
      ctx.beginPath();
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * spacing;
        for (let row = 0; row < rows; row++) {
          const y = offsetY + row * spacing;
          if (hasMouse && Math.abs(x - mouse.x) < hoverRadius && Math.abs(y - mouse.y) < hoverRadius) {
            continue;
          }
          ctx.moveTo(x + 0.95, y);
          ctx.arc(x, y, 0.95, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = isLight ? 'rgba(90, 95, 110, 0.085)' : 'rgba(165, 170, 185, 0.035)';
      ctx.fill();

      // 3. Render active dots near mouse or ripples
      if (hasMouse || ripples.length > 0) {
        const minC = hasMouse ? Math.max(0, Math.floor((mouse.x - hoverRadius - offsetX) / spacing)) : 0;
        const maxC = hasMouse ? Math.min(cols - 1, Math.ceil((mouse.x + hoverRadius - offsetX) / spacing)) : cols - 1;
        const minR = hasMouse ? Math.max(0, Math.floor((mouse.y - hoverRadius - offsetY) / spacing)) : 0;
        const maxR = hasMouse ? Math.min(rows - 1, Math.ceil((mouse.y + hoverRadius - offsetY) / spacing)) : rows - 1;

        for (let col = minC; col <= maxC; col++) {
          const baseDotX = offsetX + col * spacing;
          for (let row = minR; row <= maxR; row++) {
            const baseDotY = offsetY + row * spacing;

            let dotX = baseDotX;
            let dotY = baseDotY;
            let radius = 0.95;
            let alpha = 0.035;

            if (hasMouse) {
              const dX = dotX - mouse.x;
              const dY = dotY - mouse.y;
              const dist = Math.hypot(dX, dY);
              if (dist < hoverRadius) {
                const factor = 1 - dist / hoverRadius;
                const easeFactor = factor * factor;
                const push = easeFactor * 4;
                if (dist > 0.001) {
                  dotX += (dX / dist) * push;
                  dotY += (dY / dist) * push;
                }
                radius += easeFactor * 0.75;
                alpha += easeFactor * 0.18;
              }
            }

            for (let i = 0; i < ripples.length; i++) {
              const rip = ripples[i];
              const rDist = Math.hypot(baseDotX - rip.x, baseDotY - rip.y);
              const waveDist = Math.abs(rDist - rip.radius);
              if (waveDist < 35) {
                const strength = (1 - waveDist / 35) * (1 - rip.radius / rip.maxRadius);
                radius += strength * 0.8;
                alpha += strength * 0.15;
              }
            }

            ctx.beginPath();
            ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
            ctx.fillStyle = isLight 
              ? `rgba(50, 55, 70, ${Math.min(alpha * 1.5, 0.32)})` 
              : `rgba(165, 170, 185, ${Math.min(alpha, 0.28)})`;
            ctx.fill();
          }
        }
      }

      // Check if animation has settled to sleep the loop
      const isMouseSettled = Math.hypot(dx, dy) < 0.2;
      if (isMouseSettled && ripples.length === 0) {
        idleCounter++;
        if (idleCounter > 6) {
          isLooping = false;
          return;
        }
      } else {
        idleCounter = 0;
      }

      requestAnimationFrame(draw);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDotCanvas);
  } else {
    initDotCanvas();
  }
})();
