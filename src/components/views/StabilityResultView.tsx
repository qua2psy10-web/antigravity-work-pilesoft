import React, { useState } from 'react';
import { CalculationResult } from '../../types/calculation';
import { PileSpecification } from '../../types/pile';
import { PileStressChartCanvas } from '../graphics/PileStressChartCanvas';
import { CheckCircle2, XCircle, TrendingUp } from 'lucide-react';

interface StabilityResultViewProps {
  results: CalculationResult[];
  pileSpecs: { [id: string]: PileSpecification };
}

export const StabilityResultView: React.FC<StabilityResultViewProps> = ({
  results,
  pileSpecs,
}) => {
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number>(0);
  const [selectedPileId, setSelectedPileId] = useState<string>('');

  if (!results || results.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        計算結果がありません。「計算実行」ボタンを押して解析を実行してください。
      </div>
    );
  }

  const currentResult = results[selectedCaseIndex] || results[0];
  const pileSpec = Object.values(pileSpecs)[0];

  const pileId = selectedPileId || currentResult.pileReactions[0]?.pileNodeId || 'p1';
  const currentProfile = currentResult.pileDepthProfiles[pileId] || [];
  const horizontalDisplacement = currentResult.loadDisplacementCurve?.designDisplacement ??
    Math.abs(currentResult.footingDisplacement.deltaX);

  return (
    <div className="p-4 space-y-6">
      {/* 荷重ケース選択タブ */}
      <div className="flex bg-white border border-slate-200 p-1.5 rounded-lg overflow-x-auto gap-2 shadow-sm">
        {results.map((res, idx) => (
          <button
            key={res.loadCaseId}
            onClick={() => {
              setSelectedCaseIndex(idx);
              setSelectedPileId('');
            }}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              selectedCaseIndex === idx
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {res.isStable ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-300" />
            )}
            {res.loadCaseName}
          </button>
        ))}
      </div>

      {/* サマリーカード：変位 & 支持力照査 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        {/* 水平変位 */}
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
          <div className="text-slate-600 font-bold mb-1">{currentResult.loadDisplacementCurve ? 'L2等価割線変位 δ' : '底版水平変位 δx'}</div>
          <div className="text-2xl font-bold font-mono text-blue-700">
            {horizontalDisplacement.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500">mm</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            許容値: &le; {currentResult.allowableDisplacementMm.toFixed(1)} mm
            {currentResult.loadDisplacementCurve ? `（弾性値 ${Math.abs(currentResult.footingDisplacement.deltaX).toFixed(2)} mm）` : ''}
          </div>
        </div>

        {/* 鉛直変位 */}
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
          <div className="text-slate-600 font-bold mb-1">底版沈下量 δy</div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {currentResult.footingDisplacement.deltaY.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500">mm</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            回転角 α: {(currentResult.footingDisplacement.alpha * 1000).toFixed(3)} ×10⁻³ rad
          </div>
        </div>

        {/* 最大杭頭押込み力 */}
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
          <div className="text-slate-600 font-bold mb-1">最大押込み軸力 Pmax</div>
          <div className="text-2xl font-bold font-mono text-amber-700">
            {currentResult.maxAxialCompressionKn.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">kN</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            許容 Ra: {currentResult.allowableBearingKn.toLocaleString()} kN
          </div>
        </div>

        {/* 安定判定 */}
        <div
          className={`p-4 rounded-lg border flex flex-col justify-center items-center shadow-sm ${
            currentResult.isStable
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}
        >
          <div className="text-xs font-bold mb-1">安定計算 総合判定</div>
          <div className="text-xl font-black tracking-wider flex items-center gap-1.5">
            {currentResult.isStable ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                STABLE (合格)
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-600" />
                UNSTABLE (NG)
              </>
            )}
          </div>
        </div>
      </div>

      {/* メインエリア：杭頭反力テーブル & 断面力ダイアグラム */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左側：各杭の杭頭反力一覧 (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              杭頭変位・反力算定結果一覧 (変位法)
            </h3>
            <span className="text-xs text-slate-500 font-medium">行選択でM/Sグラフ連動</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                  <th className="py-2.5 px-3">杭番号</th>
                  <th className="py-2.5 px-2">X (m)</th>
                  <th className="py-2.5 px-2">軸力 P (kN)</th>
                  <th className="py-2.5 px-2">水平力 H (kN)</th>
                  <th className="py-2.5 px-2">曲げ M (kN·m)</th>
                  <th className="py-2.5 px-2">変位 (mm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentResult.pileReactions.map((r) => {
                  const isSelected = (selectedPileId || currentResult.pileReactions[0].pileNodeId) === r.pileNodeId;
                  return (
                    <tr
                      key={r.pileNodeId}
                      onClick={() => setSelectedPileId(r.pileNodeId)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-l-4 border-blue-600 font-bold'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">P{r.index}</td>
                      <td className="py-2.5 px-2 font-mono text-slate-700">{r.x.toFixed(2)}</td>
                      <td className="py-2.5 px-2 font-mono text-amber-700 font-bold">
                        {r.axialForceP.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-red-600 font-bold">{r.shearForceH.toLocaleString()}</td>
                      <td className="py-2.5 px-2 font-mono text-slate-900">{r.bendingMomentM.toLocaleString()}</td>
                      <td className="py-2.5 px-2 font-mono text-blue-600 font-bold">{r.displacementDelta.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 杭頭バネ定数カード */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 mb-1">【杭頭バネマトリックス (Chang解)】</div>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div>K1 = <span className="font-bold text-slate-900">{currentResult.springMatrix.k1.toLocaleString()}</span> kN/m</div>
              <div>K2 = <span className="font-bold text-slate-900">{currentResult.springMatrix.k2.toLocaleString()}</span> kN/rad</div>
              <div>K4 = <span className="font-bold text-slate-900">{currentResult.springMatrix.k4.toLocaleString()}</span> kN·m/rad</div>
              <div>Kv = <span className="font-bold text-slate-900">{currentResult.springMatrix.kv.toLocaleString()}</span> kN/m</div>
              <div>β = <span className="font-bold text-slate-900">{currentResult.springMatrix.beta.toFixed(4)}</span> m⁻¹</div>
              <div>kH = <span className="font-bold text-slate-900">{currentResult.springMatrix.kh.toLocaleString()}</span> kN/m³</div>
            </div>
          </div>
        </div>

        {/* 右側：深度方向断面力ダイアグラム (6 cols) */}
        <div className="lg:col-span-6 flex justify-center">
          <PileStressChartCanvas
            profile={currentProfile}
            pileDiameter={pileSpec?.diameter || 1.2}
          />
        </div>
      </div>
    </div>
  );
};
