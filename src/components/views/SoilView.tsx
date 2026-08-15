import React from 'react';
import { GroundCondition, SoilLayer, SoilType } from '../../types/soil';
import { SoilBoringLogCanvas } from '../graphics/SoilBoringLogCanvas';
import { calculateLiquefaction } from '../../engine/liquefaction';
import { Plus, Trash2, ShieldAlert } from 'lucide-react';

interface SoilViewProps {
  ground: GroundCondition;
  onChangeGround: (ground: GroundCondition) => void;
  pileTipDepth?: number;
}

export const SoilView: React.FC<SoilViewProps> = ({
  ground,
  onChangeGround,
  pileTipDepth = 19.5,
}) => {
  const liqResults = calculateLiquefaction(
    ground.layers,
    ground.groundWaterLevel,
    ground.seismicIntensityL1,
    ground.seismicIntensityL2Type1
  );

  const handleUpdateLayer = (index: number, updated: Partial<SoilLayer>) => {
    const newLayers = [...ground.layers];
    newLayers[index] = { ...newLayers[index], ...updated };

    let currentDepth = 0;
    for (let i = 0; i < newLayers.length; i++) {
      newLayers[i].depthTop = currentDepth;
      newLayers[i].depthBottom = currentDepth + newLayers[i].thickness;
      currentDepth += newLayers[i].thickness;
    }

    onChangeGround({ ...ground, layers: newLayers });
  };

  const handleAddLayer = () => {
    const lastLayer = ground.layers[ground.layers.length - 1];
    const newTop = lastLayer ? lastLayer.depthBottom : 0;
    const newLayer: SoilLayer = {
      id: `layer-${Date.now()}`,
      name: `第${ground.layers.length + 1}層 (砂質土)`,
      depthTop: newTop,
      depthBottom: newTop + 5.0,
      thickness: 5.0,
      soilType: 'sand',
      nValue: 20,
      unitWeight: 18.0,
      unitWeightSat: 19.0,
      internalFrictionAngle: 30,
      isLiquefiable: false,
    };
    onChangeGround({ ...ground, layers: [...ground.layers, newLayer] });
  };

  const handleDeleteLayer = (index: number) => {
    if (ground.layers.length <= 1) return;
    const newLayers = ground.layers.filter((_, i) => i !== index);
    let currentDepth = 0;
    for (let i = 0; i < newLayers.length; i++) {
      newLayers[i].depthTop = currentDepth;
      newLayers[i].depthBottom = currentDepth + newLayers[i].thickness;
      currentDepth += newLayers[i].thickness;
    }
    onChangeGround({ ...ground, layers: newLayers });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4">
      {/* 左側：土層・液状化パラメータ入力テーブル (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        {/* 地盤共通設定カード */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            地盤基本条件 & 耐震設計パラメータ
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">地下水位 (GL-m)</label>
              <input
                type="number"
                step="0.1"
                value={ground.groundWaterLevel}
                onChange={(e) => onChangeGround({ ...ground, groundWaterLevel: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">地盤種別</label>
              <select
                value={ground.groundType}
                onChange={(e) => onChangeGround({ ...ground, groundType: e.target.value as GroundCondition['groundType'] })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="I">I種地盤 (良質・岩盤)</option>
                <option value="II">II種地盤 (普通洪積/沖積)</option>
                <option value="III">III種地盤 (軟弱地盤)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">L1 水平震度 kh</label>
              <input
                type="number"
                step="0.05"
                value={ground.seismicIntensityL1}
                onChange={(e) => onChangeGround({ ...ground, seismicIntensityL1: parseFloat(e.target.value) || 0.2 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">L2 TypeI 震度 khgL</label>
              <input
                type="number"
                step="0.1"
                value={ground.seismicIntensityL2Type1}
                onChange={(e) => onChangeGround({ ...ground, seismicIntensityL2Type1: parseFloat(e.target.value) || 0.8 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">L2 TypeII 震度 khgL</label>
              <input
                type="number"
                step="0.1"
                value={ground.seismicIntensityL2Type2}
                onChange={(e) => onChangeGround({ ...ground, seismicIntensityL2Type2: parseFloat(e.target.value) || 1.6 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* 土層構成テーブル */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              土層構成・N値・液状化設定 (道路橋示方書IV/V)
            </h3>
            <button
              onClick={handleAddLayer}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              土層を追加
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                  <th className="py-2.5 px-2">No</th>
                  <th className="py-2.5 px-2">層名</th>
                  <th className="py-2.5 px-2">土質</th>
                  <th className="py-2.5 px-2">層厚(m)</th>
                  <th className="py-2.5 px-2">深度(m)</th>
                  <th className="py-2.5 px-2">N値</th>
                  <th className="py-2.5 px-2">γ (kN/m³)</th>
                  <th className="py-2.5 px-2 text-center">液状化</th>
                  <th className="py-2.5 px-2 text-center">FL / De</th>
                  <th className="py-2.5 px-2 text-center">削除</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ground.layers.map((layer, index) => {
                  const liq = liqResults.find((r) => r.layerId === layer.id);
                  return (
                    <tr key={layer.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-2 text-slate-500 font-mono font-bold">{index + 1}</td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={layer.name}
                          onChange={(e) => handleUpdateLayer(index, { name: e.target.value })}
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs w-28 focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={layer.soilType}
                          onChange={(e) => handleUpdateLayer(index, { soilType: e.target.value as SoilType })}
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                        >
                          <option value="sand">砂質土 (S)</option>
                          <option value="clay">粘性土 (C)</option>
                          <option value="gravel">礫質土 (G)</option>
                          <option value="rock">岩盤 (R)</option>
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.5"
                          value={layer.thickness}
                          onChange={(e) => handleUpdateLayer(index, { thickness: Math.max(0.5, parseFloat(e.target.value) || 1) })}
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs w-16 font-mono focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2 text-slate-600 font-mono">
                        {layer.depthTop.toFixed(1)} - {layer.depthBottom.toFixed(1)}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={layer.nValue}
                          onChange={(e) => handleUpdateLayer(index, { nValue: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-blue-700 font-bold text-xs w-14 font-mono focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.5"
                          value={layer.unitWeight}
                          onChange={(e) => handleUpdateLayer(index, { unitWeight: parseFloat(e.target.value) || 18 })}
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs w-14 font-mono focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={layer.isLiquefiable}
                          onChange={(e) => handleUpdateLayer(index, { isLiquefiable: e.target.checked })}
                          className="rounded border-slate-300 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-2 text-center font-mono">
                        {layer.isLiquefiable && liq ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              liq.isLiquefied
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            FL={liq.flValue} (De={liq.deLevel2})
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => handleDeleteLayer(index)}
                          disabled={ground.layers.length <= 1}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 液状化判定サマリーアラート */}
        {liqResults.some((r) => r.isLiquefied) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-sm text-red-900 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-red-800">地震時 液状化判定警告 (FL &lt; 1.0)</div>
              <div className="text-xs text-red-700 mt-1">
                一部の砂層で液状化の可能性が判定されました。地震時解析において地盤反力低減係数 De（0〜2/3）が自動適用されます。
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 右側：地盤柱状図グラフィック (5 cols) */}
      <div className="lg:col-span-5 flex justify-center">
        <SoilBoringLogCanvas
          layers={ground.layers}
          groundWaterLevel={ground.groundWaterLevel}
          pileTipDepth={pileTipDepth}
        />
      </div>
    </div>
  );
};
