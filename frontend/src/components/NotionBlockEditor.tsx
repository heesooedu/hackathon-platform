'use client';

import { useState, useRef, useEffect } from 'react';
import {
  NotionBlock,
  NotionBlockType,
  ImageSizeOption,
  createBlockId,
} from '@/utils/notionBlocks';

interface NotionBlockEditorProps {
  blocks: NotionBlock[];
  onChange: (newBlocks: NotionBlock[]) => void;
}

const CALLOUT_ICONS = ['💡', '📌', '🎯', '⚠️', '❓', '📖', '🔬', '🏛️', '✨'];

const BLOCK_TYPE_META: {
  type: NotionBlockType;
  label: string;
  desc: string;
  badge: string;
}[] = [
  { type: 'p', label: '본문 텍스트', desc: '일반 수업 설명 단락을 작성합니다', badge: 'T' },
  { type: 'h1', label: '대제목 (제목 1)', desc: '단원의 가장 큰 제목입니다', badge: 'H1' },
  { type: 'h2', label: '중제목 (제목 2)', desc: '주요 개념이나 소단원 제목입니다', badge: 'H2' },
  { type: 'h3', label: '소제목 (제목 3)', desc: '세부 항목 제목입니다', badge: 'H3' },
  { type: 'bullet', label: '글머리 기호 목록', desc: '핵심 내용을 리스트로 정리합니다', badge: '•' },
  {
    type: 'callout',
    label: '콜아웃 강조 박스',
    desc: '아이콘과 배경색이 있는 노션 강조 박스입니다',
    badge: '💡',
  },
  {
    type: 'quote',
    label: '인용구 / 지문 박스',
    desc: '국어·영어 지문이나 역사 사료, 정의를 인용합니다',
    badge: '❝',
  },
  {
    type: 'image',
    label: '사진 / 이미지 블록',
    desc: '드래그 앤 드롭이나 파일 선택으로 사진을 넣습니다',
    badge: '🖼️',
  },
  { type: 'divider', label: '구분선', desc: '단락 사이를 시각적으로 나눕니다', badge: '―' },
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

      // SVG나 GIF는 원본 유지
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
}: {
  value: string;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  className: string;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
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
  const [isDraggingFileOverPage, setIsDraggingFileOverPage] = useState(false);
  const [draggedBlockIdx, setDraggedBlockIdx] = useState<number | null>(null);
  const [dragOverBlockIdx, setDragOverBlockIdx] = useState<number | null>(null);
  const [uploadingImageBlockId, setUploadingImageBlockId] = useState<string | null>(
    null
  );

  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const targetImageBlockIdRef = useRef<string | null>(null);

  function focusBlock(id: string) {
    setTimeout(() => {
      const el = blockRefs.current[id];
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
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

      {/* 상단 고정 노션 블록 빠른 삽입 툴바 (마크다운 문법을 몰라도 원클릭 추가) */}
      <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200/90 bg-white/95 px-3.5 py-2.5 shadow-sm backdrop-blur-md">
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
                    content: '',
                    icon: item.type === 'callout' ? '💡' : undefined,
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

        <span className="text-[11px] font-medium text-gray-400 hidden sm:inline">
          💡 팁: 사진을 이 페이지 어디든 <strong>드래그 앤 드롭</strong>하거나 빈 줄에{' '}
          <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">
            /
          </kbd>
          를 입력해 보세요
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
      <div className="space-y-1.5 pt-2">
        {blocks.map((block, idx) => {
          const isSlashOpen = slashMenuBlockId === block.id;

          return (
            <div
              key={block.id}
              draggable
              onDragStart={(e) => {
                // 텍스트 선택 중이 아닐 때 블록 순서 이동
                setDraggedBlockIdx(idx);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverBlockIdx !== idx) {
                  setDragOverBlockIdx(idx);
                }
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
              className={`group relative flex items-start gap-2 rounded-xl px-2 py-1 transition ${
                dragOverBlockIdx === idx
                  ? 'border-b-2 border-blue-500 bg-blue-50/30'
                  : 'hover:bg-gray-50/80'
              }`}
            >
              {/* 좌측 노션 스타일 블록 컨트롤 핸들 (+ 추가 / ⋮⋮ 타입 전환 / 이동) */}
              <div className="flex shrink-0 items-center gap-0.5 pt-1 opacity-40 group-hover:opacity-100 transition select-none">
                <button
                  type="button"
                  title="아래에 블록 추가 또는 타입 변경"
                  onClick={() =>
                    setSlashMenuBlockId(isSlashOpen ? null : block.id)
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-900 text-sm font-bold cursor-pointer"
                >
                  +
                </button>
                <div
                  title="드래그하여 순서 이동"
                  className="flex h-6 w-5 cursor-grab items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 text-xs"
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
                    onChange={(val) => {
                      if (val === '/') setSlashMenuBlockId(block.id);
                      else if (isSlashOpen) setSlashMenuBlockId(null);
                      updateBlock(block.id, { content: val });
                    }}
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
                      onChange={(val) => {
                        if (val === '/') setSlashMenuBlockId(block.id);
                        else if (isSlashOpen) setSlashMenuBlockId(null);
                        updateBlock(block.id, { content: val });
                      }}
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
                    onChange={(val) => {
                      if (val === '/') setSlashMenuBlockId(block.id);
                      else if (isSlashOpen) setSlashMenuBlockId(null);
                      updateBlock(block.id, { content: val });
                    }}
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
                    onChange={(val) => {
                      if (val === '/') setSlashMenuBlockId(block.id);
                      else if (isSlashOpen) setSlashMenuBlockId(null);
                      updateBlock(block.id, { content: val });
                    }}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                    onPaste={(e) => handleBlockPaste(e, idx)}
                    placeholder="내용을 입력하거나 '/'를 눌러 블록(제목, 콜아웃, 사진 등)을 선택하세요..."
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
                      onChange={(val) => {
                        if (val === '/') setSlashMenuBlockId(block.id);
                        else if (isSlashOpen) setSlashMenuBlockId(null);
                        updateBlock(block.id, { content: val });
                      }}
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

                {/* 8. 구분선 블록 (Divider) */}
                {block.type === 'divider' && (
                  <div className="py-3">
                    <hr className="border-gray-200" />
                  </div>
                )}

                {/* 9. 노션 스타일 이미지 블록 (드래그 앤 드롭 & 캡션 & 크기 조절) */}
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

                {/* 노션 슬래시(/) 또는 [+] 블록 선택 팝업 메뉴 */}
                {isSlashOpen && (
                  <div className="mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl z-30">
                    <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-gray-400 border-b border-gray-100 mb-1">
                      <span>노션 블록 타입 선택 / 변환</span>
                      <button
                        type="button"
                        onClick={() => setSlashMenuBlockId(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-0.5">
                      {BLOCK_TYPE_META.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => {
                            const cleanedContent =
                              block.content === '/' ? '' : block.content;
                            updateBlock(block.id, {
                              type: item.type,
                              content: cleanedContent,
                              icon:
                                item.type === 'callout'
                                  ? block.icon || '💡'
                                  : undefined,
                            });
                            setSlashMenuBlockId(null);
                            if (
                              item.type !== 'image' &&
                              item.type !== 'divider'
                            ) {
                              focusBlock(block.id);
                            }
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-blue-50 transition"
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
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 우측 블록 빠른 액션 (타입 배지, 위/아래 이동, 삭제) */}
              <div className="flex shrink-0 items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition">
                <select
                  value={block.type}
                  onChange={(e) =>
                    updateBlock(block.id, {
                      type: e.target.value as NotionBlockType,
                      icon:
                        e.target.value === 'callout'
                          ? block.icon || '💡'
                          : undefined,
                    })
                  }
                  className="rounded-lg border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 focus:outline-none cursor-pointer"
                >
                  <option value="p">본문</option>
                  <option value="h1">제목 1</option>
                  <option value="h2">제목 2</option>
                  <option value="h3">제목 3</option>
                  <option value="bullet">목록</option>
                  <option value="callout">콜아웃</option>
                  <option value="quote">인용/지문</option>
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
        className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-400 hover:border-blue-300 hover:bg-blue-50/20 hover:text-blue-600 cursor-text transition"
      >
        <span>+ 여기를 클릭하여 새 단락을 이어서 작성하거나 사진을 드래그하여 놓으세요...</span>
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
    if (e.key === 'Escape' && slashMenuBlockId) {
      setSlashMenuBlockId(null);
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
    }
  }
}
