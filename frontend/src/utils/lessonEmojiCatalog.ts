/**
 * 교안 편집기용 표준 유니코드(Unicode) 이모지·숫자·기호 카탈로그
 *
 * [저작권 안내]
 * 본 카탈로그의 모든 문자와 기호는 국제 표준 ISO/IEC 10646 및 Unicode Consortium 표준 코드포인트(텍스트 문자)를 사용합니다.
 * 외부 상용 이미지 에셋을 일절 사용하지 않으며, 운영체제·브라우저 표준 시스템 폰트로 렌더링되므로
 * 교육용·상업용 구분 없이 저작권 문제(라이선스 제약)가 전혀 없습니다.
 */

export type EmojiCategoryId =
  | 'numbers'
  | 'symbols'
  | 'arrows'
  | 'math_science'
  | 'cs_ai'
  | 'classroom'
  | 'faces';

export interface EmojiSymbolItem {
  char: string;
  label: string;
  keywords: string[];
}

export interface EmojiSymbolSubgroup {
  title: string;
  items: EmojiSymbolItem[];
}

export interface EmojiSymbolCategory {
  id: EmojiCategoryId;
  label: string;
  badge: string;
  description: string;
  subgroups: EmojiSymbolSubgroup[];
}

export const DEFAULT_RECENT_EMOJIS: string[] = [
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '①',
  '②',
  '③',
  '➊',
  '➋',
  '➌',
  '💡',
  '📌',
  '✅',
  '⚠️',
  '❗',
  '❓',
  '→',
  '⇒',
  '★',
  '※',
  '💻',
  '🤖',
  '📊',
  '⚡',
  '🔬',
];

export const QUICK_SEQUENCE_PRESETS: {
  id: string;
  label: string;
  sample: string;
  items: string[];
}[] = [
  {
    id: 'keycap_1_5',
    label: '키캡 1~5',
    sample: '1️⃣ 2️⃣ 3️⃣',
    items: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'],
  },
  {
    id: 'black_circle_1_5',
    label: '검은 원문자 1~5',
    sample: '➊ ➋ ➌',
    items: ['➊', '➋', '➌', '➍', '➎'],
  },
  {
    id: 'white_circle_1_5',
    label: '흰 원문자 1~5',
    sample: '① ② ③',
    items: ['①', '②', '③', '④', '⑤'],
  },
  {
    id: 'hangul_circle',
    label: '한글 원문자 ㉠~㉤',
    sample: '㉠ ㉡ ㉢',
    items: ['㉠', '㉡', '㉢', '㉣', '㉤'],
  },
  {
    id: 'roman_1_5',
    label: '로마 숫자 Ⅰ~Ⅴ',
    sample: 'Ⅰ Ⅱ Ⅲ',
    items: ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'],
  },
  {
    id: 'ox_check',
    label: '정오답 ⭕/❌/✅',
    sample: '⭕ ❌ ✅',
    items: ['⭕', '❌', '✅', '⚠️', '❓'],
  },
];

