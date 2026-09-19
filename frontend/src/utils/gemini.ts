import { GoogleGenAI } from '@google/genai';
import { Submission, QuestionGroup } from '@/types/database.types';

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

export async function generateLessonReviewWithGemini(
  submissions: Submission[],
  groups: QuestionGroup[],
  learningObjective: string,
  lessonTitle: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return 'GEMINI_API_KEY가 설정되지 않아 AI 수업 분석을 실행할 수 없습니다. .env.local을 확인해 주세요.';
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const unresolvedGroups = groups.filter((g) => !g.is_resolved);
    const resolvedGroups = groups.filter((g) => g.is_resolved);

    const prompt = `
당신은 혁신적인 수업 개선을 돕는 전문 교수학습 컨설턴트 AI입니다.
선생님이 이번 수업을 마치고 학생들의 피드백을 바탕으로 다음 수업과 인터랙티브 교안(웹 시뮬레이터/앱릿)을 개선하려고 합니다.

[수업 기본 정보]
- 수업 차시: ${lessonTitle}
- 학습 목표: ${learningObjective}

[학생 제출 데이터 요약]
- 총 제출 수: ${submissions.length}건
- 질문 유형 분포: 질문 ${submissions.filter((s) => s.type === 'question').length}건, 혼란 ${submissions.filter((s) => s.type === 'confusion').length}건, 탐구 ${submissions.filter((s) => s.type === 'explore').length}건, 이해완료 ${submissions.filter((s) => s.type === 'understood').length}건
- 대표 질문 해결 현황: 전체 ${groups.length}개 중 해결 완료 ${resolvedGroups.length}개, 미해결 ${unresolvedGroups.length}개

[학생들의 실제 질문/혼란 내용 목록]
${JSON.stringify(submissions.map((s) => ({ type: s.type, content: s.content })), null, 2)}

[미해결된 대표 질문 목록]
${JSON.stringify(unresolvedGroups.map((g) => ({ title: g.representative_title, content: g.representative_content })), null, 2)}

선생님을 위해 다음 3가지 핵심 영역으로 구성된 깔끔하고 통찰력 있는 '수업 회고 및 교안 개선 리포트'를 마크다운 형식으로 작성해 주세요:
1. 🎯 **이번 차시 핵심 오개념 및 취약점 진단** (학생들이 가장 많이 헷갈려한 지점)
2. ⏱️ **다음 시간 도입부 5분 원포인트 복습 가이드** (수업 시작 시 꼭 짚어주어야 할 질문과 설명 팁)
3. 🛠️ **인터랙티브 웹 교안(시뮬레이터) 보강 아이디어** (학생들의 질문을 해결하기 위해 기존 시뮬레이터나 교안에 어떤 인터랙션/슬라이더/비교 요소를 추가하면 좋을지 구체적 조언)

친절하고 격려하는 선생님 맞춤형 톤앤매너로 작성해 주세요.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || '리포트 생성 결과가 비어 있습니다.';
  } catch (error) {
    console.error('Error generating lesson review with Gemini:', error);
    return '수업 분석 리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
}
