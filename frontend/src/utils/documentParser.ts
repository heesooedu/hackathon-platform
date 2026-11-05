import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as CFB from 'cfb';
import { inflateRawSync } from 'node:zlib';

// 업로드 크기는 작아도 압축을 풀면 메모리를 고갈시키는 파일을 막기 위한 한도
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5000;
const EXPANDED_TOO_LARGE_MESSAGE = '압축을 풀면 크기가 너무 큰 문서입니다.';

export interface ParsedDocumentResult {
  success: boolean;
  fileName: string;
  markdown: string;
  formatLabel: string;
  error?: string;
}

/**
 * 간단한 HTML을 읽기 좋은 마크다운으로 변환합니다 (mammoth .docx 변환 결과 정리용)
 */
function htmlToSimpleMarkdown(html: string): string {
  let md = html;

  // 제목 태그 변환
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');

  // 강조 및 목록 변환
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  // 표(table) 행/셀 구분
  md = md.replace(/<\/tr>/gi, '\n');
  md = md.replace(/<\/(td|th)>/gi, ' | ');

  // 문단 및 줄바꿈
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<[^>]+>/g, '');

  // HTML 엔티티 디코딩
  md = decodeXmlEntities(md);

  // 연속 빈 줄 정리
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return md;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * ZIP 기반 문서를 스트리밍으로 끝까지 읽어 실제 압축 해제 크기를 확인합니다.
 * 파일 헤더의 크기 값은 위조할 수 있으므로 신뢰하지 않습니다.
 */
async function assertZipWithinLimits(buffer: Buffer): Promise<JSZip> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error('문서 안의 항목이 너무 많습니다.');
  }

  let totalBytes = 0;
  for (const entry of entries) {
    await new Promise<void>((resolve, reject) => {
      const stream = entry.nodeStream('nodebuffer');
      stream.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_EXPANDED_BYTES) {
          stream.pause();
          reject(new Error(EXPANDED_TOO_LARGE_MESSAGE));
        }
      });
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
  }

  return zip;
}

/**
 * HWPX (한글 표준 OWPML ZIP 포맷)에서 텍스트/단락 추출
 */
async function parseHwpxBuffer(buffer: Buffer): Promise<string> {
  const zip = await assertZipWithinLimits(buffer);
  const sectionFiles = Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
    .sort();

  const paragraphs: string[] = [];

  for (const sectionPath of sectionFiles) {
    const xmlContent = await zip.files[sectionPath].async('string');
    // <hp:p ...>...</hp:p> 단위로 분리
    const pMatches = xmlContent.match(/<hp:p[\s>][\s\S]*?<\/hp:p>/gi) || [];
    for (const pXml of pMatches) {
      const tMatches = pXml.match(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/gi) || [];
      if (tMatches.length > 0) {
        const line = tMatches
          .map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, '')))
          .join('')
          .trim();
        if (line) {
          paragraphs.push(line);
        }
      }
    }
  }

  // 만약 section.xml에서 못 찾았을 경우 Preview/PrvText.txt 확인
  if (paragraphs.length === 0 && zip.files['Preview/PrvText.txt']) {
    const prv = await zip.files['Preview/PrvText.txt'].async('string');
    if (prv.trim()) return prv.trim();
  }

  return paragraphs.join('\n\n');
}

/**
 * HWP v5.0 (OLE Compound File Binary)에서 본문 텍스트 추출
 */
function parseHwpV5Buffer(buffer: Buffer): string {
  const container = CFB.read(buffer, { type: 'buffer' });

  // 1. FileHeader에서 압축 여부 확인 (offset 36, bit 0)
  const headerEntry = CFB.find(container, 'FileHeader');
  let isCompressed = true;
  if (headerEntry && headerEntry.content && headerEntry.content.length >= 40) {
    const headerBuf = Buffer.from(headerEntry.content);
    const flags = headerBuf.readUInt32LE(36);
    isCompressed = (flags & 0x01) !== 0;
  }

  // 2. BodyText/Section0, Section1... 순회하며 HWPTAG_PARA_TEXT (tagId = 67) 추출
  const paragraphs: string[] = [];
  const extendedInlineControls = new Set([
    1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23,
  ]);

  let expandedBytes = 0;

  for (let secIdx = 0; secIdx < 20; secIdx++) {
    const entry = CFB.find(container, `/BodyText/Section${secIdx}`);
    if (!entry || !entry.content) break;

    let streamBuf: Buffer = Buffer.from(entry.content as Uint8Array);
    if (isCompressed) {
      try {
        streamBuf = inflateRawSync(streamBuf, {
          maxOutputLength: MAX_EXPANDED_BYTES - expandedBytes,
        }) as Buffer;
        expandedBytes += streamBuf.length;
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
          throw new Error(EXPANDED_TOO_LARGE_MESSAGE);
        }
        // 그 밖의 압축 해제 실패 시 원본 유지
      }
    }

    let offset = 0;
    while (offset + 4 <= streamBuf.length) {
      const recordHeader = streamBuf.readUInt32LE(offset);
      offset += 4;

      const tagId = recordHeader & 0x3ff;
      let size = (recordHeader >>> 20) & 0xfff;

      if (size === 0xfff) {
        if (offset + 4 > streamBuf.length) break;
        size = streamBuf.readUInt32LE(offset);
        offset += 4;
      }

      if (offset + size > streamBuf.length) break;

      // HWPTAG_PARA_TEXT = 67 (0x43)
      if (tagId === 67 && size >= 2) {
        const recordBuf = streamBuf.subarray(offset, offset + size);
        const wcharCount = Math.floor(recordBuf.length / 2);
        let paraText = '';

        for (let i = 0; i < wcharCount; i++) {
          const code = recordBuf.readUInt16LE(i * 2);
          if (extendedInlineControls.has(code)) {
            i += 7; // 총 8 WCHAR(16바이트) 차지하는 확장 컨트롤 건너뛰기
          } else if (code === 9) {
            paraText += '\t';
          } else if (code === 10 || code === 13) {
            paraText += '\n';
          } else if (code >= 32) {
            paraText += String.fromCharCode(code);
          }
        }

        const cleaned = paraText.trim();
        if (cleaned) {
          paragraphs.push(cleaned);
        }
      }

      offset += size;
    }
  }

  if (paragraphs.length > 0) {
    return paragraphs.join('\n\n');
  }

  // 3. Fallback: PrvText 스트림 (UTF-16LE 미리보기 텍스트)
  const prvEntry = CFB.find(container, 'PrvText');
  if (prvEntry && prvEntry.content) {
    const prvBuf = Buffer.from(prvEntry.content);
    const prvText = prvBuf.toString('utf16le').replace(/\0/g, '').trim();
    if (prvText) {
      return prvText;
    }
  }

  return '';
}

