// 杭仕様および杭配置の型定義

export type PileType = 
  | 'cast_in_place_rc'  // 場所打ち杭 (RC)
  | 'steel_pipe'        // 鋼管杭
  | 'phc'               // PHC杭 (高強度プレストレストコンクリート杭)
  | 'sc'                // SC杭 (外殻鋼管付きコンクリート杭)
  | 'steel_soil_cement' // 鋼管ソイルセメント杭
  | 'h_beam'            // H形鋼杭
  | 'rotary_steel';     // 回転杭工法

export type PileMethod =
  | 'cast_in_place'     // 場所打ち杭工法 (オールケーシング/リバース/アースドリル)
  | 'driven_hammer'     // 打込み杭工法 (打撃/油圧ハンマ)
  | 'driven_vibro'      // 打込み杭工法 (バイブロハンマ)
  | 'inner_excavation'  // 中掘り杭工法 (セメントミルク攪拌方式/最終打撃)
  | 'pre_boring'        // プレボーリング杭工法
  | 'soil_cement'       // 鋼管ソイルセメント杭工法
  | 'rotary';           // 回転圧入工法

export type PileBearingType =
  | 'end_bearing'       // 支持杭
  | 'friction'          // 摩擦杭
  | 'semi_end_bearing'; // 支持杭と同等な安全率を有する摩擦杭

export type PileHeadJointType =
  | 'rigid'             // 剛結 (結合方法A または 結合方法B)
  | 'hinge'             // ヒンジ結合
  | 'semi_rigid';       // 弾性バネ結合

export interface PileSpecification {
  id: string;
  pileType: PileType;
  method: PileMethod;
  bearingType: PileBearingType;
  diameter: number;         // 杭径 D (m, 例: 1.0, 1.2, 1.5)
  length: number;           // 杭長 L (m)
  wallThickness?: number;   // 鋼管肉厚 t (mm, 鋼管杭用)
  corrosionAllowance?: number; // 腐食代 (mm, 鋼管杭用, 例: 1.0mm)
  modulusE: number;         // ヤング係数 E (kN/m², 例: RC=2.5e7, 鋼材=2.0e8)
  momentOfInertiaI: number; // 断面二次モーメント I (m⁴)
  crossSectionAreaA: number;// 断面積 A (m²)
  concreteStrengthFck?: number; // 設計基準強度 σck (N/mm², 例: 24, 30)
  rebarType?: string;       // 主鉄筋種類 (SD345, SD390, SD490)
  rebarDiameter?: number;   // 主鉄筋径 D (mm, 例: 25, 29, 32)
  rebarCount?: number;      // 主鉄筋本数
  rebarCover?: number;      // かぶり厚 (mm, 例: 100)
  stirrupDiameter?: number; // 帯鉄筋径 (mm, 例: 13, 16)
  stirrupPitch?: number;    // 帯鉄筋ピッチ (mm, 例: 150)
  allowableCompressiveStress?: number; // 許容圧縮応力度 (N/mm²)
  allowableTensileStress?: number;     // 許容引張鉄筋応力度 (N/mm²)
  allowableShearStress?: number;       // 許容せん断応力度 (N/mm²)
}

export interface PileNode {
  id: string;
  rowIndex: number;     // 行番号 (Y方向)
  colIndex: number;     // 列番号 (X方向)
  x: number;            // フーチング重心からのX座標 (m, 橋軸方向または直角方向)
  y: number;            // フーチング重心からのY座標 (m)
  inclinationAngle: number; // 傾斜角 θ (deg, 0:鉛直, 正:外開き/傾斜)
  isOmitted?: boolean;  // 中抜きフラグ
  pileSpecId: string;   // 適用する杭仕様ID
}

export interface FootingDimension {
  lengthX: number;      // フーチング長さ Lx (m)
  lengthY: number;      // フーチング幅 Ly (m)
  thickness: number;    // フーチング厚 Df (m)
  depthGL: number;      // フーチング底面深さ GL-m (杭頭位置)
  embedmentDepth: number; // 根入れ深さ (m)
  concreteStrengthFck: number; // フーチングコンクリート強度 (N/mm²)
  unitWeightConcrete: number; // 単位体積重量 (kN/m³, 通常 24.5)
}
