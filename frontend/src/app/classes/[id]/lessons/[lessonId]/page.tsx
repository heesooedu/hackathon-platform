import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  createClient,
  getCurrentUser,
  getCurrentProfile,
} from '@/utils/supabase/server';
import ToggleLessonStatusButton from '@/components/ToggleLessonStatusButton';
import LessonManageActions from '@/components/LessonManageActions';
import StudentSubmissionForm from '@/components/StudentSubmissionForm';
import TeacherSubmissionDashboard from '@/components/TeacherSubmissionDashboard';
import QuestionBoard from '@/components/QuestionBoard';
import RepresentativeQuestionSection from '@/components/RepresentativeQuestionSection';
import TeacherReviewDashboard from '@/components/TeacherReviewDashboard';
import LessonDetailTabs from '@/components/LessonDetailTabs';
import LessonMaterialViewer from '@/components/LessonMaterialViewer';
import StudentFormativeQuizSection from '@/components/StudentFormativeQuizSection';
import { parseLessonMaterial } from '@/utils/materialPayload';
import { separateGroupsAndQuizzes } from '@/utils/quizHelper';
import { verifyClassTeacherAccess } from '@/utils/classTeacherAuth';
import { Lesson, Submission, QuestionGroup, Profile } from '@/types/database.types';

interface LessonDetailPageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function LessonDetailPage({ params }: LessonDetailPageProps) {
  const [{ id: classId, lessonId }, user, profile, supabase] =
    await Promise.all([
      params,
      getCurrentUser(),
      getCurrentProfile(),
      createClient(),
    ]);

  if (!user) {
    redirect('/login');
  }

  const isTeacherRole = profile?.role === 'teacher';

