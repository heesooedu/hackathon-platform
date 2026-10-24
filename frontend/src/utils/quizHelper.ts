import { QuestionGroup, FormativeQuiz, QuizAttempt } from '@/types/database.types';

export const QUIZ_GROUP_PREFIX = '[__QUIZ__]';

export function separateGroupsAndQuizzes(allGroups: QuestionGroup[]): {
  normalGroups: QuestionGroup[];
  publishedQuizzes: FormativeQuiz[];
} {
  const normalGroups: QuestionGroup[] = [];
  const publishedQuizzes: FormativeQuiz[] = [];

  // 오래된 순(Q1, Q2, Q3...)으로 정렬하기 위해 역순 처리 준비
  const quizGroupsRaw: QuestionGroup[] = [];

  for (const g of allGroups) {
    if (g.representative_title.startsWith(QUIZ_GROUP_PREFIX)) {
      quizGroupsRaw.push(g);
    } else {
      normalGroups.push(g);
    }
  }

  // 생성 시간 오름차순 정렬 (Q1 -> Q2 -> Q3)
  quizGroupsRaw.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const qg of quizGroupsRaw) {
    try {
      const parsed = JSON.parse(qg.representative_content);
      const attempts: QuizAttempt[] = [];

      for (const ans of qg.answers || []) {
        try {
          const ansData = JSON.parse(ans.content);
          if (typeof ansData.selected_option_index === 'number') {
            attempts.push({
              id: ans.id,
              quiz_id: qg.id,
              lesson_id: qg.lesson_id,
              student_id: ans.author_id,
              selected_option_index: ansData.selected_option_index,
              is_correct: Boolean(ansData.is_correct),
              created_at: ans.created_at,
              student: ans.author,
            });
          }
        } catch {
          // 일반 텍스트 답변인 경우 무시
        }
      }

      publishedQuizzes.push({
        id: qg.id,
        lesson_id: qg.lesson_id,
        question_text:
          parsed.question_text ||
          qg.representative_title.replace(QUIZ_GROUP_PREFIX, '').trim(),
        options: Array.isArray(parsed.options) ? parsed.options : [],
        correct_option_index:
          typeof parsed.correct_option_index === 'number'
            ? parsed.correct_option_index
            : 0,
        explanation: parsed.explanation || '',
        rationale: parsed.rationale || '',
        target_concept: parsed.target_concept || null,
        is_published: qg.is_published,
        created_at: qg.created_at,
        attempts,
      });
    } catch {
      // 파싱 실패 시 무시
    }
  }

  return { normalGroups, publishedQuizzes };
}
