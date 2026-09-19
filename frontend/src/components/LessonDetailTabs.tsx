'use client';

import { useState } from 'react';

interface LessonDetailTabsProps {
  childrenQuestions: React.ReactNode;
  childrenReview: React.ReactNode;
}

export default function LessonDetailTabs({
  childrenQuestions,
  childrenReview,
}: LessonDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<'board' | 'review'>('board');

  return (
    <div className="space-y-6">
      {/* 탭 버튼 바 */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
        <button
          onClick={() => setActiveTab('board')}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'board'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>💬</span>
          <span>질문 관리 & 대표 질문 (수업 진행)</span>
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'review'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>📊</span>
          <span>수업 회고 & 교안 개선 리포트 (수업 후)</span>
        </button>
      </div>

      {/* 탭 내용 */}
      <div>{activeTab === 'board' ? childrenQuestions : childrenReview}</div>
    </div>
  );
}
