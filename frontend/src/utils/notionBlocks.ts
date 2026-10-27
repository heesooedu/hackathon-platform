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
  | 'physical'
  | 'mermaid'
  | 'simulation'
  | 'quiz'
  | 'image'
  | 'youtube'
  | 'link'
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
  caption?: string; // 단일 image, simulation, colab, vpython, youtube, link 블록의 제목/캡션
  externalUrl?: string; // colab 노트북 공유 URL, glowscript/trinket 링크, youtube 영상 URL, link 외부 주소
  imageSize?: ImageSizeOption;
  images?: NotionImageItem[]; // 가로 다단(여러 장) 이미지 배열
  tableRows?: string[][]; // 표(table) 블록의 2차원 셀 배열 (행 x 열)
  hasTableHeader?: boolean; // 표 첫 행 머리글 여부 (기본 true)
  tableColWidths?: number[]; // 표 각 열(column)의 사용자 지정 가로 너비(px, 0이면 자동)
  tableRowHeights?: number[]; // 표 각 행(row)의 사용자 지정 세로 높이(px, 0이면 자동)
  quizData?: InlineQuizBlockData; // 인라인 체크포인트 퀴즈 블록 데이터
  rowId?: string; // 같은 rowId를 공유하는 인접 블록들은 가로 다단(Side-by-Side Row)으로 나란히 조립됨
  colId?: string; // 같은 rowId 안에서 같은 colId를 공유하는 블록들은 하나의 세로 열(Column Stack) 안에 상하로 쌓임
  widthPercent?: number; // 블록(또는 해당 열)의 가로 너비 비율 (15~100%, 다단 행 내에서는 열 너비 비중, 단독 블록에서는 가로 폭 %)
  stackHeightPercent?: number; // 같은 열(colId) 안에 2개 이상의 블록이 상하로 쌓여 있을 때 각 블록의 세로 높이 비중 (15~85%)
}

export interface NotionBlockColumnGroup {
  colId: string;
  items: { block: NotionBlock; index: number }[];
  widthPercent?: number;
}

export interface NotionBlockRowGroup {
  rowId: string | null;
  items: { block: NotionBlock; index: number }[];
  columns: NotionBlockColumnGroup[];
}

