'use client';

import { useState, useRef, useEffect } from 'react';
import {
  NotionBlock,
  NotionBlockType,
  NotionImageItem,
  ImageSizeOption,
  CodeLanguage,
  InlineQuizBlockData,
  createBlockId,
  createRowId,
  createColId,
  createInlineQuizId,
  createDefaultQuizData,
  blocksToMarkdown,
  getBlockImages,
  createDefaultTableRows,
  groupBlocksIntoRows,
  getNormalizedRowWidths,
  getNormalizedColumnWidths,
  getNormalizedStackHeights,
  cleanupOrphanRowIds,
  extractYouTubeVideoId,
  normalizeExternalUrl,
} from '@/utils/notionBlocks';
import { QuizQuestionType } from '@/types/database.types';
import { generateInlineQuizDraftAction } from '@/app/lessons/actions';
import MermaidDiagram from '@/components/MermaidDiagram';
import SimulationBlockPreview, {
  SIMULATION_TEMPLATES,
} from '@/components/SimulationBlockPreview';
import ColabRunnerBlock, {
  COLAB_TEMPLATES,
} from '@/components/ColabRunnerBlock';
import VPythonRunnerBlock, {
  VPYTHON_TEMPLATES,
  stripLegacyEarthMoonDefaultCode,
  stripLegacyEarthMoonDefaultTitle,
} from '@/components/VPythonRunnerBlock';
import PhysicalComputingBlock, {
  PHYSICAL_COMPUTING_TEMPLATES,
  BOARD_META,
  COMPONENT_CATALOG,
  parsePhysicalBlockContent,
  serializePhysicalBlockContent,
  generateWiringTableRows,
  PhysicalBoardType,
  VirtualComponent,
  LedColorOption,
} from '@/components/PhysicalComputingBlock';
import { renderInlineMarkdown } from '@/components/LessonMaterialViewer';

interface NotionBlockEditorProps {
  blocks: NotionBlock[];
  onChange: (newBlocks: NotionBlock[]) => void;
}

const CALLOUT_ICONS = ['💡', '📌', '🎯', '⚠️', '❓', '📖', '🔬', '🏛️', '✨'];

const CODE_LANGUAGES: { value: CodeLanguage; label: string }[] = [
  { value: 'python', label: '🐍 Python' },
  { value: 'javascript', label: '🟨 JavaScript' },
  { value: 'typescript', label: '🔷 TypeScript' },
  { value: 'html', label: '🌐 HTML' },
  { value: 'css', label: '🎨 CSS' },
  { value: 'sql', label: '🗄️ SQL' },
  { value: 'c', label: '⚙️ C' },
  { value: 'cpp', label: '⚙️ C++' },
  { value: 'java', label: '☕ Java' },
  { value: 'text', label: '📄 Plain Text' },
];

const MERMAID_TEMPLATES: { label: string; code: string }[] = [
  {
    label: '📊 기본 순서도 (Flowchart)',
    code: `flowchart TD
    A["문제 상황 인식"] --> B{"조건을 만족하는가?"}
    B -- "예 (Yes)" --> C["핵심 원리 적용"]
    B -- "아니오 (No)" --> D["원인 재탐색 및 가설 수정"]
    C --> E["결론 도출"]
    D --> B`,
  },
  {
    label: '➡️ 가로형 단계도 (Process)',
    code: `flowchart LR
    Step1["1단계: 개념 이해"] --> Step2["2단계: 사례 분석"]
    Step2 --> Step3["3단계: 심화 적용"]
    Step3 --> Step4["4단계: 형성평가 확인"]`,
  },
  {
    label: '🔄 상호작용 시퀀스 (Sequence)',
    code: `sequenceDiagram
    participant S as 학생(클라이언트)
    participant T as 교사(서버)
    S->>T: 1. 수업 질문 제출
    T->>T: 2. 핵심 오개념 분석 및 교안 패치
    T-->>S: 3. 보충 설명 및 맞춤형 퀴즈 제공`,
  },
  {
    label: '🗂️ 개념 구조도 (Class/Concept)',
    code: `flowchart TD
    Root["기본권의 종류"] --> A["자유권 (국가 권력 간섭 배제)"]
    Root --> B["참정권 (정치 과정 참여)"]
    Root --> C["사회권 (인간다운 생활 보장)"]`,
  },
];

const BLOCK_TYPE_META: {
  type: NotionBlockType;
  label: string;
  desc: string;
  badge: string;
  keywords: string[];
}[] = [
  {
    type: 'p',
    label: '본문 텍스트',
    desc: '일반 수업 설명 단락을 작성합니다',
    badge: 'T',
    keywords: ['p', 'text', '본문', '텍스트'],
  },
  {
    type: 'h1',
    label: '대제목 (제목 1)',
    desc: '단원의 가장 큰 제목입니다',
    badge: 'H1',
    keywords: ['h1', 'heading1', '대제목', '제목1', '제목'],
  },
  {
    type: 'h2',
    label: '중제목 (제목 2)',
    desc: '주요 개념이나 소단원 제목입니다',
    badge: 'H2',
    keywords: ['h2', 'heading2', '중제목', '제목2'],
  },
  {
    type: 'h3',
    label: '소제목 (제목 3)',
    desc: '세부 항목 제목입니다',
    badge: 'H3',
    keywords: ['h3', 'heading3', '소제목', '제목3'],
  },
  {
    type: 'bullet',
    label: '글머리 기호 목록',
    desc: '핵심 내용을 리스트로 정리합니다',
    badge: '•',
    keywords: ['bullet', 'list', '목록', '리스트'],
  },
  {
    type: 'callout',
    label: '콜아웃 강조 박스',
    desc: '아이콘과 배경색이 있는 노션 강조 박스입니다',
    badge: '💡',
    keywords: ['callout', '콜아웃', '강조', '박스'],
  },
  {
    type: 'quote',
    label: '인용구 / 지문 박스',
    desc: '국어·영어 지문이나 역사 사료, 정의를 인용합니다',
    badge: '❝',
    keywords: ['quote', '인용', '지문', '사료'],
  },
  {
    type: 'table',
    label: '표 (Table)',
    desc: '비교표, 개념 정리표, 실험 데이터 표를 행·열로 작성합니다',
    badge: '⊞',
    keywords: ['table', 'grid', '표', '테이블', '비교표', '행열'],
  },
  {
    type: 'code',
    label: '코드 블록 (Python 등 자동 들여쓰기)',
    desc: 'Python·JS·SQL 코드 작성 (엔터 시 자동 들여쓰기 & Tab 지원)',
    badge: '</>',
    keywords: ['code', 'python', 'js', '코드', '파이썬', '프로그래밍'],
  },
  {
    type: 'colab',
    label: '파이썬 실행 셀 (Colab 스타일 실습)',
    desc: '학생들이 교안 안에서 직접 Python 코드를 수정·실행하고 그래프까지 그리는 코랩 셀입니다',
    badge: '🐍',
    keywords: [
      'colab',
      'python',
      'jupyter',
      'pyodide',
      '코랩',
      '파이썬실행',
      '정보',
      '실습',
      '주피터',
    ],
  },
  {
    type: 'vpython',
    label: 'Web VPython 3D (GlowScript 시뮬레이션)',
    desc: '정보·물리 수업용 GlowScript Web VPython 3.2 3D 시뮬레이션을 학생이 직접 수정·실행합니다',
    badge: '🧊',
    keywords: [
      'vpython',
      'glowscript',
      '3d',
      '글로우스크립트',
      '브이파이썬',
      '물리',
      '정보',
      '3d시뮬레이션',
    ],
  },
  {
    type: 'physical',
    label: '피지컬 컴퓨팅 실습실 (마이크로비트·아두이노·피코)',
    desc: 'Tinkercad 스타일로 마이크로비트·아두이노 Uno·라즈베리파이 피코 회로 배선과 코드를 시뮬레이션합니다',
    badge: '⚡',
    keywords: [
      'physical',
      'microbit',
      'arduino',
      'pico',
      'tinkercad',
      '피지컬',
      '피지컬컴퓨팅',
      '마이크로비트',
      '아두이노',
      '라즈베리파이',
      '피코',
      '센서',
      '회로',
      '정보',
    ],
  },
  {
    type: 'mermaid',
    label: '순서도 / 다이어그램 (Mermaid)',
    desc: '알고리즘 순서도, 개념 구조도, 흐름도를 실시간으로 그립니다',
    badge: '❖',
    keywords: ['mermaid', 'flowchart', 'diagram', '순서도', '다이어그램', '흐름도', '구조도'],
  },
  {
    type: 'simulation',
    label: '인터랙티브 시뮬레이션 (HTML/JS 실험실)',
    desc: '물리 운동·수학 그래프 등 HTML/JS 시뮬레이션 코드를 교안 사이에 실행합니다',
    badge: '🧪',
    keywords: [
      'simulation',
      'sim',
      'html',
      'js',
      'javascript',
      'physics',
      '시뮬레이션',
      '실험',
      '물리',
      '운동',
      '자바스크립트',
      '인터랙티브',
    ],
  },
  {
    type: 'quiz',
    label: '체크포인트 퀴즈 (형성평가)',
    desc: '교안 중간에 객관식·OX·단답형 확인 문제를 넣고 위 내용 기반으로 AI 자동 출제합니다',
    badge: '🎯',
    keywords: [
      'quiz',
      'ox',
      'question',
      'test',
      '퀴즈',
      '형성평가',
      '문제',
      '체크포인트',
      '객관식',
      '단답형',
    ],
  },
  {
    type: 'image',
    label: '사진 / 이미지 블록 (가로 다중 배치 지원)',
    desc: '드래그 앤 드롭이나 파일 선택으로 사진을 1장 또는 가로로 여러 장 넣습니다',
    badge: '🖼️',
    keywords: ['image', 'photo', 'pic', '사진', '이미지', '그림', '가로'],
  },
  {
    type: 'youtube',
    label: '유튜브 영상 (바로 재생)',
    desc: '유튜브 URL을 입력하여 교안 안에서 바로 영상을 재생합니다',
    badge: '▶️',
    keywords: [
      'youtube',
      'video',
      'yt',
      '유튜브',
      '영상',
      '동영상',
      '비디오',
    ],
  },
  {
    type: 'link',
    label: '링크 / 북마크 카드',
    desc: '참고 웹사이트나 외부 자료 링크를 카드 형태로 삽입합니다',
    badge: '🔗',
    keywords: [
      'link',
      'url',
      'bookmark',
      '링크',
      '주소',
      '북마크',
      '사이트',
      '하이퍼링크',
    ],
  },
  {
    type: 'divider',
    label: '구분선',
    desc: '단락 사이를 시각적으로 나눕니다',
    badge: '―',
    keywords: ['divider', 'hr', 'line', '구분선', '선'],
  },
];

/**
 * 텍스트 내에 인라인 서식(**진하게**, ==형광펜==, ++밑줄++, *기울임*, `코드`, [링크](URL), 순수 URL)이 포함되어 있는지 확인합니다.
 */
function hasInlineFormatting(text: string): boolean {
  if (!text) return false;
  return /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|==[^=]+==|\+\+[^+]+\+\+|`[^`]+`|\*[^*\s][^*]*\*|https?:\/\/[^\s<]+)/.test(
    text
  );
}

/**
 * 선택된 텍스트 영역(또는 커서 위치)에 마크다운 래퍼(** / == / ++ / * / `)를 토글합니다.
 */
function toggleInlineFormatSelection(
  val: string,
  selectionStart: number,
  selectionEnd: number,
  marker: string
): { newValue: string; newStart: number; newEnd: number } {
  const mLen = marker.length;
  const before = val.slice(0, selectionStart);
  const selected = val.slice(selectionStart, selectionEnd);
  const after = val.slice(selectionEnd);

  // 1) 이미 선택 영역 바깥에 marker가 감싸져 있는 경우 -> 해제
  if (before.endsWith(marker) && after.startsWith(marker)) {
    const newValue =
      before.slice(0, before.length - mLen) + selected + after.slice(mLen);
    return {
      newValue,
      newStart: selectionStart - mLen,
      newEnd: selectionEnd - mLen,
    };
  }

  // 2) 선택된 텍스트 자체가 marker로 시작하고 끝나는 경우 -> 해제
  if (
    selected.length >= mLen * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const unwrapped = selected.slice(mLen, selected.length - mLen);
    const newValue = before + unwrapped + after;
    return {
      newValue,
      newStart: selectionStart,
      newEnd: selectionStart + unwrapped.length,
    };
  }

  // 3) 선택 영역이 없을 때(커서만 있을 때): marker + marker를 넣고 커서를 가운데로 이동
  if (selectionStart === selectionEnd) {
    const placeholder =
      marker === '**'
        ? '진하게'
        : marker === '=='
        ? '형광펜 강조'
        : marker === '++'
        ? '밑줄'
        : '강조';
    const wrapped = `${marker}${placeholder}${marker}`;
    const newValue = before + wrapped + after;
    return {
      newValue,
      newStart: selectionStart + mLen,
      newEnd: selectionStart + mLen + placeholder.length,
    };
  }

  // 4) 일반 선택 영역 감싸기
  const newValue = `${before}${marker}${selected}${marker}${after}`;
  return {
    newValue,
    newStart: selectionStart + mLen,
    newEnd: selectionEnd + mLen,
  };
}

/**
 * 이미지 파일을 클라이언트 Canvas에서 적절한 해상도(최대 가로 1000px)로 리사이즈 및 압축하여 Data URL로 변환합니다.
 */
export async function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('이미지 읽기 실패'));
        return;
      }

      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxWidth = 1000;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressed);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('파일 리더 오류'));
    reader.readAsDataURL(file);
  });
}

function AutoResizeTextarea({
  value,
  onChange,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  placeholder,
  className,
  inputRef,
  spellCheck = true,
}: {
  value: string;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder: string;
  className: string;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
  spellCheck?: boolean;
}) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = internalRef.current;
    if (!el) return;
    const syncHeight = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };
    syncHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => syncHeight());
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        internalRef.current = el;
        if (inputRef) inputRef(el);
      }}
      rows={1}
      spellCheck={spellCheck}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`w-full resize-none overflow-hidden bg-transparent focus:outline-none ${className}`}
    />
  );
}

