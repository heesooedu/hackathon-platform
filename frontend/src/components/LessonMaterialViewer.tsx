'use client';

import { useState, useRef } from 'react';
import { ParsedLessonMaterial } from '@/utils/materialPayload';
import {
  markdownToBlocks,
  blocksToMarkdown,
  NotionBlock,
} from '@/utils/notionBlocks';
import NotionBlockEditor from '@/components/NotionBlockEditor';
import MermaidDiagram from '@/components/MermaidDiagram';
import {
  updateLessonMaterialMarkdownAction,
  removeMaterialPatchAction,
  parseMaterialFileAction,
} from '@/app/lessons/actions';

interface LessonMaterialViewerProps {
  lessonId: string;
  classId: string;
  isTeacher: boolean;
  material: ParsedLessonMaterial;
}

/**
 * 마크다운 인라인 문법(**굵게**, `코드`)을 안전하게 렌더링합니다.
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-gray-900 bg-yellow-100/70 px-1 rounded">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-indigo-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

/**
 * 노션 스타일 교안 블록 렌더러
 * (제목 H1~H3, 콜아웃 박스, 인용구/제시문, 드래그 앤 드롭 이미지 및 캡션, 글머리 기호, 구분선 지원)
 */
export function SimpleMarkdownRenderer({ content }: { content: string }) {
  const blocks = markdownToBlocks(content);

  return (
    <div className="space-y-3 text-sm text-gray-800 leading-relaxed">
      {blocks.map((block) => {
        if (block.type === 'divider') {
          return <hr key={block.id} className="my-5 border-gray-200" />;
        }

        if (block.type === 'h1') {
          return (
            <h3
              key={block.id}
              className="text-xl font-extrabold text-gray-900 pt-3 pb-1.5 border-b border-gray-100 tracking-tight"
            >
              {renderInlineMarkdown(block.content)}
            </h3>
          );
        }

        if (block.type === 'h2') {
          return (
            <h4
              key={block.id}
              className="text-base font-bold text-indigo-950 pt-2 flex items-center gap-2"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span>{renderInlineMarkdown(block.content)}</span>
            </h4>
          );
        }

        if (block.type === 'h3') {
          return (
            <h5 key={block.id} className="text-sm font-bold text-gray-900 pt-1">
              {renderInlineMarkdown(block.content)}
            </h5>
          );
        }

        if (block.type === 'bullet') {
          return (
            <div key={block.id} className="flex items-start gap-2.5 pl-2">
              <span className="text-blue-600 font-bold select-none mt-0.5">•</span>
              <div className="flex-1 leading-relaxed">{renderInlineMarkdown(block.content)}</div>
            </div>
          );
        }

        if (block.type === 'callout') {
          return (
            <div
              key={block.id}
              className="flex items-start gap-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 p-4 my-2 shadow-2xs"
            >
              <span className="text-xl select-none shrink-0 mt-0.5">
                {block.icon || '💡'}
              </span>
              <div className="flex-1 text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-wrap">
                {renderInlineMarkdown(block.content)}
              </div>
            </div>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={block.id}
              className="border-l-4 border-indigo-400 bg-slate-50/80 pl-4 pr-4 py-2.5 my-2 rounded-r-xl text-sm text-gray-700 italic leading-relaxed whitespace-pre-wrap"
            >
              {renderInlineMarkdown(block.content)}
            </blockquote>
          );
        }

        if (block.type === 'code') {
          const langLabel = (block.language || 'python').toUpperCase();
          return (
            <div
              key={block.id}
              className="my-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 rounded-md bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-300">
                    {langLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(block.content);
                    }
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
                >
                  📋 코드 복사
                </button>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-slate-100">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        if (block.type === 'mermaid') {
          return (
            <div
              key={block.id}
              className="my-4 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/30 to-white p-4 shadow-2xs"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                  <span>❖</span>
                  <span>순서도 / 다이어그램</span>
                </span>
              </div>
              <MermaidDiagram chart={block.content} />
            </div>
          );
        }

        if (block.type === 'image') {
          if (!block.imageUrl) return null;
          const widthClass =
            block.imageSize === 'sm'
              ? 'max-w-xs'
              : block.imageSize === 'md'
              ? 'max-w-lg'
              : 'max-w-full';

          return (
            <figure key={block.id} className="my-4 flex flex-col items-center">
              <div
                className={`overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-xs ${widthClass}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={block.imageUrl}
                  alt={block.caption || '수업 교안 이미지'}
                  className="w-full h-auto object-contain max-h-[520px]"
                />
              </div>
              {block.caption && (
                <figcaption className="mt-2 text-xs text-gray-500 font-medium text-center">
                  ▲ {block.caption}
                </figcaption>
              )}
            </figure>
          );
        }

        if (!block.content.trim()) {
          return <div key={block.id} className="h-1" />;
        }

        return (
          <p key={block.id} className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {renderInlineMarkdown(block.content)}
          </p>
        );
      })}
    </div>
  );
}

export default function LessonMaterialViewer({
  lessonId,
  classId,
  isTeacher,
  material,
}: LessonMaterialViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpandedWide, setIsExpandedWide] = useState(true);
  const [draftBlocks, setDraftBlocks] = useState<NotionBlock[]>(() =>
    markdownToBlocks(material.markdownContent)
  );
  const [draftFileName, setDraftFileName] = useState<string | null>(material.fileName);
  const [saving, setSaving] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [removingPatchId, setRemovingPatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasMainMaterial =
    material.markdownContent.trim().length > 0 ||
    material.htmlContent.trim().length > 0;
  const hasPatches = material.appliedPatches.length > 0;

  if (!hasMainMaterial && !hasPatches && !isTeacher) {
    return null;
  }

  async function handleFileReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileUploading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await parseMaterialFileAction(fd);
      if (res.success && 'markdown' in res) {
        setDraftBlocks(markdownToBlocks(res.markdown || ''));
        setDraftFileName(res.fileName || file.name);
      } else {
        alert(res.error || '문서 텍스트 추출에 실패했습니다.');
      }
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSaveMarkdown() {
    setSaving(true);
    try {
      const serializedMd = blocksToMarkdown(draftBlocks);
      const res = await updateLessonMaterialMarkdownAction(
        lessonId,
        classId,
        serializedMd,
        draftFileName
      );
      if (res.success) {
        setIsEditing(false);
      } else {
        alert(res.error || '교안 저장 중 오류가 발생했습니다.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePatch(patchId: string) {
    setRemovingPatchId(patchId);
    try {
      await removeMaterialPatchAction(lessonId, classId, patchId);
    } finally {
      setRemovingPatchId(null);
    }
  }

  return (
    <div
      className={`space-y-4 transition-all duration-300 ${
        isExpandedWide
          ? 'relative left-1/2 right-1/2 -ml-[47vw] -mr-[47vw] w-[94vw] max-w-[1720px]'
          : 'w-full'
      }`}
    >
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📖</span>
            <span>수업 교안 & 학습 자료</span>
          </h2>
          {material.fileName && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              <span>📄</span>
              <span>{material.fileName}</span>
            </span>
          )}
          {hasPatches && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              <span>✨ 질문 기반 보충 패치 {material.appliedPatches.length}건 반영됨</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpandedWide(!isExpandedWide)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              isExpandedWide
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
            title="교안 가로 폭을 화면 전체로 넓히거나 기본 폭으로 줄입니다"
          >
            <span>↔️</span>
            <span>{isExpandedWide ? '전체 화면 가로 확장됨 (기본 폭으로)' : '교안 가로 전체 확장'}</span>
          </button>

          {isTeacher && (
            <button
              type="button"
              onClick={() => {
                setDraftBlocks(markdownToBlocks(material.markdownContent));
                setDraftFileName(material.fileName);
                setIsEditing(!isEditing);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition"
            >
              <span>{isEditing ? '✕' : '📝'}</span>
              <span>
                {isEditing
                  ? '노션 에디터 닫기'
                  : '노션 스타일로 교안 편집 / 사진·문서 추가'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 교사용 노션형 블록 에디터 패널 */}
      {isTeacher && isEditing && (
        <div className="rounded-3xl border-2 border-indigo-200 bg-white p-6 space-y-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                  NOTION STUDIO
                </span>
                <h3 className="text-base font-extrabold text-gray-900">
                  노션형 블록 에디터로 교안 꾸미기
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                마크다운 문법 없이 블록을 클릭해 제목·콜아웃·인용구를 추가하고, 사진을 마우스로 드래그 앤 드롭하여 삽입하세요.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.hwp,.hwpx,.md,.markdown,.txt"
                onChange={handleFileReupload}
                className="hidden"
                id="reupload-material-file"
              />
              <label
                htmlFor="reupload-material-file"
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                <span>
                  📂 {fileUploading ? '문서 변환 중...' : '워드(.docx)/한글(.hwp) 불러오기'}
                </span>
              </label>

              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveMarkdown}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '💾 교안 변경사항 저장'}
              </button>
            </div>
          </div>

          <NotionBlockEditor
            blocks={draftBlocks}
            onChange={(newBlocks) => setDraftBlocks(newBlocks)}
          />
        </div>
      )}

      {/* 1. 노션 페이지 스타일 교안 뷰어 */}
      {!isEditing && material.markdownContent.trim() ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
          <SimpleMarkdownRenderer content={material.markdownContent} />
        </div>
      ) : !isEditing &&
        material.materialType === 'html' &&
        material.htmlContent.trim() ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <iframe
            srcDoc={material.htmlContent}
            sandbox="allow-scripts"
            className="h-[520px] w-full border-0"
            title="Interactive Lesson Material"
          />
        </div>
      ) : (
        isTeacher &&
        !isEditing && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-6 text-center">
            <p className="text-xs text-gray-500">
              아직 등록된 수업 교안 본문이 없습니다. 우측 상단{' '}
              <strong className="text-gray-700">
                [노션 스타일로 교안 편집 / 사진·문서 추가]
              </strong>{' '}
              버튼을 눌러 노션처럼 교안을 작성하거나 사진을 드래그해 넣어보세요.
            </p>
          </div>
        )
      )}

      {/* 2. 원클릭으로 패치된 '우리 반 질문 기반 교안 보충 노트' 영역 */}
      {hasPatches && (
        <div className="space-y-3">
          {material.appliedPatches.map((patch) => (
            <div
              key={patch.id}
              className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 p-5 shadow-xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2 border-b border-emerald-100 pb-2.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                      ✨ 우리 반 질문 기반 교안 패치
                    </span>
                    <h3 className="text-sm font-extrabold text-emerald-950">
                      {patch.title}
                    </h3>
                  </div>
                  {patch.source_questions_summary && (
                    <p className="text-xs text-emerald-700 mt-1 font-medium">
                      📌 반영 계기: {patch.source_questions_summary}
                    </p>
                  )}
                </div>

                {isTeacher && (
                  <button
                    type="button"
                    disabled={removingPatchId === patch.id}
                    onClick={() => handleRemovePatch(patch.id)}
                    className="shrink-0 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                  >
                    {removingPatchId === patch.id ? '삭제 중...' : '패치 제거'}
                  </button>
                )}
              </div>

              <div className="pt-1">
                <SimpleMarkdownRenderer content={patch.content_markdown} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
