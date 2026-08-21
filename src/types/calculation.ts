// 計算および照査結果の型定義
import type { LoadCaseType } from './load';

export interface PileHeadSpringMatrix {
  k1: number; // 水平変位による水平力 K1 (kN/m)
  k2: number; // 回転角による水平力 (水平変位によるモーメント) K2 (kN/rad = kN·m/m)
  k3: number; // 水平変位によるモーメント K3 (kN·m/m) [通常 K3 = K2]
  k4: number; // 回転角によるモーメント K4 (kN·m/rad)
  kv: number; // 杭の軸方向バネ定数 Kv (kN/m)
  beta: number; // 杭の特性値 β (m⁻¹)
  kh: number;   // 平均横方向地盤反力係数 kH (kN/m³)
}

export interface FootingDisplacement {
  deltaX: number; // 水平変位 δx (m または mm)
  deltaY: number; // 鉛直変位 δy (m または mm)
  alpha: number;  // 回転角 α (rad)
}

export interface PileHeadReaction {
  pileNodeId: string;
  index: number;
  x: number;
  y: number;
  axialForceP: number;      // 杭頭軸力 P (kN, 圧縮正, 引抜負)
  shearForceH: number;      // 杭頭水平力 H (kN)
  bendingMomentM: number;   // 杭頭曲げモーメント M (kN·m)
  displacementDelta: number;// 杭頭水平変位 (mm)
  rotationAngleRad: number; // 杭頭回転角 (rad)
}

export interface PileDepthStressPoint {
  depthZ: number;       // 杭頭からの深度 z (m)
  groundDepthGL: number;// GL基準の深度 (m)
  deflectionY: number;  // 水平変位 y (mm)
  rotationTheta: number;// 傾角 θ (rad)
  momentM: number;      // 曲げモーメント M (kN·m)
  shearForceS: number;  // せん断力 S (kN)
  soilReactionP: number;// 地盤反力度 p (kN/m)
  curvaturePhi?: number; // 曲率 φ (1/m)
  sectionState?: MomentCurvatureState; // 杭体状態
  effectiveStiffnessRatio?: number; // 区間割線EI / 初期EI
  soilReactionLimit?: number; // 地盤反力上限 pHU (kN/m)
  soilYieldRatio?: number; // |p| / pHU
}

export interface BearingCapacityResult {
  pileSpecId: string;
  qd: number;           // 先端極限支持力度 qd (kN/m²)
  ap: number;           // 杭先端面積 Ap (m²)
  qp: number;           // 先端極限支持力 Qp = qd * Ap (kN)
  qs: number;           // 周面摩擦極限支持力 Qs = U * Σ(fi * Li) (kN)
  ru: number;           // 押込み極限支持力 Ru = Qp + Qs (kN)
  raNormal: number;     // 常時許容押込み力 (kN, 支持杭 Ru/3・摩擦杭 Ru/4)
  raSeismic: number;    // 暴風時・L1地震時許容押込み力 (kN, 支持杭 Ru/2・摩擦杭 Ru/3)
  rpaNormal: number;    // 常時許容引抜き力 (kN, Wp + Qs/6)
  rpaSeismic: number;   // 暴風時・L1地震時許容引抜き力 (kN, Wp + Qs/3)
  kv: number;           // 軸方向反力係数 Kv (kN/m)
  pileWeightWp: number; // 杭自重 Wp (kN)
}

export interface SectionStressCheckResult {
  loadCaseId: string;
  loadCaseName: string;
  pileNodeId: string;
  maxMomentM: number;       // 最大曲げモーメント Mmax (kN·m)
  maxMomentDepthZ: number;  // Mmax発生位置 (m)
  axialForceN: number;      // 連動軸力 N (kN)
  maxShearForceS: number;   // 最大せん断力 Smax (kN)
  
  // 応力度照査 (場所打ちRC杭)
  compressiveStressC?: number;     // コンクリート曲げ圧縮応力度 σc (N/mm²)
  allowableCompressiveStressC?: number; // 許容コンクリート曲げ圧縮応力度 σca (N/mm²)
  tensileStressS?: number;         // 引張鉄筋応力度 σs (N/mm²)
  allowableTensileStressS?: number;// 許容引張鉄筋応力度 σsa (N/mm²)
  shearStressTau?: number;         // コンクリートせん断応力度 τ (N/mm²)
  allowableShearStressTau?: number;// 許容せん断応力度 τa (N/mm²)
  
  // 鋼管杭用
  steelStressSigma?: number;       // 鋼材合成応力度 σ (N/mm²)
  allowableSteelStressSigma?: number; // 許容鋼材応力度 (N/mm²)
  steelShearStressTau?: number;    // 鋼材せん断応力度 τ (N/mm²)
  allowableSteelShearStressTau?: number;

  isPass: boolean;
  notes: string[];
}

export interface PileHeadJointCheckResult {
  loadCaseId: string;
  pileNodeId: string;
  punchingShearStress: number;     // 押抜きせん断応力度 τp (N/mm²)
  allowablePunchingShear: number;  // 許容押抜きせん断応力度 (N/mm²)
  bearingStress: number;           // コンクリート支圧応力度 σb (N/mm²)
  allowableBearingStress: number;  // 許容支圧応力度 (N/mm²)
  virtualRcStressRatio: number;    // 仮想RC断面応力比
  isPass: boolean;
}

