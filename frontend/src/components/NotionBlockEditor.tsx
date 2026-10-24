'use client';

import { useState, useRef, useEffect } from 'react';
import {
  NotionBlock,
  NotionBlockType,
  ImageSizeOption,
  CodeLanguage,
  createBlockId,
} from '@/utils/notionBlocks';
import MermaidDiagram from '@/components/MermaidDiagram';
import SimulationBlockPreview, {
  SIMULATION_TEMPLATES,
} from '@/components/SimulationBlockPreview';

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
    type: 'code',
    label: '코드 블록 (Python 등 자동 들여쓰기)',
    desc: 'Python·JS·SQL 코드 작성 (엔터 시 자동 들여쓰기 & Tab 지원)',
    badge: '</>',
    keywords: ['code', 'python', 'js', '코드', '파이썬', '프로그래밍'],
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
    type: 'image',
    label: '사진 / 이미지 블록',
    desc: '드래그 앤 드롭이나 파일 선택으로 사진을 넣습니다',
    badge: '🖼️',
    keywords: ['image', 'photo', 'pic', '사진', '이미지', '그림'],
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
  placeholder,
  className,
  inputRef,
  spellCheck = true,
}: {
  value: string;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  className: string;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
  spellCheck?: boolean;
}) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = internalRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
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
      placeholder={placeholder}
      className={`w-full resize-none overflow-hidden bg-transparent focus:outline-none ${className}`}
    />
  );
}

