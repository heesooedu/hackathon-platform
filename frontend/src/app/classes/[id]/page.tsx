import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import CopyCodeButton from '@/components/CopyCodeButton';
import { Profile } from '@/types/database.types';

interface ClassDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClassDetailPage({ params }: ClassDetailPageProps) {
  const { id: classId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 사용자 프로필 조회
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 클래스 정보 조회
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('*, teacher:teacher_id(*)')
    .eq('id', classId)
    .single();

  if (classError || !classData) {
    notFound();
  }

  const isTeacher = classData.teacher_id === user.id;

  // 참여 학생 목록 조회
  const { data: members } = await supabase
    .from('class_members')
    .select('id, joined_at, student:student_id(id, name, avatar_url, role)')
    .eq('class_id', classId)
    .order('joined_at', { ascending: false });

  const teacherProfile = classData.teacher as unknown as Profile;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
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
            <div className="flex items-center gap-2">
              <button
                disabled
                className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-400 cursor-not-allowed"
              >
                + 새 레슨 개설 (3단계에서 오픈)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 6자리 참여 코드 안내 배너 (교사 전용) */}
      {isTeacher && (
        <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-sm">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 mb-2">
                📢 학생 안내용 코드
              </span>
              <h2 className="text-lg font-bold text-gray-900">
                학생들에게 이 6자리 코드를 안내해 주세요!
              </h2>
              <p className="text-sm text-gray-500">
                학생들이 로그인 후 참여 코드를 입력하면 이 학급에 바로 등록됩니다.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-blue-200 shadow-md">
              <span className="text-3xl font-mono font-extrabold tracking-widest text-blue-600">
                {classData.join_code}
              </span>
              <CopyCodeButton code={classData.join_code} />
            </div>
          </div>
        </div>
      )}

      {/* 메인 2열 그리드: 레슨 목록 & 참여 학생 목록 */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* 왼쪽 2열: 레슨 목록 영역 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h2 className="text-lg font-bold text-gray-900">수업 레슨 목록</h2>
            <span className="text-xs text-gray-400">총 0개의 레슨</span>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl mb-3">📖</div>
            <h3 className="text-base font-bold text-gray-700">아직 등록된 레슨이 없습니다</h3>
            <p className="mt-1 text-sm text-gray-400">
              {isTeacher
                ? '다음 단계(Slice 3)에서 질문을 수집할 레슨을 개설할 수 있습니다.'
                : '선생님이 레슨을 개설하면 여기에 질문 제출란이 나타납니다.'}
            </p>
          </div>
        </div>

        {/* 오른쪽 1열: 참여 학생 명단 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h2 className="text-lg font-bold text-gray-900">참여 학생 명단</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600">
              {members?.length || 0}명
            </span>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {members && members.length > 0 ? (
              members.map((m) => {
                const student = m.student as unknown as Profile;
                return (
                  <div key={m.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                        {student?.name?.charAt(0) || '학'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {student?.name || '익명 학생'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(m.joined_at).toLocaleDateString('ko-KR')} 참여
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-sm text-gray-400">
                아직 참여한 학생이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