export interface PileCapacityCheckResult {
  pileNodeId: string;
  pileSpecId: string;
  axialForceP: number;
  allowableBearing: number;
  allowablePullout: number;
  isBearingOk: boolean;
  isPulloutOk: boolean;
}

export type MomentCurvatureState =
  | 'elastic'
  | 'cracked'
  | 'yielded'
  | 'ultimate_exceeded';

export interface MomentCurvaturePoint {
  label: 'O' | 'C' | 'Y' | 'U' | 'P';
  moment: number;       // 曲げモーメント M (kN·m)
  curvature: number;    // 曲率 φ (1/m)
  secantEI: number;     // 原点からの割線剛性 M/φ (kN·m²)
}

export interface MomentCurvatureCheckResult {
  pileNodeId: string;
  pileSpecId: string;
  modelType: 'trilinear' | 'bilinear';
  axialForceForCurve: number; // M-φ骨格算定に用いた死荷重時軸力 (kN)
  points: MomentCurvaturePoint[];
  demandMoment: number;       // 最大応答曲げモーメントの絶対値 (kN·m)
  demandCurvature: number;    // M-φ骨格から逆算した応答曲率 (1/m)
  ductilityRatio: number;     // φd / φy
  effectiveFlexuralRigidity: number; // 応答点の割線EI (kN·m²)
  effectiveStiffnessRatio: number;    // EIeff / EI0
  effectiveBeta: number;      // 割線EIで更新した杭特性値 β (1/m)
  state: MomentCurvatureState;
  iterations: number;
  converged: boolean;
  isWithinUltimate: boolean;
  notes: string[];
}

export interface LoadDisplacementPoint {
  loadFactor: number;
  horizontalLoad: number; // kN
  overturningMoment: number; // kN·m
  displacement: number; // mm
  equivalentStiffnessRatio: number;
  state: MomentCurvatureState;
  rotationAngle?: number; // 底版回転角 (rad)
  maxMoment?: number; // 全杭中の最大曲げモーメント (kN·m)
  maxMomentDepth?: number; // 最大曲げモーメント深度 (m)
  governingPileNodeId?: string;
  soilYieldRatio?: number; // 最大地盤反力比
  iterations?: number;
  converged?: boolean;
}

export interface YieldCheckResult {
  governingPileNodeId: string;
  yieldMoment: number; // kN·m
  designMoment: number; // kN·m
  yieldLoadFactor: number;
  yieldHorizontalLoad: number; // kN
  yieldDisplacement: number; // mm
  ultimateLoadFactor: number;
  hasYieldedAtDesignLoad: boolean;
  isWithinUltimateAtDesignLoad: boolean;
  state: MomentCurvatureState;
}

export interface LoadDisplacementCurveResult {
  model: 'equivalent_secant' | 'incremental_winkler';
  points: LoadDisplacementPoint[];
  designDisplacement: number;
  yieldCheck: YieldCheckResult;
  notes: string[];
}

export interface FootingDirectionCheckResult {
  direction: 'X' | 'Y';
  effectiveWidth: number; // m
  effectiveDepthBottom: number; // mm
  effectiveDepthTop: number; // mm
  positiveMoment: number; // kN·m/m, 下側引張
  negativeMoment: number; // kN·m/m, 上側引張
  bottomRebarArea: number; // mm²/m
  topRebarArea: number; // mm²/m
  requiredBottomRebarArea: number; // mm²/m
  requiredTopRebarArea: number; // mm²/m
  positiveMomentCapacity: number; // kN·m/m
  negativeMomentCapacity: number; // kN·m/m
  flexureUtilization: number;
  designShear: number; // kN/m
  concreteShearCapacity: number; // kN/m
  shearRebarCapacity: number; // kN/m
  shearCapacity: number; // kN/m
  shearUtilization: number;
  isFlexurePass: boolean;
  isShearPass: boolean;
}

export interface FootingPunchingCheckResult {
  criticalPerimeter: number; // m
  effectiveDepth: number; // mm
  designShear: number; // kN
  capacity: number; // kN
  utilization: number;
  isPass: boolean;
}

export interface FootingCheckResult {
  loadCaseId: string;
  directions: FootingDirectionCheckResult[];
  punching: FootingPunchingCheckResult;
  isPass: boolean;
  notes: string[];
}

export interface CalculationResult {
  loadCaseId: string;
  loadCaseName: string;
  loadCaseType: LoadCaseType;
  springMatrix: PileHeadSpringMatrix;
  footingDisplacement: FootingDisplacement;
  pileReactions: PileHeadReaction[];
  pileDepthProfiles: { [pileNodeId: string]: PileDepthStressPoint[] };
  bearingCapacity: BearingCapacityResult;
  sectionChecks: SectionStressCheckResult[];
  jointChecks: PileHeadJointCheckResult[];
  momentCurvatureChecks: MomentCurvatureCheckResult[];
  loadDisplacementCurve?: LoadDisplacementCurveResult;
  footingCheck: FootingCheckResult;
  pileCapacityChecks: PileCapacityCheckResult[];
  allowableBearingKn: number;
  allowablePulloutKn: number;
  allowableDisplacementMm: number;
  maxDisplacementMm: number;
  maxAxialCompressionKn: number;
  maxAxialTensionKn: number;
  isStable: boolean;
}
