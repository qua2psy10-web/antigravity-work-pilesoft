import React, { useState } from 'react';
import { CalculationResult } from '../../types/calculation';
import { PileSpecification } from '../../types/pile';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

interface StressCheckViewProps {
  results: CalculationResult[];
  pileSpecs: { [id: string]: PileSpecification };
}

export const StressCheckView: React.FC<StressCheckViewProps> = ({
  results,
  pileSpecs,
}) => {
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number>(0);

  if (!results || results.length === 0) return null;

  const currentResult = results[selectedCaseIndex] || results[0];
  const spec = Object.values(pileSpecs)[0];

  return (
    <div className="p-4 space-y-6">
      {/* 荷重ケース切り替え */}
      <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-lg overflow-x-auto gap-2">
        {results.map((res, idx) => (
          <button
            key={res.loadCaseId}
            onClick={() => setSelectedCaseIndex(idx)}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              selectedCaseIndex === idx
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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

      {/* 杭体 断面応力度照査テーブル */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            杭体 断面応力度照査 (許容応力度法 - 道示IV)
          </h3>
          <span className="text-xs text-slate-400">
            {spec.pileType === 'cast_in_place_rc' ? '場所打ちRC杭断面' : '鋼管杭断面'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-slate-300 border-b border-slate-700">
                <th className="py-2.5 px-3">杭番号</th>
                <th className="py-2.5 px-2">Mmax (kN·m)</th>
                <th className="py-2.5 px-2">深度 z (m)</th>
                <th className="py-2.5 px-2">軸力 N (kN)</th>
                {spec.pileType === 'cast_in_place_rc' ? (
                  <>
                    <th className="py-2.5 px-2">曲げ圧縮 σc (N/mm²)</th>
                    <th className="py-2.5 px-2">鉄筋引張 σs (N/mm²)</th>
                    <th className="py-2.5 px-2">せん断 τ (N/mm²)</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-2">合成応力 σ (N/mm²)</th>
                    <th className="py-2.5 px-2">せん断 τ (N/mm²)</th>
                  </>
                )}
                <th className="py-2.5 px-3 text-center">判定</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {currentResult.sectionChecks.map((check, idx) => (
                <tr key={check.pileNodeId} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-bold text-cyan-300">P{idx + 1}</td>
                  <td className="py-2.5 px-2 text-slate-100">{check.maxMomentM.toFixed(1)}</td>
                  <td className="py-2.5 px-2 text-slate-400">{check.maxMomentDepthZ.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-amber-300">{check.axialForceN.toFixed(1)}</td>
                  {spec.pileType === 'cast_in_place_rc' ? (
                    <>
                      <td className="py-2.5 px-2">
                        <span className={check.compressiveStressC! > check.allowableCompressiveStressC! ? 'text-red-400 font-bold' : 'text-slate-200'}>
                          {check.compressiveStressC} / {check.allowableCompressiveStressC}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={check.tensileStressS! > check.allowableTensileStressS! ? 'text-red-400 font-bold' : 'text-slate-200'}>
                          {check.tensileStressS} / {check.allowableTensileStressS}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={check.shearStressTau! > check.allowableShearStressTau! ? 'text-red-400 font-bold' : 'text-slate-200'}>
                          {check.shearStressTau} / {check.allowableShearStressTau}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-2">
                        <span className={check.steelStressSigma! > check.allowableSteelStressSigma! ? 'text-red-400 font-bold' : 'text-slate-200'}>
                          {check.steelStressSigma} / {check.allowableSteelStressSigma}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={check.steelShearStressTau! > check.allowableSteelShearStressTau! ? 'text-red-400 font-bold' : 'text-slate-200'}>
                          {check.steelShearStressTau} / {check.allowableSteelShearStressTau}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-3 text-center">
                    {check.isPass ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        OK
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-950 text-red-400 border border-red-800">
                        NG
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 杭頭結合部 (杭頭処理) 照査テーブル */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-lg space-y-4">
        <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          杭頭結合部 (押抜きせん断・支圧応力度) 照査
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-slate-300 border-b border-slate-700">
                <th className="py-2.5 px-3">杭番号</th>
                <th className="py-2.5 px-3">押抜きせん断 τp (N/mm²)</th>
                <th className="py-2.5 px-3">許容押抜き τpa (N/mm²)</th>
                <th className="py-2.5 px-3">コンクリート支圧 σb (N/mm²)</th>
                <th className="py-2.5 px-3">許容支圧 σba (N/mm²)</th>
                <th className="py-2.5 px-3">仮想RC応力比</th>
                <th className="py-2.5 px-3 text-center">判定</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {currentResult.jointChecks.map((jc, idx) => (
                <tr key={jc.pileNodeId} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-bold text-cyan-300">P{idx + 1}</td>
                  <td className="py-2.5 px-3 text-slate-100">{jc.punchingShearStress}</td>
                  <td className="py-2.5 px-3 text-slate-400">{jc.allowablePunchingShear}</td>
                  <td className="py-2.5 px-3 text-slate-100">{jc.bearingStress}</td>
                  <td className="py-2.5 px-3 text-slate-400">{jc.allowableBearingStress}</td>
                  <td className="py-2.5 px-3 text-emerald-300">{jc.virtualRcStressRatio}</td>
                  <td className="py-2.5 px-3 text-center">
                    {jc.isPass ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        OK
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-950 text-red-400 border border-red-800">
                        NG
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
