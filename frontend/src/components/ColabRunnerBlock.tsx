'use client';

import { useState, useRef, useEffect } from 'react';

export interface ColabTemplate {
  id: string;
  label: string;
  caption: string;
  code: string;
}

export const COLAB_TEMPLATES: ColabTemplate[] = [
  {
    id: 'algo-basic',
    label: '🔢 기초 알고리즘 (리스트·반복문·탐색)',
    caption: '리스트 데이터 통계 및 최댓값 탐색 알고리즘 실습',
    code: `# [실습] 학생들의 타자 속도(타/분) 데이터를 분석해 봅시다!
# 숫자를 자유롭게 바꾸고 [▶ 코드 실행] 또는 Shift+Enter를 눌러보세요.

scores = [240, 310, 195, 420, 380, 290, 455]

total = 0
max_score = scores[0]

for s in scores:
    total += s
    if s > max_score:
        max_score = s

avg = total / len(scores)

print(f"📊 전체 학생 수: {len(scores)}명")
print(f"✅ 평균 타자 속도: {avg:.1f} 타/분")
print(f"🏆 최고 기록: {max_score} 타/분")
print("🌟 350타 이상 우수자:", [x for x in scores if x >= 350])`,
  },
  {
    id: 'binary-search',
    label: '🔍 이진 탐색 vs 순차 탐색 비교',
    caption: '정렬된 데이터에서 이진 탐색(Binary Search) 단계 수 확인하기',
    code: `# [실습] target 숫자를 바꿔가며 이진 탐색이 몇 번 만에 찾는지 실험해 보세요!
data = [10, 23, 35, 42, 56, 68, 77, 84, 91, 99]
target = 77  # <-- 찾고 싶은 값을 바꿔보세요!

low = 0
high = len(data) - 1
steps = 0

print(f"전체 리스트: {data}")
print(f"찾는 값(target): {target}\\n" + "-" * 36)

while low <= high:
    steps += 1
    mid = (low + high) // 2
    print(f"[{steps}단계] 탐색 범위 인덱스 ({low}~{high}) -> 중앙값 data[{mid}] = {data[mid]}")
    
    if data[mid] == target:
        print(f"\\n🎉 찾았습니다! 인덱스 {mid}번에서 총 {steps}번 비교 만에 탐색 성공!")
        break
    elif data[mid] < target:
        low = mid + 1
    else:
        high = mid - 1
else:
    print(f"\\n❌ {target}은(는) 리스트에 없습니다. (총 {steps}번 비교)")`,
  },
  {
    id: 'matplotlib-plot',
    label: '📈 데이터 시각화 (numpy · matplotlib 그래프)',
    caption: '파이썬 matplotlib으로 함수·데이터 그래프 그리기',
    code: `# [실습] 코랩처럼 교안 안에서 바로 matplotlib 그래프를 그려봅니다!
# (첫 실행 시 numpy/matplotlib 패키지 로딩에 약 3~5초가 소요됩니다)
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 10, 100)
y1 = np.sin(x)
y2 = np.cos(x)

plt.figure(figsize=(6, 3.2))
plt.plot(x, y1, label="sin(x)", linewidth=2.2, color="#2563eb")
plt.plot(x, y2, label="cos(x)", linewidth=2.2, linestyle="--", color="#e11d48")
plt.title("Trigonometric Functions in Python")
plt.xlabel("x")
plt.ylabel("y")
plt.grid(True, alpha=0.3)
plt.legend()
plt.tight_layout()
plt.show()

print("✅ 그래프 렌더링 완료! 위 수식(sin, cos)이나 범위를 수정해 다시 실행해 보세요.")`,
  },
];

interface ColabRunnerBlockProps {
  code: string;
  caption?: string;
  externalUrl?: string;
}

