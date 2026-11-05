// 교안 저장 형식 시험: 블록을 마크다운으로 저장했다가 다시 읽어도 교사의 내용이 그대로 남는지 확인합니다.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  blocksToMarkdown,
  createDefaultQuizData,
  markdownToBlocks,
} from '../src/utils/notionBlocks.ts';

let nextId = 0;
const block = (type, fields = {}) => ({ id: `t-${(nextId += 1)}`, type, content: '', ...fields });

// 저장 때마다 새로 만들어지는 id와 값이 없는 필드는 비교에서 뺍니다.
function comparable(blocks) {
  return blocks.map((item) =>
    Object.fromEntries(Object.entries(item).filter(([key, value]) => key !== 'id' && value !== undefined))
  );
}

const reload = (blocks) => markdownToBlocks(blocksToMarkdown(blocks));

function assertRoundTrip(blocks) {
  assert.deepEqual(comparable(reload(blocks)), comparable(blocks));
}

function assertStable(blocks) {
  const first = blocksToMarkdown(blocks);
  const second = blocksToMarkdown(markdownToBlocks(first));
  assert.equal(second, first);
}

describe('블록 종류별 왕복', () => {
  const cases = {
    '제목 1~3': [
      block('h1', { content: '대제목' }),
      block('h2', { content: '중제목' }),
      block('h3', { content: '소제목' }),
    ],
    '여러 줄 제목': [block('h2', { content: '첫 줄\n둘째 줄' })],
    '본문과 줄바꿈': [block('p', { content: '첫 줄\n\n  들여쓴 줄\n끝 공백 ' })],
    '연속된 본문': [block('p', { content: '하나' }), block('p', { content: '둘' })],
    '빈 본문': [block('h1', { content: '제목' }), block('p'), block('p', { content: '끝' })],
    '글머리 단계': [
      block('bullet', { content: '1단계' }),
      block('bullet', { content: '2단계', indentLevel: 1 }),
      block('bullet', { content: '3단계', indentLevel: 2 }),
      block('bullet', { content: '4단계', indentLevel: 3 }),
    ],
    '빈 글머리': [block('bullet')],
    '여러 줄 글머리': [block('bullet', { content: '위\n아래' })],
    콜아웃: [block('callout', { icon: '⚠️', content: '주의\n둘째 줄' })],
    인용구: [block('quote', { content: '인용\n둘째 줄' })],
    구분선: [block('divider')],
    표: [
      block('table', {
        tableRows: [['이름', '값'], ['파이프 | 포함', '줄\n바꿈'], ['', ' 앞 공백']],
        hasTableHeader: true,
      }),
    ],
    '머리글 없는 표': [block('table', { tableRows: [['a', 'b'], ['c', 'd']], hasTableHeader: false })],
    '한 열짜리 표': [block('table', { tableRows: [['하나'], ['둘']], hasTableHeader: true })],
    '크기를 조절한 표': [
      block('table', {
        tableRows: [['a', 'b']],
        hasTableHeader: true,
        tableColWidths: [120, 0],
        tableRowHeights: [40],
      }),
    ],
    코드: [block('code', { language: 'javascript', content: 'if (a) {\n  b();\n}\n' })],
    '코드 안의 마크다운': [block('code', { language: 'text', content: '# 제목 아님\n- 목록 아님\n---' })],
    Colab: [
      block('colab', {
        caption: '정렬 실습',
        externalUrl: 'https://colab.research.google.com/drive/abc',
        content: 'print(1)',
      }),
    ],
    'URL만 있는 Colab': [
      block('colab', {
        caption: '공유 노트북',
        externalUrl: 'https://colab.research.google.com/drive/abc',
      }),
    ],
    VPython: [block('vpython', { caption: '공 튀기기', content: 'ball = sphere()' })],
    '피지컬 컴퓨팅': [block('physical', { caption: 'LED', content: 'from microbit import *' })],
    '데이터 분석': [block('data_analysis', { caption: '평균', content: 'import pandas' })],
    'AI 실습': [block('ai_lab', { caption: '분류', content: 'model.fit()' })],
    순서도: [block('mermaid', { content: 'graph TD\n  A-->B' })],
    시뮬레이션: [
      block('simulation', { caption: '진자 실험: 주기', content: '<div>\n  <canvas></canvas>\n</div>' }),
    ],
    유튜브: [
      block('youtube', {
        caption: '영상',
        externalUrl: 'https://youtu.be/abcdefghijk',
        content: 'https://youtu.be/abcdefghijk',
      }),
    ],
    링크: [
      block('link', { caption: '자료실', externalUrl: 'https://example.com/a?b=c', content: '설명' }),
    ],
    '이미지 한 장': [
      block('image', {
        imageUrl: 'https://example.com/a.png',
        caption: '그림',
        imageSize: 'sm',
        images: [{ url: 'https://example.com/a.png', caption: '그림' }],
      }),
    ],
    '이미지 여러 장': [
      block('image', {
        imageUrl: 'https://example.com/a.png',
        caption: '첫째',
        imageSize: 'md',
        images: [
          { url: 'https://example.com/a.png', caption: '첫째' },
          { url: 'https://example.com/b.png', caption: '둘째' },
        ],
      }),
    ],
    '가로 다단': [
      block('p', { content: '왼쪽', rowId: 'r1', colId: 'c1', widthPercent: 40 }),
      block('h2', { content: '왼쪽 아래', rowId: 'r1', colId: 'c1', widthPercent: 40 }),
      block('code', { language: 'python', rowId: 'r1', colId: 'c2', widthPercent: 60 }),
    ],
    '쌓인 블록 높이': [
      block('p', { content: '위', rowId: 'r1', colId: 'c1', stackHeightPercent: 30 }),
      block('p', { content: '아래', rowId: 'r1', colId: 'c1', stackHeightPercent: 70 }),
      block('p', { content: '옆', rowId: 'r1', colId: 'c2' }),
    ],
    '너비를 줄인 단독 블록': [block('p', { content: '좁게', widthPercent: 60 })],
  };

  for (const [name, blocks] of Object.entries(cases)) {
    test(name, () => {
      assertRoundTrip(blocks);
      assertStable(blocks);
    });
  }

  for (const type of ['multiple_choice', 'ox', 'short_answer']) {
    test(`퀴즈 ${type}`, () => {
      const quizData = { ...createDefaultQuizData(type), explanation: '해설', answerText: '답, 정답' };
      const [loaded] = reload([block('quiz', { content: quizData.questionText, quizData })]);
      assert.equal(loaded.type, 'quiz');
      const expected = type === 'short_answer' ? { ...quizData, options: loaded.quizData.options } : quizData;
      assert.deepEqual(loaded.quizData, expected);
    });
  }
});

