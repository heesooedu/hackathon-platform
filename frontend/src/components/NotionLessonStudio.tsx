'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { createLesson, parseMaterialFileAction } from '@/app/lessons/actions';
import NotionBlockEditor from '@/components/NotionBlockEditor';
import {
  markdownToBlocks,
  blocksToMarkdown,
  NotionBlock,
} from '@/utils/notionBlocks';
import { SimpleMarkdownRenderer } from '@/components/LessonMaterialViewer';
import {
  QUADRATIC_FUNCTION_HTML,
  SAMPLE_GENERAL_MARKDOWN,
  SAMPLE_MATH_MARKDOWN,
  SAMPLE_PHYSICS_MARKDOWN,
} from '@/utils/sampleMaterials';
import { MaterialType } from '@/types/database.types';

const PAGE_ICONS = ['📖', '📘', '📐', '🧪', '🌍', '🏛️', '🎨', '💻', '📝', '🎓'];

interface NotionLessonStudioProps {
  classId: string;
  className: string;
}

export default function NotionLessonStudio({
  classId,
  className,
}: NotionLessonStudioProps) {
  const [pageIcon, setPageIcon] = useState('📖');
  const [title, setTitle] = useState('');
  const [learningObjective, setLearningObjective] = useState('');
  const [deadline, setDeadline] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('markdown');
  const [blocks, setBlocks] = useState<NotionBlock[]>(() =>
    markdownToBlocks('')
  );
  const [materialHtml, setMaterialHtml] = useState('');
  const [materialFileName, setMaterialFileName] = useState<string | null>(null);
  const [uploadSuccessBadge, setUploadSuccessBadge] = useState<string | null>(null);

  const [previewMode, setPreviewMode] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(true);
  const [fileParsing, setFileParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function cyclePageIcon() {
    const nextIdx = (PAGE_ICONS.indexOf(pageIcon) + 1) % PAGE_ICONS.length;
    setPageIcon(PAGE_ICONS[nextIdx]);
  }

  function applySampleTemplate(type: 'general' | 'math' | 'physics' | 'html') {
    setErrorMessage(null);
    setPreviewMode(false);
    if (type === 'general') {
      setPageIcon('🏛️');
      setTitle('2차시: 시민 혁명과 기본권(참정권·사회권)의 확장');
      setLearningObjective(
        '천부인권 사상과 시민 혁명의 의의를 이해하고, 초기 시민 혁명의 한계가 참정권 확대 운동 및 사회권 등장으로 이어진 과정을 설명할 수 있다.'
      );
      setMaterialType('markdown');
      setBlocks(markdownToBlocks(SAMPLE_GENERAL_MARKDOWN));
      setMaterialFileName('2차시_시민혁명과_인권확장_교안.hwpx');
      setUploadSuccessBadge('인문/사회 노션 교안 템플릿 로드됨');
    } else if (type === 'math') {
      setPageIcon('📐');
      setTitle('3차시: 이차함수 y=ax²+bx+c의 그래프와 계수의 역할');
      setLearningObjective(
        '계수 a, b, c의 부호와 크기에 따른 포물선의 모양, 대칭축, 꼭짓점의 위치 변화를 설명할 수 있다.'
      );
      setMaterialType('markdown');
      setBlocks(markdownToBlocks(SAMPLE_MATH_MARKDOWN));
      setMaterialFileName('3차시_이차함수_핵심개념정리.docx');
      setUploadSuccessBadge('수학 개념 노션 교안 템플릿 로드됨');
    } else if (type === 'physics') {
      setPageIcon('🧪');
      setTitle('4차시: 포물선 운동의 수평·연직 성분 분해와 투사체 실험');
      setLearningObjective(
        '포물선 운동을 수평 등속도 운동과 연직 등가속도 운동으로 분해하여 이해하고, 초기 속력과 발사각에 따른 운동 궤적을 시뮬레이션으로 탐구할 수 있다.'
      );
      setMaterialType('markdown');
      setBlocks(markdownToBlocks(SAMPLE_PHYSICS_MARKDOWN));
      setMaterialFileName('4차시_물리_포물선운동_노션실험교안.md');
      setUploadSuccessBadge('물리 노션 교안(인라인 JS 운동 시뮬레이션 포함) 로드됨');
    } else {
      setPageIcon('⚡');
      setTitle('3차시: 이차함수 y=ax²+bx+c의 그래프와 계수의 역할 (시뮬레이터)');
      setLearningObjective(
        '계수 a, b, c의 변화에 따른 포물선의 모양, 꼭짓점, 대칭축의 변화를 시뮬레이터로 관찰하고 설명할 수 있다.'
      );
      setMaterialType('html');
      setMaterialHtml(QUADRATIC_FUNCTION_HTML);
      setMaterialFileName(null);
      setUploadSuccessBadge('인터랙티브 HTML 시뮬레이터 로드됨');
    }
  }

  async function handleDocumentImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setUploadSuccessBadge(null);
    setFileParsing(true);

    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await parseMaterialFileAction(fd);

      if (!res.success || !('markdown' in res)) {
        setErrorMessage(res.error || '파일에서 텍스트를 추출하지 못했습니다.');
      } else {
        setMaterialType('markdown');
        setBlocks(markdownToBlocks(res.markdown || ''));
        setMaterialFileName(res.fileName || file.name);
        setUploadSuccessBadge(
          `${res.fileName} (${res.formatLabel}) → 노션 블록으로 변환 완료`
        );
        if (!title.trim()) {
          const cleanTitle = file.name.replace(/\.(docx|hwpx|hwp|md|txt)$/i, '');
          setTitle(cleanTitle);
        }
      }
    } catch {
      setErrorMessage('문서 파일 변환 중 오류가 발생했습니다.');
    } finally {
      setFileParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handlePublish() {
    if (!title.trim()) {
      setErrorMessage('페이지 상단에 수업(레슨) 제목을 입력해 주세요.');
      return;
    }
    if (!learningObjective.trim()) {
      setErrorMessage('수업 속성란의 학습 목표를 입력해 주세요.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const serializedMarkdown = blocksToMarkdown(blocks);

    const formData = new FormData();
    formData.set('class_id', classId);
    formData.set('title', title.trim());
    formData.set('learning_objective', learningObjective.trim());
    formData.set('deadline', deadline);
    formData.set('material_type', materialType);
    formData.set('material_markdown', serializedMarkdown);
    formData.set('material_html', materialHtml);
    formData.set('material_file_name', materialFileName || '');

    try {
      const result = await createLesson(formData);
      if (result?.error) {
        setErrorMessage(result.error);
        setLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
        return;
      }
      setErrorMessage('레슨 개설 중 오류가 발생했습니다.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] pb-28">
      {/* 1. 노션 스타일 상단 고정 네비게이션 & 액션 바 */}
      <div className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
        <div
          className={`mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8 transition-all duration-300 ${
            isFullWidth ? 'max-w-[96vw]' : 'max-w-5xl'
          }`}
        >
          {/* 좌측 브레드크럼 */}
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link
              href={`/classes/${classId}`}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
            >
              <span>←</span>
              <span>{className}</span>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-gray-800 truncate max-w-[220px] sm:max-w-md">
              <span>{pageIcon}</span>
              <span className="truncate">{title.trim() || '제목 없는 수업 교안'}</span>
            </span>
          </div>

          {/* 우측 컨트롤 버튼 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 노션 스타일 전체 너비(Full Width) 토글 */}
            <button
              type="button"
              onClick={() => setIsFullWidth(!isFullWidth)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                isFullWidth
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="노션 페이지 가로 너비 전환"
            >
              <span>↔️</span>
              <span>{isFullWidth ? '전체 화면 너비 켜짐 (광폭)' : '전체 화면 너비로 넓히기'}</span>
            </button>

            {materialType === 'markdown' && (
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  previewMode
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{previewMode ? '✏️ 편집 모드로 돌아가기' : '👁️ 학생 화면 미리보기'}</span>
              </button>
            )}

            <Link
              href={`/classes/${classId}`}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100"
            >
              취소
            </Link>

            <button
              type="button"
              disabled={loading || fileParsing}
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <span>🚀</span>
              <span>{loading ? '개설 중...' : '수업 교안 발행 & 레슨 개설'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 노션 커버 배너 */}
      <div className="relative h-36 sm:h-44 w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-500 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />
        <div
          className={`mx-auto px-6 h-full flex items-end pb-4 justify-between text-white/90 text-xs transition-all duration-300 ${
            isFullWidth ? 'max-w-[96vw]' : 'max-w-4xl'
          }`}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 backdrop-blur-xs px-3 py-1 font-semibold">
            ✨ 노션형 수업 교안 스튜디오 — 마크다운 문법 없이 블록 클릭과 이미지 드래그로 교안을 완성하세요
          </span>
        </div>
      </div>

      {/* 3. 노션 문서 본문 컨테이너 */}
      <div
        className={`mx-auto px-3 sm:px-6 -mt-10 relative z-10 transition-all duration-300 ${
          isFullWidth ? 'max-w-[96vw]' : 'max-w-4xl'
        }`}
      >
        <div className="rounded-3xl border border-gray-200/90 bg-white p-6 sm:p-10 lg:p-14 shadow-sm space-y-8">
          {/* 페이지 아이콘 + 원클릭 샘플 템플릿 바 */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <button
              type="button"
              onClick={cyclePageIcon}
              title="클릭하여 페이지 아이콘 변경"
              className="group relative flex h-20 w-20 items-center justify-center rounded-2xl border border-gray-200 bg-white text-5xl shadow-md hover:scale-105 transition select-none"
            >
              <span>{pageIcon}</span>
              <span className="absolute -bottom-2 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition">
                아이콘 변경
              </span>
            </button>

            {/* 원클릭 샘플 템플릿 & 파일 불러오기 빠른 도구 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 mr-1">
                빠른 시작 템플릿:
              </span>
              <button
                type="button"
                onClick={() => applySampleTemplate('general')}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
              >
                <span>🏛️ 인문·사회 노션 교안 예시</span>
              </button>
              <button
                type="button"
                onClick={() => applySampleTemplate('math')}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
              >
                <span>📐 수학 개념 노션 교안 예시</span>
              </button>
              <button
                type="button"
                onClick={() => applySampleTemplate('physics')}
                className="inline-flex items-center gap-1 rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition"
              >
                <span>🧪 물리 노션 교안 (JS 운동 시뮬레이션 블록 포함)</span>
              </button>
              <button
                type="button"
                onClick={() => applySampleTemplate('html')}
                className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
              >
                <span>⚡ HTML 시뮬레이터 예시</span>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs sm:text-sm font-semibold text-red-600">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* 노션 스타일 대형 페이지 제목 입력 */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="수업(레슨) 제목을 입력하세요..."
              className="w-full border-0 bg-transparent text-2xl sm:text-4xl font-extrabold text-gray-900 placeholder:text-gray-300 focus:outline-none tracking-tight"
            />
          </div>

          {/* 노션 페이지 속성(Properties) 영역: 학습목표, 마감일시, 문서 파일 가져오기, 교안 유형 */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 sm:p-5 space-y-3.5 text-sm">
            {/* 속성 1: 학습 목표 */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-start">
              <div className="sm:col-span-3 flex items-center gap-2 text-xs font-bold text-gray-500 pt-1.5">
                <span>🎯</span>
                <span>학습 목표 (필수)</span>
              </div>
              <div className="sm:col-span-9">
                <textarea
                  rows={2}
                  value={learningObjective}
                  onChange={(e) => setLearningObjective(e.target.value)}
                  placeholder="이 수업을 통해 학생들이 도달해야 할 핵심 학습 목표를 입력하세요 (AI 질문·교안 취약점 분석의 기준이 됩니다)"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 속성 2: 질문 마감 일시 */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center">
              <div className="sm:col-span-3 flex items-center gap-2 text-xs font-bold text-gray-500">
                <span>⏰</span>
                <span>질문 제출 마감</span>
              </div>
              <div className="sm:col-span-9 flex flex-wrap items-center gap-3">
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs sm:text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-gray-400">
                  비워두면 마감 기한 없이 상시 질문을 받습니다.
                </span>
              </div>
            </div>

            {/* 속성 3: 기존 워드/한글 파일 불러오기 & 교안 모드 */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center pt-1 border-t border-gray-200/60">
              <div className="sm:col-span-3 flex items-center gap-2 text-xs font-bold text-gray-500">
                <span>📂</span>
                <span>문서 파일 변환</span>
              </div>
              <div className="sm:col-span-9 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.hwp,.hwpx,.md,.markdown,.txt"
                    onChange={handleDocumentImport}
                    className="hidden"
                    id="notion-studio-doc-import"
                  />
                  <label
                    htmlFor="notion-studio-doc-import"
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-50 transition"
                  >
                    <span>
                      📄{' '}
                      {fileParsing
                        ? '문서 변환 중...'
                        : '워드(.docx) · 한글(.hwp/.hwpx) 파일을 노션 블록으로 불러오기'}
                    </span>
                  </label>

                  {uploadSuccessBadge && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      <span>✅ {uploadSuccessBadge}</span>
                    </span>
                  )}
                </div>

                {/* 노션 블록 문서 vs HTML 시뮬레이터 전환 */}
                <div className="inline-flex rounded-xl bg-gray-200/75 p-0.5">
                  <button
                    type="button"
                    onClick={() => setMaterialType('markdown')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      materialType === 'markdown'
                        ? 'bg-white text-gray-900 shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📝 노션 블록 교안
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialType('html')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      materialType === 'html'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ⚡ HTML 시뮬레이터
                  </button>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 4. 노션 블록 에디터 본문 영역 */}
          {materialType === 'markdown' ? (
            previewMode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-indigo-50/80 border border-indigo-200 px-4 py-2.5 text-xs text-indigo-900">
                  <span className="font-bold">
                    👁️ 학생들에게 보여질 실제 수업 교안 페이지 미리보기입니다.
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(false)}
                    className="font-extrabold text-indigo-700 underline"
                  >
                    편집 계속하기 →
                  </button>
                </div>
                <div className="rounded-2xl border border-gray-200 p-6 sm:p-8 bg-white">
                  {blocksToMarkdown(blocks).trim() ? (
                    <SimpleMarkdownRenderer content={blocksToMarkdown(blocks)} />
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-12">
                      아직 작성된 교안 블록이 없습니다.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <NotionBlockEditor
                blocks={blocks}
                onChange={(newBlocks) => setBlocks(newBlocks)}
              />
            )
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-4 text-xs text-indigo-950">
                <p className="font-bold">⚡ 인터랙티브 HTML/JS 시뮬레이터 모드</p>
                <p className="text-indigo-700 mt-0.5">
                  단일 HTML/CSS/JS 코드를 붙여넣으면 학생 화면에 안전한 샌드박스 위젯으로 실행됩니다.
                </p>
              </div>
              <textarea
                rows={14}
                value={materialHtml}
                onChange={(e) => setMaterialHtml(e.target.value)}
                placeholder="<!DOCTYPE html><html>...</html>"
                className="w-full rounded-2xl border border-gray-200 bg-slate-950 p-4 font-mono text-xs text-emerald-300 leading-relaxed focus:border-indigo-500 focus:outline-none"
              />
              {materialHtml.trim() && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-600">실시간 시뮬레이터 미리보기</p>
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <iframe
                      srcDoc={materialHtml}
                      sandbox="allow-scripts"
                      className="h-[480px] w-full border-0"
                      title="Interactive Simulator Preview"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
