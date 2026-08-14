// 計算および照査結果の型定義

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
}

export interface BearingCapacityResult {
  pileSpecId: string;
  qd: number;           // 先端極限支持力度 qd (kN/m²)
  ap: number;           // 杭先端面積 Ap (m²)
  qp: number;           // 先端極限支持力 Qp = qd * Ap (kN)
  qs: number;           // 周面摩擦極限支持力 Qs = U * Σ(fi * Li) (kN)
  ru: number;           // 押込み極限支持力 Ru = Qp + Qs (kN)
  raNormal: number;     // 常時許容押込み力 (kN, Ru/3)
  raSeismic: number;    // 地震時許容押込み力 (kN, Ru/2)
  rpaNormal: number;    // 常時許容引抜き力 (kN, (1/3)*Wp + (1/6)*Qs)
  rpaSeismic: number;   // 地震時許容引抜き力 (kN, Wp + (1/3)*Qs)
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

export interface CalculationResult {
  loadCaseId: string;
  loadCaseName: string;
  springMatrix: PileHeadSpringMatrix;
  footingDisplacement: FootingDisplacement;
  pileReactions: PileHeadReaction[];
  pileDepthProfiles: { [pileNodeId: string]: PileDepthStressPoint[] };
  bearingCapacity: BearingCapacityResult;
  sectionChecks: SectionStressCheckResult[];
  jointChecks: PileHeadJointCheckResult[];
  maxDisplacementMm: number;
  maxAxialCompressionKn: number;
  maxAxialTensionKn: number;
  isStable: boolean;
}
