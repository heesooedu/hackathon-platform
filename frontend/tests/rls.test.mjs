// RLS 회귀 테스트: 임시 Postgres(PGlite)에 전체 마이그레이션을 적용하고 역할별 권한을 확인합니다.
// 실행: npm run test:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../supabase/migrations'
);

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const TEACHER = id(1);
const CO_TEACHER = id(2);
const ALICE = id(3);
const BOB = id(4);
const OUTSIDER = id(5);
const CLASS = id(10);
const OPEN_LESSON = id(20);
const CLOSED_LESSON = id(21);
const PAST_LESSON = id(22);
const OTHER_LESSON = id(23);
const QUESTION_GROUP = id(30);
const QUIZ_GROUP = id(31);
const INLINE_GROUP = id(32);
const SHORT_GROUP = id(33);

let db;

async function as(userId, sql, params) {
  await db.exec(`RESET ROLE; SELECT set_config('request.sub', '${userId}', false); SET ROLE authenticated;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('RESET ROLE');
  }
}

const value = (result) => Object.values(result.rows[0])[0];
const board = async (userId, lessonId = OPEN_LESSON) =>
  value(await as(userId, 'select public.get_lesson_board($1)', [lessonId]));
const attempt = async (userId, groupId, selected, text = null) =>
  value(await as(userId, 'select public.submit_quiz_attempt($1, $2, $3)', [groupId, selected, text]));
const storedAnswer = async (groupId, userId) =>
  (await db.query('select content, is_teacher_checked from answers where group_id = $1 and author_id = $2', [groupId, userId])).rows[0];

before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ select nullif(current_setting('request.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  `);

  for (const file of fs.readdirSync(migrationsDir).sort()) {
    await db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  await db.exec(`
    INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
      ('${TEACHER}', 'teacher@example.test', '{"name":"교사"}'),
      ('${CO_TEACHER}', 'co@example.test', '{"name":"공동"}'),
      ('${ALICE}', 'a@example.test', '{"role":"student","name":"학생A"}'),
      ('${BOB}', 'b@example.test', '{"role":"student","name":"학생B"}'),
      ('${OUTSIDER}', 'o@example.test', '{"role":"student","name":"외부"}');
    SELECT set_config('app.role_change_allowed', 'on', false);
    UPDATE profiles SET role = 'teacher' WHERE id IN ('${TEACHER}', '${CO_TEACHER}');
    SELECT set_config('app.role_change_allowed', '', false);
    INSERT INTO classes(id, teacher_id, name, join_code) VALUES ('${CLASS}', '${TEACHER}', '1반', 'AB3K9X');
    INSERT INTO class_teachers(class_id, teacher_id) VALUES ('${CLASS}', '${CO_TEACHER}');
    INSERT INTO class_members(class_id, student_id) VALUES ('${CLASS}', '${ALICE}'), ('${CLASS}', '${BOB}');
    INSERT INTO lessons(id, class_id, title, learning_objective, status, deadline) VALUES
      ('${OPEN_LESSON}', '${CLASS}', '열림', '목표', 'open', now() + interval '1 day'),
      ('${CLOSED_LESSON}', '${CLASS}', '닫힘', '목표', 'closed', NULL),
      ('${PAST_LESSON}', '${CLASS}', '기한 지남', '목표', 'open', now() - interval '1 day'),
      ('${OTHER_LESSON}', '${CLASS}', '다른 수업', '목표', 'open', NULL);
    INSERT INTO question_groups(id, lesson_id, representative_title, representative_content, is_published, is_resolved) VALUES
      ('${QUESTION_GROUP}', '${OPEN_LESSON}', '대표 질문', '설명', true, false),
      ('${QUIZ_GROUP}', '${OPEN_LESSON}', '[__QUIZ__]Q1. 문제',
       '{"question_text":"문제","options":["가","나"],"correct_option_index":1,"explanation":"해설","rationale":"근거"}', true, false),
      ('${INLINE_GROUP}', '${OPEN_LESSON}', '[__INLINE_QUIZ__]체크포인트',
       '{"inline_block_id":"block-1","question_type":"ox","options":["O","X"],"correct_option_index":0,"explanation":"해설"}', true, false),
      ('${SHORT_GROUP}', '${OPEN_LESSON}', '[__INLINE_QUIZ__]단답',
       '{"inline_block_id":"block-2","question_type":"short_answer","answer_text":"광합성, photo synthesis"}', true, false);
    INSERT INTO submissions(id, lesson_id, student_id, type, content) VALUES
      ('${id(40)}', '${OPEN_LESSON}', '${ALICE}', 'question', 'A의 질문'),
      ('${id(41)}', '${OPEN_LESSON}', '${BOB}', 'confusion', 'B의 혼란');
    INSERT INTO question_group_members(group_id, submission_id) VALUES ('${QUESTION_GROUP}', '${id(41)}');
    INSERT INTO answers(id, group_id, author_id, content, is_teacher_checked) VALUES
      ('${id(50)}', '${QUESTION_GROUP}', '${BOB}', 'B의 답변', false),
      ('${id(51)}', '${QUESTION_GROUP}', '${TEACHER}', '교사 답변', true);
  `);
});

