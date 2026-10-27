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

export const SAMPLE_GENERAL_MARKDOWN = `> [!CALLOUT:💡] **이번 시간 핵심 질문**: 시민 혁명으로 모든 사람이 곧바로 투표권을 얻었을까요? 재산과 성별의 한계를 넘어 오늘날의 기본권에 이르기까지의 과정을 탐구해 봅니다.

# 1. 시민 혁명과 기본권의 등장

## (1) 근대 이전의 사회와 천부인권 사상
근대 이전의 유럽 사회는 왕과 귀족이 특권을 누리는 신분제 사회였습니다. 그러나 상공업의 발달로 성장한 **시민 계급(부르주아)**은 계몽사상과 **사회계약설**의 영향을 받아 인간은 태어날 때부터 누구나 자유롭고 평등하다는 **천부인권 사상**을 주장했습니다.

## (2) 프랑스 인권 선언 (1789년)의 핵심 조항
> 제1조: 인간은 태어나면서부터 자유로우며 평등한 권리를 가진다. 제2조: 모든 정치적 결사의 목적은 인간의 자연적이고 소멸할 수 없는 권리를 보전하는 데 있다.

- **제1조**: 자유와 평등의 원칙 천명
- **제2조**: 자유권, 재산권, 안전, 압제에의 저항권 규정
- **제3조**: 국민 주권의 원리 선언

---

# 2. 초기 시민 혁명의 한계와 참정권 확대

## (1) 왜 모든 사람이 투표하지 못했을까?
시민 혁명 직후에는 모든 사람에게 선거권이 주어지지 않았습니다. 일정 수준 이상의 **재산을 가지고 세금을 납부하는 성인 남성**에게만 참정권이 인정되었습니다.

## (2) 참정권 확대 운동
- **차티스트 운동 (영국, 19세기)**: 노동자들이 인민헌장을 발표하며 노동자의 보통 선거권을 요구했습니다.
- **여성 참정권 운동 (20세기 초)**: 여성들도 남성과 동등한 투표권을 요구하며 참정권 확대 운동을 전개했습니다.

---

# 3. 현대 사회로의 기본권 확장 (바이마르 헌법)
자본주의가 고도화되면서 빈부격차와 노동 문제 등 자유권만으로는 해결할 수 없는 사회 문제가 발생했습니다. 이에 1919년 독일의 **바이마르 헌법**에서 최초로 인간다운 생활을 보장받을 권리인 **사회권(생존권)**이 명시되었습니다.

\`\`\`mermaid
flowchart LR
    A["18세기 시민 혁명 (자유권·평등권)"] --> B["19~20세기 참정권 확대 운동 (보통 선거권)"]
    B --> C["1919 바이마르 헌법 (사회권·생존권 등장)"]
\`\`\``;