export const LESSON_EMOJI_SYMBOL_CATEGORIES: EmojiSymbolCategory[] = [
  {
    id: 'numbers',
    label: '숫자·원문자',
    badge: '🔢',
    description: '단계 표시용 키캡 숫자, 검은/흰 원문자, 로마 숫자, 한글·영문 보기 기호, 위·아래첨자',
    subgroups: [
      {
        title: '키캡 숫자 & 번호 이모지',
        items: [
          { char: '0️⃣', label: '키캡 숫자 0', keywords: ['0', '숫자', '번호', '키캡', 'zero'] },
          { char: '1️⃣', label: '키캡 숫자 1 (1단계)', keywords: ['1', '숫자', '번호', '1단계', '첫째', 'one'] },
          { char: '2️⃣', label: '키캡 숫자 2 (2단계)', keywords: ['2', '숫자', '번호', '2단계', '둘째', 'two'] },
          { char: '3️⃣', label: '키캡 숫자 3 (3단계)', keywords: ['3', '숫자', '번호', '3단계', '셋째', 'three'] },
          { char: '4️⃣', label: '키캡 숫자 4 (4단계)', keywords: ['4', '숫자', '번호', '4단계', 'four'] },
          { char: '5️⃣', label: '키캡 숫자 5 (5단계)', keywords: ['5', '숫자', '번호', '5단계', 'five'] },
          { char: '6️⃣', label: '키캡 숫자 6', keywords: ['6', '숫자', '번호', 'six'] },
          { char: '7️⃣', label: '키캡 숫자 7', keywords: ['7', '숫자', '번호', 'seven'] },
          { char: '8️⃣', label: '키캡 숫자 8', keywords: ['8', '숫자', '번호', 'eight'] },
          { char: '9️⃣', label: '키캡 숫자 9', keywords: ['9', '숫자', '번호', 'nine'] },
          { char: '🔟', label: '키캡 숫자 10', keywords: ['10', '숫자', '번호', 'ten'] },
          { char: '#️⃣', label: '해시/번호 기호', keywords: ['해시', '샵', '번호', '숫자', 'hash'] },
          { char: '*️⃣', label: '별표 키캡', keywords: ['별표', '키캡', '기호', 'star'] },
          { char: '🔢', label: '숫자 입력 기호', keywords: ['숫자', '번호', '수학', 'number'] },
        ],
      },
      {
        title: '검은 원문자 (강조 단계 번호 ➊~⓯)',
        items: [
          { char: '➊', label: '검은 원문자 1', keywords: ['1', '원문자', '검은원문자', '번호', '단계'] },
          { char: '➋', label: '검은 원문자 2', keywords: ['2', '원문자', '검은원문자', '번호', '단계'] },
          { char: '➌', label: '검은 원문자 3', keywords: ['3', '원문자', '검은원문자', '번호', '단계'] },
          { char: '➍', label: '검은 원문자 4', keywords: ['4', '원문자', '검은원문자', '번호', '단계'] },
          { char: '➎', label: '검은 원문자 5', keywords: ['5', '원문자', '검은원문자', '번호', '단계'] },
          { char: '➏', label: '검은 원문자 6', keywords: ['6', '원문자', '검은원문자', '번호'] },
          { char: '➐', label: '검은 원문자 7', keywords: ['7', '원문자', '검은원문자', '번호'] },
          { char: '➑', label: '검은 원문자 8', keywords: ['8', '원문자', '검은원문자', '번호'] },
          { char: '➒', label: '검은 원문자 9', keywords: ['9', '원문자', '검은원문자', '번호'] },
          { char: '➓', label: '검은 원문자 10', keywords: ['10', '원문자', '검은원문자', '번호'] },
          { char: '⓫', label: '검은 원문자 11', keywords: ['11', '원문자', '검은원문자', '번호'] },
          { char: '⓬', label: '검은 원문자 12', keywords: ['12', '원문자', '검은원문자', '번호'] },
          { char: '⓭', label: '검은 원문자 13', keywords: ['13', '원문자', '검은원문자', '번호'] },
          { char: '⓮', label: '검은 원문자 14', keywords: ['14', '원문자', '검은원문자', '번호'] },
          { char: '⓯', label: '검은 원문자 15', keywords: ['15', '원문자', '검은원문자', '번호'] },
        ],
      },
      {
        title: '흰 원문자 (문항·보기 번호 ①~⑳)',
        items: [
          { char: '①', label: '원문자 1', keywords: ['1', '원문자', '동그라미', '번호', '문항', '선지'] },
          { char: '②', label: '원문자 2', keywords: ['2', '원문자', '동그라미', '번호', '문항', '선지'] },
          { char: '③', label: '원문자 3', keywords: ['3', '원문자', '동그라미', '번호', '문항', '선지'] },
          { char: '④', label: '원문자 4', keywords: ['4', '원문자', '동그라미', '번호', '문항', '선지'] },
          { char: '⑤', label: '원문자 5', keywords: ['5', '원문자', '동그라미', '번호', '문항', '선지'] },
          { char: '⑥', label: '원문자 6', keywords: ['6', '원문자', '동그라미', '번호'] },
          { char: '⑦', label: '원문자 7', keywords: ['7', '원문자', '동그라미', '번호'] },
          { char: '⑧', label: '원문자 8', keywords: ['8', '원문자', '동그라미', '번호'] },
          { char: '⑨', label: '원문자 9', keywords: ['9', '원문자', '동그라미', '번호'] },
          { char: '⑩', label: '원문자 10', keywords: ['10', '원문자', '동그라미', '번호'] },
          { char: '⑪', label: '원문자 11', keywords: ['11', '원문자', '번호'] },
          { char: '⑫', label: '원문자 12', keywords: ['12', '원문자', '번호'] },
          { char: '⑬', label: '원문자 13', keywords: ['13', '원문자', '번호'] },
          { char: '⑭', label: '원문자 14', keywords: ['14', '원문자', '번호'] },
          { char: '⑮', label: '원문자 15', keywords: ['15', '원문자', '번호'] },
          { char: '⑯', label: '원문자 16', keywords: ['16', '원문자', '번호'] },
          { char: '⑰', label: '원문자 17', keywords: ['17', '원문자', '번호'] },
          { char: '⑱', label: '원문자 18', keywords: ['18', '원문자', '번호'] },
          { char: '⑲', label: '원문자 19', keywords: ['19', '원문자', '번호'] },
          { char: '⑳', label: '원문자 20', keywords: ['20', '원문자', '번호'] },
        ],
      },
      {
        title: '괄호 숫자 & 로마 숫자 (단원·소주제 번호)',
        items: [
          { char: '⑴', label: '괄호 숫자 1', keywords: ['1', '괄호', '숫자', '번호'] },
          { char: '⑵', label: '괄호 숫자 2', keywords: ['2', '괄호', '숫자', '번호'] },
          { char: '⑶', label: '괄호 숫자 3', keywords: ['3', '괄호', '숫자', '번호'] },
          { char: '⑷', label: '괄호 숫자 4', keywords: ['4', '괄호', '숫자', '번호'] },
          { char: '⑸', label: '괄호 숫자 5', keywords: ['5', '괄호', '숫자', '번호'] },
          { char: 'Ⅰ', label: '로마 숫자 1 (대문자)', keywords: ['1', '로마', '로마숫자', '단원', 'roman'] },
          { char: 'Ⅱ', label: '로마 숫자 2 (대문자)', keywords: ['2', '로마', '로마숫자', '단원', 'roman'] },
          { char: 'Ⅲ', label: '로마 숫자 3 (대문자)', keywords: ['3', '로마', '로마숫자', '단원', 'roman'] },
          { char: 'Ⅳ', label: '로마 숫자 4 (대문자)', keywords: ['4', '로마', '로마숫자', '단원', 'roman'] },
          { char: 'Ⅴ', label: '로마 숫자 5 (대문자)', keywords: ['5', '로마', '로마숫자', '단원', 'roman'] },
          { char: 'Ⅵ', label: '로마 숫자 6 (대문자)', keywords: ['6', '로마', '로마숫자', 'roman'] },
          { char: 'Ⅶ', label: '로마 숫자 7 (대문자)', keywords: ['7', '로마', '로마숫자', 'roman'] },
          { char: 'Ⅷ', label: '로마 숫자 8 (대문자)', keywords: ['8', '로마', '로마숫자', 'roman'] },
          { char: 'Ⅸ', label: '로마 숫자 9 (대문자)', keywords: ['9', '로마', '로마숫자', 'roman'] },
          { char: 'Ⅹ', label: '로마 숫자 10 (대문자)', keywords: ['10', '로마', '로마숫자', 'roman'] },
          { char: 'ⅰ', label: '로마 숫자 1 (소문자)', keywords: ['1', '로마', '소문자'] },
          { char: 'ⅱ', label: '로마 숫자 2 (소문자)', keywords: ['2', '로마', '소문자'] },
          { char: 'ⅲ', label: '로마 숫자 3 (소문자)', keywords: ['3', '로마', '소문자'] },
          { char: 'ⅳ', label: '로마 숫자 4 (소문자)', keywords: ['4', '로마', '소문자'] },
          { char: 'ⅴ', label: '로마 숫자 5 (소문자)', keywords: ['5', '로마', '소문자'] },
        ],
      },
      {
        title: '한글·알파벳 원문자 (시험 보기·선지용)',
        items: [
          { char: '㉠', label: '원문자 기역 (보기 ㉠)', keywords: ['ㄱ', '기역', '한글', '보기', '원문자', '선지'] },
          { char: '㉡', label: '원문자 니은 (보기 ㉡)', keywords: ['ㄴ', '니은', '한글', '보기', '원문자', '선지'] },
          { char: '㉢', label: '원문자 디귿 (보기 ㉢)', keywords: ['ㄷ', '디귿', '한글', '보기', '원문자', '선지'] },
          { char: '㉣', label: '원문자 리을 (보기 ㉣)', keywords: ['ㄹ', '리을', '한글', '보기', '원문자', '선지'] },
          { char: '㉤', label: '원문자 미음 (보기 ㉤)', keywords: ['ㅁ', '미음', '한글', '보기', '원문자'] },
          { char: '㉥', label: '원문자 비읍 (보기 ㉥)', keywords: ['ㅂ', '비읍', '한글', '보기', '원문자'] },
          { char: '㉦', label: '원문자 시옷 (보기 ㉦)', keywords: ['ㅅ', '시옷', '한글', '보기', '원문자'] },
          { char: '㉧', label: '원문자 이응 (보기 ㉧)', keywords: ['ㅇ', '이응', '한글', '보기', '원문자'] },
          { char: 'ⓐ', label: '원문자 a', keywords: ['a', '알파벳', '원문자', '영어'] },
          { char: 'ⓑ', label: '원문자 b', keywords: ['b', '알파벳', '원문자', '영어'] },
          { char: 'ⓒ', label: '원문자 c', keywords: ['c', '알파벳', '원문자', '영어'] },
          { char: 'ⓓ', label: '원문자 d', keywords: ['d', '알파벳', '원문자', '영어'] },
          { char: 'ⓔ', label: '원문자 e', keywords: ['e', '알파벳', '원문자', '영어'] },
          { char: 'Ⓐ', label: '원문자 A', keywords: ['A', '알파벳', '원문자', '영어'] },
          { char: 'Ⓑ', label: '원문자 B', keywords: ['B', '알파벳', '원문자', '영어'] },
          { char: 'Ⓒ', label: '원문자 C', keywords: ['C', '알파벳', '원문자', '영어'] },
          { char: 'Ⓓ', label: '원문자 D', keywords: ['D', '알파벳', '원문자', '영어'] },
          { char: 'Ⓔ', label: '원문자 E', keywords: ['E', '알파벳', '원문자', '영어'] },
        ],
      },
      {
        title: '위첨자·아래첨자·분수 (지수·수식·화학식)',
        items: [
          { char: '⁰', label: '위첨자 0', keywords: ['0', '위첨자', '지수', '제곱'] },
          { char: '¹', label: '위첨자 1', keywords: ['1', '위첨자', '지수', '1제곱'] },
          { char: '²', label: '위첨자 2 (제곱)', keywords: ['2', '위첨자', '지수', '제곱', 'square'] },
          { char: '³', label: '위첨자 3 (세제곱)', keywords: ['3', '위첨자', '지수', '세제곱', 'cube'] },
          { char: '⁴', label: '위첨자 4', keywords: ['4', '위첨자', '지수'] },
          { char: '⁵', label: '위첨자 5', keywords: ['5', '위첨자', '지수'] },
          { char: '⁶', label: '위첨자 6', keywords: ['6', '위첨자', '지수'] },
          { char: '⁷', label: '위첨자 7', keywords: ['7', '위첨자', '지수'] },
          { char: '⁸', label: '위첨자 8', keywords: ['8', '위첨자', '지수'] },
          { char: '⁹', label: '위첨자 9', keywords: ['9', '위첨자', '지수'] },
          { char: 'ⁿ', label: '위첨자 n (n제곱 / O(2ⁿ))', keywords: ['n', '위첨자', '지수', '시간복잡도'] },
          { char: '⁺', label: '위첨자 + (양이온)', keywords: ['+', '위첨자', '이온'] },
          { char: '⁻', label: '위첨자 - (음이온/역수)', keywords: ['-', '위첨자', '이온', '마이너스'] },
          { char: '₀', label: '아래첨자 0 (초깃값 x₀)', keywords: ['0', '아래첨자', '첨자', '화학식'] },
          { char: '₁', label: '아래첨자 1 (x₁)', keywords: ['1', '아래첨자', '첨자', '화학식'] },
          { char: '₂', label: '아래첨자 2 (H₂O, CO₂, 이진수)', keywords: ['2', '아래첨자', '첨자', '화학식', '이진수'] },
          { char: '₃', label: '아래첨자 3', keywords: ['3', '아래첨자', '첨자', '화학식'] },
          { char: '₄', label: '아래첨자 4 (CH₄)', keywords: ['4', '아래첨자', '첨자', '화학식'] },
          { char: '½', label: '분수 1/2', keywords: ['분수', '절반', '1/2'] },
          { char: '⅓', label: '분수 1/3', keywords: ['분수', '1/3'] },
          { char: '⅔', label: '분수 2/3', keywords: ['분수', '2/3'] },
          { char: '¼', label: '분수 1/4', keywords: ['분수', '1/4'] },
          { char: '¾', label: '분수 3/4', keywords: ['분수', '3/4'] },
        ],
      },
    ],
  },
  {
    id: 'symbols',
    label: '기호·강조·체크',
    badge: '✅',
    description: '정오답(O/X), 체크 표시, 주의·경고, 핵심 포인트 핀, 별표·당구장(※)·도형 기호',
    subgroups: [
      {
        title: '체크·정오답(O/X)·경고·중요 표시',
        items: [
          { char: '✅', label: '초록 체크 박스 (확인/정답)', keywords: ['체크', '확인', '정답', '완료', 'check'] },
          { char: '☑️', label: '파란 체크 박스', keywords: ['체크', '선택', '완료', 'check'] },
          { char: '✔️', label: '굵은 체크 기호', keywords: ['체크', '확인', '맞음'] },
          { char: '⭕', label: '동그라미 O (참/맞음)', keywords: ['o', '동그라미', '정답', '참', '맞음', 'ox'] },
          { char: '❌', label: '엑스 X (거짓/오답)', keywords: ['x', '엑스', '오답', '틀림', '거짓', 'ox'] },
          { char: '❎', label: '초록 배경 엑스', keywords: ['x', '엑스', '취소'] },
          { char: '⚠️', label: '주의 / 경고 표지', keywords: ['주의', '경고', '조심', '오개념', 'warning'] },
          { char: '🚫', label: '금지 / 불가 표시', keywords: ['금지', '안됨', '불가', '주의'] },
          { char: '⛔', label: '진입 금지 / 제한', keywords: ['금지', '제한', '차단'] },
          { char: '❗', label: '빨간 느낌표 (중요 강조)', keywords: ['느낌표', '중요', '강조', '필수'] },
          { char: '❕', label: '하얀 느낌표', keywords: ['느낌표', '참고'] },
          { char: '❓', label: '빨간 물음표 (핵심 질문)', keywords: ['물음표', '질문', '퀴즈', '궁금'] },
          { char: '❔', label: '하얀 물음표', keywords: ['물음표', '질문'] },
          { char: '‼️', label: '이중 느낌표 (매우 중요)', keywords: ['느낌표', '매우중요', '강조'] },
          { char: '⁉️', label: '느낌표 물음표 (탐구 질문)', keywords: ['느낌표', '물음표', '호기심', '탐구'] },
          { char: '💯', label: '100점 만점 / 완벽', keywords: ['100', '백점', '만점', '완벽', '핵심'] },
          { char: '🔥', label: '불꽃 (시험 빈출 / 핵심)', keywords: ['불', '핵심', '빈출', '중요', '핫'] },
          { char: '✨', label: '반짝임 (새 개념 / 팁)', keywords: ['반짝', '별', '팁', '핵심', '강조'] },
          { char: '⭐', label: '별 (중요도 표시)', keywords: ['별', '중요', '별표', 'star'] },
          { char: '🌟', label: '빛나는 별 (핵심 성취)', keywords: ['별', '중요', '성취', '핵심'] },
        ],
      },
      {
        title: '핵심 포인트·핀·말풍선·아이콘',
        items: [
          { char: '💡', label: '전구 (핵심 아이디어 / 팁)', keywords: ['전구', '팁', '아이디어', '개념', '힌트'] },
          { char: '📌', label: '압정 (기억할 점 / 고정)', keywords: ['압정', '핀', '고정', '핵심', '기억'] },
          { char: '📍', label: '위치 핀 (주요 포인트)', keywords: ['핀', '포인트', '위치'] },
          { char: '🎯', label: '과녁 (학습 목표 / 핵심)', keywords: ['과녁', '목표', '학습목표', '정확'] },
          { char: '🚩', label: '깃발 (체크포인트 / 목표)', keywords: ['깃발', '체크포인트', '단계'] },
          { char: '🏁', label: '도착 깃발 (마무리 / 완주)', keywords: ['깃발', '마무리', '결론', '완료'] },
          { char: '🔖', label: '북마크 / 책갈피', keywords: ['북마크', '책갈피', '참고'] },
          { char: '🏷️', label: '태그 / 키워드 라벨', keywords: ['태그', '키워드', '용어'] },
          { char: '🔑', label: '열쇠 (핵심 열쇠 / 해법)', keywords: ['열쇠', '핵심', '해법', '힌트', '키'] },
          { char: '🔔', label: '종 (알림 / 공지)', keywords: ['종', '알림', '공지', '기억'] },
          { char: '📢', label: '확성기 (안내 / 발표)', keywords: ['확성기', '안내', '공지', '발표'] },
          { char: '💬', label: '말풍선 (토론 / 의견)', keywords: ['말풍선', '대화', '토론', '질문', '의견'] },
          { char: '💭', label: '생각 풍선 (생각해보기)', keywords: ['생각', '고민', '탐구', '사고'] },
          { char: '🗯️', label: '강조 말풍선', keywords: ['말풍선', '강조', '발언'] },
          { char: '💎', label: '보석 (심화 / 핵심 가치)', keywords: ['보석', '다이아', '심화', '가치'] },
          { char: '🏆', label: '트로피 (도전 과제 / 성취)', keywords: ['트로피', '우승', '도전', '미션'] },
          { char: '🥇', label: '금메달 (1순위)', keywords: ['금메달', '1등', '최우수'] },
          { char: '🥈', label: '은메달 (2순위)', keywords: ['은메달', '2등'] },
          { char: '🥉', label: '동메달 (3순위)', keywords: ['동메달', '3등'] },
        ],
      },
      {
        title: '교안 문서 특수기호 & 도형 기호',
        items: [
          { char: '※', label: '당구장 표시 (참고/주의사항)', keywords: ['당구장', '참고', '주의', '비고', '특수기호'] },
          { char: '★', label: '검은 별표 (중요)', keywords: ['별', '별표', '검은별', '중요', '기호'] },
          { char: '☆', label: '흰 별표', keywords: ['별', '별표', '흰별', '기호'] },
          { char: '✦', label: '네갈래 검은 별', keywords: ['별', '반짝', '기호'] },
          { char: '✧', label: '네갈래 흰 별', keywords: ['별', '반짝', '기호'] },
          { char: '●', label: '검은 원 (글머리)', keywords: ['원', '동그라미', '검은원', '글머리', '도형'] },
          { char: '○', label: '흰 원 (하위 글머리)', keywords: ['원', '동그라미', '흰원', '글머리', '도형'] },
          { char: '◎', label: '이중 원 (핵심 항목)', keywords: ['이중원', '동그라미', '강조', '도형'] },
          { char: '◉', label: '과녁 원', keywords: ['원', '도형', '포인트'] },
          { char: '◆', label: '검은 마름모', keywords: ['마름모', '다이아', '글머리', '도형'] },
          { char: '◇', label: '흰 마름모', keywords: ['마름모', '다이아', '글머리', '도형'] },
          { char: '◈', label: '이중 마름모', keywords: ['마름모', '다이아', '글머리', '도형'] },
          { char: '■', label: '검은 사각형', keywords: ['사각형', '네모', '글머리', '도형'] },
          { char: '□', label: '흰 사각형 (빈칸/체크박스)', keywords: ['사각형', '네모', '빈칸', '체크박스', '도형'] },
          { char: '▪', label: '작은 검은 사각형', keywords: ['사각형', '네모', '글머리'] },
          { char: '▫', label: '작은 흰 사각형', keywords: ['사각형', '네모', '글머리'] },
          { char: '▲', label: '검은 위쪽 삼각형', keywords: ['삼각형', '세모', '증가', '도형'] },
          { char: '△', label: '흰 위쪽 삼각형', keywords: ['삼각형', '세모', '도형'] },
          { char: '▼', label: '검은 아래쪽 삼각형', keywords: ['삼각형', '세모', '감소', '도형'] },
          { char: '▽', label: '흰 아래쪽 삼각형', keywords: ['삼각형', '세모', '도형'] },
          { char: '▶', label: '검은 오른쪽 삼각형', keywords: ['삼각형', '화살표', '소제목', '글머리'] },
          { char: '▷', label: '흰 오른쪽 삼각형', keywords: ['삼각형', '화살표', '소제목', '글머리'] },
          { char: '✓', label: '체크 기호 (얇은형)', keywords: ['체크', '확인', '맞음', '기호'] },
          { char: '✔', label: '체크 기호 (굵은형)', keywords: ['체크', '확인', '맞음', '기호'] },
          { char: '✗', label: '엑스 기호 (얇은형)', keywords: ['엑스', '틀림', '기호'] },
          { char: '✘', label: '엑스 기호 (굵은형)', keywords: ['엑스', '틀림', '기호'] },
          { char: '「', label: '낫표 열기', keywords: ['괄호', '낫표', '인용'] },
          { char: '」', label: '낫표 닫기', keywords: ['괄호', '낫표', '인용'] },
          { char: '『', label: '겹낫표 열기 (책·작품명)', keywords: ['괄호', '겹낫표', '인용'] },
          { char: '』', label: '겹낫표 닫기', keywords: ['괄호', '겹낫표', '인용'] },
          { char: '【', label: '검은 괄호 열기 (단원/주제)', keywords: ['괄호', '대괄호', '주제', '제목'] },
          { char: '】', label: '검은 괄호 닫기', keywords: ['괄호', '대괄호', '주제', '제목'] },
          { char: '《', label: '겹화살괄호 열기', keywords: ['괄호', '제목'] },
          { char: '》', label: '겹화살괄호 닫기', keywords: ['괄호', '제목'] },
        ],
      },
    ],
  },
  {
    id: 'arrows',
    label: '화살표·흐름',
    badge: '➡️',
    description: '원인→결과, 단계 진행, 양방향 관계, 순환·반복을 나타내는 화살표 이모지 및 수학 화살표',
    subgroups: [
      {
        title: '유니코드 화살표 기호 (인과관계·순서·유도)',
        items: [
          { char: '→', label: '오른쪽 화살표 (진행/결과)', keywords: ['화살표', '오른쪽', '결과', '진행', 'arrow'] },
          { char: '←', label: '왼쪽 화살표 (역방향/대입)', keywords: ['화살표', '왼쪽', '대입'] },
          { char: '↑', label: '위쪽 화살표 (상승/증가)', keywords: ['화살표', '위', '증가', '상승', '비례'] },
          { char: '↓', label: '아래쪽 화살표 (하락/감소)', keywords: ['화살표', '아래', '감소', '하락'] },
          { char: '↔', label: '양방향 화살표 (상호작용/대조)', keywords: ['화살표', '양방향', '상호작용', '비교', '대조'] },
          { char: '↕', label: '상하 양방향 화살표', keywords: ['화살표', '상하', '수직'] },
          { char: '⇒', label: '이중 오른쪽 화살표 (논리적 결론/유도)', keywords: ['화살표', '이중화살표', '결론', '유도', '이면'] },
          { char: '⇐', label: '이중 왼쪽 화살표', keywords: ['화살표', '이중화살표'] },
          { char: '⇔', label: '이중 양방향 화살표 (필요충분조건/동치)', keywords: ['화살표', '동치', '필요충분', '양방향'] },
          { char: '⟶', label: '긴 오른쪽 화살표', keywords: ['화살표', '긴화살표', '변환'] },
          { char: '⟹', label: '긴 이중 오른쪽 화살표', keywords: ['화살표', '긴화살표', '결론'] },
          { char: '⟺', label: '긴 이중 양방향 화살표', keywords: ['화살표', '긴화살표', '동치'] },
          { char: '↦', label: '함수 대응 화살표 (x ↦ y)', keywords: ['화살표', '함수', '대응', '매핑'] },
          { char: '↪', label: '오른쪽 꺾인 화살표 (부연 설명/하위)', keywords: ['화살표', '꺾인화살표', '부연', '하위', '들여쓰기'] },
          { char: '↩', label: '왼쪽 꺾인 화살표 (리턴/되돌아감)', keywords: ['화살표', '엔터', '리턴'] },
          { char: '➜', label: '굵은 오른쪽 화살표', keywords: ['화살표', '굵은화살표', '강조'] },
          { char: '➔', label: '뾰족한 오른쪽 화살표', keywords: ['화살표', '강조'] },
          { char: '➤', label: '화살촉 기호 (핵심 지시)', keywords: ['화살표', '화살촉', '지시', '글머리'] },
          { char: '➢', label: '입체 화살촉 기호', keywords: ['화살표', '화살촉', '글머리'] },
          { char: '↗', label: '우상향 화살표 (비례/성장)', keywords: ['화살표', '대각선', '우상향', '증가'] },
          { char: '↘', label: '우하향 화살표 (반비례/감소)', keywords: ['화살표', '대각선', '우하향', '감소'] },
          { char: '∴', label: '따라서 (결론 기호)', keywords: ['따라서', '그러므로', '결론', '수학', '논리'] },
          { char: '∵', label: '왜냐하면 (이유 기호)', keywords: ['왜냐하면', '이유', '근거', '수학', '논리'] },
        ],
      },
      {
        title: '컬러 화살표 & 반복·순환 이모지',
        items: [
          { char: '➡️', label: '오른쪽 화살표 이모지', keywords: ['화살표', '다음', '오른쪽'] },
          { char: '⬅️', label: '왼쪽 화살표 이모지', keywords: ['화살표', '이전', '왼쪽'] },
          { char: '⬆️', label: '위쪽 화살표 이모지', keywords: ['화살표', '위', '상승'] },
          { char: '⬇️', label: '아래쪽 화살표 이모지', keywords: ['화살표', '아래', '하강'] },
          { char: '↗️', label: '북동쪽 화살표 이모지', keywords: ['화살표', '증가'] },
          { char: '↘️', label: '남동쪽 화살표 이모지', keywords: ['화살표', '감소'] },
          { char: '↔️', label: '좌우 화살표 이모지', keywords: ['화살표', '양방향'] },
          { char: '↕️', label: '상하 화살표 이모지', keywords: ['화살표', '상하'] },
          { char: '↩️', label: '되돌아가기 화살표', keywords: ['화살표', '되돌리기', '리턴'] },
          { char: '↪️', label: '하위 단계 화살표', keywords: ['화살표', '하위', '단계'] },
          { char: '⤴️', label: '위로 꺾인 화살표', keywords: ['화살표', '상승'] },
          { char: '⤵️', label: '아래로 꺾인 화살표', keywords: ['화살표', '하강', '다음줄'] },
          { char: '🔄', label: '순환 / 반복문(Loop) / 새로고침', keywords: ['순환', '반복', '반복문', '루프', '업데이트'] },
          { char: '🔃', label: '세로 순환 화살표', keywords: ['순환', '사이클'] },
          { char: '🔁', label: '반복 재생 (while/for 루프)', keywords: ['반복', '루프', '순환'] },
          { char: '🔀', label: '교차 / 셔플 / 분기', keywords: ['교차', '무작위', '셔플', '조건분기'] },
          { char: '▶️', label: '실행 / 시작 버튼', keywords: ['실행', '시작', '플레이', '화살표'] },
          { char: '⏩', label: '빠른 진행 / 다음 단계', keywords: ['빠르게', '다음', '스킵'] },
        ],
      },
    ],
  },
  {
    id: 'math_science',
    label: '수학·논리·단위',
    badge: '🧮',
    description: '사칙연산, 부등호, 집합·명제·논리 연산(정보·이산수학), 그리스 문자, 과학·전자 단위(Ω, ℃ 등)',
    subgroups: [
      {
        title: '연산·비교·관계 기호',
        items: [
          { char: '＋', label: '더하기', keywords: ['더하기', '플러스', '연산'] },
          { char: '－', label: '빼기', keywords: ['빼기', '마이너스', '연산'] },
          { char: '×', label: '곱하기 (곱셈 기호)', keywords: ['곱하기', '곱셈', '연산', 'times'] },
          { char: '÷', label: '나누기 (나눗셈 기호)', keywords: ['나누기', '나눗셈', '연산', 'divide'] },
          { char: '±', label: '플러스마이너스 (오차 범위)', keywords: ['플러스마이너스', '오차', '연산'] },
          { char: '＝', label: '등호 (같다)', keywords: ['등호', '같다'] },
          { char: '≠', label: '같지 않다 (부등호)', keywords: ['같지않다', '다르다', '부등호'] },
          { char: '≈', label: '약 / 근삿값 (거의 같다)', keywords: ['근사', '약', '비슷', '어림'] },
          { char: '≒', label: '약 (근사 등호)', keywords: ['근사', '약', '같다'] },
          { char: '≡', label: '합동 / 항등 / 모듈러 동치', keywords: ['합동', '항등', '동치', '모듈러'] },
          { char: '≤', label: '작거나 같다 (이하)', keywords: ['이하', '부등호', '작거나같다'] },
          { char: '≥', label: '크거나 같다 (이상)', keywords: ['이상', '부등호', '크거나같다'] },
          { char: '≪', label: '매우 작다', keywords: ['부등호', '매우작다'] },
          { char: '≫', label: '매우 크다', keywords: ['부등호', '매우크다'] },
          { char: '∝', label: '비례한다', keywords: ['비례', '관계', '수학'] },
          { char: '∞', label: '무한대', keywords: ['무한', '무한대', 'infinity'] },
          { char: '√', label: '제곱근 (루트)', keywords: ['루트', '제곱근', 'root'] },
          { char: '∑', label: '시그마 (총합)', keywords: ['시그마', '합', '총합', 'sum'] },
          { char: '∏', label: '파이 (총곱)', keywords: ['곱', '총곱'] },
          { char: '∫', label: '인테그랄 (적분)', keywords: ['적분', '인테그랄'] },
          { char: '∂', label: '편미분 기호 (경사하강법 ∂L/∂w)', keywords: ['편미분', '미분', '기울기', '경사하강법'] },
          { char: '∆', label: '델타 (변화량 Δx)', keywords: ['델타', '변화량', '차이'] },
          { char: '∇', label: '나블라 (그래디언트/기울기 벡터)', keywords: ['나블라', '그래디언트', '기울기'] },
        ],
      },
      {
        title: '집합·논리·명제 기호 (정보·이산수학·알고리즘)',
        items: [
          { char: '∈', label: '원소이다 (x ∈ A / in 연산자)', keywords: ['원소', '속한다', '집합', 'in'] },
          { char: '∉', label: '원소가 아니다 (not in)', keywords: ['원소', '집합', '아니다'] },
          { char: '⊂', label: '진부분집합', keywords: ['부분집합', '집합', '포함'] },
          { char: '⊆', label: '부분집합', keywords: ['부분집합', '집합', '포함'] },
          { char: '∪', label: '합집합 (Union / OR)', keywords: ['합집합', '집합', '유니온'] },
          { char: '∩', label: '교집합 (Intersection / AND)', keywords: ['교집합', '집합', '공통'] },
          { char: '∅', label: '공집합 (Empty Set)', keywords: ['공집합', '빈집합', '집합'] },
          { char: '∀', label: '모든 / 임의의 (For All)', keywords: ['모든', '전칭', '명제', '논리'] },
          { char: '∃', label: '존재한다 (There Exists)', keywords: ['존재', '명제', '논리'] },
          { char: '¬', label: '논리 부정 (NOT)', keywords: ['부정', 'not', '논리', '게이트'] },
          { char: '∧', label: '논리곱 (AND)', keywords: ['논리곱', 'and', '논리', '게이트'] },
          { char: '∨', label: '논리합 (OR)', keywords: ['논리합', 'or', '논리', '게이트'] },
          { char: '⊕', label: '배타적 논리합 (XOR)', keywords: ['xor', '배타적', '논리', '게이트', '암호'] },
        ],
      },
      {
        title: '그리스 문자 & 기하 기호 (수식·알고리즘 파라미터)',
        items: [
          { char: 'α', label: '알파 (학습률 α / 각도)', keywords: ['알파', '그리스', '학습률', 'alpha'] },
          { char: 'β', label: '베타', keywords: ['베타', '그리스', 'beta'] },
          { char: 'γ', label: '감마 (할인율 γ)', keywords: ['감마', '그리스', 'gamma'] },
          { char: 'δ', label: '델타 (소문자)', keywords: ['델타', '그리스', '오차'] },
          { char: 'ε', label: '엡실론 (아주 작은 값 ε)', keywords: ['엡실론', '그리스', '오차'] },
          { char: 'θ', label: '세타 (가중치 파라미터 θ / 각도)', keywords: ['세타', '각도', '파라미터', '가중치', 'theta'] },
          { char: 'λ', label: '람다 (파장 / 정규화 계수 / 람다함수)', keywords: ['람다', '파장', '파이썬', 'lambda'] },
          { char: 'μ', label: '뮤 (모평균 μ / 마이크로)', keywords: ['뮤', '평균', '통계'] },
          { char: 'π', label: '파이 (원주율 3.14159...)', keywords: ['파이', '원주율', 'pi'] },
          { char: 'σ', label: '시그마 (표준편차 σ / 시그모이드)', keywords: ['시그마', '표준편차', '시그모이드', '통계'] },
          { char: 'ω', label: '오메가 (각속도 ω)', keywords: ['오메가', '각속도'] },
          { char: 'Ω', label: '대문자 오메가 (저항 옴 / 하한 빅오메가)', keywords: ['오메가', '옴', '저항', '복잡도'] },
          { char: '∠', label: '각 (각도 기호)', keywords: ['각', '각도', '기하'] },
          { char: '⊥', label: '수직 (직교)', keywords: ['수직', '직교', '기하'] },
          { char: '∥', label: '평행', keywords: ['평행', '기하'] },
        ],
      },
      {
        title: '과학·전자·피지컬컴퓨팅 단위 기호',
        items: [
          { char: '℃', label: '섭씨 온도 (도씨)', keywords: ['온도', '섭씨', '센서', '단위'] },
          { char: '℉', label: '화씨 온도', keywords: ['온도', '화씨', '단위'] },
          { char: '°', label: '각도 / 도 (예: 서보모터 90°)', keywords: ['도', '각도', '서보모터', '온도', '단위'] },
          { char: 'Ω', label: '옴 (전기 저항 단위)', keywords: ['옴', '저항', '회로', '피지컬', '단위'] },
          { char: '㏀', label: '킬로옴 (kΩ)', keywords: ['킬로옴', '저항', '회로', '단위'] },
          { char: '㎃', label: '밀리암페어 (전류 mA)', keywords: ['전류', '암페어', '밀리암페어', '회로', '단위'] },
          { char: '㎸', label: '킬로볼트 (전압 kV)', keywords: ['전압', '볼트', '단위'] },
          { char: '㎼', label: '와트 (전력 W)', keywords: ['전력', '와트', '단위'] },
          { char: '㎐', label: '헤르츠 (주파수/부저 음높이 Hz)', keywords: ['헤르츠', '주파수', '부저', '소리', '단위'] },
          { char: '㎑', label: '킬로헤르츠 (kHz)', keywords: ['헤르츠', '주파수', '단위'] },
          { char: '㎒', label: '메가헤르츠 (MHz)', keywords: ['헤르츠', '클럭', '단위'] },
          { char: '㎓', label: '기가헤르츠 (CPU 클럭 GHz)', keywords: ['헤르츠', '클럭', 'cpu', '단위'] },
          { char: '㎜', label: '밀리미터 (mm)', keywords: ['밀리미터', '길이', '거리', '단위'] },
          { char: '㎝', label: '센티미터 (초음파 거리 cm)', keywords: ['센티미터', '길이', '거리', '초음파', '단위'] },
          { char: '㎞', label: '킬로미터 (km)', keywords: ['킬로미터', '거리', '단위'] },
          { char: '㎡', label: '제곱미터 (넓이)', keywords: ['제곱미터', '넓이', '면적', '단위'] },
          { char: '㎏', label: '킬로그램 (질량 kg)', keywords: ['킬로그램', '무게', '질량', '단위'] },
          { char: '㎳', label: '밀리초 (delay 시간 ms)', keywords: ['밀리초', '시간', '아두이노', '단위'] },
        ],
      },
    ],
  },
  {
    id: 'cs_ai',
    label: '정보·AI·피지컬',
    badge: '💻',
    description: '프로그래밍, 파이썬, 인공지능·데이터 분석, 피지컬 컴퓨팅(센서·LED·회로), 정보보안 이모지',
    subgroups: [
      {
        title: '프로그래밍·컴퓨터·데이터·AI',
        items: [
          { char: '💻', label: '노트북 컴퓨터 (코딩/실습)', keywords: ['컴퓨터', '노트북', '코딩', '실습', '정보'] },
          { char: '🖥️', label: '데스크톱 모니터 (화면 출력)', keywords: ['컴퓨터', '모니터', '출력', '화면'] },
          { char: '⌨️', label: '키보드 (입력/단축키)', keywords: ['키보드', '입력', '타자', 'input'] },
          { char: '🖱️', label: '마우스 (클릭/이벤트)', keywords: ['마우스', '클릭', '이벤트'] },
          { char: '🐍', label: '파이썬 (Python)', keywords: ['파이썬', '뱀', 'python', '코딩'] },
          { char: '🤖', label: '인공지능 / 로봇 (AI·머신러닝)', keywords: ['인공지능', '로봇', 'ai', '머신러닝', '챗봇'] },
          { char: '🧠', label: '인공신경망 / 딥러닝 / 사고력', keywords: ['뇌', '신경망', '딥러닝', '인공지능', '생각'] },
          { char: '📊', label: '막대 차트 (데이터 분석/통계)', keywords: ['데이터', '차트', '그래프', '통계', '시각화'] },
          { char: '📈', label: '꺾은선 상승 그래프 (선형회귀/추세)', keywords: ['그래프', '상승', '회귀', '예측', '데이터'] },
          { char: '📉', label: '꺾은선 하락 그래프 (오차/손실 감소)', keywords: ['그래프', '하락', '손실', '경사하강법'] },
          { char: '🔍', label: '돋보기 (탐색 알고리즘 / 검색)', keywords: ['탐색', '검색', '관찰', '분석', '돋보기'] },
          { char: '⚙️', label: '톱니바퀴 (알고리즘 원리 / 설정)', keywords: ['톱니바퀴', '원리', '알고리즘', '시스템', '설정'] },
          { char: '🧩', label: '퍼즐 조각 (블록 코딩 / 모듈 / 함수)', keywords: ['퍼즐', '모듈', '함수', '알고리즘', '문제해결'] },
          { char: '🎲', label: '주사위 (난수 random / 확률)', keywords: ['주사위', '랜덤', '무작위', '확률', 'random'] },
          { char: '🗂️', label: '데이터 분류 / 파일 인덱싱', keywords: ['분류', '데이터', '폴더', '구조'] },
          { char: '🗄️', label: '데이터베이스 / 서버 스토리지', keywords: ['데이터베이스', 'db', 'sql', '서버'] },
          { char: '🌐', label: '웹 / 인터넷 / 네트워크', keywords: ['웹', '인터넷', '네트워크', '글로벌', 'html'] },
          { char: '☁️', label: '클라우드 컴퓨팅', keywords: ['클라우드', '서버', '네트워크'] },
          { char: '🐛', label: '버그 (디버깅 / 오류 찾기)', keywords: ['버그', '오류', '디버깅', '에러', 'bug'] },
        ],
      },
      {
        title: '피지컬 컴퓨팅·센서·회로·제어',
        items: [
          { char: '⚡', label: '전기 / 전원 / 전압 시그널', keywords: ['전기', '전압', '전류', '피지컬', '회로', '신호'] },
          { char: '🔌', label: '전원 플러그 / USB 연결', keywords: ['플러그', '연결', '케이블', '전원'] },
          { char: '🔋', label: '배터리 / 전원 공급', keywords: ['배터리', '건전지', '전원'] },
          { char: '🚦', label: '신호등 모듈 (빨강·노랑·초록 LED)', keywords: ['신호등', 'led', '피지컬', '교차로'] },
          { char: '🚨', label: '경광등 / 경보 알람', keywords: ['경보', '알람', '사이렌', '센서'] },
          { char: '🌡️', label: '온도계 (온도 센서)', keywords: ['온도', '온도센서', '피지컬', '날씨'] },
          { char: '💧', label: '물방울 (습도 / 수분 센서)', keywords: ['물', '습도', '수분', '센서'] },
          { char: '☀️', label: '태양 / 빛 (조도 센서)', keywords: ['빛', '조도', '조도센서', '태양', '밝기'] },
          { char: '🎵', label: '음표 (피에조 부저 / 멜로디 출력)', keywords: ['음악', '소리', '부저', '피에조', '음표'] },
          { char: '🕹️', label: '조이스틱 / 게임 컨트롤러', keywords: ['조이스틱', '버튼', '조종', '피지컬'] },
          { char: '🎛️', label: '가변저항 다이얼 / 아날로그 입력', keywords: ['가변저항', '다이얼', '아날로그', '센서'] },
          { char: '🧭', label: '나침반 (지자기 센서 / 방향)', keywords: ['나침반', '방향', '마이크로비트', '센서'] },
          { char: '🧲', label: '자석 (자기장 / 홀 센서)', keywords: ['자석', '자기장', '물리'] },
          { char: '📡', label: '무선 안테나 (블루투스/라디오/초음파)', keywords: ['안테나', '무선', '초음파', '통신', '센서'] },
          { char: '🚀', label: '로켓 (실행 / 프로젝트 발사)', keywords: ['로켓', '발사', '실행', '속도', '물리'] },
          { char: '🔒', label: '자물쇠 잠금 (정보보안 / 암호화)', keywords: ['보안', '암호', '잠금', '개인정보'] },
          { char: '🛡️', label: '방패 (사이버 보안 / 방화벽)', keywords: ['보안', '방어', '방화벽', '안전'] },
        ],
      },
      {
        title: '컬러 원형·사각형 배지 (LED 색상·상태 표시용)',
        items: [
          { char: '🔴', label: '빨간 원 (적색 LED / 정지)', keywords: ['빨강', '원', 'led', '신호등', '색상'] },
          { char: '🟡', label: '노란 원 (황색 LED / 대기)', keywords: ['노랑', '원', 'led', '신호등', '색상'] },
          { char: '🟢', label: '초록 원 (녹색 LED / 정상 작동)', keywords: ['초록', '원', 'led', '신호등', '색상'] },
          { char: '🔵', label: '파란 원 (청색 LED)', keywords: ['파랑', '원', 'led', '색상'] },
          { char: '🟣', label: '보라 원', keywords: ['보라', '원', '색상'] },
          { char: '🟠', label: '주황 원', keywords: ['주황', '원', '색상'] },
          { char: '⚪', label: '하얀 원 (백색 LED / 꺼짐)', keywords: ['하양', '원', 'led'] },
          { char: '⚫', label: '검은 원 (GND / 접지)', keywords: ['검정', '원', '접지'] },
          { char: '🟥', label: '빨간 사각형', keywords: ['빨강', '네모', '사각형'] },
          { char: '🟨', label: '노란 사각형', keywords: ['노랑', '네모', '사각형'] },
          { char: '🟩', label: '초록 사각형', keywords: ['초록', '네모', '사각형'] },
          { char: '🟦', label: '파란 사각형', keywords: ['파랑', '네모', '사각형'] },
        ],
      },
    ],
  },
  {
    id: 'classroom',
    label: '수업·학습·교과',
    badge: '📚',
    description: '교과서, 노트 필기, 실험·탐구, 발표·토론, 시간 제한 등 수업 활동 안내용 이모지',
    subgroups: [
      {
        title: '교재·필기·문구·정리',
        items: [
          { char: '📚', label: '책 더미 (핵심 개념 / 참고 자료)', keywords: ['책', '교과서', '학습', '독서', '개념'] },
          { char: '📖', label: '펼친 책 (본문 읽기 / 지문)', keywords: ['책', '교과서', '읽기', '지문', '정의'] },
          { char: '📝', label: '메모와 연필 (빈칸 채우기 / 서술형)', keywords: ['메모', '필기', '기록', '과제', '서술형'] },
          { char: '✏️', label: '연필 (문제 풀이 / 작성)', keywords: ['연필', '쓰기', '작성', '풀이'] },
          { char: '🖍️', label: '크레용 / 형광펜 강조', keywords: ['형광펜', '색칠', '강조'] },
          { char: '📋', label: '클립보드 (체크리스트 / 요약 정리)', keywords: ['클립보드', '체크리스트', '요약', '정리'] },
          { char: '📎', label: '클립 (첨부 / 참고 자료)', keywords: ['클립', '첨부', '연결'] },
          { char: '📏', label: '자 (측정 / 기준)', keywords: ['자', '측정', '길이', '기준'] },
          { char: '📐', label: '삼각자 (수학 / 기하 / 설계)', keywords: ['삼각자', '수학', '기하', '각도'] },
        ],
      },
      {
        title: '실험·교과·발표·피드백 활동',
        items: [
          { char: '🔬', label: '현미경 (과학 탐구 / 심층 분석)', keywords: ['현미경', '과학', '실험', '탐구', '관찰'] },
          { char: '🧪', label: '시험관 (실험 / 시뮬레이션)', keywords: ['시험관', '실험', '화학', '시뮬레이션'] },
          { char: '🧬', label: 'DNA 이중나선 (생명과학 / 유전)', keywords: ['dna', '생명', '유전', '과학'] },
          { char: '🌍', label: '지구 (사회 / 지리 / 환경)', keywords: ['지구', '세계', '환경', '사회', '지리'] },
          { char: '🏛️', label: '박물관 / 고전 건축 (역사 / 사회 / 법)', keywords: ['역사', '사회', '법', '국가', '유적'] },
          { char: '⚖️', label: '저울 (법 / 윤리 / 균형 / 비교)', keywords: ['저울', '비교', '윤리', '법', '평등'] },
          { char: '🎨', label: '팔레트 (미술 / 디자인 / 시각화)', keywords: ['미술', '디자인', '색상', '꾸미기'] },
          { char: '🙋', label: '손들기 (질문하기 / 발표)', keywords: ['손들기', '질문', '발표', '참여'] },
          { char: '👏', label: '박수 (칭찬 / 격려)', keywords: ['박수', '칭찬', '완료'] },
          { char: '👍', label: '엄지 척 (좋은 예시 / 권장)', keywords: ['엄지', '좋아요', '권장', '좋은예'] },
          { char: '👎', label: '엄지 아래 (나쁜 예시 / 비권장)', keywords: ['나쁜예', '비권장', '주의'] },
          { char: '🤝', label: '악수 (모둠 활동 / 협력 학습)', keywords: ['협동', '모둠', '협력', '동료'] },
          { char: '👀', label: '눈 (관찰하기 / 주목)', keywords: ['눈', '관찰', '보기', '주목'] },
          { char: '✍️', label: '손으로 쓰기 (직접 작성 실습)', keywords: ['쓰기', '실습', '작성'] },
          { char: '🎓', label: '학사모 (심화 학습 / 마스터)', keywords: ['학사모', '졸업', '심화', '학습'] },
          { char: '⏰', label: '알람 시계 (제한 시간 / 마감)', keywords: ['시계', '시간', '제한시간', '마감'] },
          { char: '⏳', label: '모래시계 (실습 시간 진행 중)', keywords: ['모래시계', '시간', '대기'] },
        ],
      },
    ],
  },
  {
    id: 'faces',
    label: '표정·반응',
    badge: '😊',
    description: '학생들의 흥미와 공감을 유발하는 친근한 표정, 생각하기, 응원 이모지',
    subgroups: [
      {
        title: '친근한 표정 & 학습 공감 리액션',
        items: [
          { char: '😀', label: '활짝 웃는 얼굴', keywords: ['웃음', '표정', '미소', '기쁨'] },
          { char: '😊', label: '따뜻한 미소', keywords: ['미소', '웃음', '친절', '표정'] },
          { char: '🙂', label: '살짝 웃는 얼굴', keywords: ['미소', '표정'] },
          { char: '🤩', label: '별 눈 (흥미진진 / 놀라움)', keywords: ['별눈', '감탄', '흥미', '재미'] },
          { char: '🥳', label: '축하 / 완주 성공', keywords: ['축하', '파티', '성공', '완주'] },
          { char: '😎', label: '선글라스 (자신감 / 꿀팁)', keywords: ['멋짐', '자신감', '꿀팁'] },
          { char: '🤓', label: '안경 쓴 공부 얼굴 (탐구/박사)', keywords: ['공부', '안경', '탐구', '설명'] },
          { char: '🧐', label: '단안경 관찰 (자세히 살펴보기)', keywords: ['관찰', '분석', '살펴보기', '추리'] },
          { char: '🤔', label: '생각하는 얼굴 (왜 그럴까? 질문)', keywords: ['생각', '고민', '질문', '왜', '탐구'] },
          { char: '😮', label: '아하! 놀란 얼굴 (깨달음)', keywords: ['놀람', '아하', '깨달음'] },
          { char: '🤯', label: '충격 / 패러다임 전환', keywords: ['충격', '놀람', '신기'] },
          { char: '😅', label: '식은땀 웃음 (자주 하는 실수)', keywords: ['실수', '주의', '땀'] },
          { char: '😵‍💫', label: '어지러운 얼굴 (헷갈리는 개념)', keywords: ['헷갈림', '혼란', '어려움', '오개념'] },
          { char: '💪', label: '알통 (화이팅 / 도전 과제)', keywords: ['힘', '화이팅', '도전', '응원'] },
          { char: '❤️', label: '빨간 하트 (핵심 / 공감)', keywords: ['하트', '사랑', '중요'] },
          { char: '🧡', label: '주황 하트', keywords: ['하트'] },
          { char: '💛', label: '노란 하트', keywords: ['하트'] },
          { char: '💚', label: '초록 하트', keywords: ['하트'] },
          { char: '💙', label: '파란 하트', keywords: ['하트'] },
        ],
      },
    ],
  },
];

