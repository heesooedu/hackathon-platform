// 교안 봉투 시험: 저장한 교안과 메타데이터를 그대로 읽고, 예전 형식과 깨진 값도 안전하게 처리하는지 확인합니다.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  getReadableMaterialTextForAi,
  hasActualLessonMaterial,
  isMaterialLibraryClass,
  MATERIAL_LIBRARY_CLASS_NAME,
  parseLessonMaterial,
  serializeLessonMaterial,
  sortLessonsByOrder,
  toLightweightLessonForList,
} from '../src/utils/materialPayload.ts';

const META_PREFIX = '<!--__PEDAGOGY_V2_META__:';
const META_SUFFIX = ':__END_PEDAGOGY_V2_META__-->';

const lesson = (fields = {}) => ({ id: 'l', created_at: '2026-11-01T00:00:00.000Z', material_html: null, ...fields });

const payload = (fields = {}) => ({
  materialType: 'markdown',
  markdownContent: '',
  htmlContent: '',
  fileName: null,
  appliedPatches: [],
  aiAnalysis: null,
  displayOrder: null,
  subjectCategory: null,
  unitCategory: null,
  sessionNumber: null,
  pageIcon: null,
  sourceMaterialId: null,
  ...fields,
});

const reload = (value) => parseLessonMaterial(lesson({ material_html: serializeLessonMaterial(value) }));

describe('봉투 왕복', () => {
  test('모든 필드를 그대로 읽는다', () => {
    const value = payload({
      markdownContent: '# 한글 제목 💡\n\n```quiz\n{}\n```',
      fileName: '수업 자료.hwpx',
      appliedPatches: [{ id: 'p', title: '보충', content_markdown: '내용', applied_at: '2026-11-01' }],
      aiAnalysis: { summary: '요약' },
      displayOrder: 0,
      subjectCategory: '정보',
      unitCategory: '조건문',
      sessionNumber: 3,
      pageIcon: '💻',
      sourceMaterialId: 'master-1',
    });
    assert.deepEqual(reload(value), value);
  });

  test('HTML 교안은 본문 뒤에 봉투를 붙인다', () => {
    const value = payload({ materialType: 'html', htmlContent: '<div>실험</div>' });
    const raw = serializeLessonMaterial(value);
    assert.ok(raw.startsWith('<div>실험</div>\n'));
    assert.deepEqual(reload(value), value);
  });

  test('HTML 본문에 봉투 표시 글자가 있어도 맨 뒤 봉투를 읽는다', () => {
    const value = payload({
      materialType: 'html',
      htmlContent: `<script>const a = "${META_PREFIX}"; const b = "${META_SUFFIX}";</script>`,
      subjectCategory: '정보',
    });
    assert.deepEqual(reload(value), value);
  });

  test('내용이 없으면 빈 문자열이다', () => {
    assert.equal(serializeLessonMaterial(payload()), '');
  });

  test('분류만 있어도 저장한다', () => {
    assert.equal(reload(payload({ subjectCategory: '과학' })).subjectCategory, '과학');
    assert.equal(reload(payload({ displayOrder: 0 })).displayOrder, 0);
  });

  test('브라우저에서도 서버가 저장한 한글을 읽는다', () => {
    const raw = serializeLessonMaterial(payload({ markdownContent: '한글 💡' }));
    const savedBuffer = globalThis.Buffer;
    try {
      delete globalThis.Buffer;
      assert.equal(parseLessonMaterial(lesson({ material_html: raw })).markdownContent, '한글 💡');
      const browserRaw = serializeLessonMaterial(payload({ markdownContent: '브라우저 💡' }));
      globalThis.Buffer = savedBuffer;
      assert.equal(parseLessonMaterial(lesson({ material_html: browserRaw })).markdownContent, '브라우저 💡');
    } finally {
      globalThis.Buffer = savedBuffer;
    }
  });
});

describe('예전 형식과 깨진 값', () => {
  test('비어 있는 교안', () => {
    const parsed = parseLessonMaterial(lesson());
    assert.equal(parsed.materialType, 'markdown');
    assert.equal(parsed.markdownContent, '');
  });

  test('태그로 시작하면 HTML로 읽는다', () => {
    for (const html of ['<!DOCTYPE html><p>a</p>', '<html></html>', '<style>a{}</style>', '<div>a</div>']) {
      const parsed = parseLessonMaterial(lesson({ material_html: html }));
      assert.equal(parsed.materialType, 'html');
      assert.equal(parsed.htmlContent, html);
    }
  });

  test('그 밖의 글은 마크다운으로 읽는다', () => {
    const parsed = parseLessonMaterial(lesson({ material_html: ' # 제목 ' }));
    assert.equal(parsed.materialType, 'markdown');
    assert.equal(parsed.markdownContent, '# 제목');
  });

  test('별도 열에 저장된 교안과 패치', () => {
    const patches = [{ id: 'p', title: '보충', content_markdown: '내용', applied_at: 'x' }];
    const parsed = parseLessonMaterial(
      lesson({ material_markdown: '본문', material_type: 'markdown', ai_supplement_markdown: JSON.stringify(patches) })
    );
    assert.equal(parsed.markdownContent, '본문');
    assert.deepEqual(parsed.appliedPatches, patches);
  });

  test('패치 열이 일반 글이면 보충 설명 하나로 읽는다', () => {
    const parsed = parseLessonMaterial(lesson({ material_markdown: '본문', ai_supplement_markdown: '보충' }));
    assert.equal(parsed.appliedPatches.length, 1);
    assert.equal(parsed.appliedPatches[0].content_markdown, '보충');
  });

  test('봉투가 깨지면 별도 열의 교안을 쓴다', () => {
    const parsed = parseLessonMaterial(
      lesson({ material_html: `${META_PREFIX}깨진값${META_SUFFIX}`, material_markdown: '본문' })
    );
    assert.equal(parsed.markdownContent, '본문');
  });

  test('깨진 봉투 글자를 교안 본문으로 보여 주지 않는다', () => {
    const parsed = parseLessonMaterial(lesson({ material_html: `${META_PREFIX}깨진값${META_SUFFIX}` }));
    assert.equal(parsed.markdownContent, '');
    assert.equal(parsed.htmlContent, '');
  });

  test('깨진 봉투 앞의 HTML은 살린다', () => {
    const parsed = parseLessonMaterial(lesson({ material_html: `<div>실험</div>\n${META_PREFIX}깨진값${META_SUFFIX}` }));
    assert.equal(parsed.materialType, 'html');
    assert.equal(parsed.htmlContent, '<div>실험</div>');
  });

  test('봉투의 패치가 배열이 아니면 비운다', () => {
    const json = JSON.stringify({ version: 2, markdownContent: '본문', appliedPatches: 'x' });
    const raw = `${META_PREFIX}${Buffer.from(json).toString('base64')}${META_SUFFIX}`;
    assert.deepEqual(parseLessonMaterial(lesson({ material_html: raw })).appliedPatches, []);
  });
});

