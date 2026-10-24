'use client';

import { useState, useRef } from 'react';
import { createLesson, parseMaterialFileAction } from '@/app/lessons/actions';
import {
  QUADRATIC_FUNCTION_HTML,
  SAMPLE_GENERAL_MARKDOWN,
  SAMPLE_MATH_MARKDOWN,
} from '@/utils/sampleMaterials';
import { MaterialType } from '@/types/database.types';

export default function CreateLessonModal({ classId }: { classId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileParsing, setFileParsing] = useState(false);

  // 폼 입력 상태
  const [title, setTitle] = useState('');
  const [learningObjective, setLearningObjective] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('markdown');
  const [materialMarkdown, setMaterialMarkdown] = useState('');
  const [materialHtml, setMaterialHtml] = useState('');
  const [materialFileName, setMaterialFileName] = useState<string | null>(null);
  const [uploadSuccessBadge, setUploadSuccessBadge] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function fillGeneralMarkdownSample() {
    setTitle('2차시: 시민 혁명과 기본권(참정권·사회권)의 확장');
    setLearningObjective(
      '천부인권 사상과 시민 혁명의 의의를 이해하고, 초기 시민 혁명의 한계가 참정권 확대 운동 및 사회권 등장으로 이어진 과정을 설명할 수 있다.'
    );
    setMaterialType('markdown');
    setMaterialMarkdown(SAMPLE_GENERAL_MARKDOWN);
    setMaterialFileName('2차시_시민혁명과_인권확장_교안.hwpx');
    setUploadSuccessBadge('예시 교안 로드됨 (사회/역사)');
  }

  function fillMathMarkdownSample() {
    setTitle('3차시: 이차함수 y=ax²+bx+c의 그래프와 계수의 역할');
    setLearningObjective(
      '계수 a, b, c의 부호와 크기에 따른 포물선의 모양, 대칭축, 꼭짓점의 위치 변화를 설명할 수 있다.'
    );
    setMaterialType('markdown');
    setMaterialMarkdown(SAMPLE_MATH_MARKDOWN);
    setMaterialFileName('3차시_이차함수_핵심개념정리.docx');
    setUploadSuccessBadge('예시 교안 로드됨 (수학 마크다운)');
  }

  function fillInteractiveHtmlSample() {
    setTitle('3차시: 이차함수 y=ax²+bx+c의 그래프와 계수의 역할 (시뮬레이터)');
    setLearningObjective(
      '계수 a, b, c의 변화에 따른 포물선의 모양, 꼭짓점, 대칭축의 변화를 시뮬레이터로 관찰하고 설명할 수 있다.'
    );
    setMaterialType('html');
    setMaterialHtml(QUADRATIC_FUNCTION_HTML);
    setMaterialFileName(null);
    setUploadSuccessBadge('인터랙티브 HTML 시뮬레이터 로드됨');
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
        setMaterialMarkdown(res.markdown || '');
        setMaterialFileName(res.fileName || file.name);
        setUploadSuccessBadge(
          `${res.fileName} (${res.formatLabel}) 본문 추출 완료`
        );
        if (!title.trim()) {
          const cleanTitle = file.name.replace(/\.(docx|hwpx|hwp|md|txt)$/i, '');
          setTitle(cleanTitle);
        }
      }
    } catch {
      setErrorMessage('파일 업로드 및 본문 추출 중 오류가 발생했습니다.');
    } finally {
      setFileParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set('class_id', classId);
    formData.set('title', title);
    formData.set('learning_objective', learningObjective);
    formData.set('material_type', materialType);
    formData.set('material_markdown', materialMarkdown);
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
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        <span className="text-base font-bold">+</span>
        <span>새 레슨 & 교안 등록</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  새 수업 레슨 & 교안 개설
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  워드(.docx), 한글(.hwp/.hwpx), 마크다운 교안을 업로드하면 학생 질문과 대조하여 교안 패치 및 형성평가를 자동 생성합니다.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setErrorMessage(null);
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* 원클릭 교과별 예시 채우기 바 */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200/70">
              <span className="text-xs font-semibold text-slate-600">
                💡 원클릭 교안 샘플 채우기:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={fillGeneralMarkdownSample}
                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100"
                >
                  <span>📘 인문/사회 교안 (.hwpx 예시)</span>
                </button>
                <button
                  type="button"
                  onClick={fillMathMarkdownSample}
                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100"
                >
                  <span>📐 수학 개념 교안 (.docx 예시)</span>
                </button>
                <button
                  type="button"
                  onClick={fillInteractiveHtmlSample}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <span>⚡ 인터랙티브 시뮬레이터 (HTML)</span>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100 font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  className="block text-sm font-semibold text-gray-700 mb-1"
                  htmlFor="title"
                >
                  레슨 제목 *
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2차시: 시민 혁명과 기본권의 확장"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  className="block text-sm font-semibold text-gray-700 mb-1"
                  htmlFor="learning_objective"
                >
                  학습 목표 *
                </label>
                <textarea
                  id="learning_objective"
                  name="learning_objective"
                  required
                  rows={2}
                  value={learningObjective}
                  onChange={(e) => setLearningObjective(e.target.value)}
                  placeholder="예: 시민 혁명의 한계와 참정권 확대 과정을 설명할 수 있다."
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* 교안 등록 영역 (모든 교과용 마크다운/문서 파일 업로드 vs 인터랙티브 HTML) */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <span>📄</span>
                      <span>수업 교안 등록 (AI 취약점 분석 & 패치 대상)</span>
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      학생들에게 보여줄 수업 자료입니다. 학생 질문 수집 후 AI가 이 교안의 부족한 점을 진단하고 패치합니다.
                    </p>
                  </div>

                  {/* 포맷 전환 탭 */}
                  <div className="inline-flex rounded-xl bg-gray-200/70 p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMaterialType('markdown')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        materialType === 'markdown'
                          ? 'bg-white text-blue-700 shadow-2xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📝 마크다운 / 문서 업로드
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaterialType('html')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        materialType === 'html'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      ⚡ HTML 시뮬레이터
                    </button>
                  </div>
                </div>

                {materialType === 'markdown' ? (
                  <div className="space-y-3">
                    {/* 워드 / 한글 / 마크다운 파일 업로드 박스 */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-blue-300 bg-white p-3">
                      <div className="text-xs text-gray-600">
                        <span className="font-bold text-blue-700">
                          📂 교안 파일 불러오기:
                        </span>{' '}
                        MS 워드(<code className="text-gray-800">.docx</code>), 한글(
                        <code className="text-gray-800">.hwp</code>,{' '}
                        <code className="text-gray-800">.hwpx</code>), 마크다운(
                        <code className="text-gray-800">.md</code>,{' '}
                        <code className="text-gray-800">.txt</code>) 지원
                      </div>

                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".docx,.hwp,.hwpx,.md,.markdown,.txt"
                          onChange={handleFileChange}
                          className="hidden"
                          id="material-file-upload"
                        />
                        <label
                          htmlFor="material-file-upload"
                          className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition"
                        >
                          <span>{fileParsing ? '⏳ 문서 추출 중...' : '파일 선택 (.docx / .hwp / .md)'}</span>
                        </label>
                      </div>
                    </div>

                    {uploadSuccessBadge && (
                      <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800 font-semibold">
                        <span>✅ {uploadSuccessBadge}</span>
                        {materialFileName && (
                          <button
                            type="button"
                            onClick={() => {
                              setMaterialFileName(null);
                              setUploadSuccessBadge(null);
                            }}
                            className="text-emerald-600 hover:underline text-[11px]"
                          >
                            파일명 표시 제거
                          </button>
                        )}
                      </div>
                    )}

                    <textarea
                      name="material_markdown"
                      rows={9}
                      value={materialMarkdown}
                      onChange={(e) => setMaterialMarkdown(e.target.value)}
                      placeholder={
                        '# 1. 핵심 개념 정리\n교안 내용을 마크다운이나 일반 텍스트로 작성하거나, 위 버튼으로 워드(.docx) 또는 한글(.hwp, .hwpx) 파일을 업로드하세요.'
                      }
                      className="w-full font-mono text-xs rounded-xl border border-gray-200 bg-white p-3.5 text-gray-800 leading-relaxed transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">
                      단일 HTML/CSS/JS 시뮬레이션 위젯 코드를 붙여넣으세요. 학생 화면에 안전한 샌드박스로 렌더링됩니다.
                    </p>
                    <textarea
                      name="material_html"
                      rows={8}
                      value={materialHtml}
                      onChange={(e) => setMaterialHtml(e.target.value)}
                      placeholder="<!DOCTYPE html><html>...</html>"
                      className="w-full font-mono text-xs rounded-xl border border-gray-200 bg-white p-3 text-gray-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                )}
              </div>

              <div>
                <label
                  className="block text-sm font-semibold text-gray-700 mb-1"
                  htmlFor="deadline"
                >
                  질문 제출 마감 일시 (선택)
                </label>
                <input
                  id="deadline"
                  name="deadline"
                  type="datetime-local"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading || fileParsing}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '개설 중...' : '레슨 & 교안 개설하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
