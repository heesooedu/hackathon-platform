import { GoogleGenAI } from '@google/genai';
import { Submission } from '@/types/database.types';

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

  // 질문 대상 필터링 (질문/혼란/탐구)
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
