'use client';

import { useState } from 'react';
import { Submission, SubmissionType } from '@/types/database.types';
import GroupQuestionModal from '@/components/GroupQuestionModal';
import { requestAiCluster } from '@/app/groups/actions';

interface QuestionBoardProps {
  submissions: Submission[];
  currentUserId: string;
  isTeacher: boolean;
  lessonId: string;
  classId: string;
  learningObjective: string;
}

type FilterType = 'all' | SubmissionType;

const TYPE_CONFIG: Record<
  SubmissionType,
  { label: string; icon: string; bg: string; text: string; border: string }
> = {
  question: {
    label: '궁금한 질문',
    icon: '❓',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  confusion: {
    label: '헷갈리는 지점',
    icon: '💭',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  explore: {
    label: '더 알고 싶은 점',
    icon: '💡',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  understood: {
    label: '이해 완료',
    icon: '✅',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
};

export default function QuestionBoard({
  submissions,
  currentUserId,
  isTeacher,
  lessonId,
  classId,
  learningObjective,
}: QuestionBoardProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const filteredSubmissions =
    activeFilter === 'all'
      ? submissions
      : submissions.filter((s) => s.type === activeFilter);

  // 유형별 카운트 계산
  const counts = submissions.reduce(
    (acc, curr) => {
      acc[curr.type] = (acc[curr.type] || 0) + 1;
      return acc;
    },
    { question: 0, confusion: 0, explore: 0, understood: 0 } as Record<
      SubmissionType,
      number
    >
  );

  function toggleSelect(id: string) {
    setSelectedSubIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  const selectedSubmissions = submissions.filter((s) =>
    selectedSubIds.includes(s.id)
  );

  // Gemini AI 대표 질문 자동 클러스터링 호출
  async function handleAiClustering() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await requestAiCluster(lessonId, learningObjective);
      if (!res.success || !res.groups || res.groups.length === 0) {
        setAiError(res.error || 'AI 분석에 실패했습니다.');
      } else {
        // 첫 번째 추천 그룹 자동 반영
        const first = res.groups[0];
        setSelectedSubIds(first.submission_ids);
        setModalTitle(first.representative_title);
        setModalContent(first.representative_content);
        setIsModalOpen(true);
      }
    } catch {
      setAiError('AI 요청 중 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 상단 보드 타이틀 및 안내 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">우리 반 질문 보드</h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
              총 {submissions.length}건
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isTeacher
              ? '학생들의 질문을 체크하여 대표 질문으로 묶거나, Gemini AI의 자동 묶기 추천을 받아보세요.'
              : '동료 친구들의 솔직한 질문입니다. 편안한 마음으로 읽고 함께 고민해 보세요.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isTeacher && (
            <button
              onClick={handleAiClustering}
              disabled={aiLoading || submissions.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition"
            >
              <span>✨</span>
              <span>{aiLoading ? 'AI 분석 중...' : 'Gemini로 질문 묶기 추천'}</span>
            </button>
          )}

          <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
            {isTeacher ? (
              <span>🔒 교사 실명 모드</span>
            ) : (
              <span>🛡️ 동료 100% 익명 모드</span>
            )}
          </div>
        </div>
      </div>

      {aiError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-center justify-between">
          <span>⚠️ {aiError} (.env.local의 GEMINI_API_KEY를 확인하세요)</span>
          <button
            onClick={() => setAiError(null)}
            className="text-amber-500 hover:text-amber-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 필터 탭 바 */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 pb-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            activeFilter === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체 ({submissions.length})
        </button>

        <button
          onClick={() => setActiveFilter('question')}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            activeFilter === 'question'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          ❓ 궁금한 질문 ({counts.question})
        </button>

        <button
          onClick={() => setActiveFilter('confusion')}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            activeFilter === 'confusion'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          💭 헷갈리는 점 ({counts.confusion})
        </button>

        <button
          onClick={() => setActiveFilter('explore')}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            activeFilter === 'explore'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
          }`}
        >
          💡 더 알고 싶은 점 ({counts.explore})
        </button>

        <button
          onClick={() => setActiveFilter('understood')}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            activeFilter === 'understood'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          ✅ 이해 완료 ({counts.understood})
        </button>
      </div>

      {/* 질문 카드 그리드 */}
      {filteredSubmissions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredSubmissions.map((sub) => {
            const cfg = TYPE_CONFIG[sub.type];
            const isMine = sub.student_id === currentUserId;
            const displayName = isTeacher
              ? sub.student?.name || '익명 학생'
              : isMine
              ? '나의 제출'
              : '익명 친구';
            const isSelected = selectedSubIds.includes(sub.id);

            return (
              <div
                key={sub.id}
                onClick={() => isTeacher && toggleSelect(sub.id)}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20'
                    : isMine
                    ? 'border-blue-300'
                    : 'border-gray-200'
                }`}
              >
                <div>
                  {/* 카드 헤더 */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {isTeacher && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(sub.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                      )}

                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}
                      >
                        <span>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </span>

                      {isMine && !isTeacher && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                          내 질문
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-gray-400">
                      {new Date(sub.created_at).toLocaleDateString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* 질문 내용 */}
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
                    {sub.content}
                  </p>
                </div>

                {/* 카드 푸터 */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <span className="text-sm">
                      {isTeacher ? '👤' : isMine ? '🙋' : '🎭'}
                    </span>
                    <span className={isMine ? 'font-bold text-blue-600' : 'font-medium'}>
                      {displayName}
                    </span>
                  </div>

                  {isTeacher && (
                    <span className="text-[11px] text-gray-400">
                      {isSelected ? '선택됨 ✓' : '클릭하여 선택'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="text-4xl mb-3">📬</div>
          <h3 className="text-base font-bold text-gray-700">
            {activeFilter === 'all'
              ? '아직 등록된 질문이 없습니다'
              : '해당 유형의 질문이 아직 없습니다'}
          </h3>
        </div>
      )}

      {/* 교사용 하단 플로팅 선택 액션 바 */}
      {isTeacher && selectedSubIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl bg-gray-900/95 px-5 py-3 shadow-2xl backdrop-blur-sm text-white">
          <div className="text-xs font-semibold">
            <span className="text-blue-400 font-extrabold">{selectedSubIds.length}개</span>
            <span>의 질문 선택됨</span>
          </div>

          <button
            onClick={() => {
              setModalTitle('');
              setModalContent('');
              setIsModalOpen(true);
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-500 transition"
          >
            선택한 질문으로 대표 질문 만들기
          </button>

          <button
            onClick={() => setSelectedSubIds([])}
            className="rounded-lg p-1 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* 대표 질문 생성 모달 */}
      <GroupQuestionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSubIds([]);
        }}
        lessonId={lessonId}
        classId={classId}
        selectedSubmissions={selectedSubmissions}
        defaultTitle={modalTitle}
        defaultContent={modalContent}
      />
    </div>
  );
}
