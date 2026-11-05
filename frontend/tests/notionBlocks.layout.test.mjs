// 다단 배치, 코드 들여쓰기, 외부 주소 처리 시험입니다.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  applyCodeTabIndentation,
  cleanupOrphanRowIds,
  createDefaultQuizData,
  createDefaultTableRows,
  extractYouTubeVideoId,
  getBlockImages,
  getBulletMarkerMeta,
  getNormalizedColumnWidths,
  getNormalizedRowWidths,
  getNormalizedStackHeights,
  groupBlocksIntoRows,
  normalizeExternalUrl,
} from '../src/utils/notionBlocks.ts';

const block = (id, fields = {}) => ({ id, type: 'p', content: id, ...fields });
const sum = (values) => values.reduce((total, value) => total + value, 0);

describe('다단 묶기', () => {
  test('같은 행과 열의 블록을 묶는다', () => {
    const [row, single] = groupBlocksIntoRows([
      block('a', { rowId: 'r', colId: 'c1' }),
      block('b', { rowId: 'r', colId: 'c1' }),
      block('c', { rowId: 'r', colId: 'c2' }),
      block('d'),
    ]);
    assert.deepEqual(row.columns.map((column) => column.items.map((item) => item.block.id)), [['a', 'b'], ['c']]);
    assert.equal(single.rowId, null);
  });

  test('다섯째 열은 새 행으로 넘긴다', () => {
    const groups = groupBlocksIntoRows(
      ['a', 'b', 'c', 'd', 'e'].map((id) => block(id, { rowId: 'r', colId: id }))
    );
    assert.deepEqual(groups.map((group) => group.columns.length), [4, 1]);
  });

  test('떨어져 있는 같은 행 번호는 합치지 않는다', () => {
    const groups = groupBlocksIntoRows([
      block('a', { rowId: 'r', colId: 'c1' }),
      block('b'),
      block('c', { rowId: 'r', colId: 'c2' }),
    ]);
    assert.equal(groups.length, 3);
  });

  test('열 번호가 없으면 블록마다 다른 열이 된다', () => {
    const [row] = groupBlocksIntoRows([block('a', { rowId: 'r' }), block('b', { rowId: 'r' })]);
    assert.equal(row.columns.length, 2);
  });
});

describe('고아 행 정리', () => {
  test('열이 하나만 남은 행은 일반 블록으로 되돌린다', () => {
    const [left] = cleanupOrphanRowIds([
      block('a', { rowId: 'r', colId: 'c1', widthPercent: 50, stackHeightPercent: 40 }),
    ]);
    assert.equal(left.rowId, undefined);
    assert.equal(left.colId, undefined);
    assert.equal(left.stackHeightPercent, undefined);
    assert.equal(left.widthPercent, undefined);
  });

  test('흩어진 같은 열 블록을 모은다', () => {
    const result = cleanupOrphanRowIds([
      block('a', { rowId: 'r', colId: 'c1' }),
      block('b', { rowId: 'r', colId: 'c2' }),
      block('c', { rowId: 'r', colId: 'c1' }),
    ]);
    assert.deepEqual(result.map((b) => b.id), ['a', 'c', 'b']);
  });

  test('혼자 남은 열 블록의 높이 비율을 지운다', () => {
    const result = cleanupOrphanRowIds([
      block('a', { rowId: 'r', colId: 'c1', stackHeightPercent: 30 }),
      block('b', { rowId: 'r', colId: 'c2' }),
    ]);
    assert.equal(result[0].stackHeightPercent, undefined);
    assert.equal(result[0].rowId, 'r');
  });

  test('블록을 잃지 않고 두 번 정리해도 같다', () => {
    const blocks = [
      block('a', { rowId: 'r', colId: 'c1' }),
      block('b', { rowId: 'r', colId: 'c2' }),
      block('c'),
      block('d', { rowId: 's', colId: 'c3' }),
    ];
    const once = cleanupOrphanRowIds(blocks);
    assert.equal(once.length, blocks.length);
    assert.deepEqual(cleanupOrphanRowIds(once), once);
  });
});

describe('너비와 높이 정규화', () => {
  const asItems = (values, key) => values.map((value) => ({ block: block('x', { [key]: value }) }));
  const asColumns = (values) => values.map((widthPercent) => ({ colId: 'c', items: [], widthPercent }));

  const samples = [
    [50, 50],
    [30, 30, 40],
    [25, 25, 25, 25],
    [70, 15, 15],
    [85, 15, 15, 15],
    [70, 15, 15, 15],
    [15, 15, 15, 85],
    [undefined, 60],
    [10, 90],
  ];

  for (const values of samples) {
    test(`합이 100이고 최소 비율을 지킨다: ${values.join(', ')}`, () => {
      for (const result of [
        getNormalizedRowWidths(asItems(values, 'widthPercent')),
        getNormalizedColumnWidths(asColumns(values)),
        getNormalizedStackHeights(asItems(values, 'stackHeightPercent')),
      ]) {
        assert.equal(sum(result), 100);
        assert.ok(result.every((value) => value >= 15), result.join(', '));
      }
    });
  }

  test('단독 블록 너비는 25~100으로 맞춘다', () => {
    assert.deepEqual(getNormalizedRowWidths(asItems([10], 'widthPercent')), [25]);
    assert.deepEqual(getNormalizedRowWidths(asItems([undefined], 'widthPercent')), [100]);
    assert.deepEqual(getNormalizedColumnWidths(asColumns([120])), [100]);
  });

  test('빈 입력', () => {
    assert.deepEqual(getNormalizedRowWidths([]), []);
    assert.deepEqual(getNormalizedColumnWidths([]), []);
    assert.deepEqual(getNormalizedStackHeights([]), []);
  });
});

