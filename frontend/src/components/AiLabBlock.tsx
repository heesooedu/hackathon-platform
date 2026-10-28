'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ColabRunnerBlock from '@/components/ColabRunnerBlock';

export type MlAlgorithmType =
  | 'linear_regression'
  | 'knn'
  | 'decision_tree'
  | 'kmeans';

export interface AiLabConfig {
  algorithm: MlAlgorithmType;
  // 선형 회귀 하이퍼파라미터
  slopeW: number;
  interceptB: number;
  learningRate: number;
  // k-NN 하이퍼파라미터
  kNeighbors: number;
  distanceMetric: 'euclidean' | 'manhattan';
  testPoint: { x: number; y: number };
  // 결정 트리 하이퍼파라미터
  maxDepth: number;
  splitCriterion: 'gini' | 'entropy';
  // k-Means 하이퍼파라미터
  kClusters: number;
  missionPrompt?: string;
}

export interface AiLabTemplateItem {
  id: string;
  algorithm: MlAlgorithmType;
  label: string;
  caption: string;
  config: AiLabConfig;
}

export const ML_ALGORITHM_META: Record<
  MlAlgorithmType,
  {
    label: string;
    shortLabel: string;
    category: string;
    badge: string;
    description: string;
  }
> = {
  linear_regression: {
    label: '📈 선형 회귀 & 경사하강법 (Linear Regression)',
    shortLabel: '📈 선형 회귀',
    category: '지도학습 · 회귀',
    badge: 'Regression',
    description:
      '데이터 점들과의 오차(잔차 제곱합, MSE)가 최소가 되는 최적의 추세선(y = wx + b)을 경사하강법으로 찾아갑니다.',
  },
  knn: {
    label: '🎯 k-최근접 이웃 분류 (k-NN Classifier)',
    shortLabel: '🎯 k-NN 분류',
    category: '지도학습 · 분류',
    badge: 'k-NN',
    description:
      '새로운 데이터(★)에서 가장 가까운 K개의 이웃을 찾아 다수결 투표로 품종/클래스를 분류합니다.',
  },
  decision_tree: {
    label: '🌳 결정 트리 (Decision Tree Classifier)',
    shortLabel: '🌳 결정 트리',
    category: '지도학습 · 분류',
    badge: 'Decision Tree',
    description:
      '스무고개처럼 특성 기준값(Threshold)으로 공간을 분할하며 불순도(Gini/Entropy)를 낮추는 트리 모델을 만듭니다.',
  },
  kmeans: {
    label: '🫧 k-평균 군집화 (k-Means Clustering)',
    shortLabel: '🫧 k-Means 군집화',
    category: '비지도학습 · 군집',
    badge: 'k-Means',
    description:
      '정답 레이블이 없는 데이터에서 K개의 중심점(Centroid)을 배정하고 평균 위치로 이동시키며 스스로 군집을 묶습니다.',
  },
};

export const AI_LAB_TEMPLATES: AiLabTemplateItem[] = [
  {
    id: 'linear-regression-gd',
    algorithm: 'linear_regression',
    label: '📈 [지도학습·회귀] 경사하강법으로 공부시간 대비 성적 예측 추세선 찾기',
    caption: '기울기(w)와 절편(b)을 조절해 평균제곱오차(MSE)를 최소화하는 선형 회귀 실습',
    config: {
      algorithm: 'linear_regression',
      slopeW: 3.5,
      interceptB: 45,
      learningRate: 0.02,
      kNeighbors: 3,
      distanceMetric: 'euclidean',
      testPoint: { x: 5.2, y: 5.0 },
      maxDepth: 2,
      splitCriterion: 'gini',
      kClusters: 3,
      missionPrompt:
        '기울기(w)와 절편(b) 슬라이더를 직접 움직여 MSE(평균제곱오차)를 20 이하로 낮춰보고, [⚡ 경사하강법 1스텝 학습] 버튼을 눌러 인공지능이 스스로 오차를 줄이는 과정을 확인하세요!',
    },
  },
  {
    id: 'knn-overfitting-lab',
    algorithm: 'knn',
    label: '🎯 [지도학습·분류] k-NN 알고리즘에서 K값 변화와 결정 경계 탐색',
    caption: '2차원 평면 위를 클릭해 새로운 데이터(★)를 찍고 K값(1~9)에 따른 다수결 분류 결과를 비교합니다',
    config: {
      algorithm: 'knn',
      slopeW: 6.2,
      interceptB: 48,
      learningRate: 0.02,
      kNeighbors: 3,
      distanceMetric: 'euclidean',
      testPoint: { x: 5.2, y: 5.0 },
      maxDepth: 2,
      splitCriterion: 'gini',
      kClusters: 3,
      missionPrompt:
        '캔버스에서 두 클래스 경계 부근을 클릭해 테스트 점(★)을 옮긴 뒤, K=1일 때와 K=5, K=7일 때 분류 결과가 어떻게 달라지는지 비교해 보세요.',
    },
  },
  {
    id: 'decision-tree-depth-lab',
    algorithm: 'decision_tree',
    label: '🌳 [지도학습·분류] 결정 트리 깊이(max_depth)와 불순도(Gini) 분할 실험',
    caption: '트리 깊이(1~3단계)를 늘릴 때 특성 공간 분할 영역과 정확도·과적합 위험을 비교합니다',
    config: {
      algorithm: 'decision_tree',
      slopeW: 6.2,
      interceptB: 48,
      learningRate: 0.02,
      kNeighbors: 3,
      distanceMetric: 'euclidean',
      testPoint: { x: 5.2, y: 5.0 },
      maxDepth: 2,
      splitCriterion: 'gini',
      kClusters: 3,
      missionPrompt:
        '트리 최대 깊이(max_depth)를 1단계에서 3단계로 높일 때 좌측 분할 영역과 우측 결정 트리의 불순도(Gini)가 어떻게 감소하는지 관찰해 보세요.',
    },
  },
  {
    id: 'kmeans-step-lab',
    algorithm: 'kmeans',
    label: '🫧 [비지도학습·군집] k-평균(k-Means) 중심점 이동 단계별 시뮬레이션',
    caption: '정답이 없는 데이터를 K개의 군집으로 묶는 [배정 → 중심점 이동] 반복 과정을 단계별로 체험합니다',
    config: {
      algorithm: 'kmeans',
      slopeW: 6.2,
      interceptB: 48,
      learningRate: 0.02,
      kNeighbors: 3,
      distanceMetric: 'euclidean',
      testPoint: { x: 5.2, y: 5.0 },
      maxDepth: 2,
      splitCriterion: 'gini',
      kClusters: 3,
      missionPrompt:
        '[🎲 중심점 초기화] 후 [👣 다음 단계 실행] 버튼을 반복해서 누르며 중심점(★)이 군집의 무게중심으로 이동해 수렴하는 과정을 확인하세요.',
    },
  },
];

const DEFAULT_AI_CONFIG: AiLabConfig = AI_LAB_TEMPLATES[0].config;

