'use client'

import { useState } from 'react'

export const VPYTHON_TEMPLATES: { label: string; title: string; code: string }[] = [
  {
    label: '🌍 지구와 달 공전 3D',
    title: '지구와 달의 3D 중력 공전 시뮬레이션',
    code: `Web VPython 3.2
scene.background = color.rgb(0.05, 0.07, 0.14)
scene.height = 360
scene.caption = "마우스 우클릭(또는 Ctrl+드래그)으로 회전, 휠로 확대/축소해보세요!"

earth = sphere(pos=vector(0, 0, 0), radius=1.2, texture=textures.earth)
moon = sphere(pos=vector(4.5, 0, 0), radius=0.35, color=color.white, make_trail=True, trail_color=color.yellow, retain=150)

moon.v = vector(0, 1.5, 0.4)
dt = 0.03
G_M = 10.0

while True:
    rate(60)
    earth.rotate(angle=0.015, axis=vector(0, 1, 0))
    r = moon.pos - earth.pos
    acc = -G_M * norm(r) / mag2(r)
    moon.v = moon.v + acc * dt
    moon.pos = moon.pos + moon.v * dt`,
  },
  {
    label: '🏀 3D 포물선과 벡터 화살표',
    title: '3D 포물선 운동과 속도 벡터 시각화',
    code: `Web VPython 3.2
scene.background = color.rgb(0.06, 0.09, 0.16)
scene.height = 360

floor = box(pos=vector(0, -3, 0), size=vector(16, 0.3, 6), color=color.rgb(0.3, 0.4, 0.5))
ball = sphere(pos=vector(-6.5, -2.4, 0), radius=0.45, color=color.orange, make_trail=True)
v_arrow = arrow(pos=ball.pos, axis=vector(1.2, 2.0, 0), color=color.cyan, shaftwidth=0.12)

v = vector(4.2, 7.5, 0)
g = vector(0, -9.8, 0)
dt = 0.02

while True:
    rate(60)
    v = v + g * dt
    ball.pos = ball.pos + v * dt
    if ball.pos.y - ball.radius < floor.pos.y + floor.size.y / 2:
        ball.pos.y = floor.pos.y + floor.size.y / 2 + ball.radius
        v.y = -v.y * 0.85
    if abs(ball.pos.x) > 7.5:
        v.x = -v.x
    v_arrow.pos = ball.pos
    v_arrow.axis = v * 0.25`,
  },
  {
    label: '🌀 용수철 단진동 (Helix)',
    title: '3D 용수철 탄성력 단진동 시뮬레이션',
    code: `Web VPython 3.2
scene.background = color.rgb(0.06, 0.08, 0.15)
scene.height = 360

wall = box(pos=vector(-5, 0, 0), size=vector(0.3, 4, 4), color=color.gray(0.6))
mass = box(pos=vector(2, 0, 0), size=vector(1.2, 1.2, 1.2), color=color.rgb(0.95, 0.4, 0.3), make_trail=True, retain=100)
spring = helix(pos=wall.pos, axis=mass.pos - wall.pos, radius=0.45, coils=14, thickness=0.08, color=color.yellow)

L0 = 4.5
k = 12.0
m = 1.0
v = vector(0, 0, 0)
dt = 0.02

while True:
    rate(60)
    stretch = (mass.pos.x - wall.pos.x) - L0
    F = vector(-k * stretch, 0, 0)
    v = v + (F / m) * dt
    mass.pos = mass.pos + v * dt
    spring.axis = mass.pos - wall.pos`,
  },
]

