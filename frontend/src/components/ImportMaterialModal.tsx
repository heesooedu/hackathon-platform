'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lesson } from '@/types/database.types';
import { parseLessonMaterial } from '@/utils/materialPayload';
import { importMaterialsToClassAction } from '@/app/lessons/actions';

interface ImportMaterialModalProps {
  classId: string;
  className: string;
  masterMaterials: Lesson[];
  alreadyImportedSourceIds: string[];
}

export default function ImportMaterialModal({
  classId,
  className,
  masterMaterials,
  alreadyImportedSourceIds,
}: ImportMaterialModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [importing, setImporting] = useState(false);

  const enriched = useMemo(() => {
    return masterMaterials.map((m, idx) => {
      const parsed = parseLessonMaterial(m);
      return {
        lesson: m,
        parsed,
        subject: parsed.subjectCategory?.trim() || '미분류 과목',
        unit: parsed.unitCategory?.trim() || '1단원 (기본)',
        sessionNumber: parsed.sessionNumber ?? idx + 1,
        icon: parsed.pageIcon || '📖',
        alreadyImported: alreadyImportedSourceIds.includes(m.id),
      };
    });
  }, [masterMaterials, alreadyImportedSourceIds]);

  const subjectTree = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of enriched) {
      if (!map.has(item.subject)) {
        map.set(item.subject, new Set());
      }
      map.get(item.subject)!.add(item.unit);
    }
    return Array.from(map.entries()).map(([subject, units]) => ({
      subject,
      units: Array.from(units),
    }));
  }, [enriched]);

  const filteredItems = useMemo(() => {
    return enriched.filter((item) => {
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
        const matchSubject = item.subject.toLowerCase().includes(q);
        const matchUnit = item.unit.toLowerCase().includes(q);
        if (!matchTitle && !matchObj && !matchSubject && !matchUnit) {
          return false;
        }
      }
      return true;
    });
  }, [enriched, selectedSubject, selectedUnit, searchQuery]);

  function toggleMaterial(id: string) {
    setSelectedMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function selectAllFilteredAvailable() {
    const availableIds = filteredItems
      .filter((i) => !i.alreadyImported)
      .map((i) => i.lesson.id);
    const allSelected = availableIds.every((id) => selectedMaterialIds.includes(id));
    if (allSelected) {
      setSelectedMaterialIds((prev) =>
        prev.filter((id) => !availableIds.includes(id))
      );
    } else {
      setSelectedMaterialIds((prev) =>
        Array.from(new Set([...prev, ...availableIds]))
      );
    }
  }

  async function handleImport() {
    if (selectedMaterialIds.length === 0) {
      alert('이 학급으로 불러올 교안을 1개 이상 선택해 주세요.');
      return;
    }

    setImporting(true);
    try {
      const res = await importMaterialsToClassAction(
        classId,
        selectedMaterialIds,
        deadline || null
      );
      if (res.error) {
        alert(res.error);
      } else {
        setOpen(false);
        setSelectedMaterialIds([]);
        router.refresh();
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-700"
      >
        <span className="text-base">📚</span>
        <span>교안 보관함에서 교안 불러오기</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-white px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-indigo-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                    📚 교안 보관함 불러오기
                  </span>
                  <span className="text-xs font-bold text-indigo-700">
                    대상 분반: {className}
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-extrabold text-gray-900">
                  과목 · 단원별 교안을 선택하여 이 학급(분반)에 불러오기
                </h3>
                <p className="text-xs text-gray-500">
                  불러온 교안은 원본 교안과 실시간 연동되어, 추후 교안 수정이나 AI 보충 설명 패치 시 모든 분반에 자동 반영됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                ✕ 닫기
              </button>
            </div>

            {/* 필터 및 검색 바 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-slate-50/70 px-6 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedUnit('ALL');
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ALL">📁 전체 과목 ({enriched.length})</option>
                  {subjectTree.map((s) => (
                    <option key={s.subject} value={s.subject}>
                      📁 {s.subject}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ALL">📂 전체 단원</option>
                  {(selectedSubject === 'ALL'
                    ? Array.from(new Set(enriched.map((i) => i.unit)))
                    : subjectTree.find((s) => s.subject === selectedSubject)?.units || []
                  ).map((u) => (
                    <option key={u} value={u}>
                      📂 {u}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="교안 제목·학습목표 검색..."
                  className="w-48 sm:w-64 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllFilteredAvailable}
                  className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition"
                >
                  ☑️ 현재 목록 일괄 선택/해제
                </button>
                <Link
                  href={`/materials/new?classId=${classId}`}
                  className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-white hover:bg-slate-900 transition"
                >
                  + 보관함에 새 교안 만들기
                </Link>
              </div>
            </div>

            {/* 교안 리스트 본문 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const isChecked = selectedMaterialIds.includes(item.lesson.id);
                  return (
                    <label
                      key={item.lesson.id}
                      className={`flex items-start justify-between gap-4 rounded-2xl border p-4 transition cursor-pointer ${
                        item.alreadyImported
                          ? 'border-emerald-200 bg-emerald-50/40 opacity-80'
                          : isChecked
                          ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-100'
                          : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked || item.alreadyImported}
                          disabled={item.alreadyImported}
                          onChange={() => toggleMaterial(item.lesson.id)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-extrabold text-indigo-800">
                              📁 {item.subject}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                              📂 {item.unit}
                            </span>
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-extrabold text-blue-700">
                              {item.sessionNumber}차시
                            </span>
                            {item.parsed.appliedPatches.length > 0 && (
                              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                🩹 누적 질문 패치 {item.parsed.appliedPatches.length}건 포함
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
                            <span>{item.icon}</span>
                            <span className="truncate">{item.lesson.title}</span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-1">
                            🎯 {item.lesson.learning_objective}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {item.alreadyImported ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
                            ✅ 이미 이 분반에 등록됨
                          </span>
                        ) : isChecked ? (
                          <span className="inline-flex items-center rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-extrabold text-white">
                            선택됨
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                            불러오기 가능
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center">
                  <div className="text-3xl mb-2">📂</div>
                  <p className="text-sm font-bold text-gray-700">
                    조건에 맞는 교안이 없습니다.
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    교안 보관함 스튜디오에서 과목·단원별 교안을 먼저 제작해 보세요.
                  </p>
                </div>
              )}
            </div>

            {/* 하단 액션 바 */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 bg-slate-50 px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-bold text-gray-600">
                  ⏰ 이 분반 질문 마감 기한 (선택):
                </label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-indigo-700">
                  총 {selectedMaterialIds.length}개 교안 선택됨
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={importing || selectedMaterialIds.length === 0}
                  onClick={handleImport}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {importing
                    ? '불러오는 중...'
                    : `📥 선택한 교안 ${selectedMaterialIds.length}개 학급에 불러오기`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
