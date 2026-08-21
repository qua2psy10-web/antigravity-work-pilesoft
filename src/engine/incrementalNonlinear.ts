import type {
  FootingDisplacement,
  LoadDisplacementCurveResult,
  LoadDisplacementPoint,
  MomentCurvatureCheckResult,
  MomentCurvatureState,
  PileDepthStressPoint,
  PileHeadReaction,
  PileHeadSpringMatrix,
} from '../types/calculation';
import type { LoadCase } from '../types/load';
import type { FootingDimension, PileNode, PileSpecification } from '../types/pile';
import type { GroundCondition, SoilLayer } from '../types/soil';
import {
  buildMomentCurvatureEnvelope,
  evaluateMomentCurvatureDemand,
  type MomentCurvatureEnvelope,
} from './momentCurvature';
import {
  getPileSoilInteractionDiameter,
  resolvePileSectionAtDepth,
} from './pileSection';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number, digits: number) => Number(value.toFixed(digits));

const stateRank: Record<MomentCurvatureState, number> = {
  elastic: 0,
  cracked: 1,
  yielded: 2,
  fully_plastic: 3,
  ultimate_exceeded: 4,
};

interface PileBeamResponse {
  headShear: number;
  headMoment: number;
  profile: PileDepthStressPoint[];
  maxMoment: number;
  maxMomentDepth: number;
  maxShear: number;
  maxSoilYieldRatio: number;
  governingMoment: number;
  governingDepth: number;
  state: MomentCurvatureState;
  yieldRatio: number;
  ultimateRatio: number;
  iterations: number;
  converged: boolean;
  envelope: MomentCurvatureEnvelope;
}

interface IncrementState {
  loadFactor: number;
  displacement: FootingDisplacement;
  reactions: PileHeadReaction[];
  profiles: Record<string, PileDepthStressPoint[]>;
  responses: Record<string, PileBeamResponse>;
  point: LoadDisplacementPoint;
  yieldRatio: number;
  ultimateRatio: number;
  iterations: number;
  converged: boolean;
}

export interface IncrementalPileGroupResult {
  curve: LoadDisplacementCurveResult;
  designDisplacement: FootingDisplacement;
  designReactions: PileHeadReaction[];
  designProfiles: Record<string, PileDepthStressPoint[]>;
  checks: MomentCurvatureCheckResult[];
}

const INCREMENTAL_PILE_TYPES = new Set([
  'cast_in_place_rc',
  'steel_pipe',
  'steel_soil_cement',
]);

export function canRunPileGroupIncrementalAnalysis(
  pileNodes: PileNode[],
  pileSpecs: Record<string, PileSpecification>,
) {
  const active = pileNodes.filter((pile) => !pile.isOmitted);
  return active.length > 0 && active.every((pile) =>
    pile.inclinationAngle === 0 && INCREMENTAL_PILE_TYPES.has(pileSpecs[pile.pileSpecId]?.pileType),
  );
}

/** 既存呼出しとの互換用。 */
export const canRunRcIncrementalAnalysis = canRunPileGroupIncrementalAnalysis;

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < size; pivot++) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < size; row++) {
      if (Math.abs(a[row][pivot]) > Math.abs(a[maxRow][pivot])) maxRow = row;
    }
    if (Math.abs(a[maxRow][pivot]) < 1e-12) {
      throw new Error('非線形杭要素の剛性行列が特異です');
    }
    [a[pivot], a[maxRow]] = [a[maxRow], a[pivot]];
    const divisor = a[pivot][pivot];
    for (let column = pivot; column <= size; column++) a[pivot][column] /= divisor;
    for (let row = 0; row < size; row++) {
      if (row === pivot) continue;
      const factor = a[row][pivot];
      if (Math.abs(factor) < 1e-16) continue;
      for (let column = pivot; column <= size; column++) {
        a[row][column] -= factor * a[pivot][column];
      }
    }
  }
  return a.map((row) => row[size]);
}

function beamElementStiffness(ei: number, length: number) {
  const factor = ei / length ** 3;
  const l2 = length ** 2;
  return [
    [12 * factor, 6 * length * factor, -12 * factor, 6 * length * factor],
    [6 * length * factor, 4 * l2 * factor, -6 * length * factor, 2 * l2 * factor],
    [-12 * factor, -6 * length * factor, 12 * factor, -6 * length * factor],
    [6 * length * factor, 2 * l2 * factor, -6 * length * factor, 4 * l2 * factor],
  ];
}

