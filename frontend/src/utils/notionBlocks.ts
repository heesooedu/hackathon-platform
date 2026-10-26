import { QuizQuestionType } from '@/types/database.types';

export type NotionBlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'p'
  | 'bullet'
  | 'callout'
  | 'quote'
  | 'table'
  | 'code'
  | 'colab'
  | 'vpython'
  | 'mermaid'
  | 'simulation'
  | 'quiz'
  | 'image'
  | 'divider';

export type ImageSizeOption = 'sm' | 'md' | 'full';

export interface NotionImageItem {
  url: string;
  caption?: string;
}

export interface InlineQuizBlockData {
  quizId: string;
  questionType: QuizQuestionType;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  answerText: string;
  explanation: string;
  targetConcept: string;
}

export type CodeLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'html'
  | 'css'
  | 'sql'
  | 'c'
  | 'cpp'
  | 'java'
  | 'text';

export interface NotionBlock {
  id: string;
  type: NotionBlockType;
  content: string;
  icon?: string; // callout 아이콘 (예: 💡, 📌, ⚠️)
  language?: CodeLanguage; // code 블록의 프로그래밍 언어 (기본값: 'python')
  imageUrl?: string; // 단일 image 블록의 data URL 또는 외부 URL (하위 호환)
  caption?: string; // 단일 image, simulation, colab, vpython 블록의 제목/캡션
  externalUrl?: string; // colab 노트북 공유 URL 또는 glowscript/trinket 외부 공유 링크
  imageSize?: ImageSizeOption;
  images?: NotionImageItem[]; // 가로 다단(여러 장) 이미지 배열
  tableRows?: string[][]; // 표(table) 블록의 2차원 셀 배열 (행 x 열)
  hasTableHeader?: boolean; // 표 첫 행 머리글 여부 (기본 true)
  quizData?: InlineQuizBlockData; // 인라인 체크포인트 퀴즈 블록 데이터
  rowId?: string; // 같은 rowId를 공유하는 인접 블록들은 가로 다단(Side-by-Side Row)으로 나란히 조립됨
  widthPercent?: number; // 블록의 가로 너비 비율 (18~100%, 다단 행 내에서는 열 너비 비중, 단독 블록에서는 가로 폭 %)
}

export interface NotionBlockRowGroup {
  rowId: string | null;
  items: { block: NotionBlock; index: number }[];
}

