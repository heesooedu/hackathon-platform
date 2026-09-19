import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Profile } from '@/types/database.types';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data as Profile | null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {user ? (
        /* 로그인된 사용자 대시보드 뷰 */
        <div className="space-y-8">
          <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-sm font-semibold text-blue-600">
                  {profile?.role === 'teacher' ? '교사용 워크스페이스' : '학생 학습 공간'}
                </span>
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                  반갑습니다, {profile?.name || user.email?.split('@')[0]}님!
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {profile?.role === 'teacher'
                    ? '오늘 수업의 학생 질문들을 확인하고 다음 인터랙티브 교안을 준비해 보세요.'
                    : '수업에 참여하여 궁금한 점을 질문하고 친구들의 질문에 답변해 보세요.'}
                </p>
              </div>

              <div className="mt-4 sm:mt-0">
                <span
                  className={`inline-flex rounded-xl px-4 py-2 text-sm font-bold ${
                    profile?.role === 'teacher'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {profile?.role === 'teacher' ? '👨‍🏫 선생님 계정' : '🧑‍🎓 학생 계정'}
                </span>
              </div>
            </div>
          </div>

          {/* 다음 단계(Slice 2: 클래스 생성 및 참여) 준비 카드 */}
          <div className="grid gap-6 sm:grid-cols-2">
            {profile?.role === 'teacher' ? (
              <>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="text-3xl mb-3">🏫</div>
                  <h2 className="text-lg font-bold text-gray-900">내 클래스 관리</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    새로운 학급을 개설하고 6자리 참여 코드를 발급하세요.
                  </p>
                  <button
                    disabled
                    className="mt-4 inline-flex items-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
                  >
                    클래스 개설 (2단계에서 오픈)
                  </button>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="text-3xl mb-3">📋</div>
                  <h2 className="text-lg font-bold text-gray-900">레슨 질문 보드</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    학생들의 질문을 그룹화하고 대표 질문을 선정합니다.
                  </p>
                  <button
                    disabled
                    className="mt-4 inline-flex items-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
                  >
                    질문 보드 보기 (준비 중)
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="text-3xl mb-3">🔑</div>
                  <h2 className="text-lg font-bold text-gray-900">수업 참여하기</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    선생님께서 안내해주신 6자리 참여 코드로 수업에 입장하세요.
                  </p>
                  <button
                    disabled
                    className="mt-4 inline-flex items-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
                  >
                    코드 입력 (2단계에서 오픈)
                  </button>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="text-3xl mb-3">💬</div>
                  <h2 className="text-lg font-bold text-gray-900">내 질문 & 동료 답변</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    제출한 질문과 내가 작성한 동료 답변 내역을 확인합니다.
                  </p>
                  <button
                    disabled
                    className="mt-4 inline-flex items-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
                  >
                    내 활동 (준비 중)
                  </button>
                </div>
              </>
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
