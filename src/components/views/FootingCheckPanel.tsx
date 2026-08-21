import React from 'react';
import { CheckCircle2, Layers3, XCircle } from 'lucide-react';
import { FootingCheckResult } from '../../types/calculation';

const fmt = (value: number, digits = 2) => value.toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const FootingCheckPanel: React.FC<{ check: FootingCheckResult }> = ({ check }) => (
  <section className="space-y-4 rounded-lg border border-cyan-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-base font-black text-slate-800"><Layers3 className="h-4 w-4 text-cyan-700" /> 底版詳細照査</h3>
        <p className="mt-1 text-xs text-slate-500">柱前面曲げ・一方向せん断・柱周囲押抜きせん断</p>
      </div>
      <span className={`inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs font-black ${check.isPass ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
        {check.isPass ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{check.isPass ? '底版 OK' : '底版 NG'}
      </span>
    </div>

    <div className="overflow-x-auto border border-slate-200">
      <table className="w-full min-w-[1050px] border-collapse text-center text-xs">
        <thead className="bg-slate-50 text-slate-700"><tr><th className="p-2">方向</th><th>正曲げ / My+</th><th>負曲げ / My-</th><th>必要As下 / 配筋As</th><th>必要As上 / 配筋As</th><th>曲げ比</th><th>せん断 S / Ps</th><th>せん断比</th><th>判定</th></tr></thead>
        <tbody>{check.directions.map((direction) => <tr key={direction.direction} className="border-t border-slate-200 font-mono"><td className="p-2 font-sans font-black">{direction.direction}方向</td><td>{fmt(direction.positiveMoment)} / {fmt(direction.positiveMomentCapacity)}</td><td>{fmt(direction.negativeMoment)} / {fmt(direction.negativeMomentCapacity)}</td><td>{fmt(direction.requiredBottomRebarArea, 0)} / {fmt(direction.bottomRebarArea, 0)}</td><td>{fmt(direction.requiredTopRebarArea, 0)} / {fmt(direction.topRebarArea, 0)}</td><td className={direction.flexureUtilization > 1 ? 'font-black text-red-700' : 'font-black text-emerald-700'}>{fmt(direction.flexureUtilization, 3)}</td><td>{fmt(direction.designShear)} / {fmt(direction.shearCapacity)}</td><td className={direction.shearUtilization > 1 ? 'font-black text-red-700' : 'font-black text-emerald-700'}>{fmt(direction.shearUtilization, 3)}</td><td className={`font-sans font-black ${direction.isFlexurePass && direction.isShearPass ? 'text-emerald-700' : 'text-red-700'}`}>{direction.isFlexurePass && direction.isShearPass ? 'OK' : 'NG'}</td></tr>)}</tbody>
      </table>
    </div>

    <div className="grid gap-3 sm:grid-cols-4">
      <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-[11px] font-bold text-slate-500">押抜き設計せん断</div><div className="mt-1 font-mono text-lg font-black">{fmt(check.punching.designShear, 1)} <span className="text-xs">kN</span></div></div>
      <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-[11px] font-bold text-slate-500">押抜き耐力</div><div className="mt-1 font-mono text-lg font-black">{fmt(check.punching.capacity, 1)} <span className="text-xs">kN</span></div></div>
      <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-[11px] font-bold text-slate-500">危険周長 / 有効高</div><div className="mt-1 font-mono text-sm font-black">{fmt(check.punching.criticalPerimeter, 3)} m / {fmt(check.punching.effectiveDepth, 0)} mm</div></div>
      <div className={`rounded border p-3 ${check.punching.isPass ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}><div className="text-[11px] font-bold text-slate-500">押抜き照査比</div><div className={`mt-1 font-mono text-lg font-black ${check.punching.isPass ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(check.punching.utilization, 3)}</div></div>
    </div>

    <p className="border-l-4 border-amber-400 bg-amber-50 p-3 text-xs leading-5 text-amber-950">{check.notes.join('。')}。</p>
  </section>
);
