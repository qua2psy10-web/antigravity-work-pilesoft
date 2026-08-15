import { SoilLayer } from '../types/soil';
import { PileSpecification, FootingDimension } from '../types/pile';
import { BearingCapacityResult } from '../types/calculation';

export type SeismicReductionLevel = 'none' | 'l1' | 'l2';

export interface AllowableCapacity {
  bearing: number;
  pullout: number;
}

/**
 * 杭の軸方向押込み・引抜き支持力および軸方向バネ定数 Kv の算定
 * 道路橋示方書・同解説 IV 下部構造編 第5章 杭基礎 準拠
 */

export function calculateBearingCapacity(
  spec: PileSpecification,
  layers: SoilLayer[],
  footing: FootingDimension,
  seismicReduction: SeismicReductionLevel | boolean = 'none'
): BearingCapacityResult {
  const reductionLevel: SeismicReductionLevel = seismicReduction === true
    ? 'l1'
    : seismicReduction === false
      ? 'none'
      : seismicReduction;
  const D = spec.diameter;
  const L = spec.length;
  if (!Number.isFinite(D) || D <= 0 || !Number.isFinite(L) || L <= 0) {
    throw new Error('杭径と杭長は 0 より大きい有限値で入力してください');
  }
  if (layers.length === 0) {
    throw new Error('地盤層を少なくとも 1 層入力してください');
  }
  const Ap = Math.PI * (D / 2) ** 2; // 杭先端面積 (m²)
  const U = Math.PI * D;             // 杭周長 (m)
  
  // 杭頭深度 (GL-m) から杭先端深度
  const pileHeadDepth = footing.depthGL;
  const pileTipDepth = pileHeadDepth + L;

  // 1. 杭先端地盤の選定と先端極限支持力度 qd の算定 (kN/m²)
  // 杭先端位置にある層を探索
  let tipLayer = layers[layers.length - 1];
  for (const layer of layers) {
    if (pileTipDepth >= layer.depthTop && pileTipDepth <= layer.depthBottom) {
      tipLayer = layer;
      break;
    }
  }

  const tipN = tipLayer.nValue;
  let qd: number;

  // 施工法・杭種に応じた先端極限支持力度 qd (道示IV)
  switch (spec.method) {
    case 'cast_in_place':
      // 場所打ち杭工法
      if (tipLayer.soilType === 'gravel') {
        qd = Math.min(5000, 3000 + 50 * tipN);
      } else if (tipLayer.soilType === 'sand') {
        qd = Math.min(3000, 100 * tipN);
      } else if (tipLayer.soilType === 'rock') {
        qd = 5000;
      } else {
        // 粘性土
        qd = Math.min(1500, 30 * tipN);
      }
      break;

    case 'driven_hammer':
    case 'driven_vibro':
      // 打込み杭工法 (鋼管杭・PHC杭等)
      if (tipLayer.soilType === 'sand' || tipLayer.soilType === 'gravel') {
        qd = Math.min(10000, 250 * tipN);
      } else {
        qd = Math.min(3000, 100 * tipN);
      }
      break;

    case 'pre_boring':
      // プレボーリング杭工法
      if (tipLayer.soilType === 'sand' || tipLayer.soilType === 'gravel') {
        qd = Math.min(6000, 200 * tipN);
      } else {
        qd = Math.min(2500, 80 * tipN);
      }
      break;

    case 'inner_excavation':
      // 中掘り杭工法
      if (tipLayer.soilType === 'sand' || tipLayer.soilType === 'gravel') {
        qd = Math.min(7500, 200 * tipN);
      } else {
        qd = Math.min(2500, 80 * tipN);
      }
      break;

    case 'rotary':
      // 回転杭工法
      qd = Math.min(6000, 200 * tipN);
      break;

    default:
      qd = Math.min(3000, 100 * tipN);
      break;
  }

  // 杭先端極限支持力 Qp
  // 摩擦杭は先端支持力を押込み抵抗に算入しない。
  const qp = spec.bearingType === 'friction' ? 0 : qd * Ap;

  // 2. 周面摩擦力 Qs の算定
  let qs = 0;
  for (const layer of layers) {
    // 杭と土層の重複区間 (m)
    const overlapTop = Math.max(pileHeadDepth, layer.depthTop);
    const overlapBottom = Math.min(pileTipDepth, layer.depthBottom);
    const li = Math.max(0, overlapBottom - overlapTop);

    if (li <= 0) continue;

    // 地震時液状化低減係数 De
    const de = reductionLevel === 'none'
      ? 1.0
      : reductionLevel === 'l2'
        ? (layer.deLevel2 ?? 1.0)
        : (layer.deLevel1 ?? 1.0);

    // 最大周面摩擦力度 fi (kN/m²)
    let fi: number;
    if (layer.soilType === 'sand') {
      if (spec.method === 'cast_in_place') {
        fi = Math.min(150, 5 * layer.nValue);
      } else if (spec.method === 'pre_boring') {
        fi = Math.min(100, 5 * layer.nValue);
      } else {
        fi = Math.min(200, 10 * layer.nValue);
      }
    } else if (layer.soilType === 'clay') {
      if (spec.method === 'cast_in_place') {
        fi = Math.min(100, 10 * layer.nValue);
      } else {
        fi = Math.min(150, 10 * layer.nValue);
      }
    } else if (layer.soilType === 'gravel') {
      fi = Math.min(200, 10 * layer.nValue);
    } else {
      // 岩盤
      fi = 150;
    }

    qs += U * (fi * de) * li;
  }

  // 押込み極限支持力 Ru
  const ru = qp + qs;

  // 杭自重 Wp (kN)
  const steelPileTypes = new Set(['steel_pipe', 'steel_soil_cement', 'h_beam', 'rotary_steel']);
  const isSteelPile = steelPileTypes.has(spec.pileType);
  const unitWeightPile = isSteelPile ? 78.5 : 24.5; // kN/m³
  // 先端面積 Ap は支持力用、断面積 A は杭自重用。鋼管杭を中実円柱として扱わない。
  const pileWeightArea = isSteelPile ? spec.crossSectionAreaA : Ap;
  const pileWeightWp = pileWeightArea * L * unitWeightPile;

  // 許容押込み力 Ra。H24道示IVでは支持杭=3/2、摩擦杭=4/3（常時/暴風・L1）。
  const raNormal = ru / (spec.bearingType === 'friction' ? 4.0 : 3.0);
  const raSeismic = ru / (spec.bearingType === 'friction' ? 3.0 : 2.0);

  // H24道示IV 12.4.2: Pa = Pu / n + W。W は安全率で除さない。
  const rpaNormal = qs / 6.0 + pileWeightWp;
  const rpaSeismic = qs / 3.0 + pileWeightWp;

  // 3. 軸方向地盤反力係数 Kv (kN/m)
  // Kv = a * (Ap * Ep / L) (道示IV 5.4.3)
  // 場所打ち杭: a = 0.022 * (L / D) + 0.58
  // 既製杭: a = 0.014 * (L / D) + 0.72
  let a_coeff = 0.022 * (L / D) + 0.58;
  if (spec.pileType !== 'cast_in_place_rc') {
    a_coeff = 0.014 * (L / D) + 0.72;
  }
  a_coeff = Math.max(0.5, Math.min(2.0, a_coeff));

  const Ep = spec.modulusE; // kN/m²
  const kv = a_coeff * ((Ap * Ep) / L);

  return {
    pileSpecId: spec.id,
    qd: parseFloat(qd.toFixed(1)),
    ap: parseFloat(Ap.toFixed(4)),
    qp: parseFloat(qp.toFixed(1)),
    qs: parseFloat(qs.toFixed(1)),
    ru: parseFloat(ru.toFixed(1)),
    raNormal: parseFloat(raNormal.toFixed(1)),
    raSeismic: parseFloat(raSeismic.toFixed(1)),
    rpaNormal: parseFloat(rpaNormal.toFixed(1)),
    rpaSeismic: parseFloat(rpaSeismic.toFixed(1)),
    kv: parseFloat(kv.toFixed(1)),
    pileWeightWp: parseFloat(pileWeightWp.toFixed(1)),
  };
}

/**
 * 荷重ケースに設定した安全率による許容抵抗力。
 * 引抜きは H24道示IV 12.4.2 に従い、周面摩擦のみを安全率で除して杭自重を加算する。
 */
export function calculateAllowableCapacity(
  capacity: BearingCapacityResult,
  bearingSafetyFactor: number,
  pulloutSafetyFactor: number
): AllowableCapacity {
  if (!Number.isFinite(bearingSafetyFactor) || bearingSafetyFactor <= 0) {
    throw new Error('支持力安全率は 0 より大きい有限値で入力してください');
  }
  if (!Number.isFinite(pulloutSafetyFactor) || pulloutSafetyFactor <= 0) {
    throw new Error('引抜き安全率は 0 より大きい有限値で入力してください');
  }

  return {
    bearing: parseFloat((capacity.ru / bearingSafetyFactor).toFixed(1)),
    pullout: parseFloat((capacity.qs / pulloutSafetyFactor + capacity.pileWeightWp).toFixed(1)),
  };
}
