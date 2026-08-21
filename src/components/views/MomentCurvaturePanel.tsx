import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { MomentCurvatureCheckResult, MomentCurvatureState } from '../../types/calculation';

interface MomentCurvaturePanelProps {
  checks: MomentCurvatureCheckResult[];
}

const stateLabels: Record<MomentCurvatureState, string> = {
  elastic: '弾性域',
  cracked: 'ひび割れ後',
  yielded: '降伏後',
  ultimate_exceeded: '終局超過',
};

const fmt = (value: number, digits = 3) =>
  value.toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const MomentCurvaturePanel: React.FC<MomentCurvaturePanelProps> = ({ checks }) => {
  const isIncremental = checks.some((check) => check.notes.some((note) => note.includes('20梁要素')));
  const [selectedPileId, setSelectedPileId] = useState(checks[0]?.pileNodeId ?? '');
  const selected = checks.find((check) => check.pileNodeId === selectedPileId) ?? checks[0];

  const chart = useMemo(() => {
    if (!selected) return null;
    const width = 560;
    const height = 260;
    const padding = { left: 58, right: 24, top: 22, bottom: 42 };
    const lastPoint = selected.points[selected.points.length - 1];
    const maxCurvature = Math.max(lastPoint.curvature, selected.demandCurvature) * 1.12 || 1;
    const maxMoment = Math.max(lastPoint.moment, selected.demandMoment) * 1.12 || 1;
    const x = (curvature: number) =>
      padding.left + (curvature / maxCurvature) * (width - padding.left - padding.right);
    const y = (moment: number) =>
      height - padding.bottom - (moment / maxMoment) * (height - padding.top - padding.bottom);
    return {
      width,
      height,
      padding,
      x,
      y,
      polyline: selected.points.map((point) => `${x(point.curvature)},${y(point.moment)}`).join(' '),
    };
  }, [selected]);

  if (!selected || !chart) return null;

  return (
    <section className="space-y-4 rounded-lg border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Activity className="h-4 w-4 text-amber-600" />
            杭体 非線形M-φ解析（L2）
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {isIncremental
              ? '各増分の杭軸力で骨格曲線を更新し、深度区間ごとの割線EIを反復計算'
              : '死荷重時軸力で骨格曲線を作成し、応答点の割線EIで杭単体Chang解を反復更新'}
          </p>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto">
          {checks.map((check) => (
            <button
              key={check.pileNodeId}
              onClick={() => setSelectedPileId(check.pileNodeId)}
              className={`shrink-0 border px-2.5 py-1.5 text-[11px] font-bold ${
                selected.pileNodeId === check.pileNodeId
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {check.pileNodeId}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="overflow-x-auto border border-slate-200 bg-slate-50 p-2">
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="min-w-[520px]"
            role="img"
            aria-label={`${selected.pileNodeId} M-φ曲線`}
          >
            <line x1={chart.padding.left} y1={chart.height - chart.padding.bottom} x2={chart.width - chart.padding.right} y2={chart.height - chart.padding.bottom} stroke="#475569" strokeWidth="1" />
            <line x1={chart.padding.left} y1={chart.padding.top} x2={chart.padding.left} y2={chart.height - chart.padding.bottom} stroke="#475569" strokeWidth="1" />
            <polyline points={chart.polyline} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" />
            {selected.points.slice(1).map((point) => (
              <g key={point.label}>
                <circle cx={chart.x(point.curvature)} cy={chart.y(point.moment)} r="4" fill="#2563eb" />
                <text x={chart.x(point.curvature) + 7} y={chart.y(point.moment) - 7} fontSize="11" fontWeight="700" fill="#1e3a8a">{point.label}</text>
              </g>
            ))}
            <line x1={chart.x(selected.demandCurvature)} y1={chart.height - chart.padding.bottom} x2={chart.x(selected.demandCurvature)} y2={chart.y(selected.demandMoment)} stroke="#dc2626" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx={chart.x(selected.demandCurvature)} cy={chart.y(selected.demandMoment)} r="5" fill="#dc2626" />
            <text x={chart.x(selected.demandCurvature) + 8} y={chart.y(selected.demandMoment) + 15} fontSize="11" fontWeight="700" fill="#b91c1c">応答点</text>
            <text x={chart.width / 2} y={chart.height - 9} textAnchor="middle" fontSize="11" fill="#475569">曲率 φ (1/m)</text>
            <text x="15" y={chart.height / 2} textAnchor="middle" fontSize="11" fill="#475569" transform={`rotate(-90 15 ${chart.height / 2})`}>曲げモーメント M (kN·m)</text>
          </svg>
        </div>

        <div className="space-y-3">
          <div className={`border p-3 ${selected.isWithinUltimate && selected.converged ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
            <div className="flex items-center gap-2">
              {selected.isWithinUltimate && selected.converged ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
              <div>
                <div className="text-sm font-black">{stateLabels[selected.state]}</div>
                <div className="text-[10px] text-slate-600">{selected.modelType === 'trilinear' ? 'RC系トリリニア' : '鋼管系バイリニア'} / {selected.iterations}回反復</div>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 border border-slate-200 text-xs">
            <dt className="border-b border-r border-slate-200 bg-slate-50 p-2 font-bold">{isIncremental ? '解析時軸力' : '死荷重時軸力'}</dt><dd className="border-b border-slate-200 p-2 font-mono">{fmt(selected.axialForceForCurve, 1)} kN</dd>
            <dt className="border-b border-r border-slate-200 bg-slate-50 p-2 font-bold">応答 M</dt><dd className="border-b border-slate-200 p-2 font-mono">{fmt(selected.demandMoment, 1)} kN·m</dd>
            <dt className="border-b border-r border-slate-200 bg-slate-50 p-2 font-bold">応答 φ</dt><dd className="border-b border-slate-200 p-2 font-mono">{selected.demandCurvature.toExponential(4)} 1/m</dd>
            <dt className="border-b border-r border-slate-200 bg-slate-50 p-2 font-bold">曲率塑性率</dt><dd className="border-b border-slate-200 p-2 font-mono">μφ = {fmt(selected.ductilityRatio, 3)}</dd>
            <dt className="border-b border-r border-slate-200 bg-slate-50 p-2 font-bold">有効剛性比</dt><dd className="border-b border-slate-200 p-2 font-mono">EIeff/EI0 = {fmt(selected.effectiveStiffnessRatio, 3)}</dd>
            <dt className="border-r border-slate-200 bg-slate-50 p-2 font-bold">更新 β</dt><dd className="p-2 font-mono">{selected.effectiveBeta.toFixed(5)} 1/m</dd>
          </dl>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-center text-xs">
          <thead className="bg-slate-50 text-slate-700">
            <tr><th className="border border-slate-200 p-2">点</th><th className="border border-slate-200 p-2">状態</th><th className="border border-slate-200 p-2">M (kN·m)</th><th className="border border-slate-200 p-2">φ (1/m)</th><th className="border border-slate-200 p-2">割線EI (kN·m²)</th></tr>
          </thead>
          <tbody className="font-mono">
            {selected.points.slice(1).map((point) => (
              <tr key={point.label}><td className="border border-slate-200 p-2 font-sans font-black">{point.label}</td><td className="border border-slate-200 p-2 font-sans">{point.label === 'C' ? 'ひび割れ' : point.label === 'Y' ? '降伏' : point.label === 'P' ? '全塑性' : '終局'}</td><td className="border border-slate-200 p-2">{fmt(point.moment, 1)}</td><td className="border border-slate-200 p-2">{point.curvature.toExponential(4)}</td><td className="border border-slate-200 p-2">{fmt(point.secantEI, 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-l-4 border-amber-400 bg-amber-50 p-3 text-[11px] leading-5 text-amber-950">
        {isIncremental
          ? '場所打ちRC杭は剛体底版と杭―地盤系を荷重増分ごとに釣合い計算しています。地盤反力上限pHUは簡易p-yモデルのため、正式設計では適用基準の式・上限値と照合してください。底版は別途線形照査です。'
          : '本結果は杭1本ごとのM-φ割線剛性反復です。地盤ばねの塑性化を含む杭基礎全体系の荷重増分解析、軸力変動、底版非線形は別途確認が必要です。'}
      </p>
    </section>
  );
};
