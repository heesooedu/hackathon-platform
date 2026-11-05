// 서버(Vercel)는 UTC로 실행되므로, 시간대를 명시하지 않으면 서버와 브라우저의 시각이 어긋납니다.
export const KOREA_TIME_ZONE = 'Asia/Seoul';

const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const HAS_TIME_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

// datetime-local 입력값('2026-11-06T18:00')은 시간대가 없으므로 한국 시각으로 해석합니다.
export function koreaDatetimeLocalToIso(value: string): string {
  const withZone = HAS_TIME_ZONE.test(value) ? value : `${value}+09:00`;
  return new Date(withZone).toISOString();
}

// 저장된 시각을 datetime-local 입력값으로 되돌립니다. 한국은 일광 절약 시간이 없어 고정 오프셋을 씁니다.
export function toKoreaDatetimeLocal(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const time = new Date(isoString).getTime();
  if (Number.isNaN(time)) return '';
  return new Date(time + KOREA_OFFSET_MS).toISOString().slice(0, 16);
}
