'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ColabRunnerBlock from '@/components/ColabRunnerBlock';

export type DatasetPresetId =
  | 'weather_climate'
  | 'school_lunch'
  | 'iris_species'
  | 'student_digital'
  | 'custom_csv';

export type DataAnalysisDatasetId = DatasetPresetId;

export type MissingValueStrategy =
  | 'keep'
  | 'drop_row'
  | 'fill_mean'
  | 'fill_median';

export type OutlierStrategy = 'keep' | 'remove_iqr' | 'clip_iqr';

export type DataChartType = 'scatter' | 'bar' | 'histogram' | 'heatmap';

export interface DataAnalysisConfig {
  datasetId: DatasetPresetId;
  customCsvText?: string;
  missingStrategy: MissingValueStrategy;
  outlierStrategy: OutlierStrategy;
  chartType: DataChartType;
  xColumn: string;
  yColumn: string;
  groupColumn?: string;
  showTrendline?: boolean;
  missionPrompt?: string;
}

export interface DataAnalysisTemplateItem {
  id: string;
  label: string;
  caption: string;
  config: DataAnalysisConfig;
}

export interface DatasetPresetMeta {
  id: DatasetPresetId;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  csvText: string;
  defaultX: string;
  defaultY: string;
  defaultGroup?: string;
}

export const DATASET_PRESETS: Record<DatasetPresetId, DatasetPresetMeta> = {
  weather_climate: {
    id: 'weather_climate',
    label: '🌡️ 기상청 연도별 기온·폭염·열대야 데이터',
    shortLabel: '🌡️ 기후·폭염 데이터',
    badge: '기후 데이터',
    description:
      '연도별 여름철 평균기온(°C), 폭염일수(일), 강수량(mm), 아이스크림 소비지수 데이터입니다. 센서 오류로 인한 이상치(98.5°C)와 결측치(NaN)가 포함되어 있습니다.',
    defaultX: '여름평균기온',
    defaultY: '폭염일수',
    defaultGroup: '권역',
    csvText: `연도,권역,여름평균기온,폭염일수,강수량,빙과류소비지수
2015,수도권,24.1,9,380,68
2016,수도권,25.6,22,290,85
2017,수도권,24.8,14,520,76
2018,수도권,26.9,35,240,98
2019,수도권,24.5,13,410,74
2020,수도권,23.8,7,680,64
2021,수도권,,18,350,81
2022,수도권,25.2,16,590,79
2023,수도권,98.5,19,490,84
2024,수도권,26.4,28,310,93
2018,영남권,27.3,38,210,99
2019,영남권,25.0,17,390,78
2020,영남권,24.2,11,610,70
2021,영남권,25.5,,340,83
2022,영남권,26.1,25,330,89
2023,영남권,25.8,21,460,86`,
  },
  school_lunch: {
    id: 'school_lunch',
    label: '🍱 학교 급식 메뉴별 선호도·잔반량 데이터',
    shortLabel: '🍱 급식 잔반량',
    badge: '학교생활 데이터',
    description:
      '학교 급식 메뉴의 학생 선호도 점수(100점 만점), 1인당 평균 잔반량(g), 칼로리(kcal), 나트륨(mg) 데이터입니다. 저울 측정 오류 이상치(890g)와 결측치가 들어 있습니다.',
    defaultX: '선호도점수',
    defaultY: '평균잔반량_g',
    defaultGroup: '메뉴분류',
    csvText: `메뉴명,메뉴분류,선호도점수,평균잔반량_g,칼로리_kcal,나트륨_mg
치킨마요덮밥,특식,94,32,780,920
돈까스카레,특식,91,40,810,980
제육볶음,육류,86,58,690,1050
떡갈비구이,육류,88,49,710,890
소불고기,육류,,52,660,870
된장찌개백반,한식,68,135,540,1240
시금치나물비빔밥,채소,62,155,520,760
연두부채소국,채소,55,180,480,680
고등어조림,어류,59,890,590,1120
오징어볶음,어류,76,92,610,1080
코다리강정,어류,79,,640,950
김치볶음밥,특식,89,45,730,1020`,
  },
  iris_species: {
    id: 'iris_species',
    label: '🌸 붓꽃(Iris) 꽃잎·꽃받침 생태 데이터',
    shortLabel: '🌸 붓꽃(Iris)',
    badge: '생태·분류 데이터',
    description:
      '데이터 과학과 머신러닝에서 가장 유명한 붓꽃(Iris) 데이터셋입니다. 꽃받침 길이/너비와 꽃잎 길이/너비에 따라 품종(Setosa, Versicolor, Virginica)이 어떻게 나뉘는지 분석합니다.',
    defaultX: '꽃잎길이_cm',
    defaultY: '꽃잎너비_cm',
    defaultGroup: '품종',
    csvText: `품종,꽃받침길이_cm,꽃받침너비_cm,꽃잎길이_cm,꽃잎너비_cm
Setosa,5.1,3.5,1.4,0.2
Setosa,4.9,3.0,1.4,0.2
Setosa,4.7,3.2,1.3,0.2
Setosa,5.0,3.6,1.4,0.3
Setosa,5.4,3.9,1.7,0.4
Versicolor,7.0,3.2,4.7,1.4
Versicolor,6.4,3.2,4.5,1.5
Versicolor,6.9,3.1,4.9,1.5
Versicolor,5.5,2.3,4.0,1.3
Versicolor,6.5,2.8,4.6,1.5
Virginica,6.3,3.3,6.0,2.5
Virginica,5.8,2.7,5.1,1.9
Virginica,7.1,3.0,5.9,2.1
Virginica,6.3,2.9,5.6,1.8
Virginica,6.5,3.0,5.8,2.2`,
  },
  student_digital: {
    id: 'student_digital',
    label: '📱 청소년 스마트폰 사용시간·수면·집중도 데이터',
    shortLabel: '📱 스마트폰·수면',
    badge: '설문 데이터',
    description:
      '학생들의 하루 스마트폰 사용시간(시간), 평균 수면시간(시간), 수업 집중도(100점), 일일 운동시간(분) 설문 데이터입니다. 오입력 이상치(스마트폰 23.5시간)와 미응답 결측치가 포함되어 있습니다.',
    defaultX: '스마트폰사용_시간',
    defaultY: '수업집중도_점수',
    defaultGroup: '학년군',
    csvText: `학생ID,학년군,스마트폰사용_시간,수면시간_시간,수업집중도_점수,운동시간_분
S01,중등,1.5,8.2,91,45
S02,중등,2.2,7.8,86,40
S03,중등,3.5,7.0,78,25
S04,중등,4.8,6.2,66,15
S05,중등,,6.8,74,20
S06,중등,6.1,5.4,54,10
S07,고등,2.0,7.5,88,35
S08,고등,3.2,6.9,80,30
S09,고등,4.5,6.0,71,15
S10,고등,5.8,5.2,59,10
S11,고등,23.5,4.8,49,5
S12,고등,3.9,,75,20`,
  },
  custom_csv: {
    id: 'custom_csv',
    label: '📋 직접 CSV / 표 데이터 붙여넣기',
    shortLabel: '📋 직접 CSV 입력',
    badge: '커스텀 데이터',
    description:
      '공공데이터포털(data.go.kr)이나 엑셀에서 복사한 CSV 데이터를 직접 붙여넣어 결측치·이상치 정제와 시각화를 수행합니다.',
    defaultX: '공부시간',
    defaultY: '성적',
    defaultGroup: '반',
    csvText: `반,공부시간,수면시간,성적
1반,1.5,8.0,62
1반,2.5,7.5,71
1반,3.5,7.0,79
1반,4.5,,86
2반,2.0,7.8,68
2반,4.0,6.8,84
2반,5.5,6.5,94
2반,18.0,4.0,65`,
  },
};