function buildGlowScriptSrcDoc(vpythonCode: string): string {
  const safeJsonCode = JSON.stringify(vpythonCode).replace(/<\/script/gi, '<\\/script')
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link type="text/css" href="https://www.glowscript.org/css/redmond/2.1/jquery-ui.custom.css" rel="stylesheet" />
<script type="text/javascript" src="https://www.glowscript.org/lib/jquery/2.1/jquery.min.js"></script>
<script type="text/javascript" src="https://www.glowscript.org/lib/jquery/2.1/jquery-ui.custom.min.js"></script>
<script type="text/javascript" src="https://www.glowscript.org/package/glow.3.2.min.js"></script>
<script type="text/javascript" src="https://www.glowscript.org/package/RSrun.3.2.min.js"></script>
<script type="text/javascript" src="https://www.glowscript.org/package/RScompiler.3.2.min.js"></script>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #0b0f19;
    color: #f8fafc;
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    overflow-x: hidden;
  }
  #glowscript-wrapper {
    width: 100%;
    min-height: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
  }
  .glowscript canvas {
    border-radius: 10px;
    max-width: 100% !important;
  }
  #error-box {
    display: none;
    width: 95%;
    margin: 12px auto;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(248, 113, 113, 0.45);
    color: #fecaca;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    white-space: pre-wrap;
    line-height: 1.5;
  }
  #print-output {
    width: 96%;
    margin: 6px auto;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.85);
    color: #a7f3d0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    white-space: pre-wrap;
    display: none;
  }
