'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lesson, ClassItem } from '@/types/database.types';
import {
  parseLessonMaterial,
  sortLessonsByOrder,
} from '@/utils/materialPayload';
import {
  deployMaterialToClassesAction,
  duplicateMasterMaterialAction,
  deleteMasterMaterialAction,
  reorderMasterMaterialsAction,
} from '@/app/lessons/actions';

export interface DeployedClassLink {
  classId: string;
  className: string;
  lessonId: string;
}

interface MaterialLibraryDashboardProps {
  initialMaterials: Lesson[];
  teacherClasses: ClassItem[];
  /** masterMaterialId -> 배포된 분반(클래스) 및 레슨 정보 배열 */
  deployedMap: Record<string, DeployedClassLink[]>;
}

export default function MaterialLibraryDashboard({
  initialMaterials,
  teacherClasses,
  deployedMap,
}: MaterialLibraryDashboardProps) {
  const router = useRouter();
  const [materials, setMaterials] = useState<Lesson[]>(() =>
    sortLessonsByOrder(initialMaterials)
  );
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'reorder'>('grouped');

  // 드래그 앤 드롭 상태
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSavedToast, setOrderSavedToast] = useState(false);

  // 분반 일괄 배포 모달 상태
  const [deployTargetMaterial, setDeployTargetMaterial] = useState<Lesson | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [deployDeadline, setDeployDeadline] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployToast, setDeployToast] = useState<string | null>(null);

  // 복제 / 삭제 진행 상태
  const [busyMaterialId, setBusyMaterialId] = useState<string | null>(null);

  useEffect(() => {
    setMaterials(sortLessonsByOrder(initialMaterials));
  }, [initialMaterials]);

  // 각 교안의 파싱 메타데이터를 결합
  const enrichedMaterials = useMemo(() => {
    return materials.map((m, idx) => {
      const parsed = parseLessonMaterial(m);
      const subject = parsed.subjectCategory?.trim() || '미분류 과목';
      const unit = parsed.unitCategory?.trim() || '1단원 (기본)';
      const sessionNum = parsed.sessionNumber ?? idx + 1;
      const icon = parsed.pageIcon || '📖';
      const deployedClasses = deployedMap[m.id] || [];
      const hasColab = parsed.markdownContent.includes('```colab');
      const hasVPython = parsed.markdownContent.includes('```vpython');
      const hasSimulation =
        parsed.materialType === 'html' ||
        parsed.markdownContent.includes('```simulation');

      return {
        lesson: m,
        parsed,
        subject,
        unit,
        sessionNum,
        icon,
        deployedClasses,
        hasColab,
        hasVPython,
        hasSimulation,
      };
    });
  }, [materials, deployedMap]);

  // 과목(폴더) → 단원(소분류) 트리 계산
  const subjectTree = useMemo(() => {
    const map = new Map<string, { count: number; units: Map<string, number> }>();
    for (const item of enrichedMaterials) {
      if (!map.has(item.subject)) {
        map.set(item.subject, { count: 0, units: new Map() });
      }
      const entry = map.get(item.subject)!;
      entry.count += 1;
      entry.units.set(item.unit, (entry.units.get(item.unit) || 0) + 1);
    }
    return Array.from(map.entries()).map(([subject, data]) => ({
      subject,
      count: data.count,
      units: Array.from(data.units.entries()).map(([unit, count]) => ({
        unit,
        count,
      })),
    }));
  }, [enrichedMaterials]);

  // 현재 필터링된 교안 목록
  const filteredMaterials = useMemo(() => {
    return enrichedMaterials.filter((item) => {
      if (selectedSubject !== 'ALL' && item.subject !== selectedSubject) {
        return false;
      }
      if (selectedUnit !== 'ALL' && item.unit !== selectedUnit) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = item.lesson.title.toLowerCase().includes(q);
        const matchObj = item.lesson.learning_objective.toLowerCase().includes(q);
        const matchSubj = item.subject.toLowerCase().includes(q);
        const matchUnit = item.unit.toLowerCase().includes(q);
        if (!matchTitle && !matchObj && !matchSubj && !matchUnit) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedMaterials, selectedSubject, selectedUnit, searchQuery]);

  // 단원별 그룹핑 (과목 → 단원 → 차시 순서)
  const groupedBySubjectAndUnit = useMemo(() => {
    const groups: {
      subject: string;
      unit: string;
      items: typeof filteredMaterials;
    }[] = [];
    const keyMap = new Map<string, typeof filteredMaterials>();

    for (const item of filteredMaterials) {
      const key = `${item.subject}___${item.unit}`;
      if (!keyMap.has(key)) {
        const arr: typeof filteredMaterials = [];
        keyMap.set(key, arr);
        groups.push({
          subject: item.subject,
          unit: item.unit,
          items: arr,
        });
      }
      keyMap.get(key)!.push(item);
    }

    for (const g of groups) {
      g.items.sort((a, b) => a.sessionNum - b.sessionNum);
    }

    return groups;
  }, [filteredMaterials]);

  function openDeployModal(lesson: Lesson) {
    const alreadyLinked = (deployedMap[lesson.id] || []).map((d) => d.classId);
    const unlinkedIds = teacherClasses
      .filter((c) => !alreadyLinked.includes(c.id))
      .map((c) => c.id);
    setDeployTargetMaterial(lesson);
    setSelectedClassIds(unlinkedIds);
    setDeployDeadline('');
  }

  async function handleConfirmDeploy() {
    if (!deployTargetMaterial || selectedClassIds.length === 0) return;
    setDeploying(true);
    try {
      const res = await deployMaterialToClassesAction(
        deployTargetMaterial.id,
        selectedClassIds,
        deployDeadline || null
      );
      if (!res.success) {
        alert(res.error || '분반 배포 중 오류가 발생했습니다.');
      } else {
        setDeployToast(
          `🎉 "${deployTargetMaterial.title}" 교안을 선택한 ${res.deployedCount || 0}개 분반에 배포했습니다!`
        );
        setTimeout(() => setDeployToast(null), 4000);
        setDeployTargetMaterial(null);
        router.refresh();
      }
    } finally {
      setDeploying(false);
    }
  }

  async function handleDuplicate(materialId: string) {
    setBusyMaterialId(materialId);
    try {
      const res = await duplicateMasterMaterialAction(materialId);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || '교안 복제 실패');
      }
    } finally {
      setBusyMaterialId(null);
    }
  }

  async function handleDelete(lesson: Lesson) {
    const linkedCount = (deployedMap[lesson.id] || []).length;
    const confirmed = window.confirm(
      linkedCount > 0
        ? `"${lesson.title}" 원본 교안을 보관함에서 삭제하시겠습니까?\n(현재 ${linkedCount}개 분반에 배포되어 있으며, 각 분반의 기존 수업과 학생 질문 데이터는 삭제되지 않고 안전하게 유지됩니다.)`
        : `"${lesson.title}" 교안을 보관함에서 삭제하시겠습니까?`
    );
    if (!confirmed) return;

    setBusyMaterialId(lesson.id);
    try {
      const res = await deleteMasterMaterialAction(lesson.id, false);
      if (res.success) {
        setMaterials((prev) => prev.filter((m) => m.id !== lesson.id));
        router.refresh();
      } else {
        alert(res.error || '교안 삭제 실패');
      }
    } finally {
      setBusyMaterialId(null);
    }
  }

  async function persistNewOrder(updatedList: Lesson[]) {
    setMaterials(updatedList);
    setSavingOrder(true);
    setOrderSavedToast(false);
    try {
      const res = await reorderMasterMaterialsAction(updatedList.map((m) => m.id));
      if (res.success) {
        setOrderSavedToast(true);
        setTimeout(() => setOrderSavedToast(false), 2200);
        router.refresh();
      }
    } finally {
      setSavingOrder(false);
    }
  }

  const newMaterialHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSubject !== 'ALL') params.set('subject', selectedSubject);
    if (selectedUnit !== 'ALL') params.set('unit', selectedUnit);
    const qs = params.toString();
    return qs ? `/materials/new?${qs}` : '/materials/new';
  }, [selectedSubject, selectedUnit]);

  return (
    <div className="space-y-6">
      {/* 상단 알림 토스트 */}
      {deployToast && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-extrabold text-emerald-900 shadow-sm flex items-center justify-between">
          <span>{deployToast}</span>
          <button
            type="button"
            onClick={() => setDeployToast(null)}
            className="text-xs text-emerald-700 underline"
          >
            닫기
          </button>
        </div>
      )}

      {/* 메인 레이아웃: 좌측 과목/단원 폴더 트리 + 우측 교안 목록 */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* 좌측 3열: 과목(대분류) → 단원(소분류) 폴더 사이드바 */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">
                  교안 분류 트리
                </span>
                <h2 className="text-sm font-extrabold text-gray-900">
                  과목 폴더 · 단원별 보기
                </h2>
              </div>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-extrabold text-blue-700">
                총 {materials.length}개
              </span>
            </div>

            {/* 전체 보기 버튼 */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject('ALL');
                  setSelectedUnit('ALL');
                }}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-extrabold transition cursor-pointer ${
                  selectedSubject === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>📚</span>
                  <span>전체 과목 교안 보기</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    selectedSubject === 'ALL'
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {materials.length}
                </span>
              </button>

              {/* 과목별 폴더 아코디언 */}
              {subjectTree.map((subjItem) => {
                const isSubjSelected = selectedSubject === subjItem.subject;
                return (
                  <div key={subjItem.subject} className="space-y-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubject(subjItem.subject);
                        setSelectedUnit('ALL');
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isSubjSelected && selectedUnit === 'ALL'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : isSubjSelected
                          ? 'bg-slate-100 text-gray-900'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{isSubjSelected ? '📂' : '📁'}</span>
                        <span className="truncate">{subjItem.subject}</span>
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-extrabold text-gray-600">
                        {subjItem.count}
                      </span>
                    </button>

                    {/* 하위 단원(소분류) 목록 */}
                    {isSubjSelected && subjItem.units.length > 0 && (
                      <div className="ml-4 pl-2.5 border-l-2 border-indigo-100 space-y-1 py-1">
                        {subjItem.units.map((u) => {
                          const isUnitSelected = selectedUnit === u.unit;
                          return (
                            <button
                              key={u.unit}
                              type="button"
                              onClick={() => {
                                setSelectedSubject(subjItem.subject);
                                setSelectedUnit(u.unit);
                              }}
                              className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                                isUnitSelected
                                  ? 'bg-indigo-600 text-white font-bold'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <span className="truncate pr-1">📑 {u.unit}</span>
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.2 text-[10px] ${
                                  isUnitSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {u.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-gray-100">
              <Link
                href={newMaterialHref}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-blue-700 transition"
              >
                <span>✨</span>
                <span>
                  {selectedSubject !== 'ALL'
                    ? `[${selectedSubject}] 새 교안 만들기`
                    : '+ 새 수업 교안 만들기'}
                </span>
              </Link>
            </div>
          </div>

          {/* 분반 운영 안내 카드 */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2 text-xs text-indigo-950">
            <div className="font-extrabold text-indigo-800 flex items-center gap-1.5">
              <span>💡</span>
              <span>원본 교안 ↔ 분반(A·B·C·D) 연동 안내</span>
            </div>
            <p className="text-indigo-900/80 leading-relaxed text-[11px]">
              여기서 교안을 한 번 만들어 두고 각 분반(A, B, C, D반)에 불러오면,{' '}
              <strong>어느 반에서든 교안을 수정하거나 AI 보충 패치를 적용할 때 모든 분반의 교안이 함께 최신화</strong>됩니다.
            </p>
          </div>
        </aside>

        {/* 우측 9열: 검색/정렬 바 & 단원별/차시별 교안 카드 리스트 */}
        <div className="lg:col-span-9 space-y-5">
          {/* 상단 필터/검색/보기모드 툴바 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="교안 제목, 단원명, 학습 목표로 검색..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-9 pr-3 py-2 text-xs sm:text-sm text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  🔍
                </span>
              </div>

              {(selectedSubject !== 'ALL' || selectedUnit !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubject('ALL');
                    setSelectedUnit('ALL');
                    setSearchQuery('');
                  }}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 shrink-0"
                >
                  필터 초기화
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {savingOrder && (
                <span className="text-xs font-bold text-blue-600">⏳ 순서 저장 중...</span>
              )}
              {orderSavedToast && (
                <span className="text-xs font-bold text-emerald-600">✅ 차시 순서 저장됨</span>
              )}

              <div className="inline-flex rounded-xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grouped')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    viewMode === 'grouped'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🗂️ 과목 · 단원별 묶음 보기
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('reorder')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    viewMode === 'reorder'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ⋮⋮ 차시 순서 드래그 정렬
                </button>
              </div>
            </div>
          </div>

          {/* 교안 리스트 본문 */}
          {filteredMaterials.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-14 text-center space-y-3">
              <div className="text-4xl">📚</div>
              <h3 className="text-base font-extrabold text-gray-800">
                조건에 맞는 수업 교안이 없습니다
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                우측 상단 또는 아래 버튼을 눌러 첫 노션형 수업 교안을 작성하고, A·B·C·D 분반 클래스에 원클릭으로 불러와 보세요.
              </p>
              <div className="pt-2">
                <Link
                  href={newMaterialHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  <span>✨</span>
                  <span>+ 새 수업 교안 작성하기</span>
                </Link>
              </div>
            </div>
          ) : viewMode === 'grouped' ? (
            /* 1) 과목 > 단원별 그룹핑 뷰 */
            <div className="space-y-6">
              {groupedBySubjectAndUnit.map((group) => (
                <div
                  key={`${group.subject}-${group.unit}`}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4"
                >
                  {/* 단원 섹션 헤더 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-extrabold text-white">
                        📁 {group.subject}
                      </span>
                      <span className="text-gray-300 font-bold">›</span>
                      <h3 className="text-base font-extrabold text-gray-900">
                        📑 {group.unit}
                      </h3>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                        {group.items.length}개 차시
                      </span>
                    </div>

                    <Link
                      href={`/materials/new?subject=${encodeURIComponent(
                        group.subject
                      )}&unit=${encodeURIComponent(group.unit)}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                    >
                      <span>+ 이 단원에 차시 교안 추가</span>
                    </Link>
                  </div>

                  {/* 단원 내 차시 교안 카드 목록 */}
                  <div className="space-y-3">
                    {group.items.map((item) => {
                      const isBusy = busyMaterialId === item.lesson.id;
                      const patchCount = item.parsed.appliedPatches.length;

                      return (
                        <div
                          key={item.lesson.id}
                          className="rounded-2xl border border-gray-100 bg-slate-50/50 p-4 hover:border-blue-200 hover:bg-white transition space-y-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[11px] font-extrabold text-white">
                                  {item.sessionNum}차시
                                </span>
                                {item.hasColab && (
                                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                                    🐍 Colab 실습
                                  </span>
                                )}
                                {item.hasVPython && (
                                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                                    🪐 Web VPython 3D
                                  </span>
                                )}
                                {item.hasSimulation && (
                                  <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                                    ⚡ JS 시뮬레이션
                                  </span>
                                )}
                                {patchCount > 0 && (
                                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                                    ✨ 질문 기반 보충 패치 {patchCount}건 반영됨
                                  </span>
                                )}
                              </div>

                              <Link
                                href={`/materials/${item.lesson.id}/edit`}
                                className="flex items-center gap-2 text-base sm:text-lg font-extrabold text-gray-900 hover:text-blue-600 transition"
                              >
                                <span>{item.icon}</span>
                                <span className="truncate">{item.lesson.title}</span>
                              </Link>

                              <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                                🎯 {item.lesson.learning_objective}
                              </p>
                            </div>

                            {/* 우측 액션 버튼 그룹 */}
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => openDeployModal(item.lesson)}
                                className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer"
                              >
                                <span>🚀</span>
                                <span>분반 배포</span>
                              </button>

                              <Link
                                href={`/materials/${item.lesson.id}/edit`}
                                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
                              >
                                <span>✏️</span>
                                <span>수정</span>
                              </Link>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDuplicate(item.lesson.id)}
                                title="이 교안을 복제하여 다음 차시 교안 빠르게 만들기"
                                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition cursor-pointer"
                              >
                                <span>📋 복제</span>
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDelete(item.lesson)}
                                className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition cursor-pointer"
                              >
                                <span>🗑️</span>
                              </button>
                            </div>
                          </div>

                          {/* 하단: 현재 연동된 분반(A, B, C, D반) 바로가기 배지 */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-gray-200/70 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-gray-500">
                                🏫 연동된 분반({item.deployedClasses.length}개):
                              </span>
                              {item.deployedClasses.length > 0 ? (
                                item.deployedClasses.map((dc) => (
                                  <Link
                                    key={dc.lessonId}
                                    href={`/classes/${dc.classId}/lessons/${dc.lessonId}`}
                                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                                    title={`${dc.className} 수업 및 질문 보드로 이동`}
                                  >
                                    <span>{dc.className}</span>
                                    <span>↗</span>
                                  </Link>
                                ))
                              ) : (
                                <span className="text-gray-400">
                                  아직 배포된 분반이 없습니다. [🚀 분반 배포]를 눌러 학급에 적용하세요.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 2) 드래그 앤 드롭 차시 순서 정렬 뷰 */
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 text-xs text-gray-500">
                <span className="font-bold text-gray-800">
                  ⋮⋮ 카드를 마우스로 잡고 위아래로 드래그하여 보관함 내 기본 차시 순서를 변경하세요.
                </span>
              </div>

              {materials.map((mat, idx) => {
                const parsed = parseLessonMaterial(mat);
                const deployed = deployedMap[mat.id] || [];
                const isBeingDragged = draggedIdx === idx;
                const isDragTarget = dragOverIdx === idx && draggedIdx !== idx;

                return (
                  <div
                    key={mat.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedIdx(idx);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', mat.id);
                    }}
                    onDragOver={(e) => {
                      if (draggedIdx === null) return;
                      e.preventDefault();
                      if (dragOverIdx !== idx) setDragOverIdx(idx);
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    onDrop={(e) => {
                      if (draggedIdx === null) return;
                      e.preventDefault();
                      const fromIdx = draggedIdx;
                      const toIdx = idx;
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                      if (fromIdx === toIdx) return;
                      const next = [...materials];
                      const [moved] = next.splice(fromIdx, 1);
                      next.splice(toIdx, 0, moved);
                      persistNewOrder(next);
                    }}
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                      isBeingDragged
                        ? 'opacity-45 border-blue-400 bg-blue-50/20'
                        : isDragTarget
                        ? 'border-2 border-blue-500 ring-2 ring-blue-100'
                        : 'border-gray-100 bg-white hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-7 cursor-grab items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 font-bold text-sm shrink-0">
                        ⋮⋮
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                            {parsed.subjectCategory || '미분류'}
                          </span>
                          <span className="rounded bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">
                            {parsed.unitCategory || '1단원'}
                          </span>
                          <span className="font-bold text-gray-400">
                            • {deployed.length}개 분반 연동
                          </span>
                        </div>
                        <div className="font-extrabold text-gray-900 truncate mt-0.5">
                          {parsed.pageIcon || '📖'} {mat.title}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openDeployModal(mat)}
                        className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                      >
                        🚀 분반 배포
                      </button>
                      <Link
                        href={`/materials/${mat.id}/edit`}
                        className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        ✏️ 수정
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 분반(A·B·C·D반) 원클릭 일괄 배포 모달 */}
      {deployTargetMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-extrabold text-blue-800">
                  분반 일괄 배포
                </span>
                <h3 className="text-lg font-extrabold text-gray-900 mt-1">
                  🚀 선택한 분반(클래스)에 교안 내보내기
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  대상 교안: <strong className="text-gray-800">{deployTargetMaterial.title}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeployTargetMaterial(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {teacherClasses.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                아직 개설된 클래스(분반)가 없습니다. 먼저 메인 대시보드에서 A반, B반 등 클래스를 개설해 주세요.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">
                    배포할 학급(분반) 선택
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const alreadyLinked = (
                        deployedMap[deployTargetMaterial.id] || []
                      ).map((d) => d.classId);
                      const unlinked = teacherClasses
                        .filter((c) => !alreadyLinked.includes(c.id))
                        .map((c) => c.id);
                      setSelectedClassIds(unlinked);
                    }}
                    className="text-xs font-extrabold text-blue-600 hover:underline cursor-pointer"
                  >
                    미배포 분반 전체 선택
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {teacherClasses.map((cls) => {
                    const alreadyLinked = (
                      deployedMap[deployTargetMaterial.id] || []
                    ).some((d) => d.classId === cls.id);
                    const isChecked = selectedClassIds.includes(cls.id);

                    return (
                      <div
                        key={cls.id}
                        onClick={() => {
                          if (alreadyLinked) return;
                          setSelectedClassIds((prev) =>
                            prev.includes(cls.id)
                              ? prev.filter((id) => id !== cls.id)
                              : [...prev, cls.id]
                          );
                        }}
                        className={`flex items-center justify-between rounded-2xl border p-3.5 transition ${
                          alreadyLinked
                            ? 'border-emerald-200 bg-emerald-50/50 cursor-default'
                            : isChecked
                            ? 'border-blue-600 bg-blue-50/60 cursor-pointer'
                            : 'border-gray-200 bg-white hover:bg-gray-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">
                            {alreadyLinked ? '✅' : isChecked ? '☑️' : '⬜'}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {cls.name}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              참여 코드: {cls.join_code}
                            </div>
                          </div>
                        </div>

                        {alreadyLinked ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800">
                            이미 연동됨
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-blue-600">
                            {isChecked ? '배포 대상' : '클릭하여 선택'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    ⏰ 선택 분반 질문 제출 마감일 (선택사항)
                  </label>
                  <input
                    type="datetime-local"
                    value={deployDeadline}
                    onChange={(e) => setDeployDeadline(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-800"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeployTargetMaterial(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deploying || selectedClassIds.length === 0}
                onClick={handleConfirmDeploy}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
              >
                {deploying
                  ? '분반에 배포 중...'
                  : `선택한 ${selectedClassIds.length}개 분반에 일괄 배포하기`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