after(async () => {
  await db?.close();
});

describe('7번: 익명성', () => {
  test('학생은 동료 제출물 원본을 직접 읽을 수 없다', async () => {
    const { rows } = await as(ALICE, 'select student_id from submissions');
    assert.deepEqual(rows.map((r) => r.student_id), [ALICE]);
  });

  test('학생은 동료 답변 원본을 직접 읽을 수 없다', async () => {
    assert.equal((await as(ALICE, 'select id from answers')).rows.length, 0);
  });

  test('익명 보드는 동료 ID를 포함하지 않고 내용은 보여 준다', async () => {
    const result = await board(ALICE);
    const raw = JSON.stringify(result);
    assert.ok(!raw.includes(BOB), '동료 ID 노출');
    assert.ok(!raw.includes(TEACHER), '교사 ID 노출');
    assert.ok(raw.includes('B의 혼란'));
    assert.deepEqual(
      result.submissions.map((s) => s.student_id).sort(),
      [ALICE, 'anonymous'].sort()
    );
    const group = result.groups.find((g) => g.id === QUESTION_GROUP);
    assert.equal(group.members[0].submission.student_id, 'anonymous');
    assert.deepEqual(group.answers.map((a) => a.author_id).sort(), ['anonymous', 'teacher']);
  });

  test('소속되지 않은 학생은 보드를 볼 수 없다', async () => {
    assert.equal(await board(OUTSIDER), null);
  });

  test('교사는 작성자를 포함한 원본을 계속 볼 수 있다', async () => {
    assert.equal((await as(TEACHER, 'select student_id from submissions')).rows.length, 2);
    assert.equal((await as(CO_TEACHER, 'select author_id from answers')).rows.length >= 2, true);
  });
});

describe('8번: 제출 마감', () => {
  const insert = (lessonId) =>
    as(BOB, `insert into submissions(lesson_id, student_id, type, content) values ($1, $2, 'question', 'x')`, [lessonId, BOB]);

  test('닫힌 수업과 기한 지난 수업에는 제출할 수 없다', async () => {
    await assert.rejects(insert(CLOSED_LESSON));
    await assert.rejects(insert(PAST_LESSON));
  });

  test('열린 수업에는 제출하고 수정할 수 있다', async () => {
    await insert(OTHER_LESSON);
    const { affectedRows } = await as(BOB, `update submissions set content = '수정' where lesson_id = $1`, [OTHER_LESSON]);
    assert.equal(affectedRows, 1);
  });

  test('제출물을 다른 수업으로 옮길 수 없다', async () => {
    await assert.rejects(as(ALICE, 'update submissions set lesson_id = $1 where student_id = $2', [OTHER_LESSON, ALICE]));
  });

  test('마감 후에는 수정되지 않는다', async () => {
    await db.exec(`update lessons set status = 'closed' where id = '${OTHER_LESSON}'`);
    const { affectedRows } = await as(BOB, `update submissions set content = '늦은 수정' where lesson_id = $1`, [OTHER_LESSON]);
    assert.equal(affectedRows, 0);
  });

  test('소속되지 않은 학생은 제출할 수 없다', async () => {
    await assert.rejects(
      as(OUTSIDER, `insert into submissions(lesson_id, student_id, type, content) values ($1, $2, 'question', 'x')`, [OPEN_LESSON, OUTSIDER])
    );
  });
});