describe('본문이 서식처럼 보여도 본문으로 남는다', () => {
  const lookalikes = [
    '# 제목처럼',
    '## 제목처럼',
    '### 제목처럼',
    '- 목록처럼',
    '* 목록처럼',
    '-',
    '*',
    '---',
    '***',
    '> 인용처럼',
    '> [!CALLOUT:💡] 콜아웃처럼',
    '| 표 | 처럼 |',
    '```python',
    '![그림처럼](https://example.com/a.png)',
    '<!--block-layout:{"rowId":"가짜"}-->',
    '&nbsp;',
    '<br>',
    '줄바꿈 태그는 <br> 이렇게 씁니다',
    '<BR/> 대문자',
  ];

  for (const text of lookalikes) {
    test(`본문: ${text}`, () => {
      assertRoundTrip([block('p', { content: text })]);
      assertRoundTrip([block('p', { content: `앞줄\n${text}\n뒷줄` })]);
    });
  }

  for (const type of ['h1', 'h2', 'h3', 'bullet', 'quote']) {
    test(`${type}에 쓴 <br> 글자`, () => {
      assertRoundTrip([block(type, { content: '<br> 태그 설명' })]);
    });
  }

  test('콜아웃처럼 보이는 인용구', () => {
    assertRoundTrip([block('quote', { content: '[!CALLOUT:💡] 인용입니다' })]);
  });

  test('표 칸에 쓴 <br> 글자', () => {
    assertRoundTrip([
      block('table', { tableRows: [['<br> 태그', '설명']], hasTableHeader: true }),
    ]);
  });
});

