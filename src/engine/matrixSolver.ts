import { PileNode, PileSpecification, FootingDimension } from '../types/pile';
import { PileHeadSpringMatrix, FootingDisplacement, PileHeadReaction } from '../types/calculation';
import { LoadCase } from '../types/load';

/**
 * 変位法による杭基礎全体の安定計算 (剛体フーチングモデル)
 * 道路橋示方書・同解説 IV 下部構造編 第5章 杭基礎 準拠
 */

export interface MatrixSolveResult {
  displacement: FootingDisplacement;
  reactions: PileHeadReaction[];
}

/**
 * 3x3 連立一次方程式 A * x = B をガウスの消去法 (LU分解/クラメルの公式) で求解
 */
function solve3x3(A: number[][], B: number[]): number[] {
  const det =
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);

  if (Math.abs(det) < 1e-12) {
    throw new Error('基礎の剛性マトリックスが特異行列です（杭本数またはバネ定数が不足しています）');
  }

  const detX0 =
    B[0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (B[1] * A[2][2] - A[1][2] * B[2]) +
    A[0][2] * (B[1] * A[2][1] - A[1][1] * B[2]);

  const detX1 =
    A[0][0] * (B[1] * A[2][2] - A[1][2] * B[2]) -
    B[0] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * B[2] - B[1] * A[2][0]);

  const detX2 =
    A[0][0] * (A[1][1] * B[2] - B[1] * A[2][1]) -
    A[0][1] * (A[1][0] * B[2] - B[1] * A[2][0]) +
    B[0] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);

  return [detX0 / det, detX1 / det, detX2 / det];
}

/**
 * 杭基礎全体変位法解析
 */
export function solvePileGroupDisplacement(
  pileNodes: PileNode[],
  pileSpecs: { [id: string]: PileSpecification },
  springsMap: { [specId: string]: PileHeadSpringMatrix },
  footing: FootingDimension,
  loadCase: LoadCase
): MatrixSolveResult {
  // 中抜きされていない有効な杭を抽出
  const activePiles = pileNodes.filter((p) => !p.isOmitted);
  if (activePiles.length === 0) {
    throw new Error('有効な杭が配置されていません');
  }

  // 3x3 剛性マトリックス A の初期化
  const A = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  // 外力ベクトル B = [H0, V0, M0] (フーチング底面中心回り)
  // 水平力 H0, 鉛直力 V0 (自重含む), モーメント M0
  const footingVolume = footing.lengthX * footing.lengthY * footing.thickness;
  const footingWeight = footingVolume * footing.unitWeightConcrete;
  
  const V0 = loadCase.verticalForceV + footingWeight;
  const H0 = loadCase.horizontalForceH;
  const M0 = loadCase.momentM; // フーチング底面中心回りのモーメント

  const B = [H0, V0, M0];

  // 各杭の剛性寄与をマトリックスに重畳
  for (const pile of activePiles) {
    const spring = springsMap[pile.pileSpecId];
    if (!spring) continue;

    const { k1, k2, k3, k4, kv } = spring;
    const xi = pile.x; // フーチング重心からの水平距離 (m)
    const thetaRad = (pile.inclinationAngle * Math.PI) / 180; // 傾斜角 (rad)
    const cosT = Math.cos(thetaRad);
    const sinT = Math.sin(thetaRad);

    // 杭軸直角・平行方向の座標変換を考慮した剛性項 (道示IV)
    // 鉛直杭(theta=0)の場合: cosT=1, sinT=0
    // Kxx = K1 * cos²θ + Kv * sin²θ
    // Kyy = Kv * cos²θ + K1 * sin²θ
    // Kxy = (Kv - K1) * sinθ * cosθ
    const Kxx = k1 * cosT * cosT + kv * sinT * sinT;
    const Kyy = kv * cosT * cosT + k1 * sinT * sinT;
    const Kxy = (kv - k1) * sinT * cosT;

    // フーチング底面と杭頭の剛性マトリックス足し合わせ
    // 行0: 水平力釣り合い (δx, δy, α)
    A[0][0] += Kxx;
    A[0][1] += Kxy;
    A[0][2] += Kxy * xi - k2 * cosT;

    // 行1: 鉛直力釣り合い
    A[1][0] += Kxy;
    A[1][1] += Kyy;
    A[1][2] += Kyy * xi - k2 * sinT;

    // 行2: モーメント釣り合い
    A[2][0] += Kxy * xi - k3 * cosT;
    A[2][1] += Kyy * xi - k3 * sinT;
    A[2][2] += Kyy * xi * xi - 2 * k2 * xi * sinT + k4;
  }

  // 連立方程式の求解 [δx (m), δy (m), α (rad)]
  const [deltaX_m, deltaY_m, alpha_rad] = solve3x3(A, B);

  // 各杭の頭部反力・変位の算定
  const reactions: PileHeadReaction[] = activePiles.map((pile, index) => {
    const spring = springsMap[pile.pileSpecId];
    const { k1, k2, k3, k4, kv } = spring;
    const xi = pile.x;
    const thetaRad = (pile.inclinationAngle * Math.PI) / 180;
    const cosT = Math.cos(thetaRad);
    const sinT = Math.sin(thetaRad);

    // 杭頭での変位成分 (基礎座標系)
    const ux = deltaX_m - 0 * alpha_rad;
    const uy = deltaY_m + xi * alpha_rad;
    const rot = alpha_rad;

    // 杭軸座標系への変換
    // 杭軸方向変位 v_axial = ux * sinθ + uy * cosθ
    // 杭直角方向変位 u_trans = ux * cosθ - uy * sinθ
    const v_axial = ux * sinT + uy * cosT;
    const u_trans = ux * cosT - uy * sinT;

    // 杭頭反力 (圧縮正, 引抜負)
    const P = kv * v_axial;
    const H = k1 * u_trans - k2 * rot;
    const M = -k3 * u_trans + k4 * rot;

    return {
      pileNodeId: pile.id,
      index: index + 1,
      x: pile.x,
      y: pile.y,
      axialForceP: parseFloat(P.toFixed(1)),
      shearForceH: parseFloat(H.toFixed(1)),
      bendingMomentM: parseFloat(M.toFixed(1)),
      displacementDelta: parseFloat((u_trans * 1000).toFixed(2)), // mm
      rotationAngleRad: parseFloat(rot.toFixed(6)),
    };
  });

  return {
    displacement: {
      deltaX: parseFloat((deltaX_m * 1000).toFixed(2)), // mm
      deltaY: parseFloat((deltaY_m * 1000).toFixed(2)), // mm
      alpha: parseFloat(alpha_rad.toFixed(6)),          // rad
    },
    reactions,
  };
}
