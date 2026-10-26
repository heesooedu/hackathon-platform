'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lesson,
  Submission,
  SubmissionType,
  FormativeQuiz,
} from '@/types/database.types';
import {
  addStudentToClassAction,
  removeStudentFromClassAction,
} from '@/app/classes/actions';
import CopyCodeButton from '@/components/CopyCodeButton';

export interface StudentPeerAnswerItem {
  id: string;
  lessonId: string;
  lessonTitle: string;
  groupTitle: string;
  content: string;
  isTeacherChecked: boolean;
  createdAt: string;
}

export interface StudentQuizAttemptItem {
  quizId: string;
  lessonId: string;
  lessonTitle: string;
  isInline: boolean;
  questionType: 'multiple_choice' | 'ox' | 'short_answer';
  questionText: string;
  targetConcept: string | null;
  selectedOptionIndex: number;
  submittedText?: string;
  options: string[];
  correctOptionIndex: number;
  answerText?: string;
  isCorrect: boolean;
  createdAt: string;
}

export interface EnrolledStudentRecord {
  id: string; // class_members row id
  studentId: string;
  name: string;
  joinedAt: string;
}

interface ClassStudentManagementDashboardProps {
  classId: string;
  className: string;
  joinCode: string;
  lessons: Lesson[];
  enrolledStudents: EnrolledStudentRecord[];
  submissions: Submission[];
  quizzes: FormativeQuiz[];
  peerAnswersByStudent: Record<string, StudentPeerAnswerItem[]>;
}

type FilterMode = 'all' | 'needs_attention' | 'active_questioner' | 'peer_mentor';
type SortMode =
  | 'name_asc'
  | 'participation_asc'
  | 'participation_desc'
  | 'quiz_asc'
  | 'quiz_desc'
  | 'questions_desc'
  | 'joined_desc';

const SUBMISSION_META: Record<
  SubmissionType,
  { emoji: string; label: string; badgeClass: string; stampClass: string }
> = {
  question: {
    emoji: '❓',
    label: '질문',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    stampClass: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
  },
  confusion: {
    emoji: '💭',
    label: '헷갈림',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    stampClass: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200',
  },
  explore: {
    emoji: '💡',
    label: '심화탐구',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    stampClass:
      'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200',
  },
  understood: {
    emoji: '✅',
    label: '이해완료',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    stampClass:
      'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
  },
};

