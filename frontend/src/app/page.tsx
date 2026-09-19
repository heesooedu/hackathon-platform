import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Profile, ClassItem } from '@/types/database.types';
import CreateClassModal from '@/components/CreateClassModal';
import JoinClassModal from '@/components/JoinClassModal';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let teacherClasses: ClassItem[] = [];
  let studentClasses: ClassItem[] = [];

  if (user) {
    // 1. 프로필 조회
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data as Profile | null;

    // 2. 교사일 경우: 자신이 개설한 클래스 목록 조회
    if (profile?.role === 'teacher') {
      const { data: cData } = await supabase
        .from('classes')
        .select('*, class_members(count)')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      teacherClasses = (cData || []).map((c: any) => ({
        ...c,
        member_count: c.class_members?.[0]?.count || 0,
      }));
    }

    // 3. 학생일 경우: 자신이 참여한 클래스 목록 조회
    if (profile?.role === 'student') {
      const { data: mData } = await supabase
        .from('class_members')
        .select('class:class_id(*, teacher:teacher_id(name))')
        .eq('student_id', user.id)
        .order('joined_at', { ascending: false });

      studentClasses = (mData || []).map((m: any) => m.class as ClassItem).filter(Boolean);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {user ? (
        /* 로그인된 사용자 대시보드 뷰 */
        <div className="space-y-8">
          {/* 환영 헤더 카드 */}
          <div className="rounded-2xl border border-blue-100 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-sm font-semibold text-blue-600">
                  {profile?.role === 'teacher' ? '교사용 워크스페이스' : '학생 학습 공간'}
                </span>
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                  반갑습니다, {profile?.name || user.email?.split('@')[0]}님!
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {profile?.role === 'teacher'
                    ? '오늘 수업의 학급을 관리하고 학생들의 질문을 수집해 보세요.'
                    : '참여 중인 수업에 들어가 질문을 남기고 친구들의 질문을 확인해 보세요.'}
                </p>
              </div>

              <div>
                {profile?.role === 'teacher' ? (
                  <CreateClassModal />
                ) : (
                  <JoinClassModal />
                )}
              </div>
            </div>
          </div>

          {/* 내 클래스 섹션 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {profile?.role === 'teacher' ? '내가 개설한 클래스' : '내가 참여 중인 클래스'}
              </h2>
              <span className="text-sm text-gray-500">
                총 {profile?.role === 'teacher' ? teacherClasses.length : studentClasses.length}개
              </span>
            </div>

            {profile?.role === 'teacher' ? (
              /* 교사 클래스 그리드 */
              teacherClasses.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {teacherClasses.map((c) => (
                    <Link
                      key={c.id}
                      href={`/classes/${c.id}`}
                      className="group flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                          <span className="font-mono bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-bold">
                            코드 {c.join_code}
                          </span>
                          <span>학생 {c.member_count || 0}명</span>
                        </div>
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition">
                          {c.name}
                        </h3>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-blue-600 pt-3 border-t border-gray-50">
                        <span>클래스 바로가기</span>
                        <span className="transition group-hover:translate-x-1">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
                  <div className="text-4xl mb-3">🏫</div>
                  <h3 className="text-base font-bold text-gray-700">개설된 클래스가 없습니다</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    우측 상단의 [새 클래스 만들기] 버튼을 눌러 첫 학급을 열어보세요.
                  </p>
                </div>
              )
            ) : (
              /* 학생 클래스 그리드 */
              studentClasses.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {studentClasses.map((c) => (
                    <Link
                      key={c.id}
                      href={`/classes/${c.id}`}
                      className="group flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                    >
                      <div>
                        <div className="text-xs text-gray-400 mb-2">
                          담당: {(c.teacher as any)?.name || '선생님'}
                        </div>
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition">
                          {c.name}
                        </h3>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-blue-600 pt-3 border-t border-gray-50">
                        <span>수업 입장하기</span>
                        <span className="transition group-hover:translate-x-1">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
                  <div className="text-4xl mb-3">🎒</div>
                  <h3 className="text-base font-bold text-gray-700">참여 중인 수업이 없습니다</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    선생님께 받은 6자리 코드를 [참여 코드로 수업 등록]에 입력해 보세요.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        /* 비로그인 방문자 랜딩 뷰 */
        <div className="space-y-16 py-8">
          <div className="text-center space-y-4">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              질문 중심 수업 플랫폼
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              학생의 질문이 모여 <br className="hidden sm:inline" />
              <span className="text-blue-600">더 나은 다음 수업</span>을 만듭니다
            </h1>
            <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-lg">
              수업마다 학생의 솔직한 질문과 이해도를 수집하고, 동료와 함께 답하며,
              선생님은 다음 차시 인터랙티브 교안을 완벽하게 다듬을 수 있습니다.
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <Link
                href="/signup"
                className="rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
              >
                지금 시작하기
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-base font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                로그인
              </Link>
            </div>
          </div>

          {/* 핵심 루프 3단계 소개 */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl mb-4">
                💡
              </div>
              <h3 className="text-lg font-bold text-gray-900">1. 솔직한 질문 제출</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                학생들은 동료들에게 익명으로 부담 없이 질문, 혼란 지점, 또는 이해한 내용을 제출합니다.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-2xl mb-4">
                🤝
              </div>
              <h3 className="text-lg font-bold text-gray-900">2. 대표 질문 & 동료 답변</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                유사한 질문은 대표 질문으로 묶이고, 학생들은 서로 답변을 달며 함께 생각을 확장합니다.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl mb-4">
                ✨
              </div>
              <h3 className="text-lg font-bold text-gray-900">3. 인터랙티브 교안 개선</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                선생님은 검증된 오개념과 질문을 바탕으로 다음 수업의 인터랙티브 웹 교안을 보완합니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
