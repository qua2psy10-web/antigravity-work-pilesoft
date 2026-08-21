import { describe, expect, it } from 'vitest';
import { calculateAllowableCapacity, calculateBearingCapacity } from './bearingCapacity';
import { runFullDesignCalculation } from './index';
import { checkPileHeadJoint } from './pileHeadCheck';
import { checkPileSectionStress } from './sectionCheck';
import { buildMomentCurvatureEnvelope } from './momentCurvature';
import { calculatePileMaterialVolume } from './pileSection';
import { defaultProject, steelPileSampleProject } from '../samples/defaultProjects';

describe('杭基礎計算の安全側ガード', () => {
  it('摩擦杭は先端支持力を押込み抵抗に算入しない', () => {
    const project = structuredClone(defaultProject);
    const spec = project.pileSpecs['spec-rc-1200'];
    spec.bearingType = 'friction';

    const capacity = calculateBearingCapacity(spec, project.ground.layers, project.footing);

    expect(capacity.qp).toBe(0);
    expect(capacity.raNormal).toBeCloseTo(capacity.ru / 4, 1);
  });

  it('鋼管杭自重には鋼材断面積を使用する', () => {
    const project = structuredClone(steelPileSampleProject);
    const spec = project.pileSpecs['spec-steel-800'];

    const capacity = calculateBearingCapacity(spec, project.ground.layers, project.footing);
    const expectedWeight = calculatePileMaterialVolume(spec) * 78.5;

    expect(capacity.pileWeightWp).toBeCloseTo(expectedWeight, 1);
    expect(capacity.pileWeightWp).toBeLessThan(200);
  });

  it('荷重ケースの支持力・引抜き安全率を許容抵抗力に反映する', () => {
    const project = structuredClone(defaultProject);
    const capacity = calculateBearingCapacity(
      project.pileSpecs['spec-rc-1200'],
      project.ground.layers,
      project.footing,
    );

    const allowable = calculateAllowableCapacity(capacity, 2.5, 4);

    expect(allowable.bearing).toBeCloseTo(capacity.ru / 2.5, 1);
    expect(allowable.pullout).toBeCloseTo(capacity.qs / 4 + capacity.pileWeightWp, 1);
  });

  it('L2 Type II は Type I と別の地震動を液状化低減へ使う', () => {
    const project = structuredClone(defaultProject);
    project.ground.seismicIntensityL2Type1 = 0.05;
    project.ground.seismicIntensityL2Type2 = 1.6;
    project.loadCases = [
      { ...project.loadCases[3], id: 'l2-t1', type: 'seismic_l2_t1' },
      { ...project.loadCases[3], id: 'l2-t2', type: 'seismic_l2_t2' },
    ];

    const [type1, type2] = runFullDesignCalculation(
      project.ground,
      project.pileSpecs,
      project.pileNodes,
      project.footing,
      project.loadCases,
    );

    expect(type1.bearingCapacity.qs).not.toBe(type2.bearingCapacity.qs);
  });

  it('RC杭の引抜き軸力を圧縮として扱わない', () => {
    const project = structuredClone(defaultProject);
    const check = checkPileSectionStress(
      project.pileSpecs['spec-rc-1200'],
      project.loadCases[0],
      'p1',
      0,
      0,
      -1000,
      0,
    );

    expect(check.compressiveStressC).toBe(0);
    expect(check.tensileStressS).toBeGreaterThan(0);
  });

  it('杭頭結合部の曲げ照査を合否に反映する', () => {
    const project = structuredClone(defaultProject);
    const check = checkPileHeadJoint(
      project.pileSpecs['spec-rc-1200'],
      project.footing,
      project.loadCases[0],
      'p1',
      0,
      0,
      2000,
    );

    expect(check.virtualRcStressRatio).toBeGreaterThan(1);
    expect(check.isPass).toBe(false);
  });

  it('RC杭のM-φ骨格はO-C-Y-Uの単調なトリリニアになる', () => {
    const project = structuredClone(defaultProject);
    const envelope = buildMomentCurvatureEnvelope(project.pileSpecs['spec-rc-1200'], 1600);

    expect(envelope.modelType).toBe('trilinear');
    expect(envelope.points.map((point) => point.label)).toEqual(['O', 'C', 'Y', 'U']);
    for (let index = 1; index < envelope.points.length; index++) {
      expect(envelope.points[index].moment).toBeGreaterThan(envelope.points[index - 1].moment);
      expect(envelope.points[index].curvature).toBeGreaterThan(envelope.points[index - 1].curvature);
    }
  });

  it('kiso-Kui_1の場所打ち杭M-φ基準値を概ね再現する', () => {
    const project = structuredClone(defaultProject);
    const spec = project.pileSpecs['spec-rc-1200'];
    spec.modulusE = 2.75e7;
    spec.rebarDiameter = 25;
    spec.rebarCount = 24;
    spec.rebarCover = 150;
    const envelope = buildMomentCurvatureEnvelope(spec, 1626.7);
    const cracking = envelope.points.find((point) => point.label === 'C')!;
    const yielding = envelope.points.find((point) => point.label === 'Y')!;
    const ultimate = envelope.points.find((point) => point.label === 'U')!;

    // kiso-Kui_1 p.142: Mc=602.5, My=1837.9, Mu=2634.4 kN·m
    // φc=0.0002159, φy=0.0027591, φu=0.0266303 1/m
    expect(cracking.moment / 602.5).toBeGreaterThan(0.9);
    expect(cracking.moment / 602.5).toBeLessThan(1.1);
    expect(yielding.moment / 1837.9).toBeGreaterThan(0.9);
    expect(yielding.moment / 1837.9).toBeLessThan(1.1);
    expect(ultimate.moment / 2634.4).toBeGreaterThan(0.9);
    expect(ultimate.moment / 2634.4).toBeLessThan(1.1);
    expect(cracking.curvature / 0.0002159).toBeGreaterThan(0.85);
    expect(yielding.curvature / 0.0027591).toBeGreaterThan(0.85);
    expect(ultimate.curvature / 0.0266303).toBeGreaterThan(0.85);
  });

  it('鋼管杭のM-φ骨格は腐食・軸力を反映したMy-Mpバイリニアになる', () => {
    const project = structuredClone(steelPileSampleProject);
    const spec = project.pileSpecs['spec-steel-800'];
    const withAxial = buildMomentCurvatureEnvelope(spec, 1000);
    const withoutAxial = buildMomentCurvatureEnvelope(spec, 0);

    expect(withAxial.modelType).toBe('bilinear');
    expect(withAxial.points.map((point) => point.label)).toEqual(['O', 'Y', 'P']);
    expect(withAxial.points[1].moment).toBeLessThan(withoutAxial.points[1].moment);
    expect(withAxial.points[2].moment).toBeGreaterThan(withAxial.points[1].moment);
  });

  it('kiso-Kui_9の鋼管杭My-Mpと曲率を再現する', () => {
    const project = structuredClone(steelPileSampleProject);
    const spec = project.pileSpecs['spec-steel-800'];
    const envelope = buildMomentCurvatureEnvelope(spec, 2336.1, 0);
    const yielding = envelope.points.find((point) => point.label === 'Y')!;
    const plastic = envelope.points.find((point) => point.label === 'P')!;

    // kiso-Kui_9 計算書p.122（PDF物理125頁）: D=1000, t=17, 外側腐食代1mm, σy=315
    expect(yielding.moment).toBeCloseTo(3192.5, 1);
    expect(plastic.moment).toBeCloseTo(4725.9, 1);
    expect(yielding.curvature).toBeCloseTo(0.0026821, 7);
    expect(plastic.curvature).toBeCloseTo(0.0039703, 7);
    expect(envelope.sectionSegmentId).toBe('S1');

    const lowerSection = buildMomentCurvatureEnvelope(spec, 2336.1, 10);
    expect(lowerSection.sectionSegmentId).toBe('S2');
    expect(lowerSection.points.find((point) => point.label === 'Y')!.moment).toBeLessThan(yielding.moment);
  });

  it('kiso-Kui_3の鋼管ソイルセメント杭は固化体径と鋼管径を分離してMy-Mpを再現する', () => {
    const project = structuredClone(steelPileSampleProject);
    const base = project.pileSpecs['spec-steel-800'];
    const spec = {
      ...base,
      id: 'spec-ssc-1000-800',
      pileType: 'steel_soil_cement' as const,
      method: 'soil_cement' as const,
      diameter: 1.0,
      steelPipeDiameter: 0.8,
      length: 40,
      wallThickness: 19,
      sectionSegments: [
        { id: 'S1', depthTop: 0, depthBottom: 8, wallThickness: 19, corrosionAllowance: 1, steelYieldStrength: 315 },
        { id: 'S2', depthTop: 8, depthBottom: 10, wallThickness: 14, corrosionAllowance: 1, steelYieldStrength: 315 },
        { id: 'S3', depthTop: 10, depthBottom: 40, wallThickness: 11, corrosionAllowance: 1, steelYieldStrength: 315 },
      ],
    };
    const envelope = buildMomentCurvatureEnvelope(spec, 959.9, 0);
    const yielding = envelope.points.find((point) => point.label === 'Y')!;
    const plastic = envelope.points.find((point) => point.label === 'P')!;

    // kiso-Kui_3 計算書p.181（PDF物理184頁）: Dsc=1000, D=800, t=19, 外側腐食代1mm
    expect(yielding.moment).toBeCloseTo(2466.6, 1);
    expect(plastic.moment).toBeCloseTo(3429.9, 1);
    expect(yielding.curvature).toBeCloseTo(0.0036746, 6);
    expect(plastic.curvature).toBeCloseTo(0.0051099, 6);
  });

  it('鉛直鋼管杭のL2結果に断面区分付き増分解析を格納する', () => {
    const project = structuredClone(steelPileSampleProject);
    project.pileNodes = project.pileNodes.slice(0, 3);
    project.loadCases = [project.loadCases[0], project.loadCases[3]];
    const results = runFullDesignCalculation(
      project.ground,
      project.pileSpecs,
      project.pileNodes,
      project.footing,
      project.loadCases,
    );
    const l2 = results.find((result) => result.loadCaseType === 'seismic_l2_t1')!;

    expect(l2.loadDisplacementCurve?.model).toBe('incremental_winkler');
    expect(l2.loadDisplacementCurve?.yieldCheck.limitState).toBe('fully_plastic');
    expect(l2.momentCurvatureChecks.every((check) => check.modelType === 'bilinear')).toBe(true);
    expect(l2.pileDepthProfiles.sp1.some((point) => point.sectionSegmentId === 'S1')).toBe(true);
    expect(l2.pileDepthProfiles.sp1.some((point) => point.sectionSegmentId === 'S2')).toBe(true);
  });

  it('斜杭を含む鋼管杭は等価割線解析へフォールバックする', () => {
    const project = structuredClone(steelPileSampleProject);
    project.pileNodes[0].inclinationAngle = 5;
    project.loadCases = [project.loadCases[0], project.loadCases[3]];
    const results = runFullDesignCalculation(
      project.ground,
      project.pileSpecs,
      project.pileNodes,
      project.footing,
      project.loadCases,
    );
    const l2 = results.find((result) => result.loadCaseType === 'seismic_l2_t1')!;

    expect(l2.loadDisplacementCurve?.model).toBe('equivalent_secant');
  });

  it('場所打ちRC杭のL2結果に深度方向増分解析を格納する', () => {
    const project = structuredClone(defaultProject);
    const results = runFullDesignCalculation(
      project.ground,
      project.pileSpecs,
      project.pileNodes,
      project.footing,
      project.loadCases,
    );
    const normal = results.find((result) => result.loadCaseType === 'normal')!;
    const l2 = results.find((result) => result.loadCaseType === 'seismic_l2_t1')!;

    expect(normal.momentCurvatureChecks).toEqual([]);
    expect(l2.momentCurvatureChecks).toHaveLength(project.pileNodes.length);
    expect(l2.momentCurvatureChecks.every((check) => check.converged)).toBe(true);
    expect(l2.loadDisplacementCurve?.model).toBe('incremental_winkler');
    expect(l2.momentCurvatureChecks[0].axialForceForCurve).toBe(l2.pileReactions[0].axialForceP);
    expect(l2.momentCurvatureChecks[0].axialForceForCurve).not.toBe(normal.pileReactions[0].axialForceP);
    expect(l2.momentCurvatureChecks[0].effectiveStiffnessRatio).toBeLessThanOrEqual(1);
    expect(l2.loadDisplacementCurve?.points).toHaveLength(16);
    expect(l2.pileDepthProfiles.p1).toHaveLength(21);
    expect(l2.pileDepthProfiles.p1.some((point) => point.curvaturePhi !== undefined)).toBe(true);
    expect(l2.pileDepthProfiles.p1.some((point) => point.soilReactionLimit !== undefined)).toBe(true);
    if (l2.loadDisplacementCurve!.yieldCheck.yieldLoadFactor > 1.5) {
      expect(l2.loadDisplacementCurve!.yieldCheck.yieldDisplacement).toBeGreaterThan(
        l2.loadDisplacementCurve!.points.at(-1)!.displacement,
      );
    }
    expect(l2.loadDisplacementCurve!.designDisplacement).toBeGreaterThanOrEqual(
      Math.abs(l2.footingDisplacement.deltaX),
    );
    for (let index = 1; index < l2.loadDisplacementCurve!.points.length; index++) {
      expect(l2.loadDisplacementCurve!.points[index].horizontalLoad).toBeGreaterThan(
        l2.loadDisplacementCurve!.points[index - 1].horizontalLoad,
      );
      expect(l2.loadDisplacementCurve!.points[index].displacement).toBeGreaterThan(
        l2.loadDisplacementCurve!.points[index - 1].displacement,
      );
    }
  });

  it('L2応答がM-φ終局点を超えると全体判定をNGにする', () => {
    const project = structuredClone(defaultProject);
    const l2Load = project.loadCases.find((loadCase) => loadCase.type === 'seismic_l2_t1')!;
    l2Load.horizontalForceH = 200_000;
    l2Load.momentM = 2_000_000;

    const results = runFullDesignCalculation(
      project.ground,
      project.pileSpecs,
      project.pileNodes,
      project.footing,
      project.loadCases,
    );
    const l2 = results.find((result) => result.loadCaseType === 'seismic_l2_t1')!;

    expect(l2.momentCurvatureChecks.some((check) => !check.isWithinUltimate)).toBe(true);
    expect(l2.loadDisplacementCurve?.yieldCheck.hasYieldedAtDesignLoad).toBe(true);
    expect(l2.loadDisplacementCurve?.yieldCheck.isWithinUltimateAtDesignLoad).toBe(false);
    expect(l2.isStable).toBe(false);
  });

  it('底版詳細照査を全荷重ケースに作成する', () => {
    const project = structuredClone(defaultProject);
    const results = runFullDesignCalculation(
      project.ground,
      project.pileSpecs,
      project.pileNodes,
      project.footing,
      project.loadCases,
    );

    expect(results.every((result) => result.footingCheck.directions.length === 2)).toBe(true);
    expect(results.every((result) => result.footingCheck.punching.capacity > 0)).toBe(true);
  });

  it('薄い底版・疎な配筋は底版照査をNGにする', () => {
    const project = structuredClone(defaultProject);
    project.footing.thickness = 0.5;
    project.footing.topRebarSpacingX = 1000;
    project.footing.bottomRebarSpacingX = 1000;
    project.footing.topRebarSpacingY = 1000;
    project.footing.bottomRebarSpacingY = 1000;
    const results = runFullDesignCalculation(
      project.ground,
      project.pileSpecs,
      project.pileNodes,
      project.footing,
      project.loadCases,
    );

    expect(results.some((result) => !result.footingCheck.isPass)).toBe(true);
  });
});