function multiply(matrix: number[][], vector: number[]) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function soilLayerAt(layers: SoilLayer[], depth: number) {
  return layers.find((layer) => depth >= layer.depthTop && depth <= layer.depthBottom) ??
    layers[layers.length - 1];
}

function effectiveVerticalStress(layers: SoilLayer[], waterLevel: number, depth: number) {
  let stress = 0;
  for (const layer of layers) {
    const top = Math.max(0, layer.depthTop);
    const bottom = Math.min(depth, layer.depthBottom);
    if (bottom <= top) continue;
    const dryBottom = Math.min(bottom, waterLevel);
    if (dryBottom > top) stress += (dryBottom - top) * layer.unitWeight;
    const wetTop = Math.max(top, waterLevel);
    if (bottom > wetTop) stress += (bottom - wetTop) * Math.max(1, layer.unitWeightSat - 9.8);
  }
  return stress;
}

function soilProperties(
  ground: GroundCondition,
  layers: SoilLayer[],
  depth: number,
  diameter: number,
  referenceKh: number,
) {
  const layer = soilLayerAt(layers, depth);
  const nFactor = clamp(Math.sqrt(Math.max(1, layer?.nValue ?? 10) / 10), 0.5, 2);
  const linearKh = referenceKh * nFactor;
  const effectiveStress = effectiveVerticalStress(layers, ground.groundWaterLevel, depth);
  let ultimatePerLength: number;

  if (layer?.soilType === 'clay') {
    const cohesion = Math.max(5, layer.cohesion ?? 6 * Math.max(1, layer.nValue));
    const bearingFactor = clamp(3 + effectiveStress / cohesion, 3, 9);
    ultimatePerLength = bearingFactor * cohesion * diameter;
  } else if (layer?.soilType === 'rock') {
    ultimatePerLength = Math.max(1000 * diameter, 10 * effectiveStress * diameter);
  } else {
    const frictionAngle = layer?.internalFrictionAngle ?? 30;
    const passiveFactor = clamp(2.5 + 0.05 * frictionAngle, 3, 5);
    ultimatePerLength = Math.max(20 * diameter, passiveFactor * effectiveStress * diameter);
  }

  return {
    linearPerLength: linearKh * diameter,
    ultimatePerLength: Math.max(1, ultimatePerLength),
  };
}

function assembleBeamMatrix(
  elementEis: number[],
  elementLength: number,
  soilStiffnesses: number[],
) {
  const nodeCount = elementEis.length + 1;
  const dofCount = nodeCount * 2;
  const matrix = Array.from({ length: dofCount }, () => Array(dofCount).fill(0));

  elementEis.forEach((ei, element) => {
    const stiffness = beamElementStiffness(ei, elementLength);
    const dofs = [2 * element, 2 * element + 1, 2 * element + 2, 2 * element + 3];
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        matrix[dofs[row]][dofs[column]] += stiffness[row][column];
      }
    }
  });
  soilStiffnesses.forEach((stiffness, node) => {
    matrix[2 * node][2 * node] += stiffness;
  });
  return matrix;
}

function solveWithHeadKinematics(
  matrix: number[][],
  headDisplacement: number,
  headRotation: number,
) {
  const dofCount = matrix.length;
  const prescribed = [headDisplacement, headRotation];
  const freeCount = dofCount - 2;
  const freeMatrix = Array.from({ length: freeCount }, (_, row) =>
    Array.from({ length: freeCount }, (_, column) => matrix[row + 2][column + 2]),
  );
  const freeVector = Array.from({ length: freeCount }, (_, row) =>
    -(matrix[row + 2][0] * prescribed[0] + matrix[row + 2][1] * prescribed[1]),
  );
  return [...prescribed, ...solveLinearSystem(freeMatrix, freeVector)];
}

