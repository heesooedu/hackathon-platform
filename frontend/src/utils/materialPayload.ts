import {
  Lesson,
  MaterialType,
  AppliedPatchItem,
  AiLessonAnalysisResult,
} from '@/types/database.types';

/**
 * 교사별 독립 '교안 보관함(Master Material Library)'을 기존 classes/lessons RLS 스키마 위에서
 * 별도 마이그레이션 없이 완벽 호환되도록 저장하기 위한 시스템 컨테이너 클래스 식별자입니다.
 */
export const MATERIAL_LIBRARY_CLASS_NAME = '__QCLASS_MATERIAL_LIBRARY__';

export function isMaterialLibraryClass(classNameOrItem: string | { name?: string; join_code?: string }): boolean {
  if (typeof classNameOrItem === 'string') {
    return classNameOrItem === MATERIAL_LIBRARY_CLASS_NAME;
  }
  return (
    classNameOrItem.name === MATERIAL_LIBRARY_CLASS_NAME ||
    Boolean(classNameOrItem.join_code && classNameOrItem.join_code.startsWith('#'))
  );
}

export interface ParsedLessonMaterial {
  materialType: MaterialType;
  markdownContent: string;
  htmlContent: string;
  fileName: string | null;
  appliedPatches: AppliedPatchItem[];
  aiAnalysis: AiLessonAnalysisResult | null;
  displayOrder?: number | null;
  /** 교안 분류 메타데이터: 과목(대분류 폴더) */
  subjectCategory?: string | null;
  /** 교안 분류 메타데이터: 단원(소분류) */
  unitCategory?: string | null;
  /** 차시 번호 (예: 1, 2, 3...) */
  sessionNumber?: number | null;
  /** 노션 페이지 아이콘 (예: '💻', '🧪') */
  pageIcon?: string | null;
  /** 교안 보관함의 원본(Master) 교안 ID (분반 간 실시간 연동용) */
  sourceMaterialId?: string | null;
}

const META_PREFIX = '<!--__PEDAGOGY_V2_META__:';
const META_SUFFIX = ':__END_PEDAGOGY_V2_META__-->';

interface EmbeddedMetaEnvelope {
  version: 2;
  materialType: MaterialType;
  markdownContent: string;
  htmlContent: string;
  fileName: string | null;
  appliedPatches: AppliedPatchItem[];
  aiAnalysis: AiLessonAnalysisResult | null;
  displayOrder?: number | null;
  subjectCategory?: string | null;
  unitCategory?: string | null;
  sessionNumber?: number | null;
  pageIcon?: string | null;
  sourceMaterialId?: string | null;
}

/**
 * lessons 레코드에서 교안 데이터(마크다운, HTML, 업로드 파일명, 적용된 패치 목록, AI 진단 결과, 과목/단원/연동ID)를 추출합니다.
 */