export function parseAiLabBlockContent(raw: string): AiLabConfig {
  if (!raw || !raw.trim()) {
    return { ...DEFAULT_AI_CONFIG };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AiLabConfig>;
    const algorithm: MlAlgorithmType =
      parsed.algorithm && parsed.algorithm in ML_ALGORITHM_META
        ? parsed.algorithm
        : 'linear_regression';
    return {
      algorithm,
      slopeW: typeof parsed.slopeW === 'number' ? parsed.slopeW : 3.5,
      interceptB:
        typeof parsed.interceptB === 'number' ? parsed.interceptB : 45,
      learningRate:
        typeof parsed.learningRate === 'number' ? parsed.learningRate : 0.02,
      kNeighbors:
        typeof parsed.kNeighbors === 'number'
          ? Math.max(1, Math.min(9, parsed.kNeighbors))
          : 3,
      distanceMetric:
        parsed.distanceMetric === 'manhattan' ? 'manhattan' : 'euclidean',
      testPoint:
        parsed.testPoint &&
        typeof parsed.testPoint.x === 'number' &&
        typeof parsed.testPoint.y === 'number'
          ? parsed.testPoint
          : { x: 5.2, y: 5.0 },
      maxDepth:
        typeof parsed.maxDepth === 'number'
          ? Math.max(1, Math.min(3, parsed.maxDepth))
          : 2,
      splitCriterion:
        parsed.splitCriterion === 'entropy' ? 'entropy' : 'gini',
      kClusters:
        typeof parsed.kClusters === 'number'
          ? Math.max(2, Math.min(4, parsed.kClusters))
          : 3,
      missionPrompt: parsed.missionPrompt || '',
    };
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export function serializeAiLabBlockContent(config: AiLabConfig): string {
  return JSON.stringify(config, null, 2);
}

// 1) 선형 회귀 실습용 데이터 (공부시간 x: 1~9시간 -> 성적 y: 50~96점)
const REGRESSION_DATA: { x: number; y: number }[] = [
  { x: 1.0, y: 52 },
  { x: 1.8, y: 59 },
  { x: 2.5, y: 63 },
  { x: 3.2, y: 68 },
  { x: 4.0, y: 74 },
  { x: 4.8, y: 77 },
  { x: 5.5, y: 83 },
  { x: 6.5, y: 88 },
  { x: 7.5, y: 92 },
  { x: 8.5, y: 96 },
];

// 2) 분류(k-NN & 결정 트리) 실습용 2D 데이터 (x: 당도 1~9, y: 아삭함 1~9)
// class 0: 과일류(사과/배 - 당도 높음), class 1: 채소류(오이/샐러리 - 당도 낮고 아삭함), class 2: 베리/무른 과일(당도 중간~높고 아삭함 낮음)
const CLASSIFICATION_DATA: {
  id: string;
  x: number;
  y: number;
  cls: 0 | 1;
  name: string;
}[] = [
  { id: 'c1', x: 2.1, y: 7.2, cls: 0, name: '오이A' },
  { id: 'c2', x: 2.8, y: 6.5, cls: 0, name: '샐러리A' },
  { id: 'c3', x: 3.3, y: 7.8, cls: 0, name: '오이B' },
  { id: 'c4', x: 1.9, y: 5.4, cls: 0, name: '상추A' },
  { id: 'c5', x: 3.8, y: 6.1, cls: 0, name: '당근A' },
  { id: 'c6', x: 4.4, y: 3.8, cls: 0, name: '토마토A' },
  { id: 'c7', x: 3.1, y: 3.2, cls: 0, name: '브로콜리' },
  { id: 'c8', x: 5.5, y: 6.8, cls: 0, name: '경계샘플(채소)' }, // 노이즈성 경계 샘플
  { id: 'f1', x: 6.8, y: 7.4, cls: 1, name: '사과A' },
  { id: 'f2', x: 7.5, y: 6.8, cls: 1, name: '사과B' },
  { id: 'f3', x: 8.1, y: 7.9, cls: 1, name: '배A' },
  { id: 'f4', x: 6.4, y: 5.2, cls: 1, name: '단감A' },
  { id: 'f5', x: 7.2, y: 3.5, cls: 1, name: '포도A' },
  { id: 'f6', x: 8.3, y: 2.8, cls: 1, name: '복숭아A' },
  { id: 'f7', x: 5.9, y: 4.1, cls: 1, name: '귤A' },
  { id: 'f8', x: 4.7, y: 5.3, cls: 1, name: '경계샘플(과일)' },
];

// 3) 군집화(k-Means) 실습용 비지도 데이터 (3개 자연 군집 분포)
const CLUSTERING_DATA: { x: number; y: number }[] = [
  // 군집 A (좌하단)
  { x: 2.0, y: 2.3 },
  { x: 2.6, y: 1.9 },
  { x: 1.8, y: 3.1 },
  { x: 2.9, y: 2.8 },
  { x: 2.3, y: 2.5 },
  // 군집 B (상단 중앙)
  { x: 5.0, y: 7.6 },
  { x: 4.4, y: 7.1 },
  { x: 5.6, y: 7.9 },
  { x: 5.2, y: 6.8 },
  { x: 4.7, y: 8.1 },
  // 군집 C (우하단)
  { x: 7.6, y: 2.9 },
  { x: 8.2, y: 2.2 },
  { x: 7.1, y: 3.5 },
  { x: 8.4, y: 3.3 },
  { x: 7.8, y: 2.5 },
];

const CLUSTER_COLORS = ['#38bdf8', '#f43f5e', '#10b981', '#f59e0b'];

function computeImpurity(
  counts: [number, number],
  criterion: 'gini' | 'entropy'
): number {
  const total = counts[0] + counts[1];
  if (total === 0) return 0;
  const p0 = counts[0] / total;
  const p1 = counts[1] / total;
  if (criterion === 'gini') {
    return 1 - (p0 * p0 + p1 * p1);
  }
  const e0 = p0 > 0 ? -p0 * Math.log2(p0) : 0;
  const e1 = p1 > 0 ? -p1 * Math.log2(p1) : 0;
  return e0 + e1;
}

export interface AiLabBlockProps {
  rawContent: string;
  caption?: string;
  externalUrl?: string;
  compact?: boolean;
  onChangeContent?: (nextRaw: string) => void;
}

export default function AiLabBlock({
  rawContent,
  caption,
  onChangeContent,
}: AiLabBlockProps) {
  const [config, setConfig] = useState<AiLabConfig>(() =>
    parseAiLabBlockContent(rawContent)
  );
  const [activeTab, setActiveTab] = useState<'simulator' | 'python'>(
    'simulator'
  );
  const [gdEpoch, setGdEpoch] = useState<number>(0);

  // k-Means 단계별 상태
  const [centroids, setCentroids] = useState<{ x: number; y: number }[]>([
    { x: 2.2, y: 6.8 },
    { x: 5.0, y: 4.5 },
    { x: 7.8, y: 6.5 },
  ]);
  const [assignments, setAssignments] = useState<number[]>(() =>
    CLUSTERING_DATA.map(() => 0)
  );
  const [kmeansStepCount, setKmeansStepCount] = useState<number>(0);

  const knnSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setConfig(parseAiLabBlockContent(rawContent));
  }, [rawContent]);

  const updateConfig = useCallback(
    (patch: Partial<AiLabConfig>) => {
      setConfig((prev) => {
        const next: AiLabConfig = { ...prev, ...patch };
        if (onChangeContent) {
          onChangeContent(serializeAiLabBlockContent(next));
        }
        return next;
      });
    },
    [onChangeContent]
  );

  // k-Means 중심점 초기화 및 배정 계산
  const initKMeansCentroids = useCallback((k: number) => {
    const presetStarts: { x: number; y: number }[] = [
      { x: 2.1, y: 7.2 },
      { x: 5.0, y: 4.8 },
      { x: 8.0, y: 6.9 },
      { x: 3.5, y: 2.0 },
    ];
    const nextC = presetStarts.slice(0, k);
    setCentroids(nextC);
    const nextAssign = CLUSTERING_DATA.map((pt) => {
      let bestIdx = 0;
      let bestDist = Infinity;
      nextC.forEach((c, idx) => {
        const d = (pt.x - c.x) ** 2 + (pt.y - c.y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });
      return bestIdx;
    });
    setAssignments(nextAssign);
    setKmeansStepCount(0);
  }, []);

  useEffect(() => {
    initKMeansCentroids(config.kClusters);
  }, [config.kClusters, initKMeansCentroids]);

  // 1) 선형 회귀 MSE 및 경사하강법 계산
  const regressionStats = useMemo(() => {
    const w = config.slopeW;
    const b = config.interceptB;
    let sumSqError = 0;
    let gradW = 0;
    let gradB = 0;
    const n = REGRESSION_DATA.length;

    const residuals = REGRESSION_DATA.map((pt) => {
      const yPred = w * pt.x + b;
      const err = yPred - pt.y;
      sumSqError += err * err;
      gradW += (2 / n) * err * pt.x;
      gradB += (2 / n) * err;
      return { ...pt, yPred, err };
    });

    const mse = sumSqError / n;
    return { mse, gradW, gradB, residuals };
  }, [config.slopeW, config.interceptB]);

  const handleGradientDescentStep = (steps = 1) => {
    let w = config.slopeW;
    let b = config.interceptB;
    const lr = config.learningRate;
    const n = REGRESSION_DATA.length;

    for (let s = 0; s < steps; s++) {
      let gw = 0;
      let gb = 0;
      REGRESSION_DATA.forEach((pt) => {
        const err = w * pt.x + b - pt.y;
        gw += (2 / n) * err * pt.x;
        gb += (2 / n) * err;
      });
      w -= lr * gw;
      b -= lr * gb * 2.5;
    }

    setGdEpoch((prev) => prev + steps);
    updateConfig({
      slopeW: Number(w.toFixed(2)),
      interceptB: Number(b.toFixed(1)),
    });
  };

  // 2) k-NN 거리 및 최근접 K개 이웃 계산
  const knnResult = useMemo(() => {
    const tx = config.testPoint.x;
    const ty = config.testPoint.y;
    const k = config.kNeighbors;

    const withDist = CLASSIFICATION_DATA.map((pt) => {
      const dist =
        config.distanceMetric === 'manhattan'
          ? Math.abs(pt.x - tx) + Math.abs(pt.y - ty)
          : Math.hypot(pt.x - tx, pt.y - ty);
      return { ...pt, dist };
    }).sort((a, b) => a.dist - b.dist);

    const neighbors = withDist.slice(0, k);
    const votes0 = neighbors.filter((n) => n.cls === 0).length;
    const votes1 = neighbors.filter((n) => n.cls === 1).length;
    const predictedClass: 0 | 1 = votes1 >= votes0 ? 1 : 0;
    const kthRadius = neighbors[neighbors.length - 1]?.dist ?? 1;

    return {
      neighbors,
      votes0,
      votes1,
      predictedClass,
      kthRadius,
    };
  }, [config.testPoint, config.kNeighbors, config.distanceMetric]);

  // 3) 결정 트리 분할 및 불순도/정확도 계산
  const treeResult = useMemo(() => {
    const depth = config.maxDepth;
    const crit = config.splitCriterion;

    // 루트 전체 분포
    const rootCounts: [number, number] = [
      CLASSIFICATION_DATA.filter((d) => d.cls === 0).length,
      CLASSIFICATION_DATA.filter((d) => d.cls === 1).length,
    ];
    const rootImpurity = computeImpurity(rootCounts, crit);

    // 1단계 분할: 당도(x) >= 5.2
    const left1 = CLASSIFICATION_DATA.filter((d) => d.x < 5.2);
    const right1 = CLASSIFICATION_DATA.filter((d) => d.x >= 5.2);
    const left1Counts: [number, number] = [
      left1.filter((d) => d.cls === 0).length,
      left1.filter((d) => d.cls === 1).length,
    ];
    const right1Counts: [number, number] = [
      right1.filter((d) => d.cls === 0).length,
      right1.filter((d) => d.cls === 1).length,
    ];

    // 예측 함수 (깊이별)
    const predictPoint = (x: number, y: number): 0 | 1 => {
      if (depth === 1) {
        return x >= 5.2 ? 1 : 0;
      }
      if (depth === 2) {
        if (x < 5.2) {
          return x >= 4.5 && y >= 5.0 ? 1 : 0;
        }
        return y >= 6.4 && x < 5.8 ? 0 : 1;
      }
      // depth === 3 (경계 샘플까지 모두 맞추는 세밀한 분할 -> 과적합 경향 시연)
      if (x < 5.2) {
        if (x >= 4.5 && y >= 5.0 && y < 5.8) return 1;
        return 0;
      }
      if (x < 5.8 && y >= 6.4) return 0;
      return 1;
    };

    let correctCount = 0;
    CLASSIFICATION_DATA.forEach((d) => {
      if (predictPoint(d.x, d.y) === d.cls) correctCount++;
    });
    const accuracy = (correctCount / CLASSIFICATION_DATA.length) * 100;

    return {
      rootCounts,
      rootImpurity,
      left1Counts,
      left1Impurity: computeImpurity(left1Counts, crit),
      right1Counts,
      right1Impurity: computeImpurity(right1Counts, crit),
      accuracy,
      predictPoint,
    };
  }, [config.maxDepth, config.splitCriterion]);

  // 4) k-Means 1스텝 이동 및 Inertia 계산
  const kmeansInertia = useMemo(() => {
    let sum = 0;
    CLUSTERING_DATA.forEach((pt, idx) => {
      const c = centroids[assignments[idx]] || centroids[0];
      if (c) {
        sum += (pt.x - c.x) ** 2 + (pt.y - c.y) ** 2;
      }
    });
    return sum;
  }, [centroids, assignments]);

  const handleKMeansNextStep = () => {
    const k = config.kClusters;
    // 현재 배정된 점들의 평균 좌표로 중심점 이동
    const nextCentroids = centroids.map((oldC, cIdx) => {
      const clusterPts = CLUSTERING_DATA.filter(
        (_, pIdx) => assignments[pIdx] === cIdx
      );
      if (clusterPts.length === 0) return oldC;
      const mx =
        clusterPts.reduce((acc, p) => acc + p.x, 0) / clusterPts.length;
      const my =
        clusterPts.reduce((acc, p) => acc + p.y, 0) / clusterPts.length;
      return { x: Number(mx.toFixed(2)), y: Number(my.toFixed(2)) };
    });

    // 새 중심점 기준으로 다시 가장 가까운 군집 배정
    const nextAssign = CLUSTERING_DATA.map((pt) => {
      let bestIdx = 0;
      let bestDist = Infinity;
      nextCentroids.slice(0, k).forEach((c, idx) => {
        const d = (pt.x - c.x) ** 2 + (pt.y - c.y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });
      return bestIdx;
    });

    setCentroids(nextCentroids);
    setAssignments(nextAssign);
    setKmeansStepCount((prev) => prev + 1);
  };

  // 현재 알고리즘 및 하이퍼파라미터와 연동된 Python 코드 생성
  const generatedPythonCode = useMemo(() => {
    if (config.algorithm === 'linear_regression') {
      return `import numpy as np
import matplotlib.pyplot as plt

# 1. 공부시간(X)과 성적(y) 데이터 준비
X = np.array([1.0, 1.8, 2.5, 3.2, 4.0, 4.8, 5.5, 6.5, 7.5, 8.5])
y = np.array([52, 59, 63, 68, 74, 77, 83, 88, 92, 96])

# 2. 실험실에서 설정한 가중치(기울기 w)와 절편(b)
w = ${config.slopeW}
b = ${config.interceptB}
y_pred = w * X + b
mse = np.mean((y - y_pred) ** 2)

# 최소제곱법 최적해 계산
opt_w, opt_b = np.polyfit(X, y, 1)
print(f"📊 현재 모델: y = {w:.2f}x + {b:.1f} -> 평균제곱오차(MSE) = {mse:.2f}")
print(f"🏆 최적 회귀식: y = {opt_w:.2f}x + {opt_b:.1f}")

plt.figure(figsize=(6, 3.5))
plt.scatter(X, y, color="#38bdf8", s=60, label="Actual Data")
plt.plot(X, y_pred, color="#f43f5e", linewidth=2.2, label=f"Current Line (MSE={mse:.1f})")
plt.plot(X, opt_w * X + opt_b, "--", color="#10b981", label="Optimal Line")
plt.title("Linear Regression & MSE Loss")
plt.xlabel("Study Hours (X)")
plt.ylabel("Score (y)")
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()`;
    }

    if (config.algorithm === 'knn') {
      return `import numpy as np
import matplotlib.pyplot as plt

# 1. 과일(1) vs 채소(0) 특성 데이터 (X1: 당도, X2: 아삭함)
data = np.array([
    [2.1, 7.2, 0], [2.8, 6.5, 0], [3.3, 7.8, 0], [1.9, 5.4, 0],
    [3.8, 6.1, 0], [4.4, 3.8, 0], [3.1, 3.2, 0], [5.5, 6.8, 0],
    [6.8, 7.4, 1], [7.5, 6.8, 1], [8.1, 7.9, 1], [6.4, 5.2, 1],
    [7.2, 3.5, 1], [8.3, 2.8, 1], [5.9, 4.1, 1], [4.7, 5.3, 1]
])
X = data[:, :2]
y = data[:, 2].astype(int)

# 2. 실험실에서 선택한 하이퍼파라미터 K와 테스트 점(★)
K = ${config.kNeighbors}
test_pt = np.array([${config.testPoint.x.toFixed(1)}, ${config.testPoint.y.toFixed(1)}])

# 거리 계산 (${config.distanceMetric})
if "${config.distanceMetric}" == "manhattan":
    dists = np.sum(np.abs(X - test_pt), axis=1)
else:
    dists = np.sqrt(np.sum((X - test_pt) ** 2, axis=1))

nearest_idx = np.argsort(dists)[:K]
nearest_labels = y[nearest_idx]
pred_class = 1 if np.sum(nearest_labels == 1) >= np.sum(nearest_labels == 0) else 0

print(f"🎯 K = {K} 최근접 이웃 레이블: {nearest_labels}")
print(f"✅ 최종 다수결 예측 결과: {'🍎 과일류(Class 1)' if pred_class == 1 else '🥒 채소류(Class 0)'}")`;
    }

    if (config.algorithm === 'decision_tree') {
      return `import numpy as np

# 결정 트리 불순도(${config.splitCriterion.toUpperCase()}) 계산 실습
def calc_impurity(counts, criterion="${config.splitCriterion}"):
    total = sum(counts)
    if total == 0:
        return 0.0
    probs = [c / total for c in counts if c > 0]
    if criterion == "gini":
        return 1.0 - sum(p ** 2 for p in probs)
    return -sum(p * np.log2(p) for p in probs)

root_counts = [8, 8]      # 전체: 채소 8개, 과일 8개
left_counts = [7, 1]      # 당도 < 5.2: 채소 7개, 과일 1개
right_counts = [1, 7]     # 당도 >= 5.2: 채소 1개, 과일 7개

print(f"🌳 트리 최대 깊이(max_depth) = ${config.maxDepth}")
print(f"1) 분할 전 루트 노드 불순도: {calc_impurity(root_counts):.3f}")
print(f"2) 왼쪽 자식 노드(당도 < 5.2) 불순도: {calc_impurity(left_counts):.3f}")
print(f"3) 오른쪽 자식 노드(당도 >= 5.2) 불순도: {calc_impurity(right_counts):.3f}")`;
    }

    return `import numpy as np
import matplotlib.pyplot as plt

# k-Means 비지도 군집화 알고리즘 직접 구현 실습 (K = ${config.kClusters})
X = np.array([
    [2.0, 2.3], [2.6, 1.9], [1.8, 3.1], [2.9, 2.8], [2.3, 2.5],
    [5.0, 7.6], [4.4, 7.1], [5.6, 7.9], [5.2, 6.8], [4.7, 8.1],
    [7.6, 2.9], [8.2, 2.2], [7.1, 3.5], [8.4, 3.3], [7.8, 2.5]
])

K = ${config.kClusters}
centroids = X[:K].copy()

for step in range(5):
    dists = np.linalg.norm(X[:, None, :] - centroids[None, :, :], axis=2)
    labels = np.argmin(dists, axis=1)
    for k in range(K):
        if np.any(labels == k):
            centroids[k] = X[labels == k].mean(axis=0)

print(f"🫧 수렴된 {K}개 군집 중심점(Centroids):\\n", np.round(centroids, 2))`;
  }, [config]);

  const handleAskQuestionWithAiState = () => {
    const algMeta = ML_ALGORITHM_META[config.algorithm];
    let stateDetail = '';
    if (config.algorithm === 'linear_regression') {
      stateDetail = `기울기 w=${config.slopeW}, 절편 b=${config.interceptB}, 학습률=${config.learningRate} (현재 MSE=${regressionStats.mse.toFixed(2)})`;
    } else if (config.algorithm === 'knn') {
      stateDetail = `이웃 수 K=${config.kNeighbors}, 거리측정=${config.distanceMetric}, 테스트점=(${config.testPoint.x.toFixed(1)}, ${config.testPoint.y.toFixed(1)}) → 예측: ${
        knnResult.predictedClass === 1 ? '과일류(1)' : '채소류(0)'
      } (과일 ${knnResult.votes1}표 vs 채소 ${knnResult.votes0}표)`;
    } else if (config.algorithm === 'decision_tree') {
      stateDetail = `최대 깊이 max_depth=${config.maxDepth}, 분할 기준=${config.splitCriterion.toUpperCase()} → 분류 정확도 ${treeResult.accuracy.toFixed(1)}%`;
    } else {
      stateDetail = `군집 개수 K=${config.kClusters}, 반복 단계=${kmeansStepCount}회, 군집 응집도 오차(Inertia)=${kmeansInertia.toFixed(2)}`;
    }

    const summary = [
      `[🤖 AI·머신러닝 실험실 스냅샷]`,
      `- 알고리즘: ${algMeta.label} (${algMeta.category})`,
      `- 하이퍼파라미터 및 실험 결과: ${stateDetail}`,
      ``,
      `❓ 질문 내용: 이 하이퍼파라미터 설정에서 모델의 예측 결과(또는 오차)가 왜 이렇게 나오는지 궁금합니다!`,
    ].join('\n');

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

  const algMeta = ML_ALGORITHM_META[config.algorithm];

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-violet-300/80 bg-slate-950 text-slate-100 shadow-md">
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-gradient-to-r from-violet-950/90 via-slate-900 to-indigo-950/90 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-lg bg-violet-500/20 border border-violet-400/40 px-2.5 py-1 text-xs font-extrabold text-violet-300 shrink-0">
            🤖 AI·머신러닝 실험실
          </span>
          <span className="truncate text-sm font-extrabold text-white">
            {caption?.trim() || algMeta.label}
          </span>
          <span className="hidden sm:inline-block rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-violet-200">
            {algMeta.category}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`rounded-lg px-3 py-1 text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-violet-500 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🧠 인터랙티브 모델 실험실
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
              🐍 연동된 Python 코드 실행
            </button>
          </div>

          <button
            type="button"
            onClick={handleAskQuestionWithAiState}
            className="rounded-xl border border-violet-400/50 bg-violet-500/20 px-3 py-1.5 text-xs font-extrabold text-violet-200 hover:bg-violet-500 hover:text-white transition cursor-pointer"
          >
            🙋 이 모델 상태로 질문하기
          </button>
        </div>
      </div>

      {/* 알고리즘 전환 탭 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(ML_ALGORITHM_META) as MlAlgorithmType[]).map((alg) => {
            const m = ML_ALGORITHM_META[alg];
            const isSelected = config.algorithm === alg;
            return (
              <button
                key={alg}
                type="button"
                onClick={() => updateConfig({ algorithm: alg })}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  isSelected
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {m.shortLabel}
              </button>
            );
          })}
        </div>
        <span className="text-[11px] text-slate-400">
          {algMeta.description}
        </span>
      </div>

      {/* 미션 프롬프트 */}
      {config.missionPrompt && (
        <div className="border-b border-violet-900/60 bg-violet-950/30 px-4 py-2.5 text-xs text-violet-100 flex items-start gap-2">
          <span className="font-extrabold text-violet-300 shrink-0">
            🎯 AI 실험 미션:
          </span>
          <span className="leading-relaxed">{config.missionPrompt}</span>
        </div>
      )}

      {activeTab === 'python' ? (
        <div className="p-4 bg-slate-950 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-2 text-xs text-emerald-200">
            <span>
              💡 실험실에서 조작한 <strong>{algMeta.shortLabel} 하이퍼파라미터</strong>가 아래 파이썬 코드에 실시간 반영되었습니다!
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              ← 시각적 모델 실험실로 돌아가기
            </button>
          </div>
          <ColabRunnerBlock
            code={generatedPythonCode}
            caption={`${algMeta.label} - Python 실습`}
          />
        </div>
      ) : (
        <div className="p-4">
          {/* 1) 선형 회귀 & 경사하강법 뷰 */}
          {config.algorithm === 'linear_regression' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 좌측 그래프 (7열) */}
              <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-sky-300">
                    📈 공부시간(X) vs 성적(Y) 선형 회귀 모델 & 잔차(오차) 시각화
                  </span>
                  <span className="rounded-full bg-rose-500/20 border border-rose-400/40 px-2.5 py-0.5 font-mono text-xs font-extrabold text-rose-300">
                    MSE 손실 = {regressionStats.mse.toFixed(2)}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-2">
                  <svg viewBox="0 0 500 260" className="w-full h-auto">
                    {/* 격자 */}
                    {[40, 60, 80, 100].map((score) => {
                      const gy = 220 - ((score - 40) / 65) * 185;
                      return (
                        <g key={score}>
                          <line
                            x1={50}
                            y1={gy}
                            x2={470}
                            y2={gy}
                            stroke="#1e293b"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={42}
                            y={gy + 4}
                            textAnchor="end"
                            fontSize="9"
                            fill="#94a3b8"
                          >
                            {score}점
                          </text>
                        </g>
                      );
                    })}
                    {[1, 3, 5, 7, 9].map((hr) => {
                      const gx = 50 + (hr / 10) * 420;
                      return (
                        <g key={hr}>
                          <line
                            x1={gx}
                            y1={30}
                            x2={gx}
                            y2={220}
                            stroke="#1e293b"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={gx}
                            y={236}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#94a3b8"
                          >
                            {hr}시간
                          </text>
                        </g>
                      );
                    })}

                    {/* 현재 회귀 직선 y = wx + b */}
                    {(() => {
                      const yAt0 = config.interceptB;
                      const yAt10 = config.slopeW * 10 + config.interceptB;
                      const mapY = (v: number) =>
                        Math.max(20, Math.min(225, 220 - ((v - 40) / 65) * 185));
                      return (
                        <line
                          x1={50}
                          y1={mapY(yAt0)}
                          x2={470}
                          y2={mapY(yAt10)}
                          stroke="#f43f5e"
                          strokeWidth={2.5}
                        />
                      );
                    })()}

                    {/* 데이터 점 및 잔차(Residual) 점선 */}
                    {regressionStats.residuals.map((pt, i) => {
                      const cx = 50 + (pt.x / 10) * 420;
                      const cyActual = 220 - ((pt.y - 40) / 65) * 185;
                      const cyPred = Math.max(
                        20,
                        Math.min(225, 220 - ((pt.yPred - 40) / 65) * 185)
                      );
                      return (
                        <g key={i}>
                          <line
                            x1={cx}
                            y1={cyActual}
                            x2={cx}
                            y2={cyPred}
                            stroke="#fbbf24"
                            strokeWidth={1.5}
                            strokeDasharray="3 2"
                          />
                          <circle
                            cx={cx}
                            cy={cyActual}
                            r={5}
                            fill="#38bdf8"
                            stroke="#0f172a"
                            strokeWidth={1.5}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* 우측 하이퍼파라미터 & 경사하강법 컨트롤 (5열) */}
              <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="text-xs font-extrabold text-violet-300">
                    🎛️ 회귀 모델 파라미터 (y = wx + b)
                  </div>

                  <label className="block rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-300">가중치 (기울기 w)</span>
                      <span className="font-mono text-rose-400">
                        {config.slopeW.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.1}
                      value={config.slopeW}
                      onChange={(e) =>
                        updateConfig({ slopeW: Number(e.target.value) })
                      }
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                  </label>

                  <label className="block rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-300">바이어스 (절편 b)</span>
                      <span className="font-mono text-amber-400">
                        {config.interceptB.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={75}
                      step={0.5}
                      value={config.interceptB}
                      onChange={(e) =>
                        updateConfig({ interceptB: Number(e.target.value) })
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </label>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-300">
                        ⚡ 경사하강법 (Gradient Descent) 자동 학습
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                         누적 {gdEpoch} 에포크
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleGradientDescentStep(1)}
                        className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-violet-500 transition cursor-pointer"
                      >
                        ⚡ 1스텝 경사하강
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGradientDescentStep(25)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-500 transition cursor-pointer"
                      >
                        🚀 최적해 자동 수렴
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setGdEpoch(0);
                        updateConfig({ slopeW: 2.0, interceptB: 40 });
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      ↺ 미학습 초기 상태로 리셋 (w=2.0, b=40)
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3 text-[11px] text-slate-300 space-y-1">
                  <div className="font-extrabold text-violet-300">
                    💡 핵심 개념 포인트
                  </div>
                  <div>
                    노란 점선은 실제 성적과 모델 예측값의 차이인{' '}
                    <strong className="text-amber-300">잔차(Residual)</strong>
                    입니다. 경사하강법은 기울기 미분값(
                    <code className="text-rose-300">
                      ∂Loss/∂w = {regressionStats.gradW.toFixed(1)}
                    </code>
                    )의 반대 방향으로 가중치를 조금씩 업데이트합니다.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2) k-NN 최근접 이웃 분류 뷰 */}
          {config.algorithm === 'knn' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 좌측 인터랙티브 2D 캔버스 (7열) */}
              <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-extrabold text-amber-300">
                    🎯 2차원 특성 평면 (마우스로 원하는 위치를 클릭해 테스트 데이터 ★를 이동하세요!)
                  </span>
                  <span className="rounded-full bg-violet-500/20 border border-violet-400/40 px-2.5 py-0.5 font-extrabold text-violet-200">
                    K = {config.kNeighbors} 다수결 판정:{' '}
                    {knnResult.predictedClass === 1
                      ? '🍎 과일류 (Class 1)'
                      : '🥒 채소류 (Class 0)'}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-2">
                  <svg
                    ref={knnSvgRef}
                    viewBox="0 0 500 270"
                    onClick={(e) => {
                      if (!knnSvgRef.current) return;
                      const rect = knnSvgRef.current.getBoundingClientRect();
                      const svgX =
                        ((e.clientX - rect.left) / rect.width) * 500;
                      const svgY =
                        ((e.clientY - rect.top) / rect.height) * 270;
                      const dataX = Math.max(
                        1,
                        Math.min(9, ((svgX - 50) / 420) * 9)
                      );
                      const dataY = Math.max(
                        1,
                        Math.min(9, ((230 - svgY) / 200) * 9)
                      );
                      updateConfig({
                        testPoint: {
                          x: Number(dataX.toFixed(1)),
                          y: Number(dataY.toFixed(1)),
                        },
                      });
                    }}
                    className="w-full h-auto cursor-crosshair select-none"
                  >
                    {/* 배경 결정 경계 히트맵 그리드 */}
                    {Array.from({ length: 16 }, (_, gxIdx) =>
                      Array.from({ length: 10 }, (__, gyIdx) => {
                        const gxVal = 0.5 + gxIdx * 0.56;
                        const gyVal = 0.8 + gyIdx * 0.85;
                        const dists = CLASSIFICATION_DATA.map((pt) => ({
                          cls: pt.cls,
                          d:
                            config.distanceMetric === 'manhattan'
                              ? Math.abs(pt.x - gxVal) + Math.abs(pt.y - gyVal)
                              : Math.hypot(pt.x - gxVal, pt.y - gyVal),
                        })).sort((a, b) => a.d - b.d);
                        const topK = dists.slice(0, config.kNeighbors);
                        const v1 = topK.filter((t) => t.cls === 1).length;
                        const isFruit = v1 > config.kNeighbors / 2;
                        return (
                          <rect
                            key={`${gxIdx}-${gyIdx}`}
                            x={50 + (gxIdx / 16) * 420}
                            y={30 + ((9 - gyIdx) / 10) * 200}
                            width={420 / 16 + 1}
                            height={200 / 10 + 1}
                            fill={
                              isFruit
                                ? 'rgba(244, 63, 94, 0.12)'
                                : 'rgba(16, 185, 129, 0.12)'
                            }
                          />
                        );
                      })
                    )}

                    {/* 최근접 K개 이웃 연결선 */}
                    {knnResult.neighbors.map((nb) => {
                      const txSvg = 50 + (config.testPoint.x / 9) * 420;
                      const tySvg = 230 - (config.testPoint.y / 9) * 200;
                      const nxSvg = 50 + (nb.x / 9) * 420;
                      const nySvg = 230 - (nb.y / 9) * 200;
                      return (
                        <line
                          key={nb.id}
                          x1={txSvg}
                          y1={tySvg}
                          x2={nxSvg}
                          y2={nySvg}
                          stroke="#fbbf24"
                          strokeWidth={2}
                          strokeDasharray="4 3"
                        />
                      );
                    })}

                    {/* 학습 데이터 포인트 */}
                    {CLASSIFICATION_DATA.map((pt) => {
                      const cx = 50 + (pt.x / 9) * 420;
                      const cy = 230 - (pt.y / 9) * 200;
                      const isNeighbor = knnResult.neighbors.some(
                        (n) => n.id === pt.id
                      );
                      return (
                        <g key={pt.id}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isNeighbor ? 7 : 5.5}
                            fill={pt.cls === 1 ? '#f43f5e' : '#10b981'}
                            stroke={isNeighbor ? '#fde047' : '#0f172a'}
                            strokeWidth={isNeighbor ? 2.5 : 1.5}
                          />
                        </g>
                      );
                    })}

                    {/* 테스트 포인트 (★) */}
                    {(() => {
                      const txSvg = 50 + (config.testPoint.x / 9) * 420;
                      const tySvg = 230 - (config.testPoint.y / 9) * 200;
                      return (
                        <g>
                          <circle
                            cx={txSvg}
                            cy={tySvg}
                            r={9}
                            fill={
                              knnResult.predictedClass === 1
                                ? '#f43f5e'
                                : '#10b981'
                            }
                            stroke="#ffffff"
                            strokeWidth={2.5}
                          />
                          <text
                            x={txSvg}
                            y={tySvg + 4}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="bold"
                            fill="#ffffff"
                          >
                            ★
                          </text>
                        </g>
                      );
                    })()}

                    <text
                      x={260}
                      y={258}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#94a3b8"
                    >
                      X1 특성: 당도 (1~9) | Y1 특성: 아삭함 (1~9)
                    </text>
                  </svg>
                </div>
              </div>

              {/* 우측 k-NN 하이퍼파라미터 컨트롤 (5열) */}
              <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="text-xs font-extrabold text-violet-300">
                    🎛️ k-NN 하이퍼파라미터 조작
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-300">
                        탐색할 최근접 이웃 수 (K)
                      </span>
                      <span className="font-mono text-amber-400">
                        K = {config.kNeighbors}개
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 3, 5, 7, 9].map((kVal) => (
                        <button
                          key={kVal}
                          type="button"
                          onClick={() => updateConfig({ kNeighbors: kVal })}
                          className={`rounded-lg py-1.5 text-xs font-extrabold transition cursor-pointer ${
                            config.kNeighbors === kVal
                              ? 'bg-amber-400 text-slate-950'
                              : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          K={kVal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-300">
                      📏 거리 측정 공식 (Distance Metric)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({ distanceMetric: 'euclidean' })
                        }
                        className={`rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                          config.distanceMetric === 'euclidean'
                            ? 'bg-violet-600 text-white'
                            : 'border border-slate-800 bg-slate-900 text-slate-400'
                        }`}
                      >
                        유클리드 직선거리
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({ distanceMetric: 'manhattan' })
                        }
                        className={`rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                          config.distanceMetric === 'manhattan'
                            ? 'bg-violet-600 text-white'
                            : 'border border-slate-800 bg-slate-900 text-slate-400'
                        }`}
                      >
                        맨해튼 격자거리
                      </button>
                    </div>
                  </div>

                  {/* 다수결 투표 결과 카드 */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-200">
                      🗳️ 최근접 {config.kNeighbors}개 이웃 다수결 투표 현황
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/40 p-2 text-center">
                        <div className="text-emerald-300 font-bold">
                          🥒 채소류 (Class 0)
                        </div>
                        <div className="font-mono text-base font-extrabold text-white mt-0.5">
                          {knnResult.votes0}표
                        </div>
                      </div>
                      <div className="rounded-lg bg-rose-950/40 border border-rose-500/40 p-2 text-center">
                        <div className="text-rose-300 font-bold">
                          🍎 과일류 (Class 1)
                        </div>
                        <div className="font-mono text-base font-extrabold text-white mt-0.5">
                          {knnResult.votes1}표
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-100">
                  <strong>💡 왜 K는 주로 홀수로 설정할까요?</strong> 이진 분류에서
                  짝수 K를 쓰면 동표(Tie)가 나올 수 있기 때문입니다. 또한{' '}
                  <strong>K=1</strong>일 때는 노이즈 데이터 1개에 민감하게 반응하는{' '}
                  <strong>과적합(Overfitting)</strong>이 발생하기 쉽습니다.
                </div>
              </div>
            </div>
          )}

          {/* 3) 결정 트리 뷰 */}
          {config.algorithm === 'decision_tree' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 좌측: 2D 분할 경계 + 트리 다이어그램 (7열) */}
              <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-emerald-300">
                    🌳 결정 트리 특성 공간 분할 & 노드 구조도 (깊이 = {config.maxDepth})
                  </span>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 font-mono text-xs font-extrabold text-emerald-300">
                    학습 정확도 = {treeResult.accuracy.toFixed(1)}%
                  </span>
                </div>

                {/* 결정 트리 다이어그램 */}
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <svg viewBox="0 0 500 220" className="w-full h-auto">
                    {/* 루트 노드 */}
                    <line
                      x1={250}
                      y1={52}
                      x2={135}
                      y2={105}
                      stroke="#64748b"
                      strokeWidth={2}
                    />
                    <line
                      x1={250}
                      y1={52}
                      x2={365}
                      y2={105}
                      stroke="#64748b"
                      strokeWidth={2}
                    />
                    <rect
                      x={160}
                      y={10}
                      width={180}
                      height={44}
                      rx={8}
                      fill="#1e1b4b"
                      stroke="#818cf8"
                      strokeWidth={1.8}
                    />
                    <text
                      x={250}
                      y={27}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#e0e7ff"
                    >
                      [Root] 당도(X1) &gt;= 5.2 인가?
                    </text>
                    <text
                      x={250}
                      y={44}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#a5b4fc"
                    >
                      {config.splitCriterion}: {treeResult.rootImpurity.toFixed(3)} | 샘플 [채소 8, 과일 8]
                    </text>

                    {/* 왼쪽 자식 (당도 < 5.2) */}
                    <rect
                      x={45}
                      y={105}
                      width={180}
                      height={46}
                      rx={8}
                      fill="#064e3b"
                      stroke="#34d399"
                      strokeWidth={1.5}
                    />
                    <text
                      x={135}
                      y={123}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="bold"
                      fill="#d1fae5"
                    >
                      {config.maxDepth >= 2
                        ? '아삭함(X2) >= 5.0 & 당도 >= 4.5?'
                        : '판정: 🥒 채소류 (Class 0)'}
                    </text>
                    <text
                      x={135}
                      y={140}
                      textAnchor="middle"
                      fontSize="8.5"
                      fill="#6ee7b7"
                    >
                      {config.splitCriterion}: {treeResult.left1Impurity.toFixed(3)} | 샘플 [7, 1]
                    </text>

                    {/* 오른쪽 자식 (당도 >= 5.2) */}
                    <rect
                      x={275}
                      y={105}
                      width={180}
                      height={46}
                      rx={8}
                      fill="#4c0519"
                      stroke="#fb7185"
                      strokeWidth={1.5}
                    />
                    <text
                      x={365}
                      y={123}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="bold"
                      fill="#ffe4e6"
                    >
                      {config.maxDepth >= 2
                        ? '당도 < 5.8 & 아삭함 >= 6.4?'
                        : '판정: 🍎 과일류 (Class 1)'}
                    </text>
                    <text
                      x={365}
                      y={140}
                      textAnchor="middle"
                      fontSize="8.5"
                      fill="#fda4af"
                    >
                      {config.splitCriterion}: {treeResult.right1Impurity.toFixed(3)} | 샘플 [1, 7]
                    </text>

                    {/* 깊이 2 이상일 때 리프 노드 표시 */}
                    {config.maxDepth >= 2 && (
                      <g>
                        <line
                          x1={135}
                          y1={151}
                          x2={85}
                          y2={178}
                          stroke="#475569"
                        />
                        <line
                          x1={135}
                          y1={151}
                          x2={185}
                          y2={178}
                          stroke="#475569"
                        />
                        <rect
                          x={35}
                          y={178}
                          width={100}
                          height={32}
                          rx={6}
                          fill="#0f172a"
                          stroke="#10b981"
                        />
                        <text
                          x={85}
                          y={198}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="bold"
                          fill="#6ee7b7"
                        >
                          🥒 채소류 (7, 0)
                        </text>
                        <rect
                          x={145}
                          y={178}
                          width={90}
                          height={32}
                          rx={6}
                          fill="#0f172a"
                          stroke="#f43f5e"
                        />
                        <text
                          x={190}
                          y={198}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="bold"
                          fill="#fda4af"
                        >
                          🍎 과일 (0, 1)
                        </text>

                        <line
                          x1={365}
                          y1={151}
                          x2={315}
                          y2={178}
                          stroke="#475569"
                        />
                        <line
                          x1={365}
                          y1={151}
                          x2={415}
                          y2={178}
                          stroke="#475569"
                        />
                        <rect
                          x={265}
                          y={178}
                          width={95}
                          height={32}
                          rx={6}
                          fill="#0f172a"
                          stroke="#10b981"
                        />
                        <text
                          x={312}
                          y={198}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="bold"
                          fill="#6ee7b7"
                        >
                          🥒 채소 (1, 0)
                        </text>
                        <rect
                          x={370}
                          y={178}
                          width={95}
                          height={32}
                          rx={6}
                          fill="#0f172a"
                          stroke="#f43f5e"
                        />
                        <text
                          x={417}
                          y={198}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="bold"
                          fill="#fda4af"
                        >
                          🍎 과일류 (0, 7)
                        </text>
                      </g>
                    )}
                  </svg>
                </div>
              </div>

              {/* 우측 결정 트리 컨트롤 (5열) */}
              <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="text-xs font-extrabold text-emerald-300">
                    🎛️ 결정 트리 하이퍼파라미터
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-300">
                        트리 최대 깊이 (max_depth)
                      </span>
                      <span className="font-mono text-emerald-400">
                        {config.maxDepth}단계
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((dVal) => (
                        <button
                          key={dVal}
                          type="button"
                          onClick={() => updateConfig({ maxDepth: dVal })}
                          className={`rounded-lg py-1.5 text-xs font-extrabold transition cursor-pointer ${
                            config.maxDepth === dVal
                              ? 'bg-emerald-500 text-slate-950'
                              : 'border border-slate-800 bg-slate-900 text-slate-300'
                          }`}
                        >
                          깊이 {dVal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-300">
                      📐 노드 분할 불순도 지표 (Criterion)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateConfig({ splitCriterion: 'gini' })}
                        className={`rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                          config.splitCriterion === 'gini'
                            ? 'bg-violet-600 text-white'
                            : 'border border-slate-800 bg-slate-900 text-slate-400'
                        }`}
                      >
                        지니 불순도 (Gini)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({ splitCriterion: 'entropy' })
                        }
                        className={`rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                          config.splitCriterion === 'entropy'
                            ? 'bg-violet-600 text-white'
                            : 'border border-slate-800 bg-slate-900 text-slate-400'
                        }`}
                      >
                        정보 엔트로피 (Entropy)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-100">
                  <strong>💡 과적합(Overfitting) 주의:</strong> 트리 깊이(
                  <code>max_depth</code>)를 너무 깊게 만들면 훈련 데이터의 예외적인
                  노이즈까지 모두 외워버려 새로운 데이터에 대한 예측력이 오히려
                  떨어질 수 있습니다.
                </div>
              </div>
            </div>
          )}

          {/* 4) k-Means 비지도 군집화 뷰 */}
          {config.algorithm === 'kmeans' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 좌측 군집화 캔버스 (7열) */}
              <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-sky-300">
                    🫧 k-Means 군집화 캔버스 (중심점 ★ 이동 & 군집 배정)
                  </span>
                  <span className="rounded-full bg-sky-500/20 border border-sky-400/40 px-2.5 py-0.5 font-mono text-xs font-extrabold text-sky-200">
                    반복 {kmeansStepCount}회 · 응집 오차(Inertia) ={' '}
                    {kmeansInertia.toFixed(1)}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-2">
                  <svg viewBox="0 0 500 250" className="w-full h-auto">
                    {/* 데이터 포인트와 소속 중심점 연결선 */}
                    {CLUSTERING_DATA.map((pt, idx) => {
                      const cIdx = assignments[idx] ?? 0;
                      const c = centroids[cIdx] || centroids[0];
                      if (!c) return null;
                      const px = 50 + (pt.x / 10) * 410;
                      const py = 220 - (pt.y / 10) * 190;
                      const cx = 50 + (c.x / 10) * 410;
                      const cy = 220 - (c.y / 10) * 190;
                      const color =
                        CLUSTER_COLORS[cIdx % CLUSTER_COLORS.length];
                      return (
                        <g key={idx}>
                          <line
                            x1={px}
                            y1={py}
                            x2={cx}
                            y2={cy}
                            stroke={color}
                            strokeOpacity={0.45}
                            strokeDasharray="3 3"
                          />
                          <circle
                            cx={px}
                            cy={py}
                            r={5.5}
                            fill={color}
                            stroke="#0f172a"
                            strokeWidth={1.5}
                          />
                        </g>
                      );
                    })}

                    {/* 군집 중심점(Centroid) */}
                    {centroids.slice(0, config.kClusters).map((c, idx) => {
                      const cx = 50 + (c.x / 10) * 410;
                      const cy = 220 - (c.y / 10) * 190;
                      const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
                      return (
                        <g key={idx}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={10}
                            fill={color}
                            stroke="#ffffff"
                            strokeWidth={2.5}
                          />
                          <text
                            x={cx}
                            y={cy + 4}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="bold"
                            fill="#0f172a"
                          >
                            ★
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* 우측 k-Means 컨트롤 (5열) */}
              <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="text-xs font-extrabold text-sky-300">
                    🎛️ k-Means 군집화 단계별 실행
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-300">군집 개수 (K)</span>
                      <span className="font-mono text-sky-400">
                        K = {config.kClusters}개 군집
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[2, 3, 4].map((kVal) => (
                        <button
                          key={kVal}
                          type="button"
                          onClick={() => updateConfig({ kClusters: kVal })}
                          className={`rounded-lg py-1.5 text-xs font-extrabold transition cursor-pointer ${
                            config.kClusters === kVal
                              ? 'bg-sky-400 text-slate-950'
                              : 'border border-slate-800 bg-slate-900 text-slate-300'
                          }`}
                        >
                          K = {kVal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <button
                      type="button"
                      onClick={handleKMeansNextStep}
                      className="w-full rounded-lg bg-sky-500 py-2 text-xs font-extrabold text-slate-950 hover:bg-sky-400 transition cursor-pointer"
                    >
                      👣 다음 단계 실행 (중심점 평균 이동 & 재배정)
                    </button>
                    <button
                      type="button"
                      onClick={() => initKMeansCentroids(config.kClusters)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      🎲 중심점(★) 초기 위치로 리셋
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 text-[11px] text-sky-100">
                  <strong>💡 비지도학습(Unsupervised Learning):</strong> 정답
                  레이블 없이 데이터의 유사도(거리)만으로 군집을 찾습니다. 중심점이
                  더 이상 움직이지 않으면 <strong>수렴(Convergence)</strong>이
                  완료됩니다.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
