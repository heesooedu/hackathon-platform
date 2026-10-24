'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ParsedLessonMaterial } from '@/utils/materialPayload';
import {
  markdownToBlocks,
  blocksToMarkdown,
  NotionBlock,
} from '@/utils/notionBlocks';
import NotionBlockEditor from '@/components/NotionBlockEditor';
import MermaidDiagram from '@/components/MermaidDiagram';
import SimulationBlockPreview from '@/components/SimulationBlockPreview';
import {
  updateLessonMaterialAction,
  clearLessonMaterialAction,
  removeMaterialPatchAction,
  parseMaterialFileAction,
} from '@/app/lessons/actions';
import { MaterialType } from '@/types/database.types';

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
    <div className="space-y-3.5 text-sm text-gray-800">
      {blocks.map((block) => {
        if (block.type === 'divider') {
          return <hr key={block.id} className="my-5 border-gray-200" />;
        }

        if (block.type === 'h1') {
          return (
            <h3
              key={block.id}
              className="text-xl font-extrabold text-gray-900 pt-3 pb-1.5 border-b border-gray-100 tracking-tight leading-snug whitespace-pre-wrap"
            >
              {renderInlineMarkdown(block.content)}
            </h3>
          );
        }

        if (block.type === 'h2') {
          return (
            <h4
              key={block.id}
              className="text-base font-bold text-indigo-950 pt-2 flex items-start gap-2 leading-snug whitespace-pre-wrap"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
              <span>{renderInlineMarkdown(block.content)}</span>
            </h4>
          );
        }

        if (block.type === 'h3') {
          return (
            <h5
              key={block.id}
              className="text-sm font-bold text-gray-900 pt-1 leading-snug whitespace-pre-wrap"
            >
              {renderInlineMarkdown(block.content)}
            </h5>
          );
        }

        if (block.type === 'bullet') {
          return (
            <div key={block.id} className="flex items-start gap-2.5 pl-2">
              <span className="text-blue-600 font-bold select-none mt-0.5">•</span>
              <div className="flex-1 leading-snug whitespace-pre-wrap">
                {renderInlineMarkdown(block.content)}
              </div>
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
              <div className="flex-1 text-sm font-medium text-gray-900 leading-snug whitespace-pre-wrap">
                {renderInlineMarkdown(block.content)}
              </div>
            </div>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={block.id}
              className="border-l-4 border-indigo-400 bg-slate-50/80 pl-4 pr-4 py-2.5 my-2 rounded-r-xl text-sm text-gray-700 italic leading-snug whitespace-pre-wrap"
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

        if (block.type === 'simulation') {
          return (
            <SimulationBlockPreview
              key={block.id}
              code={block.content}
              caption={block.caption}
            />
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
          return (
            <div
              key={block.id}
              className="h-6 select-none"
              aria-hidden="true"
            >
              &nbsp;
            </div>
          );
        }

        return (
          <p key={block.id} className="text-gray-700 leading-snug whitespace-pre-wrap">
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
  const [draftMaterialType, setDraftMaterialType] = useState<MaterialType>(
    material.materialType || 'markdown'
  );
  const [draftBlocks, setDraftBlocks] = useState<NotionBlock[]>(() =>
    markdownToBlocks(material.markdownContent)
  );
  const [draftHtml, setDraftHtml] = useState<string>(material.htmlContent || '');
  const [draftFileName, setDraftFileName] = useState<string | null>(material.fileName);
  const [saving, setSaving] = useState(false);
  const [clearingMaterial, setClearingMaterial] = useState(false);
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
        setDraftMaterialType('markdown');
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

  async function handleSaveMaterial() {
    setSaving(true);
    try {
      const serializedMd = blocksToMarkdown(draftBlocks);
      const res = await updateLessonMaterialAction(
        lessonId,
        classId,
        draftMaterialType,
        serializedMd,
        draftHtml,
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

  async function handleClearMaterial() {
    const confirmed = window.confirm(
      '현재 작성된 수업 교안 본문을 삭제(비우기)하시겠습니까?\n(학생들이 제출한 질문과 답변 데이터는 그대로 유지됩니다.)'
    );
    if (!confirmed) return;

    setClearingMaterial(true);
    try {
      const res = await clearLessonMaterialAction(lessonId, classId);
      if (res.success) {
        setIsEditing(false);
      } else {
        alert(res.error || '교안 삭제 중 오류가 발생했습니다.');
      }
    } finally {
      setClearingMaterial(false);
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
            <>
              <button
                type="button"
                onClick={() => {
                  setDraftMaterialType(material.materialType || 'markdown');
                  setDraftBlocks(markdownToBlocks(material.markdownContent));
                  setDraftHtml(material.htmlContent || '');
                  setDraftFileName(material.fileName);
                  setIsEditing(!isEditing);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-100 transition"
              >
                <span>{isEditing ? '✕' : '📝'}</span>
                <span>
                  {isEditing ? '빠른 편집 닫기' : '교안 바로 수정'}
                </span>
              </button>

              <Link
                href={`/classes/${classId}/lessons/${lessonId}/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition"
              >
                <span>✏️</span>
                <span>스튜디오 전체 화면 수정</span>
              </Link>

              {(hasMainMaterial || hasPatches) && (
                <button
                  type="button"
                  disabled={clearingMaterial}
                  onClick={handleClearMaterial}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
                  title="학생 질문은 유지하고 교안 본문만 비웁니다"
                >
                  <span>🗑️</span>
                  <span>{clearingMaterial ? '비우는 중...' : '교안 본문 삭제'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 교사용 노션형 블록 에디터 패널 */}
      {isTeacher && isEditing && (
        <div className="rounded-3xl border-2 border-indigo-200 bg-white p-6 space-y-4 shadow-lg">
          <div className="sticky top-16 z-30 -mx-2 rounded-2xl bg-white/95 px-3 py-3 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                  NOTION STUDIO
                </span>
                <h3 className="text-base font-extrabold text-gray-900">
                  수업 교안 빠른 수정
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                블록을 클릭하거나 <code className="rounded bg-gray-100 px-1">/</code>를 입력해 코드·순서도·시뮬레이션 블록을 수정하고 즉시 저장하세요.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setDraftMaterialType('markdown')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    draftMaterialType === 'markdown'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  📝 노션 블록 교안
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMaterialType('html')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    draftMaterialType === 'html'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  ⚡ HTML 시뮬레이터
                </button>
              </div>

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
                onClick={handleSaveMaterial}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {saving ? '저장 중...' : '💾 교안 변경사항 저장'}
              </button>
            </div>
          </div>

          {draftMaterialType === 'markdown' ? (
            <NotionBlockEditor
              blocks={draftBlocks}
              onChange={(newBlocks) => setDraftBlocks(newBlocks)}
            />
          ) : (
            <div className="space-y-3">
              <textarea
                rows={12}
                value={draftHtml}
                onChange={(e) => setDraftHtml(e.target.value)}
                placeholder="<!DOCTYPE html><html>...</html>"
                className="w-full rounded-2xl border border-gray-200 bg-slate-950 p-4 font-mono text-xs text-emerald-300 leading-relaxed focus:border-indigo-500 focus:outline-none"
              />
              {draftHtml.trim() && (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  <iframe
                    srcDoc={draftHtml}
                    sandbox="allow-scripts"
                    className="h-[420px] w-full border-0"
                    title="Interactive Simulator Draft Preview"
                  />
                </div>
              )}
            </div>
          )}

          {/* 에디터 하단 저장 액션 바 */}
          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-gray-500">
              💡 교안 편집이 끝났다면 우측의 저장 버튼을 눌러 반영해 주세요.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveMaterial}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                <span>💾</span>
                <span>{saving ? '저장 중...' : '교안 변경사항 저장하기'}</span>
              </button>
            </div>
          </div>

          {/* 화면 우측 하단 플로팅 저장 버튼 */}
          <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl border border-indigo-200 bg-white/95 p-2 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveMaterial}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              <span>💾</span>
              <span>{saving ? '저장 중...' : '교안 저장'}</span>
            </button>
          </div>
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
