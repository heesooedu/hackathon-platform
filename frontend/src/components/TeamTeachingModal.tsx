'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/types/database.types';
import {
  getAvailableTeachersForInviteAction,
  inviteCoTeacherAction,
  removeCoTeacherAction,
} from '@/app/classes/actions';

interface TeamTeachingModalProps {
  classId: string;
  classNameTitle: string;
  joinCode: string;
  primaryTeacher: {
    id: string;
    name: string;
  };
  coTeachers: Profile[];
  currentUserId: string;
  isOwner: boolean;
}

export default function TeamTeachingModal({
  classId,
  classNameTitle,
  joinCode,
  primaryTeacher,
  coTeachers,
  currentUserId,
  isOwner,
}: TeamTeachingModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [availableTeachers, setAvailableTeachers] = useState<Profile[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [invitingTeacherId, setInvitingTeacherId] = useState<string | null>(null);
  const [removingTeacherId, setRemovingTeacherId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingDirectory(true);
    getAvailableTeachersForInviteAction(classId)
      .then((res) => {
        if (!cancelled) {
          setAvailableTeachers(res.teachers || []);
          setLoadingDirectory(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingDirectory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, classId, coTeachers.length]);

  const handleInviteByInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await inviteCoTeacherAction(classId, identifier.trim());
      if (res.error) {
        setFeedback({ type: 'error', text: res.error });
        return;
      }
      setIdentifier('');
      setFeedback({
        type: 'success',
        text: `${res.teacherName} 선생님을 팀티칭 공동 교사로 초대했습니다!`,
      });
      const updated = await getAvailableTeachersForInviteAction(classId);
      setAvailableTeachers(updated.teachers || []);
      router.refresh();
    });
  };

  const handleQuickInvite = (teacher: Profile) => {
    setFeedback(null);
    setInvitingTeacherId(teacher.id);

    startTransition(async () => {
      // 1차로 UUID 전달, 만약 구버전 RPC가 이메일/이름만 받으면 이름으로 재시도
      let res = await inviteCoTeacherAction(classId, teacher.id);
      if (res.error && teacher.name) {
        res = await inviteCoTeacherAction(classId, teacher.name);
      }
      setInvitingTeacherId(null);

      if (res.error) {
        setFeedback({ type: 'error', text: res.error });
        return;
      }
      setFeedback({
        type: 'success',
        text: `${teacher.name} 선생님을 팀티칭 공동 교사로 초대했습니다!`,
      });
      setAvailableTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
      router.refresh();
    });
  };

  const handleRemoveCoTeacher = (teacher: Profile) => {
    const isSelf = teacher.id === currentUserId;
    const confirmMsg = isSelf
      ? `'${classNameTitle}' 클래스의 팀티칭(공동 수업)에서 나가시겠습니까?`
      : `${teacher.name} 선생님을 이 클래스의 팀티칭 공동 교사에서 해제하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    setFeedback(null);
    setRemovingTeacherId(teacher.id);

    startTransition(async () => {
      const res = await removeCoTeacherAction(classId, teacher.id);
      setRemovingTeacherId(null);

      if (res.error) {
        setFeedback({ type: 'error', text: res.error });
        return;
      }

      if (isSelf) {
        setIsOpen(false);
        router.push('/');
        router.refresh();
        return;
      }

      setFeedback({
        type: 'success',
        text: `${teacher.name} 선생님의 공동 교사 권한이 해제되었습니다.`,
      });
      const updated = await getAvailableTeachersForInviteAction(classId);
      setAvailableTeachers(updated.teachers || []);
      router.refresh();
    });
  };

  const handleCopyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const filteredDirectory = availableTeachers.filter((t) => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return true;
    return (t.name || '').toLowerCase().includes(q);
  });

  const totalTeachersCount = 1 + coTeachers.length;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFeedback(null);
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3.5 py-2 text-xs font-extrabold text-indigo-700 shadow-xs transition hover:bg-indigo-100"
      >
        <span>🤝 팀티칭 교사 관리</span>
        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-black text-white">
          {totalTeachersCount}명
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/60 px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-indigo-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                    팀티칭 · 공동 수업
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {classNameTitle}
                  </span>
                </div>
                <h2 className="mt-1.5 text-lg font-extrabold text-slate-900">
                  공동 수업 선생님 초대 및 관리
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  초대된 선생님은 수업 개설, 교안 편집, 대표 질문 묶기, 답변 확인 및 학생 관리를 함께 수행할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 본문 (스크롤 영역) */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {feedback && (
                <div
                  className={`rounded-xl border px-4 py-3 text-xs font-bold ${
                    feedback.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {feedback.type === 'success' ? '✅ ' : '⚠️ '}
                  {feedback.text}
                </div>
              )}

              {/* 1. 현재 수업 지도 교사진 */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    현재 참여 중인 선생님 ({totalTeachersCount}명)
                  </h3>
                </div>
                <div className="space-y-2">
                  {/* 대표 개설 교사 */}
                  <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-amber-50/40 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white shadow-xs">
                        {(primaryTeacher.name || '교')[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900">
                            {primaryTeacher.name} 선생님
                          </span>
                          {primaryTeacher.id === currentUserId && (
                            <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                              나
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-amber-800">
                          클래스 개설 및 대표 담당 교사
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-900">
                      👑 대표 교사
                    </span>
                  </div>

                  {/* 공동 수업 교사 목록 */}
                  {coTeachers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-center text-xs text-slate-500">
                      아직 초대된 공동 수업 선생님이 없습니다. 아래에서 동료 선생님을 초대해 보세요!
                    </div>
                  ) : (
                    coTeachers.map((ct) => {
                      const isMe = ct.id === currentUserId;
                      const canRemove = isOwner || isMe;
                      return (
                        <div
                          key={ct.id}
                          className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/30 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white shadow-xs">
                              {(ct.name || '교')[0]}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-extrabold text-slate-900">
                                  {ct.name} 선생님
                                </span>
                                {isMe && (
                                  <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                    나
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-medium text-indigo-700">
                                🤝 팀티칭 공동 수업 교사
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-extrabold text-indigo-800">
                              🤝 공동 교사
                            </span>
                            {canRemove && (
                              <button
                                type="button"
                                disabled={isPending && removingTeacherId === ct.id}
                                onClick={() => handleRemoveCoTeacher(ct)}
                                className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                              >
                                {isPending && removingTeacherId === ct.id
                                  ? '처리 중...'
                                  : isMe
                                  ? '팀티칭 나가기'
                                  : '해제'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 2. 이메일 또는 이름으로 초대 */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-xs font-extrabold text-slate-800">
                  ✉️ 선생님 이메일 또는 성함으로 직접 초대
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  초대할 선생님의 가입 이메일 주소나 성함을 입력하면 즉시 이 클래스의 공동 교사로 등록됩니다.
                </p>
                <form onSubmit={handleInviteByInput} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="예: teacher2@school.kr 또는 박교사"
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isPending || !identifier.trim()}
                    className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isPending && !invitingTeacherId && !removingTeacherId
                      ? '초대 중...'
                      : '+ 공동 교사 초대'}
                  </button>
                </form>
              </div>

              {/* 3. 가입된 동료 선생님 목록에서 1클릭 초대 */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    👩‍🏫 가입된 동료 선생님 목록에서 1-클릭 초대
                  </h3>
                  {availableTeachers.length > 3 && (
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="선생님 성함 검색..."
                      className="w-40 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none"
                    />
                  )}
                </div>

                {loadingDirectory ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-400">
                    선생님 목록을 불러오는 중...
                  </div>
                ) : filteredDirectory.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500">
                    {availableTeachers.length === 0
                      ? '현재 추가로 초대 가능한 선생님 계정이 없거나 모두 초대되었습니다.'
                      : '검색 조건과 일치하는 선생님이 없습니다.'}
                  </div>
                ) : (
                  <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
                    {filteredDirectory.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-xl px-3 py-2 transition hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-extrabold text-slate-700">
                            {(t.name || '교')[0]}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800">
                              {t.name} 선생님
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleQuickInvite(t)}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700 transition hover:bg-indigo-600 hover:text-white disabled:opacity-50"
                        >
                          {isPending && invitingTeacherId === t.id
                            ? '초대 중...'
                            : '+ 팀티칭 초대'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. 참여 코드로 합류 안내 */}
              <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
                <div>
                  <p className="text-xs font-extrabold text-indigo-950">
                    🔑 참여 코드로도 팀티칭 합류가 가능합니다
                  </p>
                  <p className="mt-0.5 text-[11px] text-indigo-700">
                    동료 선생님이 홈 화면의 <strong>[참여 코드로 팀티칭 합류]</strong>에서 코드{' '}
                    <span className="font-mono font-black">{joinCode}</span>를 입력해도 공동 교사로 즉시 등록됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyJoinCode}
                  className="shrink-0 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-extrabold text-indigo-700 shadow-2xs transition hover:bg-indigo-50"
                >
                  {copiedCode ? '✅ 복사됨' : `코드 복사 (${joinCode})`}
                </button>
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-extrabold text-white transition hover:bg-slate-900"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