describe('코드 들여쓰기', () => {
  test('커서 위치에 공백을 넣는다', () => {
    assert.deepEqual(applyCodeTabIndentation('ab', 1, 1, false), { newValue: 'a    b', newStart: 5, newEnd: 5 });
  });

  test('선택한 모든 줄을 들여쓰고 선택을 유지한다', () => {
    const result = applyCodeTabIndentation('a\nb\nc', 0, 3, false);
    assert.equal(result.newValue, '    a\n    b\nc');
    assert.equal(result.newValue.slice(result.newStart, result.newEnd), '    a\n    b');
  });

  test('선택 끝이 줄 맨 앞이면 그 줄은 들여쓰지 않는다', () => {
    assert.equal(applyCodeTabIndentation('a\nb', 0, 2, false).newValue, '    a\nb');
  });

  test('내어쓰기는 최대 4칸 또는 탭 하나만 지운다', () => {
    assert.equal(applyCodeTabIndentation('      a\n\tb\nc', 0, 11, true).newValue, '  a\nb\nc');
  });

  test('선택 없이 내어쓰면 커서가 줄 안에 남는다', () => {
    assert.deepEqual(applyCodeTabIndentation('    ab', 6, 6, true), { newValue: 'ab', newStart: 2, newEnd: 2 });
  });

  test('거꾸로 선택해도 같은 결과', () => {
    assert.deepEqual(applyCodeTabIndentation('a\nb', 3, 0, false), applyCodeTabIndentation('a\nb', 0, 3, false));
  });
});

describe('유튜브 주소', () => {
  const id = 'dQw4w9WgXcQ';
  const inputs = [
    id,
    `https://www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?list=abc&v=${id}&t=10`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `<iframe width="560" src="https://www.youtube.com/embed/${id}"></iframe>`,
  ];
  for (const input of inputs) {
    test(input.slice(0, 50), () => assert.equal(extractYouTubeVideoId(input), id));
  }

  test('영상 주소가 아니면 null', () => {
    assert.equal(extractYouTubeVideoId(''), null);
    assert.equal(extractYouTubeVideoId('https://example.com/video'), null);
  });
});

describe('외부 주소 보정', () => {
  test('프로토콜이 없으면 https를 붙인다', () => {
    assert.equal(normalizeExternalUrl(' example.com/a '), 'https://example.com/a');
    assert.equal(normalizeExternalUrl(''), '');
  });

  test('허용된 프로토콜은 그대로 둔다', () => {
    for (const url of ['http://a.kr', 'HTTPS://a.kr', 'mailto:a@example.com', 'tel:010']) {
      assert.equal(normalizeExternalUrl(url), url);
    }
  });

  test('실행 주소는 링크로 실행되지 않는 형태가 된다', () => {
    assert.ok(normalizeExternalUrl('javascript:alert(1)').startsWith('https://'));
  });
});

describe('기본값', () => {
  test('글머리 단계는 0~3으로 맞춘다', () => {
    assert.equal(getBulletMarkerMeta(-1).level, 0);
    assert.equal(getBulletMarkerMeta(9).level, 3);
    assert.deepEqual([0, 1, 2, 3].map((level) => getBulletMarkerMeta(level).symbol), ['•', '○', '▪', '▫']);
  });

  test('기본 표는 첫 행만 채운다', () => {
    assert.deepEqual(createDefaultTableRows(2, 2), [['항목 1', '항목 2'], ['', '']]);
  });

  test('문항 유형별 기본 퀴즈', () => {
    assert.equal(createDefaultQuizData('ox').options.length, 2);
    assert.equal(createDefaultQuizData('short_answer').options.length, 0);
    assert.equal(createDefaultQuizData().options.length, 4);
  });

  test('예전 단일 이미지 필드를 읽는다', () => {
    assert.deepEqual(getBlockImages(block('a', { imageUrl: 'u', caption: 'c' })), [{ url: 'u', caption: 'c' }]);
    assert.deepEqual(getBlockImages(block('a', { images: [{ url: '' }, { url: 'u' }] })), [{ url: 'u' }]);
    assert.deepEqual(getBlockImages(block('a')), []);
  });
});
