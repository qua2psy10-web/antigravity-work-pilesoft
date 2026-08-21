import type { PileSectionSegment, PileSpecification } from '../types/pile';

const STEEL_SECTION_TYPES = new Set([
  'steel_pipe',
  'steel_soil_cement',
  'rotary_steel',
]);

export interface ResolvedPileSection {
  spec: PileSpecification;
  segment?: PileSectionSegment;
  structuralDiameter: number;
  effectiveOuterDiameter: number;
  innerDiameter: number;
  area: number;
  inertia: number;
}

export const isSteelCircularPile = (spec: PileSpecification) =>
  STEEL_SECTION_TYPES.has(spec.pileType);

export const getPileStructuralDiameter = (spec: PileSpecification) =>
  spec.pileType === 'steel_soil_cement'
    ? (spec.steelPipeDiameter ?? spec.diameter)
    : spec.diameter;

export const getPileSoilInteractionDiameter = (spec: PileSpecification) => spec.diameter;

function sortedSegments(spec: PileSpecification) {
  return [...(spec.sectionSegments ?? [])].sort((a, b) => a.depthTop - b.depthTop);
}

export function sectionSegmentAtDepth(spec: PileSpecification, depthFromPileHead: number) {
  const segments = sortedSegments(spec);
  if (segments.length === 0) return undefined;
  const depth = Math.min(spec.length, Math.max(0, depthFromPileHead));
  return segments.find((segment, index) =>
    depth >= segment.depthTop &&
    (depth < segment.depthBottom || (index === segments.length - 1 && depth <= segment.depthBottom)),
  );
}

export function resolvePileSectionAtDepth(
  spec: PileSpecification,
  depthFromPileHead = 0,
): ResolvedPileSection {
  const structuralDiameter = getPileStructuralDiameter(spec);
  if (!isSteelCircularPile(spec)) {
    return {
      spec,
      structuralDiameter,
      effectiveOuterDiameter: structuralDiameter,
      innerDiameter: 0,
      area: spec.crossSectionAreaA,
      inertia: spec.momentOfInertiaI,
    };
  }

  const segment = sectionSegmentAtDepth(spec, depthFromPileHead);
  const wallThickness = segment?.wallThickness ?? spec.wallThickness ?? Math.max(9, structuralDiameter * 15);
  const corrosionAllowance = segment?.corrosionAllowance ?? spec.corrosionAllowance ?? 0;
  const thickness = Math.max(0.001, wallThickness / 1000);
  const corrosion = Math.min(
    Math.max(0, corrosionAllowance / 1000),
    Math.max(0, thickness - 0.001),
  );
  // 参考計算例と同じく外側腐食代を外径から控除し、元の内径は保持する。
  const effectiveOuterDiameter = Math.max(structuralDiameter * 0.5, structuralDiameter - 2 * corrosion);
  const innerDiameter = Math.max(0, structuralDiameter - 2 * thickness);
  const area = Math.PI * (effectiveOuterDiameter ** 2 - innerDiameter ** 2) / 4;
  const inertia = Math.PI * (effectiveOuterDiameter ** 4 - innerDiameter ** 4) / 64;
  const resolvedSpec: PileSpecification = {
    ...spec,
    diameter: structuralDiameter,
    wallThickness,
    corrosionAllowance,
    steelYieldStrength: segment?.steelYieldStrength ?? spec.steelYieldStrength,
    crossSectionAreaA: area,
    momentOfInertiaI: inertia,
    sectionSegments: undefined,
  };

  return {
    spec: resolvedSpec,
    segment,
    structuralDiameter,
    effectiveOuterDiameter,
    innerDiameter,
    area,
    inertia,
  };
}

export function calculatePileMaterialVolume(spec: PileSpecification) {
  if (!isSteelCircularPile(spec) || !spec.sectionSegments?.length) {
    return spec.crossSectionAreaA * spec.length;
  }
  const segments = sortedSegments(spec);
  let volume = 0;
  let coveredTo = 0;
  for (const segment of segments) {
    const top = Math.max(coveredTo, Math.max(0, segment.depthTop));
    const bottom = Math.min(spec.length, segment.depthBottom);
    if (bottom <= top) continue;
    if (top > coveredTo) volume += spec.crossSectionAreaA * (top - coveredTo);
    const resolved = resolvePileSectionAtDepth(spec, (top + bottom) / 2);
    volume += resolved.area * (bottom - top);
    coveredTo = bottom;
  }
  if (coveredTo < spec.length) volume += spec.crossSectionAreaA * (spec.length - coveredTo);
  return volume;
}
