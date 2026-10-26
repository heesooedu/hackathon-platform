'use client'

import { useState, useRef, useEffect } from 'react'

export const VPYTHON_TEMPLATES: { label: string; title: string; code: string }[] = [
  {
    label: '⌨️ 키보드 조종 & print 입출력 (keysdown)',
    title: '키보드 입력(keysdown)으로 3D 상자 조종 및 print 출력 실습',
    code: `Web VPython 3.2
scene.background = color.rgb(0.06, 0.09, 0.16)
scene.height = 280

player = box(pos=vec(0, 0, 0), size=vec(1.2, 1.2, 1.2), color=color.cyan)
print("3D 화면을 클릭한 뒤 방향키(또는 W, A, S, D)를 눌러보세요!")

while True:
    rate(15)
    key = keysdown()
    print(key)
    if 'left' in key or 'a' in key:
        player.pos.x -= 0.15
        player.color = color.yellow
    if 'right' in key or 'd' in key:
        player.pos.x += 0.15
        player.color = color.orange
    if 'up' in key or 'w' in key:
        player.pos.y += 0.15
        player.color = color.green
    if 'down' in key or 's' in key:
        player.pos.y -= 0.15
        player.color = color.magenta`,
  },
  {
    label: '🏀 3D 포물선과 벡터 화살표',
    title: '3D 포물선 운동과 속도 벡터 시각화',
    code: `Web VPython 3.2
scene.background = color.rgb(0.06, 0.09, 0.16)
scene.height = 280

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
scene.height = 280

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

/**
 * 과거 기본값으로 자동 삽입되었던 '지구와 달의 3D 중력 공전 시뮬레이션' 코드는
 * 사용자가 직접 입력한 코드가 아니므로 빈 코드로 정규화합니다.
 */
export function stripLegacyEarthMoonDefaultCode(raw?: string): string {
  if (!raw) return ''
  if (
    raw.includes('texture=textures.earth') &&
    raw.includes('moon = sphere(pos=vector(4.5, 0, 0)')
  ) {
    return ''
  }
  return raw
}

export function stripLegacyEarthMoonDefaultTitle(raw?: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (
    trimmed === '지구와 달의 3D 중력 공전 시뮬레이션' ||
    trimmed === 'Web VPython (GlowScript) 3D 시뮬레이션'
  ) {
    return ''
  }
  return trimmed
}

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
    height: 100%;
    background: #0b0f19;
    color: #f8fafc;
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    overflow-x: hidden;
    overflow-y: auto;
    outline: none;
  }
  #kbd-status-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 14px;
    background: #111827;
    border-bottom: 1px solid #1e293b;
    font-size: 11px;
    cursor: pointer;
    user-select: none;
  }
  .focus-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    font-weight: 700;
    transition: all 0.15s ease;
  }
  .focus-pill.active {
    background: rgba(16, 185, 129, 0.18);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.45);
  }
  .focus-pill.inactive {
    background: rgba(245, 158, 11, 0.16);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.4);
  }
  #key-badge {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #94a3b8;
    font-size: 11px;
  }
  #key-badge strong {
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.14);
    border: 1px solid rgba(56, 189, 248, 0.35);
    padding: 1px 6px;
    border-radius: 5px;
    margin-left: 4px;
  }
  #glowscript-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 8px 12px 12px 12px;
  }
  .glowscript {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .glowscript canvas {
    border-radius: 10px;
    max-width: 100% !important;
  }
  textarea#print,
  .glowscript textarea {
    display: block !important;
    width: 96% !important;
    max-width: 680px !important;
    height: 110px !important;
    margin: 8px auto 4px auto !important;
    padding: 8px 12px !important;
    border-radius: 10px !important;
    background: #090d16 !important;
    color: #34d399 !important;
    border: 1px solid #334155 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
    font-size: 12px !important;
    line-height: 1.5 !important;
    outline: none !important;
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.5) !important;
  }
  #print-console-header {
    display: none;
    width: 96%;
    max-width: 680px;
    margin: 8px auto -6px auto;
    padding: 5px 12px;
    background: #1e293b;
    border: 1px solid #334155;
    border-bottom: none;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: #e2e8f0;
    font-weight: 700;
  }
  #print-console-header + .glowscript textarea,
  .has-print-header textarea#print {
    border-top-left-radius: 0 !important;
    border-top-right-radius: 0 !important;
    margin-top: 0 !important;
  }
  .console-btn {
    background: #0f172a;
    color: #94a3b8;
    border: 1px solid #475569;
    border-radius: 6px;
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }
  .console-btn:hover {
    color: #f8fafc;
    border-color: #64748b;
  }
  #error-box {
    display: none;
    width: 96%;
    max-width: 680px;
    margin: 10px auto;
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
</style>
</head>
<body tabindex="0">
  <div id="kbd-status-bar" title="클릭하면 3D 시뮬레이션 창으로 키보드 포커스가 활성화됩니다">
    <div id="focus-indicator" class="focus-pill inactive">
      <span>⌨️</span>
      <span id="focus-text">3D 화면을 클릭하면 키보드 입력(keysdown)이 전달됩니다</span>
    </div>
    <div id="key-badge">
      현재 눌린 키(keysdown): <strong id="pressed-keys-label">없음 []</strong>
    </div>
  </div>

  <div id="glowscript-wrapper">
    <div id="glowscript" class="glowscript"></div>
  </div>
  <div id="error-box"></div>

  <script type="text/javascript">
    (function() {
      var rawCode = ${safeJsonCode};
      var errorBox = document.getElementById('error-box');
      var focusIndicator = document.getElementById('focus-indicator');
      var focusText = document.getElementById('focus-text');
      var pressedKeysLabel = document.getElementById('pressed-keys-label');
      var activeKeysSet = {};

      function updateFocusUI(isFocused) {
        if (isFocused) {
          focusIndicator.className = 'focus-pill active';
          focusText.textContent = '키보드 입력 활성화됨 (keysdown 작동 중)';
        } else {
          focusIndicator.className = 'focus-pill inactive';
          focusText.textContent = '여기를 클릭하면 키보드 입력(keysdown)이 활성화됩니다';
          activeKeysSet = {};
          pressedKeysLabel.textContent = '없음 []';
        }
      }

      function renderPressedKeys() {
        var keys = Object.keys(activeKeysSet);
        if (keys.length === 0) {
          pressedKeysLabel.textContent = '없음 []';
        } else {
          pressedKeysLabel.textContent = "['" + keys.join("', '") + "']";
        }
      }

      window.addEventListener('focus', function() { updateFocusUI(true); });
      window.addEventListener('blur', function() { updateFocusUI(false); });
      document.addEventListener('mousedown', function(e) {
        if (e.target && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
          window.focus();
          if (document.body) document.body.focus();
        }
        updateFocusUI(true);
      });

      window.addEventListener('keydown', function(e) {
        updateFocusUI(true);
        if (e.code && /^Key[A-Z]$/.test(e.code)) {
          var ascii = e.code.charCodeAt(3);
          if (e.which === 229 || e.keyCode === 229) {
            try {
              Object.defineProperty(e, 'which', { get: function() { return ascii; } });
              Object.defineProperty(e, 'keyCode', { get: function() { return ascii; } });
            } catch (err) {}
          }
          activeKeysSet[e.code.slice(3).toLowerCase()] = true;
        } else if (e.key) {
          var kName = e.key;
          if (kName === 'ArrowLeft') kName = 'left';
          else if (kName === 'ArrowRight') kName = 'right';
          else if (kName === 'ArrowUp') kName = 'up';
          else if (kName === 'ArrowDown') kName = 'down';
          else if (kName === ' ') kName = ' ';
          else if (kName.length === 1) kName = kName.toLowerCase();
          activeKeysSet[kName] = true;
        }
        renderPressedKeys();

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) !== -1) {
          if (!e.target || e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
          }
        }
      }, true);

      window.addEventListener('keyup', function(e) {
        if (e.code && /^Key[A-Z]$/.test(e.code)) {
          var ascii = e.code.charCodeAt(3);
          if (e.which === 229 || e.keyCode === 229) {
            try {
              Object.defineProperty(e, 'which', { get: function() { return ascii; } });
              Object.defineProperty(e, 'keyCode', { get: function() { return ascii; } });
            } catch (err) {}
          }
          delete activeKeysSet[e.code.slice(3).toLowerCase()];
        } else if (e.key) {
          var kName = e.key;
          if (kName === 'ArrowLeft') kName = 'left';
          else if (kName === 'ArrowRight') kName = 'right';
          else if (kName === 'ArrowUp') kName = 'up';
          else if (kName === 'ArrowDown') kName = 'down';
          else if (kName.length === 1) kName = kName.toLowerCase();
          delete activeKeysSet[kName];
        }
        renderPressedKeys();
      }, true);

      function showError(err) {
        errorBox.style.display = 'block';
        errorBox.textContent = '⚠️ Web VPython 실행 오류:\\n' + (err && err.message ? err.message : String(err));
      }
      window.onerror = function(msg, src, line) {
        showError(msg + (line ? ' (줄 ' + line + ')' : ''));
      };
      window.addEventListener('unhandledrejection', function(ev) {
        showError(ev.reason);
      });

      var lastPrintLen = 0;
      var headerInserted = false;
      setInterval(function() {
        var ta = document.getElementById('print') || document.querySelector('.glowscript textarea');
        if (ta) {
          if (!headerInserted && ta.parentNode) {
            headerInserted = true;
            var hdr = document.createElement('div');
            hdr.id = 'print-console-header';
            hdr.style.display = 'flex';
            hdr.innerHTML =
              '<span>📟 파이썬 print() 실시간 출력 콘솔</span>' +
              '<button type="button" class="console-btn" id="clear-print-btn">출력 지우기</button>';
            ta.parentNode.insertBefore(hdr, ta);
            ta.style.borderTopLeftRadius = '0px';
            ta.style.borderTopRightRadius = '0px';
            ta.style.marginTop = '0px';
            var clearBtn = document.getElementById('clear-print-btn');
            if (clearBtn) {
              clearBtn.onclick = function() {
                ta.value = '';
                lastPrintLen = 0;
              };
            }
          }

          var curLen = ta.value.length;
          if (curLen !== lastPrintLen) {
            if (curLen > 7000) {
              var lines = ta.value.split('\\n');
              if (lines.length > 150) {
                ta.value = lines.slice(lines.length - 150).join('\\n');
              }
            }
            ta.scrollTop = ta.scrollHeight;
            lastPrintLen = ta.value.length;
          }
        }
      }, 100);

      function startVPython() {
        try {
          if (typeof window.glowscript_compile !== 'function') {
            showError('GlowScript 컴파일러를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
            return;
          }
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
          if (!/scene\\.height\\s*=/.test(cleanedCode)) {
            cleanedCode = 'scene.height = 280\\n' + cleanedCode;
          }
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
  const normalizedInitialCode = stripLegacyEarthMoonDefaultCode(initialCode)
  const normalizedTitle = stripLegacyEarthMoonDefaultTitle(title)

  const [code, setCode] = useState(normalizedInitialCode)
  const [activeCode, setActiveCode] = useState(normalizedInitialCode)
  const [runKey, setRunKey] = useState(0)
  // 첫 화면은 항상 '파이썬 코드 수정·실험하기'('code')가 되도록 설정 (단, 교안 편집기 우측 미리보기인 compact 모드에서는 3D 실행 화면 표시)
  const [viewMode, setViewMode] = useState<'code' | 'run' | 'split'>(
    compact ? 'run' : 'code'
  )
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    const cleaned = stripLegacyEarthMoonDefaultCode(initialCode)
    setCode(cleaned)
    setActiveCode(cleaned)
  }, [initialCode])

  const focusSimulationWindow = () => {
    setTimeout(() => {
      try {
        iframeRef.current?.contentWindow?.focus()
      } catch {
        // ignore
      }
    }, 80)
  }

  const handleRun = () => {
    setActiveCode(code)
    setRunKey((k) => k + 1)
    if (viewMode === 'code') {
      setViewMode('run')
    }
    focusSimulationWindow()
  }

  const handleReset = () => {
    setCode(normalizedInitialCode)
    setActiveCode(normalizedInitialCode)
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
    const trimmedUrl = externalUrl?.trim() || ''
    const safeUrl = /^https?:\/\//i.test(trimmedUrl)
      ? trimmedUrl
      : 'https://www.glowscript.org/'
    window.open(safeUrl, '_blank', 'noopener,noreferrer')
  }

  const fixedBodyHeightClass = compact ? 'h-[360px]' : 'h-[420px]'
  const hasExecutableCode = activeCode.trim().length > 0

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return

    if ((e.ctrlKey || e.metaKey || e.shiftKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
      return
    }

    const target = e.currentTarget
    const val = target.value
    const start = target.selectionStart
    const end = target.selectionEnd

    // 일반 Enter -> 파이썬 스마트 자동 들여쓰기 (:, (, [, { 뒤 4칸 들여쓰기 및 기존 들여쓰기 유지)
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      const beforeCursor = val.slice(0, start)
      const afterCursor = val.slice(end)
      const currentLine = beforeCursor.split('\n').pop() || ''
      const leadingSpacesMatch = currentLine.match(/^(\s*)/)
      let indent = leadingSpacesMatch ? leadingSpacesMatch[1] : ''

      const trimmedLine = currentLine.replace(/#.*$/, '').trimEnd()
      if (
        trimmedLine.endsWith(':') ||
        trimmedLine.endsWith('：') ||
        trimmedLine.endsWith('(') ||
        trimmedLine.endsWith('[') ||
        trimmedLine.endsWith('{')
      ) {
        indent += '    '
      } else if (
        indent.length >= 4 &&
        /^(return|break|continue|pass|raise)(\b|\s|$)/.test(trimmedLine.trim())
      ) {
        indent = indent.slice(0, -4)
      }

      const nextVal = `${beforeCursor}\n${indent}${afterCursor}`
      const nextPos = start + 1 + indent.length
      target.value = nextVal
      target.setSelectionRange(nextPos, nextPos)
      setCode(nextVal)
      requestAnimationFrame(() => {
        target.focus()
        target.setSelectionRange(nextPos, nextPos)
      })
      return
    }

    // Tab / Shift+Tab -> 4칸 들여쓰기 및 내어쓰기
    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        const beforeCursor = val.slice(0, start)
        const lineStartIdx = beforeCursor.lastIndexOf('\n') + 1
        const currentLine = val.slice(lineStartIdx)
        const removeMatch = currentLine.match(/^( {1,4})/)
        if (removeMatch) {
          const removeCount = removeMatch[1].length
          const nextVal =
            val.slice(0, lineStartIdx) + val.slice(lineStartIdx + removeCount)
          const nextPos = Math.max(lineStartIdx, start - removeCount)
          target.value = nextVal
          target.setSelectionRange(nextPos, nextPos)
          setCode(nextVal)
          requestAnimationFrame(() => {
            target.focus()
            target.setSelectionRange(nextPos, nextPos)
          })
        }
        return
      }

      const nextVal = val.slice(0, start) + '    ' + val.slice(end)
      const nextPos = start + 4
      target.value = nextVal
      target.setSelectionRange(nextPos, nextPos)
      setCode(nextVal)
      requestAnimationFrame(() => {
        target.focus()
        target.setSelectionRange(nextPos, nextPos)
      })
      return
    }

    // Backspace -> 커서 앞이 공백이고 4칸 단위이면 한 번에 4칸 내어쓰기
    if (e.key === 'Backspace' && start === end && start >= 4) {
      const beforeCursor = val.slice(0, start)
      const currentLineBeforeCursor = beforeCursor.split('\n').pop() || ''
      if (
        currentLineBeforeCursor.length >= 4 &&
        /^\s+$/.test(currentLineBeforeCursor) &&
        currentLineBeforeCursor.endsWith('    ')
      ) {
        e.preventDefault()
        const nextVal = val.slice(0, start - 4) + val.slice(end)
        const nextPos = start - 4
        target.value = nextVal
        target.setSelectionRange(nextPos, nextPos)
        setCode(nextVal)
        requestAnimationFrame(() => {
          target.focus()
          target.setSelectionRange(nextPos, nextPos)
        })
      }
    }
  }

  const renderCodeEditorPane = () => (
    <div className="flex h-full flex-col bg-slate-950/95 p-3.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>
          💡 파이썬 VPython 코드를 입력·수정한 뒤{' '}
          <strong className="text-cyan-300">Ctrl+Enter</strong> 또는 우측 상단{' '}
          <strong className="text-emerald-300">[▶ 3D 실행]</strong>을 눌러 실험해보세요!
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          box() · sphere() · arrow() · vec() · rate() · keysdown() · print()
        </span>
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={handleCodeKeyDown}
        placeholder={`Web VPython 3.2\n# 여기에 파이썬 VPython 코드를 작성하고 [▶ 3D 실행]을 눌러보세요!\nbox(pos=vec(0, 0, 0), size=vec(1.2, 1.2, 1.2), color=color.cyan)`}
        spellCheck={false}
        className="w-full flex-1 resize-none overflow-y-auto rounded-xl border border-slate-800 bg-[#070a12] p-3 font-mono text-xs sm:text-sm leading-relaxed text-cyan-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
      />
    </div>
  )

  const renderSimulationPane = () => (
    <div
      className="h-full w-full bg-[#0b0f19]"
      onMouseEnter={() => {
        const activeTag = document.activeElement?.tagName
        if (activeTag !== 'TEXTAREA' && activeTag !== 'INPUT') {
          try {
            iframeRef.current?.contentWindow?.focus()
          } catch {
            // ignore
          }
        }
      }}
    >
      {hasExecutableCode ? (
        <iframe
          ref={iframeRef}
          key={runKey}
          title={normalizedTitle || 'Web VPython 3D 시뮬레이션'}
          sandbox="allow-scripts allow-modals"
          srcDoc={buildGlowScriptSrcDoc(activeCode)}
          className="h-full w-full border-0 bg-[#0b0f19]"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-400">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/90 text-2xl">
            🧊
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-200">
              아직 실행할 VPython 코드가 없습니다
            </p>
            <p className="text-xs text-slate-400">
              {compact
                ? '좌측 코드 입력창에 Web VPython 코드를 작성하면 이곳에 3D 시뮬레이션이 표시됩니다.'
                : '[✏️ 파이썬 코드 수정·실험하기] 화면에서 코드를 작성한 뒤 [▶ 3D 실행]을 눌러보세요.'}
            </p>
          </div>
          {!compact && viewMode !== 'code' && (
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className="mt-1 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition cursor-pointer"
            >
              ✏️ 파이썬 코드 수정·실험하기로 이동
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-cyan-300 bg-[#0b0f19] shadow-md">
      {/* 상단 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-extrabold text-cyan-300 border border-cyan-500/30">
            🧊 Web VPython 3.2
          </span>
          {normalizedTitle && (
            <span className="text-xs font-bold text-slate-200">
              {normalizedTitle}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!compact && (
            <>
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  viewMode === 'code'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'border border-slate-700 bg-slate-800 text-cyan-300 hover:bg-slate-700'
                }`}
              >
                ✏️ 파이썬 코드 수정·실험하기
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ◫ 코드+3D 함께 보기
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleRun}
            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500 transition cursor-pointer"
          >
            ▶ 3D 실행
          </button>
          {code !== normalizedInitialCode && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
            >
              ↺ 원래 코드로 복원
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyAndOpenGlowScript}
            className="rounded-lg border border-cyan-500/40 bg-cyan-950/50 px-2.5 py-1 text-xs font-bold text-cyan-200 hover:bg-cyan-900/60 transition cursor-pointer"
            title="코드를 클립보드에 복사하고 GlowScript 사이트를 새 탭으로 엽니다"
          >
            {copied ? '✅ 코드 복사됨!' : externalUrl ? '🚀 공유 링크 열기 ↗' : '🌐 GlowScript 열기 ↗'}
          </button>
        </div>
      </div>

      {/* 처음부터 크기가 100% 고정되는 메인 영역 */}
      <div className={`w-full overflow-hidden ${fixedBodyHeightClass}`}>
        {viewMode === 'code' && renderCodeEditorPane()}
        {viewMode === 'run' && renderSimulationPane()}
        {viewMode === 'split' && (
          <div className="grid h-full w-full grid-cols-1 divide-y divide-slate-800 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="h-full overflow-hidden">{renderCodeEditorPane()}</div>
            <div className="h-full overflow-hidden">{renderSimulationPane()}</div>
          </div>
        )}
      </div>

      {/* 하단 조작 안내 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 bg-slate-900/90 px-4 py-1.5 text-[11px] text-slate-400">
        <span>
          🖱️ 회전: 우클릭(Ctrl) 드래그 · 확대/축소: 휠 · ⌨️ 키보드 입력(`keysdown`): 3D 화면 클릭 후 키 입력
        </span>
        <span className="text-cyan-400 font-semibold">GlowScript 3.2 (print · input · keysdown 지원)</span>
      </div>
    </div>
  )
}
