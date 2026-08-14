import React from 'react';
import { LoadCase, LoadCaseType } from '../../types/load';
import { Plus, Trash2, ArrowDownCircle, ArrowRightCircle, RotateCw } from 'lucide-react';

interface LoadCasesViewProps {
  loadCases: LoadCase[];
  onChangeLoadCases: (cases: LoadCase[]) => void;
}

export const LoadCasesView: React.FC<LoadCasesViewProps> = ({
  loadCases,
  onChangeLoadCases,
}) => {
  const handleUpdate = (index: number, updated: Partial<LoadCase>) => {
    const newCases = [...loadCases];
    newCases[index] = { ...newCases[index], ...updated };
    onChangeLoadCases(newCases);
  };

  const handleAddCase = () => {
    const newCase: LoadCase = {
      id: `lc-custom-${Date.now()}`,
      name: `任意ケース ${loadCases.length + 1}`,
      type: 'custom',
      verticalForceV: 8000,
      horizontalForceH: 1000,
      momentM: 4000,
      allowableStressFactor: 1.25,
      safetyFactorBearing: 2.5,
      safetyFactorPullout: 4.0,
      allowableDisplacement: 25.0,
    };
    onChangeLoadCases([...loadCases, newCase]);
  };

  const handleDeleteCase = (index: number) => {
    if (loadCases.length <= 1) return;
    onChangeLoadCases(loadCases.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              作用荷重ケース & 照査条件 (道路橋示方書IV/V)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              フーチング上面・底面に作用する鉛直力 V、水平力 H、回転モーメント M を設定します。
            </p>
          </div>
          <button
            onClick={handleAddCase}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            荷重ケース追加
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                <th className="py-3 px-3">ケース名</th>
                <th className="py-3 px-3">区分</th>
                <th className="py-3 px-3 flex items-center gap-1">
                  <ArrowDownCircle className="w-3.5 h-3.5 text-blue-600" />
                  鉛直力 V (kN)
                </th>
                <th className="py-3 px-3">
                  <span className="flex items-center gap-1">
                    <ArrowRightCircle className="w-3.5 h-3.5 text-red-600" />
                    水平力 H (kN)
                  </span>
                </th>
                <th className="py-3 px-3">
                  <span className="flex items-center gap-1">
                    <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                    モーメント M (kN·m)
                  </span>
                </th>
                <th className="py-3 px-3">応力度割増</th>
                <th className="py-3 px-3">支持力安全率 n</th>
                <th className="py-3 px-3">許容変位 (mm)</th>
                <th className="py-3 px-3 text-center">削除</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadCases.map((lc, index) => (
                <tr key={lc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3">
                    <input
                      type="text"
                      value={lc.name}
                      onChange={(e) => handleUpdate(index, { name: e.target.value })}
                      className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-bold text-xs w-48 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <select
                      value={lc.type}
                      onChange={(e) => handleUpdate(index, { type: e.target.value as LoadCaseType })}
                      className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="normal">常時 (D+L)</option>
                      <option value="wind">風時 (D+W)</option>
                      <option value="temperature">温度時 (D+T)</option>
                      <option value="seismic_l1">地震時 L1</option>
                      <option value="seismic_l2_t1">地震時 L2 TypeI</option>
                      <option value="seismic_l2_t2">地震時 L2 TypeII</option>
                      <option value="custom">任意ケース</option>
                    </select>
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      value={lc.verticalForceV}
                      onChange={(e) => handleUpdate(index, { verticalForceV: parseFloat(e.target.value) || 0 })}
                      className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-blue-700 font-bold font-mono text-xs w-24 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      value={lc.horizontalForceH}
                      onChange={(e) => handleUpdate(index, { horizontalForceH: parseFloat(e.target.value) || 0 })}
                      className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-red-600 font-bold font-mono text-xs w-24 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      value={lc.momentM}
                      onChange={(e) => handleUpdate(index, { momentM: parseFloat(e.target.value) || 0 })}
                      className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-amber-700 font-bold font-mono text-xs w-24 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      step="0.05"
                      value={lc.allowableStressFactor}
                      onChange={(e) => handleUpdate(index, { allowableStressFactor: parseFloat(e.target.value) || 1.0 })}
                      className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-900 font-mono text-xs w-16 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      step="0.5"
                      value={lc.safetyFactorBearing}
                      onChange={(e) => handleUpdate(index, { safetyFactorBearing: parseFloat(e.target.value) || 3.0 })}
                      className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-900 font-mono text-xs w-16 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      step="5"
                      value={lc.allowableDisplacement}
                      onChange={(e) => handleUpdate(index, { allowableDisplacement: parseFloat(e.target.value) || 15 })}
                      className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-900 font-mono text-xs w-16 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleDeleteCase(index)}
                      disabled={loadCases.length <= 1}
                      className="text-slate-400 hover:text-red-600 disabled:opacity-30 p-1.5 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
