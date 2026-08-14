// 作用荷重ケースおよび設計条件の型定義

export type LoadCaseType = 
  | 'normal'        // 常時 (D + L)
  | 'wind'          // 風時 (D + W)
  | 'temperature'   // 温度変化時 (D + T)
  | 'seismic_l1'    // 地震時 レベル1 (D + EQ1)
  | 'seismic_l2_t1' // 地震時 レベル2 タイプI (D + EQ2-I)
  | 'seismic_l2_t2' // 地震時 レベル2 タイプII (D + EQ2-II)
  | 'custom';       // 任意ケース

export interface LoadCase {
  id: string;
  name: string;
  type: LoadCaseType;
  verticalForceV: number;   // 鉛直力 V (kN) - フーチング上面または底面作用
  horizontalForceH: number; // 水平力 H (kN)
  momentM: number;          // 作用モーメント M (kN·m) - フーチング底面中心回り
  loadPositionZ?: number;   // 水平力作用高さ (m, フーチング底面基準)
  allowableStressFactor: number; // 許容応力度割増係数 (常時:1.0, 風時:1.25, L1地震時:1.50, L2:極限)
  safetyFactorBearing: number;   // 支持力安全係数 (常時:3.0, 風時:2.5, L1地震時:2.0, L2:1.0)
  safetyFactorPullout: number;   // 引抜き安全係数 (常時:6.0, 地震時:3.0)
  allowableDisplacement: number; // 許容水平変位 (mm, 通常 常時:15mm, 地震時:0.025D または 50mm)
}

export interface DesignProject {
  id: string;
  title: string;
  bridgeName: string;
  location: string;
  author: string;
  date: string;
  notes: string;
  standard: 'H24_DOUJI' | 'R01_DOUJI'; // 準拠示方書 (平成24年版 または 令和元年版)
}