describe('9번과 인라인 퀴즈', () => {
  test('학생은 퀴즈 그룹 원본을 직접 읽을 수 없다', async () => {
    const { rows } = await as(ALICE, 'select id from question_groups');
    assert.deepEqual(rows.map((r) => r.id), [QUESTION_GROUP]);
  });

  test('풀기 전에는 정답이 없고, 풀고 난 뒤에는 본인에게만 보인다', async () => {
    const quizOf = (b) => JSON.parse(b.groups.find((g) => g.id === QUIZ_GROUP).representative_content);
    const beforeAttempt = quizOf(await board(ALICE));
    assert.equal(beforeAttempt.question_text, '문제');
    assert.equal(beforeAttempt.correct_option_index, undefined);
    assert.equal(beforeAttempt.explanation, undefined);

    const res = await attempt(ALICE, QUIZ_GROUP, 0);
    assert.deepEqual(res, { success: true, is_correct: false });
    assert.equal(quizOf(await board(ALICE)).correct_option_index, 1);
    assert.equal(quizOf(await board(BOB)).correct_option_index, undefined);
  });

  test('동료의 풀이 기록은 보드에 나오지 않는다', async () => {
    const group = (await board(BOB)).groups.find((g) => g.id === QUIZ_GROUP);
    assert.equal(group.answers.length, 0);
  });

  test('학생은 채점 결과를 직접 기록하거나 고칠 수 없다', async () => {
    const forged = '{"selected_option_index":1,"is_correct":true}';
    await assert.rejects(
      as(BOB, 'insert into answers(group_id, author_id, content, is_teacher_checked) values ($1, $2, $3, true)', [QUIZ_GROUP, BOB, forged])
    );
    const { affectedRows } = await as(ALICE, 'update answers set content = $1, is_teacher_checked = true where group_id = $2', [forged, QUIZ_GROUP]);
    assert.equal(affectedRows, 0);
    assert.equal(JSON.parse((await storedAnswer(QUIZ_GROUP, ALICE)).content).is_correct, false);
  });

  test('학생은 풀이 기록을 지울 수 없다', async () => {
    const { affectedRows } = await as(ALICE, 'delete from answers where group_id = $1', [QUIZ_GROUP]);
    assert.equal(affectedRows, 0);
  });

  test('다시 풀면 기록이 하나로 갱신된다', async () => {
    assert.deepEqual(await attempt(ALICE, QUIZ_GROUP, 1), { success: true, is_correct: true });
    const { rows } = await db.query('select id from answers where group_id = $1 and author_id = $2', [QUIZ_GROUP, ALICE]);
    assert.equal(rows.length, 1);
  });

  test('인라인 퀴즈 정답이 저장된다', async () => {
    const res = value(await as(BOB, 'select public.submit_inline_quiz_attempt($1, $2, $3, $4)', [OPEN_LESSON, 'block-1', 0, null]));
    assert.deepEqual(res, { success: true, is_correct: true });
    const stored = await storedAnswer(INLINE_GROUP, BOB);
    assert.equal(stored.is_teacher_checked, true);
    assert.equal(JSON.parse(stored.content).is_correct, true);
  });

  test('없는 인라인 블록은 not_found를 돌려준다', async () => {
    const res = value(await as(BOB, 'select public.submit_inline_quiz_attempt($1, $2, $3, $4)', [OPEN_LESSON, 'none', 0, null]));
    assert.equal(res.not_found, true);
  });

  test('단답형은 공백과 대소문자를 무시하고 복수 정답을 인정한다', async () => {
    assert.equal((await attempt(ALICE, SHORT_GROUP, null, ' 광 합성 ')).is_correct, true);
    assert.equal((await attempt(ALICE, SHORT_GROUP, null, 'PHOTOSYNTHESIS')).is_correct, true);
    assert.equal((await attempt(ALICE, SHORT_GROUP, null, '호흡')).is_correct, false);
    assert.equal((await attempt(ALICE, SHORT_GROUP, null, '')).is_correct, false);
  });

  test('소속되지 않은 학생과 일반 질문 그룹은 채점되지 않는다', async () => {
    assert.equal((await attempt(OUTSIDER, QUIZ_GROUP, 1)).success, false);
    assert.equal((await attempt(ALICE, QUESTION_GROUP, 1)).success, false);
  });

  test('익명 사용자는 RPC를 실행할 수 없다', async () => {
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('select public.get_lesson_board($1)', [OPEN_LESSON]));
    await assert.rejects(db.query('select public.submit_quiz_attempt($1, 1, null)', [QUIZ_GROUP]));
    await db.exec('RESET ROLE');
  });
});

describe('일반 답변 회귀', () => {
  test('학생은 일반 질문에 답변을 쓰고 자기 답변을 고칠 수 있다', async () => {
    await as(ALICE, `insert into answers(id, group_id, author_id, content) values ($1, $2, $3, '내 답변')`, [id(52), QUESTION_GROUP, ALICE]);
    const { affectedRows } = await as(ALICE, `update answers set content = '고침' where id = $1`, [id(52)]);
    assert.equal(affectedRows, 1);
  });

  test('학생은 교사 확인을 스스로 표시할 수 없다', async () => {
    await assert.rejects(as(ALICE, 'update answers set is_teacher_checked = true where id = $1', [id(52)]));
  });

  test('교사는 답변을 확인 처리할 수 있다', async () => {
    const { affectedRows } = await as(CO_TEACHER, 'update answers set is_teacher_checked = true where id = $1', [id(52)]);
    assert.equal(affectedRows, 1);
  });
});

