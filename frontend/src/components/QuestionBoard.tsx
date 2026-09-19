'use client';

import { useState } from 'react';
import { Submission, SubmissionType } from '@/types/database.types';

interface QuestionBoardProps {
  submissions: Submission[];
  currentUserId: string;
  isTeacher: boolean;
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
}: QuestionBoardProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

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
              ? '학생들이 제출한 질문과 생각들입니다. 유사한 질문을 대표 질문으로 묶을 수 있습니다.'
              : '동료 친구들의 솔직한 질문입니다. 편안한 마음으로 읽고 함께 고민해 보세요.'}
          </p>
        </div>

        <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 self-start sm:self-auto">
          {isTeacher ? (
            <span>🔒 교사 화면 (학생 실명 확인 모드)</span>
          ) : (
            <span>🛡️ 동료 질문 (100% 익명 안심 모드)</span>
          )}
        </div>
      </div>

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
            // 익명성 원칙: 학생에게는 무조건 '익명 친구', 교사에게만 실명 표시
            const displayName = isTeacher
              ? sub.student?.name || '익명 학생'
              : isMine
              ? '나의 제출'
              : '익명 친구';

            return (
              <div
                key={sub.id}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
                  isMine ? 'border-blue-300 ring-2 ring-blue-50' : 'border-gray-200'
                }`}
              >
                <div>
                  {/* 카드 헤더 */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
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

                {/* 카드 푸터 (작성자 & 다음 단계 액션 슬롯) */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <span className="text-sm">
                      {isTeacher ? '👤' : isMine ? '🙋' : '🎭'}
                    </span>
                    <span className={isMine ? 'font-bold text-blue-600' : 'font-medium'}>
                      {displayName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isTeacher ? (
                      <span className="text-[11px] text-gray-400">
                        6단계: 대표 질문 묶기 준비
                      </span>
                    ) : (
                      <span className="text-[11px] text-blue-600 font-semibold">
                        7단계: 동료 답변 준비
                      </span>
                    )}
                  </div>
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
          <p className="mt-1 text-sm text-gray-400">
            {isTeacher
              ? '학생들이 질문을 제출하면 여기에 실시간으로 표시됩니다.'
              : '수업을 들으며 궁금했던 점을 위에 있는 폼에 남겨보세요!'}
          </p>
        </div>
      )}
    </div>
  );
}
