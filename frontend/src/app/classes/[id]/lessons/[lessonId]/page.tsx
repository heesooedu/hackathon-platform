import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import ToggleLessonStatusButton from '@/components/ToggleLessonStatusButton';
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
import { Lesson, Submission, QuestionGroup } from '@/types/database.types';

interface LessonDetailPageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function LessonDetailPage({ params }: LessonDetailPageProps) {
  const { id: classId, lessonId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 1. 클래스 정보 조회
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('*, teacher:teacher_id(*)')
    .eq('id', classId)
    .single();

  if (classError || !classData) {
    notFound();
  }

  // 2. 레슨 정보 조회
  const { data: lessonData, error: lessonError } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (lessonError || !lessonData) {
    notFound();
  }

  const lesson = lessonData as Lesson;
  const parsedMaterial = parseLessonMaterial(lesson);
  const isTeacher = classData.teacher_id === user.id;
  const isDeadlinePassed = lesson.deadline
    ? new Date(lesson.deadline) < new Date()
    : false;
  const isClosed = lesson.status === 'closed' || isDeadlinePassed;

  // 3. 해당 레슨의 전체 제출물 조회
  const { data: allSubmissionsData } = await supabase
    .from('submissions')
    .select('*, student:student_id(id, name, avatar_url, role)')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false });

  const allSubmissions = (allSubmissionsData || []) as unknown as Submission[];

  // 4. 대표 질문 그룹 및 배포된 형성평가 목록 조회
  const { data: groupsData } = await supabase
    .from('question_groups')
    .select(
      `
      *,
      members:question_group_members(
        id,
        submission:submissions(*)
      ),
      answers(
        *,
        author:profiles(*)
      )
    `
    )
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false });

  const rawGroups = (groupsData || []) as unknown as QuestionGroup[];
  const { normalGroups, publishedQuizzes } = separateGroupsAndQuizzes(rawGroups);

  // 5. 교사용 / 학생용 특화 데이터
  let totalClassStudents = 0;
  let mySubmission: Submission | null = null;

  if (isTeacher) {
    const { count } = await supabase
      .from('class_members')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId);
    totalClassStudents = count || 0;
  } else {
    mySubmission = allSubmissions.find((s) => s.student_id === user.id) || null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
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
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isClosed
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isClosed ? '🔴 마감됨' : '🟢 질문 접수 중'}
              </span>
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
            <div className="shrink-0">
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
        material={parsedMaterial}
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
