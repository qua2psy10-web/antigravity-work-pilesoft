import {
  LoadDisplacementCurveResult,
  LoadDisplacementPoint,
  MomentCurvatureCheckResult,
  MomentCurvatureState,
} from '../types/calculation';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number, digits: number) => Number(value.toFixed(digits));

const stateRank: Record<MomentCurvatureState, number> = {
  elastic: 0,
  cracked: 1,
  yielded: 2,
  ultimate_exceeded: 3,
};

function responseAtMoment(check: MomentCurvatureCheckResult, moment: number) {
  const demand = Math.abs(moment);
  const points = check.points;
  const initialEI = points.find((point) => point.moment > 0)?.secantEI ?? 1;
  const cracking = points.find((point) => point.label === 'C');
  const yielding = points.find((point) => point.label === 'Y')!;
  const ultimate = points[points.length - 1];
  let curvature = demand / initialEI;
  let state: MomentCurvatureState = 'elastic';

  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    if (demand <= current.moment) {
      const ratio = (demand - previous.moment) / Math.max(1e-9, current.moment - previous.moment);
      curvature = previous.curvature + clamp(ratio, 0, 1) * (current.curvature - previous.curvature);
      break;
    }
  }

  if (demand > ultimate.moment) {
    curvature = ultimate.curvature + (demand - ultimate.moment) / (initialEI * 0.01);
    state = 'ultimate_exceeded';
  } else if (demand >= yielding.moment) {
    state = 'yielded';
  } else if (cracking && demand >= cracking.moment) {
    state = 'cracked';
  }

  const stiffnessRatio = demand > 0
    ? clamp((demand / Math.max(curvature, 1e-12)) / initialEI, 0.01, 1)
    : 1;
  return { stiffnessRatio, state };
}

function curvePoint(
  loadFactor: number,
  checks: MomentCurvatureCheckResult[],
  horizontalLoad: number,
  overturningMoment: number,
  linearDesignDisplacement: number,
): LoadDisplacementPoint {
  const responses = checks.map((check) =>
    responseAtMoment(check, check.demandMoment * loadFactor),
  );
  const equivalentStiffnessRatio = responses.length > 0
    ? responses.length / responses.reduce((sum, response) => sum + 1 / response.stiffnessRatio, 0)
    : 1;
  const state = responses.reduce<MomentCurvatureState>(
    (worst, response) => stateRank[response.state] > stateRank[worst] ? response.state : worst,
    'elastic',
  );
  // Chang型杭の水平ばねはEIの概ね1/4乗に比例するため、割線EI低下から変位を推定する。
  const displacement = loadFactor === 0
    ? 0
    : linearDesignDisplacement * loadFactor / Math.pow(Math.max(0.05, equivalentStiffnessRatio), 0.25);

  return {
    loadFactor: round(loadFactor, 3),
    horizontalLoad: round(Math.abs(horizontalLoad) * loadFactor, 1),
    overturningMoment: round(Math.abs(overturningMoment) * loadFactor, 1),
    displacement: round(displacement, 3),
    equivalentStiffnessRatio: round(equivalentStiffnessRatio, 4),
    state,
  };
}

export function buildLoadDisplacementCurve(
  checks: MomentCurvatureCheckResult[],
  horizontalLoad: number,
  overturningMoment: number,
  linearDesignDisplacement: number,
  maximumLoadFactor = 1.5,
  increments = 15,
): LoadDisplacementCurveResult {
  if (checks.length === 0) {
    throw new Error('荷重-変位曲線の作成にはM-φ照査結果が必要です');
  }

  const points = Array.from({ length: increments + 1 }, (_, index) =>
    curvePoint(index * maximumLoadFactor / increments, checks, horizontalLoad, overturningMoment, linearDesignDisplacement),
  );
  const candidates = checks.map((check) => {
    const yielding = check.points.find((point) => point.label === 'Y')!;
    const ultimate = check.points[check.points.length - 1];
    return {
      check,
      yielding,
      yieldFactor: check.demandMoment > 0 ? yielding.moment / check.demandMoment : Number.POSITIVE_INFINITY,
      ultimateFactor: check.demandMoment > 0 ? ultimate.moment / check.demandMoment : Number.POSITIVE_INFINITY,
    };
  });
  const governingYield = candidates.reduce((current, candidate) =>
    candidate.yieldFactor < current.yieldFactor ? candidate : current,
  );
  const governingUltimate = candidates.reduce((current, candidate) =>
    candidate.ultimateFactor < current.ultimateFactor ? candidate : current,
  );
  const yieldPoint = curvePoint(
    governingYield.yieldFactor,
    checks,
    horizontalLoad,
    overturningMoment,
    linearDesignDisplacement,
  );
  const designPoint = curvePoint(1, checks, horizontalLoad, overturningMoment, linearDesignDisplacement);

  return {
    model: 'equivalent_secant',
    points,
    designDisplacement: designPoint.displacement,
    yieldCheck: {
      governingPileNodeId: governingYield.check.pileNodeId,
      yieldMoment: governingYield.yielding.moment,
      designMoment: governingYield.check.demandMoment,
      yieldLoadFactor: round(governingYield.yieldFactor, 3),
      yieldHorizontalLoad: round(Math.abs(horizontalLoad) * governingYield.yieldFactor, 1),
      yieldDisplacement: yieldPoint.displacement,
      ultimateLoadFactor: round(governingUltimate.ultimateFactor, 3),
      hasYieldedAtDesignLoad: governingYield.yieldFactor <= 1,
      isWithinUltimateAtDesignLoad: governingUltimate.ultimateFactor >= 1,
      state: designPoint.state,
    },
    notes: [
      '水平力・転倒モーメントを同一比率で漸増し、死荷重時軸力のM-φ骨格を使用',
      '杭ごとの割線EIを調和平均し、Chang型水平ばねのEI 1/4乗則で全体系変位を推定',
      '地盤ばね塑性化と各増分での軸力再配分を含む厳密な全体系増分解析ではない',
    ],
  };
}