export function createBlockId(): string {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createRowId(): string {
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 연속된 블록 중 같은 rowId를 가진 블록들을 하나의 가로 다단 행(Row Group, 최대 4열)으로 묶어 반환합니다.
 */
export function groupBlocksIntoRows(blocks: NotionBlock[]): NotionBlockRowGroup[] {
  const groups: NotionBlockRowGroup[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const rId = b.rowId?.trim() || null;
    if (
      rId &&
      groups.length > 0 &&
      groups[groups.length - 1].rowId === rId &&
      groups[groups.length - 1].items.length < 4
    ) {
      groups[groups.length - 1].items.push({ block: b, index: i });
    } else {
      groups.push({
        rowId: rId,
        items: [{ block: b, index: i }],
      });
    }
  }
  return groups;
}

/**
 * 한 행(Row Group) 내부 블록들의 가로 너비 비율(%)을 합계 100%가 되도록 정규화하여 반환합니다.
 */
export function getNormalizedRowWidths(
  items: { block: NotionBlock }[]
): number[] {
  const n = items.length;
  if (n === 0) return [];
  if (n === 1) {
    const w = items[0].block.widthPercent;
    return [
      typeof w === 'number' && Number.isFinite(w)
        ? Math.min(100, Math.max(25, Math.round(w)))
        : 100,
    ];
  }

  const rawWeights = items.map((it) => {
    const w = it.block.widthPercent;
    return typeof w === 'number' && Number.isFinite(w) && w >= 15
      ? w
      : 100 / n;
  });
  const total = rawWeights.reduce((acc, v) => acc + v, 0) || 100;
  const normalized = rawWeights.map((w) =>
    Math.max(15, Math.round((w / total) * 100))
  );
  const sumExceptLast = normalized
    .slice(0, n - 1)
    .reduce((acc, v) => acc + v, 0);
  normalized[n - 1] = Math.max(15, 100 - sumExceptLast);
  return normalized;
}

/**
 * 블록 삭제·이동·분리 후 혼자 남은(인접 블록과 rowId를 공유하지 않는) 고아 rowId를 정리합니다.
 */
export function cleanupOrphanRowIds(blocks: NotionBlock[]): NotionBlock[] {
  return blocks.map((b, idx) => {
    const rId = b.rowId?.trim();
    if (!rId) return b;
    const prevSame = idx > 0 && blocks[idx - 1].rowId?.trim() === rId;
    const nextSame =
      idx < blocks.length - 1 && blocks[idx + 1].rowId?.trim() === rId;
    if (!prevSame && !nextSame) {
      const nextBlock: NotionBlock = { ...b, rowId: undefined };
      // 다단 행에서 50% 등으로 분할되어 있던 폭은 단독 블록으로 돌아올 때 100%로 복원
      if (typeof nextBlock.widthPercent === 'number' && nextBlock.widthPercent <= 85) {
        delete nextBlock.widthPercent;
      }
      return nextBlock;
    }
    return b;
  });
}

export function createInlineQuizId(): string {
  return `iq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createDefaultQuizData(
  questionType: QuizQuestionType = 'multiple_choice'
): InlineQuizBlockData {
  if (questionType === 'ox') {
    return {
      quizId: createInlineQuizId(),
      questionType: 'ox',
      questionText: '위 개념 설명에 따르면, 조건이 참일 때만 블록 내부의 코드가 실행된다.',
      options: ['O (맞다)', 'X (틀리다)'],
      correctOptionIndex: 0,
      answerText: '',
      explanation: '조건문의 조건식이 참(True)일 때만 들여쓰기된 블록이 실행됩니다.',
      targetConcept: '핵심 개념 OX 확인',
    };
  }
  if (questionType === 'short_answer') {
    return {
      quizId: createInlineQuizId(),
      questionType: 'short_answer',
      questionText: '위 예시에서 출력되는 최종 결과값(또는 핵심 키워드)을 적어보세요.',
      options: [],
      correctOptionIndex: 0,
      answerText: '정답키워드',
      explanation: '위 개념의 핵심 원리에 따라 도출되는 결과입니다.',
      targetConcept: '핵심 키워드 / 출력값 확인',
    };
  }
  return {
    quizId: createInlineQuizId(),
    questionType: 'multiple_choice',
    questionText: '방금 학습한 내용에서 가장 핵심이 되는 원리로 올바른 것은?',
    options: [
      '핵심 원리가 적용된 올바른 설명입니다.',
      '자주 헷갈리기 쉬운 오개념 선지 1입니다.',
      '자주 헷갈리기 쉬운 오개념 선지 2입니다.',
      '조건이 반대로 설명된 오개념 선지 3입니다.',
    ],
    correctOptionIndex: 0,
    answerText: '',
    explanation: '1번 선지가 방금 다룬 핵심 개념의 정확한 설명입니다.',
    targetConcept: '핵심 개념 점검',
  };
}

export function getBlockImages(block: NotionBlock): NotionImageItem[] {
  if (block.images && block.images.length > 0) {
    return block.images.filter((img) => Boolean(img.url));
  }
  if (block.imageUrl) {
    return [{ url: block.imageUrl, caption: block.caption || '' }];
  }
  return [];
}

export function createDefaultTableRows(rows = 3, cols = 3): string[][] {
  return Array.from({ length: rows }, (_, rIdx) =>
    Array.from({ length: cols }, (__, cIdx) =>
      rIdx === 0 ? `항목 ${cIdx + 1}` : ''
    )
  );
}

function encodeInlineNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
}

function decodeInlineNewlines(text: string): string {
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/\u200B/g, '');
}

function isEmptyBlockToken(trimmedLine: string): boolean {
  return (
    trimmedLine === '<br>' ||
    trimmedLine === '<br/>' ||
    trimmedLine === '<br />' ||
    trimmedLine === '&nbsp;'
  );
}

function isTableLine(trimmedLine: string): boolean {
  return (
    trimmedLine.length >= 2 &&
    trimmedLine.startsWith('|') &&
    trimmedLine.endsWith('|')
  );
}

function isTableSeparatorCells(cells: string[]): boolean {
  return (
    cells.length > 0 &&
    cells.every((c) => /^:?-{2,}:?$/.test(c.trim()))
  );
}

function parseTableRowCells(trimmedLine: string): string[] {
  const inner = trimmedLine.slice(1, -1);
  const rawCells = inner.split(/(?<!\\)\|/);
  return rawCells.map((cell) =>
    decodeInlineNewlines(cell.trim().replace(/\\\|/g, '|'))
  );
}

function isSpecialBlockLine(trimmedLine: string): boolean {
  if (!trimmedLine) return true;
  if (isEmptyBlockToken(trimmedLine)) return true;
  if (trimmedLine.startsWith('<!--block-layout:') && trimmedLine.endsWith('-->')) {
    return true;
  }
  if (isTableLine(trimmedLine)) return true;
  if (trimmedLine.startsWith('```')) return true;
  if (trimmedLine === '---' || trimmedLine === '***') return true;
  if (/^!\[([^\]]*)\]\(([^)]+)\)$/.test(trimmedLine)) return true;
  if (
    trimmedLine.startsWith('# ') ||
    trimmedLine.startsWith('## ') ||
    trimmedLine.startsWith('### ')
  ) {
    return true;
  }
  if (/^>\s*\[!CALLOUT:([^\]]+)\]\s*(.*)$/.test(trimmedLine)) return true;
  if (trimmedLine.startsWith('> ')) return true;
  if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) return true;
  return false;
}