export const SAMPLE_MATH_MARKDOWN = `> [!CALLOUT:📌] **학습 포인트**: 이차함수 $y = ax^2 + bx + c$에서 각 계수 $a, b, c$의 부호가 그래프의 개형과 대칭축의 위치를 어떻게 결정하는지 시각적으로 이해해 봅시다.

# 1. 이차함수 $y = ax^2 + bx + c$의 그래프 성질

## (1) 이차항의 계수 $a$의 역할
- $a > 0$이면 그래프는 **아래로 볼록**하고, $a < 0$이면 **위로 볼록**합니다.
- $|a|$의 값이 클수록 포물선의 폭이 **좁아지고**, 작을수록 폭이 **넓어집니다**.

## (2) 일차항의 계수 $b$와 대칭축의 위치
> 핵심 암기 팁 ("좌동우이"): 대칭축이 y축 왼쪽에 있으면 a와 b의 부호가 같고(동호), 오른쪽에 있으면 부호가 다릅니다(이호).

- 포물선의 대칭축의 방정식은 $x = -\\frac{b}{2a}$ 입니다.
- 대칭축이 $y$축보다 왼쪽에 있으면 $a$와 $b$의 부호가 **같고(동호)**, 오른쪽에 있으면 $a$와 $b$의 부호가 **다릅니다(이호)**.

\`\`\`mermaid
flowchart TD
    Start["이차함수 y = ax² + bx + c"] --> CheckA{"계수 a의 부호는?"}
    CheckA -- "a > 0" --> Down["아래로 볼록 (최솟값 존재)"]
    CheckA -- "a < 0" --> Up["위로 볼록 (최댓값 존재)"]
    Down --> Axis["대칭축 x = -b / 2a (좌동우이 확인)"]
    Up --> Axis
\`\`\`

## (3) 상수항 $c$의 역할
- 상수항 $c$는 그래프가 $y$축과 만나는 점의 $y$좌표, 즉 **$y$절편**을 의미합니다. ($x = 0$ 대입)

---

# 2. 표준형으로의 변환과 파이썬(Python) 꼭짓점 계산 코드
일반형 $y = ax^2 + bx + c$를 완전제곱식 꼴인 표준형 $y = a(x - p)^2 + q$로 바꾸면 꼭짓점의 좌표 $(p, q)$를 바로 구할 수 있습니다.
- 꼭짓점의 $x$좌표: $p = -\\frac{b}{2a}$
- 꼭짓점의 $y$좌표: $q = c - \\frac{b^2}{4a}$

\`\`\`python
def find_vertex(a, b, c):
    # 꼭짓점 좌표 (p, q)와 판별식 D를 계산하는 함수
    p = -b / (2 * a)
    q = c - (b ** 2) / (4 * a)
    discriminant = b ** 2 - 4 * a * c
    if discriminant > 0:
        roots_info = "서로 다른 두 실근"
    elif discriminant == 0:
        roots_info = "중근 (x축에 접함)"
    else:
        roots_info = "실근 없음 (x축과 만나지 않음)"
    return (p, q), roots_info

vertex, status = find_vertex(1, -4, 3)
print("꼭짓점:", vertex, "| 교점 상태:", status)
\`\`\``;

export const SAMPLE_PHYSICS_MARKDOWN = `> [!CALLOUT:🔬] **탐구 핵심 질문**: 비스듬히 던진 물체(포물선 운동)는 수평 방향과 연직 방향에서 각각 어떤 운동을 할까요? 아래 노션 교안 중간의 **JavaScript 운동 시뮬레이터**를 직접 조작하며 확인해 봅시다!

# 1. 포물선 운동의 분해 (수평 vs 연직)

## (1) 수평 방향: 등속도 운동 ($a_x = 0$)
공기 저항을 무시할 때 수평 방향으로는 아무런 힘이 작용하지 않으므로 처음 속력 $v_{0x} = v_0 \\cos\\theta$가 끝까지 일정하게 유지됩니다.
- 수평 이동 거리: $x = (v_0 \\cos\\theta) t$

## (2) 연직 방향: 연직 상방 등가속도 운동 ($a_y = -g$)
연직 방향으로는 아랫방향으로 **중력($mg$)**만 작용하므로 가속도가 $-g$인 등가속도 운동을 합니다.
- 연직 속도: $v_y = v_0 \\sin\\theta - gt$
- 최고점에서의 연직 속도: $v_y = 0$

---

# 2. [실험실] 포물선 운동 JavaScript 인터랙티브 시뮬레이션
아래 슬라이더로 **초기 속력($v_0$)**, **발사 각도($\\theta$)**, **중력가속도($g$)**를 바꾸고 **[▶ 발사 / 재생]** 버튼을 눌러 파란색 수평 속도 벡터($v_x$)와 빨간색 연직 속도 벡터($v_y$)의 변화를 관찰해 보세요.

\`\`\`simulation:포물선 운동(투사체) 속력·발사각·중력가속도 실험실
<div style="font-family: system-ui, sans-serif; padding: 14px; background: #f8fafc; color: #0f172a; border-radius: 12px;">
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
  const scale = 5.2;
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

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);
    ctx.stroke();

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

    const curT = Math.min(t, totalT);
    const x = vx * curT;
    const y = Math.max(0, vy0 * curT - 0.5 * g * curT * curT);
    const curVy = vy0 - g * curT;

    const cx = originX + x * scale;
    const cy = originY - y * scale;

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + vx * 1.1, cy);
    ctx.stroke();

    ctx.strokeStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - curVy * 1.1);
    ctx.stroke();

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
</script>
\`\`\`

---

# 3. 실험 결과 정리 및 심화 생각거리
> 최고점에서도 물체의 속력이 0이 아닌 이유를 수평 방향 속도 성분($v_x$)과 관련지어 설명해 보세요.

- 발사각 $\\theta = 45^\\circ$일 때 수평 도달 거리($R$)가 최대가 되는 것을 위 시뮬레이터로 확인했나요?`;

