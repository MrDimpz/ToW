import { useEffect, useRef } from 'react';
import { gameEngine } from '../engine/gameEngine';
import type { FieldPowerUp, PlayerRecord } from '../types';

const COOLDOWN_MS = 3000;

function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function BattlefieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTs = performance.now();

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const renderFrame = (ts: number) => {
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      gameEngine.tick(dt);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      if (W <= 0 || H <= 0) {
        animId = requestAnimationFrame(renderFrame);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      if (gameEngine.screenShake > 0.2) {
        const mag = gameEngine.screenShake;
        const sx = (Math.random() - 0.5) * mag;
        const sy = (Math.random() - 0.5) * mag;
        ctx.translate(sx, sy);
      }

      const borderY = (gameEngine.visualRedPercent / 100) * H;
      const time = gameEngine.simTime;
      const now = Date.now();
      const isOverdrive = gameEngine.phase === 3;
      const redInverted = now < gameEngine.redPowerUps.invertedUntil;
      const blueInverted = now < gameEngine.bluePowerUps.invertedUntil;

      // 1. DYNAMIC SPLIT TERRITORY BACKGROUNDS
      const redGrad = ctx.createLinearGradient(0, 0, 0, Math.max(10, borderY));
      redGrad.addColorStop(0, redInverted ? '#2D1044' : '#3D0A1E');
      redGrad.addColorStop(0.55, redInverted ? '#220B38' : '#2A0815');
      redGrad.addColorStop(1, redInverted ? '#3D145C' : '#4A0E24');
      ctx.fillStyle = redGrad;
      ctx.fillRect(-20, -20, W + 40, borderY + 20);

      const blueGrad = ctx.createLinearGradient(0, borderY, 0, H);
      blueGrad.addColorStop(0, blueInverted ? '#351357' : '#093454');
      blueGrad.addColorStop(0.45, blueInverted ? '#1F0B36' : '#061F33');
      blueGrad.addColorStop(1, blueInverted ? '#2B0F47' : '#072A45');
      ctx.fillStyle = blueGrad;
      ctx.fillRect(-20, borderY, W + 40, H - borderY + 20);

      // 2. TACTICAL BATTLEFIELD GRID & TERRITORY MARKERS
      ctx.save();
      const gridStep = Math.max(32, W / 10);
      ctx.lineWidth = 1;

      ctx.strokeStyle = redInverted ? 'rgba(192, 132, 252, 0.14)' : 'rgba(255, 42, 95, 0.08)';
      ctx.beginPath();
      for (let x = 0; x <= W; x += gridStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, borderY);
      }
      for (let y = gridStep; y < borderY; y += gridStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();

      ctx.strokeStyle = blueInverted ? 'rgba(192, 132, 252, 0.14)' : 'rgba(0, 229, 255, 0.08)';
      ctx.beginPath();
      for (let x = 0; x <= W; x += gridStep) {
        ctx.moveTo(x, borderY);
        ctx.lineTo(x, H);
      }
      for (let y = Math.ceil(borderY / gridStep) * gridStep; y < H; y += gridStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();

      // Inverted Control warning ribbon on sabotaged half
      if (redInverted) {
        drawInvertedOverlay(ctx, W, 24, borderY - 24, (gameEngine.redPowerUps.invertedUntil - now) / 1000, time);
      }
      if (blueInverted) {
        drawInvertedOverlay(ctx, W, borderY + 4, H - borderY - 28, (gameEngine.bluePowerUps.invertedUntil - now) / 1000, time);
      }

      [0.15, 0.5, 0.85].forEach((mark) => {
        const my = mark * H;
        ctx.strokeStyle = mark === 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(255,209,102,0.16)';
        ctx.setLineDash(mark === 0.5 ? [6, 6] : [3, 6]);
        ctx.beginPath();
        ctx.moveTo(0, my);
        ctx.lineTo(W, my);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();

      // 3. TEAM BASES
      const redBaseDanger = gameEngine.visualRedPercent <= 15;
      const blueBaseDanger = gameEngine.visualRedPercent >= 85;
      drawTeamBase(ctx, W, H, 'RED', redBaseDanger, time);
      drawTeamBase(ctx, W, H, 'BLUE', blueBaseDanger, time);

      // 4. SHIELD HEXAGONAL ENERGY BARRIERS
      if (gameEngine.redShields > 0) {
        drawShieldBarrier(ctx, W, borderY - 12, 'RED', gameEngine.redShields, gameEngine.redShieldFlash, time);
      }
      if (gameEngine.blueShields > 0) {
        drawShieldBarrier(ctx, W, borderY + 12, 'BLUE', gameEngine.blueShields, gameEngine.blueShieldFlash, time);
      }

      // 5. HORIZON LASER BORDER
      const pulseAmp = isOverdrive ? 0.5 + 0.5 * Math.sin(time * 16) : 0.3 + 0.25 * Math.sin(time * 5);
      const glowHeight = 26 + gameEngine.borderPulse * 18 + (isOverdrive ? 14 : 0);

      const beamGlow = ctx.createLinearGradient(0, borderY - glowHeight, 0, borderY + glowHeight);
      beamGlow.addColorStop(0, 'rgba(255, 42, 95, 0)');
      beamGlow.addColorStop(0.38, isOverdrive ? 'rgba(255, 209, 102, 0.42)' : 'rgba(255, 42, 95, 0.35)');
      beamGlow.addColorStop(0.5, isOverdrive ? 'rgba(255, 240, 180, 0.95)' : 'rgba(255, 255, 255, 0.95)');
      beamGlow.addColorStop(0.62, isOverdrive ? 'rgba(255, 209, 102, 0.42)' : 'rgba(0, 229, 255, 0.35)');
      beamGlow.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = beamGlow;
      ctx.fillRect(0, borderY - glowHeight, W, glowHeight * 2);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, borderY);
      const segments = 24;
      const jitter = (isOverdrive ? 3.5 : 1.4) + gameEngine.borderPulse * 3.5;
      for (let i = 1; i < segments; i++) {
        const px = (i / segments) * W;
        const py = borderY + Math.sin(time * 24 + i * 1.9) * jitter;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(W, borderY);
      ctx.strokeStyle = isOverdrive ? '#FFD166' : '#FFFFFF';
      ctx.lineWidth = (isOverdrive ? 4.5 : 3) + pulseAmp * 1.5;
      ctx.shadowColor = isOverdrive ? '#FFD166' : '#00E5FF';
      ctx.shadowBlur = isOverdrive ? 18 : 12;
      ctx.stroke();
      ctx.restore();

      // 6. BATTLEFIELD POWER-UP ORBS (Visually distinct items with clear trigger tags)
      for (let i = 0; i < gameEngine.fieldPowerUps.length; i++) {
        drawFieldPowerUp(ctx, gameEngine.fieldPowerUps[i], W, H, borderY, now, time);
      }

      // 7. AVATAR FRONTLINES (Profile pictures + nicknames + green valid / red shake cues)
      const playersArr = Array.from(gameEngine.players.values());
      playersArr.sort((a, b) => a.lastFireAt - b.lastFireAt);
      const avatarRadius = Math.max(14, Math.min(19, W * 0.043));

      for (let i = 0; i < playersArr.length; i++) {
        drawPlayerAvatar(ctx, playersArr[i], W, H, borderY, avatarRadius, now, time);
      }

      // 8. KINETIC ENERGY BEAMS
      for (let i = 0; i < gameEngine.beams.length; i++) {
        const b = gameEngine.beams[i];
        if (b.progress < 0) continue;
        const fx = b.fromX * W;
        const fy = b.fromY * H;
        const tx = b.targetX * W;
        const ty = b.targetY * H;
        const headX = fx + (tx - fx) * b.progress;
        const headY = fy + (ty - fy) * b.progress;
        const tailP = Math.max(0, b.progress - (b.tier === 'NUCLEAR' ? 0.55 : 0.38));
        const tailX = fx + (tx - fx) * tailP;
        const tailY = fy + (ty - fy) * tailP;

        const color = b.isInverted
          ? '#C084FC'
          : b.tier === 'BOUNTY' || b.isPowered
          ? '#FFD166'
          : b.team === 'RED'
          ? '#FF2A5F'
          : '#00E5FF';

        ctx.save();
        ctx.globalAlpha = b.fade;
        ctx.lineCap = 'round';

        ctx.strokeStyle = color;
        ctx.lineWidth = b.width * 2.1;
        ctx.shadowColor = color;
        ctx.shadowBlur = b.tier === 'NUCLEAR' || b.isPowered ? 24 : 14;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1.8, b.width * 0.65);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();

        if (!b.impacted) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(headX, headY, b.width * 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 9. SHOCKWAVE RINGS
      for (let i = 0; i < gameEngine.shockwaves.length; i++) {
        const sw = gameEngine.shockwaves[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = sw.lineWidth;
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(sw.x * W, sw.y * H, sw.radius * W, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 10. SPARKS & EXPLOSION PARTICLES
      for (let i = 0; i < gameEngine.particles.length; i++) {
        const pt = gameEngine.particles[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        if (pt.glow) {
          ctx.shadowColor = pt.color;
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ctx.arc(pt.x * W, pt.y * H, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 11. FLOATING WORD CALLOUT BADGES
      for (let i = 0; i < gameEngine.callouts.length; i++) {
        const c = gameEngine.callouts[i];
        const progress = c.age / c.maxAge;
        const alpha = progress < 0.14 ? progress / 0.14 : progress > 0.72 ? (1 - progress) / 0.28 : 1;
        const popScale = progress < 0.15 ? 0.75 + (progress / 0.15) * 0.3 : 1.0;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.translate(c.x * W, c.y * H);
        ctx.scale(c.scale * popScale, c.scale * popScale);

        const fontSize = c.isNuclear || c.isGold ? 15 : 12.5;
        ctx.font = `800 ${fontSize}px "Barlow Condensed", sans-serif`;
        const metrics = ctx.measureText(c.text);
        const padX = 8;
        const boxW = metrics.width + padX * 2;
        const boxH = c.subtext ? 31 : 21;

        ctx.fillStyle = 'rgba(9, 11, 20, 0.9)';
        ctx.strokeStyle = c.color;
        ctx.lineWidth = c.isNuclear || c.isGold || c.isPurple ? 2 : 1.3;
        roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 5);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = c.isGold ? '#FFD166' : c.isPurple ? '#E9D5FF' : '#FFFFFF';
        ctx.fillText(c.text, 0, c.subtext ? -4.5 : 0.5);

        if (c.subtext) {
          ctx.font = `700 8.5px "Outfit", sans-serif`;
          ctx.fillStyle = c.color;
          ctx.fillText(c.subtext, 0, 8.5);
        }

        ctx.restore();
      }

      // 12. NUCLEAR / IMPACT FULL-FIELD FLASH
      if (gameEngine.flashAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = gameEngine.flashAlpha;
        ctx.fillStyle = gameEngine.flashColor;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      aria-label="Tug-of-Words Live Territory Battlefield"
    />
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawInvertedOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  topY: number,
  height: number,
  remainingSec: number,
  time: number
) {
  if (height < 26) return;
  ctx.save();
  ctx.fillStyle = `rgba(168, 85, 247, ${0.08 + 0.04 * Math.sin(time * 12)})`;
  ctx.fillRect(0, topY, W, height);

  ctx.font = '800 11px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#E9D5FF';
  ctx.textAlign = 'center';
  ctx.fillText(
    `CONTROLS INVERTED · BACKFIRE (${Math.max(0, remainingSec).toFixed(1)}s)`,
    W / 2,
    topY + 14
  );
  ctx.restore();
}

function drawFieldPowerUp(
  ctx: CanvasRenderingContext2D,
  pu: FieldPowerUp,
  W: number,
  H: number,
  borderY: number,
  now: number,
  time: number
) {
  const cx = pu.x * W;
  const rawY = borderY + pu.yOffset * H;
  const cy = Math.max(54, Math.min(H - 54, rawY)) + Math.sin(time * 4.5 + pu.x * 8) * 4;
  const totalLife = pu.expiresAt - pu.spawnedAt;
  const remainingFrac = Math.max(0, (pu.expiresAt - now) / totalLife);

  const primary =
    pu.type === 'DOUBLE_PUSH'
      ? '#FFD166'
      : pu.type === 'SHIELD_BREAK'
      ? '#F43F5E'
      : '#C084FC';

  const r = 19;

  ctx.save();
  // Pulsing outer aura
  const haloGrad = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r + 14);
  haloGrad.addColorStop(0, primary + '88');
  haloGrad.addColorStop(1, primary + '00');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
  ctx.fill();

  // Dark orb body
  ctx.fillStyle = 'rgba(9, 11, 20, 0.92)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Countdown arc
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2.5, -Math.PI / 2, -Math.PI / 2 + remainingFrac * Math.PI * 2);
  ctx.strokeStyle = primary;
  ctx.lineWidth = 3;
  ctx.shadowColor = primary;
  ctx.shadowBlur = 10;
  ctx.stroke();

  // Visually distinct geometric icon inside orb
  ctx.shadowBlur = 0;
  ctx.strokeStyle = primary;
  ctx.fillStyle = primary;
  ctx.lineWidth = 2;

  if (pu.type === 'DOUBLE_PUSH') {
    // Bold Lightning Bolt
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 10);
    ctx.lineTo(cx - 6, cy + 1);
    ctx.lineTo(cx, cy + 1);
    ctx.lineTo(cx - 2, cy + 10);
    ctx.lineTo(cx + 7, cy - 1);
    ctx.lineTo(cx + 1, cy - 1);
    ctx.closePath();
    ctx.fill();
  } else if (pu.type === 'SHIELD_BREAK') {
    // Cracked Shield Emblem
    drawHexagon(ctx, cx, cy, 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 7);
    ctx.lineTo(cx + 2, cy - 1);
    ctx.lineTo(cx - 2, cy + 2);
    ctx.lineTo(cx + 3, cy + 7);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else {
    // Spinning Vortex Arrows (Invert Control)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 2.8);
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 1.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, Math.PI, Math.PI * 2.35);
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.restore();
  }

  // Crisp label plate below orb showing Power-Up Name & Activation Trigger
  const labelW = 72;
  const labelH = 24;
  ctx.fillStyle = 'rgba(9, 11, 20, 0.92)';
  ctx.strokeStyle = primary;
  ctx.lineWidth = 1.2;
  roundRect(ctx, cx - labelW / 2, cy + r + 5, labelW, labelH, 4);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 8.5px "Barlow Condensed", sans-serif';
  ctx.fillStyle = primary;
  ctx.fillText(pu.shortLabel, cx, cy + r + 12.5);

  ctx.font = '700 8.5px "JetBrains Mono", monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(pu.triggerHint, cx, cy + r + 22);

  ctx.restore();
}

function drawTeamBase(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  team: 'RED' | 'BLUE',
  inDanger: boolean,
  time: number
) {
  const isRed = team === 'RED';
  const y = isRed ? 0 : H - 22;
  const primary = isRed ? '#FF2A5F' : '#00E5FF';
  const flicker = inDanger ? 0.55 + 0.45 * Math.sin(time * 28) : 0.92;

  ctx.save();
  ctx.globalAlpha = flicker;

  const grad = ctx.createLinearGradient(0, y, 0, y + 22);
  if (isRed) {
    grad.addColorStop(0, primary);
    grad.addColorStop(1, 'rgba(255, 42, 95, 0.12)');
  } else {
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.12)');
    grad.addColorStop(1, primary);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, y, W, 22);

  ctx.fillStyle = 'rgba(9, 11, 20, 0.55)';
  const notchW = W / 9;
  for (let i = 0; i < 9; i += 2) {
    ctx.fillRect(i * notchW + 6, isRed ? 0 : H - 7, notchW - 12, 7);
  }

  if (inDanger) {
    ctx.strokeStyle = '#FFD166';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#FFD166';
    ctx.shadowBlur = 10;
    const crackY = isRed ? 12 : H - 12;
    [0.22, 0.5, 0.78].forEach((cx) => {
      ctx.beginPath();
      ctx.moveTo(W * cx - 18, crackY - 4);
      ctx.lineTo(W * cx - 4, crackY + 3);
      ctx.lineTo(W * cx + 8, crackY - 5);
      ctx.lineTo(W * cx + 22, crackY + 4);
      ctx.stroke();
    });
  }

  ctx.shadowBlur = 0;
  ctx.font = '800 10.5px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = inDanger ? '#FFD166' : 'rgba(255,255,255,0.92)';
  ctx.fillText(
    inDanger ? `${team} BASE CRITICAL!` : `${team} BASE CORE`,
    W / 2,
    isRed ? 11 : H - 11
  );
  ctx.restore();
}

function drawShieldBarrier(
  ctx: CanvasRenderingContext2D,
  W: number,
  y: number,
  team: 'RED' | 'BLUE',
  charges: number,
  flash: number,
  time: number
) {
  const color = flash > 0.1 ? '#FFFFFF' : team === 'RED' ? '#FF7AA0' : '#67E8F9';
  const hexCount = Math.min(11, Math.max(5, Math.floor(W / 36)));
  const spacing = (W - 36) / (hexCount - 1);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle =
    team === 'RED'
      ? `rgba(255, 42, 95, ${0.14 + flash * 0.4})`
      : `rgba(0, 229, 255, ${0.14 + flash * 0.4})`;
  ctx.lineWidth = 1.6 + flash * 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 + flash * 12;

  for (let i = 0; i < hexCount; i++) {
    const cx = 18 + i * spacing;
    const bob = Math.sin(time * 5 + i * 0.8) * 1.5;
    drawHexagon(ctx, cx, y + bob, 9);
    ctx.fill();
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.font = '800 9.5px "JetBrains Mono", monospace';
  ctx.fillStyle = '#FFD166';
  ctx.textAlign = 'right';
  ctx.fillText(`SHIELD x${charges}`, W - 10, y + (team === 'RED' ? -13 : 18));
  ctx.restore();
}

function drawPlayerAvatar(
  ctx: CanvasRenderingContext2D,
  player: PlayerRecord,
  W: number,
  H: number,
  borderY: number,
  radius: number,
  now: number,
  time: number
) {
  const safeBorderY = Math.max(H * 0.12, Math.min(H * 0.88, borderY));
  const lungePx = player.lunge * H * 0.065;
  const knockPx = player.knockback * H * 0.055;
  const bob = Math.sin(time * 2.8 + player.laneX * 14) * 2.5;

  let cy: number;
  if (player.team === 'RED') {
    const zoneTop = H * 0.085;
    const zoneBottom = Math.max(zoneTop + 26, safeBorderY - 56);
    cy = zoneBottom - player.depthOffset * (zoneBottom - zoneTop) + lungePx - knockPx + bob;
    cy = Math.max(H * 0.065, Math.min(safeBorderY - radius - 14, cy));
  } else {
    const zoneTop = Math.min(H * 0.88, safeBorderY + 56);
    const zoneBottom = H * 0.915;
    cy = zoneTop + player.depthOffset * (zoneBottom - zoneTop) - lungePx + knockPx + bob;
    cy = Math.max(safeBorderY + radius + 14, Math.min(H * 0.935, cy));
  }

  let cx = player.laneX * W;
  const isShaking = player.shakeTimer > 0;
  const isValidFlashing = player.validFlashTimer > 0;
  if (isShaking) {
    cx += Math.sin(time * 68) * 5.2;
  }

  const teamColor = player.team === 'RED' ? '#FF2A5F' : '#00E5FF';
  const elapsedCooldown = now - player.lastFireAt;
  const isReloading = player.lastFireAt > 0 && elapsedCooldown < COOLDOWN_MS;
  const reloadProgress = isReloading ? elapsedCooldown / COOLDOWN_MS : 1;

  ctx.save();

  // Green Validation Flash Ring on Valid Word
  if (isValidFlashing) {
    const t = player.validFlashTimer / 560;
    const ringR = radius + 4 + (1 - t) * 14;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(74, 222, 128, ${t})`;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#4ADE80';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Red Error Shake Glow on Invalid/Taken Word
  if (isShaking) {
    const t = Math.min(1, player.shakeTimer / 420);
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 42, 95, ${0.42 * t})`;
    ctx.fill();
  }

  // Flame Aura if ON FIRE (3+ streak)
  if (player.onFire) {
    const flameR = radius + 6 + Math.sin(time * 18 + player.laneX * 10) * 2.5;
    const fireGrad = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, flameR + 4);
    fireGrad.addColorStop(0, 'rgba(255, 209, 102, 0.85)');
    fireGrad.addColorStop(0.55, 'rgba(255, 115, 0, 0.55)');
    fireGrad.addColorStop(1, 'rgba(255, 42, 95, 0)');
    ctx.fillStyle = fireGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, flameR + 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Avatar Circle Base
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = player.avatarColor;
  ctx.fill();

  // Always render player's profile picture inside circular clip
  const img = gameEngine.avatarImageCache.get(player.avatarUrl);
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  // Avatar ring border (flashes green on valid, red on error, gold on fire)
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = isValidFlashing
    ? '#4ADE80'
    : isShaking
    ? '#FF2A5F'
    : player.onFire
    ? '#FFD166'
    : 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = isValidFlashing || isShaking || player.onFire ? 2.6 : 1.7;
  ctx.stroke();

  // 3-Second Circular Reload Ring
  if (isReloading) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(9, 11, 20, 0.36)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      radius + 3,
      -Math.PI / 2,
      -Math.PI / 2 + reloadProgress * Math.PI * 2
    );
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }

  // Compact Nickname Label below avatar (no @ prefix)
  const shortNick =
    player.nickname.length > 10 ? player.nickname.slice(0, 9) + '…' : player.nickname;
  ctx.font = '600 9.5px "Outfit", sans-serif';
  const nameW = ctx.measureText(shortNick).width + 8;
  const labelY = cy + radius + 8;
  ctx.fillStyle = 'rgba(9, 11, 20, 0.84)';
  roundRect(ctx, cx - nameW / 2, labelY - 6, nameW, 12, 3);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = player.onFire ? '#FFD166' : '#F1F5F9';
  ctx.fillText(shortNick, cx, labelY);

  // ON FIRE indicator above avatar
  if (player.onFire) {
    ctx.font = '800 8px "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#FFD166';
    ctx.fillText('1.5X FIRE', cx, cy - radius - 7);
  }

  // Real-time Validation Feedback (VALID! / TAKEN! / RULE MISS! / RELOADING...)
  if (player.feedbackText && now < player.feedbackUntil) {
    ctx.font = '800 9.5px "Barlow Condensed", sans-serif';
    ctx.fillStyle = player.feedbackColor;
    ctx.fillText(player.feedbackText, cx, cy - radius - (player.onFire ? 17 : 8));
  }

  ctx.restore();
}