function analyzePileBeam(
  spec: PileSpecification,
  ground: GroundCondition,
  layers: SoilLayer[],
  footing: FootingDimension,
  axialForce: number,
  headDisplacement: number,
  headRotation: number,
  referenceKh: number,
  elementCount = 20,
) : PileBeamResponse {
  const elementLength = spec.length / elementCount;
  const nodeCount = elementCount + 1;
  const soilDiameter = getPileSoilInteractionDiameter(spec);
  const envelopeCache = new Map<string, MomentCurvatureEnvelope>();
  const envelopeAtDepth = (depth: number) => {
    const resolved = resolvePileSectionAtDepth(spec, depth);
    const cacheKey = resolved.segment?.id ?? 'uniform';
    const cached = envelopeCache.get(cacheKey);
    if (cached) return cached;
    const envelope = buildMomentCurvatureEnvelope(spec, axialForce, depth);
    envelopeCache.set(cacheKey, envelope);
    return envelope;
  };
  const elementEnvelopes = Array.from({ length: elementCount }, (_, element) =>
    envelopeAtDepth((element + 0.5) * elementLength),
  );
  const initialEis = elementEnvelopes.map((envelope) => envelope.initialEI);
  let elementEis = [...initialEis];
  let soilStiffnesses = Array.from({ length: nodeCount }, (_, node) => {
    const tributaryLength = node === 0 || node === nodeCount - 1 ? elementLength / 2 : elementLength;
    const depth = footing.depthGL + node * elementLength;
    return soilProperties(ground, layers, depth, soilDiameter, referenceKh).linearPerLength * tributaryLength;
  });
  let displacements = Array(nodeCount * 2).fill(0);
  let converged = false;
  let iterations = 0;

  for (let iteration = 1; iteration <= 18; iteration++) {
    iterations = iteration;
    const previous = displacements;
    const matrix = assembleBeamMatrix(elementEis, elementLength, soilStiffnesses);
    displacements = solveWithHeadKinematics(matrix, headDisplacement, headRotation);

    const targetEis = elementEis.map((_, element) => {
      const stiffness = beamElementStiffness(elementEis[element], elementLength);
      const dofs = [2 * element, 2 * element + 1, 2 * element + 2, 2 * element + 3];
      const forces = multiply(stiffness, dofs.map((dof) => displacements[dof]));
      const moment = Math.max(Math.abs(forces[1]), Math.abs(forces[3]));
      return clamp(
        evaluateMomentCurvatureDemand(elementEnvelopes[element], moment).effectiveFlexuralRigidity,
        initialEis[element] * 0.01,
        initialEis[element],
      );
    });
    const targetSoil = soilStiffnesses.map((_, node) => {
      const tributaryLength = node === 0 || node === nodeCount - 1 ? elementLength / 2 : elementLength;
      const depth = footing.depthGL + node * elementLength;
      const properties = soilProperties(ground, layers, depth, soilDiameter, referenceKh);
      const displacement = Math.abs(displacements[2 * node]);
      const secantPerLength = displacement > 1e-9
        ? Math.min(properties.linearPerLength, properties.ultimatePerLength / displacement)
        : properties.linearPerLength;
      return Math.max(properties.linearPerLength * 0.01, secantPerLength) * tributaryLength;
    });

    const displacementChange = Math.max(...displacements.map((value, index) =>
      Math.abs(value - previous[index]) / Math.max(1e-6, Math.abs(value)),
    ));
    const stiffnessChange = Math.max(...targetEis.map((value, index) =>
      Math.abs(value - elementEis[index]) / initialEis[index],
    ));
    elementEis = elementEis.map((value, index) => 0.45 * value + 0.55 * targetEis[index]);
    soilStiffnesses = soilStiffnesses.map((value, index) => 0.45 * value + 0.55 * targetSoil[index]);

    if (displacementChange < 0.001 && stiffnessChange < 0.001) {
      converged = true;
      break;
    }
  }

  const matrix = assembleBeamMatrix(elementEis, elementLength, soilStiffnesses);
  displacements = solveWithHeadKinematics(matrix, headDisplacement, headRotation);
  const reactions = multiply(matrix, displacements);
  const moments = Array(nodeCount).fill(0);
  const shears = Array(nodeCount).fill(0);
  const momentCounts = Array(nodeCount).fill(0);
  const shearCounts = Array(nodeCount).fill(0);

  elementEis.forEach((ei, element) => {
    const stiffness = beamElementStiffness(ei, elementLength);
    const dofs = [2 * element, 2 * element + 1, 2 * element + 2, 2 * element + 3];
    const forces = multiply(stiffness, dofs.map((dof) => displacements[dof]));
    moments[element] += forces[1];
    moments[element + 1] += -forces[3];
    shears[element] += forces[0];
    shears[element + 1] += -forces[2];
    momentCounts[element]++;
    momentCounts[element + 1]++;
    shearCounts[element]++;
    shearCounts[element + 1]++;
  });

  let maxMoment = 0;
  let maxMomentDepth = 0;
  let maxShear = 0;
  let maxSoilYieldRatio = 0;
  let worstState: MomentCurvatureState = 'elastic';
  let governingMoment = 0;
  let governingDepth = 0;
  let governingYieldRatio = 0;
  let governingUltimateRatio = 0;
  let governingEnvelope = elementEnvelopes[0];

  elementEis.forEach((ei, element) => {
    const stiffness = beamElementStiffness(ei, elementLength);
    const dofs = [2 * element, 2 * element + 1, 2 * element + 2, 2 * element + 3];
    const forces = multiply(stiffness, dofs.map((dof) => displacements[dof]));
    const endMoments = [Math.abs(forces[1]), Math.abs(forces[3])];
    const envelope = elementEnvelopes[element];
    const yieldMoment = envelope.points.find((point) => point.label === 'Y')!.moment;
    const limitMoment = envelope.points[envelope.points.length - 1].moment;
    endMoments.forEach((moment, end) => {
      const sectionDemand = evaluateMomentCurvatureDemand(envelope, moment);
      const yieldRatio = moment / yieldMoment;
      const limitRatio = moment / limitMoment;
      if (stateRank[sectionDemand.state] > stateRank[worstState]) worstState = sectionDemand.state;
      if (yieldRatio > governingYieldRatio) {
        governingYieldRatio = yieldRatio;
        governingMoment = moment;
        governingDepth = (element + end) * elementLength;
        governingEnvelope = envelope;
      }
      governingUltimateRatio = Math.max(governingUltimateRatio, limitRatio);
    });
  });

  const profile = Array.from({ length: nodeCount }, (_, node): PileDepthStressPoint => {
    const depthZ = node * elementLength;
    const groundDepth = footing.depthGL + depthZ;
    const tributaryLength = node === 0 || node === nodeCount - 1 ? elementLength / 2 : elementLength;
    const properties = soilProperties(ground, layers, groundDepth, soilDiameter, referenceKh);
    const displacement = displacements[2 * node];
    const soilReaction = -soilStiffnesses[node] * displacement / tributaryLength;
    const moment = moments[node] / Math.max(1, momentCounts[node]);
    const shear = shears[node] / Math.max(1, shearCounts[node]);
    const resolvedSection = resolvePileSectionAtDepth(spec, depthZ);
    const sectionEnvelope = envelopeAtDepth(depthZ);
    const section = evaluateMomentCurvatureDemand(sectionEnvelope, Math.abs(moment));
    const soilYieldRatio = Math.abs(soilReaction) / properties.ultimatePerLength;
    if (Math.abs(moment) > Math.abs(maxMoment)) {
      maxMoment = moment;
      maxMomentDepth = depthZ;
    }
    if (Math.abs(shear) > Math.abs(maxShear)) maxShear = shear;
    maxSoilYieldRatio = Math.max(maxSoilYieldRatio, soilYieldRatio);
    if (stateRank[section.state] > stateRank[worstState]) worstState = section.state;
    return {
      depthZ: round(depthZ, 2),
      groundDepthGL: round(groundDepth, 2),
      deflectionY: round(displacement * 1000, 3),
      rotationTheta: round(displacements[2 * node + 1], 7),
      momentM: round(moment, 1),
      shearForceS: round(shear, 1),
      soilReactionP: round(soilReaction, 1),
      curvaturePhi: section.demandCurvature,
      sectionState: section.state,
      sectionSegmentId: resolvedSection.segment?.id,
      sectionWallThickness: resolvedSection.spec.wallThickness,
      effectiveStiffnessRatio: section.effectiveStiffnessRatio,
      soilReactionLimit: round(properties.ultimatePerLength, 1),
      soilYieldRatio: round(soilYieldRatio, 3),
    };
  });

  return {
    headShear: reactions[0],
    headMoment: reactions[1],
    profile,
    maxMoment,
    maxMomentDepth,
    maxShear,
    maxSoilYieldRatio,
    governingMoment,
    governingDepth,
    state: worstState,
    yieldRatio: governingYieldRatio,
    ultimateRatio: governingUltimateRatio,
    iterations,
    converged,
    envelope: governingEnvelope,
  };
}

