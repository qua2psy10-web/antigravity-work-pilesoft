import { SoilLayer } from '../types/soil';
import { PileSpecification, FootingDimension } from '../types/pile';
import { BearingCapacityResult } from '../types/calculation';

/**
 * 杭の軸方向押込み・引抜き支持力および軸方向バネ定数 Kv の算定
 * 道路橋示方書・同解説 IV 下部構造編 第5章 杭基礎 準拠
 */

export function calculateBearingCapacity(
  spec: PileSpecification,
  layers: SoilLayer[],
  footing: FootingDimension,
  isSeismic: boolean = false
): BearingCapacityResult {
  const D = spec.diameter;
  const L = spec.length;
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
  let qd = 0;

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
  const qp = qd * Ap;

  // 2. 周面摩擦力 Qs の算定
  let qs = 0;
  for (const layer of layers) {
    // 杭と土層の重複区間 (m)
    const overlapTop = Math.max(pileHeadDepth, layer.depthTop);
    const overlapBottom = Math.min(pileTipDepth, layer.depthBottom);
    const li = Math.max(0, overlapBottom - overlapTop);

    if (li <= 0) continue;

    // 地震時液状化低減係数 De
    const de = isSeismic ? (layer.deLevel1 ?? 1.0) : 1.0;

    // 最大周面摩擦力度 fi (kN/m²)
    let fi = 0;
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
  let unitWeightPile = 24.5; // コンクリート kN/m³
  if (spec.pileType === 'steel_pipe') unitWeightPile = 78.5;
  const pileWeightWp = Ap * L * unitWeightPile;

  // 許容押込み力 Ra (常時 n=3, 地震時 n=2)
  const raNormal = (qp + qs) / 3.0;
  const raSeismic = (qp + qs) / 2.0;

  // 許容引抜き力 Rpa (常時: (1/3)*Wp + (1/6)*Qs, 地震時: Wp + (1/3)*Qs)
  const rpaNormal = (1.0 / 3.0) * pileWeightWp + (1.0 / 6.0) * qs;
  const rpaSeismic = pileWeightWp + (1.0 / 3.0) * qs;

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
