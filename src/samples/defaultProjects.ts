import { GroundCondition } from '../types/soil';
import { PileSpecification, PileNode, FootingDimension } from '../types/pile';
import { LoadCase, DesignProject } from '../types/load';

export interface ProjectData {
  project: DesignProject;
  ground: GroundCondition;
  pileSpecs: { [id: string]: PileSpecification };
  pileNodes: PileNode[];
  footing: FootingDimension;
  loadCases: LoadCase[];
}

/**
 * 道路橋示方書 標準橋脚 場所打ち杭基礎 (2列×3行 計6本)
 */
export const defaultProject: ProjectData = {
  project: {
    id: 'sample_pier_01',
    title: '標準道路橋 橋脚杭基礎設計計算例',
    bridgeName: '国道〇〇号 跨線橋 P2橋脚',
    location: '東京都',
    author: '構造設計部',
    date: '2026-08-15',
    notes: '道路橋示方書・同解説 IV下部構造編 / V耐震設計編 準拠',
    standard: 'H24_DOUJI',
  },
  ground: {
    groundWaterLevel: 2.0,
    seismicIntensityL1: 0.20,
    seismicIntensityL2Type1: 0.80,
    seismicIntensityL2Type2: 1.60,
    groundType: 'II',
    characteristicPeriodTg: 0.45,
    layers: [
      {
        id: 'layer-1',
        name: '盛土・表土 (B)',
        depthTop: 0.0,
        depthBottom: 2.0,
        thickness: 2.0,
        soilType: 'sand',
        nValue: 4,
        unitWeight: 17.0,
        unitWeightSat: 18.0,
        internalFrictionAngle: 25,
        isLiquefiable: false,
      },
      {
        id: 'layer-2',
        name: '沖積粘土層 (Ac)',
        depthTop: 2.0,
        depthBottom: 8.0,
        thickness: 6.0,
        soilType: 'clay',
        nValue: 2,
        unitWeight: 15.5,
        unitWeightSat: 16.0,
        cohesion: 20,
        isLiquefiable: false,
      },
      {
        id: 'layer-3',
        name: '沖積砂層 (As: 液状化検討層)',
        depthTop: 8.0,
        depthBottom: 15.0,
        thickness: 7.0,
        soilType: 'sand',
        nValue: 12,
        unitWeight: 18.0,
        unitWeightSat: 19.0,
        internalFrictionAngle: 30,
        fc: 15.0,
        d50: 0.25,
        isLiquefiable: true,
      },
      {
        id: 'layer-4',
        name: '洪積砂礫層 (Dg: 支持層)',
        depthTop: 15.0,
        depthBottom: 30.0,
        thickness: 15.0,
        soilType: 'gravel',
        nValue: 45,
        unitWeight: 20.0,
        unitWeightSat: 21.0,
        internalFrictionAngle: 40,
        isLiquefiable: false,
      },
    ],
  },
  pileSpecs: {
    'spec-rc-1200': {
      id: 'spec-rc-1200',
      pileType: 'cast_in_place_rc',
      method: 'cast_in_place',
      bearingType: 'end_bearing',
      diameter: 1.2,
      length: 18.0,
      modulusE: 2.5e7, // 25,000 N/mm² = 2.5e7 kN/m²
      momentOfInertiaI: (Math.PI * Math.pow(1.2, 4)) / 64, // 0.1018 m⁴
      crossSectionAreaA: (Math.PI * Math.pow(1.2, 2)) / 4, // 1.131 m²
      concreteStrengthFck: 24,
      rebarType: 'SD345',
      rebarDiameter: 29,
      rebarCount: 24,
      rebarCover: 120,
      stirrupDiameter: 16,
      stirrupPitch: 150,
      allowableCompressiveStress: 8.0,
      allowableTensileStress: 180.0,
      allowableShearStress: 0.36,
    },
  },
  footing: {
    lengthX: 7.0,
    lengthY: 9.5,
    thickness: 2.0,
    depthGL: 1.5, // 杭頭天端 GL-1.5m
    embedmentDepth: 1.5,
    concreteStrengthFck: 24,
    unitWeightConcrete: 24.5,
    columnLengthX: 2.0,
    columnLengthY: 2.5,
    rebarYieldStrength: 295,
    topRebarDiameterX: 22,
    topRebarSpacingX: 125,
    bottomRebarDiameterX: 32,
    bottomRebarSpacingX: 125,
    topRebarDiameterY: 32,
    topRebarSpacingY: 125,
    bottomRebarDiameterY: 25,
    bottomRebarSpacingY: 125,
    topRebarCover: 110,
    bottomRebarCover: 150,
    shearRebarDiameter: 16,
    shearRebarSpacing: 250,
    shearRebarLegs: 2,
  },
  pileNodes: [
    // 行1 (Y = -2.5m)
    { id: 'p1', rowIndex: 0, colIndex: 0, x: -1.8, y: -2.5, inclinationAngle: 0, pileSpecId: 'spec-rc-1200' },
    { id: 'p2', rowIndex: 0, colIndex: 1, x: 1.8, y: -2.5, inclinationAngle: 0, pileSpecId: 'spec-rc-1200' },
    // 行2 (Y = 0.0m)
    { id: 'p3', rowIndex: 1, colIndex: 0, x: -1.8, y: 0.0, inclinationAngle: 0, pileSpecId: 'spec-rc-1200' },
    { id: 'p4', rowIndex: 1, colIndex: 1, x: 1.8, y: 0.0, inclinationAngle: 0, pileSpecId: 'spec-rc-1200' },
    // 行3 (Y = +2.5m)
    { id: 'p5', rowIndex: 2, colIndex: 0, x: -1.8, y: 2.5, inclinationAngle: 0, pileSpecId: 'spec-rc-1200' },
    { id: 'p6', rowIndex: 2, colIndex: 1, x: 1.8, y: 2.5, inclinationAngle: 0, pileSpecId: 'spec-rc-1200' },
  ],
  loadCases: [
    {
      id: 'lc-normal',
      name: '常時 (死荷重+活荷重)',
      type: 'normal',
      verticalForceV: 8500, // kN
      horizontalForceH: 450, // kN
      momentM: 1200,         // kN·m
      allowableStressFactor: 1.0,
      safetyFactorBearing: 3.0,
      safetyFactorPullout: 6.0,
      allowableDisplacement: 15.0, // mm
    },
    {
      id: 'lc-wind',
      name: '暴風時 (常時+風荷重)',
      type: 'wind',
      verticalForceV: 8200,
      horizontalForceH: 850,
      momentM: 3200,
      allowableStressFactor: 1.25,
      safetyFactorBearing: 2.5,
      safetyFactorPullout: 4.0,
      allowableDisplacement: 25.0,
    },
    {
      id: 'lc-seismic-l1',
      name: '地震時 レベル1 (L1地震動)',
      type: 'seismic_l1',
      verticalForceV: 8000,
      horizontalForceH: 1800,
      momentM: 8500,
      allowableStressFactor: 1.50,
      safetyFactorBearing: 2.0,
      safetyFactorPullout: 3.0,
      allowableDisplacement: 30.0, // mm (0.025D = 30mm)
    },
    {
      id: 'lc-seismic-l2',
      name: '地震時 レベル2 (Type I極限)',
      type: 'seismic_l2_t1',
      verticalForceV: 7800,
      horizontalForceH: 3400,
      momentM: 16500,
      allowableStressFactor: 2.0,
      safetyFactorBearing: 1.0,
      safetyFactorPullout: 1.5,
      allowableDisplacement: 50.0,
    },
  ],
};

