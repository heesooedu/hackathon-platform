import { GoogleGenAI } from '@google/genai';
import {
  Submission,
  QuestionGroup,
  AiLessonAnalysisResult,
  MaterialGapItem,
  GeneratedQuizDraft,
} from '@/types/database.types';

export interface AiSuggestedGroup {
  representative_title: string;
  representative_content: string;
  submission_ids: string[];
}

export async function clusterQuestionsWithGemini(
  submissions: Submission[],
  learningObjective: string
): Promise<AiSuggestedGroup[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set in environment variables.');
    return [];
  }

  const targetSubmissions = submissions.filter(
    (s) => s.type === 'question' || s.type === 'confusion' || s.type === 'explore'
  );

  if (targetSubmissions.length === 0) {
    return [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const submissionData = targetSubmissions.map((s, idx) => ({
      index: idx,
      id: s.id,
      type: s.type,
      content: s.content,
    }));

    const prompt = `
당신은 수업 설계와 학생 질문 분석을 돕는 유능한 교육 AI 어시스턴트입니다.
이번 차시의 학습 목표는 다음과 같습니다:
"${learningObjective}"

학생들이 수업 후 제출한 질문과 생각 목록입니다:
${JSON.stringify(submissionData, null, 2)}

위 학생 질문들을 분석하여, 개념적으로 유사하거나 함께 다루면 좋은 질문들을 그룹으로 묶어주세요.
각 그룹마다 학생들이 이해하기 쉬운 명확한 "대표 질문 제목"과 교사가 설명해줄 수 있는 "대표 요약 내용"을 작성해 주세요.

반드시 아래 JSON 포맷의 배열 형태로만 응답해 주세요. 다른 설명이나 마크다운 백틱 없이 순수 JSON만 반환하세요:
[
  {
    "representative_title": "대표 질문 제목 (예: Q. 계수 a의 부호에 따라 포물선의 볼록 방향이 왜 바뀌나요?)",
    "representative_content": "대표 요약 설명 (어떤 질문들이 모였고 핵심 쟁점이 무엇인지 요약)",
    "submission_ids": ["묶인 질문들의 실제 id 문자열 배열"]
  }
]
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '[]';
    const parsed = JSON.parse(text) as AiSuggestedGroup[];
    return parsed;
  } catch (error) {
    console.error('Error clustering questions with Gemini:', error);
    return [];
  }
}

/**
 * 교안 원문(마크다운/워드/한글 추출본 또는 HTML)과 학생 질문을 대조하여:
 * 1) 교안의 부족했던 점(Gap Analysis) 및 원클릭 보충 패치 마크다운
 * 2) 학생들의 실제 오개념을 겨냥한 맞춤형 형성평가(4지선다 3문항)
 * 를 구조화된 JSON으로 생성합니다.
 */
export async function analyzeMaterialAndGenerateQuizWithGemini(
  submissions: Submission[],
  groups: QuestionGroup[],
  learningObjective: string,
  lessonTitle: string,
  materialText: string
): Promise<{ success: boolean; analysis?: AiLessonAnalysisResult; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error:
        'GEMINI_API_KEY가 설정되지 않아 AI 교안 진단 및 형성평가 생성을 실행할 수 없습니다. .env.local을 확인해 주세요.',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const normalGroups = groups.filter(
      (g) => !g.representative_title.startsWith('[__QUIZ__]')
    );
    const unresolvedGroups = normalGroups.filter((g) => !g.is_resolved);
    const questionSubmissions = submissions.filter(
      (s) => s.type === 'question' || s.type === 'confusion' || s.type === 'explore'
    );

    const prompt = `
당신은 교사의 수업 교안(강의노트/문서)과 학생들의 실제 질문을 대조하여 교안의 빈틈(Pedagogical Gap)을 찾아내고, 교안에 바로 끼워 넣을 수 있는 '보충 패치(Patch)'와 학생들의 오개념을 정확히 저격하는 '맞춤형 형성평가(Exit Ticket)'를 설계하는 수석 교육과정 AI 컨설턴트입니다.

과하게 긍정적이거나 추상적인 칭찬은 배제하고, **실제 교안 원문에 어떤 설명이나 예시가 부족했기 때문에 학생들이 이런 질문을 했는지** 객관적이고 날카롭게 진단하세요.

[1. 수업 기본 정보]
- 수업 차시명: ${lessonTitle}
- 학습 목표: ${learningObjective}

[2. 교사가 업로드한 현재 교안 원문]
${materialText}

[3. 학생들이 제출한 실제 질문/혼란/탐구 내역 (총 ${questionSubmissions.length}건)]
${JSON.stringify(
  questionSubmissions.map((s) => ({
    type: s.type,
    content: s.content,
  })),
  null,
  2
)}

[4. 미해결된 대표 질문 그룹]
${JSON.stringify(
  unresolvedGroups.map((g) => ({
    title: g.representative_title,
    content: g.representative_content,
  })),
  null,
  2
)}

반드시 아래 JSON 스키마에 맞추어 순수 JSON 객체만 반환하세요:
{
  "overall_diagnosis": "교안 원문과 학생 질문을 대조한 객관적 총평 (2~3문장. 교안의 어떤 서술 방식이나 생략된 전제가 학생들의 주요 질문을 유발했는지 명확히 짚어줄 것)",
  "next_class_opening_guide": "다음 시간 도입부 5분 복습 가이드 (선생님이 칠판이나 화면에 띄우고 바로 말할 수 있는 구체적인 설명 흐름)",
  "gap_items": [
    {
      "id": "gap-1",
      "target_section": "교안에서 보완이 필요한 단락/개념 위치 (예: '1-(2) 계수 b와 대칭축' 또는 '교안 도입부 개념 정의')",
      "critique": "교안의 부족했던 점 (객관적 지적: 교안에는 A만 언급되어 있고 B에 대한 원리나 반례가 빠져 있어 학생들이 C라고 오해함)",
      "related_questions_summary": "이 취약점 때문에 발생한 실제 학생 질문 요약",
      "student_count": 2,
      "suggested_patch_title": "💡 [교안 보충] 학생들이 가장 헷갈려한 핵심 원리 바로잡기 (구체적 제목)",
      "suggested_patch_markdown": "교안에 원클릭으로 바로 추가할 수 있는 학생 눈높이 보충 설명 (마크다운 형식, 핵심 비유나 단계별 설명 포함, 4~7문장 내외)"
    }
  ],
  "suggested_interactive_improvement": "교안 자료나 시각 자료(표, 예시, 시뮬레이터 등)를 어떻게 개선하면 좋을지 한 줄 핵심 제안",
  "formative_quizzes": [
    {
      "question_text": "학생들의 실제 질문/오개념을 제대로 이해했는지 확인하는 4지선다 문제 발문",
      "options": [
        "선택지 1 (학생들이 실제로 헷갈려한 오개념을 매력적인 오답으로 구성)",
        "선택지 2",
        "선택지 3",
        "선택지 4"
      ],
      "correct_option_index": 0,
      "explanation": "정답 해설 및 오답 선지를 고른 학생을 위한 오개념 교정 피드백",
      "rationale": "출제 근거 (예: 'OOO라고 질문한 학생들의 오개념을 점검하기 위해 출제')",
      "target_concept": "핵심 점검 개념 키워드 (예: 대칭축 이동 원리)"
    }
  ]
}

주의사항:
- "gap_items"는 중요도 순으로 1~3개 작성하세요.
- "formative_quizzes"는 반드시 3문항을 작성하고, 각 문항의 "options" 배열은 정확히 4개의 문자열이어야 하며, "correct_option_index"는 0, 1, 2, 3 중 하나여야 합니다.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text) as Partial<AiLessonAnalysisResult>;

    const gapItems: MaterialGapItem[] = Array.isArray(parsed.gap_items)
      ? parsed.gap_items.map((item, idx) => ({
          id: item.id || `gap-${idx + 1}`,
          target_section: item.target_section || '교안 핵심 개념 영역',
          critique: item.critique || '개념 간 연결 원리에 대한 부연 설명이 필요합니다.',
          related_questions_summary:
            item.related_questions_summary || '학생 질문 기반 도출',
          student_count: Number(item.student_count) || 1,
          suggested_patch_title:
            item.suggested_patch_title || `💡 [보충 설명 ${idx + 1}] 핵심 개념 심화 노트`,
          suggested_patch_markdown:
            item.suggested_patch_markdown || '',
        }))
      : [];

    const quizzes: GeneratedQuizDraft[] = Array.isArray(parsed.formative_quizzes)
      ? parsed.formative_quizzes.map((q) => ({
          question_text: q.question_text || '핵심 개념 확인 문제',
          options:
            Array.isArray(q.options) && q.options.length === 4
              ? q.options
              : ['보기 1', '보기 2', '보기 3', '보기 4'],
          correct_option_index:
            typeof q.correct_option_index === 'number' &&
            q.correct_option_index >= 0 &&
            q.correct_option_index <= 3
              ? q.correct_option_index
              : 0,
          explanation: q.explanation || '정답 해설입니다.',
          rationale: q.rationale || '학생 질문 및 혼란 지점 기반 출제',
          target_concept: q.target_concept || '핵심 개념',
        }))
      : [];

    const result: AiLessonAnalysisResult = {
      overall_diagnosis:
        parsed.overall_diagnosis ||
        '교안의 개념 정의는 제시되어 있으나, 원리가 적용되는 구체적 맥락과 예외 사례 설명이 부족하여 학생들의 질문이 집중되었습니다.',
      next_class_opening_guide:
        parsed.next_class_opening_guide ||
        '다음 수업 시작 시 미해결 대표 질문을 화면에 띄우고, 교안에 새로 추가된 보충 설명 박스를 함께 읽으며 오개념을 짚어주세요.',
      gap_items: gapItems,
      suggested_interactive_improvement:
        parsed.suggested_interactive_improvement ||
        '핵심 개념의 전후 변화를 비교할 수 있는 직관적인 비교 예시나 시각 자료를 추가해 보세요.',
      formative_quizzes: quizzes,
      analyzed_at: new Date().toISOString(),
    };

    return { success: true, analysis: result };
  } catch (error) {
    console.error('Error in analyzeMaterialAndGenerateQuizWithGemini:', error);
    return {
      success: false,
      error:
        'AI 교안 분석 및 형성평가 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
}
