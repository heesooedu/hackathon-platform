'use client';

import { useState } from 'react';

export interface SimulationTemplate {
  id: string;
  label: string;
  caption: string;
  code: string;
}

export const SIMULATION_TEMPLATES: SimulationTemplate[] = [
  {
    id: 'projectile',
    label: '🚀 물리: 포물선 운동 실험기',
    caption: '포물선 운동(투사체) 속력·발사각·중력가속도 시뮬레이션',
    code: `<div style="font-family: system-ui, sans-serif; padding: 14px; background: #f8fafc; color: #0f172a; border-radius: 12px;">
  <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between; margin-bottom: 10px;">
    <div>
      <strong style="font-size: 15px; color: #1e3a8a;">🚀 포물선 운동 (투사체 궤적 및 속도 벡터) 실험실</strong>
      <p style="font-size: 12px; color: #475569; margin: 2px 0 0;">초기 속력(v₀)과 발사각(θ)을 조절하며 수평 등속도 운동과 연직 등가속도 운동을 관찰하세요.</p>
    </div>
    <div style="display: flex; gap: 6px;">
      <button id="fireBtn" style="background: #2563eb; color: white; border: none; border-radius: 8px; padding: 6px 14px; font-weight: 700; font-size: 12px; cursor: pointer;">▶ 발사 / 재생</button>
      <button id="resetBtn" style="background: #e2e8f0; color: #334155; border: none; border-radius: 8px; padding: 6px 12px; font-weight: 700; font-size: 12px; cursor: pointer;">↺ 초기화</button>
    </div>
  </div>

  <canvas id="simCanvas" width="680" height="240" style="width: 100%; height: 240px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; display: block;"></canvas>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-top: 10px; font-size: 12px;">
    <label style="background: white; padding: 8px 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; font-weight:600;">
        <span>초기 속력 v₀</span><span id="v0Val" style="color:#2563eb;">28 m/s</span>
      </div>
      <input id="v0Slider" type="range" min="10" max="45" value="28" style="width:100%; margin-top:4px;" />
    </label>
    <label style="background: white; padding: 8px 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; font-weight:600;">
        <span>발사 각도 θ</span><span id="angleVal" style="color:#2563eb;">45°</span>
      </div>
      <input id="angleSlider" type="range" min="15" max="80" value="45" style="width:100%; margin-top:4px;" />
    </label>
    <label style="background: white; padding: 8px 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; font-weight:600;">
        <span>중력가속도 g</span><span id="gVal" style="color:#dc2626;">9.8 m/s²</span>
      </div>
      <input id="gSlider" type="range" min="1.6" max="20" step="0.2" value="9.8" style="width:100%; margin-top:4px;" />
    </label>
    <div style="background: #eff6ff; padding: 8px 10px; border-radius: 8px; border: 1px solid #bfdbfe; display:flex; flex-direction:column; justify-content:center; gap:2px;">
      <div>최고점 높이 H: <strong id="maxH" style="color:#1d4ed8;">0.0 m</strong></div>
      <div>수평 도달 거리 R: <strong id="rangeR" style="color:#1d4ed8;">0.0 m</strong></div>
    </div>
  </div>
</div>

<script>
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  const v0Slider = document.getElementById('v0Slider');
  const angleSlider = document.getElementById('angleSlider');
  const gSlider = document.getElementById('gSlider');

  let t = 0;
  let animId = null;
  const scale = 5.2; // 1m 당 픽셀
  const originX = 40;
  const originY = canvas.height - 28;

  function getParams() {
    const v0 = parseFloat(v0Slider.value);
    const deg = parseFloat(angleSlider.value);
    const g = parseFloat(gSlider.value);
    const rad = (deg * Math.PI) / 180;
    const vx = v0 * Math.cos(rad);
    const vy0 = v0 * Math.sin(rad);
    const totalT = (2 * vy0) / g;
    const maxH = (vy0 * vy0) / (2 * g);
    const rangeR = vx * totalT;
    return { v0, deg, g, rad, vx, vy0, totalT, maxH, rangeR };
  }

  function render() {
    const { v0, deg, g, vx, vy0, totalT, maxH, rangeR } = getParams();
    document.getElementById('v0Val').textContent = v0 + ' m/s';
    document.getElementById('angleVal').textContent = deg + '°';
    document.getElementById('gVal').textContent = g.toFixed(1) + ' m/s²';
    document.getElementById('maxH').textContent = maxH.toFixed(1) + ' m';
    document.getElementById('rangeR').textContent = rangeR.toFixed(1) + ' m';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 지면
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);
    ctx.stroke();

    // 전체 예상 궤적 (점선)
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#93c5fd';
    ctx.beginPath();
    for (let s = 0; s <= totalT; s += totalT / 60) {
      const px = originX + vx * s * scale;
      const py = originY - (vy0 * s - 0.5 * g * s * s) * scale;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 현재 시간 t에서의 물체 위치 및 속도 벡터
    const curT = Math.min(t, totalT);
    const x = vx * curT;
    const y = Math.max(0, vy0 * curT - 0.5 * g * curT * curT);
    const curVy = vy0 - g * curT;

    const cx = originX + x * scale;
    const cy = originY - y * scale;

    // vx 화살표 (파랑)
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + vx * 1.1, cy);
    ctx.stroke();

    // vy 화살표 (빨강)
    ctx.strokeStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - curVy * 1.1);
    ctx.stroke();

    // 공 그리기
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('t = ' + curT.toFixed(2) + 's', cx - 18, cy - 12);
  }

  function step() {
    const { totalT } = getParams();
    t += 0.04;
    render();
    if (t < totalT) {
      animId = requestAnimationFrame(step);
    }
  }

  document.getElementById('fireBtn').onclick = () => {
    if (animId) cancelAnimationFrame(animId);
    t = 0;
    step();
  };
  document.getElementById('resetBtn').onclick = () => {
    if (animId) cancelAnimationFrame(animId);
    t = 0;
    render();
  };
  [v0Slider, angleSlider, gSlider].forEach(el => el.addEventListener('input', () => {
    t = getParams().totalT * 0.45;
    render();
  }));

  t = getParams().totalT * 0.45;
  render();
</script>`,
  },
  {
    id: 'pendulum-energy',
    label: '🌊 물리: 단진자와 역학적 에너지 보존',
    caption: '단진자 운동과 운동 에너지(Ek)·퍼텐셜 에너지(Ep) 실시간 전환',
    code: `<div style="font-family: system-ui, sans-serif; padding: 14px; background: #f8fafc; color: #0f172a; border-radius: 12px;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
    <div>
      <strong style="font-size: 15px; color: #0f766e;">🌊 단진자 운동과 역학적 에너지 보존 실험</strong>
      <p style="font-size: 12px; color: #475569; margin: 2px 0 0;">진자의 높이가 변할 때 퍼텐셜 에너지(Ep)와 운동 에너지(Ek)의 합이 일정하게 보존됨을 확인해 보세요.</p>
    </div>
    <button id="toggleBtn" style="background:#0d9488; color:white; border:none; border-radius:8px; padding:6px 14px; font-weight:700; font-size:12px; cursor:pointer;">⏸ 일시정지 / 재생</button>
  </div>

  <canvas id="pendulumCanvas" width="660" height="230" style="width:100%; height:230px; background:white; border:1px solid #cbd5e1; border-radius:10px; display:block;"></canvas>

  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px; font-size:12px;">
    <label style="background:white; padding:8px 10px; border-radius:8px; border:1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; font-weight:600;">
        <span>실의 길이 L</span><span id="lenLabel" style="color:#0d9488;">140 px</span>
      </div>
      <input id="lenSlider" type="range" min="80" max="175" value="140" style="width:100%; margin-top:4px;" />
    </label>
    <label style="background:white; padding:8px 10px; border-radius:8px; border:1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; font-weight:600;">
        <span>초기 진폭 θ₀</span><span id="ampLabel" style="color:#0d9488;">45°</span>
      </div>
      <input id="ampSlider" type="range" min="15" max="75" value="45" style="width:100%; margin-top:4px;" />
    </label>
  </div>
</div>

<script>
  const canvas = document.getElementById('pendulumCanvas');
  const ctx = canvas.getContext('2d');
  const lenSlider = document.getElementById('lenSlider');
  const ampSlider = document.getElementById('ampSlider');

  let running = true;
  let time = 0;

  function draw() {
    const L = parseFloat(lenSlider.value);
    const maxDeg = parseFloat(ampSlider.value);
    document.getElementById('lenLabel').textContent = L + ' cm';
    document.getElementById('ampLabel').textContent = maxDeg + '°';

    const theta0 = (maxDeg * Math.PI) / 180;
    const omega = Math.sqrt(9.8 / (L / 45));
    const theta = theta0 * Math.cos(omega * time);

    const pivotX = 210;
    const pivotY = 24;
    const bobX = pivotX + L * Math.sin(theta);
    const bobY = pivotY + L * Math.cos(theta);

    // 에너지 비율 계산
    const hMax = L * (1 - Math.cos(theta0));
    const hCur = L * (1 - Math.cos(theta));
    const epRatio = hMax > 0 ? Math.min(1, Math.max(0, hCur / hMax)) : 0;
    const ekRatio = 1 - epRatio;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 천장 지지대
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pivotX - 50, pivotY);
    ctx.lineTo(pivotX + 50, pivotY);
    ctx.stroke();

    // 기준점 높이 선
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(60, pivotY + L);
    ctx.lineTo(360, pivotY + L);
    ctx.stroke();
    ctx.setLineDash([]);

    // 실
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // 추
    ctx.fillStyle = '#0d9488';
    ctx.beginPath();
    ctx.arc(bobX, bobY, 13, 0, Math.PI * 2);
    ctx.fill();

    // 우측 에너지 막대그래프 영역
    const chartX = 430;
    const chartBottom = 195;
    const maxBarH = 135;

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('역학적 에너지 실시간 분석', chartX, 32);

    // Ep 막대
    const epH = epRatio * maxBarH;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(chartX, chartBottom - epH, 44, epH);
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Ep(위치)', chartX - 2, chartBottom + 18);

    // Ek 막대
    const ekH = ekRatio * maxBarH;
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(chartX + 75, chartBottom - ekH, 44, ekH);
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Ek(운동)', chartX + 73, chartBottom + 18);

    // 역학적 에너지 합계 막대
    ctx.fillStyle = '#10b981';
    ctx.fillRect(chartX + 150, chartBottom - maxBarH, 44, maxBarH);
    ctx.fillStyle = '#1e293b';
    ctx.fillText('E(합계 일정)', chartX + 138, chartBottom + 18);

    if (running) time += 0.04;
    requestAnimationFrame(draw);
  }

  document.getElementById('toggleBtn').onclick = () => {
    running = !running;
  };
  draw();
</script>`,
  },
  {
    id: 'kinematics',
    label: '🏎️ 물리: 등가속도 직선 운동',
    caption: '초기 속도(v₀)와 가속도(a)에 따른 물체의 이동과 v-t 그래프',
    code: `<div style="font-family: system-ui, sans-serif; padding: 14px; background: #f8fafc; color: #0f172a; border-radius: 12px;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
    <div>
      <strong style="font-size: 15px; color: #4338ca;">🏎️ 등가속도 직선 운동 (s = v₀t + ½at²) 시뮬레이터</strong>
      <p style="font-size: 12px; color: #475569; margin: 2px 0 0;">시간(t)에 따른 물체의 위치 변화와 속도(v = v₀ + at)를 확인하세요.</p>
    </div>
    <button id="runBtn" style="background:#4f46e5; color:white; border:none; border-radius:8px; padding:6px 14px; font-weight:700; font-size:12px; cursor:pointer;">▶ 출발</button>
  </div>

  <canvas id="trackCanvas" width="660" height="170" style="width:100%; height:170px; background:white; border:1px solid #cbd5e1; border-radius:10px; display:block;"></canvas>

  <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:10px; font-size:12px;">
    <label style="background:white; padding:8px; border-radius:8px; border:1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; font-weight:600;">
        <span>초기 속도 v₀</span><span id="v0Txt" style="color:#4f46e5;">10 m/s</span>
      </div>
      <input id="v0Input" type="range" min="0" max="30" value="10" style="width:100%; margin-top:4px;" />
    </label>
    <label style="background:white; padding:8px; border-radius:8px; border:1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; font-weight:600;">
        <span>가속도 a</span><span id="accTxt" style="color:#dc2626;">4 m/s²</span>
      </div>
      <input id="accInput" type="range" min="-6" max="12" value="4" style="width:100%; margin-top:4px;" />
    </label>
    <div style="background:#eef2ff; padding:8px 10px; border-radius:8px; border:1px solid #c7d2fe; display:flex; flex-direction:column; justify-content:center;">
      <div>현재 시각 t: <strong id="tOut">0.0 s</strong></div>
      <div>현재 속도 v: <strong id="vOut">10.0 m/s</strong> / 변위 s: <strong id="sOut">0.0 m</strong></div>
    </div>
  </div>
</div>

<script>
  const canvas = document.getElementById('trackCanvas');
  const ctx = canvas.getContext('2d');
  const v0Input = document.getElementById('v0Input');
  const accInput = document.getElementById('accInput');
  let t = 0;
  let anim = null;

  function render() {
    const v0 = parseFloat(v0Input.value);
    const a = parseFloat(accInput.value);
    document.getElementById('v0Txt').textContent = v0 + ' m/s';
    document.getElementById('accTxt').textContent = a + ' m/s²';

    const v = v0 + a * t;
    const s = v0 * t + 0.5 * a * t * t;

    document.getElementById('tOut').textContent = t.toFixed(1) + ' s';
    document.getElementById('vOut').textContent = v.toFixed(1) + ' m/s';
    document.getElementById('sOut').textContent = s.toFixed(1) + ' m';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 트랙 눈금
    const trackY = 115;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, trackY);
    ctx.lineTo(canvas.width - 20, trackY);
    ctx.stroke();

    for (let m = 0; m <= 120; m += 20) {
      const px = 40 + m * 4.6;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(m + 'm', px - 8, trackY + 18);
      ctx.beginPath();
      ctx.moveTo(px, trackY - 4);
      ctx.lineTo(px, trackY + 4);
      ctx.stroke();
    }

    // 잔상(스트로보스코프 효과: 1초 간격 위치 표시)
    for (let sec = 0; sec < t; sec += 1) {
      const pos = v0 * sec + 0.5 * a * sec * sec;
      const gx = 40 + pos * 4.6;
      if (gx >= 20 && gx <= canvas.width - 20) {
        ctx.fillStyle = 'rgba(79, 70, 229, 0.22)';
        ctx.beginPath();
        ctx.arc(gx, trackY - 16, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 현재 물체
    const curX = Math.max(25, Math.min(canvas.width - 25, 40 + s * 4.6));
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.roundRect(curX - 18, trackY - 30, 36, 24, 6);
    ctx.fill();

    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('v=' + v.toFixed(1) + 'm/s', curX - 24, trackY - 38);
  }

  function step() {
    t += 0.05;
    render();
    if (t < 6.0) anim = requestAnimationFrame(step);
  }

  document.getElementById('runBtn').onclick = () => {
    if (anim) cancelAnimationFrame(anim);
    t = 0;
    step();
  };
  [v0Input, accInput].forEach(el => el.addEventListener('input', () => {
    if (anim) cancelAnimationFrame(anim);
    t = 2.0;
    render();
  }));
  t = 2.0;
  render();
</script>`,
  },
];