export default function ClassStudentManagementDashboard({
  classId,
  className,
  joinCode,
  lessons,
  enrolledStudents,
  submissions,
  quizzes,
  peerAnswersByStudent,
}: ClassStudentManagementDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 학생 추가 폼 상태
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [addFeedback, setAddFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // 필터 / 검색 / 정렬 상태
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('name_asc');

  // 개별 학생 학습 포트폴리오 모달 상태
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );
  const [portfolioTab, setPortfolioTab] = useState<
    'submissions' | 'quizzes' | 'answers'
  >('submissions');

  // 학생 제외 확인 모달 상태
  const [studentToRemove, setStudentToRemove] =
    useState<EnrolledStudentRecord | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const lessonMap = useMemo(() => {
    const map = new Map<string, Lesson>();
    for (const l of lessons) {
      map.set(l.id, l);
    }
    return map;
  }, [lessons]);

  // 학생별 종단(Longitudinal) 학습 지표 집계
  const studentAnalyticsList = useMemo(() => {
    const totalLessons = lessons.length;

    // 학생별 제출 매핑: studentId -> (lessonId -> Submission)
    const subByStudentLesson = new Map<string, Map<string, Submission>>();
    for (const sub of submissions) {
      if (!subByStudentLesson.has(sub.student_id)) {
        subByStudentLesson.set(sub.student_id, new Map());
      }
      subByStudentLesson.get(sub.student_id)!.set(sub.lesson_id, sub);
    }

    // 학생별 퀴즈 풀이 매핑: studentId -> StudentQuizAttemptItem[]
    const quizAttemptsByStudent = new Map<string, StudentQuizAttemptItem[]>();
    for (const q of quizzes) {
      const lessonObj = lessonMap.get(q.lesson_id);
      const lessonTitle = lessonObj ? lessonObj.title : '수업 차시';
      // 학생당 각 퀴즈의 가장 최신 풀이 1건 기준 집계
      const latestByStudent = new Map<string, StudentQuizAttemptItem>();
      for (const att of q.attempts || []) {
        const existing = latestByStudent.get(att.student_id);
        if (
          !existing ||
          new Date(att.created_at).getTime() >=
            new Date(existing.createdAt).getTime()
        ) {
          latestByStudent.set(att.student_id, {
            quizId: q.id,
            lessonId: q.lesson_id,
            lessonTitle,
            isInline: Boolean(q.inline_block_id),
            questionType: q.question_type || 'multiple_choice',
            questionText: q.question_text,
            targetConcept: q.target_concept || null,
            selectedOptionIndex: att.selected_option_index,
            submittedText: att.submitted_text,
            options: q.options || [],
            correctOptionIndex: q.correct_option_index,
            answerText: q.answer_text,
            isCorrect: att.is_correct,
            createdAt: att.created_at,
          });
        }
      }

      for (const [stuId, item] of latestByStudent.entries()) {
        if (!quizAttemptsByStudent.has(stuId)) {
          quizAttemptsByStudent.set(stuId, []);
        }
        quizAttemptsByStudent.get(stuId)!.push(item);
      }
    }

    return enrolledStudents.map((enrolled) => {
      const stuLessonSubs =
        subByStudentLesson.get(enrolled.studentId) || new Map<string, Submission>();
      const allStudentSubs = Array.from(stuLessonSubs.values());

      const counts: Record<SubmissionType, number> = {
        question: 0,
        confusion: 0,
        explore: 0,
        understood: 0,
      };
      for (const s of allStudentSubs) {
        if (counts[s.type] !== undefined) {
          counts[s.type] += 1;
        }
      }

      const submittedLessonsCount = stuLessonSubs.size;
      const participationRate =
        totalLessons > 0
          ? Math.round((submittedLessonsCount / totalLessons) * 100)
          : 0;

      const quizAttempts = quizAttemptsByStudent.get(enrolled.studentId) || [];
      const quizTotalCount = quizAttempts.length;
      const quizCorrectCount = quizAttempts.filter((a) => a.isCorrect).length;
      const quizAccuracy =
        quizTotalCount > 0
          ? Math.round((quizCorrectCount / quizTotalCount) * 100)
          : null;

      const peerAnswers = peerAnswersByStudent[enrolled.studentId] || [];
      const peerAnswerCount = peerAnswers.length;
      const teacherCheckedCount = peerAnswers.filter(
        (a) => a.isTeacherChecked
      ).length;

      // 관심 필요 학생 판별:
      // 1) 개설된 차시가 1개 이상인데 참여율이 50% 미만이거나
      // 2) '헷갈림(confusion)' 제출이 2회 이상이거나
      // 3) 퀴즈를 1문항 이상 풀었는데 정답률이 50% 미만인 경우
      const needsAttention =
        (totalLessons > 0 && participationRate < 50) ||
        counts.confusion >= 2 ||
        (quizAccuracy !== null && quizAccuracy < 50);

      const attentionReasons: string[] = [];
      if (totalLessons > 0 && participationRate < 50) {
        attentionReasons.push(`차시 미제출 (${totalLessons - submittedLessonsCount}차시)`);
      }
      if (counts.confusion >= 2) {
        attentionReasons.push(`헷갈림 호소 ${counts.confusion}회`);
      }
      if (quizAccuracy !== null && quizAccuracy < 50) {
        attentionReasons.push(`퀴즈 정답률 ${quizAccuracy}%`);
      }

      const isActiveQuestioner = counts.question + counts.explore >= 2;
      const isPeerMentor = peerAnswerCount >= 1;

      return {
        ...enrolled,
        stuLessonSubs,
        submittedLessonsCount,
        participationRate,
        counts,
        quizAttempts,
        quizTotalCount,
        quizCorrectCount,
        quizAccuracy,
        peerAnswers,
        peerAnswerCount,
        teacherCheckedCount,
        needsAttention,
        attentionReasons,
        isActiveQuestioner,
        isPeerMentor,
      };
    });
  }, [
    enrolledStudents,
    lessons,
    lessonMap,
    submissions,
    quizzes,
    peerAnswersByStudent,
  ]);

  // 학급 전체 KPI 집계
  const classKpis = useMemo(() => {
    const totalStudents = studentAnalyticsList.length;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentJoinedCount = studentAnalyticsList.filter(
      (s) => new Date(s.joinedAt).getTime() >= sevenDaysAgo
    ).length;

    const avgParticipation =
      totalStudents > 0 && lessons.length > 0
        ? Math.round(
            studentAnalyticsList.reduce(
              (acc, s) => acc + s.participationRate,
              0
            ) / totalStudents
          )
        : 0;

    const totalSubmissionsCount = studentAnalyticsList.reduce(
      (acc, s) => acc + s.submittedLessonsCount,
      0
    );

    const studentsWithQuiz = studentAnalyticsList.filter(
      (s) => s.quizAccuracy !== null
    );
    const avgQuizAccuracy =
      studentsWithQuiz.length > 0
        ? Math.round(
            studentsWithQuiz.reduce((acc, s) => acc + (s.quizAccuracy || 0), 0) /
              studentsWithQuiz.length
          )
        : null;

    const totalQuizAttempts = studentAnalyticsList.reduce(
      (acc, s) => acc + s.quizTotalCount,
      0
    );

    const needsAttentionCount = studentAnalyticsList.filter(
      (s) => s.needsAttention
    ).length;
    const activeQuestionerCount = studentAnalyticsList.filter(
      (s) => s.isActiveQuestioner
    ).length;
    const peerMentorCount = studentAnalyticsList.filter(
      (s) => s.isPeerMentor
    ).length;

    return {
      totalStudents,
      recentJoinedCount,
      avgParticipation,
      totalSubmissionsCount,
      avgQuizAccuracy,
      totalQuizAttempts,
      needsAttentionCount,
      activeQuestionerCount,
      peerMentorCount,
    };
  }, [studentAnalyticsList, lessons.length]);

  // 필터 및 정렬 적용된 학생 목록
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = studentAnalyticsList.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) {
        return false;
      }
      if (filterMode === 'needs_attention') return s.needsAttention;
      if (filterMode === 'active_questioner') return s.isActiveQuestioner;
      if (filterMode === 'peer_mentor') return s.isPeerMentor;
      return true;
    });

    list.sort((a, b) => {
      switch (sortMode) {
        case 'name_asc':
          return a.name.localeCompare(b.name, 'ko');
        case 'participation_asc':
          return a.participationRate - b.participationRate;
        case 'participation_desc':
          return b.participationRate - a.participationRate;
        case 'quiz_asc':
          return (a.quizAccuracy ?? 999) - (b.quizAccuracy ?? 999);
        case 'quiz_desc':
          return (b.quizAccuracy ?? -1) - (a.quizAccuracy ?? -1);
        case 'questions_desc':
          return (
            b.counts.question +
            b.counts.confusion +
            b.counts.explore -
            (a.counts.question + a.counts.confusion + a.counts.explore)
          );
        case 'joined_desc':
          return (
            new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
          );
        default:
          return 0;
      }
    });

    return list;
  }, [studentAnalyticsList, filterMode, searchQuery, sortMode]);

  const selectedStudent = useMemo(
    () =>
      studentAnalyticsList.find((s) => s.studentId === selectedStudentId) ||
      null,
    [studentAnalyticsList, selectedStudentId]
  );

  // 학생 수동 추가 핸들러
  function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!studentIdentifier.trim()) return;
    setAddFeedback(null);

    startTransition(async () => {
      const res = await addStudentToClassAction(classId, studentIdentifier);
      if (res.error) {
        setAddFeedback({ type: 'error', message: res.error });
      } else {
        setAddFeedback({
          type: 'success',
          message: `'${res.studentName}' 학생이 클래스에 추가되었습니다.`,
        });
        setStudentIdentifier('');
        router.refresh();
      }
    });
  }

  // 학생 클래스 제외 핸들러
  function handleConfirmRemoveStudent() {
    if (!studentToRemove) return;
    setRemoveError(null);

    startTransition(async () => {
      const res = await removeStudentFromClassAction(
        classId,
        studentToRemove.studentId
      );
      if (res.error) {
        setRemoveError(res.error);
      } else {
        if (selectedStudentId === studentToRemove.studentId) {
          setSelectedStudentId(null);
        }
        setStudentToRemove(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 1. 상단 학급 학습 KPI 요약 카드 4종 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              총 수강 학생
            </span>
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold">
              👥
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900">
              {classKpis.totalStudents}명
            </span>
            {classKpis.recentJoinedCount > 0 && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                최근 7일 +{classKpis.recentJoinedCount}명
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            개설된 수업 차시 총 {lessons.length}개 기준
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              평균 차시 참여율
            </span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
              📝
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900">
              {classKpis.avgParticipation}%
            </span>
            <span className="text-xs text-gray-500">
              (누적 제출 {classKpis.totalSubmissionsCount}건)
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2.5">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${Math.min(100, classKpis.avgParticipation)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              학급 평균 퀴즈 정답률
            </span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">
              🎯
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900">
              {classKpis.avgQuizAccuracy !== null
                ? `${classKpis.avgQuizAccuracy}%`
                : '-'}
            </span>
            <span className="text-xs text-gray-500">
              (총 {classKpis.totalQuizAttempts}회 풀이)
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            체크포인트(/퀴즈) 및 사후 형성평가 합산
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setFilterMode((prev) =>
              prev === 'needs_attention' ? 'all' : 'needs_attention'
            )
          }
          className={`text-left rounded-2xl border p-5 shadow-xs transition-all ${
            filterMode === 'needs_attention'
              ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-200'
              : 'bg-white border-gray-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              관심·보충 필요 학생
            </span>
            <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold">
              ⚠️
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-900">
              {classKpis.needsAttentionCount}명
            </span>
            <span className="text-xs font-medium text-amber-700 underline">
              {filterMode === 'needs_attention' ? '필터 해제' : '명단 필터링 →'}
            </span>
          </div>
          <p className="text-xs text-amber-700/80 mt-1.5">
            미제출 다수 · 헷갈림 호소 · 퀴즈 50% 미만
          </p>
        </button>
      </div>

      {/* 2. 학생 직접 추가 & 참여 코드 관리 바 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>➕ 학생 직접 추가</span>
              <span className="text-xs font-normal text-gray-500">
                가입된 학생의 이메일 주소 또는 이름을 입력해 클래스에 바로 등록합니다.
              </span>
            </h3>
            <form
              onSubmit={handleAddStudent}
              className="mt-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
            >
              <input
                type="text"
                value={studentIdentifier}
                onChange={(e) => setStudentIdentifier(e.target.value)}
                placeholder="학생 이메일 (예: student@school.kr) 또는 이름 입력"
                className="flex-1 max-w-md px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={isPending || !studentIdentifier.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
              >
                {isPending ? '처리 중...' : '+ 학생 추가'}
              </button>
            </form>
            {addFeedback && (
              <div
                className={`mt-2.5 text-xs font-medium px-3 py-2 rounded-lg border ${
                  addFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {addFeedback.message}
              </div>
            )}
          </div>

          <div className="lg:border-l lg:border-gray-200 lg:pl-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-100">
            <div>
              <div className="text-xs font-semibold text-indigo-900">
                학생 자율 입장용 참여 코드
              </div>
              <p className="text-[11px] text-indigo-700/80 mt-0.5">
                학생 화면의 [참여 코드로 클래스 입장]에 입력
              </p>
            </div>
            <CopyCodeButton code={joinCode} />
          </div>
        </div>
      </div>

      {/* 3. 학생 학습 현황 대시보드 본문 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* 필터 & 검색 툴바 */}
        <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              전체 학생 ({studentAnalyticsList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('needs_attention')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === 'needs_attention'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              🚨 관심 필요 ({classKpis.needsAttentionCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('active_questioner')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === 'active_questioner'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              🙋 질문·탐구 활발 ({classKpis.activeQuestionerCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('peer_mentor')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === 'peer_mentor'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              💬 동료 답변 활동 ({classKpis.peerMentorCount})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="학생 이름 검색..."
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="name_asc">이름 가나다순</option>
              <option value="participation_asc">차시 참여율 낮은순 (지도 필요)</option>
              <option value="participation_desc">차시 참여율 높은순</option>
              <option value="quiz_asc">퀴즈 정답률 낮은순</option>
              <option value="quiz_desc">퀴즈 정답률 높은순</option>
              <option value="questions_desc">질문·헷갈림 많은순</option>
              <option value="joined_desc">최근 클래스 등록순</option>
            </select>
          </div>
        </div>

        {/* 범례 안내 바 */}
        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-gray-700">차시별 스탬프 범례:</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 border border-blue-300 inline-flex items-center justify-center text-[11px]">
                ❓
              </span>
              질문
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center justify-center text-[11px]">
                💭
              </span>
              헷갈림
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 border border-purple-300 inline-flex items-center justify-center text-[11px]">
                💡
              </span>
              심화탐구
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center justify-center text-[11px]">
                ✅
              </span>
              이해완료
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-gray-100 text-gray-400 border border-gray-200 inline-flex items-center justify-center text-[11px]">
                -
              </span>
              미제출
            </span>
          </div>
          <span className="text-[11px] text-gray-500">
            💡 학생 이름이나 <strong>[상세 포트폴리오]</strong>를 클릭하면 제출 질문 원문과 퀴즈 오답 노트를 볼 수 있습니다.
          </span>
        </div>

        {/* 학생 목록 테이블 */}
        {enrolledStudents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-3xl mb-2">🌱</div>
            <h4 className="text-base font-bold text-gray-900 mb-1">
              아직 등록된 학생이 없습니다
            </h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              위 입력창에서 학생의 이메일/이름으로 직접 추가하거나, 클래스 참여 코드(
              <strong className="text-indigo-600 font-mono">{joinCode}</strong>
              )를 학생들에게 공유해 주세요.
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            해당 조건에 일치하는 학생이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">학생 정보</th>
                  <th className="py-3.5 px-4">
                    차시별 참여 스탬프 ({lessons.length}차시)
                  </th>
                  <th className="py-3.5 px-4">질문·이해 유형 분포</th>
                  <th className="py-3.5 px-4">퀴즈 성취도</th>
                  <th className="py-3.5 px-4">동료 답변 기여</th>
                  <th className="py-3.5 px-5 text-right">학습 기록 / 관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredStudents.map((stu) => (
                  <tr
                    key={stu.studentId}
                    className="hover:bg-indigo-50/30 transition-colors"
                  >
                    {/* 1. 학생 이름 및 상태 배지 */}
                    <td className="py-4 px-5 align-middle">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentId(stu.studentId);
                            setPortfolioTab('submissions');
                          }}
                          className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0 hover:bg-indigo-200 transition-colors cursor-pointer"
                        >
                          {stu.name.charAt(0)}
                        </button>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentId(stu.studentId);
                                setPortfolioTab('submissions');
                              }}
                              className="font-bold text-gray-900 hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                              {stu.name}
                            </button>
                            {stu.needsAttention && (
                              <span
                                title={stu.attentionReasons.join(', ')}
                                className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                              >
                                ⚠️ 관심 필요
                              </span>
                            )}
                            {stu.teacherCheckedCount > 0 && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                🌟 우수 답변자
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            등록일:{' '}
                            {new Date(stu.joinedAt).toLocaleDateString('ko-KR')}
                          </div>
                          {stu.attentionReasons.length > 0 && (
                            <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                              {stu.attentionReasons.join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 2. 차시별 참여 스탬프 & 참여율 */}
                    <td className="py-4 px-4 align-middle">
                      {lessons.length === 0 ? (
                        <span className="text-xs text-gray-400">
                          개설된 차시 없음
                        </span>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-800">
                              {stu.participationRate}%
                            </span>
                            <span className="text-[11px] text-gray-500">
                              ({stu.submittedLessonsCount}/{lessons.length}차시)
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {lessons.map((lesson, idx) => {
                              const sub = stu.stuLessonSubs.get(lesson.id);
                              if (!sub) {
                                return (
                                  <Link
                                    key={lesson.id}
                                    href={`/classes/${classId}/lessons/${lesson.id}`}
                                    title={`${idx + 1}차시 (${lesson.title}): 미제출`}
                                    className="w-6 h-6 rounded-md bg-gray-100 text-gray-400 border border-gray-200 inline-flex items-center justify-center text-[10px] font-medium hover:bg-gray-200 transition-colors"
                                  >
                                    {idx + 1}
                                  </Link>
                                );
                              }
                              const meta = SUBMISSION_META[sub.type];
                              return (
                                <Link
                                  key={lesson.id}
                                  href={`/classes/${classId}/lessons/${lesson.id}`}
                                  title={`${idx + 1}차시 (${lesson.title}) - [${meta.label}] ${sub.content}`}
                                  className={`w-6 h-6 rounded-md border inline-flex items-center justify-center text-xs transition-colors ${meta.stampClass}`}
                                >
                                  {meta.emoji}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 3. 질문·이해 유형 분포 */}
                    <td className="py-4 px-4 align-middle">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          ❓ 질문 {stu.counts.question}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          💭 헷갈림 {stu.counts.confusion}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                          💡 탐구 {stu.counts.explore}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✅ 이해 {stu.counts.understood}
                        </span>
                      </div>
                    </td>

                    {/* 4. 형성평가·체크포인트 퀴즈 성취도 */}
                    <td className="py-4 px-4 align-middle">
                      {stu.quizTotalCount === 0 ? (
                        <span className="text-xs text-gray-400">
                          응시 기록 없음
                        </span>
                      ) : (
                        <div className="w-36 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span
                              className={`font-bold ${
                                (stu.quizAccuracy || 0) >= 80
                                  ? 'text-emerald-700'
                                  : (stu.quizAccuracy || 0) >= 50
                                  ? 'text-indigo-700'
                                  : 'text-red-600'
                              }`}
                            >
                              정답률 {stu.quizAccuracy}%
                            </span>
                            <span className="text-[11px] text-gray-500">
                              ({stu.quizCorrectCount}/{stu.quizTotalCount})
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                (stu.quizAccuracy || 0) >= 80
                                  ? 'bg-emerald-500'
                                  : (stu.quizAccuracy || 0) >= 50
                                  ? 'bg-indigo-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${stu.quizAccuracy || 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 5. 동료 답변 기여 */}
                    <td className="py-4 px-4 align-middle">
                      {stu.peerAnswerCount === 0 ? (
                        <span className="text-xs text-gray-400">0건</span>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-gray-800">
                            답변 {stu.peerAnswerCount}건
                          </div>
                          {stu.teacherCheckedCount > 0 && (
                            <div className="text-[11px] font-medium text-emerald-700">
                              ✓ 선생님 채택 {stu.teacherCheckedCount}건
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 6. 상세 포트폴리오 / 클래스 제외 버튼 */}
                    <td className="py-4 px-5 align-middle text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentId(stu.studentId);
                            setPortfolioTab('submissions');
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                        >
                          📊 상세 포트폴리오
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRemoveError(null);
                            setStudentToRemove({
                              id: stu.id,
                              studentId: stu.studentId,
                              name: stu.name,
                              joinedAt: stu.joinedAt,
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                        >
                          제외
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. 개별 학생 종단(Longitudinal) 학습 포트폴리오 모달 */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* 모달 헤더 */}
            <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4 bg-gradient-to-r from-indigo-50/70 via-white to-white">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold text-lg flex items-center justify-center shadow-xs">
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-gray-900">
                      {selectedStudent.name} 학생의 학습 포트폴리오
                    </h3>
                    <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      {className}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    차시 참여율 {selectedStudent.participationRate}% (
                    {selectedStudent.submittedLessonsCount}/{lessons.length}차시) ·
                    퀴즈 정답률{' '}
                    {selectedStudent.quizAccuracy !== null
                      ? `${selectedStudent.quizAccuracy}% (${selectedStudent.quizCorrectCount}/${selectedStudent.quizTotalCount})`
                      : '미응시'}{' '}
                    · 동료 답변 {selectedStudent.peerAnswerCount}건
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold px-2 py-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 모달 내부 탭 */}
            <div className="px-6 pt-3 border-b border-gray-200 flex items-center gap-2 bg-gray-50/60">
              <button
                type="button"
                onClick={() => setPortfolioTab('submissions')}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  portfolioTab === 'submissions'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                📝 차시별 질문 & 이해 기록 ({selectedStudent.submittedLessonsCount}/
                {lessons.length})
              </button>
              <button
                type="button"
                onClick={() => setPortfolioTab('quizzes')}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  portfolioTab === 'quizzes'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                🎯 퀴즈 풀이 & 오답 노트 ({selectedStudent.quizTotalCount})
              </button>
              <button
                type="button"
                onClick={() => setPortfolioTab('answers')}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  portfolioTab === 'answers'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                💬 작성한 동료 답변 ({selectedStudent.peerAnswerCount})
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {portfolioTab === 'submissions' && (
                <>
                  {lessons.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      아직 개설된 수업 차시가 없습니다.
                    </p>
                  ) : (
                    lessons.map((lesson, idx) => {
                      const sub = selectedStudent.stuLessonSubs.get(lesson.id);
                      const meta = sub ? SUBMISSION_META[sub.type] : null;
                      return (
                        <div
                          key={lesson.id}
                          className={`rounded-xl border p-4 transition-colors ${
                            sub
                              ? 'bg-white border-gray-200'
                              : 'bg-gray-50/70 border-gray-200 border-dashed'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                {idx + 1}차시
                              </span>
                              <Link
                                href={`/classes/${classId}/lessons/${lesson.id}`}
                                className="text-sm font-bold text-gray-900 hover:text-indigo-600 underline-offset-2 hover:underline"
                              >
                                {lesson.title} →
                              </Link>
                            </div>
                            {meta ? (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.badgeClass}`}
                              >
                                {meta.emoji} {meta.label}
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                ⬜ 미제출
                              </span>
                            )}
                          </div>
                          {sub ? (
                            <div className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">
                              {sub.content}
                              <div className="text-[11px] text-gray-400 mt-1.5">
                                제출 시각:{' '}
                                {new Date(sub.created_at).toLocaleString('ko-KR')}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">
                              이 차시에는 아직 질문이나 이해 상태를 제출하지 않았습니다.
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {portfolioTab === 'quizzes' && (
                <>
                  {selectedStudent.quizAttempts.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      아직 풀이한 체크포인트 퀴즈나 형성평가 문항이 없습니다.
                    </p>
                  ) : (
                    selectedStudent.quizAttempts.map((att) => {
                      const studentAnswerDisplay =
                        att.questionType === 'short_answer'
                          ? att.submittedText || '(미입력)'
                          : att.options[att.selectedOptionIndex] ||
                            `${att.selectedOptionIndex + 1}번`;

                      const correctAnswerDisplay =
                        att.questionType === 'short_answer'
                          ? att.answerText || ''
                          : att.options[att.correctOptionIndex] ||
                            `${att.correctOptionIndex + 1}번`;

                      return (
                        <div
                          key={att.quizId}
                          className={`rounded-xl border p-4 ${
                            att.isCorrect
                              ? 'bg-emerald-50/30 border-emerald-200'
                              : 'bg-red-50/40 border-red-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                                  att.isCorrect
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {att.isCorrect ? '⭕ 정답' : '❌ 오답'}
                              </span>
                              <span className="text-xs font-semibold text-gray-600">
                                {att.isInline
                                  ? '⚡ 교안 체크포인트'
                                  : '🎯 사후 형성평가'}
                              </span>
                              {att.targetConcept && (
                                <span className="text-[11px] bg-white px-2 py-0.5 rounded-md border border-gray-200 text-gray-600">
                                  #{att.targetConcept}
                                </span>
                              )}
                            </div>
                            <Link
                              href={`/classes/${classId}/lessons/${att.lessonId}`}
                              className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                              {att.lessonTitle} →
                            </Link>
                          </div>
                          <p className="text-sm font-bold text-gray-900 mb-2">
                            Q. {att.questionText}
                          </p>
                          <div className="text-xs space-y-1 bg-white/90 rounded-lg p-3 border border-gray-200/80">
                            <div>
                              <span className="font-semibold text-gray-600">
                                학생 제출 답안:{' '}
                              </span>
                              <span
                                className={
                                  att.isCorrect
                                    ? 'font-bold text-emerald-700'
                                    : 'font-bold text-red-600'
                                }
                              >
                                {studentAnswerDisplay}
                              </span>
                            </div>
                            {!att.isCorrect && (
                              <div>
                                <span className="font-semibold text-gray-600">
                                  실제 정답:{' '}
                                </span>
                                <span className="font-bold text-emerald-700">
                                  {correctAnswerDisplay}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {portfolioTab === 'answers' && (
                <>
                  {selectedStudent.peerAnswers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      아직 친구들의 질문에 작성한 동료 답변이 없습니다.
                    </p>
                  ) : (
                    selectedStudent.peerAnswers.map((ans) => (
                      <div
                        key={ans.id}
                        className="rounded-xl border border-gray-200 p-4 bg-white"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-gray-500">
                            질문: {ans.groupTitle}
                          </span>
                          <div className="flex items-center gap-2">
                            {ans.isTeacherChecked && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                ✓ 선생님 검증 완료
                              </span>
                            )}
                            <Link
                              href={`/classes/${classId}/lessons/${ans.lessonId}`}
                              className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                              {ans.lessonTitle} →
                            </Link>
                          </div>
                        </div>
                        <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                          {ans.content}
                        </p>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setRemoveError(null);
                  setStudentToRemove({
                    id: selectedStudent.id,
                    studentId: selectedStudent.studentId,
                    name: selectedStudent.name,
                    joinedAt: selectedStudent.joinedAt,
                  });
                }}
                className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
              >
                이 학생을 클래스 수강 명단에서 제외하기
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-gray-800 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 학생 클래스 제외 확인 모달 */}
      {studentToRemove && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-extrabold text-gray-900 mb-2">
              학생을 클래스에서 제외할까요?
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              <strong className="text-gray-900">{studentToRemove.name}</strong>{' '}
              학생을 <strong>{className}</strong> 수강 명단에서 제외합니다.
              <br />
              <span className="text-gray-500">
                ※ 학생이 기존 차시에 제출한 질문·이해 기록 및 답변 데이터는 삭제되지 않고 보존되며, 언제든 다시 추가할 수 있습니다.
              </span>
            </p>
            {removeError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {removeError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setStudentToRemove(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmRemoveStudent}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {isPending ? '제외 중...' : '클래스에서 제외'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
