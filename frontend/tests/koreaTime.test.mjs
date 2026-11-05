// 서버 시간대와 무관하게 마감 시각을 한국 시각으로 저장하고 되돌리는지 확인합니다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  KOREA_TIME_ZONE,
  koreaDatetimeLocalToIso,
  toKoreaDatetimeLocal,
} from '../src/utils/koreaTime.ts';

test('입력한 마감 시각을 한국 시각으로 저장한다', () => {
  assert.equal(koreaDatetimeLocalToIso('2026-11-06T18:00'), '2026-11-06T09:00:00.000Z');
});

test('시간대가 있는 값은 그대로 해석한다', () => {
  assert.equal(koreaDatetimeLocalToIso('2026-11-06T09:00:00.000Z'), '2026-11-06T09:00:00.000Z');
  assert.equal(koreaDatetimeLocalToIso('2026-11-06T18:00:00+09:00'), '2026-11-06T09:00:00.000Z');
});

test('저장과 불러오기를 반복해도 마감 시각이 밀리지 않는다', () => {
  let value = '2026-11-06T18:00';
  for (let i = 0; i < 3; i += 1) {
    value = toKoreaDatetimeLocal(koreaDatetimeLocalToIso(value));
  }
  assert.equal(value, '2026-11-06T18:00');
});

test('날짜를 넘기는 시각도 한국 날짜로 되돌린다', () => {
  assert.equal(toKoreaDatetimeLocal('2026-11-05T15:30:00.000Z'), '2026-11-06T00:30');
});

test('값이 없거나 잘못되면 빈 입력값을 돌려준다', () => {
  assert.equal(toKoreaDatetimeLocal(null), '');
  assert.equal(toKoreaDatetimeLocal('잘못된 값'), '');
});

test('표시용 시간대는 서버 시간대와 무관하게 같은 시각을 만든다', () => {
  const text = new Date('2026-11-05T14:59:00.000Z').toLocaleString('ko-KR', {
    timeZone: KOREA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
  assert.match(text, /오후 11:59/);
});
