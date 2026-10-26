import {
  QuestionGroup,
  FormativeQuiz,
  QuizAttempt,
  QuizQuestionType,
} from '@/types/database.types';

export const QUIZ_GROUP_PREFIX = '[__QUIZ__]';
export const INLINE_QUIZ_GROUP_PREFIX = '[__INLINE_QUIZ__]';

/**
 * 단답형 답안 채점: 공백 정규화, 대소문자 무시, 쉼표(,)로 구분된 복수 허용 정답 중 하나라도 일치하면 정답 처리
 */
export function checkShortAnswerMatch(
  submittedText: string,
  expectedAnswerText: string
): boolean {
  const cleanSubmitted = (submittedText || '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
  if (!cleanSubmitted) return false;

  const candidates = (expectedAnswerText || '')
    .split(',')
    .map((c) => c.trim().replace(/\s+/g, '').toLowerCase())
    .filter(Boolean);

  if (candidates.length === 0) return false;
  return candidates.includes(cleanSubmitted);
}

export function separateGroupsAndQuizzes(allGroups: QuestionGroup[]): {
  normalGroups: QuestionGroup[];
  publishedQuizzes: FormativeQuiz[];
  inlineQuizzesMap: Record<string, FormativeQuiz>;
} {
  const normalGroups: QuestionGroup[] = [];
  const publishedQuizzes: FormativeQuiz[] = [];
  const inlineQuizzesMap: Record<string, FormativeQuiz> = {};

  // 오래된 순(Q1, Q2, Q3...)으로 정렬하기 위해 역순 처리 준비
  const quizGroupsRaw: QuestionGroup[] = [];
  const inlineQuizGroupsRaw: QuestionGroup[] = [];

  for (const g of allGroups) {
    if (g.representative_title.startsWith(QUIZ_GROUP_PREFIX)) {
      quizGroupsRaw.push(g);
    } else if (g.representative_title.startsWith(INLINE_QUIZ_GROUP_PREFIX)) {
      inlineQuizGroupsRaw.push(g);
    } else {
      normalGroups.push(g);
    }
  }

  // 생성 시간 오름차순 정렬 (Q1 -> Q2 -> Q3)
  quizGroupsRaw.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  function parseGroupToFormativeQuiz(
    qg: QuestionGroup,
    prefix: string
  ): FormativeQuiz | null {
    try {
      const parsed = JSON.parse(qg.representative_content);
      const attempts: QuizAttempt[] = [];

      for (const ans of qg.answers || []) {
        try {
          const ansData = JSON.parse(ans.content);
          if (
            typeof ansData.selected_option_index === 'number' ||
            typeof ansData.submitted_text === 'string'
          ) {
            attempts.push({
              id: ans.id,
              quiz_id: qg.id,
              lesson_id: qg.lesson_id,
              student_id: ans.author_id,
              selected_option_index:
                typeof ansData.selected_option_index === 'number'
                  ? ansData.selected_option_index
                  : -1,
              submitted_text:
                typeof ansData.submitted_text === 'string'
                  ? ansData.submitted_text
                  : undefined,
              is_correct: Boolean(ansData.is_correct),
              created_at: ans.created_at,
              student: ans.author,
            });
          }
        } catch {
          // 일반 텍스트 답변인 경우 무시
        }
      }

      const qType: QuizQuestionType =
        parsed.question_type === 'ox' ||
        parsed.question_type === 'short_answer' ||
        parsed.question_type === 'multiple_choice'
          ? parsed.question_type
          : 'multiple_choice';

      return {
        id: qg.id,
        lesson_id: qg.lesson_id,
        inline_block_id: parsed.inline_block_id || null,
        question_type: qType,
        question_text:
          parsed.question_text ||
          qg.representative_title.replace(prefix, '').trim(),
        options: Array.isArray(parsed.options) ? parsed.options : [],
        correct_option_index:
          typeof parsed.correct_option_index === 'number'
            ? parsed.correct_option_index
            : 0,
        answer_text: parsed.answer_text || '',
        explanation: parsed.explanation || '',
        rationale: parsed.rationale || '',
        target_concept: parsed.target_concept || null,
        is_published: qg.is_published,
        created_at: qg.created_at,
        attempts,
      };
    } catch {
      return null;
    }
  }

  for (const qg of quizGroupsRaw) {
    const parsedQuiz = parseGroupToFormativeQuiz(qg, QUIZ_GROUP_PREFIX);
    if (parsedQuiz) {
      publishedQuizzes.push(parsedQuiz);
    }
  }

  for (const iqg of inlineQuizGroupsRaw) {
    const parsedInline = parseGroupToFormativeQuiz(
      iqg,
      INLINE_QUIZ_GROUP_PREFIX
    );
    if (parsedInline && parsedInline.inline_block_id) {
      inlineQuizzesMap[parsedInline.inline_block_id] = parsedInline;
    }
  }

  return { normalGroups, publishedQuizzes, inlineQuizzesMap };
}
