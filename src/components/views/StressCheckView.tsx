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
      <div className="flex bg-white border border-slate-200 p-1.5 rounded-lg overflow-x-auto gap-2 shadow-sm">
        {results.map((res, idx) => (
          <button
            key={res.loadCaseId}
            onClick={() => setSelectedCaseIndex(idx)}
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

      {/* 杭体 断面応力度照査テーブル */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            杭体 断面応力度照査 (許容応力度法 - 道示IV)
          </h3>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
            {spec.pileType === 'cast_in_place_rc' ? '場所打ちRC杭断面' : '鋼管杭断面'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
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
            <tbody className="divide-y divide-slate-100 font-mono">
              {currentResult.sectionChecks.map((check, idx) => (
                <tr key={check.pileNodeId} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-blue-700">P{idx + 1}</td>
                  <td className="py-2.5 px-2 text-slate-900 font-bold">{check.maxMomentM.toFixed(1)}</td>
                  <td className="py-2.5 px-2 text-slate-600">{check.maxMomentDepthZ.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-amber-700 font-bold">{check.axialForceN.toFixed(1)}</td>
                  {spec.pileType === 'cast_in_place_rc' ? (
                    <>
                      <td className="py-2.5 px-2">
                        <span className={check.compressiveStressC! > check.allowableCompressiveStressC! ? 'text-red-600 font-bold' : 'text-slate-800'}>
                          {check.compressiveStressC} / {check.allowableCompressiveStressC}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={check.tensileStressS! > check.allowableTensileStressS! ? 'text-red-600 font-bold' : 'text-slate-800'}>
                          {check.tensileStressS} / {check.allowableTensileStressS}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={check.shearStressTau! > check.allowableShearStressTau! ? 'text-red-600 font-bold' : 'text-slate-800'}>
                          {check.shearStressTau} / {check.allowableShearStressTau}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-2">
                        <span className={check.steelStressSigma! > check.allowableSteelStressSigma! ? 'text-red-600 font-bold' : 'text-slate-800'}>
                          {check.steelStressSigma} / {check.allowableSteelStressSigma}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={check.steelShearStressTau! > check.allowableSteelShearStressTau! ? 'text-red-600 font-bold' : 'text-slate-800'}>
                          {check.steelShearStressTau} / {check.allowableSteelShearStressTau}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-3 text-center font-sans">
                    {check.isPass ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        OK
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
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
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          杭頭結合部 (押抜きせん断・支圧応力度) 照査
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                <th className="py-2.5 px-3">杭番号</th>
                <th className="py-2.5 px-3">押抜きせん断 τp (N/mm²)</th>
                <th className="py-2.5 px-3">許容押抜き τpa (N/mm²)</th>
                <th className="py-2.5 px-3">コンクリート支圧 σb (N/mm²)</th>
                <th className="py-2.5 px-3">許容支圧 σba (N/mm²)</th>
                <th className="py-2.5 px-3">仮想RC応力比</th>
                <th className="py-2.5 px-3 text-center">判定</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {currentResult.jointChecks.map((jc, idx) => (
                <tr key={jc.pileNodeId} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-blue-700">P{idx + 1}</td>
                  <td className="py-2.5 px-3 text-slate-900">{jc.punchingShearStress}</td>
                  <td className="py-2.5 px-3 text-slate-600">{jc.allowablePunchingShear}</td>
                  <td className="py-2.5 px-3 text-slate-900">{jc.bearingStress}</td>
                  <td className="py-2.5 px-3 text-slate-600">{jc.allowableBearingStress}</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">{jc.virtualRcStressRatio}</td>
                  <td className="py-2.5 px-3 text-center font-sans">
                    {jc.isPass ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        OK
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
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