export const DATA_ANALYSIS_TEMPLATES: DataAnalysisTemplateItem[] = [
  {
    id: 'weather-outlier-lab',
    label: '🌡️ [전처리 실습] 기상청 기온 데이터의 결측치와 이상치가 평균을 속이는 방법',
    caption: '결측치(NaN)와 센서 오류 이상치(98.5°C)를 정제하며 평균 vs 중앙값 변화를 비교해 봅니다',
    config: {
      datasetId: 'weather_climate',
      missingStrategy: 'keep',
      outlierStrategy: 'keep',
      chartType: 'scatter',
      xColumn: '여름평균기온',
      yColumn: '폭염일수',
      groupColumn: '권역',
      showTrendline: true,
      missionPrompt:
        '원본 데이터의 여름평균기온에 98.5°C라는 센서 오류(이상치)가 들어 있습니다! [이상치 제거(IQR)] 버튼을 눌렀을 때 평균과 상관계수(r)가 어떻게 달라지는지 확인해 보세요.',
    },
  },
  {
    id: 'lunch-correlation-lab',
    label: '🍱 [상관분석 실습] 학교 급식 선호도와 잔반량의 음(-)의 상관관계 탐색',
    caption: '급식 선호도가 높을수록 잔반량이 줄어드는지 산점도와 상관계수(r)로 검증합니다',
    config: {
      datasetId: 'school_lunch',
      missingStrategy: 'fill_mean',
      outlierStrategy: 'remove_iqr',
      chartType: 'scatter',
      xColumn: '선호도점수',
      yColumn: '평균잔반량_g',
      groupColumn: '메뉴분류',
      showTrendline: true,
      missionPrompt:
        '선호도점수(X축)와 평균잔반량(Y축) 사이의 상관계수 r 부호가 양(+)인지 음(-)인지 확인하고, 이상치(890g)를 포함했을 때와 제거했을 때 추세선 기울기를 비교해 보세요.',
    },
  },
  {
    id: 'iris-eda-lab',
    label: '🌸 [탐색적 데이터 분석] 붓꽃(Iris) 품종별 꽃잎 크기 분포와 상관관계 히트맵',
    caption: '꽃잎 길이·너비에 따라 품종 군집이 어떻게 나뉘는지 산점도와 히트맵으로 분석합니다',
    config: {
      datasetId: 'iris_species',
      missingStrategy: 'keep',
      outlierStrategy: 'keep',
      chartType: 'scatter',
      xColumn: '꽃잎길이_cm',
      yColumn: '꽃잎너비_cm',
      groupColumn: '품종',
      showTrendline: true,
      missionPrompt:
        '품종(Setosa, Versicolor, Virginica)을 가장 잘 구분해 주는 변수 조합(X축·Y축)을 찾아보고, [상관계수 히트맵] 탭에서 가장 상관도가 높은 두 변수를 찾아보세요.',
    },
  },
  {
    id: 'digital-habit-lab',
    label: '📱 [설문 데이터 분석] 스마트폰 사용시간과 수면·수업 집중도의 관계 분석',
    caption: '설문 응답 중 미응답(결측치)과 오입력(23.5시간)을 정제하고 집중도 변화를 시각화합니다',
    config: {
      datasetId: 'student_digital',
      missingStrategy: 'fill_median',
      outlierStrategy: 'remove_iqr',
      chartType: 'scatter',
      xColumn: '스마트폰사용_시간',
      yColumn: '수업집중도_점수',
      groupColumn: '학년군',
      showTrendline: true,
      missionPrompt:
        '결측치를 [평균값 대체]할 때와 [중앙값 대체]할 때 통계량이 어떻게 다른지 비교하고, 히스토그램으로 수업집중도 분포를 확인해 보세요.',
    },
  },
];

const DEFAULT_CONFIG: DataAnalysisConfig =
  DATA_ANALYSIS_TEMPLATES[0].config;

