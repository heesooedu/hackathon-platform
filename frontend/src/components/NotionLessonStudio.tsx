'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createLesson,
  updateLessonAction,
  deleteLessonAction,
  saveMasterMaterialAction,
  deleteMasterMaterialAction,
  parseMaterialFileAction,
} from '@/app/lessons/actions';
import NotionBlockEditor from '@/components/NotionBlockEditor';
import {
  markdownToBlocks,
  blocksToMarkdown,
  NotionBlock,
} from '@/utils/notionBlocks';
import { SimpleMarkdownRenderer } from '@/components/LessonMaterialViewer';
import {
  QUADRATIC_FUNCTION_HTML,
  SAMPLE_GENERAL_MARKDOWN,
  SAMPLE_MATH_MARKDOWN,
  SAMPLE_PHYSICS_MARKDOWN,
  SAMPLE_PHYSICAL_COMPUTING_MARKDOWN,
  SAMPLE_DATA_ANALYSIS_MARKDOWN,
  SAMPLE_AI_LAB_MARKDOWN,
} from '@/utils/sampleMaterials';
import { parseLessonMaterial } from '@/utils/materialPayload';
import { Lesson, MaterialType, ClassItem } from '@/types/database.types';

const PAGE_ICONS = ['📖', '💻', '📘', '📐', '🧪', '🌍', '🏛️', '🎨', '📝', '🎓'];

const DEFAULT_SUBJECT_SUGGESTIONS = [
  '정보',
  '물리학 I',
  '수학',
  '통합사회',
  '인공지능 기초',
  '통합과학',
];

export interface NotionLessonStudioProps {
  classId?: string;
  className?: string;
  mode?: 'create' | 'edit' | 'library-create' | 'library-edit';
  initialLesson?: Lesson;
  /** 교사가 보유한 전체 일반 학급(분반 A, B, C, D 등) 목록 */
  teacherClasses?: ClassItem[];
  /** 이미 이 원본 교안이 배포/연동된 학급 ID 목록 */
  alreadyLinkedClassIds?: string[];
  /** 기존 교안들에 등록된 과목 목록 (자동완성 추천용) */
  existingSubjects?: string[];
  /** 기존 교안들에 등록된 단원 목록 (자동완성 추천용) */
  existingUnits?: string[];
  /** URL 쿼리로 전달된 기본 과목/단원/배포 대상 학급 */
  defaultSubject?: string;
  defaultUnit?: string;
  defaultDeployClassId?: string;
}

function toDatetimeLocalValue(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
    return localISOTime;
  } catch {
    return '';
  }
}