/**
 * kiso-Kui_9を参考にした板厚区分付き鋼管杭基礎サンプル (3列×3行)
 */
export const steelPileSampleProject: ProjectData = {
  ...defaultProject,
  project: {
    ...defaultProject.project,
    id: 'sample_steel_02',
    title: '鋼管杭基礎設計例 (φ1000mm 板厚区分)',
    bridgeName: '臨海大橋 A1橋台杭基礎',
  },
  pileSpecs: {
    'spec-steel-800': {
      id: 'spec-steel-800',
      pileType: 'steel_pipe',
      method: 'inner_excavation',
      bearingType: 'end_bearing',
      diameter: 1.0,
      length: 36.9,
      wallThickness: 17.0,
      corrosionAllowance: 1.0,
      modulusE: 2.0e8, // 200,000 N/mm² = 2.0e8 kN/m²
      momentOfInertiaI: Math.PI * (0.998 ** 4 - 0.966 ** 4) / 64,
      crossSectionAreaA: Math.PI * (0.998 ** 2 - 0.966 ** 2) / 4,
      allowableCompressiveStress: 140.0,
      allowableTensileStress: 140.0,
      allowableShearStress: 80.0,
      steelYieldStrength: 315.0,
      sectionSegments: [
        { id: 'S1', depthTop: 0, depthBottom: 8.9, wallThickness: 17, corrosionAllowance: 1, steelYieldStrength: 315 },
        { id: 'S2', depthTop: 8.9, depthBottom: 36.9, wallThickness: 12, corrosionAllowance: 1, steelYieldStrength: 235 },
      ],
    },
  },
  pileNodes: [
    { id: 'sp1', rowIndex: 0, colIndex: 0, x: -2.0, y: -2.0, inclinationAngle: 0, pileSpecId: 'spec-steel-800' },
    { id: 'sp2', rowIndex: 0, colIndex: 1, x: 0.0, y: -2.0, inclinationAngle: 0, pileSpecId: 'spec-steel-800' },
    { id: 'sp3', rowIndex: 0, colIndex: 2, x: 2.0, y: -2.0, inclinationAngle: 0, pileSpecId: 'spec-steel-800' },
    { id: 'sp4', rowIndex: 1, colIndex: 0, x: -2.0, y: 0.0, inclinationAngle: 0, pileSpecId: 'spec-steel-800' },
    { id: 'sp5', rowIndex: 1, colIndex: 1, x: 0.0, y: 0.0, inclinationAngle: 0, pileSpecId: 'spec-steel-800' },
    { id: 'sp6', rowIndex: 1, colIndex: 2, x: 2.0, y: 0.0, inclinationAngle: 0, pileSpecId: 'spec-steel-800' },
    { id: 'sp7', rowIndex: 2, colIndex: 0, x: -2.0, y: 2.0, inclinationAngle: 0, pileSpecId: 'spec-steel-800' },
    { id: 'sp8', rowIndex: 2, colIndex: 1, x: 0.0, y: 2.0, inclinationAngle: 0, pileSpecId: 'spec-steel-800' },
    { id: 'sp9', rowIndex: 2, colIndex: 2, x: 2.0, y: 2.0, inclinationAngle: 0, pileSpecId: 'spec-steel-800' },
  ],
};