export function parseDataAnalysisBlockContent(raw: string): DataAnalysisConfig {
  if (!raw || !raw.trim()) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<DataAnalysisConfig>;
    const datasetId: DatasetPresetId =
      parsed.datasetId && parsed.datasetId in DATASET_PRESETS
        ? parsed.datasetId
        : 'weather_climate';
    const preset = DATASET_PRESETS[datasetId];
    return {
      datasetId,
      customCsvText:
        typeof parsed.customCsvText === 'string'
          ? parsed.customCsvText
          : undefined,
      missingStrategy:
        parsed.missingStrategy === 'drop_row' ||
        parsed.missingStrategy === 'fill_mean' ||
        parsed.missingStrategy === 'fill_median'
          ? parsed.missingStrategy
          : 'keep',
      outlierStrategy:
        parsed.outlierStrategy === 'remove_iqr' ||
        parsed.outlierStrategy === 'clip_iqr'
          ? parsed.outlierStrategy
          : 'keep',
      chartType:
        parsed.chartType === 'bar' ||
        parsed.chartType === 'histogram' ||
        parsed.chartType === 'heatmap'
          ? parsed.chartType
          : 'scatter',
      xColumn: parsed.xColumn || preset.defaultX,
      yColumn: parsed.yColumn || preset.defaultY,
      groupColumn: parsed.groupColumn ?? preset.defaultGroup,
      showTrendline:
        typeof parsed.showTrendline === 'boolean' ? parsed.showTrendline : true,
      missionPrompt: parsed.missionPrompt || '',
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function serializeDataAnalysisBlockContent(
  config: DataAnalysisConfig
): string {
  return JSON.stringify(config, null, 2);
}

interface ParsedCellMeta {
  rawValue: string;
  numValue: number | null;
  isMissing: boolean;
  isOutlier: boolean;
  cleanedNumValue: number | null;
  wasImputed: boolean;
  wasClipped: boolean;
}

interface ColumnSummaryStats {
  count: number;
  missingCount: number;
  outlierCount: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqrLow: number;
  iqrHigh: number;
}

function computeNumericArrayStats(values: number[]): {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
} {
  if (values.length === 0) {
    return { mean: 0, median: 0, std: 0, min: 0, max: 0, q1: 0, q3: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const median =
    n % 2 === 1
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance =
    sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / Math.max(1, n);
  const std = Math.sqrt(variance);
  const q1 = sorted[Math.floor((n - 1) * 0.25)];
  const q3 = sorted[Math.floor((n - 1) * 0.75)];
  return {
    mean,
    median,
    std,
    min: sorted[0],
    max: sorted[n - 1],
    q1,
    q3,
  };
}

function computePearsonCorrelation(xs: number[], ys: number[]): {
  r: number;
  slope: number;
  intercept: number;
} {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { r: 0, slope: 0, intercept: 0 };
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const denom = Math.sqrt(denX * denY);
  const r = denom > 1e-9 ? num / denom : 0;
  const slope = denX > 1e-9 ? num / denX : 0;
  const intercept = meanY - slope * meanX;
  return { r, slope, intercept };
}

const GROUP_COLORS = [
  '#2563eb', // blue
  '#e11d48', // rose
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
];

export interface DataAnalysisBlockProps {
  rawContent: string;
  caption?: string;
  externalUrl?: string;
  compact?: boolean;
  onChangeContent?: (nextRaw: string) => void;
}

export default function DataAnalysisBlock({
  rawContent,
  caption,
  onChangeContent,
}: DataAnalysisBlockProps) {
  const [config, setConfig] = useState<DataAnalysisConfig>(() =>
    parseDataAnalysisBlockContent(rawContent)
  );
  const [activeTab, setActiveTab] = useState<'studio' | 'python'>('studio');

  useEffect(() => {
    setConfig(parseDataAnalysisBlockContent(rawContent));
  }, [rawContent]);

  const updateConfig = useCallback(
    (patch: Partial<DataAnalysisConfig>) => {
      setConfig((prev) => {
        const next: DataAnalysisConfig = { ...prev, ...patch };
        if (onChangeContent) {
          onChangeContent(serializeDataAnalysisBlockContent(next));
        }
        return next;
      });
    },
    [onChangeContent]
  );

  const presetMeta =
    DATASET_PRESETS[config.datasetId] || DATASET_PRESETS.weather_climate;
  const rawCsv =
    config.datasetId === 'custom_csv'
      ? config.customCsvText ?? presetMeta.csvText
      : presetMeta.csvText;

  // CSV 파싱 및 전처리 파이프라인
  const analysisResult = useMemo(() => {
    const lines = rawCsv
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return {
        headers: [] as string[],
        numericColumns: [] as string[],
        categoricalColumns: [] as string[],
        rawRows: [] as Record<string, string>[],
        cleanedRows: [] as Record<string, string | number>[],
        cellMatrix: [] as Record<string, ParsedCellMeta>[],
        rawStatsByCol: {} as Record<string, ColumnSummaryStats>,
        cleanStatsByCol: {} as Record<string, ColumnSummaryStats>,
        removedRowIndices: new Set<number>(),
      };
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    const rawRows: Record<string, string>[] = lines.slice(1).map((line) => {
      const cells = line.split(',').map((c) => c.trim());
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cells[idx] ?? '';
      });
      return rowObj;
    });

    // 수치형 vs 범주형 열 판별
    const numericColumns: string[] = [];
    const categoricalColumns: string[] = [];

    headers.forEach((col) => {
      let validNumCount = 0;
      let nonEmptyCount = 0;
      rawRows.forEach((r) => {
        const val = (r[col] ?? '').trim();
        if (!val || val.toLowerCase() === 'nan' || val.toLowerCase() === 'null') {
          return;
        }
        nonEmptyCount++;
        if (!Number.isNaN(Number(val))) {
          validNumCount++;
        }
      });
      if (nonEmptyCount > 0 && validNumCount / nonEmptyCount >= 0.7) {
        numericColumns.push(col);
      } else {
        categoricalColumns.push(col);
      }
    });

    // 원본 수치 통계 및 IQR 경계 계산
    const rawStatsByCol: Record<string, ColumnSummaryStats> = {};
    numericColumns.forEach((col) => {
      const validNums: number[] = [];
      let missingCount = 0;
      rawRows.forEach((r) => {
        const v = (r[col] ?? '').trim();
        if (!v || v.toLowerCase() === 'nan' || Number.isNaN(Number(v))) {
          missingCount++;
        } else {
          validNums.push(Number(v));
        }
      });
      const base = computeNumericArrayStats(validNums);
      const iqr = Math.max(0.0001, base.q3 - base.q1);
      const iqrLow = base.q1 - 1.5 * iqr;
      const iqrHigh = base.q3 + 1.5 * iqr;
      const outlierCount = validNums.filter(
        (n) => n < iqrLow || n > iqrHigh
      ).length;
      rawStatsByCol[col] = {
        ...base,
        count: validNums.length,
        missingCount,
        outlierCount,
        iqrLow,
        iqrHigh,
      };
    });

    // 이상치 제외한 정상값 평균/중앙값 (결측치 대체용)
    const normalCenterByCol: Record<string, { mean: number; median: number }> =
      {};
    numericColumns.forEach((col) => {
      const st = rawStatsByCol[col];
      const nonOutlierNums = rawRows
        .map((r) => Number((r[col] ?? '').trim()))
        .filter(
          (n) =>
            !Number.isNaN(n) &&
            (config.outlierStrategy === 'keep' ||
              (n >= st.iqrLow && n <= st.iqrHigh))
        );
      const center = computeNumericArrayStats(
        nonOutlierNums.length > 0 ? nonOutlierNums : [st.mean]
      );
      normalCenterByCol[col] = { mean: center.mean, median: center.median };
    });

    // 셀 단위 메타데이터 및 행 필터링
    const removedRowIndices = new Set<number>();
    const cellMatrix: Record<string, ParsedCellMeta>[] = rawRows.map(
      (r, rIdx) => {
        const rowMeta: Record<string, ParsedCellMeta> = {};
        headers.forEach((col) => {
          const rawVal = (r[col] ?? '').trim();
          const isNumericCol = numericColumns.includes(col);
          if (!isNumericCol) {
            const isMissing = !rawVal || rawVal.toLowerCase() === 'nan';
            if (isMissing && config.missingStrategy === 'drop_row') {
              removedRowIndices.add(rIdx);
            }
            rowMeta[col] = {
              rawValue: rawVal,
              numValue: null,
              isMissing,
              isOutlier: false,
              cleanedNumValue: null,
              wasImputed: false,
              wasClipped: false,
            };
            return;
          }

          const st = rawStatsByCol[col];
          const isMissing =
            !rawVal ||
            rawVal.toLowerCase() === 'nan' ||
            Number.isNaN(Number(rawVal));
          const numVal = isMissing ? null : Number(rawVal);
          const isOutlier =
            numVal !== null && (numVal < st.iqrLow || numVal > st.iqrHigh);

          let cleanedNum = numVal;
          let wasImputed = false;
          let wasClipped = false;

          if (isMissing) {
            if (config.missingStrategy === 'drop_row') {
              removedRowIndices.add(rIdx);
            } else if (config.missingStrategy === 'fill_mean') {
              cleanedNum = Number(normalCenterByCol[col].mean.toFixed(2));
              wasImputed = true;
            } else if (config.missingStrategy === 'fill_median') {
              cleanedNum = Number(normalCenterByCol[col].median.toFixed(2));
              wasImputed = true;
            }
          }

          if (isOutlier && cleanedNum !== null) {
            if (config.outlierStrategy === 'remove_iqr') {
              removedRowIndices.add(rIdx);
            } else if (config.outlierStrategy === 'clip_iqr') {
              cleanedNum = Number(
                Math.min(st.iqrHigh, Math.max(st.iqrLow, cleanedNum)).toFixed(2)
              );
              wasClipped = true;
            }
          }

          rowMeta[col] = {
            rawValue: rawVal,
            numValue: numVal,
            isMissing,
            isOutlier,
            cleanedNumValue: cleanedNum,
            wasImputed,
            wasClipped,
          };
        });
        return rowMeta;
      }
    );

    const cleanedRows: Record<string, string | number>[] = [];
    rawRows.forEach((r, rIdx) => {
      if (removedRowIndices.has(rIdx)) return;
      const obj: Record<string, string | number> = {};
      headers.forEach((col) => {
        const meta = cellMatrix[rIdx][col];
        if (numericColumns.includes(col)) {
          obj[col] =
            meta.cleanedNumValue !== null ? meta.cleanedNumValue : NaN;
        } else {
          obj[col] = meta.rawValue || '미상';
        }
      });
      cleanedRows.push(obj);
    });

    // 정제 후 수치 통계 계산
    const cleanStatsByCol: Record<string, ColumnSummaryStats> = {};
    numericColumns.forEach((col) => {
      const validNums = cleanedRows
        .map((r) => Number(r[col]))
        .filter((n) => Number.isFinite(n));
      const base = computeNumericArrayStats(validNums);
      const iqr = Math.max(0.0001, base.q3 - base.q1);
      const iqrLow = base.q1 - 1.5 * iqr;
      const iqrHigh = base.q3 + 1.5 * iqr;
      cleanStatsByCol[col] = {
        ...base,
        count: validNums.length,
        missingCount: cleanedRows.length - validNums.length,
        outlierCount: validNums.filter((n) => n < iqrLow || n > iqrHigh).length,
        iqrLow,
        iqrHigh,
      };
    });

    return {
      headers,
      numericColumns,
      categoricalColumns,
      rawRows,
      cleanedRows,
      cellMatrix,
      rawStatsByCol,
      cleanStatsByCol,
      removedRowIndices,
    };
  }, [rawCsv, config.missingStrategy, config.outlierStrategy]);

  const effectiveX = analysisResult.numericColumns.includes(config.xColumn)
    ? config.xColumn
    : analysisResult.numericColumns[0] || '';
  const effectiveY = analysisResult.numericColumns.includes(config.yColumn)
    ? config.yColumn
    : analysisResult.numericColumns[1] || analysisResult.numericColumns[0] || '';
  const effectiveGroup =
    config.groupColumn &&
    analysisResult.headers.includes(config.groupColumn)
      ? config.groupColumn
      : analysisResult.categoricalColumns[0] || '';

  // X-Y 상관계수 계산 (원본 vs 정제 후)
  const correlationStats = useMemo(() => {
    if (!effectiveX || !effectiveY) {
      return {
        rawCorr: { r: 0, slope: 0, intercept: 0 },
        cleanCorr: { r: 0, slope: 0, intercept: 0 },
        pairedPoints: [] as {
          x: number;
          y: number;
          group: string;
          isOutlier: boolean;
          wasImputed: boolean;
          rowIndex: number;
        }[],
      };
    }

    const rawX: number[] = [];
    const rawY: number[] = [];
    analysisResult.cellMatrix.forEach((rowMeta) => {
      const mx = rowMeta[effectiveX]?.numValue;
      const my = rowMeta[effectiveY]?.numValue;
      if (mx !== null && mx !== undefined && my !== null && my !== undefined) {
        rawX.push(mx);
        rawY.push(my);
      }
    });

    const cleanX: number[] = [];
    const cleanY: number[] = [];
    const pairedPoints: {
      x: number;
      y: number;
      group: string;
      isOutlier: boolean;
      wasImputed: boolean;
      rowIndex: number;
    }[] = [];

    analysisResult.cellMatrix.forEach((rowMeta, rIdx) => {
      if (analysisResult.removedRowIndices.has(rIdx)) return;
      const cx = rowMeta[effectiveX]?.cleanedNumValue;
      const cy = rowMeta[effectiveY]?.cleanedNumValue;
      if (cx !== null && cx !== undefined && cy !== null && cy !== undefined) {
        cleanX.push(cx);
        cleanY.push(cy);
        pairedPoints.push({
          x: cx,
          y: cy,
          group: effectiveGroup
            ? rowMeta[effectiveGroup]?.rawValue || '기타'
            : '전체',
          isOutlier:
            Boolean(rowMeta[effectiveX]?.isOutlier) ||
            Boolean(rowMeta[effectiveY]?.isOutlier),
          wasImputed:
            Boolean(rowMeta[effectiveX]?.wasImputed) ||
            Boolean(rowMeta[effectiveY]?.wasImputed),
          rowIndex: rIdx + 1,
        });
      }
    });

    return {
      rawCorr: computePearsonCorrelation(rawX, rawY),
      cleanCorr: computePearsonCorrelation(cleanX, cleanY),
      pairedPoints,
    };
  }, [
    analysisResult,
    effectiveX,
    effectiveY,
    effectiveGroup,
  ]);

  // 모든 수치형 변수 간 상관계수 행렬 (히트맵용)
  const correlationMatrix = useMemo(() => {
    const cols = analysisResult.numericColumns;
    return cols.map((c1) =>
      cols.map((c2) => {
        if (c1 === c2) return 1;
        const xs: number[] = [];
        const ys: number[] = [];
        analysisResult.cleanedRows.forEach((r) => {
          const vx = Number(r[c1]);
          const vy = Number(r[c2]);
          if (Number.isFinite(vx) && Number.isFinite(vy)) {
            xs.push(vx);
            ys.push(vy);
          }
        });
        return computePearsonCorrelation(xs, ys).r;
      })
    );
  }, [analysisResult]);

  // 현재 조작 상태와 연동된 Python (pandas / matplotlib) 코드 자동 생성
  const generatedPythonCode = useMemo(() => {
    const missingComment =
      config.missingStrategy === 'drop_row'
        ? '# 결측치(NaN)가 포함된 행 제거\ndf_clean = df.dropna().copy()'
        : config.missingStrategy === 'fill_mean'
        ? `# 수치형 변수의 결측치를 평균값(mean)으로 대체\ndf_clean = df.copy()\nfor col in ${JSON.stringify(
            analysisResult.numericColumns
          )}:\n    df_clean[col] = df_clean[col].fillna(df_clean[col].mean())`
        : config.missingStrategy === 'fill_median'
        ? `# 수치형 변수의 결측치를 중앙값(median)으로 대체\ndf_clean = df.copy()\nfor col in ${JSON.stringify(
            analysisResult.numericColumns
          )}:\n    df_clean[col] = df_clean[col].fillna(df_clean[col].median())`
        : '# 원본 데이터 유지 (결측치 미처리)\ndf_clean = df.copy()';

    const outlierCode =
      config.outlierStrategy === 'remove_iqr'
        ? `\n# IQR(사분위범위) 1.5배 기준 이상치(Outlier) 제거\nfor col in [${JSON.stringify(
            effectiveX
          )}, ${JSON.stringify(effectiveY)}]:\n    q1 = df_clean[col].quantile(0.25)\n    q3 = df_clean[col].quantile(0.75)\n    iqr = q3 - q1\n    df_clean = df_clean[(df_clean[col] >= q1 - 1.5 * iqr) & (df_clean[col] <= q3 + 1.5 * iqr)]`
        : config.outlierStrategy === 'clip_iqr'
        ? `\n# IQR(사분위범위) 상·하한 경계로 이상치 클리핑(Clipping)\nfor col in [${JSON.stringify(
            effectiveX
          )}, ${JSON.stringify(effectiveY)}]:\n    q1 = df_clean[col].quantile(0.25)\n    q3 = df_clean[col].quantile(0.75)\n    iqr = q3 - q1\n    df_clean[col] = df_clean[col].clip(lower=q1 - 1.5 * iqr, upper=q3 + 1.5 * iqr)`
        : '';

    return `import io
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# 1. 데이터셋 로드 (${presetMeta.shortLabel})
csv_data = """${rawCsv.trim()}"""
df = pd.read_csv(io.StringIO(csv_data))

print("=== [1] 원본 데이터 기초 통계 ===")
print(df[[${JSON.stringify(effectiveX)}, ${JSON.stringify(effectiveY)}]].describe().round(2))

# 2. 데이터 전처리 (결측치 & 이상치 정제)
${missingComment}${outlierCode}

print("\\n=== [2] 정제 후 데이터 기초 통계 ===")
print(df_clean[[${JSON.stringify(effectiveX)}, ${JSON.stringify(effectiveY)}]].describe().round(2))

r_val = df_clean[${JSON.stringify(effectiveX)}].corr(df_clean[${JSON.stringify(effectiveY)}])
print(f"\\n📈 정제 후 피어슨 상관계수(r): {r_val:.3f}")

# 3. 데이터 시각화 (Matplotlib)
plt.figure(figsize=(6.2, 3.6))
plt.scatter(df_clean[${JSON.stringify(effectiveX)}], df_clean[${JSON.stringify(effectiveY)}], color="#2563eb", s=55, alpha=0.85, label="Cleaned Data")
plt.title("Data Analysis: ${effectiveX} vs ${effectiveY} (r = " + f"{r_val:.2f})")
plt.xlabel(${JSON.stringify(effectiveX)})
plt.ylabel(${JSON.stringify(effectiveY)})
plt.grid(True, alpha=0.3)
plt.legend()
plt.tight_layout()
plt.show()`;
  }, [
    rawCsv,
    presetMeta.shortLabel,
    config.missingStrategy,
    config.outlierStrategy,
    analysisResult.numericColumns,
    effectiveX,
    effectiveY,
  ]);

  const rawXStats = analysisResult.rawStatsByCol[effectiveX];
  const cleanXStats = analysisResult.cleanStatsByCol[effectiveX];
  const rawYStats = analysisResult.rawStatsByCol[effectiveY];
  const cleanYStats = analysisResult.cleanStatsByCol[effectiveY];

  const handleAskQuestionWithDataState = () => {
    const missingLabel =
      config.missingStrategy === 'keep'
        ? '원본 유지'
        : config.missingStrategy === 'drop_row'
        ? '결측 행 삭제(dropna)'
        : config.missingStrategy === 'fill_mean'
        ? '평균값 대체(fillna mean)'
        : '중앙값 대체(fillna median)';
    const outlierLabel =
      config.outlierStrategy === 'keep'
        ? '원본 유지'
        : config.outlierStrategy === 'remove_iqr'
        ? 'IQR 이상치 제거'
        : 'IQR 상·하한 클리핑';

    const summary = [
      `[📊 데이터 분석 실습 상태 스냅샷]`,
      `- 데이터셋: ${presetMeta.label}`,
      `- 전처리 설정: 결측치(${missingLabel}) / 이상치(${outlierLabel})`,
      `- 분석 변수: X축(${effectiveX}) vs Y축(${effectiveY})`,
      rawXStats && cleanXStats
        ? `- ${effectiveX} 통계 변화: 평균 ${rawXStats.mean.toFixed(1)} → ${cleanXStats.mean.toFixed(1)} / 중앙값 ${rawXStats.median.toFixed(1)} → ${cleanXStats.median.toFixed(1)}`
        : '',
      `- 상관계수(r): 원본 ${correlationStats.rawCorr.r.toFixed(2)} → 정제 후 ${correlationStats.cleanCorr.r.toFixed(2)}`,
      ``,
      `❓ 질문 내용: 이 데이터에서 전처리 옵션을 바꿨을 때 평균과 상관계수가 이렇게 변하는 이유가 궁금합니다!`,
    ]
      .filter(Boolean)
      .join('\n');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('qclass:prefill-question', {
          detail: {
            type: 'question',
            content: summary,
          },
        })
      );
      const formEl = document.querySelector('textarea');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // 상관계수 해석 문구
  const interpretCorrelation = (r: number) => {
    const absR = Math.abs(r);
    const dir = r > 0 ? '양(+)' : r < 0 ? '음(-)' : '무';
    if (absR >= 0.7) return `강한 ${dir}의 상관관계`;
    if (absR >= 0.4) return `뚜렷한 ${dir}의 상관관계`;
    if (absR >= 0.2) return `약한 ${dir}의 상관관계`;
    return '상관관계가 거의 없음';
  };

  const uniqueGroups = useMemo(() => {
    const set = new Set<string>();
    correlationStats.pairedPoints.forEach((p) => set.add(p.group));
    return Array.from(set);
  }, [correlationStats.pairedPoints]);

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-teal-200/90 bg-slate-950 text-slate-100 shadow-md">
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-gradient-to-r from-teal-950/90 via-slate-900 to-emerald-950/80 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-lg bg-teal-500/20 border border-teal-400/40 px-2.5 py-1 text-xs font-extrabold text-teal-300 shrink-0">
            📊 데이터 분석 스튜디오
          </span>
          <span className="truncate text-sm font-extrabold text-white">
            {caption?.trim() || presetMeta.label}
          </span>
          <span className="hidden sm:inline-block rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-teal-200">
            {presetMeta.badge}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('studio')}
              className={`rounded-lg px-3 py-1 text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'studio'
                  ? 'bg-teal-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📊 시각적 데이터 탐색·전처리
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('python')}
              className={`rounded-lg px-3 py-1 text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'python'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🐍 연동된 Python (pandas) 실행
            </button>
          </div>

          <button
            type="button"
            onClick={handleAskQuestionWithDataState}
            className="rounded-xl border border-teal-400/50 bg-teal-500/20 px-3 py-1.5 text-xs font-extrabold text-teal-200 hover:bg-teal-500 hover:text-slate-950 transition cursor-pointer"
          >
            🙋 이 데이터·전처리 상태로 질문하기
          </button>
        </div>
      </div>

      {/* 수업 미션 안내 배너 */}
      {config.missionPrompt && (
        <div className="border-b border-teal-900/60 bg-teal-950/40 px-4 py-2.5 text-xs text-teal-100 flex items-start gap-2">
          <span className="font-extrabold text-teal-300 shrink-0">🎯 탐구 미션:</span>
          <span className="leading-relaxed">{config.missionPrompt}</span>
        </div>
      )}

      {activeTab === 'python' ? (
        <div className="p-4 bg-slate-950 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-2 text-xs text-emerald-200">
            <span>
              💡 좌측 스튜디오에서 설정한 <strong>결측치({config.missingStrategy}) · 이상치({config.outlierStrategy}) 전처리</strong>와 <strong>시각화 변수({effectiveX} vs {effectiveY})</strong>가 아래 `pandas` 코드에 자동 반영되었습니다!
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('studio')}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              ← 시각적 스튜디오로 돌아가기
            </button>
          </div>
          <ColabRunnerBlock
            code={generatedPythonCode}
            caption={`${presetMeta.shortLabel} - pandas 전처리 및 matplotlib 시각화 실습`}
          />
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* 1. 데이터셋 선택 & 전처리 컨트롤 바 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* 데이터셋 선택 */}
            <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-teal-300">
                  1️⃣ 실습 데이터셋 선택
                </span>
                <span className="text-[11px] text-slate-400">
                  총 {analysisResult.rawRows.length}행 → 정제 후{' '}
                  <strong className="text-emerald-300">
                    {analysisResult.cleanedRows.length}행
                  </strong>
                </span>
              </div>
              <select
                value={config.datasetId}
                onChange={(e) => {
                  const nextId = e.target.value as DatasetPresetId;
                  const nextMeta = DATASET_PRESETS[nextId];
                  updateConfig({
                    datasetId: nextId,
                    xColumn: nextMeta.defaultX,
                    yColumn: nextMeta.defaultY,
                    groupColumn: nextMeta.defaultGroup,
                  });
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white focus:border-teal-400 focus:outline-none"
              >
                {Object.values(DATASET_PRESETS).map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 leading-snug">
                {presetMeta.description}
              </p>
            </div>

            {/* 결측치(NaN) 전처리 */}
            <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-300">
                  2️⃣ 결측치 (NaN / 빈칸) 처리 방식
                </span>
                <span className="rounded-md bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                  결측 셀 강조됨
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'keep', label: '원본 그대로 유지' },
                    { id: 'drop_row', label: '🗑️ 결측 행 삭제 (dropna)' },
                    { id: 'fill_mean', label: '📐 평균값 대체 (mean)' },
                    { id: 'fill_median', label: '🎯 중앙값 대체 (median)' },
                  ] as { id: MissingValueStrategy; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateConfig({ missingStrategy: opt.id })}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer text-left ${
                      config.missingStrategy === opt.id
                        ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 이상치(Outlier) 전처리 */}
            <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-rose-300">
                  3️⃣ 이상치 (Outlier · 극단값) 정제
                </span>
                <span className="rounded-md bg-rose-500/20 border border-rose-400/30 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                  IQR 1.5배 기준
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {(
                  [
                    {
                      id: 'keep',
                      label: '⚠️ 원본 유지 (이상치가 평균과 추세선에 주는 왜곡 관찰)',
                    },
                    {
                      id: 'remove_iqr',
                      label: '✂️ IQR 기준 이상치 행 제거 (Q1-1.5×IQR ~ Q3+1.5×IQR 밖 삭제)',
                    },
                    {
                      id: 'clip_iqr',
                      label: '🧲 상·하한 경계값으로 클리핑 (극단값만 정상 경계로 보정)',
                    },
                  ] as { id: OutlierStrategy; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateConfig({ outlierStrategy: opt.id })}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer text-left truncate ${
                      config.outlierStrategy === opt.id
                        ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 커스텀 CSV 입력창 (직접 입력 모드일 때 표시) */}
          {config.datasetId === 'custom_csv' && (
            <div className="rounded-xl border border-teal-500/40 bg-slate-900 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-teal-300">
                  📋 CSV 데이터 직접 편집 (첫 줄은 열 이름, 쉼표로 구분, 빈칸은 결측치로 자동 인식)
                </span>
              </div>
              <textarea
                rows={5}
                value={rawCsv}
                onChange={(e) =>
                  updateConfig({ customCsvText: e.target.value })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 font-mono text-xs text-teal-100 focus:border-teal-400 focus:outline-none"
              />
            </div>
          )}

          {/* 2. 원본 vs 정제 후 기초 통계 & 상관계수 비교 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* X축 변수 통계 비교 */}
            {rawXStats && cleanXStats && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-sky-300">
                    📐 X축 [{effectiveX}] 기초 통계 비교
                  </span>
                  <span className="text-[10px] text-slate-400">
                    결측 {rawXStats.missingCount}개 · 이상치 {rawXStats.outlierCount}개
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-400">평균 (Mean)</div>
                    <div className="font-mono font-bold text-white mt-0.5">
                      {rawXStats.mean.toFixed(2)}{' '}
                      <span className="text-teal-400">
                        → {cleanXStats.mean.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-400">중앙값 (Median)</div>
                    <div className="font-mono font-bold text-white mt-0.5">
                      {rawXStats.median.toFixed(2)}{' '}
                      <span className="text-emerald-400">
                        → {cleanXStats.median.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 flex justify-between pt-0.5">
                  <span>
                    표준편차: {rawXStats.std.toFixed(2)} →{' '}
                    <strong className="text-slate-200">
                      {cleanXStats.std.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    범위: {cleanXStats.min.toFixed(1)} ~ {cleanXStats.max.toFixed(1)}
                  </span>
                </div>
              </div>
            )}

            {/* Y축 변수 통계 비교 */}
            {rawYStats && cleanYStats && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-indigo-300">
                    📐 Y축 [{effectiveY}] 기초 통계 비교
                  </span>
                  <span className="text-[10px] text-slate-400">
                    결측 {rawYStats.missingCount}개 · 이상치 {rawYStats.outlierCount}개
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-400">평균 (Mean)</div>
                    <div className="font-mono font-bold text-white mt-0.5">
                      {rawYStats.mean.toFixed(2)}{' '}
                      <span className="text-teal-400">
                        → {cleanYStats.mean.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-400">중앙값 (Median)</div>
                    <div className="font-mono font-bold text-white mt-0.5">
                      {rawYStats.median.toFixed(2)}{' '}
                      <span className="text-emerald-400">
                        → {cleanYStats.median.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 flex justify-between pt-0.5">
                  <span>
                    표준편차: {rawYStats.std.toFixed(2)} →{' '}
                    <strong className="text-slate-200">
                      {cleanYStats.std.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    범위: {cleanYStats.min.toFixed(1)} ~ {cleanYStats.max.toFixed(1)}
                  </span>
                </div>
              </div>
            )}

            {/* 상관계수 r & 회귀식 요약 */}
            <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-teal-300">
                  🔗 상관분석 탐색기 (피어슨 상관계수 r)
                </span>
                <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-extrabold text-teal-200">
                  {interpretCorrelation(correlationStats.cleanCorr.r)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-400">원본 상관계수 r</div>
                  <div className="font-mono text-sm font-extrabold text-slate-300 mt-0.5">
                    {correlationStats.rawCorr.r.toFixed(3)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-950 p-2 border border-teal-500/40">
                  <div className="text-[10px] text-teal-300">정제 후 상관계수 r</div>
                  <div className="font-mono text-sm font-extrabold text-teal-300 mt-0.5">
                    {correlationStats.cleanCorr.r.toFixed(3)}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-slate-300 font-mono truncate pt-0.5">
                추세선: y = {correlationStats.cleanCorr.slope.toFixed(2)}x{' '}
                {correlationStats.cleanCorr.intercept >= 0 ? '+' : '-'}{' '}
                {Math.abs(correlationStats.cleanCorr.intercept).toFixed(2)}
              </div>
            </div>
          </div>

          {/* 3. 메인 작업 영역: 좌측(데이터 테이블 & 전처리 하이라이트) + 우측(인터랙티브 차트 빌더) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 좌측: 전처리 하이라이트 데이터 테이블 (5열) */}
            <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/90 flex flex-col overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 bg-slate-950 px-3 py-2">
                <span className="text-xs font-extrabold text-slate-200">
                  🗂️ 데이터셋 테이블 (결측·이상치 실시간 감지)
                </span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="rounded bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.5 text-amber-200 font-bold">
                    NaN 결측
                  </span>
                  <span className="rounded bg-sky-500/20 border border-sky-400/40 px-1.5 py-0.5 text-sky-200 font-bold">
                    대체됨
                  </span>
                  <span className="rounded bg-rose-500/20 border border-rose-400/40 px-1.5 py-0.5 text-rose-200 font-bold">
                    ⚠️ 이상치
                  </span>
                </div>
              </div>

              <div className="max-h-[340px] overflow-auto">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 z-10">
                    <tr>
                      <th className="px-2 py-1.5 text-slate-500 font-mono">#</th>
                      {analysisResult.headers.map((h) => {
                        const isSelectedAxis =
                          h === effectiveX || h === effectiveY;
                        return (
                          <th
                            key={h}
                            className={`px-2.5 py-1.5 font-extrabold whitespace-nowrap ${
                              isSelectedAxis
                                ? 'text-teal-300 bg-teal-950/40'
                                : 'text-slate-300'
                            }`}
                          >
                            {h}
                            {h === effectiveX && ' (X)'}
                            {h === effectiveY && ' (Y)'}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {analysisResult.cellMatrix.map((rowMeta, rIdx) => {
                      const isRowRemoved =
                        analysisResult.removedRowIndices.has(rIdx);
                      return (
                        <tr
                          key={rIdx}
                          className={`transition ${
                            isRowRemoved
                              ? 'bg-rose-950/20 opacity-45 line-through'
                              : 'hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="px-2 py-1.5 font-mono text-slate-500">
                            {rIdx + 1}
                          </td>
                          {analysisResult.headers.map((col) => {
                            const cell = rowMeta[col];
                            if (!cell) return <td key={col} />;
                            return (
                              <td
                                key={col}
                                className={`px-2.5 py-1.5 font-mono whitespace-nowrap ${
                                  cell.wasImputed
                                    ? 'bg-sky-500/20 text-sky-200 font-bold'
                                    : cell.isMissing
                                    ? 'bg-amber-500/20 text-amber-300 font-bold'
                                    : cell.wasClipped
                                    ? 'bg-purple-500/20 text-purple-200 font-bold'
                                    : cell.isOutlier
                                    ? 'bg-rose-500/25 text-rose-200 font-extrabold'
                                    : 'text-slate-200'
                                }`}
                              >
                                {cell.wasImputed ? (
                                  <span title="결측치가 통계값으로 대체됨">
                                    {cell.cleanedNumValue} (대체)
                                  </span>
                                ) : cell.isMissing ? (
                                  <span>NaN (결측)</span>
                                ) : cell.wasClipped ? (
                                  <span
                                    title={`원본 이상치(${cell.rawValue})가 IQR 경계값으로 클리핑됨`}
                                  >
                                    {cell.cleanedNumValue} (보정)
                                  </span>
                                ) : cell.isOutlier ? (
                                  <span title="IQR 1.5배 범위를 벗어난 이상치">
                                    ⚠️ {cell.rawValue}
                                  </span>
                                ) : (
                                  cell.rawValue
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 우측: 인터랙티브 차트 빌더 (7열) */}
            <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 flex flex-col justify-between space-y-3">
              {/* 차트 종류 및 축 선택 툴바 */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'scatter', label: '🔵 산점도 & 추세선' },
                      { id: 'bar', label: '📊 평균 막대그래프' },
                      { id: 'histogram', label: '📈 히스토그램 분포' },
                      { id: 'heatmap', label: '🟧 상관계수 히트맵' },
                    ] as { id: DataChartType; label: string }[]
                  ).map((ct) => (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => updateConfig({ chartType: ct.id })}
                      className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition cursor-pointer ${
                        config.chartType === ct.id
                          ? 'bg-teal-500 text-slate-950'
                          : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>

                {/* X축 / Y축 / 그룹 선택 */}
                {config.chartType !== 'heatmap' && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold">X축:</span>
                      <select
                        value={effectiveX}
                        onChange={(e) =>
                          updateConfig({ xColumn: e.target.value })
                        }
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-sky-300"
                      >
                        {analysisResult.numericColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </label>

                    {config.chartType === 'scatter' && (
                      <label className="flex items-center gap-1">
                        <span className="text-slate-400 font-bold">Y축:</span>
                        <select
                          value={effectiveY}
                          onChange={(e) =>
                            updateConfig({ yColumn: e.target.value })
                          }
                          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-indigo-300"
                        >
                          {analysisResult.numericColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {analysisResult.categoricalColumns.length > 0 && (
                      <label className="flex items-center gap-1">
                        <span className="text-slate-400 font-bold">그룹:</span>
                        <select
                          value={effectiveGroup}
                          onChange={(e) =>
                            updateConfig({ groupColumn: e.target.value })
                          }
                          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-emerald-300"
                        >
                          {analysisResult.categoricalColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* SVG 차트 캔버스 */}
              <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-center min-h-[280px]">
                {config.chartType === 'scatter' && (() => {
                  const pts = correlationStats.pairedPoints;
                  if (pts.length === 0) {
                    return (
                      <div className="text-xs text-slate-500">
                        표시할 유효 수치 데이터가 없습니다.
                      </div>
                    );
                  }
                  const xs = pts.map((p) => p.x);
                  const ys = pts.map((p) => p.y);
                  const minX = Math.min(...xs);
                  const maxX = Math.max(...xs);
                  const minY = Math.min(...ys);
                  const maxY = Math.max(...ys);
                  const padX = Math.max(1, (maxX - minX) * 0.12);
                  const padY = Math.max(1, (maxY - minY) * 0.12);
                  const x0 = minX - padX;
                  const x1 = maxX + padX;
                  const y0 = minY - padY;
                  const y1 = maxY + padY;

                  const mapX = (v: number) =>
                    55 + ((v - x0) / Math.max(1e-6, x1 - x0)) * 425;
                  const mapY = (v: number) =>
                    220 - ((v - y0) / Math.max(1e-6, y1 - y0)) * 185;

                  const trendYStart =
                    correlationStats.cleanCorr.slope * x0 +
                    correlationStats.cleanCorr.intercept;
                  const trendYEnd =
                    correlationStats.cleanCorr.slope * x1 +
                    correlationStats.cleanCorr.intercept;

                  return (
                    <svg
                      viewBox="0 0 510 255"
                      className="w-full h-auto max-h-[280px]"
                    >
                      {/* 배경 격자 */}
                      {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
                        const gy = 35 + t * 185;
                        const valY = y1 - t * (y1 - y0);
                        return (
                          <g key={idx}>
                            <line
                              x1={55}
                              y1={gy}
                              x2={480}
                              y2={gy}
                              stroke="#1e293b"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={48}
                              y={gy + 4}
                              textAnchor="end"
                              fontSize="9"
                              fill="#94a3b8"
                            >
                              {valY.toFixed(1)}
                            </text>
                          </g>
                        );
                      })}
                      {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
                        const gx = 55 + t * 425;
                        const valX = x0 + t * (x1 - x0);
                        return (
                          <g key={idx}>
                            <line
                              x1={gx}
                              y1={35}
                              x2={gx}
                              y2={220}
                              stroke="#1e293b"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={gx}
                              y={235}
                              textAnchor="middle"
                              fontSize="9"
                              fill="#94a3b8"
                            >
                              {valX.toFixed(1)}
                            </text>
                          </g>
                        );
                      })}

                      {/* 축 */}
                      <line
                        x1={55}
                        y1={220}
                        x2={485}
                        y2={220}
                        stroke="#475569"
                        strokeWidth={1.5}
                      />
                      <line
                        x1={55}
                        y1={30}
                        x2={55}
                        y2={220}
                        stroke="#475569"
                        strokeWidth={1.5}
                      />

                      {/* 최소제곱 회귀 추세선 */}
                      {config.showTrendline !== false && pts.length >= 2 && (
                        <line
                          x1={mapX(x0)}
                          y1={Math.max(30, Math.min(220, mapY(trendYStart)))}
                          x2={mapX(x1)}
                          y2={Math.max(30, Math.min(220, mapY(trendYEnd)))}
                          stroke="#2dd4bf"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                        />
                      )}

                      {/* 산점도 포인트 */}
                      {pts.map((pt, idx) => {
                        const gIdx = Math.max(
                          0,
                          uniqueGroups.indexOf(pt.group)
                        );
                        const color = pt.isOutlier
                          ? '#f43f5e'
                          : GROUP_COLORS[gIdx % GROUP_COLORS.length];
                        const cx = mapX(pt.x);
                        const cy = mapY(pt.y);
                        return (
                          <g key={idx}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={pt.isOutlier ? 6.5 : 5}
                              fill={color}
                              fillOpacity={0.88}
                              stroke={
                                pt.isOutlier
                                  ? '#fda4af'
                                  : pt.wasImputed
                                  ? '#38bdf8'
                                  : '#0f172a'
                              }
                              strokeWidth={pt.isOutlier || pt.wasImputed ? 2 : 1}
                            >
                              <title>
                                {`#${pt.rowIndex} (${pt.group}) | ${effectiveX}: ${pt.x}, ${effectiveY}: ${pt.y}${
                                  pt.isOutlier ? ' [⚠️ 이상치]' : ''
                                }${pt.wasImputed ? ' [대체값]' : ''}`}
                              </title>
                            </circle>
                            {pt.isOutlier && (
                              <text
                                x={cx}
                                y={cy - 9}
                                textAnchor="middle"
                                fontSize="9"
                                fontWeight="bold"
                                fill="#fda4af"
                              >
                                ⚠️이상치({pt.x},{pt.y})
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* 축 라벨 */}
                      <text
                        x={268}
                        y={250}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill="#38bdf8"
                      >
                        X축: {effectiveX}
                      </text>
                      <text
                        x={14}
                        y={128}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill="#818cf8"
                        transform="rotate(-90 14 128)"
                      >
                        Y축: {effectiveY}
                      </text>
                    </svg>
                  );
                })()}

                {config.chartType === 'bar' && (() => {
                  // 그룹별(또는 상위 8개 행) X축 평균 막대그래프
                  const groupKey =
                    effectiveGroup || analysisResult.headers[0] || '';
                  const bucketMap = new Map<string, number[]>();
                  analysisResult.cleanedRows.forEach((r) => {
                    const g = String(r[groupKey] || '기타');
                    const v = Number(r[effectiveX]);
                    if (Number.isFinite(v)) {
                      if (!bucketMap.has(g)) bucketMap.set(g, []);
                      bucketMap.get(g)!.push(v);
                    }
                  });
                  const bars = Array.from(bucketMap.entries())
                    .slice(0, 8)
                    .map(([label, arr]) => ({
                      label,
                      avg: arr.reduce((a, b) => a + b, 0) / arr.length,
                    }));
                  const maxVal = Math.max(
                    1,
                    ...bars.map((b) => b.avg)
                  );

                  return (
                    <svg
                      viewBox="0 0 510 250"
                      className="w-full h-auto max-h-[280px]"
                    >
                      <line
                        x1={50}
                        y1={210}
                        x2={485}
                        y2={210}
                        stroke="#475569"
                        strokeWidth={1.5}
                      />
                      {bars.map((b, idx) => {
                        const slotW = 420 / Math.max(1, bars.length);
                        const barW = Math.min(44, slotW * 0.62);
                        const bx = 60 + idx * slotW + (slotW - barW) / 2;
                        const bh = (b.avg / maxVal) * 160;
                        const by = 210 - bh;
                        const color = GROUP_COLORS[idx % GROUP_COLORS.length];
                        return (
                          <g key={b.label}>
                            <rect
                              x={bx}
                              y={by}
                              width={barW}
                              height={Math.max(2, bh)}
                              rx={4}
                              fill={color}
                            />
                            <text
                              x={bx + barW / 2}
                              y={by - 6}
                              textAnchor="middle"
                              fontSize="9.5"
                              fontWeight="bold"
                              fill="#e2e8f0"
                            >
                              {b.avg.toFixed(1)}
                            </text>
                            <text
                              x={bx + barW / 2}
                              y={226}
                              textAnchor="middle"
                              fontSize="9"
                              fill="#94a3b8"
                            >
                              {b.label.slice(0, 7)}
                            </text>
                          </g>
                        );
                      })}
                      <text
                        x={265}
                        y={244}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill="#2dd4bf"
                      >
                        [{groupKey}]별 평균 {effectiveX} 비교
                      </text>
                    </svg>
                  );
                })()}

                {config.chartType === 'histogram' && (() => {
                  const vals = analysisResult.cleanedRows
                    .map((r) => Number(r[effectiveX]))
                    .filter((n) => Number.isFinite(n));
                  if (vals.length === 0 || !cleanXStats) {
                    return (
                      <div className="text-xs text-slate-500">
                        히스토그램을 그릴 데이터가 없습니다.
                      </div>
                    );
                  }
                  const binCount = 6;
                  const minV = cleanXStats.min;
                  const maxV = Math.max(minV + 1, cleanXStats.max);
                  const step = (maxV - minV) / binCount;
                  const bins = Array.from({ length: binCount }, (_, i) => ({
                    low: minV + i * step,
                    high: minV + (i + 1) * step,
                    count: 0,
                  }));
                  vals.forEach((v) => {
                    const idx = Math.min(
                      binCount - 1,
                      Math.max(0, Math.floor((v - minV) / step))
                    );
                    bins[idx].count++;
                  });
                  const maxCount = Math.max(1, ...bins.map((b) => b.count));
                  const mapValToX = (v: number) =>
                    60 + ((v - minV) / (maxV - minV)) * 410;

                  return (
                    <svg
                      viewBox="0 0 510 250"
                      className="w-full h-auto max-h-[280px]"
                    >
                      <line
                        x1={55}
                        y1={205}
                        x2={480}
                        y2={205}
                        stroke="#475569"
                        strokeWidth={1.5}
                      />
                      {bins.map((b, i) => {
                        const slotW = 410 / binCount;
                        const bx = 60 + i * slotW + 3;
                        const bw = slotW - 6;
                        const bh = (b.count / maxCount) * 150;
                        const by = 205 - bh;
                        return (
                          <g key={i}>
                            <rect
                              x={bx}
                              y={by}
                              width={bw}
                              height={Math.max(2, bh)}
                              rx={3}
                              fill="#0ea5e9"
                              fillOpacity={0.75}
                              stroke="#38bdf8"
                            />
                            <text
                              x={bx + bw / 2}
                              y={by - 5}
                              textAnchor="middle"
                              fontSize="9.5"
                              fontWeight="bold"
                              fill="#e0f2fe"
                            >
                              {b.count}건
                            </text>
                            <text
                              x={bx + bw / 2}
                              y={220}
                              textAnchor="middle"
                              fontSize="8.5"
                              fill="#94a3b8"
                            >
                              {b.low.toFixed(1)}~{b.high.toFixed(1)}
                            </text>
                          </g>
                        );
                      })}
                      {/* 평균선 (빨간 실선) vs 중앙값선 (초록 점선) */}
                      <line
                        x1={mapValToX(cleanXStats.mean)}
                        y1={35}
                        x2={mapValToX(cleanXStats.mean)}
                        y2={205}
                        stroke="#f43f5e"
                        strokeWidth={2}
                      />
                      <text
                        x={mapValToX(cleanXStats.mean)}
                        y={28}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="bold"
                        fill="#fda4af"
                      >
                        평균 {cleanXStats.mean.toFixed(1)}
                      </text>
                      <line
                        x1={mapValToX(cleanXStats.median)}
                        y1={42}
                        x2={mapValToX(cleanXStats.median)}
                        y2={205}
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                      />
                      <text
                        x={mapValToX(cleanXStats.median)}
                        y={242}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="bold"
                        fill="#6ee7b7"
                      >
                        ▲ 중앙값 {cleanXStats.median.toFixed(1)}
                      </text>
                    </svg>
                  );
                })()}

                {config.chartType === 'heatmap' && (() => {
                  const cols = analysisResult.numericColumns;
                  const n = cols.length;
                  if (n === 0) return null;
                  const cellSize = Math.min(48, Math.floor(190 / n));
                  const startX = 135;
                  const startY = 35;

                  return (
                    <svg
                      viewBox="0 0 510 250"
                      className="w-full h-auto max-h-[280px]"
                    >
                      {cols.map((rCol, rIdx) => (
                        <g key={rCol}>
                          <text
                            x={startX - 8}
                            y={startY + rIdx * cellSize + cellSize / 2 + 4}
                            textAnchor="end"
                            fontSize="9.5"
                            fontWeight="bold"
                            fill="#cbd5e1"
                          >
                            {rCol.slice(0, 10)}
                          </text>
                          {cols.map((cCol, cIdx) => {
                            const rVal = correlationMatrix[rIdx]?.[cIdx] ?? 0;
                            const bg =
                              rVal >= 0
                                ? `rgba(20, 184, 166, ${0.15 + Math.abs(rVal) * 0.75})`
                                : `rgba(244, 63, 94, ${0.15 + Math.abs(rVal) * 0.75})`;
                            return (
                              <g key={cCol}>
                                {rIdx === 0 && (
                                  <text
                                    x={
                                      startX +
                                      cIdx * cellSize +
                                      cellSize / 2
                                    }
                                    y={startY - 8}
                                    textAnchor="middle"
                                    fontSize="9"
                                    fontWeight="bold"
                                    fill="#94a3b8"
                                  >
                                    {cCol.slice(0, 6)}
                                  </text>
                                )}
                                <rect
                                  x={startX + cIdx * cellSize}
                                  y={startY + rIdx * cellSize}
                                  width={cellSize - 3}
                                  height={cellSize - 3}
                                  rx={5}
                                  fill={bg}
                                  stroke="#1e293b"
                                />
                                <text
                                  x={
                                    startX +
                                    cIdx * cellSize +
                                    (cellSize - 3) / 2
                                  }
                                  y={
                                    startY +
                                    rIdx * cellSize +
                                    (cellSize - 3) / 2 +
                                    4
                                  }
                                  textAnchor="middle"
                                  fontSize="10"
                                  fontWeight="bold"
                                  fill="#ffffff"
                                >
                                  {rVal.toFixed(2)}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      ))}
                    </svg>
                  );
                })()}
              </div>

              {/* 하단 범례 및 추세선 옵션 */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <div className="flex flex-wrap items-center gap-3">
                  {uniqueGroups.map((g, idx) => (
                    <span key={g} className="inline-flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            GROUP_COLORS[idx % GROUP_COLORS.length],
                        }}
                      />
                      <span className="font-semibold text-slate-300">{g}</span>
                    </span>
                  ))}
                </div>

                {config.chartType === 'scatter' && (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-teal-300 font-bold">
                    <input
                      type="checkbox"
                      checked={config.showTrendline !== false}
                      onChange={(e) =>
                        updateConfig({ showTrendline: e.target.checked })
                      }
                      className="accent-teal-400"
                    />
                    <span>선형 회귀 추세선 표시</span>
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
