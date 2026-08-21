import { GroundCondition } from '../types/soil';
import { PileSpecification, PileNode, FootingDimension } from '../types/pile';
import { LoadCase } from '../types/load';
import {
  CalculationResult,
  MomentCurvatureCheckResult,
  PileCapacityCheckResult,
  PileDepthStressPoint,
  PileHeadJointCheckResult,
  SectionStressCheckResult,
} from '../types/calculation';
import { calculateLiquefaction } from './liquefaction';
import {
  calculateAllowableCapacity,
  calculateBearingCapacity,
  SeismicReductionLevel,
} from './bearingCapacity';
import { calculateSubgradeReactionAndSprings } from './subgradeReaction';
import { solvePileGroupDisplacement } from './matrixSolver';
import { calculatePileDepthProfile } from './pileStress';
import { checkPileSectionStress } from './sectionCheck';
import { checkPileHeadJoint } from './pileHeadCheck';
import { analyzeNonlinearPileSection } from './momentCurvature';
import { buildLoadDisplacementCurve } from './loadDisplacement';
import { checkFootingSlab } from './footingCheck';

/**
 * 杭基礎設計 全体一括計算エンジン
 */
export function runFullDesignCalculation(
  ground: GroundCondition,
  pileSpecs: { [id: string]: PileSpecification },
  pileNodes: PileNode[],
  footing: FootingDimension,
  loadCases: LoadCase[]
): CalculationResult[] {
  if (Object.keys(pileSpecs).length === 0) {
    throw new Error('杭仕様を少なくとも 1 件入力してください');
  }
  const pileNodeById = new Map(pileNodes.map((node) => [node.id, node]));
  const loadCaseById = new Map(loadCases.map((loadCase) => [loadCase.id, loadCase]));
  for (const node of pileNodes) {
    if (!node.isOmitted && !pileSpecs[node.pileSpecId]) {
      throw new Error(`杭節点 ${node.id} に設定された杭仕様 ${node.pileSpecId} が見つかりません`);
    }
  }

  // 1. 各杭仕様の支持力計算
  const defaultSpecId = Object.keys(pileSpecs)[0];

  // 2. 各荷重ケースに対する安定計算・断面計算
  const results: CalculationResult[] = [];

  for (const loadCase of loadCases) {
    const seismicReduction: SeismicReductionLevel = loadCase.type === 'seismic_l1'
      ? 'l1'
      : loadCase.type === 'seismic_l2_t1' || loadCase.type === 'seismic_l2_t2'
        ? 'l2'
        : 'none';
    const liquefactionL2Intensity = loadCase.type === 'seismic_l2_t2'
      ? ground.seismicIntensityL2Type2
      : ground.seismicIntensityL2Type1;

    // 地盤の液状化判定更新
    const liqResults = calculateLiquefaction(
      ground.layers,
      ground.groundWaterLevel,
      ground.seismicIntensityL1,
      liquefactionL2Intensity
    );

    // 液状化低減を反映した土層リスト作成
    const effectiveLayers = ground.layers.map((layer) => {
      const lr = liqResults.find((r) => r.layerId === layer.id);
      return {
        ...layer,
        deLevel1: lr?.deLevel1 ?? 1.0,
        deLevel2: lr?.deLevel2 ?? 1.0,
      };
    });

    // 杭仕様ごとに支持力・バネを算定する。
    const bearingBySpec: Record<string, ReturnType<typeof calculateBearingCapacity>> = {};
    for (const specId in pileSpecs) {
      bearingBySpec[specId] = calculateBearingCapacity(
        pileSpecs[specId],
        effectiveLayers,
        footing,
        seismicReduction
      );
    }

    // 各杭仕様のバネマトリックス算定
    const springsMap: Record<string, ReturnType<typeof calculateSubgradeReactionAndSprings>> = {};
    for (const specId in pileSpecs) {
      springsMap[specId] = calculateSubgradeReactionAndSprings(
        pileSpecs[specId],
        effectiveLayers,
        footing,
        'rigid',
        seismicReduction,
        bearingBySpec[specId].kv
      );
    }

    // 杭基礎全体の変位法連立方程式求解
    const solveRes = solvePileGroupDisplacement(
      pileNodes,
      pileSpecs,
      springsMap,
      footing,
      loadCase
    );

    // 各杭の深度別プロファイル・断面照査・杭頭照査
    const pileProfiles: Record<string, PileDepthStressPoint[]> = {};
    const sectionChecks: SectionStressCheckResult[] = [];
    const jointChecks: PileHeadJointCheckResult[] = [];

    let maxDisplacement = Math.abs(solveRes.displacement.deltaX);
    let maxCompression = 0;
    let maxTension = 0;

    for (const reaction of solveRes.reactions) {
      const node = pileNodeById.get(reaction.pileNodeId);
      if (!node) {
        throw new Error(`杭節点 ${reaction.pileNodeId} が見つかりません`);
      }
      const spec = pileSpecs[node.pileSpecId];
      const spring = springsMap[node.pileSpecId];

      // 深度別プロファイル (Changの解)
      const { profile, maxMoment, maxMomentDepth, maxShear } = calculatePileDepthProfile(
        spec,
        reaction,
        spring.beta,
        spring.kh,
        footing,
        50
      );

      pileProfiles[node.id] = profile;

      // 断面応力度照査
      const secCheck = checkPileSectionStress(
        spec,
        loadCase,
        node.id,
        maxMoment,
        maxMomentDepth,
        reaction.axialForceP,
        maxShear
      );
      sectionChecks.push(secCheck);

      // 杭頭結合部照査
      const jCheck = checkPileHeadJoint(
        spec,
        footing,
        loadCase,
        node.id,
        reaction.axialForceP,
        reaction.shearForceH,
        reaction.bendingMomentM
      );
      jointChecks.push(jCheck);

      // 極値記録
      maxDisplacement = Math.max(maxDisplacement, Math.abs(reaction.displacementDelta));
      if (reaction.axialForceP > maxCompression) maxCompression = reaction.axialForceP;
      if (reaction.axialForceP < maxTension) maxTension = reaction.axialForceP;
    }

    // 杭仕様と荷重ケースごとの支持力限界照査
    const pileCapacityChecks: PileCapacityCheckResult[] = solveRes.reactions.map((reaction) => {
      const node = pileNodeById.get(reaction.pileNodeId);
      if (!node) {
        throw new Error(`杭節点 ${reaction.pileNodeId} の仕様が見つかりません`);
      }
      const capacity = bearingBySpec[node.pileSpecId];
      if (!capacity) {
        throw new Error(`杭仕様 ${node.pileSpecId} の支持力が見つかりません`);
      }
      const allowable = calculateAllowableCapacity(
        capacity,
        loadCase.safetyFactorBearing,
        loadCase.safetyFactorPullout
      );
      return {
        pileNodeId: node.id,
        pileSpecId: node.pileSpecId,
        axialForceP: reaction.axialForceP,
        allowableBearing: allowable.bearing,
        allowablePullout: allowable.pullout,
        isBearingOk: reaction.axialForceP <= allowable.bearing,
        isPulloutOk: Math.max(0, -reaction.axialForceP) <= allowable.pullout,
      };
    });
    const governingCapacityCheck = pileCapacityChecks.reduce((governing, current) => {
      const governingUtilization = Math.max(
        Math.max(0, governing.axialForceP) / governing.allowableBearing,
        Math.max(0, -governing.axialForceP) / governing.allowablePullout
      );
      const currentUtilization = Math.max(
        Math.max(0, current.axialForceP) / current.allowableBearing,
        Math.max(0, -current.axialForceP) / current.allowablePullout
      );
      return currentUtilization > governingUtilization ? current : governing;
    });

    const isBearingOk = pileCapacityChecks.every((check) => check.isBearingOk);
    const isPulloutOk = pileCapacityChecks.every((check) => check.isPulloutOk);
    const isDispOk = maxDisplacement <= loadCase.allowableDisplacement;
    const isSectionAllOk = sectionChecks.every((c) => c.isPass);
    const isJointAllOk = jointChecks.every((c) => c.isPass);
    const footingCheck = checkFootingSlab(loadCase.id, footing, solveRes.reactions);

    const isStable = isBearingOk && isPulloutOk && isDispOk && isSectionAllOk && isJointAllOk && footingCheck.isPass;

    results.push({
      loadCaseId: loadCase.id,
      loadCaseName: loadCase.name,
      loadCaseType: loadCase.type,
      springMatrix: springsMap[defaultSpecId],
      footingDisplacement: solveRes.displacement,
      pileReactions: solveRes.reactions,
      pileDepthProfiles: pileProfiles,
      bearingCapacity: bearingBySpec[defaultSpecId],
      sectionChecks,
      jointChecks,
      momentCurvatureChecks: [],
      footingCheck,
      pileCapacityChecks,
      allowableBearingKn: governingCapacityCheck.allowableBearing,
      allowablePulloutKn: governingCapacityCheck.allowablePullout,
      allowableDisplacementMm: loadCase.allowableDisplacement,
      maxDisplacementMm: maxDisplacement,
      maxAxialCompressionKn: maxCompression,
      maxAxialTensionKn: maxTension,
      isStable,
    });
  }

  // L2荷重ケースは、死荷重時軸力で作成したM-φ骨格の割線EIを用いて
  // 杭1本ごとのChang解を反復更新する。全体系の増分変位法とは区別する。
  const normalResult = results.find((result) => result.loadCaseType === 'normal');
  const normalAxialByPile = new Map(
    normalResult?.pileReactions.map((reaction) => [reaction.pileNodeId, reaction.axialForceP]) ?? [],
  );

  for (const result of results) {
    if (result.loadCaseType !== 'seismic_l2_t1' && result.loadCaseType !== 'seismic_l2_t2') continue;
    const loadCase = loadCaseById.get(result.loadCaseId);
    if (!loadCase) continue;

    const nonlinearChecks: MomentCurvatureCheckResult[] = [];
    const updatedSectionChecks: SectionStressCheckResult[] = [];
    const updatedProfiles: Record<string, PileDepthStressPoint[]> = { ...result.pileDepthProfiles };

    for (const reaction of result.pileReactions) {
      const node = pileNodeById.get(reaction.pileNodeId);
      if (!node) continue;
      const spec = pileSpecs[node.pileSpecId];
      const hasNormalAxialForce = normalAxialByPile.has(node.id);
      const axialForceForCurve = normalAxialByPile.get(node.id) ?? reaction.axialForceP;
      const nonlinear = analyzeNonlinearPileSection(
        spec,
        reaction,
        result.springMatrix.kh,
        footing,
        axialForceForCurve,
      );
      if (!hasNormalAxialForce) {
        nonlinear.check.notes.push('常時荷重ケースがないため、当該L2ケースの軸力でM-φ骨格を作成');
      }
      nonlinearChecks.push(nonlinear.check);
      updatedProfiles[node.id] = nonlinear.profile;
      updatedSectionChecks.push(checkPileSectionStress(
        spec,
        loadCase,
        node.id,
        nonlinear.maxMoment,
        nonlinear.maxMomentDepth,
        reaction.axialForceP,
        nonlinear.maxShear,
      ));
    }

    result.momentCurvatureChecks = nonlinearChecks;
    result.loadDisplacementCurve = buildLoadDisplacementCurve(
      nonlinearChecks,
      loadCase.horizontalForceH,
      loadCase.momentM,
      result.maxDisplacementMm,
    );
    result.maxDisplacementMm = result.loadDisplacementCurve.designDisplacement;
    result.pileDepthProfiles = updatedProfiles;
    result.sectionChecks = updatedSectionChecks;
    const isCapacityOk = result.pileCapacityChecks.every((check) => check.isBearingOk && check.isPulloutOk);
    const isDisplacementOk = result.maxDisplacementMm <= result.allowableDisplacementMm;
    const isSectionOk = updatedSectionChecks.every((check) => check.isPass);
    const isJointOk = result.jointChecks.every((check) => check.isPass);
    const isMomentCurvatureOk = nonlinearChecks.every(
      (check) => check.isWithinUltimate && check.converged,
    );
    const isYieldUltimateOk = result.loadDisplacementCurve.yieldCheck.isWithinUltimateAtDesignLoad;
    result.isStable = isCapacityOk && isDisplacementOk && isSectionOk && isJointOk &&
      isMomentCurvatureOk && isYieldUltimateOk && result.footingCheck.isPass;
  }

  return results;
}
