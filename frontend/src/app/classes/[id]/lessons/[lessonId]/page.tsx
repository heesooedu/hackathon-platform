import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import ToggleLessonStatusButton from '@/components/ToggleLessonStatusButton';
import { Profile, Lesson, ClassItem } from '@/types/database.types';

interface LessonDetailPageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function LessonDetailPage({ params }: LessonDetailPageProps) {
  const { id: classId, lessonId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 클래스 조회
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('*, teacher:teacher_id(*)')
    .eq('id', classId)
    .single();

  if (classError || !classData) {
    notFound();
  }

  // 레슨 조회
  const { data: lessonData, error: lessonError } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (lessonError || !lessonData) {
    notFound();
  }

  const lesson = lessonData as Lesson;
  const isTeacher = classData.teacher_id === user.id;
  const isDeadlinePassed = lesson.deadline ? new Date(lesson.deadline) < new Date() : false;
  const isClosed = lesson.status === 'closed' || isDeadlinePassed;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 상단 브레드크럼 */}
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

      {/* 학습 목표 안내 카드 */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
          🎯 이번 차시 학습 목표
        </h2>
        <p className="text-base font-semibold text-gray-800 leading-relaxed">
          {lesson.learning_objective}
        </p>
      </div>

      {/* 인터랙티브 웹 교안 미리보기 (등록되어 있을 때) */}
      {lesson.material_html && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>✨</span>
              <span>인터랙티브 웹 교안</span>
            </h2>
            <span className="text-xs text-purple-600 font-semibold bg-purple-50 px-2.5 py-1 rounded-lg">
              바이브 코딩 샌드박스
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <iframe
              srcDoc={lesson.material_html}
              sandbox="allow-scripts"
              className="h-[450px] w-full border-0"
              title="Interactive Lesson Material"
            />
          </div>
        </div>
      )}

      {/* 4단계: 질문 제출 영역 (준비 상태 안내) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h2 className="text-lg font-bold text-gray-900">
            {isTeacher ? '학생 질문 현황' : '내 질문 & 이해도 제출'}
          </h2>
          <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg">
            4단계: Student Submission
          </span>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="text-4xl mb-3">💬</div>
          <h3 className="text-base font-bold text-gray-800">
            {isTeacher
              ? '학생들의 질문이 수집되면 여기에 보드가 나타납니다.'
              : '질문, 혼란 지점, 또는 이해 상태를 제출할 수 있습니다.'}
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            다음 4단계(Student Submission)에서 4가지 유형(질문/혼란/이해/탐구)의 개별화된 제출 기능이 오픈됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

