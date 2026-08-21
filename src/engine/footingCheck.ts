import {
  FootingCheckResult,
  FootingDirectionCheckResult,
  PileHeadReaction,
} from '../types/calculation';
import { FootingDimension } from '../types/pile';

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const barArea = (diameter: number) => Math.PI * diameter ** 2 / 4;

interface DirectionInput {
  direction: 'X' | 'Y';
  columnDimension: number;
  effectiveWidth: number;
  topDiameter: number;
  topSpacing: number;
  bottomDiameter: number;
  bottomSpacing: number;
}

function checkDirection(
  input: DirectionInput,
  reactions: PileHeadReaction[],
  footing: FootingDimension,
): FootingDirectionCheckResult {
  const fy = footing.rebarYieldStrength ?? 295;
  const topCover = footing.topRebarCover ?? 110;
  const bottomCover = footing.bottomRebarCover ?? 150;
  const thicknessMm = footing.thickness * 1000;
  const dBottom = Math.max(100, thicknessMm - bottomCover - input.bottomDiameter / 2);
  const dTop = Math.max(100, thicknessMm - topCover - input.topDiameter / 2);
  const halfColumn = input.columnDimension / 2;
  const dMetres = dBottom / 1000;
  const coordinates = reactions.map((reaction) => ({
    reaction,
    coordinate: input.direction === 'X' ? reaction.x : reaction.y,
  }));

  const sideMoment = (positiveSide: boolean) => coordinates.reduce((sum, item) => {
    const isOutside = positiveSide
      ? item.coordinate > halfColumn
      : item.coordinate < -halfColumn;
    if (!isOutside) return sum;
    const lever = positiveSide
      ? item.coordinate - halfColumn
      : -halfColumn - item.coordinate;
    const lateralEnvelope = input.direction === 'X'
      ? Math.abs(item.reaction.bendingMomentM) + Math.abs(item.reaction.shearForceH) * dMetres / 2
      : 0;
    return sum + item.reaction.axialForceP * lever + lateralEnvelope;
  }, 0);
  const momentCandidates = [sideMoment(true), sideMoment(false)];
  const positiveMoment = Math.max(0, ...momentCandidates) / input.effectiveWidth;
  const negativeMoment = Math.abs(Math.min(0, ...momentCandidates)) / input.effectiveWidth;

  const bottomAs = barArea(input.bottomDiameter) * 1000 / input.bottomSpacing;
  const topAs = barArea(input.topDiameter) * 1000 / input.topSpacing;
  const positiveCapacity = 0.9 * bottomAs * fy * dBottom / 1e6;
  const negativeCapacity = 0.9 * topAs * fy * dTop / 1e6;
  const requiredBottomAs = positiveMoment * 1e6 / (0.9 * fy * dBottom);
  const requiredTopAs = negativeMoment * 1e6 / (0.9 * fy * dTop);
  const flexureUtilization = Math.max(
    positiveMoment / Math.max(positiveCapacity, 1e-9),
    negativeMoment / Math.max(negativeCapacity, 1e-9),
  );

  const shearDistance = halfColumn + dMetres;
  const sideShear = (positiveSide: boolean) => coordinates.reduce((sum, item) => {
    const isBeyondSection = positiveSide
      ? item.coordinate > shearDistance
      : item.coordinate < -shearDistance;
    return isBeyondSection ? sum + Math.abs(item.reaction.axialForceP) : sum;
  }, 0);
  const designShear = Math.max(sideShear(true), sideShear(false)) / input.effectiveWidth;
  const concreteShearStress = 0.2 * Math.pow(footing.concreteStrengthFck, 1 / 3);
  const concreteShearCapacity = concreteShearStress * 1000 * dBottom / 1000;
  const shearDiameter = footing.shearRebarDiameter ?? 16;
  const shearSpacing = footing.shearRebarSpacing ?? 250;
  const shearLegs = footing.shearRebarLegs ?? 2;
  const shearRebarCapacity = shearLegs * barArea(shearDiameter) * fy * dBottom / shearSpacing / 1000;
  const shearCapacity = concreteShearCapacity + shearRebarCapacity;
  const shearUtilization = designShear / Math.max(shearCapacity, 1e-9);

  return {
    direction: input.direction,
    effectiveWidth: round(input.effectiveWidth, 3),
    effectiveDepthBottom: round(dBottom, 1),
    effectiveDepthTop: round(dTop, 1),
    positiveMoment: round(positiveMoment, 2),
    negativeMoment: round(negativeMoment, 2),
    bottomRebarArea: round(bottomAs, 1),
    topRebarArea: round(topAs, 1),
    requiredBottomRebarArea: round(requiredBottomAs, 1),
    requiredTopRebarArea: round(requiredTopAs, 1),
    positiveMomentCapacity: round(positiveCapacity, 2),
    negativeMomentCapacity: round(negativeCapacity, 2),
    flexureUtilization: round(flexureUtilization, 3),
    designShear: round(designShear, 2),
    concreteShearCapacity: round(concreteShearCapacity, 2),
    shearRebarCapacity: round(shearRebarCapacity, 2),
    shearCapacity: round(shearCapacity, 2),
    shearUtilization: round(shearUtilization, 3),
    isFlexurePass: flexureUtilization <= 1,
    isShearPass: shearUtilization <= 1,
  };
}