export default function NotionLessonStudio({
  classId = '',
  className = '',
  mode = 'create',
  initialLesson,
  teacherClasses = [],
  alreadyLinkedClassIds = [],
  existingSubjects = [],
  existingUnits = [],
  defaultSubject = '',
  defaultUnit = '',
  defaultDeployClassId = '',
}: NotionLessonStudioProps) {
  const router = useRouter();
  const isLibraryMode = mode === 'library-create' || mode === 'library-edit';
  const isEditMode = (mode === 'edit' || mode === 'library-edit') && !!initialLesson;
  const initialParsed = initialLesson ? parseLessonMaterial(initialLesson) : null;

  const [pageIcon, setPageIcon] = useState(initialParsed?.pageIcon || '📖');
  const [title, setTitle] = useState(initialLesson?.title || '');
  const [learningObjective, setLearningObjective] = useState(
    initialLesson?.learning_objective || ''
  );
  const [subjectCategory, setSubjectCategory] = useState(
    initialParsed?.subjectCategory || defaultSubject || (className || '정보')
  );
  const [unitCategory, setUnitCategory] = useState(
    initialParsed?.unitCategory || defaultUnit || '1단원. 핵심 개념과 실습'
  );
  const [sessionNumber, setSessionNumber] = useState<string>(
    initialParsed?.sessionNumber !== null && initialParsed?.sessionNumber !== undefined
      ? String(initialParsed.sessionNumber)
      : '1'
  );
  const [deadline, setDeadline] = useState(() =>
    toDatetimeLocalValue(initialLesson?.deadline)
  );
  const [selectedDeployClassIds, setSelectedDeployClassIds] = useState<string[]>(() =>
    defaultDeployClassId ? [defaultDeployClassId] : []
  );

  const [materialType, setMaterialType] = useState<MaterialType>(
    initialParsed?.materialType || 'markdown'
  );
  const [blocks, setBlocks] = useState<NotionBlock[]>(() =>
    markdownToBlocks(initialParsed?.markdownContent || '')
  );
  const [materialHtml, setMaterialHtml] = useState(
    initialParsed?.htmlContent || ''
  );
  const [materialFileName, setMaterialFileName] = useState<string | null>(
    initialParsed?.fileName || null
  );
  const [uploadSuccessBadge, setUploadSuccessBadge] = useState<string | null>(null);

  const [previewMode, setPreviewMode] = useState(false);
  const [fileParsing, setFileParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const mergedSubjectSuggestions = Array.from(
    new Set([...existingSubjects, ...DEFAULT_SUBJECT_SUGGESTIONS].filter(Boolean))
  );
  const mergedUnitSuggestions = Array.from(
    new Set(
      [
        ...existingUnits,
        '1단원. 기초 개념과 원리',
        '2단원. 심화 탐구와 실습',
        '3단원. 프로젝트와 문제 해결',
      ].filter(Boolean)
    )
  );

  function cyclePageIcon() {
    const nextIdx = (PAGE_ICONS.indexOf(pageIcon) + 1) % PAGE_ICONS.length;
    setPageIcon(PAGE_ICONS[nextIdx]);
  }

  function toggleDeployClass(targetId: string) {
    setSelectedDeployClassIds((prev) =>
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId]
    );
  }

  function selectAllUnlinkedClasses() {
    const unlinked = teacherClasses
      .filter((c) => !alreadyLinkedClassIds.includes(c.id))
      .map((c) => c.id);
    setSelectedDeployClassIds(unlinked);
  }

  function applySampleTemplate(
    type:
      | 'general'
      | 'math'
      | 'physics'
      | 'physical'
      | 'data_analysis'
      | 'ai_lab'
      | 'html'
  ) {
    setErrorMessage(null);
    setPreviewMode(false);
    if (type === 'general') {
      setPageIcon('🏛️');
      setSubjectCategory('통합사회');
      setUnitCategory('2단원. 인권 보장과 헌법');
      setSessionNumber('2');
      setTitle('2차시: 시민 혁명과 기본권(참정권·사회권)의 확장');
      setLearningObjective(
        '천부인권 사상과 시민 혁명의 의의를 이해하고, 초기 시민 혁명의 한계가 참정권 확대 운동 및 사회권 등장으로 이어진 과정을 설명할 수 있다.'
      );
      setMaterialType('markdown');
      setBlocks(markdownToBlocks(SAMPLE_GENERAL_MARKDOWN));
      setMaterialFileName('2차시_시민혁명과_인권확장_교안.hwpx');
      setUploadSuccessBadge('인문/사회 노션 교안 템플릿 로드됨');
    } else if (type === 'math') {
      setPageIcon('📐');
      setSubjectCategory('수학');
      setUnitCategory('2단원. 이차함수와 그래프');
      setSessionNumber('3');
      setTitle('3차시: 이차함수 y=ax²+bx+c의 그래프와 계수의 역할');
      setLearningObjective(
        '계수 a, b, c의 부호와 크기에 따른 포물선의 모양, 대칭축, 꼭짓점의 위치 변화를 설명할 수 있다.'
      );
      setMaterialType('markdown');
      setBlocks(markdownToBlocks(SAMPLE_MATH_MARKDOWN));
      setMaterialFileName('3차시_이차함수_핵심개념정리.docx');
      setUploadSuccessBadge('수학 개념 노션 교안 템플릿 로드됨');
    } else if (type === 'physics') {
      setPageIcon('🧪');
      setSubjectCategory('물리학 I');
      setUnitCategory('1단원. 역학과 에너지');
      setSessionNumber('4');
      setTitle('4차시: 포물선 운동의 수평·연직 성분 분해와 투사체 실험');
      setLearningObjective(
        '포물선 운동을 수평 등속도 운동과 연직 등가속도 운동으로 분해하여 이해하고, 초기 속력과 발사각에 따른 운동 궤적을 시뮬레이션으로 탐구할 수 있다.'
      );
      setMaterialType('markdown');
      setBlocks(markdownToBlocks(SAMPLE_PHYSICS_MARKDOWN));
      setMaterialFileName('4차시_물리_포물선운동_노션실험교안.md');
      setUploadSuccessBadge('물리 노션 교안(인라인 JS 운동 시뮬레이션 포함) 로드됨');
    } else if (type === 'physical') {
      setPageIcon('💻');
      setSubjectCategory('정보');
      setUnitCategory('4단원. 컴퓨팅 시스템과 피지컬 컴퓨팅');
      setSessionNumber('5');
      setTitle('5차시: 센서와 액추에이터를 활용한 피지컬 컴퓨팅 제어 실습 (micro:bit · Arduino · Pico)');
      setLearningObjective(
        '센서(입력)와 액추에이터(출력)의 역할을 이해하고, 마이크로비트·아두이노 Uno·라즈베리파이 피코 보드의 가상 회로 시뮬레이터에서 조건 제어 프로그램을 작성·실행할 수 있다.'
      );
      setMaterialType('markdown');
      setBlocks(markdownToBlocks(SAMPLE_PHYSICAL_COMPUTING_MARKDOWN));
      setMaterialFileName('5차시_정보_피지컬컴퓨팅_3종보드_실습교안.md');
      setUploadSuccessBadge(
        '정보 교과 피지컬 컴퓨팅(마이크로비트·아두이노 Uno·라즈베리파이 피코) 실습 교안 로드됨'
      );
    } else if (type === 'data_analysis') {
      setPageIcon('📊');
      setSubjectCategory('정보');
      setUnitCategory('2단원. 데이터와 정보 (데이터 수집·전처리·분석)');
      setSessionNumber('6');
      setTitle('6차시: 실생활 데이터의 결측치·이상치 정제와 탐색적 데이터 분석(EDA) 실습');
      setLearningObjective(
        '데이터에 포함된 결측치(NaN)와 이상치(IQR)가 통계량 및 상관관계에 미치는 영향을 비교하고, 산점도·히트맵 시각화를 통해 데이터 기반의 결론을 도출할 수 있다.'
      );
      setMaterialType('markdown');
      setBlocks(markdownToBlocks(SAMPLE_DATA_ANALYSIS_MARKDOWN));
      setMaterialFileName('6차시_정보_데이터분석_전처리_EDA_실습교안.md');
      setUploadSuccessBadge(
        '정보 교과 데이터 분석 스튜디오(결측치·이상치 전처리 & 상관계수 시각화) 실습 교안 로드됨'
      );
    } else if (type === 'ai_lab') {
      setPageIcon('🧠');
      setSubjectCategory('정보');
      setUnitCategory('5단원. 인공지능과 머신러닝');
      setSessionNumber('7');
      setTitle('7차시: 지도학습(선형 회귀·K-NN·결정트리)과 비지도학습(K-Means) 알고리즘 실험');
      setLearningObjective(
        '지도학습과 비지도학습의 차이를 이해하고, 선형 회귀(경사하강법), K-최근접 이웃(K-NN), K-평균 군집화 시뮬레이터에서 하이퍼파라미터 변화에 따른 결정 경계와 오차 변화를 설명할 수 있다.'
      );
      setMaterialType('markdown');
      setBlocks(markdownToBlocks(SAMPLE_AI_LAB_MARKDOWN));
      setMaterialFileName('7차시_정보_인공지능_머신러닝_실험실_교안.md');
      setUploadSuccessBadge(
        '정보 교과 AI·머신러닝 실험실(선형 회귀·K-NN·결정트리·K-Means) 실습 교안 로드됨'
      );
    } else {
      setPageIcon('⚡');
      setSubjectCategory('수학');
      setUnitCategory('2단원. 이차함수와 그래프');
      setSessionNumber('3');
      setTitle('3차시: 이차함수 y=ax²+bx+c의 그래프와 계수의 역할 (시뮬레이터)');
      setLearningObjective(
        '계수 a, b, c의 변화에 따른 포물선의 모양, 꼭짓점, 대칭축의 변화를 시뮬레이터로 관찰하고 설명할 수 있다.'
      );
      setMaterialType('html');
      setMaterialHtml(QUADRATIC_FUNCTION_HTML);
      setMaterialFileName(null);
      setUploadSuccessBadge('인터랙티브 HTML 시뮬레이터 로드됨');
    }
  }

  async function handleDocumentImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setUploadSuccessBadge(null);
    setFileParsing(true);

    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await parseMaterialFileAction(fd);

      if (!res.success || !('markdown' in res)) {
        setErrorMessage(res.error || '파일에서 텍스트를 추출하지 못했습니다.');
      } else {
        setMaterialType('markdown');
        setBlocks(markdownToBlocks(res.markdown || ''));
        setMaterialFileName(res.fileName || file.name);
        setUploadSuccessBadge(
          `${res.fileName} (${res.formatLabel}) → 노션 블록으로 변환 완료`
        );
        if (!title.trim()) {
          const cleanTitle = file.name.replace(/\.(docx|hwpx|hwp|md|txt)$/i, '');
          setTitle(cleanTitle);
        }
      }
    } catch {
      setErrorMessage('문서 파일 변환 중 오류가 발생했습니다.');
    } finally {
      setFileParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handlePublish() {
    if (!title.trim()) {
      setErrorMessage('페이지 상단에 수업 교안 제목을 입력해 주세요.');
      return;
    }
    if (!learningObjective.trim()) {
      setErrorMessage('수업 속성란의 학습 목표를 입력해 주세요.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const serializedMarkdown = blocksToMarkdown(blocks);

    const formData = new FormData();
    formData.set('title', title.trim());
    formData.set('learning_objective', learningObjective.trim());
    formData.set('subject_category', subjectCategory.trim() || '공통 과목');
    formData.set('unit_category', unitCategory.trim() || '1단원');
    formData.set('session_number', sessionNumber.trim());
    formData.set('page_icon', pageIcon);
    formData.set('deadline', deadline);
    formData.set('material_type', materialType);
    formData.set('material_markdown', serializedMarkdown);
    formData.set('material_html', materialHtml);
    formData.set('material_file_name', materialFileName || '');

    try {
      if (isLibraryMode) {
        if (isEditMode && initialLesson) {
          formData.set('material_id', initialLesson.id);
        }
        if (defaultDeployClassId) {
          formData.set('return_class_id', defaultDeployClassId);
        }
        formData.set('deploy_class_ids', JSON.stringify(selectedDeployClassIds));
        const result = await saveMasterMaterialAction(formData);
        if (result?.error) {
          setErrorMessage(result.error);
          setLoading(false);
        }
      } else {
        formData.set('class_id', classId);
        if (isEditMode && initialLesson) {
          formData.set('lesson_id', initialLesson.id);
        }
        const result = isEditMode
          ? await updateLessonAction(formData)
          : await createLesson(formData);
        if (result?.error) {
          setErrorMessage(result.error);
          setLoading(false);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
        return;
      }
      setErrorMessage(
        isEditMode
          ? '교안 수정 중 오류가 발생했습니다.'
          : '교안 저장 중 오류가 발생했습니다.'
      );
      setLoading(false);
    }
  }

  async function handleDeleteLesson() {
    if (!isEditMode || !initialLesson) return;

    if (isLibraryMode) {
      const confirmed = window.confirm(
        `교안 보관함에서 "${initialLesson.title}" 원본 교안을 삭제하시겠습니까?\n(이미 각 분반에 배포된 수업과 학생 질문 데이터는 삭제되지 않고 안전하게 유지됩니다.)`
      );
      if (!confirmed) return;

      setDeleting(true);
      setErrorMessage(null);
      try {
        const res = await deleteMasterMaterialAction(initialLesson.id, false);
        if (!res.success) {
          setErrorMessage(res.error || '교안 삭제에 실패했습니다.');
          setDeleting(false);
          return;
        }
        router.push('/materials');
        router.refresh();
      } catch {
        setErrorMessage('교안 삭제 중 오류가 발생했습니다.');
        setDeleting(false);
      }
      return;
    }

    const confirmed = window.confirm(
      `현재 학급(${className})에서 "${initialLesson.title}" 수업을 제거하시겠습니까?\n(교안 보관함의 원본 교안과 다른 분반의 수업은 그대로 유지됩니다.)`
    );
    if (!confirmed) return;

    setDeleting(true);
    setErrorMessage(null);
    try {
      const res = await deleteLessonAction(initialLesson.id, classId);
      if (!res.success) {
        setErrorMessage(res.error || '레슨 삭제에 실패했습니다.');
        setDeleting(false);
        return;
      }
      router.push(`/classes/${classId}`);
      router.refresh();
    } catch {
      setErrorMessage('레슨 삭제 중 오류가 발생했습니다.');
      setDeleting(false);
    }
  }

  const backHref = isLibraryMode
    ? defaultDeployClassId
      ? `/classes/${defaultDeployClassId}`
      : '/materials'
    : isEditMode && initialLesson
    ? `/classes/${classId}/lessons/${initialLesson.id}`
    : `/classes/${classId}`;

  const backLabel = isLibraryMode
    ? defaultDeployClassId
      ? '학급 화면으로 돌아가기'
      : '📚 교안 보관함으로'
    : isEditMode
    ? '레슨 화면으로'
    : className;

  return (
    <div className="min-h-screen bg-[#fbfbfa] pb-28">
      {/* 1. 노션 스타일 상단 고정 네비게이션 & 액션 바 */}
      <div className="sticky top-16 z-40 border-b border-gray-200/80 bg-white/95 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          {/* 좌측 브레드크럼 */}
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
            >
              <span>←</span>
              <span>{backLabel}</span>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
              {subjectCategory || '미분류 과목'}
            </span>
            <span className="text-gray-300">/</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-gray-800 truncate max-w-[200px] sm:max-w-md">
              <span>{pageIcon}</span>
              <span className="truncate">{title.trim() || '제목 없는 수업 교안'}</span>
              {isEditMode && (
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">
                  수정 모드
                </span>
              )}
            </span>
          </div>

          {/* 우측 컨트롤 버튼 */}
          <div className="flex flex-wrap items-center gap-2">
            {materialType === 'markdown' && (
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  previewMode
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{previewMode ? '✏️ 편집 모드로 돌아가기' : '👁️ 학생 화면 미리보기'}</span>
              </button>
            )}

            {isEditMode && (
              <button
                type="button"
                disabled={deleting || loading}
                onClick={handleDeleteLesson}
                className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
              >
                <span>🗑️</span>
                <span>{deleting ? '삭제 중...' : isLibraryMode ? '원본 교안 삭제' : '이 분반에서 제거'}</span>
              </button>
            )}

            <Link
              href={backHref}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100"
            >
              취소
            </Link>

            <button
              type="button"
              disabled={loading || deleting || fileParsing}
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              <span>💾</span>
              <span>
                {loading
                  ? '저장 중...'
                  : isLibraryMode
                  ? isEditMode
                    ? '원본 교안 저장 & 전체 분반 동기화'
                    : selectedDeployClassIds.length > 0
                    ? `교안 보관함 저장 & ${selectedDeployClassIds.length}개 분반 배포`
                    : '교안 보관함에 저장'
                  : isEditMode
                  ? '교안 수정 저장 (연동 분반 동기화)'
                  : '교안 저장 & 수업 레슨 개설'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 노션 커버 배너 */}
      <div className="relative h-36 sm:h-44 w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-500 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />
        <div className="mx-auto max-w-6xl px-6 h-full flex items-end pb-4 justify-between text-white/90 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 backdrop-blur-xs px-3 py-1 font-semibold">
            ✨ 노션형 교안 제작 스튜디오 — 한 번 만든 교안을 과목·단원별로 체계적으로 분류하고 A·B·C·D 모든 분반에 불러와 함께 진화시키세요
          </span>
        </div>
      </div>

      {/* 3. 노션 문서 본문 컨테이너 */}
      <div className="mx-auto max-w-6xl px-3 sm:px-6 -mt-10 relative z-10">
        <div className="rounded-3xl border border-gray-200/90 bg-white p-6 sm:p-10 lg:p-14 shadow-sm space-y-8">
          {/* 원본 연동 안내 배너 (분반 수업 수정 또는 이미 배포된 원본 교안 수정 시) */}
          {(initialParsed?.sourceMaterialId || alreadyLinkedClassIds.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs text-indigo-900">
              <div className="flex items-center gap-2 font-bold">
                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                  🔗 원본-분반 실시간 연동 중
                </span>
                <span>
                  이 교안을 수정하고 저장하면 연결된 모든 분반(A·B·C·D반)의 수업 교안 본문이 최신 상태로 자동 동기화됩니다. (각 분반의 학생 질문과 형성평가 응시 내역은 반별로 독립 유지됩니다)
                </span>
              </div>
            </div>
          )}

          {/* 페이지 아이콘 + 원클릭 샘플 템플릿 바 */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <button
              type="button"
              onClick={cyclePageIcon}
              title="클릭하여 페이지 아이콘 변경"
              className="group relative flex h-20 w-20 items-center justify-center rounded-2xl border border-gray-200 bg-white text-5xl shadow-md hover:scale-105 transition select-none"
            >
              <span>{pageIcon}</span>
              <span className="absolute -bottom-2 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition">
                아이콘 변경
              </span>
            </button>

            {/* 원클릭 샘플 템플릿 & 파일 불러오기 빠른 도구 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 mr-1">
                빠른 시작 템플릿:
              </span>
              <button
                type="button"
                onClick={() => applySampleTemplate('general')}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
              >
                <span>🏛️ 인문·사회 노션 교안 예시</span>
              </button>
              <button
                type="button"
                onClick={() => applySampleTemplate('math')}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
              >
                <span>📐 수학 개념 노션 교안 예시</span>
              </button>
              <button
                type="button"
                onClick={() => applySampleTemplate('physical')}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50/90 px-3 py-1.5 text-xs font-extrabold text-emerald-900 hover:bg-emerald-100 transition cursor-pointer shadow-2xs"
              >
                <span>🤖 정보: 피지컬 컴퓨팅 실습</span>
              </button>
              <button
                type="button"
                onClick={() => applySampleTemplate('data_analysis')}
                className="inline-flex items-center gap-1 rounded-xl border border-cyan-300 bg-cyan-50/90 px-3 py-1.5 text-xs font-extrabold text-cyan-900 hover:bg-cyan-100 transition cursor-pointer shadow-2xs"
              >
                <span>📊 정보: 데이터 분석 실습</span>
              </button>
              <button
                type="button"
                onClick={() => applySampleTemplate('ai_lab')}
                className="inline-flex items-center gap-1 rounded-xl border border-violet-300 bg-violet-50/90 px-3 py-1.5 text-xs font-extrabold text-violet-900 hover:bg-violet-100 transition cursor-pointer shadow-2xs"
              >
                <span>🧠 정보: 인공지능·머신러닝 실습</span>
              </button>
              <button
                type="button"
                onClick={() => applySampleTemplate('physics')}
                className="inline-flex items-center gap-1 rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition"
              >
                <span>🧪 물리 노션 교안 (JS 운동 시뮬레이션 포함)</span>
              </button>
              <button
                type="button"
                onClick={() => applySampleTemplate('html')}
                className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
              >
                <span>⚡ HTML 시뮬레이터 예시</span>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs sm:text-sm font-semibold text-red-600">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* 노션 스타일 대형 페이지 제목 입력 */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="수업 교안 제목을 입력하세요 (예: 1차시: 파이썬 변수와 키보드 입출력 제어)..."
              className="w-full border-0 bg-transparent text-2xl sm:text-4xl font-extrabold text-gray-900 placeholder:text-gray-300 focus:outline-none tracking-tight"
            />
          </div>

          {/* 노션 페이지 속성(Properties) 영역: 과목(대분류), 단원(소분류), 차시, 학습목표, 분반 일괄 배포 */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 sm:p-5 space-y-4 text-sm">
            {/* 속성 0: 과목(폴더) → 단원(소분류) → 차시 순서 분류 체계 */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-start pb-3 border-b border-gray-200/60">
              <div className="sm:col-span-3 flex items-center gap-2 text-xs font-bold text-gray-500 pt-1.5">
                <span>🗂️</span>
                <span>교안 분류 (과목 · 단원 · 차시)</span>
              </div>
              <div className="sm:col-span-9 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  {/* 과목 입력 */}
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      📁 과목명 (대분류 폴더)
                    </label>
                    <input
                      type="text"
                      list="subject-category-suggestions"
                      value={subjectCategory}
                      onChange={(e) => setSubjectCategory(e.target.value)}
                      placeholder="예: 정보, 물리학 I, 수학"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                    <datalist id="subject-category-suggestions">
                      {mergedSubjectSuggestions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

                  {/* 단원 입력 */}
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      📑 단원명 (소분류)
                    </label>
                    <input
                      type="text"
                      list="unit-category-suggestions"
                      value={unitCategory}
                      onChange={(e) => setUnitCategory(e.target.value)}
                      placeholder="예: 1단원. 파이썬 기초와 입출력"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                    <datalist id="unit-category-suggestions">
                      {mergedUnitSuggestions.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </div>

                  {/* 차시 번호 입력 */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      🔢 차시 순서
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={sessionNumber}
                        onChange={(e) => setSessionNumber(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-extrabold text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-gray-500 shrink-0">차시</span>
                    </div>
                  </div>
                </div>

                {/* 빠른 과목 선택 칩 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-gray-400">빠른 과목 선택:</span>
                  {mergedSubjectSuggestions.slice(0, 7).map((subj) => (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setSubjectCategory(subj)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                        subjectCategory === subj
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {subj}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 속성 1: 학습 목표 */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-start">
              <div className="sm:col-span-3 flex items-center gap-2 text-xs font-bold text-gray-500 pt-1.5">
                <span>🎯</span>
                <span>학습 목표 (필수)</span>
              </div>
              <div className="sm:col-span-9">
                <textarea
                  rows={2}
                  value={learningObjective}
                  onChange={(e) => setLearningObjective(e.target.value)}
                  placeholder="이 수업을 통해 학생들이 도달해야 할 핵심 학습 목표를 입력하세요 (AI 질문·교안 취약점 분석의 기준이 됩니다)"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 속성 2: 교안 보관함 모드일 때 -> 저장과 동시에 배포할 분반(A, B, C, D반) 선택 */}
            {isLibraryMode && teacherClasses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-start pt-2 border-t border-gray-200/60">
                <div className="sm:col-span-3 flex items-center gap-2 text-xs font-bold text-gray-500 pt-1">
                  <span>🏫</span>
                  <span>분반(클래스) 동시 배포</span>
                </div>
                <div className="sm:col-span-9 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-gray-600">
                      교안을 보관함에 저장하면서 바로 적용할 학급(분반)을 선택하세요 (나중에 보관함이나 각 클래스에서도 언제든 불러올 수 있습니다).
                    </span>
                    <button
                      type="button"
                      onClick={selectAllUnlinkedClasses}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                    >
                      + 전체 분반 선택
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {teacherClasses.map((cls) => {
                      const isAlreadyLinked = alreadyLinkedClassIds.includes(cls.id);
                      const isSelected = selectedDeployClassIds.includes(cls.id);

                      if (isAlreadyLinked) {
                        return (
                          <span
                            key={cls.id}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
                          >
                            <span>✅ {cls.name}</span>
                            <span className="text-[10px] font-semibold text-emerald-600">
                              (연동됨 · 자동 동기화)
                            </span>
                          </span>
                        );
                      }

                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => toggleDeployClass(cls.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/40'
                          }`}
                        >
                          <span>{isSelected ? '☑️' : '⬜'}</span>
                          <span>{cls.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 속성 2-B: 질문 마감 일시 (학급 내 수정이거나, 분반 동시 배포를 선택했을 때) */}
            {(!isLibraryMode || selectedDeployClassIds.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center pt-1">
                <div className="sm:col-span-3 flex items-center gap-2 text-xs font-bold text-gray-500">
                  <span>⏰</span>
                  <span>질문 제출 마감</span>
                </div>
                <div className="sm:col-span-9 flex flex-wrap items-center gap-3">
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs sm:text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-gray-400">
                    비워두면 마감 기한 없이 상시 질문을 받습니다.
                  </span>
                </div>
              </div>
            )}

            {/* 속성 3: 기존 워드/한글 파일 불러오기 & 교안 모드 */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center pt-2 border-t border-gray-200/60">
              <div className="sm:col-span-3 flex items-center gap-2 text-xs font-bold text-gray-500">
                <span>📂</span>
                <span>문서 파일 변환</span>
              </div>
              <div className="sm:col-span-9 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.hwp,.hwpx,.md,.markdown,.txt"
                    onChange={handleDocumentImport}
                    className="hidden"
                    id="notion-studio-doc-import"
                  />
                  <label
                    htmlFor="notion-studio-doc-import"
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-50 transition"
                  >
                    <span>
                      📄{' '}
                      {fileParsing
                        ? '문서 변환 중...'
                        : '워드(.docx) · 한글(.hwp/.hwpx) 파일을 노션 블록으로 불러오기'}
                    </span>
                  </label>

                  {uploadSuccessBadge && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      <span>✅ {uploadSuccessBadge}</span>
                    </span>
                  )}
                </div>

                {/* 노션 블록 문서 vs HTML 시뮬레이터 전환 */}
                <div className="inline-flex rounded-xl bg-gray-200/75 p-0.5">
                  <button
                    type="button"
                    onClick={() => setMaterialType('markdown')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      materialType === 'markdown'
                        ? 'bg-white text-gray-900 shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📝 노션 블록 교안
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialType('html')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      materialType === 'html'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ⚡ HTML 시뮬레이터
                  </button>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 4. 노션 블록 에디터 본문 영역 */}
          {materialType === 'markdown' ? (
            previewMode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-indigo-50/80 border border-indigo-200 px-4 py-2.5 text-xs text-indigo-900">
                  <span className="font-bold">
                    👁️ 학생들에게 보여질 실제 수업 교안 페이지 미리보기입니다.
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(false)}
                    className="font-extrabold text-indigo-700 underline"
                  >
                    편집 계속하기 →
                  </button>
                </div>
                <div className="rounded-2xl border border-gray-200 p-6 sm:p-8 bg-white">
                  {blocksToMarkdown(blocks).trim() ? (
                    <SimpleMarkdownRenderer content={blocksToMarkdown(blocks)} />
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-12">
                      아직 작성된 교안 블록이 없습니다.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <NotionBlockEditor
                blocks={blocks}
                onChange={(newBlocks) => setBlocks(newBlocks)}
              />
            )
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-4 text-xs text-indigo-950">
                <p className="font-bold">⚡ 인터랙티브 HTML/JS 시뮬레이터 모드</p>
                <p className="text-indigo-700 mt-0.5">
                  단일 HTML/CSS/JS 코드를 붙여넣으면 학생 화면에 안전한 샌드박스 위젯으로 실행됩니다.
                </p>
              </div>
              <textarea
                rows={14}
                value={materialHtml}
                onChange={(e) => setMaterialHtml(e.target.value)}
                placeholder="<!DOCTYPE html><html>...</html>"
                className="w-full rounded-2xl border border-gray-200 bg-slate-950 p-4 font-mono text-xs text-emerald-300 leading-relaxed focus:border-indigo-500 focus:outline-none"
              />
              {materialHtml.trim() && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-600">실시간 시뮬레이터 미리보기</p>
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <iframe
                      srcDoc={materialHtml}
                      sandbox="allow-scripts"
                      className="h-[480px] w-full border-0"
                      title="Interactive Simulator Preview"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. 교안 하단 저장/발행 액션 바 */}
          <div className="pt-6 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-gray-500">
              💡 작성을 마쳤다면 우측의 <strong className="text-gray-800">저장 버튼</strong>을 눌러 교안 보관함 및 연동된 분반에 반영하세요.
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={backHref}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                취소
              </Link>
              <button
                type="button"
                disabled={loading || deleting || fileParsing}
                onClick={handlePublish}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-extrabold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
              >
                <span>💾</span>
                <span>
                  {loading
                    ? '저장 중...'
                    : isLibraryMode
                    ? isEditMode
                      ? '원본 교안 수정 저장 (전체 분반 동기화)'
                      : selectedDeployClassIds.length > 0
                      ? `교안 보관함 저장 & ${selectedDeployClassIds.length}개 분반 배포`
                      : '교안 보관함에 저장하기'
                    : isEditMode
                    ? '교안·레슨 수정사항 저장하기'
                    : '교안 저장 & 수업 레슨 개설하기'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. 화면 우측 하단 플로팅 저장 버튼 */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl border border-blue-200 bg-white/95 p-2 shadow-xl backdrop-blur-md">
        <button
          type="button"
          disabled={loading || deleting || fileParsing}
          onClick={handlePublish}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
        >
          <span>💾</span>
          <span>
            {loading
              ? '저장 중...'
              : isLibraryMode
              ? isEditMode
                ? '교안 저장 & 분반 동기화'
                : '교안 보관함에 저장'
              : isEditMode
              ? '교안 수정 저장'
              : '교안 저장 & 발행'}
          </span>
        </button>
      </div>
    </div>
  );
}