function interpolateThreshold(states: IncrementState[], key: 'yieldRatio' | 'ultimateRatio') {
  const crossingIndex = states.findIndex((state) => state[key] >= 1);
  if (crossingIndex <= 0) return crossingIndex === 0 ? states[0].loadFactor : Number.POSITIVE_INFINITY;
  const before = states[crossingIndex - 1];
  const after = states[crossingIndex];
  const ratio = (1 - before[key]) / Math.max(1e-9, after[key] - before[key]);
  return before.loadFactor + clamp(ratio, 0, 1) * (after.loadFactor - before.loadFactor);
}

function displacementAtFactor(states: IncrementState[], factor: number) {
  if (!Number.isFinite(factor)) return Number.POSITIVE_INFINITY;
  const afterIndex = states.findIndex((state) => state.loadFactor >= factor);
  if (afterIndex < 0) {
    const last = states[states.length - 1];
    const before = states[Math.max(0, states.length - 2)];
    const slope = (last.point.displacement - before.point.displacement) /
      Math.max(1e-9, last.loadFactor - before.loadFactor);
    return last.point.displacement + slope * (factor - last.loadFactor);
  }
  if (afterIndex === 0) return states[0].point.displacement;
  const before = states[afterIndex - 1];
  const after = states[afterIndex];
  const ratio = (factor - before.loadFactor) / Math.max(1e-9, after.loadFactor - before.loadFactor);
  return before.point.displacement + ratio * (after.point.displacement - before.point.displacement);
}