/**
 * 교사가 입력한 HTML/JS 조각(또는 전체 HTML 문서)을 안전한 iframe srcDoc 문서로 감싸줍니다.
 */
export function buildSimulationSrcDoc(rawCode: string): string {
  const trimmed = (rawCode || '').trim();
  if (!trimmed) {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:90vh;margin:0;font-size:13px;">시뮬레이션 HTML/JS 코드를 입력하거나 상단 예시 템플릿을 선택하세요.</body></html>`;
  }

  // 이미 완전한 HTML 문서인 경우 그대로 사용
  if (/<!doctype\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }

  // 순수 JavaScript 코드만 입력한 경우 (< 태그가 전혀 없는 경우) 기본 캔버스 제공
  if (!trimmed.includes('<')) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; }
    canvas { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; display: block; width: 100%; }
  </style>
</head>
<body>
  <canvas id="canvas" width="640" height="260"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    ${trimmed}
  </script>
</body>
</html>`;
  }

  // HTML + <script> 조각인 경우 표준 HTML5 래퍼 적용
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: transparent;
      color: #0f172a;
    }
  </style>
</head>
<body>
${trimmed}
</body>
</html>`;
}

interface SimulationBlockPreviewProps {
  code: string;
  caption?: string;
  defaultHeight?: number;
}

