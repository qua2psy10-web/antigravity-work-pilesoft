import React from 'react';
import { ProjectData } from '../../samples/defaultProjects';
import { calculateBearingCapacity } from '../../engine/bearingCapacity';
import { BarChart3, CheckCircle, DollarSign, Layers } from 'lucide-react';

interface ComparisonViewProps {
  projectData: ProjectData;
  onApplyPreset: (type: 'rc' | 'steel') => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  projectData,
  onApplyPreset,
}) => {
  const { ground, footing } = projectData;

  // 比較対象ケースの定義
  const comparisonOptions = [
    {
      id: 'opt-rc1200',
      name: '場所打ちRC杭 φ1200mm',
      type: 'cast_in_place_rc' as const,
      method: 'cast_in_place' as const,
      diameter: 1.2,
      length: 18.0,
      count: 6,
      unitCostPerMeter: 45000, // 円/m
      constructibility: '高（大口径・大支持力）',
      vibrationNoise: '低（都市部・近接施工向き）',
      seismicPerformance: '極めて高い',
      presetKey: 'rc' as const,
    },
    {
      id: 'opt-steel800',
      name: '鋼管杭 φ800mm (SKK400)',
      type: 'steel_pipe' as const,
      method: 'driven_hammer' as const,
      diameter: 0.8,
      length: 22.0,
      count: 9,
      unitCostPerMeter: 38000,
      constructibility: '中（継手溶接・斜杭対応）',
      vibrationNoise: '中〜高（打込み時騒音対策要）',
      seismicPerformance: '極めて高い（高靭性）',
      presetKey: 'steel' as const,
    },
    {
      id: 'opt-phc800',
      name: 'PHC杭 φ800mm (プレボーリング)',
      type: 'phc' as const,
      method: 'pre_boring' as const,
      diameter: 0.8,
      length: 20.0,
      count: 8,
      unitCostPerMeter: 28000,
      constructibility: '良（既製杭・工期短縮）',
      vibrationNoise: '低（プレボーリング工法）',
      seismicPerformance: '高い',
      presetKey: 'rc' as const,
    },
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              杭基礎形式 比較検討表 (道路橋示方書IV 形式選定)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              地盤条件・作用荷重に対する各杭種（場所打ち杭・鋼管杭・PHC杭）の性能・概算工事費・施工性の多面比較を行います。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {comparisonOptions.map((opt) => {
            // 支持力略算
            const mockSpec: any = {
              id: opt.id,
              pileType: opt.type,
              method: opt.method,
              bearingType: 'end_bearing',
              diameter: opt.diameter,
              length: opt.length,
              modulusE: 2.5e7,
              crossSectionAreaA: (Math.PI * opt.diameter ** 2) / 4,
              momentOfInertiaI: (Math.PI * Math.pow(opt.diameter, 4)) / 64,
            };
            const bearing = calculateBearingCapacity(mockSpec, ground.layers, footing, false);
            const totalCost = opt.count * opt.length * opt.unitCostPerMeter;

            return (
              <div
                key={opt.id}
                className="bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-cyan-300">{opt.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {opt.count}本配置
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 font-mono pt-2 border-t border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">杭長 / 径:</span>
                      <span>L={opt.length}m / D={opt.diameter}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">常時許容押込み Ra:</span>
                      <span className="font-bold text-emerald-300">{bearing.raNormal.toLocaleString()} kN/本</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">基礎全体支持耐力:</span>
                      <span className="font-bold text-cyan-300">
                        {(bearing.raNormal * opt.count).toLocaleString()} kN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">概算直接工事費:</span>
                      <span className="font-bold text-amber-300">
                        約 {(totalCost / 10000).toLocaleString()} 万円
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-1.5 text-[11px]">
                    <div className="text-slate-400">
                      <span className="font-bold text-slate-300">施工性:</span> {opt.constructibility}
                    </div>
                    <div className="text-slate-400">
                      <span className="font-bold text-slate-300">低公害性:</span> {opt.vibrationNoise}
                    </div>
                    <div className="text-slate-400">
                      <span className="font-bold text-slate-300">耐震性能:</span> {opt.seismicPerformance}
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800">
                  <button
                    onClick={() => onApplyPreset(opt.presetKey)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    この形式を設計モデルに適用
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
