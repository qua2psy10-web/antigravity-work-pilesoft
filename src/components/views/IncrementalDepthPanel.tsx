import { useState } from 'react';
import { Layers3 } from 'lucide-react';
import type { PileDepthStressPoint } from '../../types/calculation';

const stateLabel = {
  elastic: '弾性',
  cracked: 'ひび割れ',
  yielded: '降伏',
  fully_plastic: '全塑性',
  ultimate_exceeded: '終局超過',
};

const stateClass = {
  elastic: 'bg-emerald-50 text-emerald-700',
  cracked: 'bg-amber-50 text-amber-800',
  yielded: 'bg-orange-100 text-orange-800',
  fully_plastic: 'bg-red-100 text-red-800',
  ultimate_exceeded: 'bg-red-100 text-red-800',
};

export function IncrementalDepthPanel({ profiles }: { profiles: Record<string, PileDepthStressPoint[]> }) {
  const pileIds = Object.keys(profiles);
  const [selectedPileId, setSelectedPileId] = useState(pileIds[0] ?? '');
  const profile = profiles[selectedPileId] ?? profiles[pileIds[0]] ?? [];
  if (profile.length === 0 || !profile.some((point) => point.sectionState)) return null;
  const maxMoment = profile.reduce((current, point) =>
    Math.abs(point.momentM) > Math.abs(current.momentM) ? point : current,
  );
  const maxSoil = profile.reduce((current, point) =>
    (point.soilYieldRatio ?? 0) > (current.soilYieldRatio ?? 0) ? point : current,
  );
  const hasSectionSegments = profile.some((point) => point.sectionSegmentId);

  return (
    <section className="space-y-4 rounded-lg border border-indigo-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black text-slate-800">
            <Layers3 className="h-4 w-4 text-indigo-600" /> 深度別非線形状態
          </h3>
          <p className="mt-1 text-xs text-slate-500">各梁要素のM–φ割線剛性と地盤反力上限への到達状況</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          表示杭
          <select
            value={selectedPileId}
            onChange={(event) => setSelectedPileId(event.target.value)}
            className="rounded border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900"
          >
            {pileIds.map((pileId) => <option key={pileId} value={pileId}>{pileId}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="text-slate-500">最大曲げ</div>
          <div className="mt-1 font-mono text-sm font-black text-slate-900">
            {maxMoment.momentM.toFixed(1)} kN·m（z={maxMoment.depthZ.toFixed(2)}m）
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="text-slate-500">最大地盤反力比</div>
          <div className="mt-1 font-mono text-sm font-black text-slate-900">
            p/pHU = {(maxSoil.soilYieldRatio ?? 0).toFixed(3)}（z={maxSoil.depthZ.toFixed(2)}m）
          </div>
        </div>
      </div>

      <div className="max-h-[460px] overflow-auto rounded border border-slate-200">
        <table className="w-full min-w-[860px] border-collapse text-center text-xs">
          <thead className="sticky top-0 bg-slate-100 text-slate-700">
            <tr><th className="p-2">z (m)</th>{hasSectionSegments ? <><th>断面区間</th><th>t (mm)</th></> : null}<th>M (kN·m)</th><th>φ (1/m)</th><th>EIeff/EI0</th><th>p / pHU</th><th>y (mm)</th><th>杭体状態</th></tr>
          </thead>
          <tbody>
            {profile.map((point) => {
              const state = point.sectionState ?? 'elastic';
              return (
                <tr key={point.depthZ} className="border-t border-slate-200 font-mono">
                  <td className="p-2">{point.depthZ.toFixed(2)}</td>
                  {hasSectionSegments ? <><td className="font-sans font-bold">{point.sectionSegmentId ?? '-'}</td><td>{point.sectionWallThickness?.toFixed(1) ?? '-'}</td></> : null}
                  <td>{point.momentM.toFixed(1)}</td>
                  <td>{point.curvaturePhi?.toExponential(3)}</td>
                  <td>{point.effectiveStiffnessRatio?.toFixed(3)}</td>
                  <td>{point.soilYieldRatio?.toFixed(3)}</td>
                  <td>{point.deflectionY.toFixed(3)}</td>
                  <td><span className={`rounded px-2 py-1 font-sans font-black ${stateClass[state]}`}>{stateLabel[state]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
