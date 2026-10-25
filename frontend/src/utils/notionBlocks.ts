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
  | 'mermaid'
  | 'simulation'
  | 'image'
  | 'divider';

export type ImageSizeOption = 'sm' | 'md' | 'full';

export interface NotionImageItem {
  url: string;
  caption?: string;
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
  caption?: string; // 단일 image 또는 simulation 블록의 캡션
  imageSize?: ImageSizeOption;
  images?: NotionImageItem[]; // 가로 다단(여러 장) 이미지 배열
  tableRows?: string[][]; // 표(table) 블록의 2차원 셀 배열 (행 x 열)
  hasTableHeader?: boolean; // 표 첫 행 머리글 여부 (기본 true)
}

export function createBlockId(): string {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
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
 */
export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const hasAnyContent = blocks.some(
    (b) =>
      b.type === 'divider' ||
      b.type === 'table' ||
      (b.type === 'image' && getBlockImages(b).length > 0) ||
      b.content.trim().length > 0
  );
  if (!hasAnyContent) {
    return '';
  }

  const lines: string[] = [];

  for (const b of blocks) {
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
        if (b.content.trim()) {
          const lang = b.language || 'python';
          lines.push(`\`\`\`${lang}\n${b.content.replace(/\r\n/g, '\n')}\n\`\`\``);
        }
        break;
      case 'mermaid':
        if (b.content.trim()) {
          lines.push(`\`\`\`mermaid\n${b.content.trim().replace(/\r\n/g, '\n')}\n\`\`\``);
        }
        break;
      case 'simulation':
        if (b.content.trim()) {
          const safeTitle = (b.caption || '').replace(/\n/g, ' ').trim();
          const header = safeTitle ? `simulation:${safeTitle}` : 'simulation';
          lines.push(`\`\`\`${header}\n${b.content.trim().replace(/\r\n/g, '\n')}\n\`\`\``);
        }
        break;
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
  }

  return lines.join('\n\n');
}