</style>
</head>
<body>
  <div id="glowscript-wrapper">
    <div id="glowscript" class="glowscript"></div>
  </div>
  <div id="print-output"></div>
  <div id="error-box"></div>
  <script type="text/javascript">
    (function() {
      var rawCode = ${safeJsonCode};
      var errorBox = document.getElementById('error-box');
      function showError(err) {
        errorBox.style.display = 'block';
        errorBox.textContent = '⚠️ Web VPython 실행 오류:\\n' + (err && err.message ? err.message : String(err));
      }
      window.onerror = function(msg, src, line, col, err) {
        showError(msg + (line ? ' (줄 ' + line + ')' : ''));
      };
      window.addEventListener('unhandledrejection', function(ev) {
        showError(ev.reason);
      });

      function startVPython() {
        try {
          if (typeof window.glowscript_compile !== 'function') {
            showError('GlowScript 컴파일러를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
            return;
          }
          // 첫 줄의 GlowScript / Web VPython 버전 선언 제거 후 컴파일
          var lines = rawCode.replace(/\\r\\n/g, '\\n').split('\\n');
          while (lines.length > 0 && lines[0].trim() === '') {
            lines.shift();
          }
          var lang = 'vpython';
          var version = '3.2';
          if (lines.length > 0 && /^(GlowScript|Web\\s+VPython)/i.test(lines[0].trim())) {
            lines.shift();
          }
          var cleanedCode = lines.join('\\n');
          var compiledJs = window.glowscript_compile(cleanedCode, { lang: lang, version: version, run: false });
          var container = $("#glowscript").removeAttr("id");
          window.__context = { glowscript_container: container };
          var runner = eval("(function() { " + compiledJs + "; return __main__; })()");
          if (typeof runner === 'function') {
            var res = runner();
            if (res && typeof res.catch === 'function') {
              res.catch(showError);
            }
          }
        } catch (err) {
          showError(err);
        }
      }

      if (document.readyState === 'complete') {
        startVPython();
      } else {
        window.addEventListener('load', startVPython);
      }
    })();
  </script>
</body>
</html>`
}

interface VPythonRunnerBlockProps {
  initialCode: string
  title?: string
  externalUrl?: string
  compact?: boolean
}

export default function VPythonRunnerBlock({
  initialCode,
  title,
  externalUrl,
  compact = false,
}: VPythonRunnerBlockProps) {
  const [code, setCode] = useState(initialCode)
  const [activeCode, setActiveCode] = useState(initialCode)
  const [runKey, setRunKey] = useState(0)
  const [showCodeEditor, setShowCodeEditor] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleRun = () => {
    setActiveCode(code)
    setRunKey((k) => k + 1)
  }

  const handleReset = () => {
    setCode(initialCode)
    setActiveCode(initialCode)
    setRunKey((k) => k + 1)
  }

  const handleCopyAndOpenGlowScript = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // ignore
    }
    window.open(externalUrl || 'https://www.glowscript.org/', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-cyan-300 bg-[#0b0f19] shadow-md">
      {/* 상단 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-extrabold text-cyan-300 border border-cyan-500/30">
            🧊 Web VPython 3.2 (GlowScript 3D)
          </span>
          <span className="text-xs font-bold text-slate-200">
            {title || '3D 파이썬 물리·정보 시뮬레이션'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCodeEditor((prev) => !prev)}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              showCodeEditor
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'border border-slate-700 bg-slate-800 text-cyan-300 hover:bg-slate-700'
            }`}
          >
            {showCodeEditor ? '🔼 파이썬 코드 접기' : '✏️ 파이썬 코드 수정·실험하기'}
          </button>
          <button
            type="button"
            onClick={handleRun}
            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500 transition"
          >
            ▶ 3D 다시 실행
          </button>
          {code !== initialCode && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
            >
              ↺ 원래 코드로 복원
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyAndOpenGlowScript}
            className="rounded-lg border border-cyan-500/40 bg-cyan-950/50 px-2.5 py-1 text-xs font-bold text-cyan-200 hover:bg-cyan-900/60 transition"
            title="코드를 클립보드에 복사하고 GlowScript 사이트를 새 탭으로 엽니다"
          >
            {copied ? '✅ 코드 복사됨!' : externalUrl ? '🚀 공유 링크 열기 ↗' : '🌐 GlowScript 열기 ↗'}
          </button>
        </div>
      </div>

      {/* 학생용 VPython 코드 직접 수정 패널 (토글) */}
      {showCodeEditor && (
        <div className="border-b border-slate-800 bg-slate-950/90 p-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              💡 숫자와 벡터(`vector(x, y, z)`), 색상(`color.cyan`), 속도 등을 바꾼 뒤{' '}
              <strong className="text-cyan-300">Ctrl+Enter</strong> 또는{' '}
              <strong className="text-emerald-300">[▶ 3D 다시 실행]</strong>을 눌러 실험해보세요!
            </span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey || e.shiftKey) && e.key === 'Enter') {
                e.preventDefault()
                handleRun()
                return
              }
              if (e.key === 'Tab') {
                e.preventDefault()
                const start = e.currentTarget.selectionStart
                const end = e.currentTarget.selectionEnd
                const next = code.substring(0, start) + '    ' + code.substring(end)
                setCode(next)
                const target = e.currentTarget
                requestAnimationFrame(() => {
                  target.selectionStart = target.selectionEnd = start + 4
                })
              }
            }}
            rows={Math.min(16, Math.max(6, code.split('\n').length + 1))}
            spellCheck={false}
            className="w-full rounded-xl border border-slate-800 bg-[#070a12] p-3 font-mono text-xs sm:text-sm leading-relaxed text-cyan-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      )}

      {/* 3D WebGL 캔버스 실행 영역 */}
      <iframe
        key={runKey}
        title={title || 'Web VPython 3D 시뮬레이션'}
        sandbox="allow-scripts"
        srcDoc={buildGlowScriptSrcDoc(activeCode)}
        className={`w-full border-0 bg-[#0b0f19] ${compact ? 'min-h-[340px]' : 'min-h-[410px]'}`}
      />

      {/* 하단 조작 안내 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 bg-slate-900/90 px-4 py-1.5 text-[11px] text-slate-400">
        <span>🖱️ 3D 화면 조작: 우클릭 드래그(또는 Ctrl+드래그)=회전 · 마우스 휠(또는 Alt+드래그)=확대/축소</span>
        <span className="text-cyan-400 font-semibold">GlowScript 3.2 WebGL 엔진</span>
      </div>
    </div>
  )
}
