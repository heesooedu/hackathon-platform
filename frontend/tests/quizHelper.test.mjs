// 단답형 채점과 퀴즈 그룹 분리 시험입니다.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  checkShortAnswerMatch,
  INLINE_QUIZ_GROUP_PREFIX,
  QUIZ_GROUP_PREFIX,
  separateGroupsAndQuizzes,
} from '../src/utils/quizHelper.ts';

describe('단답형 채점', () => {
  test('공백과 대소문자를 무시한다', () => {
    assert.equal(checkShortAnswerMatch(' Print ( ) ', 'print()'), true);
    assert.equal(checkShortAnswerMatch('조건 문', '조건문'), true);
  });

  test('쉼표로 나눈 정답 중 하나면 맞다', () => {
    assert.equal(checkShortAnswerMatch('반복', '조건, 반복'), true);
    assert.equal(checkShortAnswerMatch('함수', '조건, 반복'), false);
  });

  test('한글 자모가 분리된 입력도 같은 글자로 본다', () => {
    assert.equal(checkShortAnswerMatch('조건문'.normalize('NFD'), '조건문'), true);
    assert.equal(checkShortAnswerMatch('조건문', '조건문'.normalize('NFD')), true);
  });

  test('빈 답과 빈 정답은 틀리다', () => {
    assert.equal(checkShortAnswerMatch('', '답'), false);
    assert.equal(checkShortAnswerMatch('   ', '답'), false);
    assert.equal(checkShortAnswerMatch('답', ''), false);
    assert.equal(checkShortAnswerMatch('답', ' , '), false);
  });
});

const group = (id, title, content, fields = {}) => ({
  id,
  lesson_id: 'l',
  representative_title: title,
  representative_content: content,
  is_published: true,
  created_at: '2026-11-01T00:00:00.000Z',
  answers: [],
  ...fields,
});

describe('퀴즈 그룹 분리', () => {
  test('일반 질문, 형성평가, 인라인 퀴즈를 나눈다', () => {
    const result = separateGroupsAndQuizzes([
      group('n', '대표 질문', '내용'),
      group('q', `${QUIZ_GROUP_PREFIX}문제`, JSON.stringify({ question_text: '문제', options: ['a', 'b'] })),
      group('i', `${INLINE_QUIZ_GROUP_PREFIX}문제`, JSON.stringify({ inline_block_id: 'iq', options: [] })),
    ]);
    assert.deepEqual(result.normalGroups.map((g) => g.id), ['n']);
    assert.deepEqual(result.publishedQuizzes.map((q) => q.id), ['q']);
    assert.deepEqual(Object.keys(result.inlineQuizzesMap), ['iq']);
  });

  test('형성평가는 오래된 순이다', () => {
    const { publishedQuizzes } = separateGroupsAndQuizzes([
      group('b', `${QUIZ_GROUP_PREFIX}둘`, '{}', { created_at: '2026-11-02T00:00:00.000Z' }),
      group('a', `${QUIZ_GROUP_PREFIX}하나`, '{}', { created_at: '2026-11-01T00:00:00.000Z' }),
    ]);
    assert.deepEqual(publishedQuizzes.map((q) => q.id), ['a', 'b']);
  });

  test('제목에서 문제를 복구하고 기본값을 채운다', () => {
    const [quiz] = separateGroupsAndQuizzes([group('q', `${QUIZ_GROUP_PREFIX} 문제`, '{}')]).publishedQuizzes;
    assert.equal(quiz.question_text, '문제');
    assert.equal(quiz.question_type, 'multiple_choice');
    assert.deepEqual(quiz.options, []);
  });

  test('풀이 기록만 모으고 일반 글은 건너뛴다', () => {
    const answers = [
      { id: 'a1', author_id: 's1', created_at: 'x', content: JSON.stringify({ selected_option_index: 1, is_correct: true }) },
      { id: 'a2', author_id: 's2', created_at: 'x', content: JSON.stringify({ submitted_text: '답', is_correct: false }) },
      { id: 'a3', author_id: 's3', created_at: 'x', content: '그냥 답변' },
      { id: 'a4', author_id: 's4', created_at: 'x', content: 'null' },
      { id: 'a5', author_id: 's5', created_at: 'x', content: '{"other":1}' },
    ];
    const [quiz] = separateGroupsAndQuizzes([group('q', `${QUIZ_GROUP_PREFIX}문제`, '{}', { answers })]).publishedQuizzes;
    assert.deepEqual(quiz.attempts.map((a) => [a.id, a.selected_option_index, a.is_correct]), [
      ['a1', 1, true],
      ['a2', -1, false],
    ]);
  });

  test('깨진 퀴즈와 블록 id 없는 인라인 퀴즈는 뺀다', () => {
    const result = separateGroupsAndQuizzes([
      group('q', `${QUIZ_GROUP_PREFIX}문제`, '{깨짐'),
      group('n', `${QUIZ_GROUP_PREFIX}문제`, 'null'),
      group('i', `${INLINE_QUIZ_GROUP_PREFIX}문제`, '{}'),
    ]);
    assert.deepEqual(result.publishedQuizzes, []);
    assert.deepEqual(result.inlineQuizzesMap, {});
  });
});