export function createBlockId(): string {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createRowId(): string {
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createColId(): string {
  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 연속된 블록 중 같은 rowId를 가진 블록들을 하나의 가로 다단 행(Row Group, 최대 4열)으로 묶고,
 * 행 내부에서 같은 colId를 공유하는 블록들은 하나의 세로 열(Column Stack)로 묶어 반환합니다.
 */
export function groupBlocksIntoRows(blocks: NotionBlock[]): NotionBlockRowGroup[] {
  const groups: NotionBlockRowGroup[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const rId = b.rowId?.trim() || null;
    const cId = b.colId?.trim() || b.id;

    if (
      rId &&
      groups.length > 0 &&
      groups[groups.length - 1].rowId === rId
    ) {
      const lastGroup = groups[groups.length - 1];
      const existingCol = lastGroup.columns.find((c) => c.colId === cId);
      if (existingCol) {
        lastGroup.items.push({ block: b, index: i });
        existingCol.items.push({ block: b, index: i });
        if (
          typeof existingCol.widthPercent !== 'number' &&
          typeof b.widthPercent === 'number'
        ) {
          existingCol.widthPercent = b.widthPercent;
        }
        continue;
      } else if (lastGroup.columns.length < 4) {
        lastGroup.items.push({ block: b, index: i });
        lastGroup.columns.push({
          colId: cId,
          items: [{ block: b, index: i }],
          widthPercent: b.widthPercent,
        });
        continue;
      }
    }

    groups.push({
      rowId: rId,
      items: [{ block: b, index: i }],
      columns: [
        {
          colId: cId,
          items: [{ block: b, index: i }],
          widthPercent: b.widthPercent,
        },
      ],
    });
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
 * 한 행(Row Group) 내부 열(Column Group)들의 가로 너비 비율(%)을 합계 100%가 되도록 정규화하여 반환합니다.
 */
export function getNormalizedColumnWidths(
  columns: NotionBlockColumnGroup[]
): number[] {
  const n = columns.length;
  if (n === 0) return [];
  if (n === 1) {
    const w = columns[0].widthPercent ?? columns[0].items[0]?.block.widthPercent;
    return [
      typeof w === 'number' && Number.isFinite(w)
        ? Math.min(100, Math.max(25, Math.round(w)))
        : 100,
    ];
  }

  const rawWeights = columns.map((col) => {
    const w = col.widthPercent ?? col.items[0]?.block.widthPercent;
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
 * 한 열(Column Stack) 내부에 상하로 쌓인 블록들의 세로 높이 비율(%)을 합계 100%가 되도록 정규화하여 반환합니다.
 */
export function getNormalizedStackHeights(
  items: { block: NotionBlock }[]
): number[] {
  const n = items.length;
  if (n === 0) return [];
  if (n === 1) return [100];

  const rawWeights = items.map((it) => {
    const h = it.block.stackHeightPercent;
    return typeof h === 'number' && Number.isFinite(h) && h >= 15
      ? h
      : 100 / n;
  });
  const total = rawWeights.reduce((acc, v) => acc + v, 0) || 100;
  const normalized = rawWeights.map((h) =>
    Math.max(15, Math.round((h / total) * 100))
  );
  const sumExceptLast = normalized
    .slice(0, n - 1)
    .reduce((acc, v) => acc + v, 0);
  normalized[n - 1] = Math.max(15, 100 - sumExceptLast);
  return normalized;
}

/**
 * 블록 삭제·이동·분리 후 혼자 남은(인접한 다른 열과 rowId를 공유하지 않는) 고아 rowId/colId를 정리합니다.
 * 또한 같은 rowId 내에서 같은 colId를 가진 블록들이 연속으로 모여 있도록 정렬을 보정합니다.
 */
export function cleanupOrphanRowIds(blocks: NotionBlock[]): NotionBlock[] {
  // 1) 연속된 동일 rowId 구간 내에서 같은 colId 블록들이 흩어지지 않도록 순서 보정
  const clustered: NotionBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const rId = blocks[i].rowId?.trim();
    if (!rId) {
      clustered.push(blocks[i]);
      i++;
      continue;
    }
    let j = i;
    while (j < blocks.length && blocks[j].rowId?.trim() === rId) {
      j++;
    }
    const rowSlice = blocks.slice(i, j);
    const colOrder: string[] = [];
    const colBuckets = new Map<string, NotionBlock[]>();
    for (const b of rowSlice) {
      const cId = b.colId?.trim() || b.id;
      if (!colBuckets.has(cId)) {
        colOrder.push(cId);
        colBuckets.set(cId, []);
      }
      colBuckets.get(cId)!.push(b);
    }
    for (const cId of colOrder) {
      const colItems = colBuckets.get(cId)!;
      for (const b of colItems) {
        clustered.push(b);
      }
    }
    i = j;
  }

  // 2) 행별로 열(Column) 개수를 확인하여 열이 1개뿐인 행은 일반 세로 블록으로 복원
  const rowGroups = groupBlocksIntoRows(clustered);
  const result: NotionBlock[] = [];

  for (const group of rowGroups) {
    if (!group.rowId || group.columns.length <= 1) {
      for (const { block } of group.items) {
        const nextBlock: NotionBlock = {
          ...block,
          rowId: undefined,
          colId: undefined,
          stackHeightPercent: undefined,
        };
        if (
          typeof nextBlock.widthPercent === 'number' &&
          nextBlock.widthPercent <= 85 &&
          Boolean(block.rowId)
        ) {
          delete nextBlock.widthPercent;
        }
        result.push(nextBlock);
      }
    } else {
      for (const col of group.columns) {
        const isSingleInCol = col.items.length <= 1;
        for (const { block } of col.items) {
          result.push({
            ...block,
            colId: col.colId,
            stackHeightPercent: isSingleInCol
              ? undefined
              : block.stackHeightPercent,
          });
        }
      }
    }
  }

  return result;
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

/**
 * 유튜브 URL, 짧은 공유 링크(youtu.be), Shorts, Embed URL 또는 iframe 태그에서
 * 11자리 유튜브 비디오 ID를 추출합니다.
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // iframe 코드가 붙여넣어진 경우 src 추출
  const iframeSrcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  const target = iframeSrcMatch ? iframeSrcMatch[1].trim() : trimmed;

  // 11자리 순수 ID만 입력한 경우
  if (/^[a-zA-Z0-9_-]{11}$/.test(target)) {
    return target;
  }

  // 일반적인 YouTube URL 패턴 매칭
  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^&#]*&)*v=)([a-zA-Z0-9_-]{11})/i,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube(?:-nocookie)?\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/i,
  ];

  for (const regex of patterns) {
    const match = target.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * 외부 링크 URL에 프로토콜(https://)이 누락된 경우 안전하게 보정합니다.
 */
export function normalizeExternalUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * 블록 내부 텍스트의 줄바꿈(\n)을 `<br>`로 변환하면서,
 * 줄 맨 앞/뒤의 공백(스페이스·탭)이 마크다운 파서나 `.trim()`에 의해 사라지지 않도록
 * 제로폭 공백(\u200B) 가드로 감싸 보존합니다.
 */
function encodeInlineNewlines(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => {
      if (!l) return '\u200B';
      const leadGuard = /^[ \t]/.test(l) ? '\u200B' : '';
      const trailGuard = /[ \t]$/.test(l) ? '\u200B' : '';
      return `${leadGuard}${l}${trailGuard}`;
    })
    .join('<br>');
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
  let pendingLayout: {
    rowId?: string;
    colId?: string;
    widthPercent?: number;
    stackHeightPercent?: number;
    tableColWidths?: number[];
    tableRowHeights?: number[];
  } | null = null;
  let prevBlocksLen = 0;

  const applyPendingLayoutIfAny = () => {
    if (blocks.length > prevBlocksLen) {
      if (pendingLayout) {
        for (let bIdx = prevBlocksLen; bIdx < blocks.length; bIdx++) {
          if (pendingLayout.rowId) {
            blocks[bIdx].rowId = pendingLayout.rowId;
          }
          if (pendingLayout.colId) {
            blocks[bIdx].colId = pendingLayout.colId;
          }
          if (typeof pendingLayout.widthPercent === 'number') {
            blocks[bIdx].widthPercent = pendingLayout.widthPercent;
          }
          if (typeof pendingLayout.stackHeightPercent === 'number') {
            blocks[bIdx].stackHeightPercent = pendingLayout.stackHeightPercent;
          }
          if (
            Array.isArray(pendingLayout.tableColWidths) &&
            pendingLayout.tableColWidths.length > 0
          ) {
            blocks[bIdx].tableColWidths = pendingLayout.tableColWidths;
          }
          if (
            Array.isArray(pendingLayout.tableRowHeights) &&
            pendingLayout.tableRowHeights.length > 0
          ) {
            blocks[bIdx].tableRowHeights = pendingLayout.tableRowHeights;
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

    // 0-0. 블록 가로 다단 조립 및 가로 폭/표 크기 레이아웃 메타데이터 주석 (<!--block-layout:{"rowId":"...","colId":"...","widthPercent":50,"stackHeightPercent":50}-->)
    if (line.startsWith('<!--block-layout:') && line.endsWith('-->')) {
      const jsonStr = line.slice('<!--block-layout:'.length, -3).trim();
      try {
        const parsedLayout = JSON.parse(jsonStr) as {
          rowId?: unknown;
          colId?: unknown;
          widthPercent?: unknown;
          stackHeightPercent?: unknown;
          tableColWidths?: unknown;
          tableRowHeights?: unknown;
        };
        if (parsedLayout && typeof parsedLayout === 'object') {
          pendingLayout = {
            rowId:
              typeof parsedLayout.rowId === 'string' &&
              parsedLayout.rowId.trim()
                ? parsedLayout.rowId.trim()
                : undefined,
            colId:
              typeof parsedLayout.colId === 'string' &&
              parsedLayout.colId.trim()
                ? parsedLayout.colId.trim()
                : undefined,
            widthPercent:
              typeof parsedLayout.widthPercent === 'number' &&
              Number.isFinite(parsedLayout.widthPercent)
                ? Math.min(
                    100,
                    Math.max(15, Math.round(parsedLayout.widthPercent))
                  )
                : undefined,
            stackHeightPercent:
              typeof parsedLayout.stackHeightPercent === 'number' &&
              Number.isFinite(parsedLayout.stackHeightPercent)
                ? Math.min(
                    85,
                    Math.max(15, Math.round(parsedLayout.stackHeightPercent))
                  )
                : undefined,
            tableColWidths: Array.isArray(parsedLayout.tableColWidths)
              ? parsedLayout.tableColWidths.map((n) =>
                  typeof n === 'number' && Number.isFinite(n) && n > 0
                    ? Math.max(48, Math.min(1200, Math.round(n)))
                    : 0
                )
              : undefined,
            tableRowHeights: Array.isArray(parsedLayout.tableRowHeights)
              ? parsedLayout.tableRowHeights.map((n) =>
                  typeof n === 'number' && Number.isFinite(n) && n > 0
                    ? Math.max(28, Math.min(800, Math.round(n)))
                    : 0
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
      } else if (
        langRaw === 'physical' ||
        langRaw.startsWith('physical:') ||
        langRaw === 'microbit' ||
        langRaw.startsWith('microbit:') ||
        langRaw === 'arduino' ||
        langRaw.startsWith('arduino:') ||
        langRaw === 'pico' ||
        langRaw.startsWith('pico:')
      ) {
        const colonIdx = fenceHeader.indexOf(':');
        const metaPart =
          colonIdx !== -1 ? fenceHeader.slice(colonIdx + 1).trim() : '';
        const [rawCaption, rawUrl] = metaPart.split('|');
        blocks.push({
          id: createBlockId(),
          type: 'physical',
          caption: (rawCaption || '').trim(),
          externalUrl: rawUrl ? rawUrl.trim() : undefined,
          content: codeLines.join('\n'),
        });
      } else if (
        langRaw === 'youtube' ||
        langRaw.startsWith('youtube:') ||
        langRaw === 'yt' ||
        langRaw.startsWith('yt:')
      ) {
        const colonIdx = fenceHeader.indexOf(':');
        const metaPart =
          colonIdx !== -1 ? fenceHeader.slice(colonIdx + 1).trim() : '';
        const [rawCaption, rawUrl] = metaPart.split('|');
        const bodyUrl = codeLines.join('\n').trim();
        const finalUrl = (rawUrl || bodyUrl || '').trim();
        blocks.push({
          id: createBlockId(),
          type: 'youtube',
          caption: (rawCaption || '').trim(),
          externalUrl: finalUrl || undefined,
          content: finalUrl,
        });
      } else if (
        langRaw === 'link' ||
        langRaw.startsWith('link:') ||
        langRaw === 'bookmark' ||
        langRaw.startsWith('bookmark:')
      ) {
        const colonIdx = fenceHeader.indexOf(':');
        const metaPart =
          colonIdx !== -1 ? fenceHeader.slice(colonIdx + 1).trim() : '';
        const [rawCaption, rawUrl] = metaPart.split('|');
        const bodyText = codeLines.join('\n').trim();
        blocks.push({
          id: createBlockId(),
          type: 'link',
          caption: (rawCaption || '').trim(),
          externalUrl: (rawUrl || '').trim() || undefined,
          content: bodyText,
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
      b.type === 'physical' ||
      b.type === 'colab' ||
      b.type === 'youtube' ||
      b.type === 'link' ||
      (b.type === 'image' && getBlockImages(b).length > 0) ||
      Boolean(b.externalUrl && b.externalUrl.trim()) ||
      b.content.length > 0
  );
  if (!hasAnyContent) {
    return '';
  }

  const lines: string[] = [];

  for (const b of blocks) {
    const lineCountBefore = lines.length;

    switch (b.type) {
      case 'h1':
        if (b.content.length > 0) {
          lines.push(`# ${encodeInlineNewlines(b.content)}`);
        } else {
          lines.push('<br>');
        }
        break;
      case 'h2':
        if (b.content.length > 0) {
          lines.push(`## ${encodeInlineNewlines(b.content)}`);
        } else {
          lines.push('<br>');
        }
        break;
      case 'h3':
        if (b.content.length > 0) {
          lines.push(`### ${encodeInlineNewlines(b.content)}`);
        } else {
          lines.push('<br>');
        }
        break;
      case 'bullet':
        if (b.content.length > 0) {
          lines.push(`- ${encodeInlineNewlines(b.content)}`);
        } else {
          lines.push('<br>');
        }
        break;
      case 'callout':
        if (b.content.length > 0) {
          const icon = b.icon || '💡';
          lines.push(
            `> [!CALLOUT:${icon}] ${encodeInlineNewlines(b.content)}`
          );
        } else {
          lines.push('<br>');
        }
        break;
      case 'quote':
        if (b.content.length > 0) {
          lines.push(`> ${encodeInlineNewlines(b.content)}`);
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
            return encodeInlineNewlines(raw).replace(/\|/g, '\\|');
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
      case 'physical': {
        const safeTitle = (b.caption || '')
          .replace(/[\n|]/g, ' ')
          .trim();
        const safeUrl = (b.externalUrl || '').replace(/\s+/g, '').trim();
        const meta =
          safeTitle || safeUrl
            ? `:${safeTitle}${safeUrl ? `|${safeUrl}` : ''}`
            : '';
        lines.push(
          `\`\`\`physical${meta}\n${b.content.replace(/\r\n/g, '\n')}\n\`\`\``
        );
        break;
      }
      case 'youtube': {
        const safeTitle = (b.caption || '')
          .replace(/[\n|]/g, ' ')
          .trim();
        const safeUrl = (b.externalUrl || b.content || '')
          .replace(/\s+/g, '')
          .trim();
        const meta =
          safeTitle || safeUrl
            ? `:${safeTitle}${safeUrl ? `|${safeUrl}` : ''}`
            : '';
        lines.push(`\`\`\`youtube${meta}\n${safeUrl}\n\`\`\``);
        break;
      }
      case 'link': {
        const safeTitle = (b.caption || '')
          .replace(/[\n|]/g, ' ')
          .trim();
        const safeUrl = (b.externalUrl || '').replace(/\s+/g, '').trim();
        const meta =
          safeTitle || safeUrl
            ? `:${safeTitle}${safeUrl ? `|${safeUrl}` : ''}`
            : '';
        lines.push(
          `\`\`\`link${meta}\n${(b.content || '').replace(/\r\n/g, '\n')}\n\`\`\``
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
        if (b.content.length > 0) {
          const pLines = b.content
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map((l) => {
              if (!l) return '\u200B';
              const needsLeadingGuard =
                /^[ \t]/.test(l) || isSpecialBlockLine(l.trim());
              const needsTrailingGuard = /[ \t]$/.test(l);
              return `${needsLeadingGuard ? '\u200B' : ''}${l}${needsTrailingGuard ? '\u200B' : ''}`;
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
      const hasColId = typeof b.colId === 'string' && b.colId.trim().length > 0;
      const hasCustomWidth =
        typeof b.widthPercent === 'number' &&
        Number.isFinite(b.widthPercent) &&
        (hasRowId || (b.widthPercent >= 15 && b.widthPercent < 100));
      const hasStackHeight =
        typeof b.stackHeightPercent === 'number' &&
        Number.isFinite(b.stackHeightPercent) &&
        b.stackHeightPercent >= 15 &&
        b.stackHeightPercent <= 85;
      const hasTableColWidths =
        b.type === 'table' &&
        Array.isArray(b.tableColWidths) &&
        b.tableColWidths.some((w) => typeof w === 'number' && w > 0);
      const hasTableRowHeights =
        b.type === 'table' &&
        Array.isArray(b.tableRowHeights) &&
        b.tableRowHeights.some((h) => typeof h === 'number' && h > 0);

      if (
        hasRowId ||
        hasColId ||
        hasCustomWidth ||
        hasStackHeight ||
        hasTableColWidths ||
        hasTableRowHeights
      ) {
        const layoutMeta: {
          rowId?: string;
          colId?: string;
          widthPercent?: number;
          stackHeightPercent?: number;
          tableColWidths?: number[];
          tableRowHeights?: number[];
        } = {};
        if (hasRowId) layoutMeta.rowId = b.rowId!.trim();
        if (hasColId) layoutMeta.colId = b.colId!.trim();
        if (
          typeof b.widthPercent === 'number' &&
          Number.isFinite(b.widthPercent)
        ) {
          layoutMeta.widthPercent = Math.min(
            100,
            Math.max(15, Math.round(b.widthPercent))
          );
        }
        if (hasStackHeight && typeof b.stackHeightPercent === 'number') {
          layoutMeta.stackHeightPercent = Math.min(
            85,
            Math.max(15, Math.round(b.stackHeightPercent))
          );
        }
        if (hasTableColWidths && b.tableColWidths) {
          layoutMeta.tableColWidths = b.tableColWidths.map((w) =>
            typeof w === 'number' && Number.isFinite(w) && w > 0
              ? Math.max(48, Math.min(1200, Math.round(w)))
              : 0
          );
        }
        if (hasTableRowHeights && b.tableRowHeights) {
          layoutMeta.tableRowHeights = b.tableRowHeights.map((h) =>
            typeof h === 'number' && Number.isFinite(h) && h > 0
              ? Math.max(28, Math.min(800, Math.round(h)))
              : 0
          );
        }
        lines[lastIdx] = `<!--block-layout:${JSON.stringify(layoutMeta)}-->\n${lines[lastIdx]}`;
      }
    }
  }

  return lines.join('\n\n');
}
