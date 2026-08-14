import { PileSpecification, FootingDimension } from '../types/pile';
import { PileHeadReaction, PileDepthStressPoint } from '../types/calculation';

/**
 * Changの弾性梁理論による杭体深度方向の断面力・変位分布プロファイルの算定
 * 道路橋示方書・同解説 IV 下部構造編 準拠
 */

export function calculatePileDepthProfile(
  spec: PileSpecification,
  reaction: PileHeadReaction,
  beta: number,
  kh: number,
  footing: FootingDimension,
  numPoints: number = 60
): { profile: PileDepthStressPoint[]; maxMoment: number; maxMomentDepth: number; maxShear: number } {
  const EI = spec.modulusE * spec.momentOfInertiaI; // kN·m²
  const D = spec.diameter;
  const L = spec.length;
  const H0 = reaction.shearForceH;      // 杭頭せん断力 (kN)
  const M0 = reaction.bendingMomentM;  // 杭頭曲げモーメント (kN·m)

  const dz = L / (numPoints - 1);
  const profile: PileDepthStressPoint[] = [];

  let maxMomentAbs = 0;
  let maxMomentValue = 0;
  let maxMomentZ = 0;
  let maxShearAbs = 0;
  let maxShearValue = 0;

  for (let i = 0; i < numPoints; i++) {
    const z = i * dz; // 杭頭からの深度 (m)
    const bz = beta * z;
    const expBz = Math.exp(-bz);
    const cosBz = Math.cos(bz);
    const sinBz = Math.sin(bz);

    // Changの式 (半無限長杭の一般解)
    // 変位 y(z) (m)
    const y_m =
      (H0 / (2.0 * EI * Math.pow(beta, 3))) * expBz * cosBz -
      (M0 / (2.0 * EI * Math.pow(beta, 2))) * expBz * (cosBz - sinBz);

    // たわみ角 θ(z) (rad)
    const theta =
      -(H0 / (2.0 * EI * Math.pow(beta, 2))) * expBz * (cosBz + sinBz) +
      (M0 / (EI * beta)) * expBz * cosBz;

    // 曲げモーメント M(z) (kN·m)
    const M =
      -(H0 / beta) * expBz * sinBz +
      M0 * expBz * (cosBz + sinBz);

    // せん断力 S(z) (kN)
    const S =
      H0 * expBz * (cosBz - sinBz) -
      2.0 * M0 * beta * expBz * sinBz;

    // 地盤反力度 p(z) (kN/m)
    const p = kh * D * y_m;

    if (Math.abs(M) > maxMomentAbs) {
      maxMomentAbs = Math.abs(M);
      maxMomentValue = M;
      maxMomentZ = z;
    }

    if (Math.abs(S) > maxShearAbs) {
      maxShearAbs = Math.abs(S);
      maxShearValue = S;
    }

    profile.push({
      depthZ: parseFloat(z.toFixed(2)),
      groundDepthGL: parseFloat((footing.depthGL + z).toFixed(2)),
      deflectionY: parseFloat((y_m * 1000).toFixed(3)), // mm
      rotationTheta: parseFloat(theta.toFixed(6)),
      momentM: parseFloat(M.toFixed(1)),
      shearForceS: parseFloat(S.toFixed(1)),
      soilReactionP: parseFloat(p.toFixed(1)),
    });
  }

  return {
    profile,
    maxMoment: parseFloat(maxMomentValue.toFixed(1)),
    maxMomentDepth: parseFloat(maxMomentZ.toFixed(2)),
    maxShear: parseFloat(maxShearValue.toFixed(1)),
  };
}
