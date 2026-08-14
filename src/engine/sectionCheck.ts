import { PileSpecification } from '../types/pile';
import { LoadCase } from '../types/load';
import { SectionStressCheckResult } from '../types/calculation';

/**
 * 杭体の断面応力度照査 (RC杭・鋼管杭)
 * 道路橋示方書・同解説 IV 下部構造編 準拠
 */

export function checkPileSectionStress(
  spec: PileSpecification,
  loadCase: LoadCase,
  pileNodeId: string,
  maxMomentM: number,
  maxMomentDepthZ: number,
  axialForceN: number,
  maxShearForceS: number
): SectionStressCheckResult {
  const stressFactor = loadCase.allowableStressFactor; // 許容応力度割増係数 (常時1.0, 地震時1.50)
  const D = spec.diameter; // m
  const A = spec.crossSectionAreaA; // m²
  const I = spec.momentOfInertiaI;   // m⁴
  const Z = (2.0 * I) / D;           // 断面係数 Z = I / (D/2) (m³)

  const notes: string[] = [];
  let isPass = true;

  if (spec.pileType === 'cast_in_place_rc' || spec.pileType === 'phc' || spec.pileType === 'sc') {
    // === 場所打ちRC杭 / 既製コンクリート杭の照査 ===
    const fck = spec.concreteStrengthFck || 24.0; // N/mm²
    
    // 基本許容応力度 (道示IV)
    const baseSigCa = fck / 3.0; // 例: 24/3 = 8.0 N/mm²
    const baseSigSa = 180.0;     // SD345: 180 N/mm²
    const baseTauA = 0.36;       // コンクリートせん断許容: 0.36 N/mm²

    const allowableSigCa = baseSigCa * stressFactor;
    const allowableSigSa = baseSigSa * stressFactor;
    const allowableTauA = baseTauA * stressFactor;

    // 断面力 (単位変換: kN -> N, m -> mm)
    const N_N = Math.abs(axialForceN) * 1000;
    const M_Nmm = Math.abs(maxMomentM) * 1e6;
    const S_N = Math.abs(maxShearForceS) * 1000;
    const A_mm2 = A * 1e6;
    const Z_mm3 = Z * 1e9;

    // 換算全断面での応力度略算 (道示実務簡便法)
    const sig_c = (N_N / A_mm2) + (M_Nmm / Z_mm3);
    const sig_s = (M_Nmm / (Z_mm3 * 0.8)) - (N_N / A_mm2);
    const tau = (4.0 * S_N) / (3.0 * A_mm2);

    const sigC_val = parseFloat(sig_c.toFixed(2));
    const sigS_val = parseFloat(Math.max(0, sig_s).toFixed(2));
    const tau_val = parseFloat(tau.toFixed(2));

    if (sigC_val > allowableSigCa) {
      isPass = false;
      notes.push(`コンクリート圧縮応力度が許容値を超過 (σc=${sigC_val} > σca=${allowableSigCa.toFixed(1)} N/mm²)`);
    }
    if (sigS_val > allowableSigSa) {
      isPass = false;
      notes.push(`主鉄筋引張応力度が許容値を超過 (σs=${sigS_val} > σsa=${allowableSigSa.toFixed(1)} N/mm²)`);
    }
    if (tau_val > allowableTauA) {
      isPass = false;
      notes.push(`コンクリートせん断応力度が許容値を超過 (τ=${tau_val} > τa=${allowableTauA.toFixed(2)} N/mm²)。帯鉄筋の増強が必要です`);
    }

    if (isPass) {
      notes.push('すべての許容応力度を満足しています (OK)');
    }

    return {
      loadCaseId: loadCase.id,
      loadCaseName: loadCase.name,
      pileNodeId,
      maxMomentM,
      maxMomentDepthZ,
      axialForceN,
      maxShearForceS,
      compressiveStressC: sigC_val,
      allowableCompressiveStressC: parseFloat(allowableSigCa.toFixed(2)),
      tensileStressS: sigS_val,
      allowableTensileStressS: parseFloat(allowableSigSa.toFixed(2)),
      shearStressTau: tau_val,
      allowableShearStressTau: parseFloat(allowableTauA.toFixed(2)),
      isPass,
      notes,
    };
  } else {
    // === 鋼管杭 / H形鋼杭の照査 ===
    const baseSteelSigA = 140.0; // SKK400: 140 N/mm²
    const baseSteelTauA = 80.0;  // 80 N/mm²
    const allowableSteelSigA = baseSteelSigA * stressFactor;
    const allowableSteelTauA = baseSteelTauA * stressFactor;

    const N_N = Math.abs(axialForceN) * 1000;
    const M_Nmm = Math.abs(maxMomentM) * 1e6;
    const S_N = Math.abs(maxShearForceS) * 1000;
    const A_mm2 = A * 1e6;
    const Z_mm3 = Z * 1e9;

    const sigma = (N_N / A_mm2) + (M_Nmm / Z_mm3);
    const tau = (2.0 * S_N) / A_mm2;

    const sig_val = parseFloat(sigma.toFixed(2));
    const tau_val = parseFloat(tau.toFixed(2));

    if (sig_val > allowableSteelSigA) {
      isPass = false;
      notes.push(`鋼材合成応力度が許容値を超過 (σ=${sig_val} > σa=${allowableSteelSigA.toFixed(1)} N/mm²)`);
    }
    if (tau_val > allowableSteelTauA) {
      isPass = false;
      notes.push(`鋼材せん断応力度が許容値を超過 (τ=${tau_val} > τa=${allowableSteelTauA.toFixed(1)} N/mm²)`);
    }

    if (isPass) {
      notes.push('鋼材許容応力度を満足しています (OK)');
    }

    return {
      loadCaseId: loadCase.id,
      loadCaseName: loadCase.name,
      pileNodeId,
      maxMomentM,
      maxMomentDepthZ,
      axialForceN,
      maxShearForceS,
      steelStressSigma: sig_val,
      allowableSteelStressSigma: parseFloat(allowableSteelSigA.toFixed(2)),
      steelShearStressTau: tau_val,
      allowableSteelShearStressTau: parseFloat(allowableSteelTauA.toFixed(2)),
      isPass,
      notes,
    };
  }
}