  // 기존 5단계 직렬(Waterfall) 쿼리를 단일 Promise.all로 병렬 실행하여 응답 시간을 1/5로 단축
  const [
    access,
    { data: lessonData, error: lessonError },
    { data: allSubmissionsData },
    { data: groupsData },
    { data: memberRows },
  ] = await Promise.all([
    verifyClassTeacherAccess(supabase, classId, user.id),
    supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single(),
    supabase
      .from('submissions')
      .select(
        isTeacherRole
          ? '*, student:student_id(id, name, role)'
          : 'id, lesson_id, student_id, type, content, created_at, updated_at'
      )
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false }),
    supabase
      .from('question_groups')
      .select(
        isTeacherRole
          ? `
      *,
      members:question_group_members(
        id,
        submission:submissions(*)
      ),
      answers(
        *,
        author:profiles(id, name, role)
      )
    `
          : `
      *,
      members:question_group_members(
        id,
        submission:submissions(id, lesson_id, type, content, created_at)
      ),
      answers(
        id,
        group_id,
        author_id,
        content,
        is_teacher_checked,
        created_at
      )
    `
      )
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false }),
    isTeacherRole
      ? supabase
          .from('class_members')
          .select('student_id, student:student_id(role)')
          .eq('class_id', classId)
      : Promise.resolve({ data: null }),
  ]);

  const classData = access.classData;

  if (!classData || lessonError || !lessonData) {
    notFound();
  }

  const lesson = lessonData as Lesson;
  const parsedMaterial = parseLessonMaterial(lesson);
  const { isTeacher, allTeacherIds } = access;
  // 학생 브라우저에는 교사용 AI 진단 리포트(aiAnalysis) 및 내부 원본 ID가 직렬화되지 않도록 제거
  const viewerMaterial = isTeacher
    ? parsedMaterial
    : {
        ...parsedMaterial,
        aiAnalysis: null,
        sourceMaterialId: null,
      };
  const isDeadlinePassed = lesson.deadline
    ? new Date(lesson.deadline) < new Date()
    : false;
  const isClosed = lesson.status === 'closed' || isDeadlinePassed;

  const rawSubmissions = (allSubmissionsData || []) as unknown as Submission[];
  const rawGroups = (groupsData || []) as unknown as QuestionGroup[];
  const separated = separateGroupsAndQuizzes(rawGroups);

  // 교사용 / 학생용 특화 데이터 및 학생 화면용 개인정보 비식별화(Sanitization)
  let totalClassStudents = 0;
  let mySubmission: Submission | null = null;
  let allSubmissions: Submission[] = rawSubmissions;
  let normalGroups: QuestionGroup[] = separated.normalGroups;
  let publishedQuizzes = separated.publishedQuizzes;
  let inlineQuizzesMap = separated.inlineQuizzesMap;

  if (isTeacher) {
    totalClassStudents = (memberRows || []).filter((m: any) => {
      const stu = Array.isArray(m.student) ? m.student[0] : m.student;
      if (stu?.role === 'teacher') return false;
      if (allTeacherIds.has(m.student_id)) return false;
      return true;
    }).length;
  } else {
    mySubmission = rawSubmissions.find((s) => s.student_id === user.id) || null;

    // 다른 학생의 제출물 고유번호(student_id) 및 프로필이 학생 브라우저로 전달되지 않도록 마스킹
    allSubmissions = rawSubmissions.map((s) => ({
      ...s,
      student_id: s.student_id === user.id ? user.id : 'anonymous',
      student: undefined,
    }));

    // 대표 질문 내 묶인 질문 및 동료 답변에서도 타 학생 고유번호/실명 제거 (교사 답변은 선생님 배지용으로 표시)
    normalGroups = separated.normalGroups.map((g) => ({
      ...g,
      members: (g.members || [])
        .filter((m) => Boolean(m.submission))
        .map((m) => ({
          ...m,
          submission: {
            ...m.submission,
            student_id: 'anonymous',
            student: undefined,
          },
        })),
      answers: (g.answers || []).map((ans) => {
        const isTeacherAuthor = allTeacherIds.has(ans.author_id);
        return {
          ...ans,
          author_id: ans.author_id === user.id ? user.id : isTeacherAuthor ? 'teacher' : 'anonymous',
          author: isTeacherAuthor
            ? ({
                id: 'teacher',
                name: '담당 선생님',
                role: 'teacher',
                avatar_url: null,
                created_at: ans.created_at,
              } as Profile)
            : undefined,
        };
      }),
    }));

    // 형성평가(퀴즈)에서는 본인 풀이 기록만 남기고 다른 학생의 점수·선택지·실명 기록 제거
    publishedQuizzes = separated.publishedQuizzes.map((q) => ({
      ...q,
      attempts: (q.attempts || [])
        .filter((a) => a.student_id === user.id)
        .map((a) => ({
          ...a,
          student: undefined,
        })),
    }));

    // 교안 인라인 체크포인트 퀴즈에서도 본인 풀이 기록만 남기고 다른 학생 기록 제거
    const sanitizedInlineMap: typeof separated.inlineQuizzesMap = {};
    for (const [blockId, iq] of Object.entries(separated.inlineQuizzesMap)) {
      sanitizedInlineMap[blockId] = {
        ...iq,
        attempts: (iq.attempts || [])
          .filter((a) => a.student_id === user.id)
          .map((a) => ({
            ...a,
            student: undefined,
          })),
      };
    }
    inlineQuizzesMap = sanitizedInlineMap;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      {/* 1. 상단 브레드크럼 & 헤더 */}
      <div>
        <Link
          href={`/classes/${classId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition mb-4"
        >
          <span>← {classData.name} 클래스로 돌아가기</span>
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isClosed
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isClosed ? '🔴 마감됨' : '🟢 질문 접수 중'}
              </span>
              {parsedMaterial.subjectCategory && (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-100">
                  📁 {parsedMaterial.subjectCategory}
                  {parsedMaterial.unitCategory ? ` > ${parsedMaterial.unitCategory}` : ''}
                  {parsedMaterial.sessionNumber ? ` · ${parsedMaterial.sessionNumber}차시` : ''}
                </span>
              )}
              {isTeacher && parsedMaterial.sourceMaterialId && (
                <Link
                  href={`/materials/${parsedMaterial.sourceMaterialId}/edit`}
                  className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200 hover:bg-purple-100 transition"
                >
                  <span>🔗 원본 교안 연동됨 (모든 분반 실시간 동기화)</span>
                </Link>
              )}
              {lesson.deadline && (
                <span className="text-xs text-gray-400">
                  마감:{' '}
                  {new Date(lesson.deadline).toLocaleString('ko-KR', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              {lesson.title}
            </h1>
          </div>

          {isTeacher && (
            <div className="shrink-0 flex flex-wrap items-center gap-2">
              <LessonManageActions
                lessonId={lesson.id}
                classId={classId}
                lessonTitle={lesson.title}
                redirectAfterDelete
              />
              <ToggleLessonStatusButton
                lessonId={lesson.id}
                classId={classId}
                initialStatus={lesson.status}
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. 학습 목표 안내 카드 */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
          🎯 이번 차시 학습 목표
        </h2>
        <p className="text-base font-semibold text-gray-800 leading-relaxed">
          {lesson.learning_objective}
        </p>
      </div>

      {/* 3. 범용 교안(마크다운 / 워드·한글 추출본 / 인터랙티브 HTML) 및 질문 기반 보충 패치 뷰어 */}
      <LessonMaterialViewer
        lessonId={lesson.id}
        classId={classId}
        isTeacher={isTeacher}
        material={viewerMaterial}
        currentUserId={user.id}
        inlineQuizzesMap={inlineQuizzesMap}
      />

      {/* 4. 본문 영역: 교사는 탭 전환 지원, 학생은 형성평가 + 제출 폼 + 질문 보드 */}
      {isTeacher ? (
        <LessonDetailTabs
          childrenQuestions={
            <div className="space-y-10">
              <RepresentativeQuestionSection
                groups={normalGroups}
                classId={classId}
                lessonId={lessonId}
                isTeacher={isTeacher}
                currentUserId={user.id}
              />

              <TeacherSubmissionDashboard
                totalStudents={totalClassStudents}
                submissions={allSubmissions}
              />

              <div className="pt-2">
                <QuestionBoard
                  submissions={allSubmissions}
                  currentUserId={user.id}
                  isTeacher={isTeacher}
                  lessonId={lessonId}
                  classId={classId}
                  learningObjective={lesson.learning_objective}
                />
              </div>
            </div>
          }
          childrenReview={
            <TeacherReviewDashboard
              lessonId={lessonId}
              classId={classId}
              lessonTitle={lesson.title}
              learningObjective={lesson.learning_objective}
              totalStudents={totalClassStudents}
              submissions={allSubmissions}
              groups={normalGroups}
              initialAnalysis={parsedMaterial.aiAnalysis}
              appliedPatches={parsedMaterial.appliedPatches}
              publishedQuizzes={publishedQuizzes}
            />
          }
        />
      ) : (
        <div className="space-y-10">
          {/* 교사가 배포한 오개념 타겟팅 형성평가가 있으면 최상단에 표시 */}
          <StudentFormativeQuizSection
            lessonId={lessonId}
            classId={classId}
            currentUserId={user.id}
            quizzes={publishedQuizzes}
          />

          <RepresentativeQuestionSection
            groups={normalGroups}
            classId={classId}
            lessonId={lessonId}
            isTeacher={isTeacher}
            currentUserId={user.id}
          />

          <StudentSubmissionForm
            lessonId={lessonId}
            classId={classId}
            isClosed={isClosed}
            existingSubmission={mySubmission}
          />

          <div className="pt-2">
            <QuestionBoard
              submissions={allSubmissions}
              currentUserId={user.id}
              isTeacher={isTeacher}
              lessonId={lessonId}
              classId={classId}
              learningObjective={lesson.learning_objective}
            />
          </div>
        </div>
      )}
    </div>
  );
}
