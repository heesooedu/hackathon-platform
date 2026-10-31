'use client';

import { useState } from 'react';
import {
  Lesson,
  Submission,
  FormativeQuiz,
  Profile,
} from '@/types/database.types';
import CopyCodeButton from '@/components/CopyCodeButton';
import LessonListWithReorder from '@/components/LessonListWithReorder';
import TeamTeachingModal from '@/components/TeamTeachingModal';
import ClassStudentManagementDashboard, {
  EnrolledStudentRecord,
  StudentPeerAnswerItem,
} from '@/components/ClassStudentManagementDashboard';

interface ClassDetailViewProps {
  classId: string;
  className: string;
  joinCode: string;
  isTeacher: boolean;
  isOwner?: boolean;
  currentUserId?: string;
  primaryTeacher?: {
    id: string;
    name: string;
  };
  coTeachers?: Profile[];
  lessons: Lesson[];
  enrolledStudents: EnrolledStudentRecord[];
  submissions: Submission[];
  quizzes: FormativeQuiz[];
  peerAnswersByStudent: Record<string, StudentPeerAnswerItem[]>;
  initialTab?: 'lessons' | 'students';
}

export default function ClassDetailView({
  classId,
  className,
  joinCode,
  isTeacher,
  isOwner = false,
  currentUserId = '',
  primaryTeacher,
  coTeachers = [],
  lessons,
  enrolledStudents,
  submissions,
  quizzes,
  peerAnswersByStudent,
  initialTab = 'lessons',
}: ClassDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'lessons' | 'students'>(
    initialTab
  );

  // 학생 계정일 때는 차시 목록만 렌더링
  if (!isTeacher) {
    return (
      <div className="space-y-8">
        <LessonListWithReorder
          classId={classId}
          initialLessons={lessons}
          isTeacher={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 교사용 메인 탭 네비게이션 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2 bg-gray-100/90 p-1.5 rounded-2xl border border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('lessons')}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'lessons'
                ? 'bg-white text-blue-700 shadow-xs border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>📚 수업 교안 & 차시 목록</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'lessons'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {lessons.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'students'
                ? 'bg-white text-indigo-700 shadow-xs border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>👥 학생 관리 & 학습 대시보드</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'students'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {enrolledStudents.length}명
            </span>
          </button>
        </div>

        {/* 우측 참여 코드 미니 칩 */}
        <div className="flex items-center gap-2.5 bg-blue-50/70 px-3.5 py-2 rounded-xl border border-blue-200">
          <span className="text-xs font-semibold text-blue-800">
            📢 학생 참여 코드:
          </span>
          <span className="text-base font-mono font-extrabold tracking-wider text-blue-700">
            {joinCode}
          </span>
          <CopyCodeButton code={joinCode} />
        </div>
      </div>

      {/* 탭 1: 수업 교안 & 차시 목록 */}
      {activeTab === 'lessons' && (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* 왼쪽 2열: 레슨 목록 영역 */}
          <div className="lg:col-span-2">
            <LessonListWithReorder
              classId={classId}
              initialLessons={lessons}
              isTeacher={true}
            />
          </div>

          {/* 오른쪽 1열: 팀티칭 교사진 & 참여 학생 요약 */}
          <div className="space-y-6">
            {primaryTeacher && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">
                      🤝 수업 지도 교사진
                    </h2>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                      {1 + coTeachers.length}명
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-amber-50/60 border border-amber-100 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">👑</span>
                        <span className="text-xs font-extrabold text-gray-900">
                          {primaryTeacher.name} 선생님
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-amber-800">
                        대표 교사
                      </span>
                    </div>

                    {coTeachers.map((ct) => (
                      <div
                        key={ct.id}
                        className="flex items-center justify-between rounded-xl bg-indigo-50/50 border border-indigo-100 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs">🤝</span>
                          <span className="text-xs font-extrabold text-gray-900">
                            {ct.name} 선생님
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-700">
                          공동 교사
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1 flex justify-end">
                    <TeamTeachingModal
                      classId={classId}
                      classNameTitle={className}
                      joinCode={joinCode}
                      primaryTeacher={primaryTeacher}
                      coTeachers={coTeachers}
                      currentUserId={currentUserId}
                      isOwner={isOwner}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">참여 학생 명단</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600">
                  {enrolledStudents.length}명
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('students')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                학생 추가·대시보드 →
              </button>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-indigo-950">
                    학생 추가·제외 및 학습 현황 분석
                  </div>
                  <p className="text-[11px] text-indigo-700/80 mt-0.5">
                    차시별 질문·이해 상태 및 퀴즈 성취도를 한눈에 확인하세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('students')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shrink-0 transition-colors cursor-pointer"
                >
                  관리 탭 열기
                </button>
              </div>

              <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {enrolledStudents.length > 0 ? (
                  enrolledStudents.map((stu) => {
                    const stuSubsCount = submissions.filter(
                      (s) => s.student_id === stu.studentId
                    ).length;
                    return (
                      <div
                        key={stu.id}
                        className="flex items-center justify-between py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                            {stu.name.charAt(0) || '학'}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {stu.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(stu.joinedAt).toLocaleDateString('ko-KR')}{' '}
                              참여
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('students')}
                          className="text-xs font-semibold text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 px-2.5 py-1 rounded-lg border border-gray-200/80 transition-colors cursor-pointer"
                        >
                          제출 {stuSubsCount}/{lessons.length}차시
                        </button>
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
      )}

      {/* 탭 2: 학생 관리 & 학습 대시보드 */}
      {activeTab === 'students' && (
        <ClassStudentManagementDashboard
          classId={classId}
          className={className}
          joinCode={joinCode}
          lessons={lessons}
          enrolledStudents={enrolledStudents}
          submissions={submissions}
          quizzes={quizzes}
          peerAnswersByStudent={peerAnswersByStudent}
        />
      )}
    </div>
  );
}
