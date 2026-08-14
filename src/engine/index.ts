import { GroundCondition } from '../types/soil';
import { PileSpecification, PileNode, FootingDimension } from '../types/pile';
import { LoadCase } from '../types/load';
import { CalculationResult } from '../types/calculation';
import { calculateLiquefaction } from './liquefaction';
import { calculateBearingCapacity } from './bearingCapacity';
import { calculateSubgradeReactionAndSprings } from './subgradeReaction';
import { solvePileGroupDisplacement } from './matrixSolver';
import { calculatePileDepthProfile } from './pileStress';
import { checkPileSectionStress } from './sectionCheck';
import { checkPileHeadJoint } from './pileHeadCheck';

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
  // 1. 各杭仕様の支持力計算 (代表として最初の杭仕様)
  const defaultSpecId = Object.keys(pileSpecs)[0];
  const mainSpec = pileSpecs[defaultSpecId];

  // 2. 各荷重ケースに対する安定計算・断面計算
  const results: CalculationResult[] = [];

  for (const loadCase of loadCases) {
    const isSeismic = loadCase.type.startsWith('seismic');

    // 地盤の液状化判定更新
    const liqResults = calculateLiquefaction(
      ground.layers,
      ground.groundWaterLevel,
      ground.seismicIntensityL1,
      ground.seismicIntensityL2Type1
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

    // 支持力計算
    const bearingResult = calculateBearingCapacity(
      mainSpec,
      effectiveLayers,
      footing,
      isSeismic
    );

    // 各杭仕様のバネマトリックス算定
    const springsMap: { [specId: string]: ReturnType<typeof calculateSubgradeReactionAndSprings> } = {};
    for (const specId in pileSpecs) {
      springsMap[specId] = calculateSubgradeReactionAndSprings(
        pileSpecs[specId],
        effectiveLayers,
        footing,
        'rigid',
        isSeismic,
        bearingResult.kv
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
    const pileProfiles: { [nodeId: string]: any[] } = {};
    const sectionChecks: any[] = [];
    const jointChecks: any[] = [];

    let maxDisplacement = Math.abs(solveRes.displacement.deltaX);
    let maxCompression = 0;
    let maxTension = 0;

    for (const reaction of solveRes.reactions) {
      const node = pileNodes.find((n) => n.id === reaction.pileNodeId);
      if (!node) continue;
      const spec = pileSpecs[node.pileSpecId] || mainSpec;
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
      if (reaction.axialForceP > maxCompression) maxCompression = reaction.axialForceP;
      if (reaction.axialForceP < maxTension) maxTension = reaction.axialForceP;
    }

    // 支持力限界照査
    const allowableBearing = isSeismic ? bearingResult.raSeismic : bearingResult.raNormal;
    const allowablePullout = isSeismic ? bearingResult.rpaSeismic : bearingResult.rpaNormal;

    const isBearingOk = maxCompression <= allowableBearing;
    const isPulloutOk = Math.abs(Math.min(0, maxTension)) <= allowablePullout;
    const isDispOk = maxDisplacement <= loadCase.allowableDisplacement;
    const isSectionAllOk = sectionChecks.every((c) => c.isPass);
    const isJointAllOk = jointChecks.every((c) => c.isPass);

    const isStable = isBearingOk && isPulloutOk && isDispOk && isSectionAllOk && isJointAllOk;

    results.push({
      loadCaseId: loadCase.id,
      loadCaseName: loadCase.name,
      springMatrix: springsMap[defaultSpecId],
      footingDisplacement: solveRes.displacement,
      pileReactions: solveRes.reactions,
      pileDepthProfiles: pileProfiles,
      bearingCapacity: bearingResult,
      sectionChecks,
      jointChecks,
      maxDisplacementMm: maxDisplacement,
      maxAxialCompressionKn: maxCompression,
      maxAxialTensionKn: maxTension,
      isStable,
    });
  }

  return results;
}