const PYODIDE_WORKER_SRCDOC = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script>
</head>
<body>
<script>
  let pyodideReadyPromise = null;

  async function ensurePyodide() {
    if (!pyodideReadyPromise) {
      window.parent.postMessage({ type: 'PY_STATUS', status: 'loading_runtime', message: '파이썬 엔진(Pyodide) 준비 중...' }, '*');
      pyodideReadyPromise = loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
      });
    }
    return await pyodideReadyPromise;
  }

  window.addEventListener('message', async (event) => {
    const data = event.data;
    if (!data || data.type !== 'RUN_PYTHON') return;

    const runId = data.runId;
    const code = data.code || '';
    const startTime = performance.now();

    try {
      const pyodide = await ensurePyodide();

      // 패키지 자동 감지 및 로드 (numpy, matplotlib 등)
      if (/\\b(import|from)\\s+(numpy|matplotlib|pandas|scipy|sympy)\\b/.test(code)) {
        window.parent.postMessage({ type: 'PY_STATUS', runId, status: 'loading_packages', message: '과학기술 패키지(numpy/matplotlib 등) 불러오는 중...' }, '*');
      }
      await pyodide.loadPackagesFromImports(code);

      window.parent.postMessage({ type: 'PY_STATUS', runId, status: 'running', message: '코드 실행 중...' }, '*');

      let stdoutBuffer = [];
      let stderrBuffer = [];

      pyodide.setStdout({
        batched: (str) => {
          stdoutBuffer.push(str);
        }
      });
      pyodide.setStderr({
        batched: (str) => {
          stderrBuffer.push(str);
        }
      });

      // input() 함수가 브라우저 프롬프트 창으로 동작하도록 연결
      pyodide.globals.set('__ browser_input', (promptText) => {
        const res = window.prompt(promptText || '값을 입력하세요:');
        return res !== null ? res : '';
      });

      await pyodide.runPythonAsync(\`
import builtins
def _custom_input(prompt=""):
    from js import window
    res = window.prompt(str(prompt) if prompt else "파이썬 input() 입력:")
    if res is None:
        return ""
    print(f"{prompt}{res}")
    return str(res)
builtins.input = _custom_input
\`);

      // 만약 matplotlib을 사용하는 경우 Agg 백엔드 설정
      if (code.includes('matplotlib')) {
        await pyodide.runPythonAsync(\`
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.close('all')
\`);
      }

      const result = await pyodide.runPythonAsync(code);

      // matplotlib 그래프가 생성되었는지 확인하고 Base64 PNG로 추출
      let plots = [];
      if (code.includes('matplotlib')) {
        const extractedPlots = await pyodide.runPythonAsync(\`
import io, base64
import matplotlib.pyplot as plt
_imgs = []
for _num in plt.get_fignums():
    _fig = plt.figure(_num)
    _buf = io.BytesIO()
    _fig.savefig(_buf, format='png', dpi=130, bbox_inches='tight')
    _buf.seek(0)
    _imgs.append(base64.b64encode(_buf.read()).decode('utf-8'))
plt.close('all')
_imgs
\`);
        if (extractedPlots && extractedPlots.toJs) {
          plots = extractedPlots.toJs();
        }
      }

      let finalOutput = stdoutBuffer.join('\\n');
      if (result !== undefined && result !== null) {
        const reprStr = String(result);
        if (reprStr !== 'None' && !finalOutput.endsWith(reprStr)) {
          finalOutput = finalOutput ? finalOutput + '\\n' + reprStr : reprStr;
        }
      }

      const elapsedMs = Math.round(performance.now() - startTime);
      window.parent.postMessage({
        type: 'PY_RESULT',
        runId,
        stdout: finalOutput,
        stderr: stderrBuffer.join('\\n'),
        plots,
        elapsedMs
      }, '*');
    } catch (err) {
      const elapsedMs = Math.round(performance.now() - startTime);
      window.parent.postMessage({
        type: 'PY_ERROR',
        runId,
        error: err && err.message ? err.message : String(err),
        elapsedMs
      }, '*');
    }
  });
</script>
</body>
</html>`;

export default function ColabRunnerBlock({
  code: initialCode,
  caption,
  externalUrl,
}: ColabRunnerBlockProps) {
  const [studentCode, setStudentCode] = useState(initialCode);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [stdout, setStdout] = useState<string | null>(null);
  const [stderr, setStderr] = useState<string | null>(null);
  const [plots, setPlots] = useState<string[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [executionCount, setExecutionCount] = useState<number>(0);
  const [workerKey, setWorkerKey] = useState<number>(0);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 선생님 원본 코드가 바뀌면 동기화
  useEffect(() => {
    setStudentCode(initialCode);
  }, [initialCode]);

  // 텍스트영역 높이 자동 조절
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(110, el.scrollHeight)}px`;
    }
  }, [studentCode]);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.runId && activeRunIdRef.current && data.runId !== activeRunIdRef.current) {
        return;
      }

      if (data.type === 'PY_STATUS') {
        setStatusMessage(data.message || '실행 중...');
      } else if (data.type === 'PY_RESULT') {
        setIsRunning(false);
        setStatusMessage('');
        setStdout(data.stdout ?? '');
        setStderr(data.stderr || null);
        setPlots(Array.isArray(data.plots) ? data.plots : []);
        setElapsedMs(data.elapsedMs ?? null);
        setExecutionCount((c) => c + 1);
      } else if (data.type === 'PY_ERROR') {
        setIsRunning(false);
        setStatusMessage('');
        setStderr(data.error || '파이썬 실행 중 오류가 발생했습니다.');
        setElapsedMs(data.elapsedMs ?? null);
        setExecutionCount((c) => c + 1);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  function runPythonCode() {
    if (!studentCode.trim()) return;
    const runId = `run-${Date.now()}`;
    activeRunIdRef.current = runId;
    setIsRunning(true);
    setStatusMessage('파이썬 실행 환경 연결 중...');
    setStderr(null);

    const sendRunMessage = () => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'RUN_PYTHON',
          runId,
          code: studentCode,
        },
        '*'
      );
    };

    // iframe이 이미 로드되어 있으면 바로 전송
    sendRunMessage();
  }

  function stopExecution() {
    activeRunIdRef.current = null;
    setIsRunning(false);
    setStatusMessage('');
    setWorkerKey((prev) => prev + 1);
    setStderr('⏹️ 실행이 사용자에 의해 중지되었습니다.');
  }

  function handleStudentEditorKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (e.nativeEvent.isComposing) return;

    // Shift + Enter 또는 Ctrl + Enter -> 코랩처럼 즉시 코드 실행!
    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runPythonCode();
      return;
    }

    const el = e.currentTarget;
    const val = el.value;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    // 일반 Enter -> 파이썬 스마트 들여쓰기(:, (, [, { 뒤 4칸 들여쓰기)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const before = val.slice(0, start);
      const after = val.slice(end);
      const currentLine = before.split('\n').pop() || '';
      const match = currentLine.match(/^(\s*)/);
      let indent = match ? match[1] : '';
      const trimmed = currentLine.trimEnd();
      if (
        trimmed.endsWith(':') ||
        trimmed.endsWith('(') ||
        trimmed.endsWith('[') ||
        trimmed.endsWith('{')
      ) {
        indent += '    ';
      }
      const nextVal = `${before}\n${indent}${after}`;
      const nextPos = start + 1 + indent.length;
      setStudentCode(nextVal);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(nextPos, nextPos);
      });
      return;
    }

    // Tab -> 4칸 공백
    if (e.key === 'Tab') {
      e.preventDefault();
      const before = val.slice(0, start);
      const after = val.slice(end);
      const nextVal = `${before}    ${after}`;
      const nextPos = start + 4;
      setStudentCode(nextVal);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(nextPos, nextPos);
      });
    }
  }

  function downloadIpynbFile() {
    const notebookJson = {
      nbformat: 4,
      nbformat_minor: 0,
      metadata: {
        colab: {
          provenance: [],
          name: `${caption || 'python_practice'}.ipynb`,
        },
        kernelspec: {
          name: 'python3',
          display_name: 'Python 3',
        },
        language_info: {
          name: 'python',
        },
      },
      cells: [
        {
          cell_type: 'markdown',
          metadata: {},
          source: [`# ${caption || '정보 수업 파이썬 실습'}\n`],
        },
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: studentCode
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map((line, i, arr) => (i < arr.length - 1 ? `${line}\n` : line)),
        },
      ],
    };

    const blob = new Blob([JSON.stringify(notebookJson, null, 2)], {
      type: 'application/x-ipynb+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(caption || 'colab_practice').replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}.ipynb`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyAndOpenColab() {
    try {
      await navigator.clipboard.writeText(studentCode);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    } catch {
      // clipboard fallback ignored
    }
    const targetUrl =
      externalUrl && externalUrl.trim()
        ? externalUrl.trim()
        : 'https://colab.new';
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  const isModified = studentCode !== initialCode;

  return (
    <div className="my-4 overflow-hidden rounded-2xl border-2 border-amber-300/90 bg-slate-950 text-slate-100 shadow-md">
      {/* 숨겨진 Pyodide 실행 샌드박스 iframe */}
      <iframe
        key={workerKey}
        ref={iframeRef}
        srcDoc={PYODIDE_WORKER_SRCDOC}
        title="Python Pyodide Runner"
        sandbox="allow-scripts allow-modals"
        className="hidden"
      />

      {/* 상단 코랩 스타일 헤더 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/95 px-2.5 py-0.5 text-[11px] font-black text-slate-950 shadow-2xs">
            <span>🐍</span>
            <span>CO</span>
            <span>파이썬 실습 셀 (Colab)</span>
          </span>
          <span className="text-xs font-bold text-amber-100">
            {caption || '브라우저에서 바로 코드를 수정하고 ▶ 실행해 보세요'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {isModified && (
            <button
              type="button"
              onClick={() => setStudentCode(initialCode)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
              title="선생님이 작성한 처음 파이썬 코드로 되돌립니다"
            >
              ↺ 원본 코드로 복원
            </button>
          )}

          <button
            type="button"
            onClick={downloadIpynbFile}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-slate-700 transition cursor-pointer"
            title="구글 코랩(Google Colab)이나 주피터 노트북에서 바로 열 수 있는 .ipynb 파일로 저장합니다"
          >
            💾 .ipynb 코랩 파일 저장
          </button>

          <button
            type="button"
            onClick={copyAndOpenColab}
            className="rounded-lg bg-amber-500/20 border border-amber-400/50 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 transition cursor-pointer"
            title="코드를 자동 복사하고 Google Colab 노트북 창을 엽니다"
          >
            {copiedNotice
              ? '✅ 코드 복사됨! 코랩 열리는 중...'
              : externalUrl
              ? '🚀 선생님 코랩 노트북 열기 (코드 복사)'
              : '🚀 코드 복사 & 새 Google Colab 열기'}
          </button>
        </div>
      </div>

      {/* 코랩 셀 본문: 좌측 [ ▶ ] 실행 버튼 + 우측 코드 에디터 */}
      <div className="flex items-stretch bg-slate-950">
        {/* 좌측 거터: 코랩 특유의 동그란 실행 버튼과 [1] 실행 카운트 */}
        <div className="flex w-14 shrink-0 flex-col items-center border-r border-slate-800/80 bg-slate-900/60 pt-3.5 pb-2 select-none">
          {!isRunning ? (
            <button
              type="button"
              onClick={runPythonCode}
              title="파이썬 코드 실행 (단축키: Shift + Enter)"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-md hover:bg-amber-300 hover:scale-105 active:scale-95 transition cursor-pointer font-black pl-0.5"
            >
              ▶
            </button>
          ) : (
            <button
              type="button"
              onClick={stopExecution}
              title="실행 중지"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white shadow-md hover:bg-rose-400 animate-pulse transition cursor-pointer text-xs font-black"
            >
              ■
            </button>
          )}
          <span className="mt-2 font-mono text-[11px] text-slate-400">
            [{isRunning ? '*' : executionCount > 0 ? executionCount : ' '}]
          </span>
        </div>

        {/* 우측: 학생이 직접 수정 가능한 파이썬 코드 영역 */}
        <div className="flex-1 min-w-0 p-3.5">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              ✏️ 코드를 자유롭게 수정한 뒤 좌측{' '}
              <strong className="text-amber-300">[▶]</strong> 버튼 또는{' '}
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-amber-200">
                Shift + Enter
              </kbd>
              를 눌러 직접 실행해 보세요!
            </span>
            {elapsedMs !== null && !isRunning && (
              <span className="text-emerald-400 font-mono text-[10px]">
                ✓ 실행 완료 ({(elapsedMs / 1000).toFixed(2)}s)
              </span>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={studentCode}
            spellCheck={false}
            onChange={(e) => setStudentCode(e.target.value)}
            onKeyDown={handleStudentEditorKeyDown}
            className="w-full resize-none overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 p-3 font-mono text-xs sm:text-sm text-emerald-300 leading-relaxed focus:border-amber-400/70 focus:outline-none"
          />
        </div>
      </div>

      {/* 하단 실행 결과 출력창 (Colab Output Cell) */}
      {(isRunning ||
        stdout !== null ||
        stderr !== null ||
        plots.length > 0) && (
        <div className="border-t border-slate-800 bg-slate-900/95 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-300 flex items-center gap-1.5">
              <span>🖥️ 실행 결과 (Output)</span>
              {isRunning && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
                  ⏳ {statusMessage || '실행 중...'}
                </span>
              )}
            </span>
            {!isRunning && (
              <button
                type="button"
                onClick={() => {
                  setStdout(null);
                  setStderr(null);
                  setPlots([]);
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                출력 지우기 ✕
              </button>
            )}
          </div>

          {/* 표준 출력 (stdout) */}
          {stdout !== null && (
            <pre className="overflow-x-auto rounded-xl bg-black/70 p-3.5 font-mono text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-wrap border border-slate-800">
              {stdout !== '' ? (
                stdout
              ) : (
                <span className="text-slate-500 italic">
                  (출력값 없음 — print() 문을 사용해 결과를 출력해 보세요)
                </span>
              )}
            </pre>
          )}

          {/* 에러 출력 (stderr) */}
          {stderr && (
            <pre className="mt-2 overflow-x-auto rounded-xl border border-rose-500/40 bg-rose-950/50 p-3.5 font-mono text-xs text-rose-200 leading-relaxed whitespace-pre-wrap">
              {stderr}
            </pre>
          )}

          {/* Matplotlib 그래프 이미지 출력 */}
          {plots.length > 0 && (
            <div className="mt-3 space-y-2">
              {plots.map((base64Img, pIdx) => (
                <div
                  key={pIdx}
                  className="inline-block overflow-hidden rounded-xl border border-slate-700 bg-white p-2 shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${base64Img}`}
                    alt={`Matplotlib Plot ${pIdx + 1}`}
                    className="max-h-96 w-auto object-contain"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