export default function SimulationBlockPreview({
  code,
  caption,
  defaultHeight = 370,
}: SimulationBlockPreviewProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [isTall, setIsTall] = useState(false);
  const [showSourceCode, setShowSourceCode] = useState(false);

  const srcDoc = buildSimulationSrcDoc(code);
  const iframeHeight = isTall ? 520 : defaultHeight;

  return (
    <div className="my-4 overflow-hidden rounded-2xl border-2 border-teal-200 bg-gradient-to-b from-teal-50/40 via-white to-slate-50/30 shadow-xs">
      {/* 상단 실험실 헤더 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 bg-teal-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
            <span>🧪</span>
            <span>인터랙티브 시뮬레이션</span>
          </span>
          {caption && (
            <span className="text-xs font-bold text-teal-950">{caption}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-100 transition cursor-pointer"
            title="시뮬레이션을 처음 상태로 다시 실행합니다"
          >
            ↺ 다시 시작
          </button>
          <button
            type="button"
            onClick={() => setIsTall(!isTall)}
            className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            {isTall ? '기본 높이로' : '↕ 크게 보기'}
          </button>
          <button
            type="button"
            onClick={() => setShowSourceCode(!showSourceCode)}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
              showSourceCode
                ? 'border-slate-700 bg-slate-800 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {showSourceCode ? '✕ 코드 닫기' : '</> 코드 보기'}
          </button>
        </div>
      </div>

      {/* 샌드박스 시뮬레이션 실행 영역 */}
      <div className="p-2 bg-white">
        <iframe
          key={reloadKey}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          style={{ height: `${iframeHeight}px` }}
          className="w-full rounded-xl border border-slate-100 bg-white"
          title={caption || '수업 시뮬레이션'}
        />
      </div>

      {/* 선택적 소스코드 열람 영역 */}
      {showSourceCode && (
        <div className="border-t border-slate-800 bg-slate-900 p-4 text-slate-100">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-bold text-teal-300">
              💻 시뮬레이션 HTML / JavaScript 소스 코드
            </span>
          </div>
          <pre className="max-h-64 overflow-auto font-mono text-xs leading-relaxed text-emerald-300">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
