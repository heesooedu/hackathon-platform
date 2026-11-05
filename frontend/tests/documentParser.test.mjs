// 문서 파서 시험: 정상 문서는 읽고, 압축 폭탄은 메모리를 소모하기 전에 거부하는지 확인합니다.
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { test } from 'node:test';
import * as CFB from 'cfb';
import JSZip from 'jszip';
import { parseUploadedDocument } from '../src/utils/documentParser.ts';

const BOMB_BYTES = 200 * 1024 * 1024;

function hwpFile(sectionBytes) {
  const header = Buffer.alloc(256);
  header.writeUInt32LE(1, 36); // 압축 사용
  const container = CFB.utils.cfb_new();
  CFB.utils.cfb_add(container, 'FileHeader', header);
  CFB.utils.cfb_add(container, 'BodyText/Section0', deflateRawSync(sectionBytes));
  return Buffer.from(CFB.write(container, { type: 'buffer' }));
}

function paraTextRecord(text) {
  const body = Buffer.from(text, 'utf16le');
  const head = Buffer.alloc(4);
  head.writeUInt32LE((body.length << 20) | 67);
  return Buffer.concat([head, body]);
}

async function zipFile(files) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

test('정상 HWPX 문서를 읽는다', async () => {
  const file = await zipFile({
    'Contents/section0.xml': '<hp:p id="1"><hp:t>안녕하세요</hp:t></hp:p>',
  });
  const res = await parseUploadedDocument('a.hwpx', file);
  assert.equal(res.success, true);
  assert.equal(res.markdown, '안녕하세요');
});

test('정상 HWP 문서를 읽는다', async () => {
  const res = await parseUploadedDocument('a.hwp', hwpFile(paraTextRecord('본문입니다')));
  assert.equal(res.success, true);
  assert.equal(res.markdown, '본문입니다');
});

test('HWPX 압축 폭탄을 거부한다', async () => {
  const file = await zipFile({ 'Contents/section0.xml': Buffer.alloc(BOMB_BYTES) });
  assert.ok(file.length < 1024 * 1024, '시험 파일은 작아야 함');
  const res = await parseUploadedDocument('bomb.hwpx', file);
  assert.equal(res.success, false);
  assert.match(res.error, /압축을 풀면/);
});

test('DOCX 압축 폭탄을 mammoth에 넘기기 전에 거부한다', async () => {
  const file = await zipFile({ 'word/document.xml': Buffer.alloc(BOMB_BYTES) });
  const res = await parseUploadedDocument('bomb.docx', file);
  assert.equal(res.success, false);
  assert.match(res.error, /압축을 풀면/);
});

test('항목이 지나치게 많은 압축 파일을 거부한다', async () => {
  const files = {};
  for (let i = 0; i < 5001; i++) files[`f${i}.txt`] = '';
  const res = await parseUploadedDocument('many.hwpx', await zipFile(files));
  assert.equal(res.success, false);
  assert.match(res.error, /항목이 너무 많습니다/);
});

test('HWP 압축 폭탄을 거부한다', async () => {
  const res = await parseUploadedDocument('bomb.hwp', hwpFile(Buffer.alloc(BOMB_BYTES)));
  assert.equal(res.success, false);
  assert.match(res.error, /압축을 풀면/);
});