export default function NotionBlockEditor({
  blocks,
  onChange,
}: NotionBlockEditorProps) {
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null);
  const [slashFilterQuery, setSlashFilterQuery] = useState('');
  const [slashSelectedIdx, setSlashSelectedIdx] = useState(0);

  const [isDraggingFileOverPage, setIsDraggingFileOverPage] = useState(false);
  const [draggedBlockIdx, setDraggedBlockIdx] = useState<number | null>(null);
  const [dragOverBlockIdx, setDragOverBlockIdx] = useState<number | null>(null);
  const [dragHandleHoveredBlockId, setDragHandleHoveredBlockId] = useState<
    string | null
  >(null);
  const [uploadingImageBlockId, setUploadingImageBlockId] = useState<string | null>(
    null
  );
  const [hiddenSimCodeBlockIds, setHiddenSimCodeBlockIds] = useState<
    Record<string, boolean>
  >({});

  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const targetImageBlockIdRef = useRef<string | null>(null);

  function focusBlock(id: string, cursorPos?: number) {
    setTimeout(() => {
      const el = blockRefs.current[id];
      if (el) {
        el.focus();
        const pos = cursorPos !== undefined ? cursorPos : el.value.length;
        el.setSelectionRange(pos, pos);
      }
    }, 20);
  }

  function updateBlock(id: string, patch: Partial<NotionBlock>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function insertBlockAfter(index: number, newBlock: NotionBlock) {
    const next = [...blocks];
    next.splice(index + 1, 0, newBlock);
    onChange(next);
    if (newBlock.type !== 'image' && newBlock.type !== 'divider') {
      focusBlock(newBlock.id);
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
    const prevBlock = blocks[index - 1];
    const next = blocks.filter((_, i) => i !== index);
    onChange(next);
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
    onChange(next);
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

    updateBlock(block.id, {
      type: targetType,
      content:
        targetType === 'mermaid' && !cleanedContent.trim()
          ? defaultMermaid
          : targetType === 'simulation' && !cleanedContent.trim()
          ? defaultSimulation
          : cleanedContent,
      caption:
        targetType === 'simulation'
          ? block.caption || SIMULATION_TEMPLATES[0].caption
          : block.caption,
      icon: targetType === 'callout' ? block.icon || '💡' : undefined,
      language: targetType === 'code' ? block.language || 'python' : undefined,
    });
    setSlashMenuBlockId(null);
    setSlashFilterQuery('');
    setSlashSelectedIdx(0);

    if (targetType !== 'image' && targetType !== 'divider') {
      focusBlock(block.id);
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

      const trimmedLine = currentLine.trimEnd();
      // Python의 콜론(:), 또는 중괄호/대괄호/소괄호 열림({, [, () 혹은 Mermaid의 subgraph 끝에서 자동 추가 들여쓰기
      if (
        trimmedLine.endsWith(':') ||
        trimmedLine.endsWith('{') ||
        trimmedLine.endsWith('(') ||
        trimmedLine.endsWith('[') ||
        (block.type === 'mermaid' && /^subgraph\b/.test(trimmedLine.trim()))
      ) {
        indent += indentUnit;
      }

      const insertion = '\n' + indent;
      const newVal = beforeCursor + insertion + afterCursor;
      const newCursorPos = start + insertion.length;

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

    // 3. Tab 키 -> 4칸 들여쓰기 삽입
    if (e.key === 'Tab') {
      e.preventDefault();
      const beforeCursor = val.slice(0, start);
      const afterCursor = val.slice(end);
      const newVal = beforeCursor + indentUnit + afterCursor;
      const newCursorPos = start + indentUnit.length;

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

  async function handleImageFilesDrop(
    files: FileList | File[],
    insertAtIdx?: number,
    replaceBlockId?: string
  ) {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (imageFiles.length === 0) return;

    const newImageBlocks: NotionBlock[] = [];
    for (const file of imageFiles) {
      const dataUrl = await compressImageFileToDataUrl(file);
      const defaultCaption = file.name.replace(/\.[^.]+$/, '');
      newImageBlocks.push({
        id: createBlockId(),
        type: 'image',
        content: '',
        imageUrl: dataUrl,
        caption: defaultCaption,
        imageSize: 'md',
      });
    }

    if (replaceBlockId && newImageBlocks.length > 0) {
      const first = newImageBlocks[0];
      const updated = blocks.map((b) =>
        b.id === replaceBlockId
          ? {
              ...b,
              type: 'image' as NotionBlockType,
              imageUrl: first.imageUrl,
              caption: b.caption || first.caption,
              imageSize: b.imageSize || 'md',
            }
          : b
      );
      onChange(updated);
      return;
    }

    const idx =
      insertAtIdx !== undefined ? insertAtIdx : Math.max(0, blocks.length - 1);
    const next = [...blocks];
    next.splice(idx + 1, 0, ...newImageBlocks);
    onChange(next);
  }

  const filteredSlashItems = getFilteredSlashItems();

  return (
    <div
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
            await handleImageFilesDrop(
              e.dataTransfer.files,
              dragOverBlockIdx !== null ? dragOverBlockIdx : blocks.length - 1
            );
            setDragOverBlockIdx(null);
          }
        }
      }}
      className="relative space-y-2"
    >
      {/* 숨겨진 이미지 파일 선택 input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const targetId = targetImageBlockIdRef.current;
            if (targetId) {
              setUploadingImageBlockId(targetId);
              await handleImageFilesDrop(files, undefined, targetId);
              setUploadingImageBlockId(null);
              targetImageBlockIdRef.current = null;
            } else {
              await handleImageFilesDrop(files, blocks.length - 1);
            }
          }
          if (imageInputRef.current) imageInputRef.current.value = '';
        }}
      />

      {/* 상단 고정 노션 블록 빠른 삽입 툴바 */}
      <div className="sticky top-[124px] z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200/90 bg-white/95 px-3.5 py-2.5 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-gray-400 mr-1">
            블록 빠른 추가:
          </span>
          {BLOCK_TYPE_META.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => {
                if (item.type === 'image') {
                  const newImgBlock: NotionBlock = {
                    id: createBlockId(),
                    type: 'image',
                    content: '',
                    imageUrl: '',
                    caption: '',
                    imageSize: 'md',
                  };
                  onChange([...blocks, newImgBlock]);
                } else {
                  const newBlock: NotionBlock = {
                    id: createBlockId(),
                    type: item.type,
                    content:
                      item.type === 'mermaid'
                        ? MERMAID_TEMPLATES[0].code
                        : item.type === 'simulation'
                        ? SIMULATION_TEMPLATES[0].code
                        : '',
                    caption:
                      item.type === 'simulation'
                        ? SIMULATION_TEMPLATES[0].caption
                        : undefined,
                    icon: item.type === 'callout' ? '💡' : undefined,
                    language: item.type === 'code' ? 'python' : undefined,
                  };
                  onChange([...blocks, newBlock]);
                  focusBlock(newBlock.id);
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50/80 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition cursor-pointer"
              title={item.desc}
            >
              <span className="text-blue-600">{item.badge}</span>
              <span>{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <span className="text-[11px] font-medium text-gray-400 hidden xl:inline">
          💡 빈 줄에 <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">/</kbd>{' '}
          입력 시 코드블록·순서도(Mermaid)·콜아웃·사진 즉시 선택
        </span>
      </div>

      {/* 파일 드래그 오버 시 표시되는 노션 스타일 안내 오버레이 */}
      {isDraggingFileOverPage && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-blue-600/10 backdrop-blur-[1px]">
          <div className="rounded-2xl border-2 border-dashed border-blue-600 bg-white px-8 py-6 text-center shadow-2xl">
            <div className="text-4xl mb-2">🖼️</div>
            <div className="text-base font-extrabold text-blue-900">
              여기에 사진을 놓아 교안 페이지에 바로 삽입하세요!
            </div>
            <div className="text-xs text-blue-600 mt-1">
              자동으로 크기가 최적화되어 노션 이미지 블록으로 들어갑니다
            </div>
          </div>
        </div>
      )}

      {/* 노션 블록 리스트 렌더링 */}
      <div className="space-y-2 pt-2">
        {blocks.map((block, idx) => {
          const isSlashOpen = slashMenuBlockId === block.id;

          const isBeingDragged = draggedBlockIdx === idx;
          const isDropTarget = dragOverBlockIdx === idx && draggedBlockIdx !== idx;

          return (
            <div
              key={block.id}
              draggable={
                dragHandleHoveredBlockId === block.id ||
                (block.type !== 'code' &&
                  block.type !== 'mermaid' &&
                  block.type !== 'simulation')
              }
              onDragStart={(e) => {
                setDraggedBlockIdx(idx);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', block.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverBlockIdx !== idx) {
                  setDragOverBlockIdx(idx);
                }
              }}
              onDragEnd={() => {
                setDraggedBlockIdx(null);
                setDragOverBlockIdx(null);
              }}
              onDrop={(e) => {
                if (
                  draggedBlockIdx !== null &&
                  draggedBlockIdx !== idx &&
                  !e.dataTransfer.types.includes('Files')
                ) {
                  e.preventDefault();
                  const next = [...blocks];
                  const [moved] = next.splice(draggedBlockIdx, 1);
                  next.splice(idx, 0, moved);
                  onChange(next);
                }
                setDraggedBlockIdx(null);
                setDragOverBlockIdx(null);
              }}
              className={`group relative flex items-start gap-2 rounded-xl px-2 py-1 transition-all ${
                isBeingDragged
                  ? 'opacity-40 scale-[0.99] bg-blue-50/40 ring-1 ring-blue-300'
                  : isDropTarget
                  ? 'border-y-2 border-blue-500 bg-blue-50/40 shadow-xs'
                  : 'hover:bg-gray-50/80'
              }`}
            >
              {/* 좌측 노션 스타일 블록 컨트롤 핸들 (+ 추가 / ⋮⋮ 드래그 순서 이동) */}
              <div className="flex shrink-0 items-center gap-0.5 pt-1 opacity-55 group-hover:opacity-100 transition select-none">
                <button
                  type="button"
                  title="블록 타입 변경 또는 코드·순서도·시뮬레이션 선택"
                  onClick={() => {
                    if (isSlashOpen) {
                      setSlashMenuBlockId(null);
                      setSlashFilterQuery('');
                    } else {
                      setSlashMenuBlockId(block.id);
                      setSlashFilterQuery('');
                      setSlashSelectedIdx(0);
                    }
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-900 text-sm font-bold cursor-pointer"
                >
                  +
                </button>
                <div
                  title="마우스로 잡고 위아래로 드래그하여 블록 순서 변경"
                  onMouseEnter={() => setDragHandleHoveredBlockId(block.id)}
                  onMouseLeave={() => {
                    if (draggedBlockIdx === null) {
                      setDragHandleHoveredBlockId(null);
                    }
                  }}
                  onMouseDown={() => setDragHandleHoveredBlockId(block.id)}
                  className="flex h-6 w-6 cursor-grab active:cursor-grabbing items-center justify-center rounded-md text-gray-400 hover:bg-blue-100 hover:text-blue-700 text-xs font-bold transition"
                >
                  ⋮⋮
                </div>
              </div>

              {/* 블록 본문 영역 */}
              <div className="flex-1 min-w-0">
                {/* 1. 대제목 (H1) */}
                {block.type === 'h1' && (
                  <AutoResizeTextarea
                    value={block.content}
                    inputRef={(el) => {
                      blockRefs.current[block.id] = el;
                    }}
                    onChange={(val) => handleTextChangeWithSlash(block, val)}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                    onPaste={(e) => handleBlockPaste(e, idx)}
                    placeholder="단원 대제목 (제목 1)..."
                    className="text-2xl font-extrabold text-gray-900 placeholder:text-gray-300 pt-2 pb-1 border-b border-gray-100"
                  />
                )}

                {/* 2. 중제목 (H2) */}
                {block.type === 'h2' && (
                  <div className="flex items-center gap-2 pt-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                    <AutoResizeTextarea
                      value={block.content}
                      inputRef={(el) => {
                        blockRefs.current[block.id] = el;
                      }}
                      onChange={(val) => handleTextChangeWithSlash(block, val)}
                      onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                      onPaste={(e) => handleBlockPaste(e, idx)}
                      placeholder="소단원 중제목 (제목 2)..."
                      className="text-lg font-bold text-indigo-950 placeholder:text-gray-300"
                    />
                  </div>
                )}

                {/* 3. 소제목 (H3) */}
                {block.type === 'h3' && (
                  <AutoResizeTextarea
                    value={block.content}
                    inputRef={(el) => {
                      blockRefs.current[block.id] = el;
                    }}
                    onChange={(val) => handleTextChangeWithSlash(block, val)}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                    onPaste={(e) => handleBlockPaste(e, idx)}
                    placeholder="소제목 (제목 3)..."
                    className="text-base font-bold text-gray-800 placeholder:text-gray-300 pt-1"
                  />
                )}

                {/* 4. 일반 본문 (Paragraph) */}
                {block.type === 'p' && (
                  <AutoResizeTextarea
                    value={block.content}
                    inputRef={(el) => {
                      blockRefs.current[block.id] = el;
                    }}
                    onChange={(val) => handleTextChangeWithSlash(block, val)}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                    onPaste={(e) => handleBlockPaste(e, idx)}
                    placeholder="내용을 입력하거나 '/'를 눌러 블록(코드블록, 순서도, 콜아웃, 사진 등)을 선택하세요..."
                    className="text-sm text-gray-800 leading-relaxed placeholder:text-gray-300 py-0.5"
                  />
                )}

                {/* 5. 글머리 기호 목록 (Bullet) */}
                {block.type === 'bullet' && (
                  <div className="flex items-start gap-2.5 pl-1">
                    <span className="text-blue-600 font-extrabold select-none pt-0.5">
                      •
                    </span>
                    <AutoResizeTextarea
                      value={block.content}
                      inputRef={(el) => {
                        blockRefs.current[block.id] = el;
                      }}
                      onChange={(val) => handleTextChangeWithSlash(block, val)}
                      onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                      onPaste={(e) => handleBlockPaste(e, idx)}
                      placeholder="목록 항목 입력..."
                      className="text-sm text-gray-800 leading-relaxed placeholder:text-gray-300"
                    />
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
                    <AutoResizeTextarea
                      value={block.content}
                      inputRef={(el) => {
                        blockRefs.current[block.id] = el;
                      }}
                      onChange={(val) =>
                        updateBlock(block.id, { content: val })
                      }
                      onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                      onPaste={(e) => handleBlockPaste(e, idx)}
                      placeholder="핵심 개념, 주의사항, 탐구 질문을 강조 박스에 작성하세요 (아이콘 클릭 시 변경)..."
                      className="text-sm font-medium text-gray-900 leading-relaxed placeholder:text-amber-700/40"
                    />
                  </div>
                )}

                {/* 7. 인용구 / 읽기 지문 블록 (Quote) */}
                {block.type === 'quote' && (
                  <div className="border-l-4 border-indigo-500 bg-slate-50/80 pl-4 pr-3 py-2.5 rounded-r-xl">
                    <AutoResizeTextarea
                      value={block.content}
                      inputRef={(el) => {
                        blockRefs.current[block.id] = el;
                      }}
                      onChange={(val) =>
                        updateBlock(block.id, { content: val })
                      }
                      onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                      onPaste={(e) => handleBlockPaste(e, idx)}
                      placeholder="교과서 지문, 역사 사료, 명언 또는 핵심 정의를 입력하세요..."
                      className="text-sm italic text-gray-700 leading-relaxed placeholder:text-gray-400"
                    />
                  </div>
                )}

                {/* 8. 코드 블록 (Python 등 스마트 자동 들여쓰기 지원) */}
                {block.type === 'code' && (
                  <div className="my-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/80 px-4 py-2">
                      <div className="flex items-center gap-2">
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
                            className="rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-500 transition cursor-pointer"
                          >
                            🧪 이 코드를 교안 내 시뮬레이션으로 실행하기
                          </button>
                        )}
                      </div>

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

                {/* 10. 구분선 블록 (Divider) */}
                {block.type === 'divider' && (
                  <div className="py-3">
                    <hr className="border-gray-200" />
                  </div>
                )}

                {/* 11. 노션 스타일 이미지 블록 (드래그 앤 드롭 & 캡션 & 크기 조절) */}
                {block.type === 'image' && (
                  <div className="my-2">
                    {block.imageUrl ? (
                      <div className="space-y-2 rounded-2xl border border-gray-200 bg-slate-50/50 p-3">
                        <div className="flex items-center justify-between gap-2 pb-1">
                          <span className="text-[11px] font-bold text-gray-500">
                            🖼️ 삽입된 교안 이미지
                          </span>
                          <div className="flex items-center gap-1">
                            {(
                              [
                                { key: 'sm', label: '작게 (50%)' },
                                { key: 'md', label: '기본 (75%)' },
                                { key: 'full', label: '가득 (100%)' },
                              ] as { key: ImageSizeOption; label: string }[]
                            ).map((sz) => (
                              <button
                                key={sz.key}
                                type="button"
                                onClick={() =>
                                  updateBlock(block.id, { imageSize: sz.key })
                                }
                                className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                                  (block.imageSize || 'md') === sz.key
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                              >
                                {sz.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                targetImageBlockIdRef.current = block.id;
                                imageInputRef.current?.click();
                              }}
                              className="ml-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-100"
                            >
                              사진 변경
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={block.imageUrl}
                            alt={block.caption || '교안 이미지'}
                            className={`rounded-xl border border-gray-200 object-contain shadow-xs ${
                              block.imageSize === 'sm'
                                ? 'max-w-xs'
                                : block.imageSize === 'full'
                                ? 'w-full'
                                : 'max-w-xl w-full'
                            }`}
                          />
                        </div>

                        <input
                          type="text"
                          value={block.caption || ''}
                          onChange={(e) =>
                            updateBlock(block.id, { caption: e.target.value })
                          }
                          placeholder="사진 아래에 들어갈 설명(캡션)을 입력하세요 (AI가 교안 분석 시 함께 참고합니다)..."
                          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-center text-xs text-gray-600 placeholder:text-gray-400 focus:border-gray-200 focus:bg-white focus:outline-none"
                        />
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
                              block.id
                            );
                            setUploadingImageBlockId(null);
                          }
                        }}
                        onClick={() => {
                          targetImageBlockIdRef.current = block.id;
                          imageInputRef.current?.click();
                        }}
                        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 py-8 px-4 text-center transition hover:border-blue-400 hover:bg-blue-50/60"
                      >
                        <div className="text-3xl mb-1.5">🖼️</div>
                        <p className="text-xs font-bold text-blue-900">
                          {uploadingImageBlockId === block.id
                            ? '사진 최적화 및 삽입 중...'
                            : '이곳에 사진 파일을 드래그해서 놓거나 클릭하여 업로드하세요'}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          PNG, JPG, GIF, WebP 지원 · 클립보드 이미지 붙여넣기(Ctrl+V) 가능
                        </p>
                      </div>
                    )}
                  </div>
                )}

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

              {/* 우측 블록 빠른 액션 (타입 배지, 위/아래 이동, 삭제) */}
              <div className="flex shrink-0 items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition">
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
                  <option value="code">코드블록</option>
                  <option value="mermaid">순서도(Mermaid)</option>
                  <option value="simulation">시뮬레이션(HTML/JS)</option>
                  <option value="image">사진</option>
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
          + 여기를 클릭해 새 단락을 작성하거나, <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">/code</kbd> (파이썬 코드), <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">/mermaid</kbd> (순서도)를 입력해 보세요
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            targetImageBlockIdRef.current = null;
            imageInputRef.current?.click();
          }}
          className="rounded-lg bg-white border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 shadow-2xs cursor-pointer"
        >
          🖼️ 컴퓨터에서 사진 선택
        </button>
      </div>
    </div>
  );

  function handleBlockKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    block: NotionBlock,
    idx: number
  ) {
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
    }
  }
}