export function parseLessonMaterial(lesson: Lesson): ParsedLessonMaterial {
  const rawField = lesson.material_html || '';

  // 1. 메타 엔벨로프가 포함되어 있는 경우 우선 파싱
  const startIdx = rawField.indexOf(META_PREFIX);
  const endIdx = rawField.indexOf(META_SUFFIX);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const jsonBase64 = rawField.slice(startIdx + META_PREFIX.length, endIdx);
    try {
      const jsonStr =
        typeof Buffer !== 'undefined'
          ? Buffer.from(jsonBase64, 'base64').toString('utf-8')
          : decodeURIComponent(escape(atob(jsonBase64)));
      const parsed = JSON.parse(jsonStr) as EmbeddedMetaEnvelope;
      return {
        materialType: parsed.materialType || 'markdown',
        markdownContent: parsed.markdownContent || lesson.material_markdown || '',
        htmlContent: parsed.htmlContent || '',
        fileName: parsed.fileName || lesson.material_file_name || null,
        appliedPatches: Array.isArray(parsed.appliedPatches) ? parsed.appliedPatches : [],
        aiAnalysis: parsed.aiAnalysis || lesson.ai_review_json || null,
        displayOrder:
          typeof parsed.displayOrder === 'number' ? parsed.displayOrder : null,
        subjectCategory: parsed.subjectCategory || null,
        unitCategory: parsed.unitCategory || null,
        sessionNumber:
          typeof parsed.sessionNumber === 'number' ? parsed.sessionNumber : null,
        pageIcon: parsed.pageIcon || null,
        sourceMaterialId: parsed.sourceMaterialId || null,
      };
    } catch (e) {
      console.error('Failed to parse embedded lesson material meta:', e);
    }
  }

  // 2. 신규 DB 컬럼이 채워져 있는 경우
  if (lesson.material_markdown) {
    let patches: AppliedPatchItem[] = [];
    if (lesson.ai_supplement_markdown) {
      try {
        const parsedPatches = JSON.parse(lesson.ai_supplement_markdown);
        if (Array.isArray(parsedPatches)) {
          patches = parsedPatches;
        }
      } catch {
        patches = [
          {
            id: 'legacy-patch',
            title: '교안 보충 설명',
            content_markdown: lesson.ai_supplement_markdown,
            applied_at: lesson.created_at,
          },
        ];
      }
    }

    return {
      materialType: lesson.material_type || 'markdown',
      markdownContent: lesson.material_markdown,
      htmlContent: rawField,
      fileName: lesson.material_file_name || null,
      appliedPatches: patches,
      aiAnalysis: lesson.ai_review_json || null,
      subjectCategory: null,
      unitCategory: null,
      sessionNumber: null,
      pageIcon: null,
      sourceMaterialId: null,
    };
  }

  // 3. 기존 레거시 데이터: HTML 태그로 시작하면 html, 아니면 markdown으로 취급
  const trimmed = rawField.trim();
  if (!trimmed) {
    return {
      materialType: 'markdown',
      markdownContent: '',
      htmlContent: '',
      fileName: null,
      appliedPatches: [],
      aiAnalysis: null,
      subjectCategory: null,
      unitCategory: null,
      sessionNumber: null,
      pageIcon: null,
      sourceMaterialId: null,
    };
  }

  const looksLikeHtml =
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<style') ||
    trimmed.startsWith('<div');

  return {
    materialType: looksLikeHtml ? 'html' : 'markdown',
    markdownContent: looksLikeHtml ? '' : trimmed,
    htmlContent: looksLikeHtml ? trimmed : '',
    fileName: null,
    appliedPatches: [],
    aiAnalysis: null,
    subjectCategory: null,
    unitCategory: null,
    sessionNumber: null,
    pageIcon: null,
    sourceMaterialId: null,
  };
}

/**
 * 교안 데이터를 저장 가능한 문자열(material_html 호환 포맷)로 직렬화합니다.
 */
export function serializeLessonMaterial(payload: ParsedLessonMaterial): string {
  const hasContent =
    payload.markdownContent.trim().length > 0 ||
    payload.htmlContent.trim().length > 0 ||
    payload.appliedPatches.length > 0 ||
    payload.aiAnalysis !== null ||
    typeof payload.displayOrder === 'number' ||
    Boolean(payload.subjectCategory) ||
    Boolean(payload.unitCategory) ||
    typeof payload.sessionNumber === 'number' ||
    Boolean(payload.pageIcon) ||
    Boolean(payload.sourceMaterialId);

  if (!hasContent) {
    return '';
  }

  const envelope: EmbeddedMetaEnvelope = {
    version: 2,
    materialType: payload.materialType,
    markdownContent: payload.markdownContent,
    htmlContent: payload.htmlContent,
    fileName: payload.fileName,
    appliedPatches: payload.appliedPatches,
    aiAnalysis: payload.aiAnalysis,
    displayOrder:
      typeof payload.displayOrder === 'number' ? payload.displayOrder : null,
    subjectCategory: payload.subjectCategory || null,
    unitCategory: payload.unitCategory || null,
    sessionNumber:
      typeof payload.sessionNumber === 'number' ? payload.sessionNumber : null,
    pageIcon: payload.pageIcon || null,
    sourceMaterialId: payload.sourceMaterialId || null,
  };

  const jsonStr = JSON.stringify(envelope);
  const base64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(jsonStr, 'utf-8').toString('base64')
      : btoa(unescape(encodeURIComponent(jsonStr)));

  const metaComment = `${META_PREFIX}${base64}${META_SUFFIX}`;

  if (payload.materialType === 'html' && payload.htmlContent.trim()) {
    return `${payload.htmlContent}\n${metaComment}`;
  }

  return metaComment;
}