describe('읽기 캐시', () => {
  test('교안이 바뀌면 다시 읽는다', () => {
    const item = lesson({ material_html: serializeLessonMaterial(payload({ markdownContent: '처음' })) });
    assert.equal(parseLessonMaterial(item).markdownContent, '처음');
    item.material_html = serializeLessonMaterial(payload({ markdownContent: '수정' }));
    assert.equal(parseLessonMaterial(item).markdownContent, '수정');
  });
});

describe('목록용 가벼운 교안', () => {
  const full = lesson({
    material_html: serializeLessonMaterial(
      payload({
        markdownContent: `# 본문\n\n\`\`\`colab\nprint(1)\n\`\`\`\n\n![그림](data:image/png;base64,${'A'.repeat(1000)})`,
        appliedPatches: [{ id: 'p', title: '보충', content_markdown: '긴 내용', applied_at: 'x' }],
        aiAnalysis: { summary: '요약' },
        subjectCategory: '정보',
        displayOrder: 2,
      })
    ),
    ai_review_json: { summary: '요약' },
  });

  test('본문과 AI 분석을 빼고 표시 정보만 남긴다', () => {
    const light = toLightweightLessonForList(full);
    const parsed = parseLessonMaterial(light);
    assert.equal(parsed.markdownContent, '```colab');
    assert.equal(parsed.aiAnalysis, null);
    assert.equal(parsed.appliedPatches[0].content_markdown, '');
    assert.equal(parsed.subjectCategory, '정보');
    assert.equal(parsed.displayOrder, 2);
    assert.ok(light.material_html.length < full.material_html.length);
  });

  test('교안이 있다는 표시는 유지한다', () => {
    assert.equal(hasActualLessonMaterial(toLightweightLessonForList(full)), true);
    assert.equal(hasActualLessonMaterial(toLightweightLessonForList(lesson())), false);
  });

  test('캐시 없이 다시 읽어도 같다', () => {
    const light = toLightweightLessonForList(full);
    assert.deepEqual(parseLessonMaterial({ ...light }), parseLessonMaterial(light));
  });
});

describe('수업 순서', () => {
  const ordered = (id, created_at, fields) =>
    lesson({ id, created_at, material_html: serializeLessonMaterial(payload(fields)) || null });

  test('지정 순서가 먼저이고 나머지는 최신순이다', () => {
    const sorted = sortLessonsByOrder([
      ordered('old', '2026-01-01T00:00:00Z', {}),
      ordered('new', '2026-02-01T00:00:00Z', {}),
      ordered('second', '2026-01-01T00:00:00Z', { displayOrder: 2 }),
      ordered('first', '2026-03-01T00:00:00Z', { sessionNumber: 1 }),
    ]);
    assert.deepEqual(sorted.map((item) => item.id), ['first', 'second', 'new', 'old']);
  });

  test('원본 배열을 바꾸지 않는다', () => {
    const lessons = [ordered('a', '2026-01-01T00:00:00Z', {}), ordered('b', '2026-02-01T00:00:00Z', {})];
    sortLessonsByOrder(lessons);
    assert.deepEqual(lessons.map((item) => item.id), ['a', 'b']);
  });
});

describe('AI에 보내는 글', () => {
  test('레이아웃 주석과 이미지 데이터를 뺀다', () => {
    const text = getReadableMaterialTextForAi(
      payload({
        markdownContent: '<!--block-layout:{"rowId":"r"}-->\n본문\n\n![그림|md](data:image/png;base64,AAAA)',
      })
    );
    assert.ok(!text.includes('block-layout'));
    assert.ok(!text.includes('base64'));
    assert.ok(text.includes('본문'));
  });

  test('긴 HTML은 줄인다', () => {
    const text = getReadableMaterialTextForAi(payload({ htmlContent: 'a'.repeat(7000) }));
    assert.ok(text.length < 6200);
  });

  test('내용이 없으면 안내문을 준다', () => {
    assert.ok(getReadableMaterialTextForAi(payload()).includes('원문이 없습니다'));
  });
});

describe('교안 보관함', () => {
  test('시스템 이름이나 # 코드로 구분한다', () => {
    assert.equal(isMaterialLibraryClass(MATERIAL_LIBRARY_CLASS_NAME), true);
    assert.equal(isMaterialLibraryClass({ name: '1반', join_code: '#ABCDE' }), true);
    assert.equal(isMaterialLibraryClass({ name: '1반', join_code: 'AB3K9X' }), false);
    assert.equal(isMaterialLibraryClass('1반'), false);
  });
});