describe('AI 사용량 제한', () => {
  const consume = async (userId) =>
    value(await as(userId, `select public.consume_ai_quota('test')`));

  test('학생은 AI 사용량을 받을 수 없다', async () => {
    assert.equal((await consume(ALICE)).allowed, false);
  });

  test('교사는 시간당 30회까지 사용하고 그다음은 거부된다', async () => {
    for (let i = 0; i < 30; i++) assert.equal((await consume(TEACHER)).allowed, true);
    const res = await consume(TEACHER);
    assert.equal(res.allowed, false);
    assert.match(res.message, /1시간/);
  });

  test('한도는 계정별로 적용된다', async () => {
    assert.equal((await consume(CO_TEACHER)).allowed, true);
  });

  test('일일 한도를 넘으면 거부된다', async () => {
    await db.exec(`
      update ai_usage_events set created_at = now() - interval '2 hours';
      insert into ai_usage_events(user_id, kind, created_at)
      select '${TEACHER}', 'test', now() - interval '3 hours' from generate_series(1, 70);
    `);
    const res = await consume(TEACHER);
    assert.equal(res.allowed, false);
    assert.match(res.message, /오늘/);
  });

  test('사용 기록은 API로 읽거나 쓸 수 없다', async () => {
    await assert.rejects(as(TEACHER, 'select * from ai_usage_events'));
    await assert.rejects(as(TEACHER, `insert into ai_usage_events(user_id, kind) values ($1, 'x')`, [TEACHER]));
  });
});

describe('참여 코드', () => {
  const join = async (userId, code) =>
    value(await as(userId, 'select public.join_class_by_code($1)', [code]));

  test('올바른 코드로 참여한다', async () => {
    assert.equal((await join(OUTSIDER, 'ab3k9x')).success, true);
    await db.exec(`delete from class_members where student_id = '${OUTSIDER}'`);
  });

  test('10번 틀리면 정답 코드도 1시간 동안 거부된다', async () => {
    for (let i = 0; i < 10; i++) {
      assert.match((await join(OUTSIDER, 'ZZZZZZ')).message, /유효하지 않은/);
    }
    const blocked = await join(OUTSIDER, 'AB3K9X');
    assert.equal(blocked.success, false);
    assert.match(blocked.message, /시도 횟수/);
  });

  test('1시간이 지나면 다시 참여할 수 있다', async () => {
    await db.exec(`update join_code_attempts set attempted_at = now() - interval '2 hours'`);
    assert.equal((await join(OUTSIDER, 'AB3K9X')).success, true);
    await db.exec(`delete from class_members where student_id = '${OUTSIDER}'`);
  });

  test('교안 보관함 코드는 실패로 기록되고 참여되지 않는다', async () => {
    assert.equal((await join(OUTSIDER, '#ABCDE')).success, false);
  });

  test('시도 기록은 API로 읽을 수 없다', async () => {
    await assert.rejects(as(OUTSIDER, 'select * from join_code_attempts'));
  });

  test('교사는 코드를 재발급할 수 있고 이전 코드는 거부된다', async () => {
    const { affectedRows } = await as(CO_TEACHER, `update classes set join_code = 'NEW234' where id = $1`, [CLASS]);
    assert.equal(affectedRows, 1);
    assert.equal((await join(OUTSIDER, 'AB3K9X')).success, false);
    assert.equal((await join(OUTSIDER, 'NEW234')).success, true);
    await db.exec(`delete from class_members where student_id = '${OUTSIDER}'`);
  });

  test('학생은 코드를 바꿀 수 없다', async () => {
    const { affectedRows } = await as(ALICE, `update classes set join_code = 'HACK22' where id = $1`, [CLASS]);
    assert.equal(affectedRows, 0);
  });
});

describe('학생 직접 등록', () => {
  const add = async (identifier) =>
    value(await as(TEACHER, 'select public.teacher_add_student_to_class($1, $2)', [CLASS, identifier]));

  test('이름으로는 찾을 수 없다', async () => {
    assert.match((await add('외부')).error, /찾을 수 없습니다/);
  });

  test('이메일로는 등록된다', async () => {
    assert.equal((await add('O@example.test')).success, true);
    await db.exec(`delete from class_members where student_id = '${OUTSIDER}'`);
  });
});

describe('재실행', () => {
  test('13~15를 다시 실행해도 오류가 없다', async () => {
    for (const file of ['13_anonymous_board_and_quiz_rpc.sql', '14_restrict_peer_reads.sql', '15_ai_quota_and_join_limits.sql']) {
      await db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }
  });
});
