import {
  MomentCurvatureCheckResult,
  MomentCurvaturePoint,
  MomentCurvatureState,
  PileDepthStressPoint,
  PileHeadReaction,
} from '../types/calculation';
import { FootingDimension, PileSpecification } from '../types/pile';
import { calculatePileDepthProfile } from './pileStress';

export interface MomentCurvatureEnvelope {
  modelType: 'trilinear' | 'bilinear';
  initialEI: number;
  points: MomentCurvaturePoint[];
  notes: string[];
}

export interface NonlinearPileSectionResult {
  profile: PileDepthStressPoint[];
  maxMoment: number;
  maxMomentDepth: number;
  maxShear: number;
  check: MomentCurvatureCheckResult;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number, digits: number) =>
  Number(value.toFixed(digits));

const steelYieldFromRebarType = (rebarType?: string) => {
  if (rebarType === 'SD490') return 490;
  if (rebarType === 'SD390') return 390;
  return 345;
};

const makePoint = (
  label: MomentCurvaturePoint['label'],
  moment: number,
  curvature: number,
): MomentCurvaturePoint => ({
  label,
  moment: round(moment, 1),
  curvature: round(curvature, 7),
  secantEI: curvature > 0 ? round(moment / curvature, 0) : 0,
});

function buildRcEnvelope(spec: PileSpecification, axialForce: number): MomentCurvatureEnvelope {
  const D = spec.diameter;
  const A = spec.crossSectionAreaA;
  const I = spec.momentOfInertiaI;
  const initialEI = spec.modulusE * I;
  const fck = spec.concreteStrengthFck ?? 24;
  const fy = steelYieldFromRebarType(spec.rebarType);
  const rebarDiameter = (spec.rebarDiameter ?? 29) / 1000;
  const rebarCount = spec.rebarCount ?? Math.max(8, Math.round((0.01 * A) / (Math.PI * rebarDiameter ** 2 / 4)));
  const rebarArea = rebarCount * Math.PI * rebarDiameter ** 2 / 4;
  const cover = clamp((spec.rebarCover ?? D * 100) / 1000, 0.04, D * 0.3);
  const effectiveCoreDepth = Math.max(D * 0.35, D - 2 * cover);
  const Z = I / (D / 2);
  const compressionN = Math.max(0, axialForce);
  const axialStress = compressionN / A;
  const axialRatio = clamp(compressionN / (fck * 1000 * A), 0, 0.55);
  const reinforcementRatio = rebarArea / A;

  // H24計算例のC-Y-U骨格に合わせた断面略算。各点は断面・配筋・死荷重時軸力から生成する。
  const concreteTensileStrength = 0.23 * Math.pow(fck, 2 / 3); // N/mm²
  let crackingMoment = (concreteTensileStrength * 1000 + axialStress) * Z;
  const steelContribution = 0.5 * rebarArea * fy * 1000 * 0.8 * effectiveCoreDepth;
  const axialContribution = 0.2 * compressionN * D;
  let yieldMoment = steelContribution + axialContribution;
  yieldMoment = Math.max(yieldMoment, crackingMoment * 1.25);
  crackingMoment = Math.min(crackingMoment, yieldMoment * 0.8);

  const postCrackingRatio = clamp(0.18 + 1.2 * reinforcementRatio, 0.18, 0.32);
  const crackingCurvature = crackingMoment / initialEI;
  const yieldCurvature = crackingCurvature +
    (yieldMoment - crackingMoment) / (initialEI * postCrackingRatio);
  const ultimateMomentRatio = clamp(1.55 - 2.0 * axialRatio, 1.08, 1.55);
  const ultimateMoment = yieldMoment * ultimateMomentRatio;
  const ultimateCurvatureByStrain = 0.004 / (D * (0.1 + 0.5 * axialRatio));
  const ultimateCurvature = Math.max(yieldCurvature * 1.5, ultimateCurvatureByStrain);

  return {
    modelType: 'trilinear',
    initialEI,
    points: [
      makePoint('O', 0, 0),
      makePoint('C', crackingMoment, crackingCurvature),
      makePoint('Y', yieldMoment, yieldCurvature),
      makePoint('U', ultimateMoment, ultimateCurvature),
    ],
    notes: [
      'RC系杭はO-C-Y-Uのトリリニア骨格を使用',
      `主鉄筋 ${spec.rebarType ?? 'SD345'} D${spec.rebarDiameter ?? 29}-${rebarCount}本、かぶり${Math.round(cover * 1000)}mm`,
      'C-Y-Uは入力断面・材料・死荷重時軸力から生成した簡易断面モデル',
    ],
  };
}

