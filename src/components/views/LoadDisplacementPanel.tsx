import React, { useMemo } from 'react';
import { Activity, CheckCircle2, Gauge, XCircle } from 'lucide-react';
import { LoadDisplacementCurveResult } from '../../types/calculation';

const stateLabel = {
  elastic: '弾性域',
  cracked: 'ひび割れ後',
  yielded: '降伏到達',
  ultimate_exceeded: '終局超過',
};

export const LoadDisplacementPanel: React.FC<{ curve: LoadDisplacementCurveResult }> = ({ curve }) => {
  const isIncremental = curve.model === 'incremental_winkler';
  const chart = useMemo(() => {
    const width = 760;
    const height = 300;
    const padding = { left: 74, right: 24, top: 24, bottom: 54 };
    const maxLoad = Math.max(...curve.points.map((point) => point.horizontalLoad), 1);
    const maxDisplacement = Math.max(...curve.points.map((point) => point.displacement), 1);
    const x = (value: number) => padding.left + value / maxDisplacement * (width - padding.left - padding.right);
    const y = (value: number) => height - padding.bottom - value / maxLoad * (height - padding.top - padding.bottom);
    const polyline = curve.points.map((point) => `${x(point.displacement)},${y(point.horizontalLoad)}`).join(' ');
    const design = curve.points.reduce((closest, point) =>
      Math.abs(point.loadFactor - 1) < Math.abs(closest.loadFactor - 1) ? point : closest,
    );
    const yieldVisible = curve.yieldCheck.yieldLoadFactor <= Math.max(...curve.points.map((point) => point.loadFactor));
    return { width, height, padding, maxLoad, maxDisplacement, x, y, polyline, design, yieldVisible };
  }, [curve]);
  const yieldCheck = curve.yieldCheck;
  const pass = yieldCheck.isWithinUltimateAtDesignLoad;

  return (
    <section className="space-y-4 rounded-lg border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black text-slate-800">
            <Activity className="h-4 w-4 text-violet-600" /> L2 荷重-変位曲線・降伏判定
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {isIncremental
              ? '深度方向梁要素・非線形地盤ばねを逐次更新した水平荷重H–底版水平変位δ曲線'
              : 'M-φ割線剛性から算定した水平荷重H–底版水平変位δ曲線'}
          </p>
        </div>
        <div className={`flex items-center gap-2 rounded border px-3 py-2 text-xs font-black ${pass ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
          {pass ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {stateLabel[yieldCheck.state]}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="overflow-x-auto border border-slate-200 bg-slate-50 p-2">
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="min-w-[620px]" role="img" aria-label="L2水平荷重-底版水平変位曲線">
            <line x1={chart.padding.left} y1={chart.height - chart.padding.bottom} x2={chart.width - chart.padding.right} y2={chart.height - chart.padding.bottom} stroke="#64748b" strokeWidth="1.5" />
            <line x1={chart.padding.left} y1={chart.padding.top} x2={chart.padding.left} y2={chart.height - chart.padding.bottom} stroke="#64748b" strokeWidth="1.5" />
            {[0.25, 0.5, 0.75, 1].map((ratio) => <g key={ratio}><line x1={chart.padding.left} y1={chart.y(chart.maxLoad * ratio)} x2={chart.width - chart.padding.right} y2={chart.y(chart.maxLoad * ratio)} stroke="#e2e8f0" /><text x={chart.padding.left - 10} y={chart.y(chart.maxLoad * ratio) + 4} textAnchor="end" fontSize="11" fill="#64748b">{Math.round(chart.maxLoad * ratio)}</text></g>)}
            {[0.25, 0.5, 0.75, 1].map((ratio) => <g key={`x-${ratio}`}><line x1={chart.x(chart.maxDisplacement * ratio)} y1={chart.padding.top} x2={chart.x(chart.maxDisplacement * ratio)} y2={chart.height - chart.padding.bottom} stroke="#e2e8f0" /><text x={chart.x(chart.maxDisplacement * ratio)} y={chart.height - chart.padding.bottom + 18} textAnchor="middle" fontSize="11" fill="#64748b">{(chart.maxDisplacement * ratio).toFixed(1)}</text></g>)}
            <polyline points={chart.polyline} fill="none" stroke="#7c3aed" strokeWidth="4" strokeLinejoin="round" />
            <line x1={chart.x(chart.design.displacement)} y1={chart.height - chart.padding.bottom} x2={chart.x(chart.design.displacement)} y2={chart.y(chart.design.horizontalLoad)} stroke="#dc2626" strokeDasharray="5 4" />
            <circle cx={chart.x(chart.design.displacement)} cy={chart.y(chart.design.horizontalLoad)} r="6" fill="#dc2626" />
            <text x={chart.x(chart.design.displacement) + 9} y={chart.y(chart.design.horizontalLoad) - 8} fontSize="12" fontWeight="700" fill="#b91c1c">設計点</text>
            {chart.yieldVisible ? <><circle cx={chart.x(yieldCheck.yieldDisplacement)} cy={chart.y(yieldCheck.yieldHorizontalLoad)} r="6" fill="#d97706" /><text x={chart.x(yieldCheck.yieldDisplacement) + 9} y={chart.y(yieldCheck.yieldHorizontalLoad) + 18} fontSize="12" fontWeight="700" fill="#b45309">初降伏</text></> : null}
            <text x={(chart.width + chart.padding.left - chart.padding.right) / 2} y={chart.height - 12} textAnchor="middle" fontSize="13" fill="#334155">底版水平変位 δ (mm)</text>
            <text transform={`translate(18 ${(chart.height - chart.padding.bottom + chart.padding.top) / 2}) rotate(-90)`} textAnchor="middle" fontSize="13" fill="#334155">水平荷重 H (kN)</text>
          </svg>
        </div>

        <div className="space-y-3">
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-700"><Gauge className="h-4 w-4 text-violet-600" /> 初降伏判定</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <dt className="text-slate-500">支配杭</dt><dd className="font-mono font-black">{yieldCheck.governingPileNodeId}</dd>
              <dt className="text-slate-500">設計点 H / δ</dt><dd className="font-mono">{chart.design.horizontalLoad.toLocaleString()} kN / {chart.design.displacement.toFixed(2)} mm</dd>
              <dt className="text-slate-500">設計M / My</dt><dd className="font-mono">{yieldCheck.designMoment.toFixed(1)} / {yieldCheck.yieldMoment.toFixed(1)}</dd>
              <dt className="text-slate-500">初降伏荷重倍率</dt><dd className="font-mono font-black">λy = {yieldCheck.yieldLoadFactor.toFixed(3)}</dd>
              <dt className="text-slate-500">初降伏 H</dt><dd className="font-mono">{yieldCheck.yieldHorizontalLoad.toLocaleString()} kN</dd>
              <dt className="text-slate-500">初降伏 δ</dt><dd className="font-mono">{yieldCheck.yieldDisplacement.toFixed(2)} mm</dd>
              <dt className="text-slate-500">終局荷重倍率</dt><dd className="font-mono">λu = {yieldCheck.ultimateLoadFactor.toFixed(3)}</dd>
            </dl>
          </div>
          <div className={`rounded border p-3 text-xs font-bold ${yieldCheck.hasYieldedAtDesignLoad ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>
            設計荷重時：{yieldCheck.hasYieldedAtDesignLoad ? '初降伏到達' : '初降伏前'} ／ 終局：{yieldCheck.isWithinUltimateAtDesignLoad ? '未到達' : '超過'}
          </div>
        </div>
      </div>

      {isIncremental ? (
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full min-w-[860px] border-collapse text-center text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr><th className="p-2">λ</th><th>H (kN)</th><th>δ (mm)</th><th>回転角 (rad)</th><th>最大M (kN·m)</th><th>発生深度 (m)</th><th>最大p/pHU</th><th>反復</th><th>状態</th></tr>
            </thead>
            <tbody>
              {curve.points.map((point) => (
                <tr key={point.loadFactor} className="border-t border-slate-200 font-mono">
                  <td className="p-2">{point.loadFactor.toFixed(2)}</td>
                  <td>{point.horizontalLoad.toFixed(1)}</td>
                  <td>{point.displacement.toFixed(3)}</td>
                  <td>{point.rotationAngle?.toExponential(3)}</td>
                  <td>{point.maxMoment?.toFixed(1)}</td>
                  <td>{point.maxMomentDepth?.toFixed(2)}</td>
                  <td>{point.soilYieldRatio?.toFixed(3)}</td>
                  <td>{point.iterations}{point.converged ? '' : '※'}</td>
                  <td className="font-sans font-bold">{stateLabel[point.state]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="border-l-4 border-amber-400 bg-amber-50 p-3 text-xs leading-5 text-amber-950">{curve.notes.join('。')}。</p>
    </section>
  );
};
