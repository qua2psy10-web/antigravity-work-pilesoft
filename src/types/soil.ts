// 土層および地盤条件の型定義

export type SoilType = 
  | 'sand'      // 砂質土 (S)
  | 'clay'      // 粘性土 (C)
  | 'gravel'    // 礫質土 (G)
  | 'rock';     // 岩盤 (R)

export interface SoilLayer {
  id: string;
  name: string;
  depthTop: number;       // 層上面深度 (m) - GLからの深さ
  depthBottom: number;    // 層下面深度 (m) - GLからの深さ
  thickness: number;     // 層厚 (m)
  soilType: SoilType;
  nValue: number;         // 平均N値
  unitWeight: number;    // 湿潤単位体積重量 γ (kN/m³)
  unitWeightSat: number; // 飽和単位体積重量 γsat (kN/m³)
  cohesion?: number;      // 粘着力 c (kN/m²) - 主に粘性土用 (c = 6N ~ 10N等)
  internalFrictionAngle?: number; // 内部摩擦角 φ (deg) - 主に砂質土用 (φ = 15 + √(15N)等)
  fc?: number;           // 細粒分含有率 Fc (%) - 液状化判定用
  d50?: number;          // 平均粒径 D50 (mm) - 液状化判定用
  isLiquefiable?: boolean; // 液状化対象層か
  deLevel1?: number;     // レベル1低減係数 De (自動算定または手動入力)
  deLevel2?: number;     // レベル2低減係数 De
}

export interface GroundCondition {
  groundWaterLevel: number; // 地下水位 GL-m
  seismicIntensityL1: number; // レベル1 設計水平震度 kh (例: 0.20)
  seismicIntensityL2Type1: number; // レベル2 タイプI 設計水平震度 khgL (例: 0.80)
  seismicIntensityL2Type2: number; // レベル2 タイプII 設計水平震度 khgL (例: 1.60)
  groundType: 'I' | 'II' | 'III'; // 地盤種別（I種：良質、II種：普通、III種：軟弱）
  characteristicPeriodTg?: number; // 地盤の固有周期 Tg (s)
  layers: SoilLayer[];
}