function buildSteelEnvelope(spec: PileSpecification, axialForce: number): MomentCurvatureEnvelope {
  const D = spec.diameter;
  const t = (spec.wallThickness ?? Math.max(9, D * 15)) / 1000;
  const corrosion = clamp((spec.corrosionAllowance ?? 0) / 1000, 0, Math.max(0, t - 0.001));
  const effectiveOuterDiameter = Math.max(D * 0.5, D - 2 * corrosion);
  const innerDiameter = Math.max(0, D - 2 * t);
  const effectiveArea = Math.PI * (effectiveOuterDiameter ** 2 - innerDiameter ** 2) / 4;
  const effectiveI = Math.PI * (effectiveOuterDiameter ** 4 - innerDiameter ** 4) / 64;
  const elasticZ = effectiveI / (effectiveOuterDiameter / 2);
  const plasticZ = (effectiveOuterDiameter ** 3 - innerDiameter ** 3) / 6;
  const initialEI = spec.modulusE * spec.momentOfInertiaI;
  const fy = spec.steelYieldStrength ?? (spec.allowableCompressiveStress ?? 140) * 1.68;
  const axialRatio = clamp(Math.abs(axialForce) / (fy * 1000 * effectiveArea), 0, 0.95);
  const availableYieldStress = Math.max(fy * 1000 * 0.05, fy * 1000 - Math.abs(axialForce) / effectiveArea);
  const yieldMoment = availableYieldStress * elasticZ;
  const plasticMoment = Math.max(yieldMoment * 1.01, fy * 1000 * plasticZ * (1 - axialRatio ** 2));
  const yieldCurvature = yieldMoment / initialEI;
  const plasticCurvature = plasticMoment / initialEI;

  return {
    modelType: 'bilinear',
    initialEI,
    points: [
      makePoint('O', 0, 0),
      makePoint('Y', yieldMoment, yieldCurvature),
      makePoint('P', plasticMoment, plasticCurvature),
    ],
    notes: [
      '鋼管系杭は全塑性モーメントMpを上限とするバイリニア骨格を使用',
      `鋼材降伏強度 ${round(fy, 0)}N/mm²、腐食後有効外径 ${round(effectiveOuterDiameter * 1000, 1)}mm`,
      'My・Mpには死荷重時軸力と腐食後有効断面を反映',
    ],
  };
}

export function buildMomentCurvatureEnvelope(
  spec: PileSpecification,
  axialForce: number,
): MomentCurvatureEnvelope {
  if (!Number.isFinite(spec.diameter) || spec.diameter <= 0 ||
      !Number.isFinite(spec.modulusE) || spec.modulusE <= 0 ||
      !Number.isFinite(spec.momentOfInertiaI) || spec.momentOfInertiaI <= 0 ||
      !Number.isFinite(spec.crossSectionAreaA) || spec.crossSectionAreaA <= 0) {
    throw new Error('M-φ解析には正しい杭径、断面積、断面二次モーメント、ヤング係数が必要です');
  }

  const isRcFamily = spec.pileType === 'cast_in_place_rc' || spec.pileType === 'phc' || spec.pileType === 'sc';
  return isRcFamily ? buildRcEnvelope(spec, axialForce) : buildSteelEnvelope(spec, axialForce);
}

