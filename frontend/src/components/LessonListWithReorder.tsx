'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Lesson } from '@/types/database.types';
import { reorderLessonsAction } from '@/app/lessons/actions';
import { hasActualLessonMaterial } from '@/utils/materialPayload';
import ToggleLessonStatusButton from '@/components/ToggleLessonStatusButton';
import LessonManageActions from '@/components/LessonManageActions';

interface LessonListWithReorderProps {
  classId: string;
  initialLessons: Lesson[];
  isTeacher: boolean;
}

export default function LessonListWithReorder({
  classId,
  initialLessons,
  isTeacher,
}: LessonListWithReorderProps) {
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setLessons(initialLessons);
  }, [initialLessons]);

  async function persistNewOrder(updatedLessons: Lesson[]) {
    setLessons(updatedLessons);
    if (!isTeacher) return;

    setSavingOrder(true);
    setSavedNotice(false);
    try {
      const res = await reorderLessonsAction(
        classId,
        updatedLessons.map((l) => l.id)
      );
      if (res.success) {
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2200);
      } else {
        alert(res.error || '교안 순서 저장 중 오류가 발생했습니다.');
      }
    } finally {
      setSavingOrder(false);
    }
  }

  function moveLessonByStep(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= lessons.length) return;
    const next = [...lessons];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    persistNewOrder(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-gray-900">수업 레슨 & 교안 목록</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
            총 {lessons.length}차시
          </span>
        </div>

        {isTeacher && lessons.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            {savingOrder ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 font-bold text-blue-700">
                ⏳ 순서 저장 중...
              </span>
            ) : savedNotice ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 font-bold text-emerald-700">
                ✅ 교안 순서가 저장되었습니다
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                <span>⋮⋮</span>
                <span>카드를 마우스로 드래그하여 교안 순서를 자유롭게 변경하세요</span>
              </span>
            )}
          </div>
        )}
      </div>

      {lessons.length > 0 ? (
        <div className="space-y-3">
          {lessons.map((lesson, idx) => {
            const isDeadlinePassed = lesson.deadline
              ? new Date(lesson.deadline) < new Date()
              : false;
            const isClosed = lesson.status === 'closed' || isDeadlinePassed;
            const hasMaterial = hasActualLessonMaterial(lesson);
            const isBeingDragged = draggedIdx === idx;
            const isDragTarget = dragOverIdx === idx && draggedIdx !== idx;

            return (
              <div
                key={lesson.id}
                draggable={isTeacher}
                onDragStart={(e) => {
                  if (!isTeacher) return;
                  setDraggedIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', lesson.id);
                }}
                onDragOver={(e) => {
                  if (!isTeacher || draggedIdx === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIdx !== idx) {
                    setDragOverIdx(idx);
                  }
                }}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                onDrop={(e) => {
                  if (!isTeacher || draggedIdx === null) return;
                  e.preventDefault();
                  const fromIdx = draggedIdx;
                  const toIdx = idx;
                  setDraggedIdx(null);
                  setDragOverIdx(null);

                  if (fromIdx === toIdx) return;
                  const next = [...lessons];
                  const [moved] = next.splice(fromIdx, 1);
                  next.splice(toIdx, 0, moved);
                  persistNewOrder(next);
                }}
                className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition-all ${
                  isBeingDragged
                    ? 'opacity-45 scale-[0.99] border-blue-400 bg-blue-50/20'
                    : isDragTarget
                    ? 'border-2 border-blue-500 ring-4 ring-blue-100 -translate-y-0.5 shadow-md'
                    : 'border-gray-100 hover:border-blue-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* 교사용 드래그 핸들 & 위/아래 순서 버튼 */}
                    {isTeacher && (
                      <div className="flex flex-col items-center gap-0.5 pt-0.5 select-none shrink-0">
                        <div
                          title="마우스로 잡고 위아래로 드래그하여 교안 순서 변경"
                          className="flex h-8 w-7 cursor-grab active:cursor-grabbing items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition font-bold text-sm"
                        >
                          ⋮⋮
                        </div>
                        {lessons.length > 1 && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <button
                              type="button"
                              disabled={idx === 0 || savingOrder}
                              onClick={() => moveLessonByStep(idx, -1)}
                              title="위로 한 칸 이동"
                              className="rounded px-1 py-0.5 text-[10px] font-bold text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={idx === lessons.length - 1 || savingOrder}
                              onClick={() => moveLessonByStep(idx, 1)}
                              title="아래로 한 칸 이동"
                              className="rounded px-1 py-0.5 text-[10px] font-bold text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
                            >
                              ▼
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-600">
                          #{idx + 1}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isClosed
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isClosed ? '🔴 마감됨' : '🟢 질문 접수 중'}
                        </span>
                        {hasMaterial && (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-100">
                            📖 수업 교안 포함
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/classes/${classId}/lessons/${lesson.id}`}
                        className="text-lg font-bold text-gray-900 hover:text-blue-600 transition block truncate"
                      >
                        {lesson.title}
                      </Link>
                      <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                        🎯 {lesson.learning_objective}
                      </p>
                    </div>
                  </div>

                  {isTeacher && (
                    <div className="shrink-0 flex flex-wrap items-center gap-2">
                      <LessonManageActions
                        lessonId={lesson.id}
                        classId={classId}
                        lessonTitle={lesson.title}
                        compact
                      />
                      <ToggleLessonStatusButton
                        lessonId={lesson.id}
                        classId={classId}
                        initialStatus={lesson.status}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
                  <div>
                    {lesson.deadline ? (
                      <span>
                        마감:{' '}
                        {new Date(lesson.deadline).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      <span>마감 기한 없음</span>
                    )}
                  </div>

                  <Link
                    href={`/classes/${classId}/lessons/${lesson.id}`}
                    className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>{isTeacher ? '교안 & 질문 보드 열기' : '교안 보기 & 질문 제출하기'}</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="text-4xl mb-3">📖</div>
          <h3 className="text-base font-bold text-gray-700">
            아직 등록된 레슨이 없습니다
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            {isTeacher
              ? '상단의 [+ 새 레슨 & 노션형 교안 작성] 버튼을 눌러 첫 차시를 만들어 보세요.'
              : '선생님이 레슨을 개설하면 여기에 수업 교안과 질문 제출란이 나타납니다.'}
          </p>
        </div>
      )}
    </div>
  );
}