describe('이미지가 사라지지 않는다', () => {
  const imageBlock = (url, caption = '그림') =>
    block('image', { imageUrl: url, caption, imageSize: 'md', images: [{ url, caption }] });

  test('주소에 괄호가 있는 이미지', () => {
    const [loaded] = reload([imageBlock('https://example.com/a_(1).png')]);
    assert.equal(loaded.type, 'image');
    assert.equal(new URL(loaded.imageUrl).pathname, '/a_%281%29.png');
  });

  test('여러 장 중 주소에 괄호가 있는 이미지', () => {
    const urls = ['https://example.com/a_(1).png', 'https://example.com/b.png'];
    const [loaded] = reload([
      block('image', {
        imageUrl: urls[0],
        imageSize: 'md',
        images: urls.map((url) => ({ url, caption: '' })),
      }),
    ]);
    assert.equal(loaded.images.length, 2);
  });

  test('캡션에 줄바꿈이 있는 이미지', () => {
    const loaded = reload([imageBlock('https://example.com/a.png', '첫 줄\n둘째 줄')]);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].type, 'image');
    assert.equal(loaded[0].imageUrl, 'https://example.com/a.png');
  });

  test('base64 이미지 주소는 바꾸지 않는다', () => {
    const url = 'data:image/png;base64,iVBORw0KGgo+/=';
    assert.equal(reload([imageBlock(url)])[0].imageUrl, url);
  });
});

describe('입력 호환', () => {
  test('빈 교안은 빈 제목과 본문으로 시작한다', () => {
    assert.deepEqual(markdownToBlocks('').map((b) => b.type), ['h1', 'p']);
    assert.deepEqual(markdownToBlocks('  \n ').map((b) => b.type), ['h1', 'p']);
    assert.equal(blocksToMarkdown(markdownToBlocks('')), '');
  });

  test('윈도우 줄바꿈 문서를 읽는다', () => {
    const blocks = markdownToBlocks('# 제목\r\n\r\n첫 줄\r\n둘째 줄\r\n\r\n```python\r\nprint(1)\r\n```\r\n');
    assert.deepEqual(comparable(blocks), [
      { type: 'h1', content: '제목' },
      { type: 'p', content: '첫 줄\n둘째 줄' },
      { type: 'code', content: 'print(1)', language: 'python' },
    ]);
  });

  test('닫히지 않은 코드 블록은 끝까지 코드로 읽는다', () => {
    const blocks = markdownToBlocks('```python\nprint(1)\n\nprint(2)');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].content, 'print(1)\n\nprint(2)');
  });

  test('예전 별칭 펜스를 읽는다', () => {
    const headers = ['pyrun:가', 'glowscript:나', 'html-sim:다', 'microbit:라', 'arduino:마', 'pico:바', 'data_analysis:사', 'ai_lab:아', 'yt:자', 'bookmark:차'];
    const types = markdownToBlocks(headers.map((header) => `\`\`\`${header}\nx\n\`\`\``).join('\n\n')).map((b) => b.type);
    assert.deepEqual(types, ['colab', 'vpython', 'simulation', 'physical', 'physical', 'physical', 'data_analysis', 'ai_lab', 'youtube', 'link']);
  });

  test('코드 언어 약칭과 모르는 언어', () => {
    const languages = markdownToBlocks('```js\na\n```\n\n```ts\nb\n```\n\n```py\nc\n```\n\n```bash\nd\n```').map(
      (b) => b.language
    );
    assert.deepEqual(languages, ['javascript', 'typescript', 'python', 'python']);
  });

  test('공백 들여쓰기로 쓴 하위 목록을 읽는다', () => {
    const levels = markdownToBlocks('- a\n  - b\n\t\t- c\n        - d').map((b) => b.indentLevel ?? 0);
    assert.deepEqual(levels, [0, 1, 2, 3]);
  });

  test('구분줄이 없는 표와 칸 수가 다른 표', () => {
    const [table] = markdownToBlocks('| a | b | c |\n| d |');
    assert.deepEqual(table.tableRows, [['a', 'b', 'c'], ['d', '', '']]);
  });

  test('잘못된 레이아웃 주석은 다음 블록에 영향을 주지 않는다', () => {
    const blocks = markdownToBlocks('<!--block-layout:{깨짐-->\n# 제목');
    assert.deepEqual(comparable(blocks), [{ type: 'h1', content: '제목' }]);
  });

  test('레이아웃 값은 허용 범위로 맞춘다', () => {
    const [b] = markdownToBlocks(
      '<!--block-layout:{"widthPercent":999,"stackHeightPercent":1,"indentLevel":9,"tableColWidths":[1,"x",9999]}-->\n| a | b |'
    );
    assert.equal(b.widthPercent, 100);
    assert.equal(b.stackHeightPercent, 15);
    assert.equal(b.indentLevel, 3);
    assert.deepEqual(b.tableColWidths, [48, 0, 1200]);
  });

  test('읽을 이미지가 없는 묶음은 다음 블록의 레이아웃을 가로채지 않는다', () => {
    const blocks = markdownToBlocks('<!--block-layout:{"widthPercent":50}-->\n```image-row:md\n잘못된 줄\n```\n\n본문');
    assert.deepEqual(comparable(blocks), [{ type: 'p', content: '본문' }]);
  });
});