export function evaluateMomentCurvatureDemand(
  envelope: MomentCurvatureEnvelope,
  demandMoment: number,
): Pick<MomentCurvatureCheckResult, 'demandCurvature' | 'ductilityRatio' | 'effectiveFlexuralRigidity' | 'effectiveStiffnessRatio' | 'state' | 'isWithinUltimate'> {
  const demand = Math.abs(demandMoment);
  const points = envelope.points;
  const yieldPoint = points.find((point) => point.label === 'Y')!;
  const lastPoint = points[points.length - 1];
  let curvature = 0;
  let state: MomentCurvatureState = 'elastic';
  const withinUltimate = demand <= lastPoint.moment;

  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    if (demand <= current.moment) {
      const momentRange = current.moment - previous.moment;
      const ratio = momentRange > 0 ? (demand - previous.moment) / momentRange : 0;
      curvature = previous.curvature + ratio * (current.curvature - previous.curvature);
      if (current.label === 'C') state = 'elastic';
      else if (current.label === 'Y') state = envelope.modelType === 'trilinear' ? 'cracked' : 'elastic';
      else state = 'yielded';
      break;
    }
  }

  if (!withinUltimate) {
    const residualStiffness = envelope.initialEI * 0.01;
    curvature = lastPoint.curvature + (demand - lastPoint.moment) / residualStiffness;
    state = 'ultimate_exceeded';
  }

  const secantEI = demand > 0 && curvature > 0 ? demand / curvature : envelope.initialEI;
  return {
    demandCurvature: round(curvature, 7),
    ductilityRatio: round(yieldPoint.curvature > 0 ? curvature / yieldPoint.curvature : 0, 3),
    effectiveFlexuralRigidity: round(secantEI, 0),
    effectiveStiffnessRatio: round(clamp(secantEI / envelope.initialEI, 0.01, 1), 4),
    state,
    isWithinUltimate: withinUltimate,
  };
}

/**
 * L2時の杭体断面について、M-φ応答点の割線剛性でChang解を反復更新する。
 * 杭基礎全体系の増分変位法ではなく、杭1本ごとの等価割線剛性反復である。
 */
export function analyzeNonlinearPileSection(
  spec: PileSpecification,
  reaction: PileHeadReaction,
  kh: number,
  footing: FootingDimension,
  axialForceForCurve: number,
  maxIterations = 20,
): NonlinearPileSectionResult {
  const envelope = buildMomentCurvatureEnvelope(spec, axialForceForCurve);
  let converged = false;
  let iterations = 0;
  let latestProfile = calculatePileDepthProfile(
    spec,
    reaction,
    Math.pow((kh * spec.diameter) / (4 * envelope.initialEI), 0.25),
    kh,
    footing,
    60,
  );
  let demand = evaluateMomentCurvatureDemand(envelope, latestProfile.maxMoment);
  let stiffnessRatio = clamp(demand.effectiveStiffnessRatio, 0.05, 1);

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    iterations = iteration;
    const effectiveEI = envelope.initialEI * stiffnessRatio;
    const effectiveBeta = Math.pow((kh * spec.diameter) / (4 * effectiveEI), 0.25);
    const effectiveSpec = { ...spec, modulusE: spec.modulusE * stiffnessRatio };
    latestProfile = calculatePileDepthProfile(effectiveSpec, reaction, effectiveBeta, kh, footing, 60);
    demand = evaluateMomentCurvatureDemand(envelope, latestProfile.maxMoment);
    const targetRatio = clamp(demand.effectiveStiffnessRatio, 0.05, 1);

    if (Math.abs(targetRatio - stiffnessRatio) < 0.002) {
      stiffnessRatio = targetRatio;
      converged = true;
      break;
    }
    stiffnessRatio = 0.5 * stiffnessRatio + 0.5 * targetRatio;
  }

  const effectiveBeta = Math.pow(
    (kh * spec.diameter) / (4 * envelope.initialEI * clamp(stiffnessRatio, 0.05, 1)),
    0.25,
  );
  const finalDemand = evaluateMomentCurvatureDemand(envelope, latestProfile.maxMoment);
  const check: MomentCurvatureCheckResult = {
    pileNodeId: reaction.pileNodeId,
    pileSpecId: spec.id,
    modelType: envelope.modelType,
    axialForceForCurve: round(axialForceForCurve, 1),
    points: envelope.points,
    demandMoment: round(Math.abs(latestProfile.maxMoment), 1),
    demandCurvature: finalDemand.demandCurvature,
    ductilityRatio: finalDemand.ductilityRatio,
    effectiveFlexuralRigidity: finalDemand.effectiveFlexuralRigidity,
    effectiveStiffnessRatio: finalDemand.effectiveStiffnessRatio,
    effectiveBeta: round(effectiveBeta, 5),
    state: finalDemand.state,
    iterations,
    converged,
    isWithinUltimate: finalDemand.isWithinUltimate,
    notes: [
      ...envelope.notes,
      'L2断面力は応答点の割線EIを用いた杭単体の反復Chang解で更新',
      converged ? `${iterations}回で割線剛性が収束` : `${maxIterations}回で収束判定に未到達`,
    ],
  };

  return { ...latestProfile, check };
}
