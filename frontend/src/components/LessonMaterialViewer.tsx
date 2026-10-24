'use client';

import { useState, useRef } from 'react';
import { ParsedLessonMaterial } from '@/utils/materialPayload';
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
        <strong key={idx} className="font-bold text-gray-900 bg-yellow-50/80 px-0.5 rounded">
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
 * 교안 마크다운 블록 렌더러
 */
export function SimpleMarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-2.5 text-sm text-gray-800 leading-relaxed">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }

        if (line === '---' || line === '***') {
          return <hr key={idx} className="my-4 border-gray-200" />;
        }

        if (line.startsWith('# ')) {
          return (
            <h3
              key={idx}
              className="text-lg font-extrabold text-gray-900 pt-2 pb-1 border-b border-gray-100"
            >
              {renderInlineMarkdown(line.slice(2))}
            </h3>
          );
        }

        if (line.startsWith('## ')) {
          return (
            <h4
              key={idx}
              className="text-base font-bold text-indigo-950 pt-1.5 flex items-center gap-1.5"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
              <span>{renderInlineMarkdown(line.slice(3))}</span>
            </h4>
          );
        }

        if (line.startsWith('### ')) {
          return (
            <h5 key={idx} className="text-sm font-bold text-gray-900 pt-1">
              {renderInlineMarkdown(line.slice(4))}
            </h5>
          );
        }

        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-blue-600 font-bold select-none">•</span>
              <div className="flex-1">{renderInlineMarkdown(line.slice(2))}</div>
            </div>
          );
        }

        return (
          <p key={idx} className="text-gray-700 leading-relaxed">
            {renderInlineMarkdown(line)}
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
  const [draftMarkdown, setDraftMarkdown] = useState(material.markdownContent);
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
        setDraftMarkdown(res.markdown || '');
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
      const res = await updateLessonMaterialMarkdownAction(
        lessonId,
        classId,
        draftMarkdown,
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
    <div className="space-y-4">
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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

        {isTeacher && (
          <button
            type="button"
            onClick={() => {
              setDraftMarkdown(material.markdownContent);
              setDraftFileName(material.fileName);
              setIsEditing(!isEditing);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition"
          >
            <span>✏️</span>
            <span>{isEditing ? '편집 닫기' : '교안 수정 / 문서 업로드(.docx·.hwp)'}</span>
          </button>
        )}
      </div>

      {/* 교사용 인플레이스 교안 편집 & 파일 업로드 패널 */}
      {isTeacher && isEditing && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-blue-950">
                교안 본문 직접 편집 또는 워드/한글 파일 업로드
              </h3>
              <p className="text-xs text-blue-700/80">
                워드(.docx), 한글(.hwp, .hwpx), 마크다운(.md) 파일을 올리면 텍스트가 자동 추출됩니다.
              </p>
            </div>

            <div>
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
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-50 transition"
              >
                <span>📂 {fileUploading ? '파일 추출 중...' : '파일 불러오기 (.docx / .hwp / .md)'}</span>
              </label>
            </div>
          </div>

          <textarea
            rows={10}
            value={draftMarkdown}
            onChange={(e) => setDraftMarkdown(e.target.value)}
            placeholder="# 수업 교안 본문을 입력하거나 워드/한글 파일을 업로드하세요."
            className="w-full rounded-xl border border-gray-200 bg-white p-4 font-mono text-xs text-gray-800 leading-relaxed focus:border-blue-500 focus:outline-none"
          />

          <div className="flex justify-end gap-2">
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
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '교안 변경사항 저장'}
            </button>
          </div>
        </div>
      )}

      {/* 1. 마크다운/문서 교안 뷰어 */}
      {material.markdownContent.trim() ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
          <SimpleMarkdownRenderer content={material.markdownContent} />
        </div>
      ) : material.materialType === 'html' && material.htmlContent.trim() ? (
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
              <strong className="text-gray-700">[교안 수정 / 문서 업로드]</strong> 버튼을 눌러 워드(.docx), 한글(.hwp/.hwpx) 또는 마크다운 교안을 등록해 보세요.
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