/**
 * 콜아웃(Callout) 강조 박스에서 빠르게 고를 수 있는 추천 대표 아이콘 목록
 */
export const RECOMMENDED_CALLOUT_ICONS: string[] = [
  '💡',
  '📌',
  '🎯',
  '⚠️',
  '✅',
  '❓',
  '❗',
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '➊',
  '➋',
  '➌',
  '📖',
  '🔬',
  '💻',
  '🤖',
  '📊',
  '⚡',
  '🔍',
  '🏆',
  '✨',
  '🔥',
  '🏛️',
];

/**
 * 검색어로 전체 카테고리의 이모지·숫자·기호를 필터링합니다.
 */
export function searchEmojiSymbols(query: string): EmojiSymbolItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: EmojiSymbolItem[] = [];
  const seen = new Set<string>();

  for (const cat of LESSON_EMOJI_SYMBOL_CATEGORIES) {
    for (const subgroup of cat.subgroups) {
      for (const item of subgroup.items) {
        if (seen.has(item.char)) continue;
        if (
          item.char.includes(q) ||
          item.label.toLowerCase().includes(q) ||
          subgroup.title.toLowerCase().includes(q) ||
          item.keywords.some((kw) => kw.toLowerCase().includes(q))
        ) {
          seen.add(item.char);
          results.push(item);
        }
      }
    }
  }
  return results;
}
