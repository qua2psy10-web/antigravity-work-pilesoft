import { PileSpecification, FootingDimension } from '../types/pile';
import { LoadCase } from '../types/load';
import { PileHeadJointCheckResult } from '../types/calculation';

/**
 * 杭頭結合部 (杭頭処理) の照査
 * 道路橋示方書・同解説 IV 下部構造編 準拠
 */

export function checkPileHeadJoint(
  spec: PileSpecification,
  footing: FootingDimension,
  loadCase: LoadCase,
  pileNodeId: string,
  axialForceP: number,
  shearForceH: number,
  momentM: number
): PileHeadJointCheckResult {
  const stressFactor = loadCase.allowableStressFactor;
  const fckFooting = footing.concreteStrengthFck || 24.0;
  const D = spec.diameter;
  const h = footing.thickness - 0.1; // 有効高さ (m)

  // 1. 押抜きせん断応力度 τp (N/mm²)
  // 円錐面周長 u = π * (D + h)
  const P_max = Math.max(0, axialForceP); // 押込み力 (kN)
  const u_m = Math.PI * (D + h);
  const punchingArea_mm2 = u_m * h * 1e6;
  const tau_p = (P_max * 1000) / punchingArea_mm2;

  // 許容押抜きせん断応力度 (道示IV: 0.9 N/mm² 基準)
  const allowableTauP = 0.90 * stressFactor;

  // 2. コンクリート支圧応力度 σb (N/mm²)
  const Ap_mm2 = (Math.PI * (D / 2) ** 2) * 1e6;
  const sigma_b = (P_max * 1000) / Ap_mm2;
  const allowableSigmaB = 0.3 * fckFooting * stressFactor; // 例: 0.3 * 24 = 7.2 N/mm²

  // 3. 仮想RC断面応力比 (略算)
  const virtualRcStressRatio = Math.min(
    1.5,
    Math.max(
      tau_p / allowableTauP,
      sigma_b / allowableSigmaB,
      Math.abs(momentM) / (0.8 * D * 1000)
    )
  );

  const isPass = tau_p <= allowableTauP && sigma_b <= allowableSigmaB;

  return {
    loadCaseId: loadCase.id,
    pileNodeId,
    punchingShearStress: parseFloat(tau_p.toFixed(3)),
    allowablePunchingShear: parseFloat(allowableTauP.toFixed(2)),
    bearingStress: parseFloat(sigma_b.toFixed(2)),
    allowableBearingStress: parseFloat(allowableSigmaB.toFixed(2)),
    virtualRcStressRatio: parseFloat(virtualRcStressRatio.toFixed(2)),
    isPass,
  };
}
