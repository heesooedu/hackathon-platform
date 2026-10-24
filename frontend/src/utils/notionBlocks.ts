export type NotionBlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'p'
  | 'bullet'
  | 'callout'
  | 'quote'
  | 'code'
  | 'mermaid'
  | 'image'
  | 'divider';

export type ImageSizeOption = 'sm' | 'md' | 'full';

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
  imageUrl?: string; // image 블록의 data URL 또는 외부 URL
  caption?: string; // image 블록의 캡션
  imageSize?: ImageSizeOption;
}

export function createBlockId(): string {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

  const lines = markdown.split('\n');
  const blocks: NotionBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // 0. 멀티라인 펜스 코드블록 (```python ... ``` 또는 ```mermaid ... ```)
    if (line.startsWith('```')) {
      const langRaw = line.slice(3).trim().toLowerCase();
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
      });
      i++;
      continue;
    }

    // 3. 대제목 / 중제목 / 소제목
    if (line.startsWith('# ')) {
      blocks.push({
        id: createBlockId(),
        type: 'h1',
        content: line.slice(2).trim(),
      });
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({
        id: createBlockId(),
        type: 'h2',
        content: line.slice(3).trim(),
      });
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({
        id: createBlockId(),
        type: 'h3',
        content: line.slice(4).trim(),
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
        content: calloutMatch[2] || '',
      });
      i++;
      continue;
    }

    // 5. 인용구 (> 내용)
    if (line.startsWith('> ')) {
      blocks.push({
        id: createBlockId(),
        type: 'quote',
        content: line.slice(2).trim(),
      });
      i++;
      continue;
    }

    // 6. 글머리 기호 목록 (- 내용, * 내용)
    if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        id: createBlockId(),
        type: 'bullet',
        content: line.slice(2).trim(),
      });
      i++;
      continue;
    }

    // 7. 일반 본문 단락
    blocks.push({
      id: createBlockId(),
      type: 'p',
      content: rawLine,
    });
    i++;
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
 */
export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = [];

  for (const b of blocks) {
    switch (b.type) {
      case 'h1':
        if (b.content.trim()) lines.push(`# ${b.content.trim()}`);
        break;
      case 'h2':
        if (b.content.trim()) lines.push(`## ${b.content.trim()}`);
        break;
      case 'h3':
        if (b.content.trim()) lines.push(`### ${b.content.trim()}`);
        break;
      case 'bullet':
        if (b.content.trim()) lines.push(`- ${b.content.trim()}`);
        break;
      case 'callout':
        if (b.content.trim()) {
          const icon = b.icon || '💡';
          lines.push(`> [!CALLOUT:${icon}] ${b.content.trim().replace(/\n/g, ' ')}`);
        }
        break;
      case 'quote':
        if (b.content.trim()) {
          lines.push(`> ${b.content.trim().replace(/\n/g, ' ')}`);
        }
        break;
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
      case 'divider':
        lines.push('---');
        break;
      case 'image':
        if (b.imageUrl) {
          const sizeTag = b.imageSize ? `|${b.imageSize}` : '|md';
          const safeCaption = (b.caption || '').replace(/[\[\]|]/g, ' ').trim();
          lines.push(`![${safeCaption}${sizeTag}](${b.imageUrl})`);
        }
        break;
      case 'p':
      default:
        if (b.content.trim()) {
          lines.push(b.content);
        }
        break;
    }
  }

  return lines.join('\n\n');
}
