import { describe, expect, it } from 'vitest';
import { calculateAllowableCapacity, calculateBearingCapacity } from './bearingCapacity';
import { runFullDesignCalculation } from './index';
import { checkPileHeadJoint } from './pileHeadCheck';
import { checkPileSectionStress } from './sectionCheck';
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
    const expectedWeight = spec.crossSectionAreaA * spec.length * 78.5;

    expect(capacity.pileWeightWp).toBeCloseTo(expectedWeight, 1);
    expect(capacity.pileWeightWp).toBeLessThan(100);
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
});