/**
 * 업로드된 교안 파일(Word .docx, 한글 .hwp/.hwpx, 마크다운 .md, 텍스트 .txt)에서 마크다운 본문을 추출합니다.
 */
export async function parseUploadedDocument(
  fileName: string,
  buffer: Buffer
): Promise<ParsedDocumentResult> {
  const lower = fileName.toLowerCase();

  try {
    // 1. 마크다운 / 텍스트 파일
    if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
      const content = buffer.toString('utf-8').trim();
      return {
        success: true,
        fileName,
        markdown: content,
        formatLabel: lower.endsWith('.txt') ? '텍스트 문서 (.txt)' : '마크다운 문서 (.md)',
      };
    }

    // 2. MS Word (.docx)
    if (lower.endsWith('.docx')) {
      await assertZipWithinLimits(buffer);
      const htmlResult = await mammoth.convertToHtml({ buffer });
      let markdown = htmlToSimpleMarkdown(htmlResult.value);

      if (!markdown.trim()) {
        const rawResult = await mammoth.extractRawText({ buffer });
        markdown = rawResult.value.trim();
      }

      if (!markdown) {
        return {
          success: false,
          fileName,
          markdown: '',
          formatLabel: 'MS Word (.docx)',
          error: '워드 문서에서 텍스트를 찾을 수 없습니다.',
        };
      }

      return {
        success: true,
        fileName,
        markdown,
        formatLabel: 'MS Word (.docx)',
      };
    }

    // 3. 한글 표준 문서 (.hwpx) 또는 ZIP 시그니처(PK\x03\x04)를 가진 한글 파일
    const isZipHeader =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;

    if (lower.endsWith('.hwpx') || (lower.endsWith('.hwp') && isZipHeader)) {
      const markdown = await parseHwpxBuffer(buffer);
      if (!markdown) {
        return {
          success: false,
          fileName,
          markdown: '',
          formatLabel: '한글 문서 (.hwpx)',
          error: '한글(HWPX) 문서에서 본문 텍스트를 추출할 수 없습니다.',
        };
      }
      return {
        success: true,
        fileName,
        markdown,
        formatLabel: '한글 문서 (.hwpx)',
      };
    }

    // 4. 한글 5.0 문서 (.hwp)
    if (lower.endsWith('.hwp')) {
      const markdown = parseHwpV5Buffer(buffer);
      if (!markdown) {
        return {
          success: false,
          fileName,
          markdown: '',
          formatLabel: '한글 문서 (.hwp)',
          error:
            '한글(HWP) 문서에서 텍스트를 추출하지 못했습니다. 배포용 문서이거나 암호가 걸려있는지 확인해 주세요.',
        };
      }
      return {
        success: true,
        fileName,
        markdown,
        formatLabel: '한글 문서 (.hwp)',
      };
    }

    return {
      success: false,
      fileName,
      markdown: '',
      formatLabel: '알 수 없는 형식',
      error: '지원하지 않는 파일 형식입니다. (.md, .txt, .docx, .hwp, .hwpx 파일을 업로드해 주세요)',
    };
  } catch (err: unknown) {
    console.error('Document parse error:', err);
    return {
      success: false,
      fileName,
      markdown: '',
      formatLabel: '오류',
      error:
        '문서 파싱 중 오류가 발생했습니다: ' +
        (err instanceof Error ? err.message : '알 수 없는 오류'),
    };
  }
}