/**
 * 레슨에 실제 교안 본문이나 패치가 포함되어 있는지 여부를 반환합니다.
 */
export function hasActualLessonMaterial(lesson: Lesson): boolean {
  const parsed = parseLessonMaterial(lesson);
  return (
    parsed.markdownContent.trim().length > 0 ||
    parsed.htmlContent.trim().length > 0 ||
    parsed.appliedPatches.length > 0
  );
}

/**
 * 교사가 지정한 displayOrder(또는 sessionNumber) 순서를 우선으로 하고, 지정되지 않은 레슨은 최신 생성순으로 정렬합니다.
 */
export function sortLessonsByOrder(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => {
    const metaA = parseLessonMaterial(a);
    const metaB = parseLessonMaterial(b);
    const orderA = metaA.displayOrder ?? metaA.sessionNumber;
    const orderB = metaB.displayOrder ?? metaB.sessionNumber;

    const hasOrderA = typeof orderA === 'number';
    const hasOrderB = typeof orderB === 'number';

    if (hasOrderA && hasOrderB && orderA !== orderB) {
      return orderA - orderB;
    }
    if (hasOrderA && !hasOrderB) return -1;
    if (!hasOrderA && hasOrderB) return 1;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * AI 분석을 위해 교안의 텍스트/코드 원문과 현재 적용된 패치 내역을 하나의 텍스트로 결합합니다.
 */
export function getReadableMaterialTextForAi(parsed: ParsedLessonMaterial): string {
  const parts: string[] = [];

  if (parsed.subjectCategory || parsed.unitCategory) {
    parts.push(
      `[교안 분류: ${parsed.subjectCategory || '일반'} > ${parsed.unitCategory || '전체 단원'}]`
    );
  }

  if (parsed.fileName) {
    parts.push(`[업로드된 교안 파일명: ${parsed.fileName}]`);
  }

  if (parsed.markdownContent.trim()) {
    const cleanMdForAi = parsed.markdownContent
      .trim()
      .replace(
        /!\[([^\]]*)\]\(data:image\/[^)]+\)/g,
        (_, caption) => `[교안 내 삽입된 이미지 자료: ${caption || '참고 사진'}]`
      );
    parts.push(`[교안 본문 (노션 페이지/문서 내용)]\n${cleanMdForAi}`);
  }

  if (parsed.htmlContent.trim()) {
    const htmlSnippet =
      parsed.htmlContent.length > 6000
        ? parsed.htmlContent.slice(0, 6000) + '\n...(중략)...'
        : parsed.htmlContent;
    parts.push(`[인터랙티브 웹 교안 (HTML/JS 코드)]\n${htmlSnippet}`);
  }

  if (parsed.appliedPatches.length > 0) {
    parts.push(
      `[이미 반영된 교안 보충 패치 (${parsed.appliedPatches.length}건)]\n` +
        parsed.appliedPatches
          .map((p, i) => `${i + 1}. ${p.title}: ${p.content_markdown}`)
          .join('\n')
    );
  }

  if (parts.length === 0) {
    return '(등록된 상세 교안 원문이 없습니다. 수업 제목과 학습 목표를 기준으로 분석하세요.)';
  }

  return parts.join('\n\n---\n\n');
}