export default function NotionBlockEditor({
  blocks,
  onChange: onChangeProp,
}: NotionBlockEditorProps) {
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null);
  const [slashFilterQuery, setSlashFilterQuery] = useState('');
  const [slashSelectedIdx, setSlashSelectedIdx] = useState(0);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [toolbarMode, setToolbarMode] = useState<
    'compact' | 'expanded' | 'minimized'
  >('compact');

  const [isDraggingFileOverPage, setIsDraggingFileOverPage] = useState(false);
  const [draggedBlockIdx, setDraggedBlockIdx] = useState<number | null>(null);
  const [dragOverBlockIdx, setDragOverBlockIdx] = useState<number | null>(null);
  const [dragOverSide, setDragOverSide] = useState<
    'left' | 'right' | 'stack-top' | 'stack-bottom' | 'vertical' | null
  >(null);
  const [dragHandleHoveredBlockId, setDragHandleHoveredBlockId] = useState<
    string | null
  >(null);
  const [resizingInfo, setResizingInfo] = useState<{
    mode:
      | 'column-split'
      | 'stack-split'
      | 'block-width'
      | 'table-col'
      | 'table-row';
    label: string;
    activeId?: string;
  } | null>(null);
  const [uploadingImageBlockId, setUploadingImageBlockId] = useState<string | null>(
    null
  );
  const [hiddenSimCodeBlockIds, setHiddenSimCodeBlockIds] = useState<
    Record<string, boolean>
  >({});
  const [generatingQuizBlockId, setGeneratingQuizBlockId] = useState<
    string | null
  >(null);
  const [quizAiNoticeByBlockId, setQuizAiNoticeByBlockId] = useState<
    Record<string, string>
  >({});

  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const rowContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const colContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const blocksRef = useRef<NotionBlock[]>(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Undo / Redo 히스토리 스택 (Ctrl+Z 되돌리기 & Ctrl+Y / Ctrl+Shift+Z 다시 실행)
  const undoStackRef = useRef<NotionBlock[][]>([]);
  const redoStackRef = useRef<NotionBlock[][]>([]);
  const lastCoalesceRef = useRef<{ key: string; timestamp: number } | null>(
    null
  );
  const [historyCounts, setHistoryCounts] = useState<{
    undo: number;
    redo: number;
  }>({ undo: 0, redo: 0 });

  function syncHistoryCounts() {
    setHistoryCounts({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  }

  function recordUndoSnapshot(snapshot?: NotionBlock[]) {
    const snap = snapshot ?? blocksRef.current;
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > 100) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    lastCoalesceRef.current = null;
    syncHistoryCounts();
  }

  function onChange(nextBlocks: NotionBlock[], coalesceKey?: string) {
    const prevBlocks = blocksRef.current;
    if (prevBlocks === nextBlocks) return;

    if (coalesceKey === 'skip-history') {
      blocksRef.current = nextBlocks;
      onChangeProp(nextBlocks);
      return;
    }

    let effectiveKey = coalesceKey;
    if (!effectiveKey && prevBlocks.length === nextBlocks.length) {
      let diffIdx = -1;
      let diffCount = 0;
      for (let i = 0; i < prevBlocks.length; i++) {
        if (prevBlocks[i] !== nextBlocks[i]) {
          diffIdx = i;
          diffCount++;
          if (diffCount > 1) break;
        }
      }
      if (diffCount === 1 && diffIdx >= 0) {
        const p = prevBlocks[diffIdx];
        const n = nextBlocks[diffIdx];
        if (
          p.id === n.id &&
          p.type === n.type &&
          p.rowId === n.rowId &&
          p.colId === n.colId &&
          p.widthPercent === n.widthPercent &&
          p.stackHeightPercent === n.stackHeightPercent
        ) {
          effectiveKey = `edit-${p.id}`;
        }
      }
    }

    const now = Date.now();
    const shouldCoalesce =
      Boolean(effectiveKey) &&
      lastCoalesceRef.current !== null &&
      lastCoalesceRef.current.key === effectiveKey &&
      now - lastCoalesceRef.current.timestamp < 800;

    if (!shouldCoalesce) {
      undoStackRef.current.push(prevBlocks);
      if (undoStackRef.current.length > 100) {
        undoStackRef.current.shift();
      }
    }
    redoStackRef.current = [];
    lastCoalesceRef.current = effectiveKey
      ? { key: effectiveKey, timestamp: now }
      : null;

    blocksRef.current = nextBlocks;
    syncHistoryCounts();
    onChangeProp(nextBlocks);
  }

  function performUndo() {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push(blocksRef.current);
    lastCoalesceRef.current = null;
    blocksRef.current = prev;
    syncHistoryCounts();
    onChangeProp(prev);
  }

  function performRedo() {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(blocksRef.current);
    lastCoalesceRef.current = null;
    blocksRef.current = next;
    syncHistoryCounts();
    onChangeProp(next);
  }

  useEffect(() => {
    function handleGlobalUndoRedo(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;

      const container = editorContainerRef.current;
      const activeEl = document.activeElement;
      const isInsideEditor =
        container &&
        activeEl &&
        (container.contains(activeEl) ||
          activeEl === document.body ||
          activeEl === document.documentElement);
      if (!isInsideEditor) return;

      if (key === 'z' && !e.shiftKey) {
        if (undoStackRef.current.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          performUndo();
        }
      } else if ((key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey)) {
        if (redoStackRef.current.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          performRedo();
        }
      }
    }

    window.addEventListener('keydown', handleGlobalUndoRedo, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalUndoRedo, true);
    };
  });

  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const tableCellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const targetImageBlockIdRef = useRef<string | null>(null);
  const imageUploadModeRef = useRef<'replace' | 'append'>('replace');
  const sideImageInsertRef = useRef<{
    targetIdx: number;
    side: 'left' | 'right';
  } | null>(null);
  const stackImageInsertRef = useRef<{
    targetIdx: number;
    position: 'top' | 'bottom';
  } | null>(null);

  function focusBlock(id: string, cursorPos?: number) {
    setFocusedBlockId(id);
    setTimeout(() => {
      const el = blockRefs.current[id];
      if (el) {
        el.focus();
        const pos = cursorPos !== undefined ? cursorPos : el.value.length;
        el.setSelectionRange(pos, pos);
      }
    }, 20);
  }

  function focusTableCell(blockId: string, rIdx: number, cIdx: number) {
    setTimeout(() => {
      const el = tableCellRefs.current[`${blockId}_${rIdx}_${cIdx}`];
      if (el) {
        el.focus();
        el.select();
      }
    }, 20);
  }

  function updateBlock(id: string, patch: Partial<NotionBlock>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function createNewBlockByType(targetType: NotionBlockType): NotionBlock {
    if (targetType === 'image') {
      return {
        id: createBlockId(),
        type: 'image',
        content: '',
        imageUrl: '',
        caption: '',
        images: [],
        imageSize: 'full',
      };
    }
    if (targetType === 'table') {
      return {
        id: createBlockId(),
        type: 'table',
        content: '',
        tableRows: createDefaultTableRows(3, 3),
        hasTableHeader: true,
      };
    }
    if (targetType === 'quiz') {
      return {
        id: createBlockId(),
        type: 'quiz',
        content: '',
        quizData: createDefaultQuizData('multiple_choice'),
      };
    }
    return {
      id: createBlockId(),
      type: targetType,
      content:
        targetType === 'mermaid'
          ? MERMAID_TEMPLATES[0].code
          : targetType === 'simulation'
          ? SIMULATION_TEMPLATES[0].code
          : targetType === 'colab'
          ? COLAB_TEMPLATES[0].code
          : targetType === 'physical'
          ? serializePhysicalBlockContent(
              PHYSICAL_COMPUTING_TEMPLATES[0].config,
              PHYSICAL_COMPUTING_TEMPLATES[0].code
            )
          : '',
      caption:
        targetType === 'simulation'
          ? SIMULATION_TEMPLATES[0].caption
          : targetType === 'colab'
          ? COLAB_TEMPLATES[0].caption
          : targetType === 'physical'
          ? PHYSICAL_COMPUTING_TEMPLATES[0].caption
          : undefined,
      icon: targetType === 'callout' ? '💡' : undefined,
      language: targetType === 'code' ? 'python' : undefined,
    };
  }

  /**
   * 특정 블록(targetIdx)의 왼쪽 또는 오른쪽 열에 다른 블록(사진, 글, 코드블록 등 모든 블록)을 나란히 조립합니다.
   */
  function assembleBlockSideBySide(
    sourceBlocks: NotionBlock[],
    targetIdx: number,
    blockToPlace: NotionBlock,
    side: 'left' | 'right'
  ): NotionBlock[] {
    if (targetIdx < 0 || targetIdx >= sourceBlocks.length) {
      return [...sourceBlocks, blockToPlace];
    }
    const next = [...sourceBlocks];
    const targetBlock = next[targetIdx];
    const rowId = targetBlock.rowId || createRowId();
    const targetColId = targetBlock.colId || createColId();
    const newColId = createColId();

    next[targetIdx] = {
      ...targetBlock,
      rowId,
      colId: targetColId,
      imageSize:
        targetBlock.type === 'image' ? 'full' : targetBlock.imageSize,
    };

    const placedBlock: NotionBlock = {
      ...blockToPlace,
      rowId,
      colId: newColId,
      stackHeightPercent: undefined,
      imageSize:
        blockToPlace.type === 'image' ? 'full' : blockToPlace.imageSize,
    };

    // targetColId와 같은 열에 속한 블록들의 시작/끝 인덱스를 찾아 열 단위로 왼쪽/오른쪽에 삽입
    let firstInCol = targetIdx;
    let lastInCol = targetIdx;
    for (let i = 0; i < next.length; i++) {
      if (
        next[i].rowId === rowId &&
        (next[i].colId || next[i].id) === targetColId
      ) {
        firstInCol = Math.min(firstInCol, i);
        lastInCol = Math.max(lastInCol, i);
      }
    }

    const insertPos = side === 'left' ? firstInCol : lastInCol + 1;
    next.splice(insertPos, 0, placedBlock);

    // 같은 rowId에 속한 열(distinct colId)들의 가로 폭을 균등 분배 (100% 기준)
    const distinctCols = new Set(
      next
        .filter((b) => b.rowId === rowId)
        .map((b) => b.colId?.trim() || b.id)
    );
    const colCount = distinctCols.size;
    const equalW = Number((100 / Math.max(1, colCount)).toFixed(1));
    const balanced = next.map((b) =>
      b.rowId === rowId ? { ...b, widthPercent: equalW } : b
    );
    return cleanupOrphanRowIds(balanced);
  }

  /**
   * 특정 블록(targetIdx)이 속한 세로 열(Column Stack)의 위 또는 아래에 블록을 상하 분할로 쌓아 배치합니다.
   * (예: 왼쪽에 세로로 긴 블록 1개가 있고, 오른쪽 열 안에 2개의 블록이 위·아래로 나뉘어 들어가는 3분할 직사각형 구조)
   */
  function assembleBlockInColumnStack(
    sourceBlocks: NotionBlock[],
    targetIdx: number,
    blockToPlace: NotionBlock,
    position: 'top' | 'bottom'
  ): NotionBlock[] {
    if (targetIdx < 0 || targetIdx >= sourceBlocks.length) {
      return [...sourceBlocks, blockToPlace];
    }
    const next = [...sourceBlocks];
    const targetBlock = next[targetIdx];

    // 만약 아직 다단 행(rowId)에 속해 있지 않은 단독 블록이라면, 오른쪽 옆에 상하 2칸 구조로 만들 수 있도록 인접 블록 확인
    if (!targetBlock.rowId) {
      return assembleBlockSideBySide(
        sourceBlocks,
        targetIdx,
        blockToPlace,
        'right'
      );
    }

    const rowId = targetBlock.rowId;
    const colId = targetBlock.colId || createColId();
    const colWidth = targetBlock.widthPercent;

    next[targetIdx] = {
      ...targetBlock,
      rowId,
      colId,
      imageSize:
        targetBlock.type === 'image' ? 'full' : targetBlock.imageSize,
    };

    const placedBlock: NotionBlock = {
      ...blockToPlace,
      rowId,
      colId,
      widthPercent: colWidth,
      imageSize:
        blockToPlace.type === 'image' ? 'full' : blockToPlace.imageSize,
    };

    const insertPos = position === 'top' ? targetIdx : targetIdx + 1;
    next.splice(insertPos, 0, placedBlock);

    // 같은 rowId + colId에 속한 블록들의 세로 높이 비율(stackHeightPercent)을 균등 분배
    const stackCount = next.filter(
      (b) => b.rowId === rowId && (b.colId || b.id) === colId
    ).length;
    const equalH = Number((100 / Math.max(1, stackCount)).toFixed(1));
    const balanced = next.map((b) =>
      b.rowId === rowId && (b.colId || b.id) === colId
        ? { ...b, colId, stackHeightPercent: equalH }
        : b
    );
    return cleanupOrphanRowIds(balanced);
  }

  function addSideBySideBlock(
    targetIdx: number,
    blockType: NotionBlockType = 'p',
    side: 'left' | 'right' = 'right'
  ) {
    const newBlock = createNewBlockByType(blockType);
    const next = assembleBlockSideBySide(blocks, targetIdx, newBlock, side);
    onChange(next);
    if (
      newBlock.type !== 'image' &&
      newBlock.type !== 'divider' &&
      newBlock.type !== 'table' &&
      newBlock.type !== 'quiz'
    ) {
      focusBlock(newBlock.id);
    } else if (newBlock.type === 'table') {
      focusTableCell(newBlock.id, 0, 0);
    }
  }

  /**
   * 현재 열(Column) 내부에서 해당 블록 바로 아래(또는 위)에 상하 분할 블록을 추가합니다.
   */
  function addStackedBlockInColumn(
    targetIdx: number,
    blockType: NotionBlockType = 'p',
    position: 'top' | 'bottom' = 'bottom'
  ) {
    const newBlock = createNewBlockByType(blockType);
    const next = assembleBlockInColumnStack(
      blocks,
      targetIdx,
      newBlock,
      position
    );
    onChange(next);
    if (
      newBlock.type !== 'image' &&
      newBlock.type !== 'divider' &&
      newBlock.type !== 'table' &&
      newBlock.type !== 'quiz'
    ) {
      focusBlock(newBlock.id);
    } else if (newBlock.type === 'table') {
      focusTableCell(newBlock.id, 0, 0);
    }
  }

  /**
   * 1클릭 3분할 직사각형 레이아웃 생성:
   * 현재 블록(세로로 긴 블록)의 오른쪽(또는 왼쪽)에 위·아래 2개로 나뉜 블록 열을 한 번에 조립합니다.
   */
  function addSideBySideStackedBlocks(
    targetIdx: number,
    side: 'left' | 'right' = 'right'
  ) {
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const topBlock = createNewBlockByType('p');
    const bottomBlock = createNewBlockByType('p');

    const step1 = assembleBlockSideBySide(blocks, targetIdx, topBlock, side);
    const topIdx = step1.findIndex((b) => b.id === topBlock.id);
    if (topIdx === -1) {
      onChange(step1);
      return;
    }
    const step2 = assembleBlockInColumnStack(
      step1,
      topIdx,
      bottomBlock,
      'bottom'
    );
    onChange(step2);
    focusBlock(topBlock.id);
  }

  function triggerSideBySideImageUpload(
    targetIdx: number,
    side: 'left' | 'right' = 'right'
  ) {
    sideImageInsertRef.current = { targetIdx, side };
    stackImageInsertRef.current = null;
    targetImageBlockIdRef.current = null;
    imageUploadModeRef.current = 'replace';
    imageInputRef.current?.click();
  }

  function triggerStackedImageUpload(
    targetIdx: number,
    position: 'top' | 'bottom' = 'bottom'
  ) {
    stackImageInsertRef.current = { targetIdx, position };
    sideImageInsertRef.current = null;
    targetImageBlockIdRef.current = null;
    imageUploadModeRef.current = 'replace';
    imageInputRef.current?.click();
  }

  function joinBlockWithPrevRow(index: number) {
    if (index <= 0 || index >= blocks.length) return;
    const next = [...blocks];
    const [moving] = next.splice(index, 1);
    const assembled = assembleBlockSideBySide(
      next,
      index - 1,
      moving,
      'right'
    );
    onChange(assembled);
  }

  function detachBlockFromRow(index: number) {
    const target = blocks[index];
    if (!target || !target.rowId) return;
    const currentRowId = target.rowId;
    const currentColId = target.colId;
    const next = [...blocks];
    const [detached] = next.splice(index, 1);
    const cleanDetached: NotionBlock = {
      ...detached,
      rowId: undefined,
      colId: undefined,
      widthPercent: undefined,
      stackHeightPercent: undefined,
    };

    // 기존 행의 마지막 블록 바로 뒤에 독립된 전체 폭 블록으로 배치
    let lastRowIdx = -1;
    for (let i = 0; i < next.length; i++) {
      if (next[i].rowId === currentRowId) lastRowIdx = i;
    }
    const insertPos = lastRowIdx >= 0 ? lastRowIdx + 1 : index;
    next.splice(insertPos, 0, cleanDetached);

    // 같은 열에 남아 있는 블록들의 세로 높이 비율 재정규화
    if (currentColId) {
      const remainingInCol = next.filter(
        (b) => b.rowId === currentRowId && b.colId === currentColId
      ).length;
      const equalH =
        remainingInCol > 1
          ? Number((100 / remainingInCol).toFixed(1))
          : undefined;
      for (let i = 0; i < next.length; i++) {
        if (next[i].rowId === currentRowId && next[i].colId === currentColId) {
          next[i] = { ...next[i], stackHeightPercent: equalH };
        }
      }
    }

    // 남은 행 열들의 가로 폭 재정규화
    const remainingCols = new Set(
      next
        .filter((b) => b.rowId === currentRowId)
        .map((b) => b.colId?.trim() || b.id)
    );
    const remainingColCount = remainingCols.size;
    const equalW =
      remainingColCount > 1
        ? Number((100 / remainingColCount).toFixed(1))
        : undefined;
    const normalized = next.map((b) =>
      b.rowId === currentRowId ? { ...b, widthPercent: equalW } : b
    );
    onChange(cleanupOrphanRowIds(normalized));
  }

  function moveColumnWithinRow(index: number, direction: -1 | 1) {
    const block = blocks[index];
    if (!block?.rowId) return;
    const rowId = block.rowId;
    const groups = groupBlocksIntoRows(blocks);
    const rowGroup = groups.find(
      (g) => g.rowId === rowId && g.items.some((it) => it.index === index)
    );
    if (!rowGroup || rowGroup.columns.length <= 1) return;

    const colIdx = rowGroup.columns.findIndex((c) =>
      c.items.some((it) => it.index === index)
    );
    const targetColIdx = colIdx + direction;
    if (
      colIdx === -1 ||
      targetColIdx < 0 ||
      targetColIdx >= rowGroup.columns.length
    ) {
      return;
    }

    const newColumns = [...rowGroup.columns];
    const [movedCol] = newColumns.splice(colIdx, 1);
    newColumns.splice(targetColIdx, 0, movedCol);

    const firstIdxInRow = rowGroup.items[0].index;
    const lastIdxInRow = rowGroup.items[rowGroup.items.length - 1].index;
    const reorderedRowBlocks = newColumns.flatMap((c) =>
      c.items.map((it) => it.block)
    );

    const next = [
      ...blocks.slice(0, firstIdxInRow),
      ...reorderedRowBlocks,
      ...blocks.slice(lastIdxInRow + 1),
    ];
    onChange(cleanupOrphanRowIds(next));
  }

  function moveBlockWithinColumnStack(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const cur = blocks[index];
    const target = blocks[targetIdx];
    if (
      !cur?.rowId ||
      cur.rowId !== target?.rowId ||
      (cur.colId || cur.id) !== (target.colId || target.id)
    ) {
      return;
    }
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    onChange(cleanupOrphanRowIds(next));
  }

  function applyRowWidthPreset(rowId: string, ratios: number[]) {
    const colOrder: string[] = [];
    for (const b of blocks) {
      if (b.rowId === rowId) {
        const cId = b.colId?.trim() || b.id;
        if (!colOrder.includes(cId)) colOrder.push(cId);
      }
    }
    const next = blocks.map((b) => {
      if (b.rowId !== rowId) return b;
      const cId = b.colId?.trim() || b.id;
      const cIdx = Math.max(0, colOrder.indexOf(cId));
      const w = ratios[cIdx] ?? Math.round(100 / Math.max(1, ratios.length));
      return { ...b, widthPercent: w };
    });
    onChange(next);
  }

  /**
   * 다단(가로 배치) 행에서 두 열 사이의 구분선을 마우스로 좌우 드래그하여 비율을 조절합니다.
   */
  function startColumnSplitResize(
    e: React.MouseEvent,
    rowId: string,
    leftColId: string,
    rightColId: string
  ) {
    e.preventDefault();
    e.stopPropagation();

    const rowEl = rowContainerRefs.current[rowId];
    const rowWidthPx = rowEl?.getBoundingClientRect().width || 800;
    const startX = e.clientX;

    const currentBlocks = blocksRef.current;
    const rowGroups = groupBlocksIntoRows(currentBlocks);
    const targetRow = rowGroups.find((g) => g.rowId === rowId);
    if (!targetRow) return;

    const normWidths = getNormalizedColumnWidths(targetRow.columns);
    const leftColIdx = targetRow.columns.findIndex(
      (c) => c.colId === leftColId
    );
    const rightColIdx = targetRow.columns.findIndex(
      (c) => c.colId === rightColId
    );
    if (leftColIdx === -1 || rightColIdx === -1) return;

    const startLeftW = normWidths[leftColIdx];
    const startRightW = normWidths[rightColIdx];
    const pairTotalW = startLeftW + startRightW;

    recordUndoSnapshot(currentBlocks);

    setResizingInfo({
      mode: 'column-split',
      label: `${Math.round(startLeftW)}% : ${Math.round(startRightW)}%`,
      activeId: `${leftColId}_${rightColId}`,
    });

    function handleMouseMove(moveEvent: MouseEvent) {
      const deltaX = moveEvent.clientX - startX;
      const deltaPct = (deltaX / Math.max(240, rowWidthPx)) * 100;
      const minColW = 18;
      const nextLeftW = Math.min(
        pairTotalW - minColW,
        Math.max(minColW, Number((startLeftW + deltaPct).toFixed(1)))
      );
      const nextRightW = Number((pairTotalW - nextLeftW).toFixed(1));

      setResizingInfo({
        mode: 'column-split',
        label: `${Math.round(nextLeftW)}% : ${Math.round(nextRightW)}%`,
        activeId: `${leftColId}_${rightColId}`,
      });

      const updated = blocksRef.current.map((b) => {
        if (b.rowId !== rowId) return b;
        const cId = b.colId?.trim() || b.id;
        if (cId === leftColId) return { ...b, widthPercent: nextLeftW };
        if (cId === rightColId) return { ...b, widthPercent: nextRightW };
        const cIdx = targetRow!.columns.findIndex((c) => c.colId === cId);
        return {
          ...b,
          widthPercent: cIdx >= 0 ? normWidths[cIdx] : b.widthPercent,
        };
      });
      onChange(updated, 'skip-history');
    }

    function handleMouseUp() {
      setResizingInfo(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * 한 열(Column Stack) 안에 상하로 쌓인 두 블록 사이의 가로 경계선(↕)을 위아래로 드래그하여
   * 세로가 긴 옆 블록의 높이 안에서 두 블록의 상하 높이 비율을 자유롭게 조절합니다.
   */
  function startStackSplitResize(
    e: React.MouseEvent,
    rowId: string,
    colId: string,
    topBlockId: string,
    bottomBlockId: string
  ) {
    e.preventDefault();
    e.stopPropagation();

    const colEl = colContainerRefs.current[`${rowId}_${colId}`];
    const rowEl = rowContainerRefs.current[rowId];
    const colHeightPx = Math.max(
      180,
      colEl?.getBoundingClientRect().height ||
        rowEl?.getBoundingClientRect().height ||
        320
    );
    const startY = e.clientY;

    const currentBlocks = blocksRef.current;
    const colItems = currentBlocks
      .map((block, index) => ({ block, index }))
      .filter(
        (it) =>
          it.block.rowId === rowId &&
          (it.block.colId?.trim() || it.block.id) === colId
      );
    const normHeights = getNormalizedStackHeights(colItems);

    const topIdxInCol = colItems.findIndex((it) => it.block.id === topBlockId);
    const bottomIdxInCol = colItems.findIndex(
      (it) => it.block.id === bottomBlockId
    );
    if (topIdxInCol === -1 || bottomIdxInCol === -1) return;

    const startTopH = normHeights[topIdxInCol];
    const startBottomH = normHeights[bottomIdxInCol];
    const pairTotalH = startTopH + startBottomH;

    recordUndoSnapshot(currentBlocks);

    setResizingInfo({
      mode: 'stack-split',
      label: `상하 높이 ${Math.round(startTopH)}% : ${Math.round(startBottomH)}%`,
      activeId: `${topBlockId}_${bottomBlockId}`,
    });

    function handleMouseMove(moveEvent: MouseEvent) {
      const deltaY = moveEvent.clientY - startY;
      const deltaPct = (deltaY / Math.max(160, colHeightPx)) * 100;
      const minStackH = 18;
      const nextTopH = Math.min(
        pairTotalH - minStackH,
        Math.max(minStackH, Number((startTopH + deltaPct).toFixed(1)))
      );
      const nextBottomH = Number((pairTotalH - nextTopH).toFixed(1));

      setResizingInfo({
        mode: 'stack-split',
        label: `상하 높이 ${Math.round(nextTopH)}% : ${Math.round(nextBottomH)}%`,
        activeId: `${topBlockId}_${bottomBlockId}`,
      });

      const updated = blocksRef.current.map((b) => {
        if (
          b.rowId !== rowId ||
          (b.colId?.trim() || b.id) !== colId
        ) {
          return b;
        }
        if (b.id === topBlockId) {
          return { ...b, stackHeightPercent: nextTopH };
        }
        if (b.id === bottomBlockId) {
          return { ...b, stackHeightPercent: nextBottomH };
        }
        const idxInCol = colItems.findIndex((it) => it.block.id === b.id);
        return {
          ...b,
          stackHeightPercent:
            idxInCol >= 0 ? normHeights[idxInCol] : b.stackHeightPercent,
        };
      });
      onChange(updated, 'skip-history');
    }

    function handleMouseUp() {
      setResizingInfo(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * 개별 블록의 오른쪽 가장자리 핸들을 좌우로 드래그하여 가로 폭(25%~100%)을 자유롭게 늘리거나 줄입니다.
   */
  function startSingleBlockWidthResize(
    e: React.MouseEvent,
    blockId: string,
    initialWidthPercent?: number
  ) {
    e.preventDefault();
    e.stopPropagation();

    const containerWidthPx =
      editorContainerRef.current?.getBoundingClientRect().width || 800;
    const startX = e.clientX;
    const startW = initialWidthPercent ?? 100;

    recordUndoSnapshot(blocksRef.current);

    setResizingInfo({
      mode: 'block-width',
      label: `가로 폭 ${Math.round(startW)}%`,
      activeId: blockId,
    });

    function handleMouseMove(moveEvent: MouseEvent) {
      const deltaX = moveEvent.clientX - startX;
      const deltaPct = (deltaX / Math.max(240, containerWidthPx)) * 100;
      const clampedW = Math.min(
        100,
        Math.max(25, Math.round(startW + deltaPct))
      );
      const finalW = clampedW >= 98 ? 100 : clampedW;

      setResizingInfo({
        mode: 'block-width',
        label: `가로 폭 ${finalW}%`,
        activeId: blockId,
      });

      const updated = blocksRef.current.map((b) =>
        b.id === blockId
          ? {
              ...b,
              widthPercent: finalW >= 100 ? undefined : finalW,
              imageSize: b.type === 'image' ? 'full' : b.imageSize,
            }
          : b
      );
      onChange(updated, 'skip-history');
    }

    function handleMouseUp() {
      setResizingInfo(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * 표(Table) 열의 우측 구분선을 좌우로 드래그하여 해당 열의 너비(px)를 조절합니다.
   */
  function startTableColResize(
    e: React.MouseEvent,
    blockId: string,
    colIdx: number,
    colCount: number
  ) {
    e.preventDefault();
    e.stopPropagation();

    const cellEl = e.currentTarget.parentElement;
    const measuredW = cellEl?.getBoundingClientRect().width || 160;
    const startX = e.clientX;

    const currentBlock = blocksRef.current.find((b) => b.id === blockId);
    const existingWidths = Array.from(
      { length: colCount },
      (_, ci) => currentBlock?.tableColWidths?.[ci] || 0
    );
    const startW =
      existingWidths[colIdx] > 0
        ? existingWidths[colIdx]
        : Math.max(80, Math.round(measuredW));

    recordUndoSnapshot(blocksRef.current);

    setResizingInfo({
      mode: 'table-col',
      label: `${colIdx + 1}열 너비 ${startW}px`,
      activeId: `${blockId}_col_${colIdx}`,
    });

    function handleMouseMove(moveEvent: MouseEvent) {
      const deltaX = moveEvent.clientX - startX;
      const nextW = Math.min(900, Math.max(70, Math.round(startW + deltaX)));

      setResizingInfo({
        mode: 'table-col',
        label: `${colIdx + 1}열 너비 ${nextW}px`,
        activeId: `${blockId}_col_${colIdx}`,
      });

      const updated = blocksRef.current.map((b) => {
        if (b.id !== blockId) return b;
        const nextColWidths = Array.from(
          { length: colCount },
          (_, ci) =>
            ci === colIdx
              ? nextW
              : b.tableColWidths?.[ci] || existingWidths[ci] || 0
        );
        return {
          ...b,
          tableColWidths: nextColWidths,
        };
      });
      onChange(updated, 'skip-history');
    }

    function handleMouseUp() {
      setResizingInfo(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * 표(Table) 행의 하단 구분선을 상하로 드래그하여 해당 행의 높이(px)를 조절합니다.
   */
  function startTableRowResize(
    e: React.MouseEvent,
    blockId: string,
    rowIdx: number,
    rowCount: number
  ) {
    e.preventDefault();
    e.stopPropagation();

    const cellEl = e.currentTarget.parentElement;
    const rowEl = cellEl?.parentElement;
    const measuredH =
      rowEl?.getBoundingClientRect().height ||
      cellEl?.getBoundingClientRect().height ||
      42;
    const startY = e.clientY;

    const currentBlock = blocksRef.current.find((b) => b.id === blockId);
    const existingHeights = Array.from(
      { length: rowCount },
      (_, ri) => currentBlock?.tableRowHeights?.[ri] || 0
    );
    const startH =
      existingHeights[rowIdx] > 0
        ? existingHeights[rowIdx]
        : Math.max(34, Math.round(measuredH));

    recordUndoSnapshot(blocksRef.current);

    setResizingInfo({
      mode: 'table-row',
      label: `${rowIdx + 1}행 높이 ${startH}px`,
      activeId: `${blockId}_row_${rowIdx}`,
    });

    function handleMouseMove(moveEvent: MouseEvent) {
      const deltaY = moveEvent.clientY - startY;
      const nextH = Math.min(480, Math.max(32, Math.round(startH + deltaY)));

      setResizingInfo({
        mode: 'table-row',
        label: `${rowIdx + 1}행 높이 ${nextH}px`,
        activeId: `${blockId}_row_${rowIdx}`,
      });

      const updated = blocksRef.current.map((b) => {
        if (b.id !== blockId) return b;
        const nextRowHeights = Array.from(
          { length: rowCount },
          (_, ri) =>
            ri === rowIdx
              ? nextH
              : b.tableRowHeights?.[ri] || existingHeights[ri] || 0
        );
        return {
          ...b,
          tableRowHeights: nextRowHeights,
        };
      });
      onChange(updated, 'skip-history');
    }

    function handleMouseUp() {
      setResizingInfo(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * 현재 포커스된 텍스트 블록에 인라인 링크 `[표시 텍스트](https://)` 서식을 삽입합니다.
   */
  function insertInlineLinkToFocusedBlock() {
    const activeId = focusedBlockId || blocks[0]?.id;
    if (!activeId) return;
    const block = blocks.find((b) => b.id === activeId);
    if (
      !block ||
      block.type === 'code' ||
      block.type === 'colab' ||
      block.type === 'vpython' ||
      block.type === 'physical' ||
      block.type === 'mermaid' ||
      block.type === 'simulation' ||
      block.type === 'quiz' ||
      block.type === 'image' ||
      block.type === 'youtube' ||
      block.type === 'link' ||
      block.type === 'divider' ||
      block.type === 'table'
    ) {
      handleQuickAddBlock('link');
      return;
    }

    const el = blockRefs.current[activeId];
    const start = el ? el.selectionStart : block.content.length;
    const end = el ? el.selectionEnd : block.content.length;
    const selected = block.content.slice(start, end);
    const labelText = selected || '링크 텍스트';
    const defaultUrl = 'https://';
    const inserted = `[${labelText}](${defaultUrl})`;
    const newValue =
      block.content.slice(0, start) + inserted + block.content.slice(end);
    const urlSelectStart = start + labelText.length + 3;
    const urlSelectEnd = urlSelectStart + defaultUrl.length;

    updateBlock(activeId, { content: newValue });
    setFocusedBlockId(activeId);
    requestAnimationFrame(() => {
      const targetEl = blockRefs.current[activeId];
      if (targetEl) {
        targetEl.focus();
        targetEl.setSelectionRange(urlSelectStart, urlSelectEnd);
      }
    });
  }

  /**
   * 현재 포커스된 텍스트 블록에 인라인 서식(**진하게**, ==형광펜==, ++밑줄++, *기울임*, `코드`)을 적용합니다.
   */
  function applyFormatToFocusedBlock(marker: string) {
    const activeId = focusedBlockId || blocks[0]?.id;
    if (!activeId) return;
    const block = blocks.find((b) => b.id === activeId);
    if (
      !block ||
      block.type === 'code' ||
      block.type === 'colab' ||
      block.type === 'vpython' ||
      block.type === 'physical' ||
      block.type === 'mermaid' ||
      block.type === 'simulation' ||
      block.type === 'quiz' ||
      block.type === 'image' ||
      block.type === 'youtube' ||
      block.type === 'link' ||
      block.type === 'divider' ||
      block.type === 'table'
    ) {
      return;
    }

    const el = blockRefs.current[activeId];
    const start = el ? el.selectionStart : block.content.length;
    const end = el ? el.selectionEnd : block.content.length;

    const { newValue, newStart, newEnd } = toggleInlineFormatSelection(
      block.content,
      start,
      end,
      marker
    );

    updateBlock(activeId, { content: newValue });
    setFocusedBlockId(activeId);
    requestAnimationFrame(() => {
      const targetEl = blockRefs.current[activeId];
      if (targetEl) {
        targetEl.focus();
        targetEl.setSelectionRange(newStart, newEnd);
      }
    });
  }

  function insertBlockAfter(index: number, newBlock: NotionBlock) {
    const next = [...blocks];
    let insertIdx = index;
    // 현재 블록이 다단(가로 배치) 행 내부에 있고 새 블록이 일반 전체폭 블록이면, 행의 마지막 블록 바로 아래에 삽입
    const currentRowId = next[index]?.rowId;
    if (currentRowId && !newBlock.rowId) {
      while (
        insertIdx + 1 < next.length &&
        next[insertIdx + 1].rowId === currentRowId
      ) {
        insertIdx++;
      }
    }
    next.splice(insertIdx + 1, 0, newBlock);
    onChange(cleanupOrphanRowIds(next));
    if (
      newBlock.type !== 'image' &&
      newBlock.type !== 'divider' &&
      newBlock.type !== 'table' &&
      newBlock.type !== 'quiz'
    ) {
      focusBlock(newBlock.id);
    } else if (newBlock.type === 'table') {
      focusTableCell(newBlock.id, 0, 0);
    }
  }

  function removeBlock(index: number) {
    if (blocks.length <= 1) {
      onChange([
        {
          id: createBlockId(),
          type: 'p',
          content: '',
        },
      ]);
      return;
    }
    const removedRowId = blocks[index]?.rowId;
    const prevBlock = blocks[index - 1] || blocks[index + 1];
    let next = blocks.filter((_, i) => i !== index);
    if (removedRowId) {
      const remainingInRow = next.filter((b) => b.rowId === removedRowId).length;
      const equalW =
        remainingInRow > 1
          ? Number((100 / remainingInRow).toFixed(1))
          : undefined;
      next = next.map((b) =>
        b.rowId === removedRowId ? { ...b, widthPercent: equalW } : b
      );
    }
    onChange(cleanupOrphanRowIds(next));
    if (prevBlock) {
      focusBlock(prevBlock.id);
    }
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    onChange(cleanupOrphanRowIds(next));
  }

  function getFilteredSlashItems() {
    const q = slashFilterQuery.trim().toLowerCase();
    if (!q) return BLOCK_TYPE_META;
    return BLOCK_TYPE_META.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q))
    );
  }

  function applyBlockTypeSelection(block: NotionBlock, targetType: NotionBlockType) {
    const cleanedContent = block.content.startsWith('/') ? '' : block.content;
    const defaultMermaid = MERMAID_TEMPLATES[0].code;
    const defaultSimulation = SIMULATION_TEMPLATES[0].code;
    const defaultColab = COLAB_TEMPLATES[0].code;
    const defaultPhysical = serializePhysicalBlockContent(
      PHYSICAL_COMPUTING_TEMPLATES[0].config,
      PHYSICAL_COMPUTING_TEMPLATES[0].code
    );

    const isUrlContent = /^https?:\/\//i.test(cleanedContent.trim());

    updateBlock(block.id, {
      type: targetType,
      content:
        targetType === 'mermaid' && !cleanedContent.trim()
          ? defaultMermaid
          : targetType === 'simulation' && !cleanedContent.trim()
          ? defaultSimulation
          : targetType === 'colab' && !cleanedContent.trim()
          ? defaultColab
          : targetType === 'physical' && !cleanedContent.trim()
          ? defaultPhysical
          : targetType === 'youtube' || targetType === 'link'
          ? isUrlContent
            ? ''
            : cleanedContent
          : cleanedContent,
      externalUrl:
        targetType === 'youtube' || targetType === 'link'
          ? block.externalUrl || (isUrlContent ? cleanedContent.trim() : '')
          : block.externalUrl,
      caption:
        targetType === 'simulation'
          ? block.caption || SIMULATION_TEMPLATES[0].caption
          : targetType === 'colab'
          ? block.caption || COLAB_TEMPLATES[0].caption
          : targetType === 'physical'
          ? block.caption || PHYSICAL_COMPUTING_TEMPLATES[0].caption
          : block.caption,
      icon: targetType === 'callout' ? block.icon || '💡' : undefined,
      language: targetType === 'code' ? block.language || 'python' : undefined,
      imageSize:
        targetType === 'image'
          ? block.rowId
            ? block.imageSize || 'full'
            : block.imageSize || 'md'
          : block.imageSize,
      tableRows:
        targetType === 'table'
          ? block.tableRows && block.tableRows.length > 0
            ? block.tableRows
            : createDefaultTableRows(3, 3)
          : block.tableRows,
      hasTableHeader:
        targetType === 'table' ? block.hasTableHeader ?? true : block.hasTableHeader,
      quizData:
        targetType === 'quiz'
          ? block.quizData || createDefaultQuizData('multiple_choice')
          : block.quizData,
    });
    setSlashMenuBlockId(null);
    setSlashFilterQuery('');
    setSlashSelectedIdx(0);

    if (
      targetType !== 'image' &&
      targetType !== 'divider' &&
      targetType !== 'table' &&
      targetType !== 'quiz'
    ) {
      focusBlock(block.id);
    } else if (targetType === 'table') {
      focusTableCell(block.id, 0, 0);
    }
  }

  async function handleGenerateAiQuizForBlock(
    block: NotionBlock,
    blockIdx: number,
    overrideType?: QuizQuestionType
  ) {
    const currentQuizData =
      block.quizData || createDefaultQuizData('multiple_choice');
    const targetType = overrideType || currentQuizData.questionType;

    // 현재 퀴즈 블록 앞쪽의 교안 블록들을 마크다운 문맥으로 추출 (앞쪽 블록이 없으면 전체 교안 문맥 사용)
    const precedingBlocks = blocks
      .slice(0, blockIdx)
      .filter((b) => b.type !== 'quiz');
    const fallbackBlocks = blocks.filter(
      (b) => b.id !== block.id && b.type !== 'quiz'
    );
    const contextSource =
      precedingBlocks.length > 0 ? precedingBlocks : fallbackBlocks;
    const contextMarkdown = blocksToMarkdown(contextSource);

    setGeneratingQuizBlockId(block.id);
    setQuizAiNoticeByBlockId((prev) => ({ ...prev, [block.id]: '' }));

    try {
      const res = await generateInlineQuizDraftAction(
        contextMarkdown,
        targetType
      );
      if (res.success && res.quiz) {
        const nextQuizData: InlineQuizBlockData = {
          quizId: currentQuizData.quizId || createInlineQuizId(),
          questionType: res.quiz.questionType,
          questionText: res.quiz.questionText,
          options: res.quiz.options,
          correctOptionIndex: res.quiz.correctOptionIndex,
          answerText: res.quiz.answerText,
          explanation: res.quiz.explanation,
          targetConcept: res.quiz.targetConcept,
        };
        updateBlock(block.id, {
          content: nextQuizData.questionText,
          quizData: nextQuizData,
        });
        setQuizAiNoticeByBlockId((prev) => ({
          ...prev,
          [block.id]: res.usedAi
            ? '✨ 위 교안 문맥을 분석해 AI 문항을 자동으로 생성했습니다!'
            : '✨ 위 교안 소제목/문맥을 바탕으로 맞춤형 문항 템플릿을 채웠습니다!',
        }));
      }
    } catch {
      setQuizAiNoticeByBlockId((prev) => ({
        ...prev,
        [block.id]: '⚠️ 문항 자동 생성 중 일시적 오류가 발생했습니다.',
      }));
    } finally {
      setGeneratingQuizBlockId(null);
    }
  }

  /**
   * 텍스트 입력 시 `/` 로 시작하면 슬래시 메뉴를 열고 검색어를 업데이트합니다.
   */
  function handleTextChangeWithSlash(block: NotionBlock, val: string) {
    if (val.startsWith('/') && !val.includes('\n') && val.length <= 18) {
      setSlashMenuBlockId(block.id);
      setSlashFilterQuery(val.slice(1));
      setSlashSelectedIdx(0);
    } else if (slashMenuBlockId === block.id) {
      setSlashMenuBlockId(null);
      setSlashFilterQuery('');
    }
    updateBlock(block.id, { content: val });
  }

  /**
   * 코드 블록 & Mermaid 블록 전용 키보드 핸들러:
   * - Enter 입력 시: 이전 줄의 들여쓰기(공백)를 자동 계산하고, Python의 `:` 또는 `{`, `(` 로 끝나면 4칸 추가 들여쓰기!
   * - Tab 입력 시: 4칸 스페이스 삽입
   * - Backspace 입력 시: 커서 앞이 4칸 공백이면 한 번에 4칸 내어쓰기
   * - Shift+Enter 입력 시: 코드 블록 아래에 새 일반 문단 블록 추가
   */
  function handleCodeOrMermaidKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    block: NotionBlock,
    idx: number
  ) {
    if (e.nativeEvent.isComposing) return;

    const el = e.currentTarget;
    const val = el.value;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const indentUnit = block.type === 'mermaid' ? '    ' : '    '; // 4 spaces

    // 1. Shift + Enter -> 코드블록 바깥(아래)에 새 단락 블록 생성
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      insertBlockAfter(idx, {
        id: createBlockId(),
        type: 'p',
        content: '',
      });
      return;
    }

    // 2. 일반 Enter -> 스마트 자동 들여쓰기(Auto-indent) 줄바꿈
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const beforeCursor = val.slice(0, start);
      const afterCursor = val.slice(end);
      const currentLine = beforeCursor.split('\n').pop() || '';
      const leadingSpacesMatch = currentLine.match(/^(\s*)/);
      let indent = leadingSpacesMatch ? leadingSpacesMatch[1] : '';

      const trimmedLine = (
        block.type === 'vpython' ||
        block.type === 'colab' ||
        block.type === 'code' ||
        block.type === 'physical'
          ? currentLine.replace(/(#|\/\/).*$/, '')
          : currentLine
      ).trimEnd();
      // Python의 콜론(:), 또는 중괄호/대괄호/소괄호 열림({, [, () 혹은 Mermaid의 subgraph 끝에서 자동 추가 들여쓰기
      if (
        trimmedLine.endsWith(':') ||
        trimmedLine.endsWith('：') ||
        trimmedLine.endsWith('{') ||
        trimmedLine.endsWith('(') ||
        trimmedLine.endsWith('[') ||
        (block.type === 'mermaid' && /^subgraph\b/.test(trimmedLine.trim()))
      ) {
        indent += indentUnit;
      } else if (
        indent.length >= 4 &&
        (block.type === 'vpython' ||
          block.type === 'colab' ||
          block.type === 'code' ||
          block.type === 'physical') &&
        /^(return|break|continue|pass|raise)(\b|\s|$)/.test(trimmedLine.trim())
      ) {
        indent = indent.slice(0, -4);
      }

      const insertion = '\n' + indent;
      const newVal = beforeCursor + insertion + afterCursor;
      const newCursorPos = start + insertion.length;

      el.value = newVal;
      el.setSelectionRange(newCursorPos, newCursorPos);
      updateBlock(block.id, { content: newVal });
      requestAnimationFrame(() => {
        const targetEl = blockRefs.current[block.id];
        if (targetEl) {
          targetEl.focus();
          targetEl.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
      return;
    }

    // 3. Tab / Shift+Tab 키 -> 4칸 들여쓰기 및 내어쓰기
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const beforeCursor = val.slice(0, start);
        const lineStartIdx = beforeCursor.lastIndexOf('\n') + 1;
        const currentLine = val.slice(lineStartIdx);
        const removeMatch = currentLine.match(/^( {1,4})/);
        if (removeMatch) {
          const removeCount = removeMatch[1].length;
          const newVal =
            val.slice(0, lineStartIdx) + val.slice(lineStartIdx + removeCount);
          const newCursorPos = Math.max(lineStartIdx, start - removeCount);
          el.value = newVal;
          el.setSelectionRange(newCursorPos, newCursorPos);
          updateBlock(block.id, { content: newVal });
          requestAnimationFrame(() => {
            const targetEl = blockRefs.current[block.id];
            if (targetEl) {
              targetEl.focus();
              targetEl.setSelectionRange(newCursorPos, newCursorPos);
            }
          });
        }
        return;
      }

      const beforeCursor = val.slice(0, start);
      const afterCursor = val.slice(end);
      const newVal = beforeCursor + indentUnit + afterCursor;
      const newCursorPos = start + indentUnit.length;

      el.value = newVal;
      el.setSelectionRange(newCursorPos, newCursorPos);
      updateBlock(block.id, { content: newVal });
      requestAnimationFrame(() => {
        const targetEl = blockRefs.current[block.id];
        if (targetEl) {
          targetEl.focus();
          targetEl.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
      return;
    }

    // 4. Backspace 키 -> 빈 코드 블록이면 일반 문단으로 전환, 아니면 4칸 공백 스마트 삭제
    if (e.key === 'Backspace') {
      if (val === '') {
        e.preventDefault();
        updateBlock(block.id, { type: 'p' });
        return;
      }

      if (start === end && start >= 4) {
        const beforeCursor = val.slice(0, start);
        const currentLineBeforeCursor = beforeCursor.split('\n').pop() || '';
        // 현재 줄의 커서 앞부분이 전부 공백이고 4의 배수이면 4칸 한꺼번에 지우기
        if (
          currentLineBeforeCursor.length >= 4 &&
          /^\s+$/.test(currentLineBeforeCursor) &&
          currentLineBeforeCursor.endsWith('    ')
        ) {
          e.preventDefault();
          const newVal = val.slice(0, start - 4) + val.slice(end);
          const newPos = start - 4;
          el.value = newVal;
          el.setSelectionRange(newPos, newPos);
          updateBlock(block.id, { content: newVal });
          requestAnimationFrame(() => {
            const targetEl = blockRefs.current[block.id];
            if (targetEl) {
              targetEl.focus();
              targetEl.setSelectionRange(newPos, newPos);
            }
          });
        }
      }
    }
  }

  /**
   * 이미지 파일들을 업로드하거나 드롭했을 때 처리:
   * - 여러 장을 동시에 선택/드롭하면 하나의 이미지 블록 안에 가로(Horizontal Row)로 나란히 배치합니다.
   * - 기존 이미지 블록에서 '+ 옆에 사진 가로로 추가'(mode === 'append')를 누른 경우 기존 이미지 옆에 추가합니다.
   */
  async function handleImageFilesDrop(
    files: FileList | File[],
    insertAtIdx?: number,
    targetBlockId?: string,
    mode: 'replace' | 'append' = 'replace',
    sideAssemble?: { targetIdx: number; side: 'left' | 'right' },
    stackAssemble?: { targetIdx: number; position: 'top' | 'bottom' }
  ) {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (imageFiles.length === 0) return;

    const uploadedItems: NotionImageItem[] = [];
    for (const file of imageFiles) {
      const dataUrl = await compressImageFileToDataUrl(file);
      const defaultCaption = file.name.replace(/\.[^.]+$/, '');
      uploadedItems.push({
        url: dataUrl,
        caption: defaultCaption,
      });
    }

    if (targetBlockId && uploadedItems.length > 0) {
      const updated = blocks.map((b) => {
        if (b.id !== targetBlockId) return b;
        const existingImages = getBlockImages(b);
        const nextImages =
          mode === 'append' && existingImages.length > 0
            ? [...existingImages, ...uploadedItems]
            : uploadedItems;
        const first = nextImages[0];
        return {
          ...b,
          type: 'image' as NotionBlockType,
          imageUrl: first.url,
          caption: first.caption || b.caption || '',
          images: nextImages,
          imageSize: b.rowId ? b.imageSize || 'full' : b.imageSize || 'md',
        };
      });
      onChange(updated);
      return;
    }

    const first = uploadedItems[0];
    const newImageBlock: NotionBlock = {
      id: createBlockId(),
      type: 'image',
      content: '',
      imageUrl: first.url,
      caption: first.caption || '',
      images: uploadedItems,
      imageSize: sideAssemble || stackAssemble ? 'full' : 'md',
    };

    if (stackAssemble) {
      const next = assembleBlockInColumnStack(
        blocks,
        stackAssemble.targetIdx,
        newImageBlock,
        stackAssemble.position
      );
      onChange(next);
      return;
    }

    if (sideAssemble) {
      const next = assembleBlockSideBySide(
        blocks,
        sideAssemble.targetIdx,
        newImageBlock,
        sideAssemble.side
      );
      onChange(next);
      return;
    }

    const idx =
      insertAtIdx !== undefined ? insertAtIdx : Math.max(0, blocks.length - 1);
    const next = [...blocks];
    next.splice(idx + 1, 0, newImageBlock);
    onChange(cleanupOrphanRowIds(next));
  }

  const filteredSlashItems = getFilteredSlashItems();
  const activeFocusedIdx = Math.max(
    0,
    blocks.findIndex((b) => b.id === focusedBlockId)
  );

  function handleQuickAddBlock(targetType: NotionBlockType) {
    if (targetType === 'image') {
      const newImgBlock: NotionBlock = {
        id: createBlockId(),
        type: 'image',
        content: '',
        imageUrl: '',
        caption: '',
        images: [],
        imageSize: 'md',
      };
      onChange([...blocks, newImgBlock]);
    } else if (targetType === 'table') {
      const newTableBlock: NotionBlock = {
        id: createBlockId(),
        type: 'table',
        content: '',
        tableRows: createDefaultTableRows(3, 3),
        hasTableHeader: true,
      };
      onChange([...blocks, newTableBlock]);
      focusTableCell(newTableBlock.id, 0, 0);
    } else if (targetType === 'quiz') {
      const newQuizBlock: NotionBlock = {
        id: createBlockId(),
        type: 'quiz',
        content: '',
        quizData: createDefaultQuizData('multiple_choice'),
      };
      onChange([...blocks, newQuizBlock]);
    } else {
      const newBlock: NotionBlock = {
        id: createBlockId(),
        type: targetType,
        content:
          targetType === 'mermaid'
            ? MERMAID_TEMPLATES[0].code
            : targetType === 'simulation'
            ? SIMULATION_TEMPLATES[0].code
            : targetType === 'colab'
            ? COLAB_TEMPLATES[0].code
            : targetType === 'physical'
            ? serializePhysicalBlockContent(
                PHYSICAL_COMPUTING_TEMPLATES[0].config,
                PHYSICAL_COMPUTING_TEMPLATES[0].code
              )
            : '',
        caption:
          targetType === 'simulation'
            ? SIMULATION_TEMPLATES[0].caption
            : targetType === 'colab'
            ? COLAB_TEMPLATES[0].caption
            : targetType === 'physical'
            ? PHYSICAL_COMPUTING_TEMPLATES[0].caption
            : undefined,
        icon: targetType === 'callout' ? '💡' : undefined,
        language: targetType === 'code' ? 'python' : undefined,
      };
      onChange([...blocks, newBlock]);
      focusBlock(newBlock.id);
    }
  }

  return (
    <div
      ref={editorContainerRef}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setIsDraggingFileOverPage(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsDraggingFileOverPage(false);
        }
      }}
      onDrop={async (e) => {
        setIsDraggingFileOverPage(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const hasImage = Array.from(e.dataTransfer.files).some((f) =>
            f.type.startsWith('image/')
          );
          if (hasImage) {
            e.preventDefault();
            if (
              dragOverBlockIdx !== null &&
              (dragOverSide === 'stack-top' || dragOverSide === 'stack-bottom')
            ) {
              await handleImageFilesDrop(
                e.dataTransfer.files,
                undefined,
                undefined,
                'replace',
                undefined,
                {
                  targetIdx: dragOverBlockIdx,
                  position: dragOverSide === 'stack-top' ? 'top' : 'bottom',
                }
              );
            } else if (
              dragOverBlockIdx !== null &&
              (dragOverSide === 'left' || dragOverSide === 'right')
            ) {
              await handleImageFilesDrop(
                e.dataTransfer.files,
                undefined,
                undefined,
                'replace',
                {
                  targetIdx: dragOverBlockIdx,
                  side: dragOverSide,
                }
              );
            } else {
              await handleImageFilesDrop(
                e.dataTransfer.files,
                dragOverBlockIdx !== null ? dragOverBlockIdx : blocks.length - 1
              );
            }
            setDragOverBlockIdx(null);
            setDragOverSide(null);
          }
        }
      }}
      className="relative space-y-2"
    >
      {/* 숨겨진 이미지 파일 선택 input (multiple 지원으로 여러 장 동시 가로 배치 가능) */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const stackTarget = stackImageInsertRef.current;
            const sideTarget = sideImageInsertRef.current;
            const targetId = targetImageBlockIdRef.current;
            const mode = imageUploadModeRef.current;
            if (stackTarget) {
              await handleImageFilesDrop(
                files,
                undefined,
                undefined,
                'replace',
                undefined,
                stackTarget
              );
              stackImageInsertRef.current = null;
            } else if (sideTarget) {
              await handleImageFilesDrop(
                files,
                undefined,
                undefined,
                'replace',
                sideTarget
              );
              sideImageInsertRef.current = null;
            } else if (targetId) {
              setUploadingImageBlockId(targetId);
              await handleImageFilesDrop(files, undefined, targetId, mode);
              setUploadingImageBlockId(null);
              targetImageBlockIdRef.current = null;
              imageUploadModeRef.current = 'replace';
            } else {
              await handleImageFilesDrop(files, blocks.length - 1);
            }
          }
          if (imageInputRef.current) imageInputRef.current.value = '';
        }}
      />

      {/* 상단 고정 노션 블록 빠른 삽입 & 텍스트 서식 단축키 툴바 (초슬림 1줄 기본 / 상세 펼치기 / 최소화 접기 지원) */}
      <div className="sticky top-[124px] z-20">
        {toolbarMode === 'minimized' ? (
          <div className="pointer-events-none flex justify-end">
            <button
              type="button"
              onClick={() => setToolbarMode('compact')}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/95 px-3 py-1 text-xs font-extrabold text-indigo-700 shadow-sm backdrop-blur-md hover:bg-indigo-50 transition cursor-pointer"
              title="빠른 블록 추가 및 서식 툴바를 다시 펼칩니다"
            >
              <span>🛠️ 빠른 블록 · 서식 도구 열기</span>
              <span>▼</span>
            </button>
          </div>
        ) : toolbarMode === 'compact' ? (
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-gray-200/90 bg-white/95 px-2.5 py-1.5 shadow-xs backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-1">
              {BLOCK_TYPE_META.map((item) => {
                const shortLabel =
                  item.type === 'h1'
                    ? 'H1'
                    : item.type === 'h2'
                    ? 'H2'
                    : item.type === 'h3'
                    ? 'H3'
                    : item.type === 'colab'
                    ? 'Colab'
                    : item.type === 'vpython'
                    ? '3D'
                    : item.type === 'physical'
                    ? '피지컬'
                    : item.type === 'simulation'
                    ? '실험'
                    : item.type === 'quiz'
                    ? '퀴즈'
                    : item.type === 'youtube'
                    ? '유튜브'
                    : item.type === 'link'
                    ? '링크'
                    : item.label.split(' ')[0];
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleQuickAddBlock(item.type)}
                    className="inline-flex items-center gap-0.5 rounded-md border border-gray-200/90 bg-gray-50/80 px-1.5 py-0.5 text-[11px] font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition cursor-pointer"
                    title={`${item.label} — ${item.desc}`}
                  >
                    <span className="text-blue-600">{item.badge}</span>
                    <span>{shortLabel}</span>
                  </button>
                );
              })}

              <span className="mx-0.5 h-3.5 w-px bg-gray-200 select-none" />

              {/* 미니 인라인 서식 아이콘 버튼 */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatToFocusedBlock('**');
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-[11px] font-black text-gray-900 hover:bg-gray-100 transition cursor-pointer"
                title="진하게 (단축키: Ctrl+B)"
              >
                B
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatToFocusedBlock('==');
                }}
                className="inline-flex h-6 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-1.5 text-[11px] font-extrabold text-amber-950 hover:bg-amber-100 transition cursor-pointer"
                title="형광펜 강조 (단축키: Ctrl+E)"
              >
                🖍️
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatToFocusedBlock('++');
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-[11px] font-bold underline decoration-2 text-gray-800 hover:bg-gray-100 transition cursor-pointer"
                title="밑줄 (단축키: Ctrl+U)"
              >
                U
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatToFocusedBlock('*');
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-[11px] italic font-serif font-bold text-gray-800 hover:bg-gray-100 transition cursor-pointer"
                title="기울임 (단축키: Ctrl+I)"
              >
                I
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatToFocusedBlock('`');
                }}
                className="inline-flex h-6 items-center justify-center rounded-md border border-gray-200 bg-white px-1.5 font-mono text-[10px] font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                title="인라인 코드 배지"
              >
                `코드`
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertInlineLinkToFocusedBlock();
                }}
                className="inline-flex h-6 items-center justify-center rounded-md border border-blue-200 bg-blue-50/70 px-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                title="선택한 텍스트에 하이퍼링크 삽입 (단축키: Ctrl+K)"
              >
                🔗링크
              </button>

              <span className="mx-0.5 h-3.5 w-px bg-gray-200 select-none" />

              {/* 미니 다단 조립 버튼 */}
              <button
                type="button"
                onClick={() =>
                  triggerSideBySideImageUpload(activeFocusedIdx, 'right')
                }
                className="inline-flex items-center gap-0.5 rounded-md border border-indigo-200 bg-indigo-50/80 px-1.5 py-0.5 text-[11px] font-bold text-indigo-800 hover:bg-indigo-100 transition cursor-pointer"
                title="현재 선택한 블록 바로 오른쪽 옆에 사진을 나란히 넣습니다"
              >
                <span>🖼️옆사진</span>
              </button>
              <button
                type="button"
                onClick={() => addSideBySideBlock(activeFocusedIdx, 'p', 'right')}
                className="inline-flex items-center gap-0.5 rounded-md border border-indigo-200 bg-white px-1.5 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                title="현재 선택한 블록 바로 오른쪽 옆에 설명글을 나란히 추가합니다"
              >
                <span>📝옆글</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  addSideBySideStackedBlocks(activeFocusedIdx, 'right')
                }
                className="inline-flex items-center gap-0.5 rounded-md border border-violet-200 bg-violet-50/80 px-1.5 py-0.5 text-[11px] font-bold text-violet-800 hover:bg-violet-100 transition cursor-pointer"
                title="현재 블록(세로로 긴 블록) 오른쪽에 상하 2칸으로 나뉜 블록을 배치합니다 (3분할 직사각형 구조, 상하 높이 드래그 조절 가능)"
              >
                <span>🍱옆2칸</span>
              </button>
            </div>

            {/* 우측: 되돌리기(Ctrl+Z)/다시실행(Ctrl+Y) + [?] 도움말 팝오버 + 상세 펼치기 / 숨기기 토글 */}
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={historyCounts.undo === 0}
                onMouseDown={(e) => {
                  e.preventDefault();
                  performUndo();
                }}
                className="inline-flex h-6 items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1.5 text-[11px] font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-35 transition cursor-pointer"
                title={`되돌리기 (단축키: Ctrl+Z)${
                  historyCounts.undo > 0 ? ` — ${historyCounts.undo}단계 가능` : ''
                }`}
              >
                <span>↩</span>
                <span className="hidden sm:inline text-[10px]">되돌리기</span>
              </button>
              <button
                type="button"
                disabled={historyCounts.redo === 0}
                onMouseDown={(e) => {
                  e.preventDefault();
                  performRedo();
                }}
                className="inline-flex h-6 items-center justify-center rounded-md border border-gray-200 bg-white px-1.5 text-[11px] font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-35 transition cursor-pointer"
                title="다시 실행 (단축키: Ctrl+Y 또는 Ctrl+Shift+Z)"
              >
                <span>↪</span>
              </button>

              <div className="group/help relative">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-[11px] font-extrabold text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 cursor-help select-none"
                  title="단축키 및 가로·상하 다단 조립 도움말"
                >
                  ?
                </span>
                <div className="pointer-events-none absolute right-0 top-full mt-1.5 z-40 hidden w-80 space-y-1.5 rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-[11px] leading-relaxed text-slate-100 shadow-xl group-hover/help:block">
                  <div>
                    ↩️ 편집 중 언제든 <strong className="text-amber-300">Ctrl+Z</strong>로 되돌리기, <strong className="text-amber-300">Ctrl+Y</strong>로 다시 실행
                  </div>
                  <div>
                    💡 빈 줄에 <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-amber-300">/</kbd> 입력 시 표·코드·순서도·시뮬레이션 즉시 선택
                  </div>
                  <div>
                    ✨ 텍스트 드래그 후 <strong className="text-amber-300">Ctrl+B</strong>(진하게), <strong className="text-amber-300">Ctrl+E</strong>(형광펜), <strong className="text-amber-300">Ctrl+U</strong>(밑줄)
                  </div>
                  <div>
                    📐 블록을 다른 블록의 <strong className="text-indigo-300">왼쪽·오른쪽 끝</strong>으로 드래그해 나란히 조립하고, 열 안에서 <strong className="text-violet-300">위·아래</strong>로 드래그해 3분할(1열 긴 블록 + 옆열 상하 2칸)로 배치한 뒤 <strong className="text-indigo-300">경계선(↔ / ↕)</strong>을 드래그해 크기를 조절하세요!
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setToolbarMode('expanded')}
                className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                title="글자 강조 단축키와 다단 조립 도구를 넓게 펼쳐서 봅니다"
              >
                ▼ 상세
              </button>
              <button
                type="button"
                onClick={() => setToolbarMode('minimized')}
                className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition cursor-pointer"
                title="상단 툴바를 접어 입력 화면을 넓게 사용합니다"
              >
                ▲ 접기
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-gray-200/90 bg-white/95 px-3.5 py-2.5 shadow-sm backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-400 mr-1">
                  블록 빠른 추가:
                </span>
                {BLOCK_TYPE_META.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleQuickAddBlock(item.type)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50/80 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition cursor-pointer"
                    title={item.desc}
                  >
                    <span className="text-blue-600">{item.badge}</span>
                    <span>{item.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={historyCounts.undo === 0}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    performUndo();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-35 transition cursor-pointer"
                  title="되돌리기 (단축키: Ctrl+Z)"
                >
                  <span>↩ 되돌리기</span>
                  <kbd className="rounded bg-gray-100 px-1 py-0.2 font-mono text-[10px] text-gray-500">
                    Ctrl+Z
                  </kbd>
                </button>
                <button
                  type="button"
                  disabled={historyCounts.redo === 0}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    performRedo();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-35 transition cursor-pointer"
                  title="다시 실행 (단축키: Ctrl+Y 또는 Ctrl+Shift+Z)"
                >
                  <span>↪ 다시실행</span>
                </button>
                <div className="group/help relative">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-[11px] font-extrabold text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 cursor-help select-none">
                    ?
                  </span>
                  <div className="pointer-events-none absolute right-0 top-full mt-1.5 z-40 hidden w-80 space-y-1.5 rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-[11px] leading-relaxed text-slate-100 shadow-xl group-hover/help:block">
                    <div>
                      💡 빈 줄에 <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-amber-300">/</kbd> 입력 시 표·코드·순서도·시뮬레이션 즉시 선택
                    </div>
                    <div>
                      ✨ 텍스트 드래그 후 <strong className="text-amber-300">Ctrl+B</strong>(진하게), <strong className="text-amber-300">Ctrl+E</strong>(형광펜), <strong className="text-amber-300">Ctrl+U</strong>(밑줄)
                    </div>
                    <div>
                      📐 블록을 다른 블록의 <strong className="text-indigo-300">왼쪽·오른쪽 끝</strong>으로 드래그해 나란히 조립하고, <strong className="text-indigo-300">경계선 · 우측 끝 핸들(↔)</strong>로 폭을 조절하세요!
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setToolbarMode('compact')}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                >
                  ▲ 1줄 슬림 바
                </button>
                <button
                  type="button"
                  onClick={() => setToolbarMode('minimized')}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-200 transition cursor-pointer"
                >
                  ✕ 숨기기
                </button>
              </div>
            </div>

            {/* 노션 스타일 인라인 서식 단축키 바 + 가로 다단 조립 통합 행 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-400 mr-1">
                  글자 강조:
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyFormatToFocusedBlock('**');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-800 hover:bg-gray-100 transition cursor-pointer shadow-2xs"
                  title="드래그한 텍스트를 진하게 표시합니다 (단축키: Ctrl + B)"
                >
                  <span className="font-black text-gray-950">B</span>
                  <span>진하게</span>
                  <kbd className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-gray-500">
                    Ctrl+B
                  </kbd>
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyFormatToFocusedBlock('==');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50/80 px-2 py-0.5 text-xs font-bold text-amber-950 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                  title="드래그한 텍스트에 형광펜 강조 표시를 합니다 (단축키: Ctrl + E)"
                >
                  <span className="rounded bg-yellow-300/90 px-1 text-[11px] font-extrabold text-gray-900">
                    🖍️ 형광펜
                  </span>
                  <kbd className="rounded bg-white/90 px-1 py-0.5 font-mono text-[10px] font-semibold text-amber-800">
                    Ctrl+E
                  </kbd>
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyFormatToFocusedBlock('++');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-800 hover:bg-gray-100 transition cursor-pointer shadow-2xs"
                  title="드래그한 텍스트에 밑줄을 긋습니다 (단축키: Ctrl + U)"
                >
                  <span className="underline decoration-2 underline-offset-2 font-bold">
                    U 밑줄
                  </span>
                  <kbd className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-gray-500">
                    Ctrl+U
                  </kbd>
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyFormatToFocusedBlock('*');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-800 hover:bg-gray-100 transition cursor-pointer shadow-2xs"
                  title="드래그한 텍스트를 기울임꼴로 표시합니다 (단축키: Ctrl + I)"
                >
                  <span className="italic font-serif font-bold">I 기울임</span>
                  <kbd className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-gray-500">
                    Ctrl+I
                  </kbd>
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyFormatToFocusedBlock('`');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer shadow-2xs"
                  title="드래그한 텍스트를 인라인 코드 배지로 감쌉니다"
                >
                  <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">
                    `코드`
                  </span>
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertInlineLinkToFocusedBlock();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/80 px-2 py-0.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer shadow-2xs"
                  title="드래그한 텍스트에 하이퍼링크를 삽입합니다 (단축키: Ctrl + K)"
                >
                  <span>🔗 링크</span>
                  <kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] font-semibold text-blue-600">
                    Ctrl+K
                  </kbd>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-indigo-700 mr-1">
                  📐 가로·상하 조립:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    triggerSideBySideImageUpload(activeFocusedIdx, 'right')
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2 py-0.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition cursor-pointer shadow-2xs"
                >
                  <span>🖼️ 옆에 사진 넣기</span>
                </button>
                <button
                  type="button"
                  onClick={() => addSideBySideBlock(activeFocusedIdx, 'p', 'right')}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-0.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition cursor-pointer shadow-2xs"
                >
                  <span>📝 옆에 설명글</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addSideBySideStackedBlocks(activeFocusedIdx, 'right')
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50/90 px-2 py-0.5 text-xs font-extrabold text-violet-800 hover:bg-violet-100 transition cursor-pointer shadow-2xs"
                  title="세로로 긴 블록 옆에 위·아래 2개의 블록이 들어가는 3분할 직사각형 레이아웃을 만듭니다"
                >
                  <span>🍱 옆에 상하 2칸 블록 (3분할)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addSideBySideBlock(activeFocusedIdx, 'code', 'right')
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-0.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition cursor-pointer shadow-2xs"
                >
                  <span>💻 옆에 코드블록</span>
                </button>
                <button
                  type="button"
                  disabled={activeFocusedIdx <= 0}
                  onClick={() => joinBlockWithPrevRow(activeFocusedIdx)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition cursor-pointer shadow-2xs"
                >
                  <span>⬆️ 위 블록 옆으로 합치기</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 실시간 가로 폭 / 상하 분할 / 표 행·열 드래그 리사이즈 상태 배지 */}
      {resizingInfo && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-indigo-300 bg-indigo-950/90 px-4 py-2.5 text-xs font-extrabold text-white shadow-xl backdrop-blur-xs">
          <span>
            {resizingInfo.mode === 'table-row' ||
            resizingInfo.mode === 'stack-split'
              ? '↕'
              : '↔'}
          </span>
          <span>
            {resizingInfo.mode === 'column-split'
              ? `좌우 열 비율 조절 중: ${resizingInfo.label}`
              : resizingInfo.mode === 'stack-split'
              ? `열 내부 상하 블록 높이 조절 중: ${resizingInfo.label}`
              : resizingInfo.mode === 'table-col'
              ? `표 열 너비 조절 중: ${resizingInfo.label}`
              : resizingInfo.mode === 'table-row'
              ? `표 행 높이 조절 중: ${resizingInfo.label}`
              : `블록 가로 폭 조절 중: ${resizingInfo.label}`}
          </span>
        </div>
      )}

      {/* 파일 드래그 오버 시 표시되는 노션 스타일 안내 오버레이 */}
      {isDraggingFileOverPage && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-blue-600/10 backdrop-blur-[1px]">
          <div className="rounded-2xl border-2 border-dashed border-blue-600 bg-white px-8 py-6 text-center shadow-2xl">
            <div className="text-4xl mb-2">🖼️</div>
            <div className="text-base font-extrabold text-blue-900">
              여기에 사진을 놓아 교안 페이지에 바로 삽입하세요!
            </div>
            <div className="text-xs text-blue-600 mt-1">
              블록의 왼쪽·오른쪽 가장자리에 놓으면 글이나 코드블록 옆에 나란히 조립됩니다
            </div>
          </div>
        </div>
      )}

      {/* 노션 블록 리스트 렌더링 (2D 다단 가로+상하 분할 직사각형 조립 행 & 개별 블록 리사이즈 지원) */}
      <div className="space-y-3 pt-2">
        {groupBlocksIntoRows(blocks).map((rowGroup) => {
          const isMultiColumnRow = rowGroup.columns.length > 1;
          const normalizedWidths = getNormalizedColumnWidths(rowGroup.columns);
          const totalStackedCount = rowGroup.items.length;
          const rowKey =
            rowGroup.rowId || rowGroup.items[0]?.block.id || 'row';
          const lastItemInRow = rowGroup.items[rowGroup.items.length - 1];

          return (
            <div
              key={rowKey}
              className={
                isMultiColumnRow
                  ? 'rounded-2xl border border-indigo-200/80 bg-indigo-50/15 p-2.5 shadow-2xs transition-all'
                  : ''
              }
            >
              {/* 다단(가로 나란히 조립 + 열 내부 상하 분할) 행 상단 비율 조절 & 열 추가 컨트롤 바 */}
              {isMultiColumnRow && rowGroup.rowId && (
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100/90 pb-1.5 px-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100/90 px-2 py-0.5 text-[11px] font-extrabold text-indigo-800">
                      📐 가로 {rowGroup.columns.length}열
                      {totalStackedCount > rowGroup.columns.length
                        ? ` · 총 ${totalStackedCount}블록 (상하 분할 포함)`
                        : ' 나란히 조립됨'}
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-600">
                      (가로 비율:{' '}
                      {normalizedWidths
                        .map((w) => `${Math.round(w)}%`)
                        .join(' : ')}
                      )
                    </span>

                    {rowGroup.columns.length === 2 ? (
                      <div className="flex items-center gap-1 ml-1">
                        {(
                          [
                            { label: '5:5', ratios: [50, 50] },
                            { label: '6:4', ratios: [60, 40] },
                            { label: '4:6', ratios: [40, 60] },
                            { label: '7:3', ratios: [70, 30] },
                            { label: '3:7', ratios: [30, 70] },
                          ] as { label: string; ratios: number[] }[]
                        ).map((preset) => {
                          const isCurrent =
                            Math.abs(
                              normalizedWidths[0] - preset.ratios[0]
                            ) <= 2;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                applyRowWidthPreset(
                                  rowGroup.rowId!,
                                  preset.ratios
                                )
                              }
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                                isCurrent
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                              }`}
                              title={`좌우 열 가로 폭 비율을 ${preset.label}로 설정`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          applyRowWidthPreset(
                            rowGroup.rowId!,
                            rowGroup.columns.map(() =>
                              Number(
                                (100 / rowGroup.columns.length).toFixed(1)
                              )
                            )
                          )
                        }
                        className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                      >
                        균등 폭 맞춤
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        addStackedBlockInColumn(
                          lastItemInRow.index,
                          'p',
                          'bottom'
                        )
                      }
                      title="오른쪽(마지막) 열의 아래쪽에 상하 분할 블록을 하나 더 쌓아 직사각형 내부를 나눕니다"
                      className="rounded-lg border border-violet-200 bg-violet-50/90 px-2 py-0.5 text-[11px] font-bold text-violet-700 hover:bg-violet-100 cursor-pointer"
                    >
                      🍱 +마지막 열 상하 2칸 분할
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        triggerSideBySideImageUpload(
                          lastItemInRow.index,
                          'right'
                        )
                      }
                      className="rounded-lg border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                    >
                      🖼️ +옆에 사진 열
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        addSideBySideBlock(lastItemInRow.index, 'p', 'right')
                      }
                      className="rounded-lg border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                    >
                      ➕ +옆에 블록 열
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertBlockAfter(lastItemInRow.index, {
                          id: createBlockId(),
                          type: 'p',
                          content: '',
                        })
                      }
                      className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                      title="이 다단 행 바로 아래에 새로운 전체 폭 줄을 추가합니다"
                    >
                      ↵ 아래에 새 줄
                    </button>
                  </div>
                </div>
              )}

              <div
                ref={(el) => {
                  if (rowGroup.rowId) {
                    rowContainerRefs.current[rowGroup.rowId] = el;
                  }
                }}
                className={
                  isMultiColumnRow
                    ? 'flex flex-col md:flex-row items-stretch'
                    : ''
                }
              >
                {rowGroup.columns.map((colGroup, colIdx) => {
                  const colWidthPct = normalizedWidths[colIdx] ?? 100;
                  const stackHeights = getNormalizedStackHeights(colGroup.items);
                  const isMultiStackCol = colGroup.items.length > 1;
                  const firstSingleBlock = colGroup.items[0]?.block;
                  const customStandaloneWidth =
                    !isMultiColumnRow &&
                    firstSingleBlock &&
                    typeof firstSingleBlock.widthPercent === 'number' &&
                    firstSingleBlock.widthPercent >= 25 &&
                    firstSingleBlock.widthPercent < 100
                      ? Math.round(firstSingleBlock.widthPercent)
                      : null;

                  return (
                    <div
                      key={`${colGroup.colId}_${colIdx}`}
                      style={
                        isMultiColumnRow
                          ? {
                              flexGrow: colWidthPct,
                              flexShrink: 1,
                              flexBasis: 0,
                            }
                          : customStandaloneWidth
                          ? ({
                              '--block-w': `${customStandaloneWidth}%`,
                            } as React.CSSProperties)
                          : undefined
                      }
                      className={`relative flex items-stretch min-w-0 ${
                        !isMultiColumnRow && customStandaloneWidth
                          ? 'w-full md:w-[var(--block-w)] transition-[width] duration-75'
                          : 'w-full'
                      }`}
                    >
                      <div
                        ref={(el) => {
                          if (rowGroup.rowId) {
                            colContainerRefs.current[
                              `${rowGroup.rowId}_${colGroup.colId}`
                            ] = el;
                          }
                        }}
                        style={
                          isMultiStackCol
                            ? {
                                minHeight: `${Math.max(
                                  260,
                                  colGroup.items.length * 135
                                )}px`,
                              }
                            : undefined
                        }
                        className="flex flex-1 flex-col min-w-0 w-full"
                      >
                        {colGroup.items.map(({ block, index: idx }, stackIdx) => {
                          const isSlashOpen = slashMenuBlockId === block.id;
                          const isBeingDragged = draggedBlockIdx === idx;
                          const isDropTarget =
                            dragOverBlockIdx === idx && draggedBlockIdx !== idx;
                          const stackHeightPct = stackHeights[stackIdx] ?? 100;

                          return (
                            <div
                              key={block.id}
                              style={
                                isMultiStackCol
                                  ? {
                                      flexGrow: stackHeightPct,
                                      flexShrink: 1,
                                      flexBasis: `${stackHeightPct}%`,
                                    }
                                  : isMultiColumnRow
                                  ? {
                                      flexGrow: 1,
                                      flexShrink: 1,
                                      flexBasis: 'auto',
                                    }
                                  : undefined
                              }
                              className="relative flex flex-col min-w-0 w-full"
                            >
                              <div
                                draggable={
                                  dragHandleHoveredBlockId === block.id ||
                                  (block.type !== 'code' &&
                                    block.type !== 'colab' &&
                                    block.type !== 'vpython' &&
                                    block.type !== 'physical' &&
                                    block.type !== 'mermaid' &&
                                    block.type !== 'simulation' &&
                                    block.type !== 'table' &&
                                    block.type !== 'quiz')
                                }
                                onDragStart={(e) => {
                                  setDraggedBlockIdx(idx);
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('text/plain', block.id);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  const rect =
                                    e.currentTarget.getBoundingClientRect();
                                  const relX =
                                    (e.clientX - rect.left) /
                                    Math.max(1, rect.width);
                                  const relY =
                                    (e.clientY - rect.top) /
                                    Math.max(1, rect.height);
                                  let nextSide:
                                    | 'left'
                                    | 'right'
                                    | 'stack-top'
                                    | 'stack-bottom'
                                    | 'vertical' = 'vertical';
                                  if (relX < 0.2) {
                                    nextSide = 'left';
                                  } else if (relX > 0.8) {
                                    nextSide = 'right';
                                  } else if (isMultiColumnRow && relY < 0.35) {
                                    nextSide = 'stack-top';
                                  } else if (isMultiColumnRow && relY > 0.65) {
                                    nextSide = 'stack-bottom';
                                  }
                                  if (dragOverBlockIdx !== idx) {
                                    setDragOverBlockIdx(idx);
                                  }
                                  if (dragOverSide !== nextSide) {
                                    setDragOverSide(nextSide);
                                  }
                                }}
                                onDragEnd={() => {
                                  setDraggedBlockIdx(null);
                                  setDragOverBlockIdx(null);
                                  setDragOverSide(null);
                                }}
                                onDrop={(e) => {
                                  if (
                                    draggedBlockIdx !== null &&
                                    draggedBlockIdx !== idx &&
                                    !e.dataTransfer.types.includes('Files')
                                  ) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const next = [...blocks];
                                    const [moved] = next.splice(
                                      draggedBlockIdx,
                                      1
                                    );
                                    const adjustedTargetIdx =
                                      draggedBlockIdx < idx ? idx - 1 : idx;

                                    if (
                                      dragOverSide === 'left' ||
                                      dragOverSide === 'right'
                                    ) {
                                      const assembled = assembleBlockSideBySide(
                                        next,
                                        adjustedTargetIdx,
                                        moved,
                                        dragOverSide
                                      );
                                      onChange(assembled);
                                    } else if (
                                      dragOverSide === 'stack-top' ||
                                      dragOverSide === 'stack-bottom'
                                    ) {
                                      const assembled =
                                        assembleBlockInColumnStack(
                                          next,
                                          adjustedTargetIdx,
                                          moved,
                                          dragOverSide === 'stack-top'
                                            ? 'top'
                                            : 'bottom'
                                        );
                                      onChange(assembled);
                                    } else {
                                      const movedClean: NotionBlock = {
                                        ...moved,
                                        rowId: blocks[idx]?.rowId,
                                        colId: blocks[idx]?.colId,
                                        widthPercent: undefined,
                                        stackHeightPercent: undefined,
                                      };
                                      next.splice(idx, 0, movedClean);
                                      onChange(cleanupOrphanRowIds(next));
                                    }
                                  }
                                  setDraggedBlockIdx(null);
                                  setDragOverBlockIdx(null);
                                  setDragOverSide(null);
                                }}
                                className={`group relative flex flex-1 min-w-0 items-start rounded-xl transition-all ${
                                  isMultiColumnRow
                                    ? 'gap-1 px-1.5 py-1 bg-white/90 border border-indigo-100/90 shadow-2xs'
                                    : 'gap-2 px-2 py-1.5'
                                } ${
                                  isBeingDragged
                                    ? 'opacity-40 scale-[0.99] bg-blue-50/40 ring-1 ring-blue-300'
                                    : isDropTarget && dragOverSide === 'vertical'
                                    ? 'border-y-2 border-blue-500 bg-blue-50/40 shadow-xs'
                                    : isDropTarget &&
                                      (dragOverSide === 'left' ||
                                        dragOverSide === 'right')
                                    ? 'bg-indigo-50/50 ring-2 ring-indigo-400'
                                    : isDropTarget &&
                                      (dragOverSide === 'stack-top' ||
                                        dragOverSide === 'stack-bottom')
                                    ? 'bg-violet-50/50 ring-2 ring-violet-400'
                                    : 'hover:bg-gray-50/80'
                                }`}
                              >
                                {/* 좌/우 가장자리 드롭 시 표시되는 가로 나란히 조립 가이드 바 */}
                                {isDropTarget && dragOverSide === 'left' && (
                                  <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-center">
                                    <div className="h-full w-1.5 rounded-full bg-indigo-600 shadow-md" />
                                    <span className="ml-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-extrabold text-white shadow-lg">
                                      ⬅️ 왼쪽 열에 나란히 배치
                                    </span>
                                  </div>
                                )}
                                {isDropTarget && dragOverSide === 'right' && (
                                  <div className="pointer-events-none absolute inset-y-0 right-0 z-30 flex items-center justify-end">
                                    <span className="mr-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-extrabold text-white shadow-lg">
                                      ➡️ 오른쪽 열에 나란히 배치
                                    </span>
                                    <div className="h-full w-1.5 rounded-full bg-indigo-600 shadow-md" />
                                  </div>
                                )}
                                {isDropTarget && dragOverSide === 'stack-top' && (
                                  <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-center">
                                    <div className="w-full h-1.5 rounded-full bg-violet-600 shadow-md" />
                                    <span className="mt-1 whitespace-nowrap rounded-lg bg-violet-600 px-2 py-0.5 text-[11px] font-extrabold text-white shadow-lg">
                                      ⬆️ 이 열의 위쪽에 상하 분할 배치
                                    </span>
                                  </div>
                                )}
                                {isDropTarget &&
                                  dragOverSide === 'stack-bottom' && (
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center justify-end">
                                      <span className="mb-1 whitespace-nowrap rounded-lg bg-violet-600 px-2 py-0.5 text-[11px] font-extrabold text-white shadow-lg">
                                        ⬇️ 이 열의 아래쪽에 상하 분할 배치
                                      </span>
                                      <div className="w-full h-1.5 rounded-full bg-violet-600 shadow-md" />
                                    </div>
                                  )}

                        {/* 좌측 노션 스타일 블록 컨트롤 핸들 (+ 아래에 빈 블록 추가 / ⋮⋮ 드래그 순서 이동) */}
                        <div className="relative z-30 flex shrink-0 items-center gap-0.5 pt-1 opacity-55 group-hover:opacity-100 transition select-none">
                          <button
                            type="button"
                            title="이 블록 아래에 빈 블록 추가"
                            onClick={() => {
                              setSlashMenuBlockId(null);
                              setSlashFilterQuery('');
                              insertBlockAfter(idx, {
                                id: createBlockId(),
                                type: 'p',
                                content: '',
                              });
                            }}
                            className={`flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-900 text-sm font-bold cursor-pointer ${
                              isMultiColumnRow ? 'h-5 w-5' : 'h-6 w-6'
                            }`}
                          >
                            +
                          </button>
                          <div
                            title="마우스로 잡고 위아래 또는 다른 블록의 왼쪽·오른쪽 끝으로 드래그하여 가로로 나란히 조립"
                            onMouseEnter={() =>
                              setDragHandleHoveredBlockId(block.id)
                            }
                            onMouseLeave={() => {
                              if (draggedBlockIdx === null) {
                                setDragHandleHoveredBlockId(null);
                              }
                            }}
                            onMouseDown={() =>
                              setDragHandleHoveredBlockId(block.id)
                            }
                            className={`flex cursor-grab active:cursor-grabbing items-center justify-center rounded-md text-gray-400 hover:bg-blue-100 hover:text-blue-700 text-xs font-bold transition ${
                              isMultiColumnRow ? 'h-5 w-5' : 'h-6 w-6'
                            }`}
                          >
                            ⋮⋮
                          </div>
                        </div>

                        {/* 블록 본문 영역 */}
                        <div className="flex-1 min-w-0">
                {/* 1. 대제목 (H1) */}
                {block.type === 'h1' && (
                  <div>
                    {focusedBlockId !== block.id &&
                    hasInlineFormatting(block.content) ? (
                      <div
                        onClick={() => focusBlock(block.id)}
                        className="cursor-text text-2xl font-extrabold text-gray-900 pt-2 pb-1 border-b border-gray-100 whitespace-pre-wrap"
                      >
                        {renderInlineMarkdown(block.content)}
                      </div>
                    ) : null}
                    <div
                      className={
                        focusedBlockId !== block.id &&
                        hasInlineFormatting(block.content)
                          ? 'hidden'
                          : ''
                      }
                    >
                      <AutoResizeTextarea
                        value={block.content}
                        inputRef={(el) => {
                          blockRefs.current[block.id] = el;
                        }}
                        onFocus={() => setFocusedBlockId(block.id)}
                        onBlur={() =>
                          setFocusedBlockId((prev) =>
                            prev === block.id ? null : prev
                          )
                        }
                        onChange={(val) => handleTextChangeWithSlash(block, val)}
                        onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                        onPaste={(e) => handleBlockPaste(e, idx)}
                        placeholder="단원 대제목 (제목 1)..."
                        className="text-2xl font-extrabold text-gray-900 placeholder:text-gray-300 pt-2 pb-1 border-b border-gray-100"
                      />
                    </div>
                  </div>
                )}

                {/* 2. 중제목 (H2) */}
                {block.type === 'h2' && (
                  <div className="flex items-center gap-2 pt-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                    <div className="flex-1 min-w-0">
                      {focusedBlockId !== block.id &&
                      hasInlineFormatting(block.content) ? (
                        <div
                          onClick={() => focusBlock(block.id)}
                          className="cursor-text text-lg font-bold text-indigo-950 whitespace-pre-wrap"
                        >
                          {renderInlineMarkdown(block.content)}
                        </div>
                      ) : null}
                      <div
                        className={
                          focusedBlockId !== block.id &&
                          hasInlineFormatting(block.content)
                            ? 'hidden'
                            : ''
                        }
                      >
                        <AutoResizeTextarea
                          value={block.content}
                          inputRef={(el) => {
                            blockRefs.current[block.id] = el;
                          }}
                          onFocus={() => setFocusedBlockId(block.id)}
                          onBlur={() =>
                            setFocusedBlockId((prev) =>
                              prev === block.id ? null : prev
                            )
                          }
                          onChange={(val) =>
                            handleTextChangeWithSlash(block, val)
                          }
                          onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                          onPaste={(e) => handleBlockPaste(e, idx)}
                          placeholder="소단원 중제목 (제목 2)..."
                          className="text-lg font-bold text-indigo-950 placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. 소제목 (H3) */}
                {block.type === 'h3' && (
                  <div>
                    {focusedBlockId !== block.id &&
                    hasInlineFormatting(block.content) ? (
                      <div
                        onClick={() => focusBlock(block.id)}
                        className="cursor-text text-base font-bold text-gray-800 pt-1 whitespace-pre-wrap"
                      >
                        {renderInlineMarkdown(block.content)}
                      </div>
                    ) : null}
                    <div
                      className={
                        focusedBlockId !== block.id &&
                        hasInlineFormatting(block.content)
                          ? 'hidden'
                          : ''
                      }
                    >
                      <AutoResizeTextarea
                        value={block.content}
                        inputRef={(el) => {
                          blockRefs.current[block.id] = el;
                        }}
                        onFocus={() => setFocusedBlockId(block.id)}
                        onBlur={() =>
                          setFocusedBlockId((prev) =>
                            prev === block.id ? null : prev
                          )
                        }
                        onChange={(val) => handleTextChangeWithSlash(block, val)}
                        onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                        onPaste={(e) => handleBlockPaste(e, idx)}
                        placeholder="소제목 (제목 3)..."
                        className="text-base font-bold text-gray-800 placeholder:text-gray-300 pt-1"
                      />
                    </div>
                  </div>
                )}

                {/* 4. 일반 본문 (Paragraph) */}
                {block.type === 'p' && (
                  <div>
                    {focusedBlockId !== block.id &&
                    hasInlineFormatting(block.content) ? (
                      <div
                        onClick={() => focusBlock(block.id)}
                        className="cursor-text text-sm text-gray-800 leading-snug py-0.5 whitespace-pre-wrap"
                      >
                        {renderInlineMarkdown(block.content)}
                      </div>
                    ) : null}
                    <div
                      className={
                        focusedBlockId !== block.id &&
                        hasInlineFormatting(block.content)
                          ? 'hidden'
                          : ''
                      }
                    >
                      <AutoResizeTextarea
                        value={block.content}
                        inputRef={(el) => {
                          blockRefs.current[block.id] = el;
                        }}
                        onFocus={() => setFocusedBlockId(block.id)}
                        onBlur={() =>
                          setFocusedBlockId((prev) =>
                            prev === block.id ? null : prev
                          )
                        }
                        onChange={(val) => handleTextChangeWithSlash(block, val)}
                        onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                        onPaste={(e) => handleBlockPaste(e, idx)}
                        placeholder="내용을 입력하거나 '/'를 눌러 블록(표, 코드블록, 순서도, 시뮬레이션, 사진 등)을 선택하세요... (Ctrl+B 진하게, Ctrl+E 형광펜)"
                        className="text-sm text-gray-800 leading-snug placeholder:text-gray-300 py-0.5"
                      />
                    </div>
                    {focusedBlockId === block.id &&
                      hasInlineFormatting(block.content) && (
                        <div className="mt-1 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/40 px-2.5 py-1 text-xs text-gray-800">
                          <span className="shrink-0 text-[10px] font-bold text-blue-600">
                            ✨ 서식 미리보기:
                          </span>
                          <div className="whitespace-pre-wrap leading-snug">
                            {renderInlineMarkdown(block.content)}
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* 5. 글머리 기호 목록 (Bullet) */}
                {block.type === 'bullet' && (
                  <div className="flex items-start gap-2.5 pl-1">
                    <span className="text-blue-600 font-extrabold select-none pt-0.5">
                      •
                    </span>
                    <div className="flex-1 min-w-0">
                      {focusedBlockId !== block.id &&
                      hasInlineFormatting(block.content) ? (
                        <div
                          onClick={() => focusBlock(block.id)}
                          className="cursor-text text-sm text-gray-800 leading-snug whitespace-pre-wrap"
                        >
                          {renderInlineMarkdown(block.content)}
                        </div>
                      ) : null}
                      <div
                        className={
                          focusedBlockId !== block.id &&
                          hasInlineFormatting(block.content)
                            ? 'hidden'
                            : ''
                        }
                      >
                        <AutoResizeTextarea
                          value={block.content}
                          inputRef={(el) => {
                            blockRefs.current[block.id] = el;
                          }}
                          onFocus={() => setFocusedBlockId(block.id)}
                          onBlur={() =>
                            setFocusedBlockId((prev) =>
                              prev === block.id ? null : prev
                            )
                          }
                          onChange={(val) =>
                            handleTextChangeWithSlash(block, val)
                          }
                          onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                          onPaste={(e) => handleBlockPaste(e, idx)}
                          placeholder="목록 항목 입력... (Ctrl+B 진하게, Ctrl+E 형광펜)"
                          className="text-sm text-gray-800 leading-snug placeholder:text-gray-300"
                        />
                      </div>
                      {focusedBlockId === block.id &&
                        hasInlineFormatting(block.content) && (
                          <div className="mt-1 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/40 px-2.5 py-1 text-xs text-gray-800">
                            <span className="shrink-0 text-[10px] font-bold text-blue-600">
                              ✨ 서식 미리보기:
                            </span>
                            <div className="whitespace-pre-wrap leading-snug">
                              {renderInlineMarkdown(block.content)}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* 6. 노션 콜아웃 박스 (Callout) */}
                {block.type === 'callout' && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/60 p-4 shadow-2xs">
                    <button
                      type="button"
                      title="클릭하여 아이콘 변경"
                      onClick={() => {
                        const currentIcon = block.icon || '💡';
                        const nextIdx =
                          (CALLOUT_ICONS.indexOf(currentIcon) + 1) %
                          CALLOUT_ICONS.length;
                        updateBlock(block.id, {
                          icon: CALLOUT_ICONS[nextIdx],
                        });
                      }}
                      className="text-xl hover:scale-110 transition cursor-pointer select-none"
                    >
                      {block.icon || '💡'}
                    </button>
                    <div className="flex-1 min-w-0">
                      {focusedBlockId !== block.id &&
                      hasInlineFormatting(block.content) ? (
                        <div
                          onClick={() => focusBlock(block.id)}
                          className="cursor-text text-sm font-medium text-gray-900 leading-snug whitespace-pre-wrap"
                        >
                          {renderInlineMarkdown(block.content)}
                        </div>
                      ) : null}
                      <div
                        className={
                          focusedBlockId !== block.id &&
                          hasInlineFormatting(block.content)
                            ? 'hidden'
                            : ''
                        }
                      >
                        <AutoResizeTextarea
                          value={block.content}
                          inputRef={(el) => {
                            blockRefs.current[block.id] = el;
                          }}
                          onFocus={() => setFocusedBlockId(block.id)}
                          onBlur={() =>
                            setFocusedBlockId((prev) =>
                              prev === block.id ? null : prev
                            )
                          }
                          onChange={(val) =>
                            updateBlock(block.id, { content: val })
                          }
                          onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                          onPaste={(e) => handleBlockPaste(e, idx)}
                          placeholder="핵심 개념, 주의사항, 탐구 질문을 강조 박스에 작성하세요 (아이콘 클릭 시 변경)..."
                          className="text-sm font-medium text-gray-900 leading-snug placeholder:text-amber-700/40"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. 인용구 / 읽기 지문 블록 (Quote) */}
                {block.type === 'quote' && (
                  <div className="border-l-4 border-indigo-500 bg-slate-50/80 pl-4 pr-3 py-2.5 rounded-r-xl">
                    {focusedBlockId !== block.id &&
                    hasInlineFormatting(block.content) ? (
                      <div
                        onClick={() => focusBlock(block.id)}
                        className="cursor-text text-sm italic text-gray-700 leading-snug whitespace-pre-wrap"
                      >
                        {renderInlineMarkdown(block.content)}
                      </div>
                    ) : null}
                    <div
                      className={
                        focusedBlockId !== block.id &&
                        hasInlineFormatting(block.content)
                          ? 'hidden'
                          : ''
                      }
                    >
                      <AutoResizeTextarea
                        value={block.content}
                        inputRef={(el) => {
                          blockRefs.current[block.id] = el;
                        }}
                        onFocus={() => setFocusedBlockId(block.id)}
                        onBlur={() =>
                          setFocusedBlockId((prev) =>
                            prev === block.id ? null : prev
                          )
                        }
                        onChange={(val) =>
                          updateBlock(block.id, { content: val })
                        }
                        onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                        onPaste={(e) => handleBlockPaste(e, idx)}
                        placeholder="교과서 지문, 역사 사료, 명언 또는 핵심 정의를 입력하세요..."
                        className="text-sm italic text-gray-700 leading-snug placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                )}

                {/* 8. 코드 블록 (Python 등 스마트 자동 들여쓰기 지원) */}
                {block.type === 'code' && (
                  <div className="my-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/80 px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-400">
                          <span>&lt;/&gt;</span>
                          <span>코드 블록</span>
                        </span>
                        <select
                          value={block.language || 'python'}
                          onChange={(e) =>
                            updateBlock(block.id, {
                              language: e.target.value as CodeLanguage,
                            })
                          }
                          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-100 focus:border-emerald-400 focus:outline-none cursor-pointer"
                        >
                          {CODE_LANGUAGES.map((lang) => (
                            <option key={lang.value} value={lang.value}>
                              {lang.label}
                            </option>
                          ))}
                        </select>

                        {(block.language || 'python') === 'python' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                updateBlock(block.id, {
                                  type: 'colab',
                                  caption:
                                    block.caption ||
                                    COLAB_TEMPLATES[0].caption,
                                  content:
                                    block.content.trim() ||
                                    COLAB_TEMPLATES[0].code,
                                })
                              }
                              className="rounded-lg bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer"
                            >
                              {isMultiColumnRow
                                ? '🐍 Colab 전환'
                                : '🐍 코랩(Colab) 실행 셀로 전환'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateBlock(block.id, {
                                  type: 'vpython',
                                  caption: block.caption || '',
                                  content: block.content.trim(),
                                })
                              }
                              className="rounded-lg bg-cyan-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-cyan-500 transition cursor-pointer"
                            >
                              {isMultiColumnRow
                                ? '🧊 VPython 전환'
                                : '🧊 Web VPython 3D로 전환'}
                            </button>
                          </>
                        )}

                        {(block.language === 'html' ||
                          block.language === 'javascript') && (
                          <button
                            type="button"
                            onClick={() =>
                              updateBlock(block.id, {
                                type: 'simulation',
                                caption:
                                  block.caption ||
                                  '인터랙티브 HTML/JS 실험 시뮬레이션',
                                content:
                                  block.content.trim() ||
                                  SIMULATION_TEMPLATES[0].code,
                              })
                            }
                            className="rounded-lg bg-teal-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-teal-500 transition cursor-pointer"
                          >
                            {isMultiColumnRow
                              ? '🧪 시뮬레이션 전환'
                              : '🧪 이 코드를 교안 내 시뮬레이션으로 실행하기'}
                          </button>
                        )}
                      </div>

                      {!isMultiColumnRow && (
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span>
                            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
                              Enter
                            </kbd>{' '}
                            자동 들여쓰기 ·{' '}
                            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
                              Tab
                            </kbd>{' '}
                            4칸 공백 ·{' '}
                            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
                              Shift+Enter
                            </kbd>{' '}
                            다음 블록
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <AutoResizeTextarea
                        value={block.content}
                        spellCheck={false}
                        inputRef={(el) => {
                          blockRefs.current[block.id] = el;
                        }}
                        onChange={(val) =>
                          updateBlock(block.id, { content: val })
                        }
                        onKeyDown={(e) =>
                          handleCodeOrMermaidKeyDown(e, block, idx)
                        }
                        placeholder={
                          (block.language || 'python') === 'python'
                            ? 'def solve(x):\n    if x > 0:\n        return x * 2\n# 콜론(:) 뒤에서 Enter를 누르면 자동으로 4칸 들여쓰기됩니다.'
                            : '// 코드를 입력하세요 (Enter 시 자동 들여쓰기 지원)'
                        }
                        className="font-mono text-xs sm:text-sm text-emerald-300 leading-relaxed placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                )}

                {/* 9. Mermaid 순서도 / 다이어그램 블록 (실시간 프리뷰 + 원클릭 템플릿) */}
                {block.type === 'mermaid' && (
                  <div className="my-2 overflow-hidden rounded-2xl border-2 border-indigo-200 bg-indigo-50/20 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/70 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                          ❖ MERMAID 순서도 / 다이어그램
                        </span>
                        <span className="text-xs font-semibold text-indigo-950">
                          코드를 수정하면 오른쪽(아래) 순서도가 실시간으로 바뀝니다
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-indigo-700 mr-1">
                          예시 템플릿:
                        </span>
                        {MERMAID_TEMPLATES.map((tpl, tIdx) => (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={() =>
                              updateBlock(block.id, { content: tpl.code })
                            }
                            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                      {/* 좌측: Mermaid 코드 에디터 */}
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-slate-100">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                          <span className="font-bold text-indigo-300">
                            ✏️ Mermaid 다이어그램 문법 (Enter 시 자동 들여쓰기)
                          </span>
                          <span>Shift+Enter로 다음 블록 이동</span>
                        </div>
                        <AutoResizeTextarea
                          value={block.content}
                          spellCheck={false}
                          inputRef={(el) => {
                            blockRefs.current[block.id] = el;
                          }}
                          onChange={(val) =>
                            updateBlock(block.id, { content: val })
                          }
                          onKeyDown={(e) =>
                            handleCodeOrMermaidKeyDown(e, block, idx)
                          }
                          placeholder={`flowchart TD\n    A["시작"] --> B["핵심 과정"]\n    B --> C["결과"]`}
                          className="font-mono text-xs text-amber-200 leading-relaxed placeholder:text-slate-600"
                        />
                      </div>

                      {/* 우측: 실시간 순서도 렌더링 프리뷰 */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-indigo-900 px-1">
                          👁️ 실시간 순서도 미리보기 (학생 화면 표시 모습)
                        </div>
                        <MermaidDiagram chart={block.content} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 9-2. 인터랙티브 시뮬레이션 블록 (HTML / JavaScript 실시간 실행 실험실) */}
                {block.type === 'simulation' && (
                  <div className="my-2 overflow-hidden rounded-2xl border-2 border-teal-300 bg-teal-50/20 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200/80 bg-teal-50/80 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                        <span className="rounded-md bg-teal-600 px-2 py-0.5 text-[11px] font-extrabold text-white shrink-0">
                          🧪 HTML / JS 인터랙티브 시뮬레이션
                        </span>
                        <input
                          type="text"
                          value={block.caption || ''}
                          onChange={(e) =>
                            updateBlock(block.id, { caption: e.target.value })
                          }
                          placeholder="시뮬레이션 실험 제목 입력 (예: 포물선 운동 속력·발사각 실험기)..."
                          className="flex-1 min-w-[200px] rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-bold text-teal-950 placeholder:text-teal-400 focus:border-teal-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-teal-800 mr-0.5">
                          물리·교과 실험 템플릿:
                        </span>
                        {SIMULATION_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() =>
                              updateBlock(block.id, {
                                content: tpl.code,
                                caption: tpl.caption,
                              })
                            }
                            className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-bold text-teal-800 hover:bg-teal-100 transition cursor-pointer"
                          >
                            {tpl.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setHiddenSimCodeBlockIds((prev) => ({
                              ...prev,
                              [block.id]: !prev[block.id],
                            }))
                          }
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                            hiddenSimCodeBlockIds[block.id]
                              ? 'border-teal-600 bg-teal-600 text-white'
                              : 'border-slate-300 bg-slate-800 text-white hover:bg-slate-700'
                          }`}
                        >
                          {hiddenSimCodeBlockIds[block.id]
                            ? '</> JS/HTML 코드 편집창 열기'
                            : '👁️ 코드 접고 시뮬레이션만 크게 보기'}
                        </button>
                      </div>
                    </div>

                    <div
                      className={`grid grid-cols-1 ${
                        hiddenSimCodeBlockIds[block.id]
                          ? 'lg:grid-cols-1'
                          : 'lg:grid-cols-2'
                      } gap-4 p-4`}
                    >
                      {/* 좌측: HTML/JS 시뮬레이션 코드 에디터 */}
                      {!hiddenSimCodeBlockIds[block.id] && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-slate-100">
                          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                            <span className="font-bold text-teal-300">
                              💻 HTML + JavaScript 시뮬레이션 코드 (Enter 자동 들여쓰기)
                            </span>
                            <span>Shift+Enter로 다음 블록 이동</span>
                          </div>
                          <AutoResizeTextarea
                            value={block.content}
                            spellCheck={false}
                            inputRef={(el) => {
                              blockRefs.current[block.id] = el;
                            }}
                            onChange={(val) =>
                              updateBlock(block.id, { content: val })
                            }
                            onKeyDown={(e) =>
                              handleCodeOrMermaidKeyDown(e, block, idx)
                            }
                            placeholder={`<canvas id="sim" width="600" height="240"></canvas>\n<script>\n  // 물리 운동·그래프 시뮬레이션 JavaScript 코드를 작성하세요\n</script>`}
                            className="font-mono text-xs text-emerald-300 leading-relaxed placeholder:text-slate-600"
                          />
                        </div>
                      )}

                      {/* 우측(또는 전체): 실시간 인터랙티브 시뮬레이션 실행 화면 */}
                      <div>
                        <SimulationBlockPreview
                          code={block.content}
                          caption={block.caption}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 9-2B. 🐍 파이썬 실행 셀 (Google Colab 스타일 브라우저 즉시 실행 & 실습) */}
                {block.type === 'colab' && (
                  <div className="my-2 overflow-hidden rounded-2xl border-2 border-amber-300 bg-amber-50/20 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 bg-amber-50/90 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                        <span className="rounded-md bg-amber-500 px-2.5 py-0.5 text-[11px] font-extrabold text-slate-950 shrink-0">
                          🐍 파이썬 실행 셀 (Colab 실습)
                        </span>
                        <input
                          type="text"
                          value={block.caption || ''}
                          onChange={(e) =>
                            updateBlock(block.id, { caption: e.target.value })
                          }
                          placeholder="실습 셀 제목 (예: 리스트 정렬과 matplotlib 그래프 그리기)..."
                          className="flex-1 min-w-[180px] rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
                        />
                        <input
                          type="url"
                          value={block.externalUrl || ''}
                          onChange={(e) =>
                            updateBlock(block.id, {
                              externalUrl: e.target.value,
                            })
                          }
                          placeholder="(선택) 공유할 Google Colab 노트북 URL 입력..."
                          className="w-64 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-amber-900 mr-0.5">
                          정보 수업 예제:
                        </span>
                        {COLAB_TEMPLATES.map((tpl, tIdx) => (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={() =>
                              updateBlock(block.id, {
                                content: tpl.code,
                                caption: tpl.caption,
                              })
                            }
                            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition cursor-pointer"
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                      {/* 좌측: 교사용 기본 Python 코드 작성창 */}
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-slate-100">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                          <span className="font-bold text-amber-300">
                            ✏️ 학생에게 제공할 기본 Python 코드 (Enter 자동 들여쓰기)
                          </span>
                          <span>numpy · matplotlib 지원</span>
                        </div>
                        <AutoResizeTextarea
                          value={block.content}
                          spellCheck={false}
                          inputRef={(el) => {
                            blockRefs.current[block.id] = el;
                          }}
                          onChange={(val) =>
                            updateBlock(block.id, { content: val })
                          }
                          onKeyDown={(e) =>
                            handleCodeOrMermaidKeyDown(e, block, idx)
                          }
                          placeholder={`# 학생들이 교안에서 바로 [▶ 실행]을 눌러볼 수 있는 Python 코드를 작성하세요\nfor i in range(1, 6):\n    print(f"{i}번째 실행!")`}
                          className="font-mono text-xs sm:text-sm text-amber-200 leading-relaxed placeholder:text-slate-600"
                        />
                      </div>

                      {/* 우측: 학생 화면과 동일한 실시간 Colab 실행 셀 미리보기 */}
                      <div>
                        <div className="text-[11px] font-bold text-amber-900 px-1 mb-1">
                          👁️ 학생 화면 미리보기 (▶ 버튼을 눌러 바로 테스트해보세요)
                        </div>
                        <ColabRunnerBlock
                          key={`${block.id}_${block.content}`}
                          code={block.content}
                          caption={block.caption}
                          externalUrl={block.externalUrl}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 9-2C. 🧊 Web VPython 3.2 (GlowScript 3D 물리·정보 시뮬레이션 블록) */}
                {block.type === 'vpython' && (
                  <div className="my-2 overflow-hidden rounded-2xl border-2 border-cyan-300 bg-cyan-50/20 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-200/80 bg-cyan-50/90 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                        <span className="rounded-md bg-cyan-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white shrink-0">
                          🧊 Web VPython 3D (GlowScript)
                        </span>
                        <input
                          type="text"
                          value={stripLegacyEarthMoonDefaultTitle(block.caption)}
                          onChange={(e) =>
                            updateBlock(block.id, { caption: e.target.value })
                          }
                          placeholder="(선택) 3D 시뮬레이션 제목 입력..."
                          className="flex-1 min-w-[180px] rounded-lg border border-cyan-300 bg-white px-2.5 py-1 text-xs font-bold text-cyan-950 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none"
                        />
                        <input
                          type="url"
                          value={block.externalUrl || ''}
                          onChange={(e) =>
                            updateBlock(block.id, {
                              externalUrl: e.target.value,
                            })
                          }
                          placeholder="(선택) GlowScript / Trinket 공유 URL..."
                          className="w-60 rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-cyan-900 mr-0.5">
                          3D VPython 템플릿:
                        </span>
                        {VPYTHON_TEMPLATES.map((tpl, tIdx) => (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={() =>
                              updateBlock(block.id, {
                                content: tpl.code,
                                caption: tpl.title,
                              })
                            }
                            className="rounded-lg border border-cyan-300 bg-white px-2.5 py-1 text-[11px] font-bold text-cyan-900 hover:bg-cyan-100 transition cursor-pointer"
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                      {/* 좌측: Web VPython 코드 에디터 */}
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-slate-100">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                          <span className="font-bold text-cyan-300">
                            🧊 Web VPython 3.2 파이썬 코드 (sphere, box, arrow, vector, rate)
                          </span>
                          <span>Enter 자동 들여쓰기</span>
                        </div>
                        <AutoResizeTextarea
                          value={stripLegacyEarthMoonDefaultCode(block.content)}
                          spellCheck={false}
                          inputRef={(el) => {
                            blockRefs.current[block.id] = el;
                          }}
                          onChange={(val) =>
                            updateBlock(block.id, { content: val })
                          }
                          onKeyDown={(e) =>
                            handleCodeOrMermaidKeyDown(e, block, idx)
                          }
                          placeholder={`Web VPython 3.2\nsphere(pos=vector(0,0,0), radius=1, color=color.cyan)`}
                          className="font-mono text-xs sm:text-sm text-cyan-200 leading-relaxed placeholder:text-slate-600"
                        />
                      </div>

                      {/* 우측: 실시간 3D WebGL 렌더링 미리보기 */}
                      <div>
                        <div className="text-[11px] font-bold text-cyan-900 px-1 mb-1">
                          👁️ 실시간 3D 시뮬레이션 미리보기 (우클릭 드래그로 회전, 휠로 확대/축소)
                        </div>
                        <VPythonRunnerBlock
                          key={block.id}
                          initialCode={stripLegacyEarthMoonDefaultCode(block.content)}
                          title={stripLegacyEarthMoonDefaultTitle(block.caption)}
                          externalUrl={block.externalUrl}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 9-2D. ⚡ 정보 교과 특화: 피지컬 컴퓨팅 가상 회로 & 코드 시뮬레이터 (마이크로비트·아두이노 Uno·라즈베리파이 피코) */}
                {block.type === 'physical' && (() => {
                  const parsedPhysical = parsePhysicalBlockContent(block.content);
                  const activeBoard = parsedPhysical.config.board;
                  const activeBoardMeta = BOARD_META[activeBoard];
                  const boardTemplates = PHYSICAL_COMPUTING_TEMPLATES.filter(
                    (t) => t.config.board === activeBoard
                  );

                  return (
                    <div className="my-2 overflow-hidden rounded-2xl border-2 border-teal-400 bg-teal-50/20 shadow-sm">
                      {/* 상단 헤더: 보드/제목/외부 링크 & 부품 준비물·배선표 원클릭 생성 */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200/80 bg-teal-50/90 px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                          <span className="rounded-md bg-teal-700 px-2.5 py-0.5 text-[11px] font-extrabold text-white shrink-0">
                            ⚡ 피지컬 컴퓨팅 실습실 (Tinkercad 스타일)
                          </span>
                          <input
                            type="text"
                            value={block.caption || ''}
                            onChange={(e) =>
                              updateBlock(block.id, { caption: e.target.value })
                            }
                            placeholder="(선택) 피지컬 컴퓨팅 실습 제목 입력..."
                            className="flex-1 min-w-[180px] rounded-lg border border-teal-300 bg-white px-2.5 py-1 text-xs font-bold text-teal-950 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none"
                          />
                          <input
                            type="url"
                            value={block.externalUrl || ''}
                            onChange={(e) =>
                              updateBlock(block.id, {
                                externalUrl: e.target.value,
                              })
                            }
                            placeholder="(선택) Tinkercad Circuits / Wokwi / MakeCode 공유 링크..."
                            className="w-64 rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const tableRows = generateWiringTableRows(
                                parsedPhysical.config
                              );
                              insertBlockAfter(idx, {
                                id: createBlockId(),
                                type: 'table',
                                content: '',
                                tableRows,
                                hasTableHeader: true,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-600 px-3 py-1 text-xs font-extrabold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
                            title="현재 회로의 보드와 부품 핀 연결 상태를 표(Table) 블록으로 바로 아래에 자동 생성합니다"
                          >
                            <span>📋 아래에 부품 준비물·핀 배선표 자동 삽입</span>
                          </button>
                        </div>
                      </div>

                      {/* 2단: 마이크로컨트롤러 3종 보드 선택 탭 & 보드별 교과 실습 템플릿 */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200/60 bg-white/90 px-4 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-extrabold text-teal-900 mr-1">
                            🎛️ 실습 보드 선택:
                          </span>
                          {(
                            ['microbit', 'arduino_uno', 'rpi_pico'] as PhysicalBoardType[]
                          ).map((bKey) => {
                            const meta = BOARD_META[bKey];
                            const isSelected = activeBoard === bKey;
                            return (
                              <button
                                key={bKey}
                                type="button"
                                onClick={() => {
                                  const firstTpl = PHYSICAL_COMPUTING_TEMPLATES.find(
                                    (t) => t.config.board === bKey
                                  );
                                  if (firstTpl) {
                                    updateBlock(block.id, {
                                      content: serializePhysicalBlockContent(
                                        firstTpl.config,
                                        firstTpl.code
                                      ),
                                      caption: firstTpl.caption,
                                    });
                                  }
                                }}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-extrabold transition cursor-pointer ${
                                  isSelected
                                    ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-teal-300 hover:bg-teal-50'
                                }`}
                              >
                                <span>{meta.badge}</span>
                                <span>{meta.shortLabel}</span>
                                <span
                                  className={`text-[10px] font-medium ${
                                    isSelected ? 'text-teal-100' : 'text-gray-400'
                                  }`}
                                >
                                  ({meta.languageLabel})
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-teal-900">
                            📚 {activeBoardMeta.shortLabel} 실습 예제:
                          </span>
                          {boardTemplates.map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() =>
                                updateBlock(block.id, {
                                  content: serializePhysicalBlockContent(
                                    tpl.config,
                                    tpl.code
                                  ),
                                  caption: tpl.caption,
                                })
                              }
                              className="rounded-lg border border-teal-300 bg-teal-50/70 px-2.5 py-1 text-[11px] font-bold text-teal-900 hover:bg-teal-100 transition cursor-pointer"
                            >
                              {tpl.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3단: 브레드보드 센서·액추에이터 부품 조립 & 핀(Pin) 배선 설정 빌더 */}
                      <div className="border-b border-teal-200/60 bg-slate-50/90 px-4 py-3 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[11px] font-extrabold text-slate-700 mr-1">
                              🔌 브레드보드 부품 추가:
                            </span>
                            {COMPONENT_CATALOG.map((item) => (
                              <button
                                key={item.type}
                                type="button"
                                onClick={() => {
                                  const nextPin =
                                    activeBoardMeta.availablePins[
                                      parsedPhysical.config.components.length %
                                        activeBoardMeta.availablePins.length
                                    ] || activeBoardMeta.availablePins[0];
                                  const newComp: VirtualComponent = {
                                    id: `${item.type}_${Date.now().toString(36)}`,
                                    type: item.type,
                                    pin: nextPin,
                                    label: item.label,
                                    color: item.type === 'led' ? 'red' : undefined,
                                  };
                                  const nextConfig = {
                                    ...parsedPhysical.config,
                                    components: [
                                      ...parsedPhysical.config.components,
                                      newComp,
                                    ],
                                    wires: undefined,
                                  };
                                  updateBlock(block.id, {
                                    content: serializePhysicalBlockContent(
                                      nextConfig,
                                      parsedPhysical.code
                                    ),
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900 transition cursor-pointer"
                                title={`${item.label} (${item.ioType}) — ${item.wiringNote}`}
                              >
                                <span>{item.icon}</span>
                                <span>+ {item.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 현재 연결된 부품 & 핀 배선 목록 */}
                        {parsedPhysical.config.components.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {parsedPhysical.config.components.map((comp, cIdx) => {
                              const meta = COMPONENT_CATALOG.find(
                                (m) => m.type === comp.type
                              );
                              return (
                                <div
                                  key={comp.id}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-2.5 py-1 text-xs shadow-2xs"
                                >
                                  <span>{meta?.icon || '🔌'}</span>
                                  <input
                                    type="text"
                                    value={comp.label}
                                    onChange={(e) => {
                                      const nextComps = [
                                        ...parsedPhysical.config.components,
                                      ];
                                      nextComps[cIdx] = {
                                        ...comp,
                                        label: e.target.value,
                                      };
                                      updateBlock(block.id, {
                                        content: serializePhysicalBlockContent(
                                          {
                                            ...parsedPhysical.config,
                                            components: nextComps,
                                          },
                                          parsedPhysical.code
                                        ),
                                      });
                                    }}
                                    className="w-24 rounded border border-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-800 focus:border-teal-500 focus:outline-none"
                                  />
                                  <span className="text-[10px] font-bold text-gray-400">
                                    핀:
                                  </span>
                                  <select
                                    value={comp.pin}
                                    onChange={(e) => {
                                      const nextComps = [
                                        ...parsedPhysical.config.components,
                                      ];
                                      nextComps[cIdx] = {
                                        ...comp,
                                        pin: e.target.value,
                                      };
                                      updateBlock(block.id, {
                                        content: serializePhysicalBlockContent(
                                          {
                                            ...parsedPhysical.config,
                                            components: nextComps,
                                            wires: undefined,
                                          },
                                          parsedPhysical.code
                                        ),
                                      });
                                    }}
                                    className="rounded border border-teal-300 bg-teal-50 px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-teal-900 focus:outline-none"
                                  >
                                    {activeBoardMeta.availablePins.map((p) => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                  </select>
                                  {comp.type === 'led' && (
                                    <select
                                      value={comp.color || 'red'}
                                      onChange={(e) => {
                                        const nextComps = [
                                          ...parsedPhysical.config.components,
                                        ];
                                        nextComps[cIdx] = {
                                          ...comp,
                                          color: e.target.value as LedColorOption,
                                        };
                                        updateBlock(block.id, {
                                          content: serializePhysicalBlockContent(
                                            {
                                              ...parsedPhysical.config,
                                              components: nextComps,
                                            },
                                            parsedPhysical.code
                                          ),
                                        });
                                      }}
                                      className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-[10px] font-bold text-gray-700"
                                    >
                                      <option value="red">🔴 빨강</option>
                                      <option value="yellow">🟡 노랑</option>
                                      <option value="green">🟢 초록</option>
                                      <option value="blue">🔵 파랑</option>
                                    </select>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextComps =
                                        parsedPhysical.config.components.filter(
                                          (_, i) => i !== cIdx
                                        );
                                      updateBlock(block.id, {
                                        content: serializePhysicalBlockContent(
                                          {
                                            ...parsedPhysical.config,
                                            components: nextComps,
                                            wires: undefined,
                                          },
                                          parsedPhysical.code
                                        ),
                                      });
                                    }}
                                    className="ml-0.5 text-gray-400 hover:text-rose-600 font-bold cursor-pointer"
                                    title="부품 제거"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 학생 실습 미션 안내문 입력 */}
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[11px] font-extrabold text-amber-800 shrink-0">
                            🎯 학생 실습 미션 안내:
                          </span>
                          <input
                            type="text"
                            value={parsedPhysical.config.missionPrompt || ''}
                            onChange={(e) => {
                              updateBlock(block.id, {
                                content: serializePhysicalBlockContent(
                                  {
                                    ...parsedPhysical.config,
                                    missionPrompt: e.target.value,
                                  },
                                  parsedPhysical.code
                                ),
                              });
                            }}
                            placeholder="예: 초음파 센서 거리 슬라이더를 10cm 이하로 줄였을 때 부저 경보음과 빨간 LED가 동시에 켜지도록 코드를 완성해 보세요!"
                            className="flex-1 rounded-lg border border-amber-300 bg-amber-50/60 px-2.5 py-1 text-xs font-semibold text-amber-950 placeholder:text-amber-700/50 focus:border-amber-500 focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* 4단: 좌측 펌웨어 코드 에디터 + 우측 Tinkercad 스타일 가상 회로 & 실시간 시뮬레이터 미리보기 */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-slate-100">
                          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                            <span className="font-bold text-teal-300">
                              💻 {activeBoardMeta.label} 펌웨어 코드 ({activeBoardMeta.languageLabel})
                            </span>
                            <span>Enter 자동 들여쓰기 · Tab 4칸</span>
                          </div>
                          <AutoResizeTextarea
                            value={parsedPhysical.code}
                            spellCheck={false}
                            inputRef={(el) => {
                              blockRefs.current[block.id] = el;
                            }}
                            onChange={(val) =>
                              updateBlock(block.id, {
                                content: serializePhysicalBlockContent(
                                  parsedPhysical.config,
                                  val
                                ),
                              })
                            }
                            onKeyDown={(e) => {
                              // Physical 블록은 JSON 메타데이터 헤더를 보존한 채 코드 영역만 스마트 들여쓰기 처리
                              if (
                                e.key === 'Enter' &&
                                !e.shiftKey &&
                                !e.ctrlKey &&
                                !e.metaKey
                              ) {
                                e.preventDefault();
                                const target = e.currentTarget;
                                const start = target.selectionStart;
                                const end = target.selectionEnd;
                                const codeVal = parsedPhysical.code;
                                const before = codeVal.slice(0, start);
                                const after = codeVal.slice(end);
                                const currentLine = before.split('\n').pop() || '';
                                const leadingMatch = currentLine.match(/^(\s*)/);
                                let indent = leadingMatch ? leadingMatch[1] : '';
                                const stripped = currentLine
                                  .replace(/(#|\/\/).*$/, '')
                                  .trimEnd();
                                if (
                                  stripped.endsWith(':') ||
                                  stripped.endsWith('{') ||
                                  stripped.endsWith('(')
                                ) {
                                  indent += '    ';
                                }
                                const nextCode = before + '\n' + indent + after;
                                const nextPos = start + 1 + indent.length;
                                updateBlock(block.id, {
                                  content: serializePhysicalBlockContent(
                                    parsedPhysical.config,
                                    nextCode
                                  ),
                                });
                                requestAnimationFrame(() => {
                                  target.focus();
                                  target.setSelectionRange(nextPos, nextPos);
                                });
                                return;
                              }
                              if (e.key === 'Tab') {
                                e.preventDefault();
                                const target = e.currentTarget;
                                const start = target.selectionStart;
                                const end = target.selectionEnd;
                                const codeVal = parsedPhysical.code;
                                const nextCode =
                                  codeVal.slice(0, start) +
                                  '    ' +
                                  codeVal.slice(end);
                                const nextPos = start + 4;
                                updateBlock(block.id, {
                                  content: serializePhysicalBlockContent(
                                    parsedPhysical.config,
                                    nextCode
                                  ),
                                });
                                requestAnimationFrame(() => {
                                  target.focus();
                                  target.setSelectionRange(nextPos, nextPos);
                                });
                              }
                            }}
                            placeholder="마이크로비트(MicroPython), 아두이노 Uno(C/C++), 라즈베리파이 피코(machine) 코드를 작성하세요..."
                            className="font-mono text-xs sm:text-sm text-teal-200 leading-relaxed placeholder:text-slate-600"
                          />
                        </div>

                        <div>
                          <div className="text-[11px] font-bold text-teal-900 px-1 mb-1">
                            👁️ 실시간 가상 보드 & 브레드보드 점퍼선 회로 시뮬레이터 미리보기
                          </div>
                          <PhysicalComputingBlock
                            key={block.id}
                            rawContent={block.content}
                            caption={block.caption}
                            externalUrl={block.externalUrl}
                            compact
                            onChangeContent={(nextRaw) =>
                              updateBlock(block.id, { content: nextRaw })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 9-3. 노션 스타일 표 블록 (Table) */}
                {block.type === 'table' && (() => {
                  const rows =
                    block.tableRows && block.tableRows.length > 0
                      ? block.tableRows
                      : createDefaultTableRows(3, 3);
                  const colCount = Math.max(
                    1,
                    ...rows.map((r) => r.length)
                  );
                  const hasHeader = block.hasTableHeader !== false;
                  const colWidths = block.tableColWidths || [];
                  const rowHeights = block.tableRowHeights || [];
                  const hasCustomDimensions =
                    colWidths.some((w) => w > 0) ||
                    rowHeights.some((h) => h > 0);

                  const updateCell = (
                    rIdx: number,
                    cIdx: number,
                    val: string
                  ) => {
                    const nextRows = rows.map((r, ri) => {
                      const padded = Array.from(
                        { length: colCount },
                        (_, ci) => r[ci] ?? ''
                      );
                      if (ri === rIdx) {
                        padded[cIdx] = val;
                      }
                      return padded;
                    });
                    updateBlock(block.id, { tableRows: nextRows });
                  };

                  const addRow = (afterRowIdx?: number) => {
                    const newRow = Array.from({ length: colCount }, () => '');
                    const nextRows = [...rows];
                    const insertIdx =
                      afterRowIdx !== undefined
                        ? afterRowIdx + 1
                        : nextRows.length;
                    nextRows.splice(insertIdx, 0, newRow);
                    const nextRowHeights =
                      rowHeights.length > 0
                        ? (() => {
                            const copy = Array.from(
                              { length: rows.length },
                              (_, ri) => rowHeights[ri] || 0
                            );
                            copy.splice(insertIdx, 0, 0);
                            return copy;
                          })()
                        : undefined;
                    updateBlock(block.id, {
                      tableRows: nextRows,
                      tableRowHeights: nextRowHeights,
                    });
                    focusTableCell(block.id, insertIdx, 0);
                  };

                  const addColumn = () => {
                    const nextRows = rows.map((r, ri) => {
                      const padded = Array.from(
                        { length: colCount },
                        (_, ci) => r[ci] ?? ''
                      );
                      return [
                        ...padded,
                        ri === 0 && hasHeader ? `항목 ${colCount + 1}` : '',
                      ];
                    });
                    const nextColWidths =
                      colWidths.length > 0
                        ? [
                            ...Array.from(
                              { length: colCount },
                              (_, ci) => colWidths[ci] || 0
                            ),
                            0,
                          ]
                        : undefined;
                    updateBlock(block.id, {
                      tableRows: nextRows,
                      tableColWidths: nextColWidths,
                    });
                    focusTableCell(block.id, 0, colCount);
                  };

                  const deleteRow = (rIdx: number) => {
                    if (rows.length <= 1) return;
                    const nextRows = rows.filter((_, ri) => ri !== rIdx);
                    const nextRowHeights =
                      rowHeights.length > 0
                        ? Array.from(
                            { length: rows.length },
                            (_, ri) => rowHeights[ri] || 0
                          ).filter((_, ri) => ri !== rIdx)
                        : undefined;
                    updateBlock(block.id, {
                      tableRows: nextRows,
                      tableRowHeights: nextRowHeights,
                    });
                  };

                  const deleteColumn = (cIdx: number) => {
                    if (colCount <= 1) return;
                    const nextRows = rows.map((r) =>
                      Array.from(
                        { length: colCount },
                        (_, ci) => r[ci] ?? ''
                      ).filter((_, ci) => ci !== cIdx)
                    );
                    const nextColWidths =
                      colWidths.length > 0
                        ? Array.from(
                            { length: colCount },
                            (_, ci) => colWidths[ci] || 0
                          ).filter((_, ci) => ci !== cIdx)
                        : undefined;
                    updateBlock(block.id, {
                      tableRows: nextRows,
                      tableColWidths: nextColWidths,
                    });
                  };

                  return (
                    <div className="my-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
                      {/* 표 상단 컨트롤 바 */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-slate-50 px-3.5 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                            ⊞ 표 (Table)
                          </span>
                          <span className="text-[11px] font-semibold text-gray-500">
                            {rows.length}행 × {colCount}열
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateBlock(block.id, {
                                hasTableHeader: !hasHeader,
                              })
                            }
                            className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                              hasHeader
                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            {hasHeader ? '✓ 첫 줄 제목 행(Header) 사용 중' : '첫 줄 제목 행 켜기'}
                          </button>
                          {hasCustomDimensions && (
                            <button
                              type="button"
                              onClick={() =>
                                updateBlock(block.id, {
                                  tableColWidths: undefined,
                                  tableRowHeights: undefined,
                                })
                              }
                              title="조절한 표 열 너비와 행 높이를 기본값으로 초기화합니다"
                              className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                            >
                              ↔↕ 열 너비 · 행 높이 초기화
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => addRow()}
                            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition cursor-pointer"
                          >
                            + 아래에 행 추가
                          </button>
                          <button
                            type="button"
                            onClick={addColumn}
                            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition cursor-pointer"
                          >
                            + 오른쪽에 열 추가
                          </button>
                        </div>
                      </div>

                      {/* 표 본문 그리드 */}
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="bg-slate-100/70 border-b border-gray-200">
                              {Array.from({ length: colCount }).map((_, cIdx) => {
                                const cw = colWidths[cIdx];
                                return (
                                  <th
                                    key={cIdx}
                                    style={
                                      cw && cw > 0
                                        ? {
                                            width: `${cw}px`,
                                            minWidth: `${cw}px`,
                                          }
                                        : { minWidth: '120px' }
                                    }
                                    className="relative px-2 py-1 text-center border-r border-gray-200 last:border-r-0 select-none"
                                  >
                                    <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
                                      <span>
                                        {cIdx + 1}열
                                        {cw && cw > 0 ? ` (${cw}px)` : ''}
                                      </span>
                                      {colCount > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => deleteColumn(cIdx)}
                                          title={`${cIdx + 1}열 삭제`}
                                          className="rounded px-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                                        >
                                          열 삭제 ✕
                                        </button>
                                      )}
                                    </div>
                                    {/* 열 너비 조절 드래그 핸들 (우측 경계선) */}
                                    <div
                                      onMouseDown={(e) =>
                                        startTableColResize(
                                          e,
                                          block.id,
                                          cIdx,
                                          colCount
                                        )
                                      }
                                      title="좌우로 드래그하여 이 열의 너비를 조절합니다"
                                      className="group/colresize absolute top-0 right-0 bottom-0 z-10 w-2 cursor-col-resize flex items-center justify-end"
                                    >
                                      <div className="h-full w-0.5 bg-transparent group-hover/colresize:bg-blue-500 transition-colors" />
                                    </div>
                                  </th>
                                );
                              })}
                              <th className="w-14 bg-slate-100/70 px-1 text-center text-[10px] font-semibold text-gray-400">
                                행
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, rIdx) => {
                              const isHeaderRow = hasHeader && rIdx === 0;
                              const rh = rowHeights[rIdx];
                              return (
                                <tr
                                  key={rIdx}
                                  style={
                                    rh && rh > 0
                                      ? { height: `${rh}px` }
                                      : undefined
                                  }
                                  className={
                                    isHeaderRow
                                      ? 'bg-indigo-50/50 border-b-2 border-indigo-100'
                                      : 'border-b border-gray-100 last:border-b-0 hover:bg-slate-50/60'
                                  }
                                >
                                  {Array.from({ length: colCount }).map(
                                    (_, cIdx) => {
                                      const cellVal = row[cIdx] ?? '';
                                      const cw = colWidths[cIdx];
                                      return (
                                        <td
                                          key={cIdx}
                                          style={{
                                            ...(cw && cw > 0
                                              ? {
                                                  width: `${cw}px`,
                                                  minWidth: `${cw}px`,
                                                }
                                              : { minWidth: '120px' }),
                                            ...(rh && rh > 0
                                              ? { height: `${rh}px` }
                                              : {}),
                                          }}
                                          className="relative border-r border-gray-200 last:border-r-0 p-1.5 align-top"
                                        >
                                          <input
                                            ref={(el) => {
                                              tableCellRefs.current[
                                                `${block.id}_${rIdx}_${cIdx}`
                                              ] = el;
                                            }}
                                            type="text"
                                            value={cellVal}
                                            onChange={(e) =>
                                              updateCell(
                                                rIdx,
                                                cIdx,
                                                e.target.value
                                              )
                                            }
                                            onPaste={(e) => {
                                              const pasted =
                                                e.clipboardData.getData(
                                                  'text/plain'
                                                );
                                              // 엑셀/한글 등에서 탭(\t) 구분 표 데이터를 붙여넣은 경우 자동 분할 입력
                                              if (
                                                pasted &&
                                                (pasted.includes('\t') ||
                                                  pasted.includes('\n'))
                                              ) {
                                                e.preventDefault();
                                                const pastedRows = pasted
                                                  .replace(/\r\n/g, '\n')
                                                  .trimEnd()
                                                  .split('\n')
                                                  .map((line) =>
                                                    line.split('\t')
                                                  );
                                                const newRowCount = Math.max(
                                                  rows.length,
                                                  rIdx + pastedRows.length
                                                );
                                                const newColCount = Math.max(
                                                  colCount,
                                                  cIdx +
                                                    Math.max(
                                                      ...pastedRows.map(
                                                        (pr) => pr.length
                                                      )
                                                    )
                                                );
                                                const nextRows = Array.from(
                                                  { length: newRowCount },
                                                  (_, ri) =>
                                                    Array.from(
                                                      { length: newColCount },
                                                      (__, ci) =>
                                                        rows[ri]?.[ci] ?? ''
                                                    )
                                                );
                                                pastedRows.forEach(
                                                  (pRow, pri) => {
                                                    pRow.forEach(
                                                      (pCell, pci) => {
                                                        nextRows[rIdx + pri][
                                                          cIdx + pci
                                                        ] = pCell.replace(/\r/g, '');
                                                      }
                                                    );
                                                  }
                                                );
                                                updateBlock(block.id, {
                                                  tableRows: nextRows,
                                                });
                                              }
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.nativeEvent.isComposing)
                                                return;
                                              // 표 셀 안에서도 Ctrl+B(진하게), Ctrl+E(형광펜), Ctrl+U(밑줄), Ctrl+I(기울임) 단축키 작동
                                              if (
                                                (e.ctrlKey || e.metaKey) &&
                                                !e.altKey
                                              ) {
                                                const key =
                                                  e.key.toLowerCase();
                                                const marker =
                                                  key === 'b'
                                                    ? '**'
                                                    : key === 'e'
                                                    ? '=='
                                                    : key === 'u'
                                                    ? '++'
                                                    : key === 'i'
                                                    ? '*'
                                                    : null;
                                                if (marker) {
                                                  e.preventDefault();
                                                  const inputEl =
                                                    e.currentTarget;
                                                  const s =
                                                    inputEl.selectionStart ??
                                                    cellVal.length;
                                                  const endPos =
                                                    inputEl.selectionEnd ??
                                                    cellVal.length;
                                                  const {
                                                    newValue,
                                                    newStart,
                                                    newEnd,
                                                  } =
                                                    toggleInlineFormatSelection(
                                                      cellVal,
                                                      s,
                                                      endPos,
                                                      marker
                                                    );
                                                  updateCell(
                                                    rIdx,
                                                    cIdx,
                                                    newValue
                                                  );
                                                  requestAnimationFrame(() => {
                                                    inputEl.focus();
                                                    inputEl.setSelectionRange(
                                                      newStart,
                                                      newEnd
                                                    );
                                                  });
                                                  return;
                                                }
                                              }

                                              // Tab / Shift+Tab 으로 셀 간 빠른 이동
                                              if (e.key === 'Tab') {
                                                e.preventDefault();
                                                if (!e.shiftKey) {
                                                  if (cIdx + 1 < colCount) {
                                                    focusTableCell(
                                                      block.id,
                                                      rIdx,
                                                      cIdx + 1
                                                    );
                                                  } else if (
                                                    rIdx + 1 <
                                                    rows.length
                                                  ) {
                                                    focusTableCell(
                                                      block.id,
                                                      rIdx + 1,
                                                      0
                                                    );
                                                  } else {
                                                    addRow(rows.length - 1);
                                                  }
                                                } else {
                                                  if (cIdx - 1 >= 0) {
                                                    focusTableCell(
                                                      block.id,
                                                      rIdx,
                                                      cIdx - 1
                                                    );
                                                  } else if (rIdx - 1 >= 0) {
                                                    focusTableCell(
                                                      block.id,
                                                      rIdx - 1,
                                                      colCount - 1
                                                    );
                                                  }
                                                }
                                                return;
                                              }

                                              // Enter 입력 시 아래 행의 같은 열로 이동 (마지막 행이면 새 행 추가)
                                              if (
                                                e.key === 'Enter' &&
                                                !e.shiftKey
                                              ) {
                                                e.preventDefault();
                                                if (rIdx + 1 < rows.length) {
                                                  focusTableCell(
                                                    block.id,
                                                    rIdx + 1,
                                                    cIdx
                                                  );
                                                } else {
                                                  addRow(rows.length - 1);
                                                }
                                              }
                                            }}
                                            placeholder={
                                              isHeaderRow
                                                ? `제목 ${cIdx + 1}`
                                                : '내용 입력...'
                                            }
                                            className={`w-full rounded px-2 py-1 focus:bg-blue-50/40 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                                              isHeaderRow
                                                ? 'font-extrabold text-indigo-950 placeholder:text-indigo-300'
                                                : 'text-gray-800 placeholder:text-gray-300'
                                            }`}
                                          />
                                          {hasInlineFormatting(cellVal) && (
                                            <div className="mt-0.5 px-2 text-xs text-gray-700 whitespace-pre-wrap">
                                              {renderInlineMarkdown(cellVal)}
                                            </div>
                                          )}

                                          {/* 셀 우측 경계선: 열 너비 조절 드래그 핸들 */}
                                          <div
                                            onMouseDown={(e) =>
                                              startTableColResize(
                                                e,
                                                block.id,
                                                cIdx,
                                                colCount
                                              )
                                            }
                                            title="좌우로 드래그하여 이 열의 너비를 조절합니다"
                                            className="group/colresize absolute top-0 right-0 bottom-0 z-10 w-1.5 cursor-col-resize flex items-center justify-end"
                                          >
                                            <div className="h-full w-0.5 bg-transparent group-hover/colresize:bg-blue-500 transition-colors" />
                                          </div>

                                          {/* 셀 하단 경계선: 행 높이 조절 드래그 핸들 */}
                                          <div
                                            onMouseDown={(e) =>
                                              startTableRowResize(
                                                e,
                                                block.id,
                                                rIdx,
                                                rows.length
                                              )
                                            }
                                            title="상하로 드래그하여 이 행의 높이를 조절합니다"
                                            className="group/rowresize absolute left-0 right-0 bottom-0 z-10 h-1.5 cursor-row-resize flex items-end"
                                          >
                                            <div className="w-full h-0.5 bg-transparent group-hover/rowresize:bg-blue-500 transition-colors" />
                                          </div>
                                        </td>
                                      );
                                    }
                                  )}
                                  <td className="relative w-14 px-1 text-center align-middle select-none">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <span className="text-[10px] font-semibold text-gray-400">
                                        {rIdx + 1}
                                        {rh && rh > 0 ? `(${rh})` : ''}
                                      </span>
                                      {rows.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => deleteRow(rIdx)}
                                          title={`${rIdx + 1}행 삭제`}
                                          className="rounded p-0.5 text-[11px] text-gray-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                    {/* 행 우측 끝 셀에서도 하단 드래그로 행 높이 조절 지원 */}
                                    <div
                                      onMouseDown={(e) =>
                                        startTableRowResize(
                                          e,
                                          block.id,
                                          rIdx,
                                          rows.length
                                        )
                                      }
                                      title="상하로 드래그하여 이 행의 높이를 조절합니다"
                                      className="group/rowresize absolute left-0 right-0 bottom-0 z-10 h-1.5 cursor-row-resize flex items-end"
                                    >
                                      <div className="w-full h-0.5 bg-transparent group-hover/rowresize:bg-blue-500 transition-colors" />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-slate-50/50 px-3.5 py-1.5 text-[11px] text-gray-500">
                        <span>
                          💡 셀의 <strong className="text-blue-700">오른쪽 경계선(↔)</strong>을 드래그해 열 너비를, <strong className="text-blue-700">아래쪽 경계선(↕)</strong>을 드래그해 행 높이를 조절하세요 ·{' '}
                          <kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] border border-gray-200">Tab</kbd> 다음 칸 ·{' '}
                          <kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] border border-gray-200">Enter</kbd> 아래 칸
                        </span>
                        <span>엑셀·한글 표 복사 후 셀에 붙여넣기(Ctrl+V) 지원</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 9-4. 유튜브 영상 임베드 블록 (YouTube) */}
                {block.type === 'youtube' && (() => {
                  const rawUrl = block.externalUrl ?? block.content ?? '';
                  const videoId = extractYouTubeVideoId(rawUrl);

                  return (
                    <div className="my-2 overflow-hidden rounded-2xl border border-red-200 bg-red-50/20 p-4 space-y-3 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-2xs">
                            ▶ 유튜브 영상 (YouTube)
                          </span>
                          <span className="text-xs font-medium text-gray-500">
                            유튜브 주소를 붙여넣으면 교안 안에서 바로 영상을 재생할 수 있습니다
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          ref={(el) => {
                            blockRefs.current[block.id] =
                              el as unknown as HTMLTextAreaElement | null;
                          }}
                          type="url"
                          value={rawUrl}
                          onChange={(e) =>
                            updateBlock(block.id, {
                              externalUrl: e.target.value,
                              content: e.target.value,
                            })
                          }
                          placeholder="https://www.youtube.com/watch?v=... 또는 https://youtu.be/..."
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-red-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={block.caption || ''}
                          onChange={(e) =>
                            updateBlock(block.id, { caption: e.target.value })
                          }
                          placeholder="영상 제목 또는 시청 안내 메모 (선택)"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:border-red-400 focus:outline-none"
                        />
                      </div>

                      {videoId ? (
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-black shadow-xs">
                          <div className="relative aspect-video w-full">
                            <iframe
                              src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                              title={block.caption || 'YouTube video player'}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                              className="h-full w-full border-0"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-red-200 bg-white/80 py-8 text-center">
                          <span className="text-2xl">🎬</span>
                          <p className="mt-1.5 text-xs font-bold text-gray-600">
                            위 입력창에 유튜브 영상 링크(watch, shorts, youtu.be)를 붙여넣으세요
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            입력 즉시 이곳에 재생 가능한 유튜브 플레이어가 표시됩니다
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 9-5. 외부 웹 링크 카드 블록 (Link) */}
                {block.type === 'link' && (() => {
                  const rawUrl = block.externalUrl ?? '';
                  const safeHref = rawUrl ? normalizeExternalUrl(rawUrl) : '';
                  const titleText = block.caption || '';
                  const descText = block.content || '';

                  return (
                    <div className="my-2 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/20 p-4 space-y-3 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-2xs">
                            🔗 웹 링크 카드 (Link)
                          </span>
                          <span className="text-xs font-medium text-gray-500">
                            참고 웹사이트나 학습 자료 링크를 클릭 가능한 카드로 삽입합니다 (글자 안 인라인 링크는 Ctrl+K)
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          ref={(el) => {
                            blockRefs.current[block.id] =
                              el as unknown as HTMLTextAreaElement | null;
                          }}
                          type="url"
                          value={rawUrl}
                          onChange={(e) =>
                            updateBlock(block.id, {
                              externalUrl: e.target.value,
                            })
                          }
                          placeholder="이동할 웹 주소 입력 (예: https://www.ebs.co.kr)"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-blue-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={titleText}
                          onChange={(e) =>
                            updateBlock(block.id, { caption: e.target.value })
                          }
                          placeholder="링크 카드 제목 (예: EBS 학습 자료실 바로가기)"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
                        />
                      </div>

                      <input
                        type="text"
                        value={descText}
                        onChange={(e) =>
                          updateBlock(block.id, { content: e.target.value })
                        }
                        placeholder="링크에 대한 간단한 설명 (선택 사항)"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 focus:border-blue-400 focus:outline-none"
                      />

                      {safeHref && (
                        <a
                          href={safeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/linkpreview flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-2xs hover:border-blue-400 hover:bg-blue-50/40 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-sm font-extrabold text-blue-700 group-hover/linkpreview:underline">
                              <span>🔗</span>
                              <span className="truncate">
                                {titleText || safeHref}
                              </span>
                            </div>
                            {descText && (
                              <p className="mt-0.5 text-xs text-gray-600 line-clamp-1">
                                {descText}
                              </p>
                            )}
                            <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400">
                              {safeHref}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 group-hover/linkpreview:bg-blue-600 group-hover/linkpreview:text-white transition">
                            새 창으로 열기 ↗
                          </span>
                        </a>
                      )}
                    </div>
                  );
                })()}

                {/* 9-2. 교안 인라인 체크포인트 퀴즈 블록 (Quiz) */}
                {block.type === 'quiz' && (() => {
                  const qData: InlineQuizBlockData =
                    block.quizData || createDefaultQuizData('multiple_choice');
                  const qType: QuizQuestionType = qData.questionType || 'multiple_choice';
                  const isGeneratingAi = generatingQuizBlockId === block.id;
                  const aiNotice = quizAiNoticeByBlockId[block.id];

                  const updateQuizData = (patch: Partial<InlineQuizBlockData>) => {
                    const nextData: InlineQuizBlockData = {
                      ...qData,
                      ...patch,
                    };
                    updateBlock(block.id, {
                      content: nextData.questionText,
                      quizData: nextData,
                    });
                  };

                  const handleChangeQuestionType = (nextType: QuizQuestionType) => {
                    if (nextType === qType) return;
                    if (nextType === 'ox') {
                      updateQuizData({
                        questionType: 'ox',
                        options: ['O (맞음)', 'X (틀림)'],
                        correctOptionIndex: qData.correctOptionIndex === 1 ? 1 : 0,
                      });
                    } else if (nextType === 'short_answer') {
                      updateQuizData({
                        questionType: 'short_answer',
                        options: [],
                        correctOptionIndex: 0,
                        answerText: qData.answerText || '',
                      });
                    } else {
                      updateQuizData({
                        questionType: 'multiple_choice',
                        options:
                          qData.options && qData.options.length === 4
                            ? qData.options
                            : ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
                        correctOptionIndex:
                          qData.correctOptionIndex >= 0 && qData.correctOptionIndex < 4
                            ? qData.correctOptionIndex
                            : 0,
                      });
                    }
                  };

                  return (
                    <div className="my-2.5 overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/40 shadow-xs">
                      {/* 상단 헤더 바: 유형 탭 + AI 문항 자동 채우기 */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/70 px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-extrabold text-white shadow-2xs">
                            <span>🎯</span>
                            <span>체크포인트 퀴즈</span>
                          </span>

                          <div className="inline-flex rounded-xl border border-indigo-200 bg-white p-0.5 shadow-2xs">
                            {(
                              [
                                { id: 'multiple_choice', label: '4지선다 객관식' },
                                { id: 'ox', label: 'OX 퀴즈' },
                                { id: 'short_answer', label: '단답형' },
                              ] as const
                            ).map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleChangeQuestionType(tab.id)}
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                                  qType === tab.id
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleGenerateAiQuizForBlock(block, idx, qType)}
                          disabled={isGeneratingAi}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition cursor-pointer"
                          title="이 블록 위쪽에 작성된 교안 본문 내용을 분석하여 AI가 자동으로 문항·보기·해설을 채워줍니다"
                        >
                          <span>✨</span>
                          <span>
                            {isGeneratingAi
                              ? '위 교안 맥락 분석 중...'
                              : '위 교안 내용으로 AI 문항 자동 채우기'}
                          </span>
                        </button>
                      </div>

                      {aiNotice && (
                        <div className="border-b border-indigo-100 bg-violet-50/90 px-4 py-1.5 text-[11px] font-bold text-violet-800 flex items-center justify-between">
                          <span>💡 {aiNotice}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setQuizAiNoticeByBlockId((prev) => ({
                                ...prev,
                                [block.id]: '',
                              }))
                            }
                            className="text-violet-500 hover:text-violet-800 text-xs font-bold cursor-pointer"
                          >
                            닫기
                          </button>
                        </div>
                      )}

                      <div className="p-4 space-y-3.5">
                        {/* 핵심 개념 태그 + 발문 입력 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                          <div className="md:col-span-1">
                            <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                              연계 핵심 개념 (선택)
                            </label>
                            <input
                              type="text"
                              value={qData.targetConcept || ''}
                              onChange={(e) =>
                                updateQuizData({ targetConcept: e.target.value })
                              }
                              placeholder="예: 옴의 법칙, 조건문"
                              className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 focus:border-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                              질문 (발문) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={qData.questionText}
                              onChange={(e) =>
                                updateQuizData({ questionText: e.target.value })
                              }
                              placeholder="방금 읽은 교안 내용을 바탕으로 학생들에게 물어볼 체크포인트 질문을 입력하세요"
                              className="w-full rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-900 focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* 유형별 정답 및 보기 설정 */}
                        {qType === 'multiple_choice' && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-indigo-900">
                                4지선다 보기 입력 (정답 번호를 클릭해 지정하세요)
                              </span>
                              <span className="text-[11px] font-extrabold text-emerald-700">
                                현재 정답: {(qData.correctOptionIndex ?? 0) + 1}번
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(qData.options && qData.options.length === 4
                                ? qData.options
                                : ['선택지 1', '선택지 2', '선택지 3', '선택지 4']
                              ).map((opt, optIdx) => {
                                const isCorrect = (qData.correctOptionIndex ?? 0) === optIdx;
                                return (
                                  <div
                                    key={optIdx}
                                    className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                                      isCorrect
                                        ? 'border-emerald-400 bg-emerald-50/60 shadow-2xs'
                                        : 'border-gray-200 bg-white'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQuizData({ correctOptionIndex: optIdx })
                                      }
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition cursor-pointer ${
                                        isCorrect
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700'
                                      }`}
                                      title="클릭하여 이 보기를 정답으로 지정"
                                    >
                                      {optIdx + 1}
                                    </button>
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => {
                                        const baseOpts =
                                          qData.options && qData.options.length === 4
                                            ? [...qData.options]
                                            : ['선택지 1', '선택지 2', '선택지 3', '선택지 4'];
                                        baseOpts[optIdx] = e.target.value;
                                        updateQuizData({ options: baseOpts });
                                      }}
                                      placeholder={`선택지 ${optIdx + 1}`}
                                      className="w-full bg-transparent text-xs font-semibold text-gray-800 focus:outline-none"
                                    />
                                    {isCorrect && (
                                      <span className="shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                        정답
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {qType === 'ox' && (
                          <div>
                            <span className="block text-[11px] font-bold text-indigo-900 mb-1.5">
                              OX 정답 선택
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { idx: 0, symbol: '⭕ O (맞음)', desc: '진술이 참일 때 정답' },
                                { idx: 1, symbol: '❌ X (틀림)', desc: '진술이 거짓일 때 정답' },
                              ].map((item) => {
                                const isCorrect = (qData.correctOptionIndex ?? 0) === item.idx;
                                return (
                                  <button
                                    key={item.idx}
                                    type="button"
                                    onClick={() =>
                                      updateQuizData({
                                        options: ['O (맞음)', 'X (틀림)'],
                                        correctOptionIndex: item.idx,
                                      })
                                    }
                                    className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition cursor-pointer ${
                                      isCorrect
                                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 shadow-2xs'
                                        : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-200'
                                    }`}
                                  >
                                    <div>
                                      <div className="text-sm font-extrabold">{item.symbol}</div>
                                      <div className="text-[11px] text-gray-500">{item.desc}</div>
                                    </div>
                                    {isCorrect && (
                                      <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                                        정답 지정됨
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {qType === 'short_answer' && (
                          <div>
                            <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                              단답형 모범 정답 (복수 허용 정답은 쉼표 <code className="bg-indigo-100 px-1 rounded">,</code> 로 구분)
                            </label>
                            <input
                              type="text"
                              value={qData.answerText || ''}
                              onChange={(e) =>
                                updateQuizData({ answerText: e.target.value })
                              }
                              placeholder="예: 옴의 법칙, Ohm의 법칙 (공백/대소문자 무시하고 자동 채점됩니다)"
                              className="w-full rounded-xl border border-emerald-300 bg-emerald-50/40 px-3.5 py-2 text-xs font-extrabold text-emerald-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                            />
                          </div>
                        )}

                        {/* 해설 및 힌트 */}
                        <div>
                          <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                            정답 해설 및 오개념 교정 피드백 (학생 채점 직후 즉시 노출)
                          </label>
                          <textarea
                            rows={2}
                            value={qData.explanation}
                            onChange={(e) =>
                              updateQuizData({ explanation: e.target.value })
                            }
                            placeholder="학생이 문제를 푼 직후 확인하게 될 해설이나 오답 포인트를 적어주세요"
                            className="w-full rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-800 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-indigo-100 bg-indigo-50/40 px-4 py-1.5 text-[11px] text-indigo-900/70">
                        <span>
                          💡 학생 화면에서는 교안 중간에 즉시 풀어볼 수 있는 인터랙티브 카드로 표시되며, 오답 시 <strong>[🙋 이 개념 바로 질문하기]</strong>가 연결됩니다.
                        </span>
                        <span className="font-mono text-[10px] text-indigo-400">
                          ID: {qData.quizId}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* 10. 구분선 블록 (Divider) */}
                {block.type === 'divider' && (
                  <div className="py-3">
                    <hr className="border-gray-200" />
                  </div>
                )}

                {/* 11. 노션 스타일 이미지 블록 (단일 및 가로 다중 배치 지원) */}
                {block.type === 'image' && (() => {
                  const imgs = getBlockImages(block);
                  const prevBlock = idx > 0 ? blocks[idx - 1] : null;
                  const canMergeWithPrevImage =
                    prevBlock &&
                    prevBlock.type === 'image' &&
                    getBlockImages(prevBlock).length > 0 &&
                    imgs.length > 0;

                  const syncBlockImages = (nextImgs: NotionImageItem[]) => {
                    const first = nextImgs[0];
                    updateBlock(block.id, {
                      images: nextImgs,
                      imageUrl: first ? first.url : '',
                      caption: first ? first.caption || '' : '',
                    });
                  };

                  return (
                    <div
                      className="my-2"
                      onDragOver={(e) => {
                        if (e.dataTransfer.types.includes('Files')) {
                          e.preventDefault();
                        }
                      }}
                      onDrop={async (e) => {
                        if (
                          e.dataTransfer.files &&
                          e.dataTransfer.files.length > 0
                        ) {
                          const hasImg = Array.from(
                            e.dataTransfer.files
                          ).some((f) => f.type.startsWith('image/'));
                          if (hasImg) {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingFileOverPage(false);
                            setUploadingImageBlockId(block.id);
                            await handleImageFilesDrop(
                              e.dataTransfer.files,
                              undefined,
                              block.id,
                              imgs.length > 0 ? 'append' : 'replace'
                            );
                            setUploadingImageBlockId(null);
                          }
                        }
                      }}
                    >
                      {imgs.length > 0 ? (
                        <div
                          className={`rounded-2xl border border-gray-200 bg-slate-50/50 ${
                            isMultiColumnRow ? 'space-y-1.5 p-2' : 'space-y-3 p-3.5'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-gray-200/70">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[11px] font-bold text-gray-700">
                                🖼️ 교안 이미지{' '}
                                {imgs.length > 1
                                  ? `(가로 ${imgs.length}장)`
                                  : '(1장)'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  targetImageBlockIdRef.current = block.id;
                                  imageUploadModeRef.current = 'append';
                                  imageInputRef.current?.click();
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-0.5 text-[11px] font-extrabold text-white hover:bg-blue-700 transition cursor-pointer shadow-2xs"
                              >
                                <span>
                                  {isMultiColumnRow ? '➕ 사진추가' : '➕ 옆에 사진 추가'}
                                </span>
                              </button>
                              {!isMultiColumnRow && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addSideBySideBlock(idx, 'p', 'right')
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                                    title="이 사진 바로 오른쪽 열에 설명글 블록을 나란히 배치합니다"
                                  >
                                    📝 옆에 설명글 배치
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addSideBySideBlock(idx, 'code', 'right')
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                                    title="이 사진 바로 오른쪽 열에 코드블록을 나란히 배치합니다"
                                  >
                                    💻 옆에 코드 배치
                                  </button>
                                </>
                              )}

                              {!isMultiColumnRow &&
                                idx > 0 &&
                                (!block.rowId ||
                                  blocks[idx - 1]?.rowId !== block.rowId) && (
                                  <button
                                    type="button"
                                    onClick={() => joinBlockWithPrevRow(idx)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700 hover:bg-violet-100 transition cursor-pointer"
                                    title="바로 위에 있는 블록(글·코드·사진 등)의 오른쪽 열로 이 사진을 나란히 합칩니다"
                                  >
                                    ⬆️ 위 블록 옆으로 나란히 합치기
                                  </button>
                                )}

                              {canMergeWithPrevImage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!prevBlock) return;
                                    const prevImgs = getBlockImages(prevBlock);
                                    const merged = [...prevImgs, ...imgs];
                                    const nextBlocks = blocks
                                      .map((b) =>
                                        b.id === prevBlock.id
                                          ? {
                                              ...b,
                                              images: merged,
                                              imageUrl: merged[0]?.url || '',
                                              caption:
                                                merged[0]?.caption ||
                                                b.caption ||
                                                '',
                                            }
                                          : b
                                      )
                                      .filter((b) => b.id !== block.id);
                                    onChange(cleanupOrphanRowIds(nextBlocks));
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                                  title="같은 이미지 그리드 카드 안에 사진을 합칩니다"
                                >
                                  🖼️ 위 사진 카드에 병합
                                </button>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                              {(
                                [
                                  {
                                    key: 'sm',
                                    label:
                                      imgs.length > 1
                                        ? '작게 (모아보기)'
                                        : isMultiColumnRow
                                        ? '50%'
                                        : '작게 (50%)',
                                  },
                                  {
                                    key: 'md',
                                    label:
                                      imgs.length > 1
                                        ? '기본 크기'
                                        : isMultiColumnRow
                                        ? '75%'
                                        : '기본 (75%)',
                                  },
                                  {
                                    key: 'full',
                                    label: isMultiColumnRow ? '100%' : '가득 (100%)',
                                  },
                                ] as { key: ImageSizeOption; label: string }[]
                              ).map((sz) => {
                                const effectiveImageSize: ImageSizeOption =
                                  block.rowId || block.widthPercent
                                    ? block.imageSize === 'sm'
                                      ? 'sm'
                                      : 'full'
                                    : block.imageSize || 'md';
                                return (
                                  <button
                                    key={sz.key}
                                    type="button"
                                    onClick={() =>
                                      updateBlock(block.id, { imageSize: sz.key })
                                    }
                                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                                      effectiveImageSize === sz.key
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                                  >
                                    {sz.label}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => {
                                  targetImageBlockIdRef.current = block.id;
                                  imageUploadModeRef.current = 'replace';
                                  imageInputRef.current?.click();
                                }}
                                className="ml-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                              >
                                {isMultiColumnRow ? '교체' : '전체 교체'}
                              </button>
                            </div>
                          </div>

                          {/* 단일 이미지 vs 다중 이미지 가로 그리드 (학생 화면 뷰어와 동일한 폭/높이 비율 보장) */}
                          {imgs.length === 1 ? (
                            <div className="space-y-1.5">
                              <div className="flex flex-col items-center">
                                <div
                                  className={`overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-xs ${
                                    block.imageSize === 'sm'
                                      ? 'w-full max-w-[50%]'
                                      : block.rowId || block.widthPercent
                                      ? 'w-full'
                                      : block.imageSize === 'full'
                                      ? 'w-full'
                                      : 'w-full max-w-[75%]'
                                  }`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imgs[0].url}
                                    alt={imgs[0].caption || '교안 이미지'}
                                    className="w-full h-auto object-contain max-h-[520px]"
                                  />
                                </div>
                              </div>
                              <input
                                type="text"
                                value={imgs[0].caption || ''}
                                onChange={(e) =>
                                  syncBlockImages([
                                    { ...imgs[0], caption: e.target.value },
                                  ])
                                }
                                placeholder="사진 아래에 들어갈 설명(캡션)을 입력하세요..."
                                className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-center text-xs text-gray-600 placeholder:text-gray-400 focus:border-gray-200 focus:bg-white focus:outline-none"
                              />
                            </div>
                          ) : (
                            <div
                              className={`mx-auto grid gap-3 items-start ${
                                imgs.length === 2
                                  ? 'grid-cols-1 sm:grid-cols-2'
                                  : imgs.length === 3
                                  ? 'grid-cols-1 sm:grid-cols-3'
                                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                              } ${
                                block.imageSize === 'sm'
                                  ? 'w-full max-w-2xl'
                                  : block.imageSize === 'full' ||
                                    block.rowId ||
                                    block.widthPercent
                                  ? 'w-full'
                                  : 'w-full max-w-5xl'
                              }`}
                            >
                              {imgs.map((imgItem, imgIdx) => (
                                <div
                                  key={imgIdx}
                                  className="group/imgcard relative flex flex-col rounded-xl border border-gray-200 bg-white p-2 shadow-2xs"
                                >
                                  <div className="mb-1.5 flex items-center justify-between text-[10px] text-gray-400">
                                    <span className="font-bold text-gray-500">
                                      #{imgIdx + 1}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={imgIdx === 0}
                                        onClick={() => {
                                          const next = [...imgs];
                                          const [moved] = next.splice(
                                            imgIdx,
                                            1
                                          );
                                          next.splice(imgIdx - 1, 0, moved);
                                          syncBlockImages(next);
                                        }}
                                        title="왼쪽으로 순서 이동"
                                        className="rounded px-1 py-0.5 hover:bg-gray-100 text-gray-600 disabled:opacity-25 cursor-pointer"
                                      >
                                        ◀
                                      </button>
                                      <button
                                        type="button"
                                        disabled={imgIdx === imgs.length - 1}
                                        onClick={() => {
                                          const next = [...imgs];
                                          const [moved] = next.splice(
                                            imgIdx,
                                            1
                                          );
                                          next.splice(imgIdx + 1, 0, moved);
                                          syncBlockImages(next);
                                        }}
                                        title="오른쪽으로 순서 이동"
                                        className="rounded px-1 py-0.5 hover:bg-gray-100 text-gray-600 disabled:opacity-25 cursor-pointer"
                                      >
                                        ▶
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = imgs.filter(
                                            (_, i) => i !== imgIdx
                                          );
                                          syncBlockImages(next);
                                        }}
                                        title="이 사진만 삭제"
                                        className="rounded px-1 py-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={imgItem.url}
                                      alt={
                                        imgItem.caption ||
                                        `교안 이미지 ${imgIdx + 1}`
                                      }
                                      className="max-h-96 w-full h-auto object-contain"
                                    />
                                  </div>

                                  <input
                                    type="text"
                                    value={imgItem.caption || ''}
                                    onChange={(e) => {
                                      const next = imgs.map((it, i) =>
                                        i === imgIdx
                                          ? { ...it, caption: e.target.value }
                                          : it
                                      );
                                      syncBlockImages(next);
                                    }}
                                    placeholder={`사진 ${imgIdx + 1} 설명(캡션)...`}
                                    className="mt-1.5 w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-center text-xs text-gray-600 placeholder:text-gray-400 focus:border-gray-200 focus:bg-slate-50 focus:outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {!isMultiColumnRow && (
                            <div className="text-center text-[11px] text-gray-400">
                              💡 이 박스 위로 다른 사진 파일을 드래그해서 놓거나{' '}
                              <strong className="text-blue-600">
                                [+ 옆에 사진 추가]
                              </strong>
                              를 누르면 가로로 나란히 배치됩니다
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingFileOverPage(false);
                            if (
                              e.dataTransfer.files &&
                              e.dataTransfer.files.length > 0
                            ) {
                              setUploadingImageBlockId(block.id);
                              await handleImageFilesDrop(
                                e.dataTransfer.files,
                                undefined,
                                block.id,
                                'replace'
                              );
                              setUploadingImageBlockId(null);
                            }
                          }}
                          onClick={() => {
                            targetImageBlockIdRef.current = block.id;
                            imageUploadModeRef.current = 'replace';
                            imageInputRef.current?.click();
                          }}
                          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 py-8 px-4 text-center transition hover:border-blue-400 hover:bg-blue-50/60"
                        >
                          <div className="text-3xl mb-1.5">🖼️</div>
                          <p className="text-xs font-bold text-blue-900">
                            {uploadingImageBlockId === block.id
                              ? '사진 최적화 및 삽입 중...'
                              : '이곳에 사진 파일(1장 또는 여러 장)을 드래그해서 놓거나 클릭하여 업로드하세요'}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            여러 장을 한꺼번에 선택/드롭하면 자동으로 가로로 나란히 배치됩니다 · 클립보드 붙여넣기(Ctrl+V) 가능
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 노션 슬래시(/) 또는 [+] 블록 선택 팝업 메뉴 (키보드 화살표 & 엔터 선택 지원) */}
                {isSlashOpen && (
                  <div className="mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl z-30">
                    <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-gray-400 border-b border-gray-100 mb-1">
                      <span>
                        노션 블록 선택{' '}
                        {slashFilterQuery && (
                          <span className="text-blue-600">
                            (&quot;/{slashFilterQuery}&quot; 검색 중)
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSlashMenuBlockId(null);
                          setSlashFilterQuery('');
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto space-y-0.5">
                      {filteredSlashItems.length > 0 ? (
                        filteredSlashItems.map((item, itemIdx) => {
                          const isHighlighted = itemIdx === slashSelectedIdx;
                          return (
                            <button
                              key={item.type}
                              type="button"
                              onClick={() =>
                                applyBlockTypeSelection(block, item.type)
                              }
                              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                                isHighlighted
                                  ? 'bg-blue-50 ring-1 ring-blue-200'
                                  : 'hover:bg-blue-50/60'
                              }`}
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-xs font-extrabold text-blue-700 shadow-2xs">
                                {item.badge}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-gray-900">
                                  {item.label}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {item.desc}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="py-4 text-center text-xs text-gray-400">
                          일치하는 블록이 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 우측 상단 플로팅 블록 빠른 액션 (좌측 + 및 ⋮⋮ 핸들 영역을 절대 침범하지 않도록 우측 영역에만 배치) */}
              <div className="absolute -top-3.5 right-2 left-14 z-20 flex pointer-events-none justify-end">
                <div className="flex flex-wrap items-center justify-end gap-1 rounded-xl border border-gray-200/90 bg-white/95 px-1.5 py-0.5 shadow-md backdrop-blur-xs opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition">
                  <button
                    type="button"
                    onClick={() => triggerSideBySideImageUpload(idx, 'right')}
                    title="이 블록 바로 오른쪽 옆에 사진을 나란히 넣습니다 (글·코드·수식 등 모든 블록 옆 가능)"
                    className="rounded-lg border border-indigo-200 bg-indigo-50/90 px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                  >
                    {isMultiColumnRow ? '🖼️옆사진' : '🖼️ 옆에 사진'}
                  </button>
                  <button
                    type="button"
                    onClick={() => addSideBySideBlock(idx, 'p', 'right')}
                    title="이 블록 바로 오른쪽 옆에 새 블록(글·코드 등)을 나란히 추가합니다"
                    className="rounded-lg border border-indigo-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                  >
                    {isMultiColumnRow ? '➕옆블록' : '➕ 옆에 블록'}
                  </button>
                  {!isMultiColumnRow && (
                    <button
                      type="button"
                      onClick={() => addSideBySideStackedBlocks(idx, 'right')}
                      title="이 블록 바로 오른쪽 옆에 위·아래 2칸으로 나뉜 블록을 만들어 전체 직사각형을 3분할 구조로 조립합니다"
                      className="rounded-lg border border-violet-200 bg-violet-50/90 px-1.5 py-0.5 text-[10px] font-extrabold text-violet-700 hover:bg-violet-100 cursor-pointer"
                    >
                      🍱 옆에 상하2칸
                    </button>
                  )}

                  {idx > 0 &&
                    (!block.rowId ||
                      blocks[idx - 1]?.rowId !== block.rowId) && (
                      <button
                        type="button"
                        onClick={() => joinBlockWithPrevRow(idx)}
                        title="이 블록을 바로 위 블록의 오른쪽 옆 열로 합쳐서 나란히 배치합니다"
                        className="rounded-lg border border-violet-200 bg-violet-50/80 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 hover:bg-violet-100 cursor-pointer"
                      >
                        ⬆️ 위 옆으로
                      </button>
                    )}

                  {isMultiColumnRow ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          addStackedBlockInColumn(idx, 'p', 'bottom')
                        }
                        title="이 열의 바로 아래쪽에 상하 분할 블록을 추가합니다 (옆의 긴 블록 안에서 위·아래로 나뉨)"
                        className="rounded-lg border border-violet-200 bg-violet-50/90 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 hover:bg-violet-100 cursor-pointer"
                      >
                        ⬇️아래분할
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          triggerStackedImageUpload(idx, 'bottom')
                        }
                        title="이 열의 바로 아래쪽에 사진을 상하 분할로 추가합니다"
                        className="rounded-lg border border-violet-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-violet-700 hover:bg-violet-50 cursor-pointer"
                      >
                        🖼️아래사진
                      </button>
                      {isMultiStackCol && (
                        <>
                          <button
                            type="button"
                            disabled={stackIdx === 0}
                            onClick={() => moveBlockWithinColumnStack(idx, -1)}
                            title="현재 열 안에서 위쪽 분할 블록과 순서 바꾸기"
                            className="rounded border border-violet-200 bg-white px-1 py-0.5 text-[10px] font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-25 cursor-pointer"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={stackIdx === colGroup.items.length - 1}
                            onClick={() => moveBlockWithinColumnStack(idx, 1)}
                            title="현재 열 안에서 아래쪽 분할 블록과 순서 바꾸기"
                            className="rounded border border-violet-200 bg-white px-1 py-0.5 text-[10px] font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-25 cursor-pointer"
                          >
                            ▼
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={colIdx === 0}
                        onClick={() => moveColumnWithinRow(idx, -1)}
                        title="현재 행 안에서 왼쪽 열과 순서 바꾸기"
                        className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-25 cursor-pointer"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        disabled={colIdx === rowGroup.columns.length - 1}
                        onClick={() => moveColumnWithinRow(idx, 1)}
                        title="현재 행 안에서 오른쪽 열과 순서 바꾸기"
                        className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-25 cursor-pointer"
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        onClick={() => detachBlockFromRow(idx)}
                        title="가로 다단 행에서 이 블록을 분리해 아래쪽 독립 줄로 내립니다"
                        className="rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
                      >
                        ⤵️분리
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const cur = customStandaloneWidth ?? 100;
                        const nextW =
                          cur === 100 ? 50 : cur <= 55 ? 75 : undefined;
                        updateBlock(block.id, {
                          widthPercent: nextW,
                          imageSize:
                            block.type === 'image' ? 'full' : block.imageSize,
                        });
                      }}
                      title="블록 가로 폭 빠르게 전환 (50% → 75% → 100%) 또는 우측 끝 핸들(↔)을 드래그해 자유 조절"
                      className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                        customStandaloneWidth
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      ↔ {customStandaloneWidth ?? 100}%
                    </button>
                  )}

                  <select
                    value={block.type}
                    onChange={(e) => {
                      const nextType = e.target.value as NotionBlockType;
                      applyBlockTypeSelection(block, nextType);
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 focus:outline-none cursor-pointer"
                  >
                    <option value="p">본문</option>
                    <option value="h1">제목 1</option>
                    <option value="h2">제목 2</option>
                    <option value="h3">제목 3</option>
                    <option value="bullet">목록</option>
                    <option value="callout">콜아웃</option>
                    <option value="quote">인용/지문</option>
                    <option value="table">표 (Table)</option>
                    <option value="code">코드블록</option>
                    <option value="colab">파이썬 실행 셀(Colab)</option>
                    <option value="vpython">Web VPython 3D</option>
                    <option value="mermaid">순서도(Mermaid)</option>
                    <option value="simulation">시뮬레이션(HTML/JS)</option>
                    <option value="quiz">체크포인트 퀴즈(/퀴즈)</option>
                    <option value="image">사진</option>
                    <option value="youtube">유튜브 영상</option>
                    <option value="link">링크 카드</option>
                    <option value="divider">구분선</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => moveBlock(idx, -1)}
                    disabled={idx === 0}
                    title="위로 이동"
                    className="rounded p-1 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-20"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, 1)}
                    disabled={idx === blocks.length - 1}
                    title="아래로 이동"
                    className="rounded p-1 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-20"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(idx)}
                    title="블록 삭제"
                    className="rounded p-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 단독 블록 우측 가장자리 가로 폭 드래그 리사이즈 핸들 (25%~100% 자유 조절) */}
              {!isMultiColumnRow && (
                <div
                  onMouseDown={(e) =>
                    startSingleBlockWidthResize(
                      e,
                      block.id,
                      block.widthPercent
                    )
                  }
                  title="마우스로 잡고 좌우로 드래그하여 이 블록의 가로 폭(25%~100%)을 자유롭게 늘리거나 줄이세요"
                  className={`group/widthhandle absolute top-1 bottom-1 right-0 z-20 hidden md:flex w-2.5 cursor-ew-resize items-center justify-center rounded-r-xl transition select-none ${
                    customStandaloneWidth ||
                    resizingInfo?.activeId === block.id
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <div
                    className={`h-8 w-1 rounded-full transition-colors ${
                      resizingInfo?.activeId === block.id
                        ? 'bg-indigo-600'
                        : customStandaloneWidth
                        ? 'bg-indigo-400 group-hover/widthhandle:bg-indigo-600'
                        : 'bg-gray-300 group-hover/widthhandle:bg-indigo-500'
                    }`}
                  />
                </div>
              )}
                              </div>

                              {/* 열 내부 상하 분할 블록 사이의 세로 높이 비율 드래그 리사이즈 핸들 (↕) */}
                              {isMultiStackCol &&
                                stackIdx < colGroup.items.length - 1 &&
                                rowGroup.rowId && (
                                  <div
                                    onMouseDown={(e) =>
                                      startStackSplitResize(
                                        e,
                                        rowGroup.rowId!,
                                        colGroup.colId,
                                        block.id,
                                        colGroup.items[stackIdx + 1].block.id
                                      )
                                    }
                                    onDoubleClick={() => {
                                      const equalH = Number(
                                        (100 / colGroup.items.length).toFixed(1)
                                      );
                                      const targetColIds = new Set(
                                        colGroup.items.map(
                                          (item) => item.block.id
                                        )
                                      );
                                      onChange(
                                        blocks.map((b) =>
                                          targetColIds.has(b.id)
                                            ? {
                                                ...b,
                                                stackHeightPercent: equalH,
                                              }
                                            : b
                                        )
                                      );
                                    }}
                                    title="마우스로 잡고 위아래로 드래그하여 상하 블록의 세로 높이 비율을 자유롭게 조절하세요 (더블클릭: 균등 비율 초기화)"
                                    className="group/vsplitter relative flex h-4 w-full shrink-0 cursor-row-resize items-center justify-center select-none z-20 my-0.5"
                                  >
                                    <div className="w-full h-[3px] rounded-full bg-violet-200/80 group-hover/vsplitter:bg-violet-600 group-active/vsplitter:bg-violet-700 transition-colors" />
                                    <div className="absolute left-1/2 -translate-x-1/2 flex h-4 px-2 items-center justify-center gap-1 rounded-md border border-violet-200 bg-white text-[10px] font-bold text-violet-700 shadow-xs group-hover/vsplitter:border-violet-500 group-hover/vsplitter:bg-violet-600 group-hover/vsplitter:text-white transition">
                                      <span>↕</span>
                                      <span>
                                        {Math.round(stackHeightPct)}% :{' '}
                                        {Math.round(
                                          stackHeights[stackIdx + 1] ?? 50
                                        )}
                                        %
                                      </span>
                                    </div>
                                  </div>
                                )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 다단(가로 배치) 행 내부 열 사이의 드래그 분할 리사이즈 핸들 */}
                      {isMultiColumnRow &&
                        colIdx < rowGroup.columns.length - 1 &&
                        rowGroup.rowId && (
                          <div
                            onMouseDown={(e) =>
                              startColumnSplitResize(
                                e,
                                rowGroup.rowId!,
                                colGroup.colId,
                                rowGroup.columns[colIdx + 1].colId
                              )
                            }
                            title="마우스로 잡고 좌우로 드래그하여 좌우 열의 가로 폭 비율을 조절하세요"
                            className="group/splitter relative hidden md:flex w-4 shrink-0 cursor-col-resize items-center justify-center select-none z-20"
                          >
                            <div className="h-full w-[3px] rounded-full bg-indigo-200/80 group-hover/splitter:bg-indigo-600 group-active/splitter:bg-indigo-700 transition-colors" />
                            <div className="absolute top-1/2 -translate-y-1/2 flex h-7 w-4 items-center justify-center rounded-md border border-indigo-200 bg-white text-[10px] font-bold text-indigo-600 shadow-xs group-hover/splitter:border-indigo-500 group-hover/splitter:bg-indigo-600 group-hover/splitter:text-white transition">
                              ⋮
                            </div>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 빈 영역 클릭 시 새 블록 추가 */}
      <div
        onClick={() => {
          const last = blocks[blocks.length - 1];
          if (last && last.type === 'p' && !last.content.trim()) {
            focusBlock(last.id);
          } else {
            insertBlockAfter(blocks.length - 1, {
              id: createBlockId(),
              type: 'p',
              content: '',
            });
          }
        }}
        className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-400 hover:border-blue-300 hover:bg-blue-50/20 hover:text-blue-600 cursor-text transition"
      >
        <span>
          + 여기를 클릭해 새 단락을 작성하거나, <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">/표</kbd> (테이블), <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">/code</kbd> (파이썬 코드), <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">/mermaid</kbd> (순서도)를 입력해 보세요
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            targetImageBlockIdRef.current = null;
            imageUploadModeRef.current = 'replace';
            imageInputRef.current?.click();
          }}
          className="rounded-lg bg-white border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 shadow-2xs cursor-pointer"
        >
          🖼️ 컴퓨터에서 사진 선택 (여러 장 가로 배치 가능)
        </button>
      </div>
    </div>
  );

  function handleBlockKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    block: NotionBlock,
    idx: number
  ) {
    // 0. 노션 스타일 인라인 서식 단축키:
    // - Ctrl+B (또는 Cmd+B): **진하게** 토글
    // - Ctrl+E (또는 Cmd+E): ==형광펜== 토글
    // - Ctrl+U (또는 Cmd+U): ++밑줄++ 토글
    // - Ctrl+I (또는 Cmd+I): *기울임* 토글
    // - Ctrl+K (또는 Cmd+K): [표시 텍스트](https://) 인라인 링크 삽입
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.nativeEvent.isComposing) {
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        const el = e.currentTarget;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const selected = block.content.slice(start, end);
        const labelText = selected || '링크 텍스트';
        const defaultUrl = 'https://';
        const inserted = `[${labelText}](${defaultUrl})`;
        const newValue =
          block.content.slice(0, start) + inserted + block.content.slice(end);
        const urlSelectStart = start + labelText.length + 3;
        const urlSelectEnd = urlSelectStart + defaultUrl.length;

        updateBlock(block.id, { content: newValue });
        requestAnimationFrame(() => {
          const targetEl = blockRefs.current[block.id];
          if (targetEl) {
            targetEl.focus();
            targetEl.setSelectionRange(urlSelectStart, urlSelectEnd);
          }
        });
        return;
      }

      const marker =
        key === 'b'
          ? '**'
          : key === 'e'
          ? '=='
          : key === 'u'
          ? '++'
          : key === 'i'
          ? '*'
          : null;

      if (marker) {
        e.preventDefault();
        const el = e.currentTarget;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const { newValue, newStart, newEnd } = toggleInlineFormatSelection(
          block.content,
          start,
          end,
          marker
        );
        updateBlock(block.id, { content: newValue });
        requestAnimationFrame(() => {
          const targetEl = blockRefs.current[block.id];
          if (targetEl) {
            targetEl.focus();
            targetEl.setSelectionRange(newStart, newEnd);
          }
        });
        return;
      }
    }

    // 슬래시 메뉴가 열려 있을 때 방향키/엔터로 바로 블록 선택
    if (slashMenuBlockId === block.id) {
      const items = getFilteredSlashItems();
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuBlockId(null);
        setSlashFilterQuery('');
        return;
      }
      if (e.key === 'ArrowDown' && items.length > 0) {
        e.preventDefault();
        setSlashSelectedIdx((prev) => (prev + 1) % items.length);
        return;
      }
      if (e.key === 'ArrowUp' && items.length > 0) {
        e.preventDefault();
        setSlashSelectedIdx((prev) => (prev - 1 + items.length) % items.length);
        return;
      }
      if (e.key === 'Enter' && !e.nativeEvent.isComposing && items.length > 0) {
        e.preventDefault();
        const chosen = items[slashSelectedIdx] || items[0];
        applyBlockTypeSelection(block, chosen.type);
        return;
      }
    }

    // 다단(사진·코드 옆 가로 배치) 행 내부의 텍스트 블록(p, callout, quote)에서는
    // 일반 Enter 입력 시 열 내부 줄바꿈을 유지하여 사진 옆에 여러 줄 설명을 자연스럽게 이어 쓸 수 있도록 지원!
    // (Shift+Enter를 누르면 다단 행 아래에 새 독립 줄 생성)
    if (
      block.rowId &&
      (block.type === 'p' ||
        block.type === 'callout' ||
        block.type === 'quote') &&
      e.key === 'Enter' &&
      !e.nativeEvent.isComposing
    ) {
      if (e.shiftKey) {
        e.preventDefault();
        setSlashMenuBlockId(null);
        insertBlockAfter(idx, {
          id: createBlockId(),
          type: 'p',
          content: '',
        });
      }
      return;
    }

    // Shift+Enter는 줄바꿈 허용, 그냥 Enter는 다음 블록 생성 (노션 방식)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      setSlashMenuBlockId(null);

      // 빈 글머리 기호에서 Enter를 치면 일반 본문(p)으로 변환
      if (block.type === 'bullet' && !block.content.trim()) {
        updateBlock(block.id, { type: 'p' });
        return;
      }

      const nextType: NotionBlockType =
        block.type === 'bullet' ? 'bullet' : 'p';
      insertBlockAfter(idx, {
        id: createBlockId(),
        type: nextType,
        content: '',
      });
      return;
    }

    // 빈 블록에서 Backspace를 치면 이전 블록으로 포커스 이동 및 현재 블록 제거
    if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      setSlashMenuBlockId(null);
      if (block.type !== 'p') {
        updateBlock(block.id, { type: 'p' });
      } else {
        removeBlock(idx);
      }
      return;
    }

    // 위/아래 방향키로 블록 간 이동
    if (e.key === 'ArrowUp' && idx > 0) {
      const el = e.currentTarget;
      if (el.selectionStart === 0) {
        e.preventDefault();
        focusBlock(blocks[idx - 1].id);
      }
    }
    if (e.key === 'ArrowDown' && idx < blocks.length - 1) {
      const el = e.currentTarget;
      if (el.selectionStart === el.value.length) {
        e.preventDefault();
        focusBlock(blocks[idx + 1].id);
      }
    }
  }

  async function handleBlockPaste(
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    idx: number
  ) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await handleImageFilesDrop(imageFiles, idx);
      return;
    }

    // 빈 일반 문단(p)에 유튜브 영상 URL을 단독으로 붙여넣으면 자동으로 유튜브 영상 블록으로 변환
    const pastedText = e.clipboardData?.getData('text/plain')?.trim() || '';
    const targetBlock = blocks[idx];
    if (
      targetBlock &&
      targetBlock.type === 'p' &&
      !targetBlock.content.trim() &&
      pastedText &&
      !pastedText.includes('\n') &&
      !pastedText.includes(' ')
    ) {
      const ytId = extractYouTubeVideoId(pastedText);
      if (ytId) {
        e.preventDefault();
        updateBlock(targetBlock.id, {
          type: 'youtube',
          externalUrl: pastedText,
          content: pastedText,
        });
      }
    }
  }
}