export const SAMPLE_PHYSICAL_COMPUTING_MARKDOWN = `# 1. 피지컬 컴퓨팅(Physical Computing)의 원리와 구조
> [!CALLOUT:🤖] **핵심 질문:** 소프트웨어 알고리즘이 어떻게 현실 세계의 빛·소리·온도·거리 데이터를 읽고 물리적인 장치(LED·모터·부저)를 움직일 수 있을까요?

- **피지컬 컴퓨팅(Physical Computing)**은 **센서(Sensor)**를 통해 물리적 환경의 아날로그·디지털 신호를 입력받고, **마이크로컨트롤러(MCU)**의 프로그램 논리로 처리한 뒤, **액추에이터(Actuator)**로 현실 세계에 물리적 출력을 내보내는 시스템입니다.
- 정보 교과에서는 대표적으로 **BBC 마이크로비트(micro:bit)**, **아두이노 우노(Arduino Uno)**, **라즈베리파이 피코(Raspberry Pi Pico)** 3가지 보드를 실습에 활용합니다.

\`\`\`mermaid
flowchart LR
    S["📡 입력(Input): 센서\\n조도·온도·초음파·버튼"] --> M["🧠 처리(Process): 마이크로컨트롤러\\nmicro:bit / Arduino Uno / RPi Pico"]
    M --> A["💡 출력(Output): 액추에이터\\nLED·서보모터·피에조 부저"]
\`\`\`

## 마이크로컨트롤러 3종 비교 및 핀(Pin) 구성표
| 구분 | 🤖 BBC micro:bit V2 | ♾️ Arduino Uno R3 | 🍓 Raspberry Pi Pico |
| --- | --- | --- | --- |
| 주 사용 언어 | MicroPython / 블록코딩 | Arduino C/C++ (\`setup\`, \`loop\`) | MicroPython (\`machine\` 모듈) |
| 동작 전압 | 3.3V | 5V | 3.3V |
| 주요 입출력 핀 | \`P0\`, \`P1\`, \`P2\` (악어클립 패드) | 디지털 \`D2~D13\`, 아날로그 \`A0~A5\` | \`GP0~GP22\`, ADC \`GP26~GP28\` |
| 내장 특화 기능 | 5×5 LED 행렬, A/B 버튼, 온도·조도·가속도 센서 | 내장 LED(\`D13\`), 풍부한 실드 생태계 | 내장 LED(\`GP25\`), 고속 듀얼코어 RP2040 |

---

# 2. 실습 ① BBC 마이크로비트: 스마트 자동 야간 가로등
> [!CALLOUT:💡] **실습 방법:** 아래 시뮬레이터에서 **[▶ 시뮬레이션 시작]**을 누른 뒤, **주변 밝기(조도) 슬라이더**를 \`100\` 미만으로 낮추어 5×5 LED 행렬과 \`P0\` 외부 가로등 LED가 자동으로 켜지는지 확인해 보세요!

\`\`\`physical:실습 1. 마이크로비트 조도 센서 기반 스마트 야간 가로등
# @physical_config: {"board":"microbit","components":[{"id":"c1","type":"light_sensor","pin":"P1","label":"주변 밝기(조도)"},{"id":"c2","type":"led","pin":"P0","label":"가로등 LED","color":"yellow"}],"missionPrompt":"조도 센서 슬라이더 값을 100 미만으로 낮추었을 때 5x5 LED 행렬과 P0 가로등 LED가 자동으로 켜지도록 기준값(100)을 150으로 수정해 보세요!"}
from microbit import *

while True:
    light = display.read_light_level()
    print("현재 조도 밝기:", light)
    if light < 100:
        display.show(Image.HEART)
        pin0.write_digital(1)
    else:
        display.clear()
        pin0.write_digital(0)
\`\`\`

---

# 3. 실습 ② 아두이노 Uno R3: 초음파 후방 주차 경보기
> [!CALLOUT:🔊] **실습 방법:** 아두이노 C/C++ 코드에서 \`pulseIn()\`으로 측정한 거리가 \`20cm\` 이하일 때 \`D8\` 피에조 부저와 \`D12\` 경고등 LED가 동시에 작동합니다. **장애물 거리 슬라이더**를 움직여 보세요!

\`\`\`physical:실습 2. 아두이노 Uno 초음파 거리 센서 & 부저 경보기
# @physical_config: {"board":"arduino_uno","components":[{"id":"u1","type":"ultrasonic","pin":"D9","label":"초음파 센서(cm)"},{"id":"u2","type":"buzzer","pin":"D8","label":"경보 피에조 부저"},{"id":"u3","type":"led","pin":"D12","label":"위험 경고 LED","color":"red"}],"missionPrompt":"초음파 센서 거리 슬라이더를 20cm 이하로 줄여 부저 경보음과 빨간 경고 LED가 켜지는지 확인하고, 위험 기준 거리를 30cm로 변경해 보세요!"}
void setup() {
    Serial.begin(9600);
    pinMode(9, OUTPUT);
    pinMode(8, OUTPUT);
    pinMode(12, OUTPUT);
}

void loop() {
    int distance = ultrasonicRead(9);
    Serial.println(distance);

    if (distance <= 20) {
        digitalWrite(12, HIGH);
        tone(8, 880);
    } else {
        digitalWrite(12, LOW);
        noTone(8);
    }
    delay(200);
}
\`\`\`

---

# 4. 실습 ③ 라즈베리파이 피코: ADC 가변저항 & 서보모터 스마트 차단기
> [!CALLOUT:🍓] **실습 방법:** 라즈베리파이 피코의 16비트 ADC(\`read_u16() : 0 ~ 65535\`) 값을 \`0° ~ 180°\` 각도로 변환하여 서보모터 회전각을 제어합니다.

\`\`\`physical:실습 3. 라즈베리파이 피코(RP2040) 가변저항 & 서보모터 제어
# @physical_config: {"board":"rpi_pico","components":[{"id":"p1","type":"potentiometer","pin":"GP26","label":"가변저항 다이얼(ADC0)"},{"id":"p2","type":"servo","pin":"GP16","label":"차단기 서보모터"},{"id":"p3","type":"led","pin":"GP15","label":"개방 표시 LED","color":"green"}],"missionPrompt":"가변저항 다이얼(GP26) 슬라이더를 돌려 서보모터 각도가 90도 이상일 때 초록색 개방 표시 LED(GP15)가 켜지도록 확인해 보세요!"}
from machine import Pin, PWM, ADC
import time

adc = ADC(Pin(26))
servo = PWM(Pin(16))
servo.freq(50)
led = Pin(15, Pin.OUT)

while True:
    raw = adc.read_u16()
    angle = int(raw * 180 / 65535)
    print("ADC:", raw, "-> 서보 각도:", angle)
    servo_angle(16, angle)

    if angle >= 90:
        led.value(1)
    else:
        led.value(0)
    time.sleep(0.2)
\`\`\`

\`\`\`quiz
{"quizId":"quiz_physical_1","questionType":"multiple_choice","questionText":"피지컬 컴퓨팅 시스템에서 조도 센서나 초음파 센서처럼 외부 물리적 환경의 변화를 전기 신호로 측정하여 마이크로컨트롤러에 전달하는 장치를 무엇이라고 하는가?","options":["센서 (Sensor — 입력 장치)","액추에이터 (Actuator — 출력 장치)","컴파일러 (Compiler)","라우터 (Router)"],"correctOptionIndex":0,"answerText":"","explanation":"외부 환경의 빛·소리·온도·거리 등을 감지하여 입력 신호로 바꾸는 장치는 센서(Sensor)이며, LED·서보모터·부저처럼 물리적 동작을 출력하는 장치는 액추에이터(Actuator)입니다.","targetConcept":"센서와 액추에이터의 구분"}
\`\`\``;



