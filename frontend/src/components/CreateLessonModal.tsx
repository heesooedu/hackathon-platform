'use client';

import { useState } from 'react';
import { createLesson } from '@/app/lessons/actions';
import { QUADRATIC_FUNCTION_HTML } from '@/utils/sampleMaterials';

export default function CreateLessonModal({ classId }: { classId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMaterial, setShowMaterial] = useState(false);

  // 폼 입력 상태
  const [title, setTitle] = useState('');
  const [learningObjective, setLearningObjective] = useState('');
  const [materialHtml, setMaterialHtml] = useState('');

  function fillSampleMaterial() {
    setTitle('3차시: 이차함수 y=ax²+bx+c의 그래프와 계수의 역할');
    setLearningObjective('계수 a, b, c의 변화에 따른 포물선의 모양, 꼭짓점, 대칭축의 변화를 시뮬레이터로 관찰하고 설명할 수 있다.');
    setMaterialHtml(QUADRATIC_FUNCTION_HTML);
    setShowMaterial(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set('class_id', classId);
    formData.set('title', title);
    formData.set('learning_objective', learningObjective);
    formData.set('material_html', materialHtml);

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
        <span>새 레슨 개설</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">새 수업 레슨 개설</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  학생들이 질문과 이해도를 제출할 수업 차시를 만듭니다.
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

            {/* 원클릭 예시 채우기 버튼 */}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={fillSampleMaterial}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
              >
                <span>💡 [이차함수 그래프] 예시 데이터 자동 입력</span>
              </button>
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="title">
                  레슨 제목 *
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 1차시: 알고리즘과 조건문의 기초"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="learning_objective">
                  학습 목표 *
                </label>
                <textarea
                  id="learning_objective"
                  name="learning_objective"
                  required
                  rows={2}
                  value={learningObjective}
                  onChange={(e) => setLearningObjective(e.target.value)}
                  placeholder="예: 일상 속 선택 상황을 순서도로 표현하고 if 조건 분기를 이해한다."
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="deadline">
                  질문 제출 마감 일시 (선택)
                </label>
                <input
                  id="deadline"
                  name="deadline"
                  type="datetime-local"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-xs text-gray-400">
                  마감 기한이 지나면 학생들의 새 질문 제출이 자동으로 마감됩니다.
                </p>
              </div>

              {/* 인터랙티브 웹 교안 슬롯 (선택) */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                <button
                  type="button"
                  onClick={() => setShowMaterial(!showMaterial)}
                  className="flex w-full items-center justify-between text-left text-xs font-semibold text-gray-700"
                >
                  <span className="flex items-center gap-1.5">
                    <span>✨</span>
                    <span>인터랙티브 웹 교안 코드 등록 (HTML/CSS/JS)</span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">선택</span>
                  </span>
                  <span>{showMaterial ? '▲ 접기' : '▼ 펼치기'}</span>
                </button>

                {showMaterial && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500">
                      바이브 코딩으로 제작한 단일 HTML 파일이나 시뮬레이션 위젯 코드를 붙여넣으세요. 학생 화면에 안전한 샌드박스로 렌더링됩니다.
                    </p>
                    <textarea
                      name="material_html"
                      rows={6}
                      value={materialHtml}
                      onChange={(e) => setMaterialHtml(e.target.value)}
                      placeholder="<!DOCTYPE html><html>...</html> 또는 <style>...<script>..."
                      className="w-full font-mono text-xs rounded-xl border border-gray-200 bg-white p-3 text-gray-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                )}
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
                  disabled={loading}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '개설 중...' : '레슨 개설하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