/**
 * 마크다운 문자열을 노션 스타일 블록 배열(NotionBlock[])로 변환합니다.
 * 워드(.docx)나 한글(.hwp/.hwpx)에서 추출된 마크다운, 코드블록(```python ... ```),
 * Mermaid 다이어그램(```mermaid ... ```)도 즉시 노션 블록들로 변환됩니다.
 */
export function markdownToBlocks(markdown: string): NotionBlock[] {
  if (!markdown || !markdown.trim()) {
    return [
      {
        id: createBlockId(),
        type: 'h1',
        content: '',
      },
      {
        id: createBlockId(),
        type: 'p',
        content: '',
      },
    ];
  }

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: NotionBlock[] = [];
  let pendingLayout: { rowId?: string; widthPercent?: number } | null = null;
  let prevBlocksLen = 0;

  const applyPendingLayoutIfAny = () => {
    if (blocks.length > prevBlocksLen) {
      if (pendingLayout) {
        for (let bIdx = prevBlocksLen; bIdx < blocks.length; bIdx++) {
          if (pendingLayout.rowId) {
            blocks[bIdx].rowId = pendingLayout.rowId;
          }
          if (typeof pendingLayout.widthPercent === 'number') {
            blocks[bIdx].widthPercent = pendingLayout.widthPercent;
          }
        }
        pendingLayout = null;
      }
      prevBlocksLen = blocks.length;
    }
  };

  let i = 0;
  while (i < lines.length) {
    applyPendingLayoutIfAny();

    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // 0-0. 블록 가로 다단 조립 및 가로 폭 레이아웃 메타데이터 주석 (<!--block-layout:{"rowId":"...","widthPercent":50}-->)
    if (line.startsWith('<!--block-layout:') && line.endsWith('-->')) {
      const jsonStr = line.slice('<!--block-layout:'.length, -3).trim();
      try {
        const parsedLayout = JSON.parse(jsonStr) as {
          rowId?: unknown;
          widthPercent?: unknown;
        };
        if (parsedLayout && typeof parsedLayout === 'object') {
          pendingLayout = {
            rowId:
              typeof parsedLayout.rowId === 'string' &&
              parsedLayout.rowId.trim()
                ? parsedLayout.rowId.trim()
                : undefined,
            widthPercent:
              typeof parsedLayout.widthPercent === 'number' &&
              Number.isFinite(parsedLayout.widthPercent)
                ? Math.min(
                    100,
                    Math.max(15, Math.round(parsedLayout.widthPercent))
                  )
                : undefined,
          };
        }
      } catch {
        // 잘못된 형식의 레이아웃 주석은 무시
      }
      i++;
      continue;
    }

    // 0-a. 명시적 빈 블록 (<br>, &nbsp;)
    if (isEmptyBlockToken(line)) {
      blocks.push({
        id: createBlockId(),
        type: 'p',
        content: '',
      });
      i++;
      continue;
    }

    // 0-b. 멀티라인 펜스 코드블록 (```python ... ```, ```mermaid ... ```, ```simulation:제목 ... ```)
    if (line.startsWith('```')) {
      const fenceHeader = line.slice(3).trim();
      const langRaw = fenceHeader.toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      // 닫는 ``` 스킵
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++;
      }

      if (langRaw === 'mermaid') {
        blocks.push({
          id: createBlockId(),
          type: 'mermaid',
          content: codeLines.join('\n'),
        });
      } else if (
        langRaw === 'image-row' ||
        langRaw.startsWith('image-row:')
      ) {
        const colonIdx = fenceHeader.indexOf(':');
        const rawSize =
          colonIdx !== -1 ? fenceHeader.slice(colonIdx + 1).trim() : 'full';
        const rowSize: ImageSizeOption =
          rawSize === 'sm' || rawSize === 'md' || rawSize === 'full'
            ? rawSize
            : 'full';
        const parsedImages: NotionImageItem[] = [];
        for (const cLine of codeLines) {
          const m = cLine.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
          if (m && m[2]) {
            parsedImages.push({
              caption: decodeInlineNewlines(m[1] || ''),
              url: m[2],
            });
          }
        }
        if (parsedImages.length > 0) {
          blocks.push({
            id: createBlockId(),
            type: 'image',
            content: '',
            imageUrl: parsedImages[0].url,
            caption: parsedImages[0].caption || '',
            imageSize: rowSize,
            images: parsedImages,
          });
        }
      } else if (
        langRaw === 'colab' ||
        langRaw.startsWith('colab:') ||
        langRaw === 'pyrun' ||
        langRaw.startsWith('pyrun:')
      ) {
        const colonIdx = fenceHeader.indexOf(':');
        const metaPart =
          colonIdx !== -1 ? fenceHeader.slice(colonIdx + 1).trim() : '';
        const [rawCaption, rawUrl] = metaPart.split('|');
        blocks.push({
          id: createBlockId(),
          type: 'colab',
          caption: (rawCaption || '').trim() || '파이썬 실습 셀 (Colab)',
          externalUrl: (rawUrl || '').trim() || undefined,
          content: codeLines.join('\n'),
        });
      } else if (
        langRaw === 'vpython' ||
        langRaw.startsWith('vpython:') ||
        langRaw === 'glowscript' ||
        langRaw.startsWith('glowscript:')
      ) {
        const colonIdx = fenceHeader.indexOf(':');
        const metaPart =
          colonIdx !== -1 ? fenceHeader.slice(colonIdx + 1).trim() : '';
        const [rawCaption, rawUrl] = metaPart.split('|');
        const rawCodeContent = codeLines.join('\n');
        const isLegacyEarthMoon =
          rawCodeContent.includes('texture=textures.earth') &&
          rawCodeContent.includes('moon = sphere(pos=vector(4.5, 0, 0)');
        const cleanedCaption = (rawCaption || '').trim();
        blocks.push({
          id: createBlockId(),
          type: 'vpython',
          caption:
            cleanedCaption === '지구와 달의 3D 중력 공전 시뮬레이션' ||
            cleanedCaption === 'Web VPython (GlowScript) 3D 시뮬레이션'
              ? ''
              : cleanedCaption,
          externalUrl: (rawUrl || '').trim() || undefined,
          content: isLegacyEarthMoon ? '' : rawCodeContent,
        });
      } else if (
        langRaw === 'simulation' ||
        langRaw.startsWith('simulation:') ||
        langRaw === 'html-sim' ||
        langRaw.startsWith('html-sim:')
      ) {
        const colonIdx = fenceHeader.indexOf(':');
        const simCaption =
          colonIdx !== -1 ? fenceHeader.slice(colonIdx + 1).trim() : '';
        blocks.push({
          id: createBlockId(),
          type: 'simulation',
          caption: simCaption || '인터랙티브 실험 시뮬레이션',
          content: codeLines.join('\n'),
        });
      } else if (langRaw === 'quiz' || langRaw.startsWith('quiz:')) {
        const rawJson = codeLines.join('\n').trim();
        let quizData = createDefaultQuizData('multiple_choice');
        try {
          const parsed = JSON.parse(rawJson) as Partial<InlineQuizBlockData>;
          const qType: QuizQuestionType =
            parsed.questionType === 'ox' ||
            parsed.questionType === 'short_answer' ||
            parsed.questionType === 'multiple_choice'
              ? parsed.questionType
              : 'multiple_choice';

          quizData = {
            quizId: parsed.quizId || createInlineQuizId(),
            questionType: qType,
            questionText:
              parsed.questionText || '방금 학습한 핵심 개념을 확인해 볼까요?',
            options:
              qType === 'ox'
                ? ['O (맞다)', 'X (틀리다)']
                : Array.isArray(parsed.options) && parsed.options.length >= 2
                ? parsed.options
                : ['보기 1', '보기 2', '보기 3', '보기 4'],
            correctOptionIndex:
              typeof parsed.correctOptionIndex === 'number'
                ? parsed.correctOptionIndex
                : 0,
            answerText: parsed.answerText || '',
            explanation: parsed.explanation || '정답 해설입니다.',
            targetConcept: parsed.targetConcept || '핵심 개념 점검',
          };
        } catch {
          // JSON 파싱 실패 시 기본 퀴즈 데이터 유지
        }
        blocks.push({
          id: createBlockId(),
          type: 'quiz',
          content: quizData.questionText,
          quizData,
        });
      } else {
        const supportedLangs: CodeLanguage[] = [
          'python',
          'javascript',
          'typescript',
          'html',
          'css',
          'sql',
          'c',
          'cpp',
          'java',
          'text',
        ];
        const normalizedLang: CodeLanguage = supportedLangs.includes(
          langRaw as CodeLanguage
        )
          ? (langRaw as CodeLanguage)
          : langRaw === 'py'
          ? 'python'
          : langRaw === 'js'
          ? 'javascript'
          : langRaw === 'ts'
          ? 'typescript'
          : 'python';

        blocks.push({
          id: createBlockId(),
          type: 'code',
          language: normalizedLang,
          content: codeLines.join('\n'),
        });
      }
      continue;
    }

    // 1. 구분선
    if (line === '---' || line === '***') {
      blocks.push({
        id: createBlockId(),
        type: 'divider',
        content: '',
      });
      i++;
      continue;
    }

    // 2. 이미지 블록: ![caption|size](url) 또는 ![caption](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const rawAlt = imgMatch[1] || '';
      const url = imgMatch[2] || '';
      let caption = rawAlt;
      let imageSize: ImageSizeOption = 'md';

      if (rawAlt.endsWith('|sm')) {
        caption = rawAlt.slice(0, -3);
        imageSize = 'sm';
      } else if (rawAlt.endsWith('|md')) {
        caption = rawAlt.slice(0, -3);
        imageSize = 'md';
      } else if (rawAlt.endsWith('|full')) {
        caption = rawAlt.slice(0, -5);
        imageSize = 'full';
      }

      blocks.push({
        id: createBlockId(),
        type: 'image',
        content: '',
        imageUrl: url,
        caption,
        imageSize,
        images: [{ url, caption }],
      });
      i++;
      continue;
    }

    // 2-b. 마크다운 표(Table) 블록: | 열1 | 열2 |
    if (isTableLine(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableLine(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const rawRows = tableLines.map(parseTableRowCells);
      let hasTableHeader = true;
      const dataRows: string[][] = [];

      for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
        if (rIdx === 1 && isTableSeparatorCells(rawRows[rIdx])) {
          // | :---: | 형태이면 머리글 없음 표시로 활용 가능
          const allCentered = rawRows[rIdx].every((c) =>
            /^:-+:$/.test(c.trim())
          );
          if (allCentered) {
            hasTableHeader = false;
          }
          continue;
        }
        dataRows.push(rawRows[rIdx]);
      }

      const maxCols = Math.max(
        2,
        ...dataRows.map((r) => r.length)
      );
      const normalizedRows =
        dataRows.length > 0
          ? dataRows.map((r) => {
              const copy = [...r];
              while (copy.length < maxCols) copy.push('');
              return copy.slice(0, maxCols);
            })
          : createDefaultTableRows(3, 3);

      blocks.push({
        id: createBlockId(),
        type: 'table',
        content: '',
        tableRows: normalizedRows,
        hasTableHeader,
      });
      continue;
    }

    // 3. 대제목 / 중제목 / 소제목
    if (line.startsWith('# ')) {
      blocks.push({
        id: createBlockId(),
        type: 'h1',
        content: decodeInlineNewlines(line.slice(2).trim()),
      });
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({
        id: createBlockId(),
        type: 'h2',
        content: decodeInlineNewlines(line.slice(3).trim()),
      });
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({
        id: createBlockId(),
        type: 'h3',
        content: decodeInlineNewlines(line.slice(4).trim()),
      });
      i++;
      continue;
    }

    // 4. 콜아웃 (> [!CALLOUT:💡] 내용)
    const calloutMatch = line.match(/^>\s*\[!CALLOUT:([^\]]+)\]\s*(.*)$/);
    if (calloutMatch) {
      blocks.push({
        id: createBlockId(),
        type: 'callout',
        icon: calloutMatch[1] || '💡',
        content: decodeInlineNewlines(calloutMatch[2] || ''),
      });
      i++;
      continue;
    }

    // 5. 인용구 (> 내용)
    if (line.startsWith('> ')) {
      blocks.push({
        id: createBlockId(),
        type: 'quote',
        content: decodeInlineNewlines(line.slice(2).trim()),
      });
      i++;
      continue;
    }

    // 6. 글머리 기호 목록 (- 내용, * 내용)
    if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        id: createBlockId(),
        type: 'bullet',
        content: decodeInlineNewlines(line.slice(2).trim()),
      });
      i++;
      continue;
    }

    // 7. 일반 본문 단락: 연속된 줄(Shift+Enter로 이어진 줄)을 하나의 블록으로 묶음
    const paragraphLines: string[] = [decodeInlineNewlines(rawLine)];
    i++;
    while (i < lines.length) {
      const nextRaw = lines[i];
      const nextTrimmed = nextRaw.trim();
      if (!nextTrimmed || isSpecialBlockLine(nextTrimmed)) {
        break;
      }
      paragraphLines.push(decodeInlineNewlines(nextRaw));
      i++;
    }

    blocks.push({
      id: createBlockId(),
      type: 'p',
      content: paragraphLines.join('\n'),
    });
  }

  applyPendingLayoutIfAny();

  if (blocks.length === 0) {
    blocks.push({
      id: createBlockId(),
      type: 'p',
      content: '',
    });
  }

  return blocks;
}

