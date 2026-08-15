import { SoilLayer } from '../types/soil';

/**
 * 液状化判定 (FL法) および低減係数 De の算定
 * 道路橋示方書・同解説 V 耐震設計編 準拠
 */

export interface LiquefactionResult {
  layerId: string;
  isLiquefied: boolean;
  flValue: number; // 液状化抵抗率 FL
  deLevel1: number; // レベル1地震時低減係数 De
  deLevel2: number; // レベル2地震時低減係数 De
}

/**
 * 各土層の液状化判定とDe値を算定
 */
export function calculateLiquefaction(
  layers: SoilLayer[],
  groundWaterLevel: number,
  seismicIntensityL1: number = 0.2,
  seismicIntensityL2: number = 0.8
): LiquefactionResult[] {
  let accumulatedDepth = 0;
  let totalOverburden = 0;
  let effectiveOverburden = 0;

  return layers.map((layer) => {
    const midDepth = accumulatedDepth + layer.thickness / 2;
    const isBelowWater = midDepth > groundWaterLevel;
    
    // 上載圧の計算 (概算)
    const gamma = isBelowWater ? layer.unitWeightSat : layer.unitWeight;
    const gammaEff = isBelowWater ? layer.unitWeightSat - 9.8 : layer.unitWeight;
    
    totalOverburden += gamma * layer.thickness;
    effectiveOverburden += gammaEff * layer.thickness;
    accumulatedDepth += layer.thickness;

    // 液状化対象層か判定:
    // 1. 地下水位以深
    // 2. 地表面から20m以浅
    // 3. 砂質土(S) または 礫質土(G)
    // 4. 細粒分含有率 Fc <= 35% または 塑性指数 Ip < 15
    const isCandidate = 
      layer.isLiquefiable === true &&
      isBelowWater &&
      midDepth <= 20 &&
      (layer.soilType === 'sand' || layer.soilType === 'gravel');

    if (!isCandidate || layer.nValue >= 30) {
      return {
        layerId: layer.id,
        isLiquefied: false,
        flValue: 99.0,
        deLevel1: 1.0,
        deLevel2: 1.0,
      };
    }

    // 動的せん断強度比 R の簡易算定 (道示V)
    // N1 = 170 * N / (σv' + 70)
    const sigVp = Math.max(20, effectiveOverburden);
    const n1 = Math.min(50, (170 * layer.nValue) / (sigVp + 70));
    
    // 動的せん断強度比 R
    let R = 0.088 * Math.sqrt(n1 / 1.7);
    if (layer.fc && layer.fc > 5) {
      // 細粒分補正
      const deltaR = 0.0035 * layer.fc;
      R += deltaR;
    }
    R = Math.max(0.1, Math.min(0.6, R));

    // 地震時せん断応力比 L
    // L1: L = (kh / g) * (σv / σv') * rd
    const rd = 1.0 - 0.015 * midDepth;
    const l1_stress = seismicIntensityL1 * (totalOverburden / sigVp) * rd;
    const l2_stress = seismicIntensityL2 * (totalOverburden / sigVp) * rd;

    const fl_l1 = Math.max(0.1, R / Math.max(0.05, l1_stress));
    const fl_l2 = Math.max(0.1, R / Math.max(0.05, l2_stress));

    // 低減係数 De (道示V 表-8.3.1)
    const getDe = (fl: number, depth: number): number => {
      if (fl >= 1.0) return 1.0;
      if (depth <= 10) {
        if (fl <= 0.6) return 0.0;
        if (fl <= 0.8) return 1/3;
        return 2/3;
      } else if (depth <= 20) {
        if (fl <= 0.6) return 1/3;
        if (fl <= 0.8) return 2/3;
        return 2/3;
      }
      return 1.0;
    };

    const de1 = layer.deLevel1 ?? getDe(fl_l1, midDepth);
    const de2 = layer.deLevel2 ?? getDe(fl_l2, midDepth);

    return {
      layerId: layer.id,
      isLiquefied: fl_l2 < 1.0,
      flValue: parseFloat(fl_l2.toFixed(2)),
      deLevel1: parseFloat(de1.toFixed(2)),
      deLevel2: parseFloat(de2.toFixed(2)),
    };
  });
}
