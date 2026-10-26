import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, getCurrentUser } from '@/utils/supabase/server';
import ImportMaterialModal from '@/components/ImportMaterialModal';
import ClassDetailView from '@/components/ClassDetailView';
import {
  EnrolledStudentRecord,
  StudentPeerAnswerItem,
} from '@/components/ClassStudentManagementDashboard';
import {
  isMaterialLibraryClass,
  parseLessonMaterial,
  sortLessonsByOrder,
  toLightweightLessonForList,
} from '@/utils/materialPayload';
import { loadTeacherMaterialLibraryContext } from '@/utils/materialLibraryLoader';
import { separateGroupsAndQuizzes } from '@/utils/quizHelper';
import {
  Profile,
  Lesson,
  Submission,
  QuestionGroup,
  FormativeQuiz,
} from '@/types/database.types';

interface ClassDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function ClassDetailPage({
  params,
  searchParams,
}: ClassDetailPageProps) {
  const [{ id: classId }, resolvedSearchParams, user, supabase] =
    await Promise.all([
      params,
      searchParams ? searchParams : Promise.resolve({} as { tab?: string }),
      getCurrentUser(),
      createClient(),
    ]);

  if (!user) {
    redirect('/login');
  }

  const initialTab =
    resolvedSearchParams.tab === 'students' ? 'students' : 'lessons';

  // 1단계 병렬 조회: 클래스 정보 + 해당 클래스의 레슨 목록을 동시에 조회
  const [{ data: classData, error: classError }, { data: rawLessons }] =
    await Promise.all([
      supabase
        .from('classes')
        .select('*, teacher:teacher_id(id, name, role)')
        .eq('id', classId)
        .single(),
      supabase
        .from('lessons')
        .select('*')
        .eq('class_id', classId)
        .order('created_at', { ascending: false }),
    ]);

  if (classError || !classData) {
    notFound();
  }

  if (isMaterialLibraryClass(classData)) {
    redirect('/materials');
  }

  const isTeacher = classData.teacher_id === user.id;
  const sortedLessons = sortLessonsByOrder((rawLessons || []) as Lesson[]);
  const alreadyImportedSourceIds = sortedLessons
    .map((l) => parseLessonMaterial(l).sourceMaterialId)
    .filter((id): id is string => Boolean(id));

  // 클라이언트 목록 뷰로 전달할 때는 수백 KB의 본문/이미지를 제외한 경량 메타데이터만 직렬화
  const lessons = sortedLessons.map(toLightweightLessonForList);

  let masterMaterials: Lesson[] = [];
  const enrolledStudents: EnrolledStudentRecord[] = [];
  let classSubmissions: Submission[] = [];
  let classQuizzes: FormativeQuiz[] = [];
  const peerAnswersByStudent: Record<string, StudentPeerAnswerItem[]> = {};

  if (isTeacher) {
    const lessonIds = sortedLessons.map((l) => l.id);
    const lessonTitleMap = new Map<string, string>(
      sortedLessons.map((l) => [l.id, l.title])
    );

    // 2단계 병렬 조회: 교안 보관함 + 참여 학생 명단 + 제출물 + 질문/퀴즈 그룹을 한 번에 동시 조회
    const [libCtx, { data: memberRows }, { data: subRows }, { data: groupRows }] =
      await Promise.all([
        loadTeacherMaterialLibraryContext(user.id, {
          includeDeployedMap: false,
          lightweightMasterMaterials: true,
        }),
        supabase
          .from('class_members')
          .select('id, student_id, joined_at, student:student_id(id, name, role)')
          .eq('class_id', classId)
          .order('joined_at', { ascending: false }),
        lessonIds.length > 0
          ? supabase
              .from('submissions')
              .select('*')
              .in('lesson_id', lessonIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
        lessonIds.length > 0
          ? supabase
              .from('question_groups')
              .select('*, answers(*)')
              .in('lesson_id', lessonIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);

    masterMaterials = libCtx.masterMaterials;

    if (memberRows) {
      for (const m of memberRows) {
        const studentProfile = m.student as unknown as Profile | null;
        enrolledStudents.push({
          id: m.id,
          studentId: m.student_id,
          name: studentProfile?.name || '학생',
          joinedAt: m.joined_at,
        });
      }
    }

    classSubmissions = (subRows || []) as Submission[];

    const allGroups = (groupRows || []) as QuestionGroup[];
    const { normalGroups, publishedQuizzes, inlineQuizzesMap } =
      separateGroupsAndQuizzes(allGroups);

    classQuizzes = [
      ...publishedQuizzes,
      ...Object.values(inlineQuizzesMap),
    ];

    for (const group of normalGroups) {
      const lessonTitle =
        lessonTitleMap.get(group.lesson_id) || '수업 차시';
      for (const ans of group.answers || []) {
        if (ans.author_id === user.id) continue; // 교사 본인 답변 제외
        if (!peerAnswersByStudent[ans.author_id]) {
          peerAnswersByStudent[ans.author_id] = [];
        }
        peerAnswersByStudent[ans.author_id].push({
          id: ans.id,
          lessonId: group.lesson_id,
          lessonTitle,
          groupTitle: group.representative_title,
          content: ans.content,
          isTeacherChecked: ans.is_teacher_checked,
          createdAt: ans.created_at,
        });
      }
    }
  }

  const teacherProfile = classData.teacher as unknown as Profile;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 space-y-6">
      {/* 상단 네비게이션 & 헤더 */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition mb-4"
        >
          <span>← 대시보드로 돌아가기</span>
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-600">
                {isTeacher ? '내 개설 클래스' : '참여 중인 클래스'}
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-sm text-gray-500">
                담당: {teacherProfile?.name || '선생님'}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-gray-900 sm:text-3xl">
              {classData.name}
            </h1>
          </div>

          {isTeacher && (
            <div className="flex flex-wrap items-center gap-2.5">
              <ImportMaterialModal
                classId={classId}
                className={classData.name}
                masterMaterials={masterMaterials}
                alreadyImportedSourceIds={alreadyImportedSourceIds}
              />
              <Link
                href={`/classes/${classId}/lessons/new`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-extrabold text-blue-700 shadow-xs transition hover:bg-blue-100"
              >
                <span>📝</span>
                <span>+ 새 교안 직접 작성</span>
              </Link>
              <Link
                href="/materials"
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50"
              >
                <span>📂</span>
                <span>교안 보관함 관리</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 메인 콘텐츠 (교사: 수업 교안 탭 / 학생 관리 & 학습 대시보드 탭, 학생: 수업 목록) */}
      <ClassDetailView
        classId={classId}
        className={classData.name}
        joinCode={classData.join_code}
        isTeacher={isTeacher}
        lessons={lessons}
        enrolledStudents={enrolledStudents}
        submissions={classSubmissions}
        quizzes={classQuizzes}
        peerAnswersByStudent={peerAnswersByStudent}
        initialTab={initialTab}
      />
    </div>
  );
}
