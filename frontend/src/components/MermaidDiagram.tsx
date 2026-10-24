'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      render: (
        id: string,
        text: string
      ) => Promise<{ svg: string; bindFunctions?: (el: Element) => void }>;
    };
  }
}

let mermaidLoadingPromise: Promise<void> | null = null;

function loadMermaidFromCdn(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.mermaid) return Promise.resolve();
  if (mermaidLoadingPromise) return mermaidLoadingPromise;

  mermaidLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('mermaid-cdn-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Mermaid 로드 실패'))
      );
      return;
    }

    const script = document.createElement('script');
    script.id = 'mermaid-cdn-script';
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
    script.async = true;
    script.onload = () => {
      if (window.mermaid) {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
        });
      }
      resolve();
    };
    script.onerror = () => {
      mermaidLoadingPromise = null;
      reject(new Error('Mermaid 스크립트를 불러오지 못했습니다.'));
    };
    document.head.appendChild(script);
  });

  return mermaidLoadingPromise;
}

export default function MermaidDiagram({ chart }: { chart: string }) {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const renderIdRef = useRef(
    `mermaid-svg-${Math.random().toString(36).slice(2, 9)}`
  );

  useEffect(() => {
    const cleanChart = chart.trim();
    if (!cleanChart) {
      setSvgHtml('');
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await loadMermaidFromCdn();
        if (cancelled || !window.mermaid) return;

        const uniqueId = `${renderIdRef.current}-${Date.now()}`;
        const { svg } = await window.mermaid.render(uniqueId, cleanChart);
        if (!cancelled) {
          setSvgHtml(svg);
          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : '다이어그램 문법을 확인해 주세요.'
          );
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chart]);

  if (!chart.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-6 text-center text-xs text-gray-400">
        순서도(Mermaid) 코드를 입력하면 여기에 다이어그램이 실시간으로 그려집니다.
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 space-y-1">
        <div className="font-bold">⚠️ 순서도(Mermaid) 문법 확인 필요</div>
        <pre className="whitespace-pre-wrap font-mono text-[11px] text-amber-700/90 overflow-x-auto">
          {chart}
        </pre>
      </div>
    );
  }

  if (!svgHtml) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-gray-50/50 py-8 text-xs text-gray-400">
        ⏳ 순서도 렌더링 중...
      </div>
    );
  }

  return (
    <div
      className="flex justify-center overflow-x-auto rounded-2xl border border-gray-200/80 bg-white p-5 shadow-2xs [&_svg]:max-w-full [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