export function checkFootingSlab(
  loadCaseId: string,
  footing: FootingDimension,
  reactions: PileHeadReaction[],
): FootingCheckResult {
  const columnX = footing.columnLengthX ?? 2;
  const columnY = footing.columnLengthY ?? 2;
  if (columnX <= 0 || columnY <= 0 || columnX >= footing.lengthX || columnY >= footing.lengthY) {
    throw new Error('底版照査では柱寸法を底版寸法より小さい正の値にしてください');
  }
  const positiveInputs = [
    footing.thickness,
    footing.concreteStrengthFck,
    footing.rebarYieldStrength ?? 295,
    footing.topRebarDiameterX ?? 22,
    footing.topRebarSpacingX ?? 125,
    footing.bottomRebarDiameterX ?? 32,
    footing.bottomRebarSpacingX ?? 125,
    footing.topRebarDiameterY ?? 32,
    footing.topRebarSpacingY ?? 125,
    footing.bottomRebarDiameterY ?? 25,
    footing.bottomRebarSpacingY ?? 125,
    footing.shearRebarDiameter ?? 16,
    footing.shearRebarSpacing ?? 250,
    footing.shearRebarLegs ?? 2,
  ];
  if (positiveInputs.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('底版照査の厚さ、材料強度、鉄筋径・間隔・脚数は正の値にしてください');
  }

  const directions = [
    checkDirection({
      direction: 'X',
      columnDimension: columnX,
      effectiveWidth: footing.lengthY,
      topDiameter: footing.topRebarDiameterX ?? 22,
      topSpacing: footing.topRebarSpacingX ?? 125,
      bottomDiameter: footing.bottomRebarDiameterX ?? 32,
      bottomSpacing: footing.bottomRebarSpacingX ?? 125,
    }, reactions, footing),
    checkDirection({
      direction: 'Y',
      columnDimension: columnY,
      effectiveWidth: footing.lengthX,
      topDiameter: footing.topRebarDiameterY ?? 32,
      topSpacing: footing.topRebarSpacingY ?? 125,
      bottomDiameter: footing.bottomRebarDiameterY ?? 25,
      bottomSpacing: footing.bottomRebarSpacingY ?? 125,
    }, reactions, footing),
  ];

  const effectiveDepth = Math.min(...directions.map((direction) => direction.effectiveDepthBottom));
  const dMetres = effectiveDepth / 1000;
  const criticalHalfX = columnX / 2 + dMetres / 2;
  const criticalHalfY = columnY / 2 + dMetres / 2;
  const totalCompression = reactions.reduce((sum, reaction) => sum + Math.max(0, reaction.axialForceP), 0);
  const insideCompression = reactions.reduce((sum, reaction) =>
    Math.abs(reaction.x) <= criticalHalfX && Math.abs(reaction.y) <= criticalHalfY
      ? sum + Math.max(0, reaction.axialForceP)
      : sum,
  0);
  const punchingDemand = Math.max(0, totalCompression - insideCompression);
  const criticalPerimeter = 2 * ((columnX + dMetres) + (columnY + dMetres));
  const punchingStressCapacity = 0.25 * Math.sqrt(footing.concreteStrengthFck);
  const punchingCapacity = punchingStressCapacity * criticalPerimeter * 1000 * effectiveDepth / 1000;
  const punchingUtilization = punchingDemand / Math.max(punchingCapacity, 1e-9);
  const punching = {
    criticalPerimeter: round(criticalPerimeter, 3),
    effectiveDepth: round(effectiveDepth, 1),
    designShear: round(punchingDemand, 2),
    capacity: round(punchingCapacity, 2),
    utilization: round(punchingUtilization, 3),
    isPass: punchingUtilization <= 1,
  };

  return {
    loadCaseId,
    directions,
    punching,
    isPass: directions.every((direction) => direction.isFlexurePass && direction.isShearPass) && punching.isPass,
    notes: [
      '矩形等厚底版を柱前面の単位幅断面として、上下主鉄筋の降伏曲げ耐力を照査',
      '一方向せん断は柱前面から有効高さdだけ離れた断面、押抜きは柱面からd/2の周長で照査',
      'X方向は杭頭水平力・杭頭曲げを保守的に包絡し、Y方向は杭鉛直反力による曲げを対象',
      'テーパー、有効幅換算、上載土・浮力の個別分解、柱間断面、局部的な荷重分散は対象外',
    ],
  };
}
