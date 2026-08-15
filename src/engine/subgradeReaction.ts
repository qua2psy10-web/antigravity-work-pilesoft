import { SoilLayer } from '../types/soil';
import { PileSpecification, FootingDimension, PileHeadJointType } from '../types/pile';
import { PileHeadSpringMatrix } from '../types/calculation';
import { SeismicReductionLevel } from './bearingCapacity';

/**
 * 水平方向地盤反力係数 kH、杭特性値 β、および杭頭バネマトリックス (K1〜K4) の算定
 * 道路橋示方書・同解説 IV 下部構造編 準拠
 */

export function calculateSubgradeReactionAndSprings(
  spec: PileSpecification,
  layers: SoilLayer[],
  footing: FootingDimension,
  jointType: PileHeadJointType = 'rigid',
  seismicReduction: SeismicReductionLevel | boolean = 'none',
  kvValue?: number
): PileHeadSpringMatrix {
  const reductionLevel: SeismicReductionLevel = seismicReduction === true
    ? 'l1'
    : seismicReduction === false
      ? 'none'
      : seismicReduction;
  const D = spec.diameter;
  const EI = spec.modulusE * spec.momentOfInertiaI; // 杭の曲げ剛性 EI (kN·m²)
  if (!Number.isFinite(D) || D <= 0 || !Number.isFinite(EI) || EI <= 0) {
    throw new Error('杭径、ヤング係数、断面二次モーメントは 0 より大きい有限値で入力してください');
  }
  const pileHeadDepth = footing.depthGL;

  // 地盤の変形係数 E0 (kN/m²) の算定 (道示IV: E0 = 2800 N など)
  // 杭頭から 1/β 程度の範囲の平均 N 値を初期仮定して反復収束計算
  let beta = 0.25; // 初期仮定 β (m⁻¹)
  let kh = 10000;  // 初期仮定 kH (kN/m³)

  const alpha = reductionLevel === 'none' ? 1.0 : 2.0; // 地震時の変形係数割増

  for (let iter = 0; iter < 10; iter++) {
    const depth1Beta = 1.0 / beta;
    const checkTop = pileHeadDepth;
    const checkBottom = pileHeadDepth + depth1Beta;

    // 1/β 範囲の加重平均 E0 を算出
    let totalE0Weighted = 0;
    let totalWeightLength = 0;

    for (const layer of layers) {
      const overlapTop = Math.max(checkTop, layer.depthTop);
      const overlapBottom = Math.min(checkBottom, layer.depthBottom);
      const li = Math.max(0, overlapBottom - overlapTop);

      if (li <= 0) continue;

      const de = reductionLevel === 'none'
        ? 1.0
        : reductionLevel === 'l2'
          ? (layer.deLevel2 ?? 1.0)
          : (layer.deLevel1 ?? 1.0);
      
      // 土質に応じた E0 算定 (道示IV 表-5.4.1)
      let E0 = 2800 * layer.nValue;
      if (layer.soilType === 'clay') {
        E0 = 2800 * layer.nValue; // または 700N など
      } else if (layer.soilType === 'sand') {
        E0 = 2800 * layer.nValue;
      } else if (layer.soilType === 'gravel') {
        E0 = 2800 * layer.nValue;
      }

      totalE0Weighted += (alpha * E0 * de) * li;
      totalWeightLength += li;
    }

    const avgE0 = totalWeightLength > 0 ? totalE0Weighted / totalWeightLength : 2800 * 10;
    
    // 基準水平地盤反力係数 kH0 = (1/0.3) * αE0 (kN/m³)
    const kH0 = (1.0 / 0.3) * avgE0;

    // 換算載荷幅 BH = √(D / β) (m) または BH = D
    const BH = Math.min(D * 3, Math.max(D * 0.8, Math.sqrt(D / beta)));

    // 横方向地盤反力係数 kH = kH0 * (BH / 0.3)^(-3/4)
    kh = kH0 * Math.pow(BH / 0.3, -0.75);

    // 新しい β = 4√(kH * D / (4 * EI))
    const newBeta = Math.pow((kh * D) / (4.0 * EI), 0.25);

    if (Math.abs(newBeta - beta) < 0.0001) {
      beta = newBeta;
      break;
    }
    beta = (beta + newBeta) / 2.0;
  }

  // 杭頭バネ定数 (K1〜K4) の算定 (Changの式)
  let k1: number;
  let k2: number;
  let k3: number;
  let k4: number;

  if (jointType === 'rigid') {
    // 杭頭剛結
    k1 = 4.0 * EI * Math.pow(beta, 3);
    k2 = 2.0 * EI * Math.pow(beta, 2);
    k3 = k2;
    k4 = 2.0 * EI * beta;
  } else if (jointType === 'hinge') {
    // 杭頭ヒンジ結合 (回転自由)
    k1 = 2.0 * EI * Math.pow(beta, 3);
    k2 = 0;
    k3 = 0;
    k4 = 0;
  } else {
    // 弾性結合
    k1 = 3.0 * EI * Math.pow(beta, 3);
    k2 = 1.5 * EI * Math.pow(beta, 2);
    k3 = k2;
    k4 = 1.5 * EI * beta;
  }

  // 軸方向バネ Kv
  const kv = kvValue ?? (0.022 * (spec.length / D) + 0.58) * ((Math.PI * (D / 2) ** 2 * spec.modulusE) / spec.length);

  return {
    k1: parseFloat(k1.toFixed(1)),
    k2: parseFloat(k2.toFixed(1)),
    k3: parseFloat(k3.toFixed(1)),
    k4: parseFloat(k4.toFixed(1)),
    kv: parseFloat(kv.toFixed(1)),
    beta: parseFloat(beta.toFixed(4)),
    kh: parseFloat(kh.toFixed(1)),
  };
}