/**
 * 노션 블록 배열(NotionBlock[])을 마크다운 문자열로 직렬화합니다.
 * - 빈 블록(공백 블록)은 `<br>`로 보존하여 저장 후에도 그대로 유지됩니다.
 * - 블록 내부의 Shift+Enter 줄바꿈은 단일 개행(`\n` 또는 인라인 `<br>`)으로 보존되어
 *   Enter로 만든 새 블록(`\n\n`)과 명확히 구분됩니다.
 * - 가로 다단 조립(rowId) 및 블록 가로 너비(widthPercent) 설정은 `<!--block-layout:...-->` 메타 주석으로 직렬화됩니다.
 */
export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const hasAnyContent = blocks.some(
    (b) =>
      b.type === 'divider' ||
      b.type === 'table' ||
      b.type === 'quiz' ||
      b.type === 'vpython' ||
      b.type === 'colab' ||
      (b.type === 'image' && getBlockImages(b).length > 0) ||
      b.content.trim().length > 0
  );
  if (!hasAnyContent) {
    return '';
  }

  const lines: string[] = [];

  for (const b of blocks) {
    const lineCountBefore = lines.length;

    switch (b.type) {
      case 'h1':
        if (b.content.trim()) {
          lines.push(`# ${encodeInlineNewlines(b.content.trim())}`);
        } else {
          lines.push('<br>');
        }
        break;
      case 'h2':
        if (b.content.trim()) {
          lines.push(`## ${encodeInlineNewlines(b.content.trim())}`);
        } else {
          lines.push('<br>');
        }
        break;
      case 'h3':
        if (b.content.trim()) {
          lines.push(`### ${encodeInlineNewlines(b.content.trim())}`);
        } else {
          lines.push('<br>');
        }
        break;
      case 'bullet':
        if (b.content.trim()) {
          lines.push(`- ${encodeInlineNewlines(b.content.trim())}`);
        } else {
          lines.push('<br>');
        }
        break;
      case 'callout':
        if (b.content.trim()) {
          const icon = b.icon || '💡';
          lines.push(
            `> [!CALLOUT:${icon}] ${encodeInlineNewlines(b.content.trim())}`
          );
        } else {
          lines.push('<br>');
        }
        break;
      case 'quote':
        if (b.content.trim()) {
          lines.push(`> ${encodeInlineNewlines(b.content.trim())}`);
        } else {
          lines.push('<br>');
        }
        break;
      case 'table': {
        const rows =
          b.tableRows && b.tableRows.length > 0
            ? b.tableRows
            : createDefaultTableRows(3, 3);
        const colCount = Math.max(1, ...rows.map((r) => r.length));
        const formatRow = (row: string[]) => {
          const cells = Array.from({ length: colCount }, (_, cIdx) => {
            const raw = row[cIdx] ?? '';
            return encodeInlineNewlines(raw.trim()).replace(/\|/g, '\\|');
          });
          return `| ${cells.join(' | ')} |`;
        };
        const headerRow = formatRow(rows[0] || []);
        const sepToken = b.hasTableHeader === false ? ':---:' : '---';
        const sepRow = `| ${Array.from({ length: colCount }, () => sepToken).join(' | ')} |`;
        const bodyRows = rows.slice(1).map(formatRow);
        lines.push([headerRow, sepRow, ...bodyRows].join('\n'));
        break;
      }
      case 'code':
        if (b.content.trim() || b.rowId) {
          const lang = b.language || 'python';
          lines.push(`\`\`\`${lang}\n${b.content.replace(/\r\n/g, '\n')}\n\`\`\``);
        }
        break;
      case 'colab':
        if (b.content.trim() || b.rowId) {
          const safeTitle = (b.caption || '')
            .replace(/[\n|]/g, ' ')
            .trim();
          const safeUrl = (b.externalUrl || '').replace(/\s+/g, '').trim();
          const meta =
            safeTitle || safeUrl
              ? `:${safeTitle}${safeUrl ? `|${safeUrl}` : ''}`
              : '';
          lines.push(
            `\`\`\`colab${meta}\n${b.content.replace(/\r\n/g, '\n')}\n\`\`\``
          );
        }
        break;
      case 'vpython': {
        const safeTitle = (b.caption || '')
          .replace(/[\n|]/g, ' ')
          .trim();
        const safeUrl = (b.externalUrl || '').replace(/\s+/g, '').trim();
        const meta =
          safeTitle || safeUrl
            ? `:${safeTitle}${safeUrl ? `|${safeUrl}` : ''}`
            : '';
        lines.push(
          `\`\`\`vpython${meta}\n${b.content.replace(/\r\n/g, '\n')}\n\`\`\``
        );
        break;
      }
      case 'mermaid':
        if (b.content.trim() || b.rowId) {
          lines.push(`\`\`\`mermaid\n${b.content.trim().replace(/\r\n/g, '\n')}\n\`\`\``);
        }
        break;
      case 'simulation':
        if (b.content.trim() || b.rowId) {
          const safeTitle = (b.caption || '').replace(/\n/g, ' ').trim();
          const header = safeTitle ? `simulation:${safeTitle}` : 'simulation';
          lines.push(`\`\`\`${header}\n${b.content.trim().replace(/\r\n/g, '\n')}\n\`\`\``);
        }
        break;
      case 'quiz': {
        const qData = b.quizData || createDefaultQuizData('multiple_choice');
        const normalizedQuiz: InlineQuizBlockData = {
          quizId: qData.quizId || createInlineQuizId(),
          questionType: qData.questionType || 'multiple_choice',
          questionText:
            qData.questionText.trim() ||
            b.content.trim() ||
            '방금 학습한 핵심 개념을 확인해 볼까요?',
          options:
            qData.questionType === 'ox'
              ? ['O (맞다)', 'X (틀리다)']
              : qData.options && qData.options.length > 0
              ? qData.options
              : ['보기 1', '보기 2', '보기 3', '보기 4'],
          correctOptionIndex:
            typeof qData.correctOptionIndex === 'number'
              ? qData.correctOptionIndex
              : 0,
          answerText: qData.answerText || '',
          explanation: qData.explanation || '정답 해설입니다.',
          targetConcept: qData.targetConcept || '핵심 개념 점검',
        };
        lines.push(`\`\`\`quiz\n${JSON.stringify(normalizedQuiz, null, 2)}\n\`\`\``);
        break;
      }
      case 'divider':
        lines.push('---');
        break;
      case 'image': {
        const imgs = getBlockImages(b);
        if (imgs.length === 1) {
          const sizeTag = b.imageSize ? `|${b.imageSize}` : '|md';
          const safeCaption = (imgs[0].caption || '')
            .replace(/[\[\]|]/g, ' ')
            .trim();
          lines.push(`![${safeCaption}${sizeTag}](${imgs[0].url})`);
        } else if (imgs.length > 1) {
          const sizeTag = b.imageSize || 'full';
          const itemLines = imgs.map((img) => {
            const safeCap = encodeInlineNewlines(
              (img.caption || '').replace(/[\[\]]/g, ' ').trim()
            );
            return `![${safeCap}](${img.url})`;
          });
          lines.push(`\`\`\`image-row:${sizeTag}\n${itemLines.join('\n')}\n\`\`\``);
        }
        break;
      }
      case 'p':
      default:
        if (b.content.trim()) {
          const pLines = b.content
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map((l) => {
              const trimmed = l.trim();
              if (!trimmed) return '\u200B';
              if (isSpecialBlockLine(trimmed)) return `\u200B${l}`;
              return l;
            });
          lines.push(pLines.join('\n'));
        } else {
          lines.push('<br>');
        }
        break;
    }

    if (lines.length > lineCountBefore) {
      const lastIdx = lines.length - 1;
      const hasRowId = typeof b.rowId === 'string' && b.rowId.trim().length > 0;
      const hasCustomWidth =
        typeof b.widthPercent === 'number' &&
        Number.isFinite(b.widthPercent) &&
        (hasRowId || (b.widthPercent >= 15 && b.widthPercent < 100));
      if (hasRowId || hasCustomWidth) {
        const layoutMeta: { rowId?: string; widthPercent?: number } = {};
        if (hasRowId) layoutMeta.rowId = b.rowId!.trim();
        if (
          typeof b.widthPercent === 'number' &&
          Number.isFinite(b.widthPercent)
        ) {
          layoutMeta.widthPercent = Math.min(
            100,
            Math.max(15, Math.round(b.widthPercent))
          );
        }
        lines[lastIdx] = `<!--block-layout:${JSON.stringify(layoutMeta)}-->\n${lines[lastIdx]}`;
      }
    }
  }

  return lines.join('\n\n');
}
