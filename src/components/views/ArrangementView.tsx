import React, { useState } from 'react';
import { PileNode, PileSpecification, FootingDimension } from '../../types/pile';
import { PileArrangementCanvas } from '../graphics/PileArrangementCanvas';
import { Grid, Sliders, RefreshCw } from 'lucide-react';

interface ArrangementViewProps {
  footing: FootingDimension;
  onChangeFooting: (footing: FootingDimension) => void;
  pileNodes: PileNode[];
  onChangePileNodes: (nodes: PileNode[]) => void;
  pileSpecs: { [id: string]: PileSpecification };
}

const FootingNumberField: React.FC<{
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}> = ({ label, value, step = 1, onChange }) => (
  <div>
    <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
    <input
      type="number"
      min="0"
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
    />
  </div>
);

export const ArrangementView: React.FC<ArrangementViewProps> = ({
  footing,
  onChangeFooting,
  pileNodes,
  onChangePileNodes,
  pileSpecs,
}) => {
  const [gridCols, setGridCols] = useState<number>(2);
  const [gridRows, setGridRows] = useState<number>(3);
  const [spacingX, setSpacingX] = useState<number>(3.6);
  const [spacingY, setSpacingY] = useState<number>(2.5);

  const handleRegenerateGrid = () => {
    const newNodes: PileNode[] = [];
    const specId = Object.keys(pileSpecs)[0];

    const startX = -((gridCols - 1) * spacingX) / 2.0;
    const startY = -((gridRows - 1) * spacingY) / 2.0;

    let idCount = 1;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        newNodes.push({
          id: `p${idCount}`,
          rowIndex: r,
          colIndex: c,
          x: parseFloat((startX + c * spacingX).toFixed(2)),
          y: parseFloat((startY + r * spacingY).toFixed(2)),
          inclinationAngle: 0,
          pileSpecId: specId,
        });
        idCount++;
      }
    }

    const autoLx = Math.max(4.0, (gridCols - 1) * spacingX + 3.0);
    const autoLy = Math.max(4.0, (gridRows - 1) * spacingY + 3.0);

    onChangeFooting({
      ...footing,
      lengthX: parseFloat(autoLx.toFixed(1)),
      lengthY: parseFloat(autoLy.toFixed(1)),
    });

    onChangePileNodes(newNodes);
  };

  const handleUpdateNode = (id: string, updated: Partial<PileNode>) => {
    onChangePileNodes(
      pileNodes.map((n) => (n.id === id ? { ...n, ...updated } : n))
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4">
      {/* 左側：フーチング寸法 & 杭配置設定 (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        {/* フーチング寸法カード */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            フーチング（底版）寸法・諸元
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">底版幅 Lx (m)</label>
              <input
                type="number"
                step="0.5"
                value={footing.lengthX}
                onChange={(e) => onChangeFooting({ ...footing, lengthX: parseFloat(e.target.value) || 5.0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-blue-700 font-bold font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">底版長 Ly (m)</label>
              <input
                type="number"
                step="0.5"
                value={footing.lengthY}
                onChange={(e) => onChangeFooting({ ...footing, lengthY: parseFloat(e.target.value) || 5.0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-blue-700 font-bold font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">底版厚 Df (m)</label>
              <input
                type="number"
                step="0.2"
                value={footing.thickness}
                onChange={(e) => onChangeFooting({ ...footing, thickness: parseFloat(e.target.value) || 2.0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">底版天端 GL-m</label>
              <input
                type="number"
                step="0.1"
                value={footing.depthGL}
                onChange={(e) => onChangeFooting({ ...footing, depthGL: parseFloat(e.target.value) || 1.5 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <h4 className="mb-3 text-sm font-black text-slate-800">底版詳細照査条件</h4>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              <FootingNumberField label="柱幅 X (m)" value={footing.columnLengthX ?? 2} step={0.1} onChange={(value) => onChangeFooting({ ...footing, columnLengthX: value })} />
              <FootingNumberField label="柱幅 Y (m)" value={footing.columnLengthY ?? 2} step={0.1} onChange={(value) => onChangeFooting({ ...footing, columnLengthY: value })} />
              <FootingNumberField label="鉄筋降伏強度 (N/mm²)" value={footing.rebarYieldStrength ?? 295} onChange={(value) => onChangeFooting({ ...footing, rebarYieldStrength: value })} />
              <FootingNumberField label="上側かぶり (mm)" value={footing.topRebarCover ?? 110} onChange={(value) => onChangeFooting({ ...footing, topRebarCover: value })} />
              <FootingNumberField label="下側かぶり (mm)" value={footing.bottomRebarCover ?? 150} onChange={(value) => onChangeFooting({ ...footing, bottomRebarCover: value })} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <FootingNumberField label="X上側 鉄筋径 (mm)" value={footing.topRebarDiameterX ?? 22} onChange={(value) => onChangeFooting({ ...footing, topRebarDiameterX: value })} />
              <FootingNumberField label="X上側 ピッチ (mm)" value={footing.topRebarSpacingX ?? 125} onChange={(value) => onChangeFooting({ ...footing, topRebarSpacingX: value })} />
              <FootingNumberField label="X下側 鉄筋径 (mm)" value={footing.bottomRebarDiameterX ?? 32} onChange={(value) => onChangeFooting({ ...footing, bottomRebarDiameterX: value })} />
              <FootingNumberField label="X下側 ピッチ (mm)" value={footing.bottomRebarSpacingX ?? 125} onChange={(value) => onChangeFooting({ ...footing, bottomRebarSpacingX: value })} />
              <FootingNumberField label="Y上側 鉄筋径 (mm)" value={footing.topRebarDiameterY ?? 32} onChange={(value) => onChangeFooting({ ...footing, topRebarDiameterY: value })} />
              <FootingNumberField label="Y上側 ピッチ (mm)" value={footing.topRebarSpacingY ?? 125} onChange={(value) => onChangeFooting({ ...footing, topRebarSpacingY: value })} />
              <FootingNumberField label="Y下側 鉄筋径 (mm)" value={footing.bottomRebarDiameterY ?? 25} onChange={(value) => onChangeFooting({ ...footing, bottomRebarDiameterY: value })} />
              <FootingNumberField label="Y下側 ピッチ (mm)" value={footing.bottomRebarSpacingY ?? 125} onChange={(value) => onChangeFooting({ ...footing, bottomRebarSpacingY: value })} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <FootingNumberField label="斜引張鉄筋径 (mm)" value={footing.shearRebarDiameter ?? 16} onChange={(value) => onChangeFooting({ ...footing, shearRebarDiameter: value })} />
              <FootingNumberField label="斜引張鉄筋間隔 (mm)" value={footing.shearRebarSpacing ?? 250} onChange={(value) => onChangeFooting({ ...footing, shearRebarSpacing: value })} />
              <FootingNumberField label="有効脚数 (/m)" value={footing.shearRebarLegs ?? 2} onChange={(value) => onChangeFooting({ ...footing, shearRebarLegs: value })} />
            </div>
          </div>
        </div>

        {/* 杭配置グリッド一括生成カード */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Grid className="w-4 h-4 text-emerald-600" />
              杭配置グリッドの自動生成
            </h3>
            <button
              onClick={handleRegenerateGrid}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              グリッド再配置
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">X方向 列数 (Cols)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={gridCols}
                onChange={(e) => setGridCols(parseInt(e.target.value) || 2)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Y方向 行数 (Rows)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={gridRows}
                onChange={(e) => setGridRows(parseInt(e.target.value) || 3)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">X間隔 (m)</label>
              <input
                type="number"
                step="0.1"
                value={spacingX}
                onChange={(e) => setSpacingX(parseFloat(e.target.value) || 3.0)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Y間隔 (m)</label>
              <input
                type="number"
                step="0.1"
                value={spacingY}
                onChange={(e) => setSpacingY(parseFloat(e.target.value) || 2.5)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 杭個体一覧テーブル */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-3">
            配置杭リスト（計 {pileNodes.filter((p) => !p.isOmitted).length} 本）
          </h3>

          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 sticky top-0 font-bold">
                  <th className="py-2 px-3">杭番号</th>
                  <th className="py-2 px-3">X座標 (m)</th>
                  <th className="py-2 px-3">Y座標 (m)</th>
                  <th className="py-2 px-3">傾斜角 θ (deg)</th>
                  <th className="py-2 px-3 text-center">中抜き</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pileNodes.map((pile, idx) => (
                  <tr key={pile.id} className={pile.isOmitted ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50'}>
                    <td className="py-2 px-3 font-bold text-slate-900 font-mono">P{idx + 1}</td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.1"
                        value={pile.x}
                        onChange={(e) => handleUpdateNode(pile.id, { x: parseFloat(e.target.value) || 0 })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs w-20 focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.1"
                        value={pile.y}
                        onChange={(e) => handleUpdateNode(pile.id, { y: parseFloat(e.target.value) || 0 })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs w-20 focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="1"
                        value={pile.inclinationAngle}
                        onChange={(e) => handleUpdateNode(pile.id, { inclinationAngle: parseFloat(e.target.value) || 0 })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs w-16 focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={pile.isOmitted || false}
                        onChange={(e) => handleUpdateNode(pile.id, { isOmitted: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 右側：CAD図面プレビュー (5 cols) */}
      <div className="lg:col-span-5 flex justify-center">
        <PileArrangementCanvas
          footing={footing}
          pileNodes={pileNodes}
          pileSpecs={pileSpecs}
        />
      </div>
    </div>
  );
};
