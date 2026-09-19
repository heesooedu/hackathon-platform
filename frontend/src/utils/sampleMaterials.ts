export const QUADRATIC_FUNCTION_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>이차함수 그래프 시뮬레이터</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .container {
      width: 100%;
      max-width: 780px;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
      padding: 18px 24px;
      text-align: center;
    }
    .header h1 { font-size: 20px; font-weight: 800; }
    .header p { font-size: 13px; opacity: 0.9; margin-top: 4px; }
    .content {
      padding: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 640px) {
      .content { grid-template-columns: 1fr; }
    }
    .canvas-wrap {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
    }
    canvas {
      display: block;
      width: 100%;
      height: 320px;
      background: #ffffff;
      border-radius: 12px;
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: 16px;
      justify-content: center;
    }
    .formula-badge {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 12px;
      text-align: center;
      font-family: "Courier New", monospace;
      font-size: 17px;
      font-weight: 700;
      color: #1d4ed8;
    }
    .slider-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .slider-label {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }
    .slider-label span.val {
      font-family: monospace;
      font-size: 14px;
      color: #2563eb;
    }
    input[type=range] {
      width: 100%;
      accent-color: #2563eb;
      cursor: pointer;
    }
    .info-card {
      background: #f1f5f9;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      color: #334155;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
    }
    .info-row strong { color: #0f172a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>이차함수 $y = ax^2 + bx + c$ 탐구기</h1>
      <p>슬라이더를 움직여 계수 $a, b, c$의 변화에 따른 그래프의 모양을 관찰해 보세요.</p>
    </div>
    <div class="content">
      <div class="canvas-wrap">
        <canvas id="graph" width="340" height="320"></canvas>
      </div>
      <div class="controls">
        <div class="formula-badge" id="formulaText">
          y = 1.0x² + 0.0x + 0.0
        </div>

        <div class="slider-group">
          <div class="slider-label">
            <span>계수 a (포물선의 폭과 볼록 방향)</span>
            <span class="val" id="valA">1.0</span>
          </div>
          <input type="range" id="sliderA" min="-4" max="4" step="0.2" value="1">
        </div>

        <div class="slider-group">
          <div class="slider-label">
            <span>계수 b (대칭축의 좌우 이동)</span>
            <span class="val" id="valB">0.0</span>
          </div>
          <input type="range" id="sliderB" min="-6" max="6" step="0.5" value="0">
        </div>

        <div class="slider-group">
          <div class="slider-label">
            <span>계수 c (y절편 및 상하 이동)</span>
            <span class="val" id="valC">0.0</span>
          </div>
          <input type="range" id="sliderC" min="-6" max="6" step="0.5" value="0">
        </div>

        <div class="info-card">
          <div class="info-row">
            <span>볼록 방향:</span>
            <strong id="convexInfo">아래로 볼록 (a > 0)</strong>
          </div>
          <div class="info-row">
            <span>꼭짓점 좌표:</span>
            <strong id="vertexInfo">(0.00, 0.00)</strong>
          </div>
          <div class="info-row">
            <span>축의 방정식:</span>
            <strong id="axisInfo">x = 0.00</strong>
          </div>
          <div class="info-row">
            <span>y절편:</span>
            <strong id="yInterceptInfo">(0, 0.00)</strong>
          </div>
          <div class="info-row">
            <span>판별식 D (b²-4ac):</span>
            <strong id="discriminantInfo">0.00 (중근 1개)</strong>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const canvas = document.getElementById('graph');
    const ctx = canvas.getContext('2d');

    const sliderA = document.getElementById('sliderA');
    const sliderB = document.getElementById('sliderB');
    const sliderC = document.getElementById('sliderC');

    const valA = document.getElementById('valA');
    const valB = document.getElementById('valB');
    const valC = document.getElementById('valC');
    const formulaText = document.getElementById('formulaText');

    const convexInfo = document.getElementById('convexInfo');
    const vertexInfo = document.getElementById('vertexInfo');
    const axisInfo = document.getElementById('axisInfo');
    const yInterceptInfo = document.getElementById('yInterceptInfo');
    const discriminantInfo = document.getElementById('discriminantInfo');

    const scale = 20; // 1단위당 픽셀

    function draw() {
      const a = parseFloat(sliderA.value);
      const b = parseFloat(sliderB.value);
      const c = parseFloat(sliderC.value);

      valA.textContent = a.toFixed(1);
      valB.textContent = b.toFixed(1);
      valC.textContent = c.toFixed(1);

      // 수식 텍스트 포맷팅
      let signB = b >= 0 ? '+ ' : '- ';
      let signC = c >= 0 ? '+ ' : '- ';
      formulaText.textContent = 'y = ' + a.toFixed(1) + 'x² ' + signB + Math.abs(b).toFixed(1) + 'x ' + signC + Math.abs(c).toFixed(1);

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // 1. 모눈종이 그리드
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      for (let x = cx % scale; x < width; x += scale) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = cy % scale; y < height; y += scale) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. x축, y축
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      // x축
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
      // y축
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();

      // 원점 표시
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText('O', cx - 12, cy + 12);
      ctx.fillText('x', width - 12, cy - 6);
      ctx.fillText('y', cx + 6, 12);

      // 3. 축의 방정식 (점선)
      if (a !== 0) {
        const axisX = -b / (2 * a);
        const axisCanvasX = cx + axisX * scale;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(axisCanvasX, 0);
        ctx.lineTo(axisCanvasX, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 4. 이차함수 곡선 그리기
      ctx.strokeStyle = a === 0 ? '#64748b' : (a > 0 ? '#2563eb' : '#dc2626');
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      let started = false;
      for (let px = 0; px <= width; px += 1) {
        const mathX = (px - cx) / scale;
        const mathY = a * mathX * mathX + b * mathX + c;
        const py = cy - mathY * scale;

        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // 5. 꼭짓점 강조 점 및 라벨
      if (a !== 0) {
        const vx = -b / (2 * a);
        const vy = c - (b * b) / (4 * a);
        const vpx = cx + vx * scale;
        const vpy = cy - vy * scale;

        if (vpx >= 0 && vpx <= width && vpy >= 0 && vpy <= height) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(vpx, vpy, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#1e293b';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('꼭짓점(' + vx.toFixed(1) + ', ' + vy.toFixed(1) + ')', vpx + 6, vpy - 6);
        }

        // 특징 정보 업데이트
        convexInfo.textContent = a > 0 ? '아래로 볼록 (a > 0)' : '위로 볼록 (a < 0)';
        convexInfo.style.color = a > 0 ? '#2563eb' : '#dc2626';
        vertexInfo.textContent = '(' + vx.toFixed(2) + ', ' + vy.toFixed(2) + ')';
        axisInfo.textContent = 'x = ' + vx.toFixed(2);
      } else {
        convexInfo.textContent = '직선 (a = 0)';
        convexInfo.style.color = '#64748b';
        vertexInfo.textContent = '꼭짓점 없음 (일차함수)';
        axisInfo.textContent = '대칭축 없음';
      }

      // y절편
      yInterceptInfo.textContent = '(0, ' + c.toFixed(2) + ')';

      // 판별식
      const D = b * b - 4 * a * c;
      let dText = D.toFixed(2);
      if (a === 0) {
        discriminantInfo.textContent = '해당 없음 (일차)';
      } else if (D > 0) {
        discriminantInfo.textContent = dText + ' (서로 다른 두 실근)';
        discriminantInfo.style.color = '#059669';
      } else if (Math.abs(D) < 0.001) {
        discriminantInfo.textContent = '0.00 (중근 1개 접함)';
        discriminantInfo.style.color = '#d97706';
      } else {
        discriminantInfo.textContent = dText + ' (만나지 않음, D < 0)';
        discriminantInfo.style.color = '#dc2626';
      }
    }

    sliderA.addEventListener('input', draw);
    sliderB.addEventListener('input', draw);
    sliderC.addEventListener('input', draw);

    draw();
  </script>
</body>
</html>`;