describe('아직 고치지 않은 문제', () => {
  // 고치려면 펜스 형식과 DB의 scan_quiz_blocks를 함께 바꿔야 해서 결정이 필요합니다.
  test('코드 안의 ``` 줄 뒤 내용이 코드 블록 밖으로 밀려난다', { todo: '저장 형식 변경 필요' }, () => {
    assertRoundTrip([block('code', { language: 'text', content: '```python\nprint(1)\n```\n끝' })]);
  });
});

describe('학생용 퀴즈', () => {
  test('정답을 지운 한 줄 JSON을 읽어도 문항 id와 보기가 유지된다', () => {
    const markdown =
      '```quiz\n{"quizId":"iq_1","options":["가","나","다"],"questionText":"문제","questionType":"multiple_choice","targetConcept":"개념"}\n```';
    const [quiz] = markdownToBlocks(markdown);
    assert.equal(quiz.quizData.quizId, 'iq_1');
    assert.deepEqual(quiz.quizData.options, ['가', '나', '다']);
    assert.equal(quiz.quizData.answerText, '');
  });

  test('깨진 퀴즈 JSON에서도 멈추지 않는다', () => {
    assert.equal(markdownToBlocks('```quiz\n{깨짐\n```')[0].type, 'quiz');
    assert.equal(markdownToBlocks('```quiz\nnull\n```')[0].type, 'quiz');
  });
});

// 시드를 고정해 실패가 재현되도록 합니다.
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('무작위 교안', () => {
  const pieces = [
    '가나다', 'abc', ' ', '  ', '\t', '\n', '\n\n', '#', '# ', '## ', '- ', '-', '* ', '*', '> ', '>', '|', '| a |',
    '---', '***', '<br>', '<br/>', '&nbsp;', '![', '](', ')', '[!CALLOUT:💡]', '<!--', '-->', '\\', '\\|', '`', '``', '💡',
  ];
  const textOf = (next) => {
    let text = '';
    const count = Math.floor(next() * 6);
    for (let i = 0; i < count; i += 1) text += pieces[Math.floor(next() * pieces.length)];
    return text;
  };
  const makers = {
    p: (next) => block('p', { content: textOf(next) }),
    bullet: (next) => block('bullet', { content: textOf(next) }),
    table: (next) =>
      block('table', {
        hasTableHeader: next() > 0.5,
        tableRows: Array.from({ length: 1 + Math.floor(next() * 3) }, () => [textOf(next), textOf(next)]),
      }),
    code: (next) => block('code', { language: 'python', content: `x${textOf(next)}` }),
    callout: (next) => block('callout', { icon: '💡', content: `글${textOf(next)}` }),
  };
  for (const type of ['h1', 'h2', 'h3', 'quote']) {
    makers[type] = (next) => block(type, { content: `글${textOf(next)}` });
  }

  test('3000개 교안이 왕복해도 같다', () => {
    const types = Object.keys(makers);
    for (let seed = 1; seed <= 3000; seed += 1) {
      const next = random(seed);
      const blocks = Array.from({ length: 1 + Math.floor(next() * 6) }, () =>
        makers[types[Math.floor(next() * types.length)]](next)
      );
      if (blocks.every((b) => b.type === 'p' && !b.content)) continue;
      try {
        assertRoundTrip(blocks);
        assertStable(blocks);
      } catch (error) {
        error.message = `seed ${seed}: ${JSON.stringify(comparable(blocks))}\n${error.message}`;
        throw error;
      }
    }
  });
});