export function runPileGroupIncrementalAnalysis(
  ground: GroundCondition,
  effectiveLayers: SoilLayer[],
  pileSpecs: Record<string, PileSpecification>,
  pileNodes: PileNode[],
  footing: FootingDimension,
  loadCase: LoadCase,
  springsMap: Record<string, PileHeadSpringMatrix>,
  maximumLoadFactor = 1.5,
  increments = 15,
): IncrementalPileGroupResult {
  const activePiles = pileNodes.filter((pile) => !pile.isOmitted);
  if (!canRunPileGroupIncrementalAnalysis(activePiles, pileSpecs)) {
    throw new Error('増分Winkler解析は鉛直の場所打ちRC杭・鋼管杭・鋼管ソイルセメント杭に対応しています');
  }

  const footingWeight = footing.lengthX * footing.lengthY * footing.thickness * footing.unitWeightConcrete;
  const verticalLoad = loadCase.verticalForceV + footingWeight;
  const sumKv = activePiles.reduce((sum, pile) => sum + springsMap[pile.pileSpecId].kv, 0);
  const sumKvX = activePiles.reduce((sum, pile) => sum + springsMap[pile.pileSpecId].kv * pile.x, 0);
  let deltaX = 0;
  let alpha = 0;
  const states: IncrementState[] = [];

  const evaluateGroup = (trialDeltaX: number, trialAlpha: number) => {
    const deltaY = (verticalLoad - trialAlpha * sumKvX) / sumKv;
    const cache = new Map<string, PileBeamResponse>();
    const responses: Record<string, PileBeamResponse> = {};
    const profiles: Record<string, PileDepthStressPoint[]> = {};
    const reactions: PileHeadReaction[] = [];
    let horizontal = 0;
    let moment = 0;

    activePiles.forEach((pile, index) => {
      const spec = pileSpecs[pile.pileSpecId];
      const spring = springsMap[pile.pileSpecId];
      const axialForce = spring.kv * (deltaY + pile.x * trialAlpha);
      const cacheKey = `${spec.id}:${axialForce.toFixed(3)}`;
      let response = cache.get(cacheKey);
      if (!response) {
        response = analyzePileBeam(
          spec,
          ground,
          effectiveLayers,
          footing,
          axialForce,
          trialDeltaX,
          trialAlpha,
          spring.kh,
        );
        cache.set(cacheKey, response);
      }
      responses[pile.id] = response;
      profiles[pile.id] = response.profile;
      horizontal += response.headShear;
      moment += response.headMoment + axialForce * pile.x;
      reactions.push({
        pileNodeId: pile.id,
        index: index + 1,
        x: pile.x,
        y: pile.y,
        axialForceP: round(axialForce, 1),
        shearForceH: round(response.headShear, 1),
        bendingMomentM: round(response.headMoment, 1),
        displacementDelta: round(trialDeltaX * 1000, 3),
        rotationAngleRad: round(trialAlpha, 7),
      });
    });
    return { deltaY, horizontal, moment, responses, profiles, reactions };
  };

  for (let increment = 0; increment <= increments; increment++) {
    const loadFactor = increment * maximumLoadFactor / increments;
    const targetHorizontal = loadCase.horizontalForceH * loadFactor;
    const targetMoment = loadCase.momentM * loadFactor;
    let group = evaluateGroup(deltaX, alpha);
    let converged = false;
    let groupIterations = 0;

    for (let iteration = 1; iteration <= 14; iteration++) {
      groupIterations = iteration;
      const residualH = group.horizontal - targetHorizontal;
      const residualM = group.moment - targetMoment;
      if (
        Math.abs(residualH) <= Math.max(0.5, Math.abs(targetHorizontal) * 0.0005) &&
        Math.abs(residualM) <= Math.max(1, Math.abs(targetMoment) * 0.0005)
      ) {
        converged = true;
        break;
      }
      const displacementStep = Math.max(1e-6, Math.abs(deltaX) * 0.002);
      const rotationStep = Math.max(1e-7, Math.abs(alpha) * 0.002);
      const shiftedDisplacement = evaluateGroup(deltaX + displacementStep, alpha);
      const shiftedRotation = evaluateGroup(deltaX, alpha + rotationStep);
      const j11 = (shiftedDisplacement.horizontal - group.horizontal) / displacementStep;
      const j21 = (shiftedDisplacement.moment - group.moment) / displacementStep;
      const j12 = (shiftedRotation.horizontal - group.horizontal) / rotationStep;
      const j22 = (shiftedRotation.moment - group.moment) / rotationStep;
      const determinant = j11 * j22 - j12 * j21;
      if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-9) break;
      const deltaIncrement = clamp((-residualH * j22 + j12 * residualM) / determinant, -0.03, 0.03);
      const alphaIncrement = clamp((-j11 * residualM + j21 * residualH) / determinant, -0.003, 0.003);
      deltaX = clamp(deltaX + 0.7 * deltaIncrement, -0.5, 0.5);
      alpha = clamp(alpha + 0.7 * alphaIncrement, -0.05, 0.05);
      group = evaluateGroup(deltaX, alpha);
    }

    const responseEntries = Object.entries(group.responses);
    const governing = responseEntries.reduce((current, candidate) =>
      candidate[1].yieldRatio > current[1].yieldRatio ? candidate : current,
    );
    const governingUltimate = responseEntries.reduce((current, candidate) =>
      candidate[1].ultimateRatio > current[1].ultimateRatio ? candidate : current,
    );
    const governingSoil = responseEntries.reduce((maximum, entry) =>
      Math.max(maximum, entry[1].maxSoilYieldRatio), 0,
    );
    const worstState = responseEntries.reduce<MomentCurvatureState>((worst, entry) =>
      stateRank[entry[1].state] > stateRank[worst] ? entry[1].state : worst,
    'elastic');
    states.push({
      loadFactor,
      displacement: {
        deltaX: round(deltaX * 1000, 3),
        deltaY: round(group.deltaY * 1000, 3),
        alpha: round(alpha, 7),
      },
      reactions: group.reactions,
      profiles: group.profiles,
      responses: group.responses,
      point: {
        loadFactor: round(loadFactor, 3),
        horizontalLoad: round(Math.abs(targetHorizontal), 1),
        overturningMoment: round(Math.abs(targetMoment), 1),
        displacement: round(Math.abs(deltaX) * 1000, 3),
        equivalentStiffnessRatio: round(
          responseEntries.reduce((sum, entry) => sum + entry[1].profile[0].effectiveStiffnessRatio!, 0) /
            responseEntries.length,
          4,
        ),
        state: worstState,
        rotationAngle: round(alpha, 7),
        maxMoment: round(Math.abs(governing[1].maxMoment), 1),
        maxMomentDepth: round(governing[1].maxMomentDepth, 2),
        governingPileNodeId: governing[0],
        soilYieldRatio: round(governingSoil, 3),
        iterations: groupIterations,
        converged: converged && responseEntries.every((entry) => entry[1].converged),
      },
      yieldRatio: governing[1].yieldRatio,
      ultimateRatio: governingUltimate[1].ultimateRatio,
      iterations: groupIterations,
      converged: converged && responseEntries.every((entry) => entry[1].converged),
    });
  }

  const designState = states.reduce((closest, state) =>
    Math.abs(state.loadFactor - 1) < Math.abs(closest.loadFactor - 1) ? state : closest,
  );
  const yieldFactorFromCurve = interpolateThreshold(states, 'yieldRatio');
  const ultimateFactorFromCurve = interpolateThreshold(states, 'ultimateRatio');
  const designGoverning = Object.entries(designState.responses).reduce((current, candidate) =>
    candidate[1].yieldRatio > current[1].yieldRatio ? candidate : current,
  );
  const designLimitGoverning = Object.entries(designState.responses).reduce((current, candidate) =>
    candidate[1].ultimateRatio > current[1].ultimateRatio ? candidate : current,
  );
  const yieldPoint = designGoverning[1].envelope.points.find((point) => point.label === 'Y')!;
  const yieldFactor = Number.isFinite(yieldFactorFromCurve)
    ? yieldFactorFromCurve
    : 1 / Math.max(1e-9, designState.yieldRatio);
  const ultimateFactor = Number.isFinite(ultimateFactorFromCurve)
    ? ultimateFactorFromCurve
    : 1 / Math.max(1e-9, designState.ultimateRatio);

  const checks = designState.reactions.map((reaction): MomentCurvatureCheckResult => {
    const pile = activePiles.find((candidate) => candidate.id === reaction.pileNodeId)!;
    const spec = pileSpecs[pile.pileSpecId];
    const response = designState.responses[pile.id];
    const demand = evaluateMomentCurvatureDemand(response.envelope, response.governingMoment);
    const soilDiameter = getPileSoilInteractionDiameter(spec);
    const effectiveBeta = Math.pow(
      (springsMap[pile.pileSpecId].kh * soilDiameter) /
        (4 * Math.max(response.envelope.initialEI * 0.01, demand.effectiveFlexuralRigidity)),
      0.25,
    );
    return {
      pileNodeId: pile.id,
      pileSpecId: pile.pileSpecId,
      modelType: response.envelope.modelType,
      axialForceForCurve: reaction.axialForceP,
      points: response.envelope.points,
      demandMoment: round(response.governingMoment, 1),
      demandCurvature: demand.demandCurvature,
      ductilityRatio: demand.ductilityRatio,
      effectiveFlexuralRigidity: demand.effectiveFlexuralRigidity,
      effectiveStiffnessRatio: demand.effectiveStiffnessRatio,
      effectiveBeta: round(effectiveBeta, 5),
      state: demand.state,
      iterations: response.iterations,
      converged: response.converged && designState.converged,
      isWithinUltimate: demand.isWithinUltimate,
      governingDepth: round(response.governingDepth, 2),
      governingSectionId: response.envelope.sectionSegmentId,
      notes: [
        ...response.envelope.notes,
        '杭を20梁要素に分割し、各要素の断面区分別M-φ割線EIと各節点の非線形地盤ばねを反復更新',
        '剛体底版の水平変位・回転を荷重増分ごとに釣合い計算',
      ],
    };
  });

  return {
    curve: {
      model: 'incremental_winkler',
      points: states.map((state) => state.point),
      designDisplacement: designState.point.displacement,
      yieldCheck: {
        governingPileNodeId: designGoverning[0],
        yieldMoment: yieldPoint.moment,
        designMoment: round(designGoverning[1].governingMoment, 1),
        yieldLoadFactor: round(yieldFactor, 3),
        yieldHorizontalLoad: round(Math.abs(loadCase.horizontalForceH) * yieldFactor, 1),
        yieldDisplacement: round(displacementAtFactor(states, yieldFactor), 3),
        ultimateLoadFactor: round(ultimateFactor, 3),
        limitState: designLimitGoverning[1].envelope.modelType === 'bilinear' ? 'fully_plastic' : 'ultimate',
        hasYieldedAtDesignLoad: designState.yieldRatio >= 1,
        isWithinUltimateAtDesignLoad: designState.ultimateRatio <= 1,
        state: designState.point.state,
      },
      notes: [
        '鉛直の場所打ちRC杭・鋼管系杭を20要素に分割した荷重増分型の非線形Winkler解析',
        '各増分で断面区分別M-φ割線EI、地層別kH、地盤反力上限pHU、杭軸力を更新',
        '地盤反力上限は土質強度から求める簡易p-y上限であり、適用基準の正式式との照合が必要',
      ],
    },
    designDisplacement: designState.displacement,
    designReactions: designState.reactions,
    designProfiles: designState.profiles,
    checks,
  };
}

/** 既存呼出しとの互換用。 */
export const runRcPileGroupIncrementalAnalysis = runPileGroupIncrementalAnalysis;
