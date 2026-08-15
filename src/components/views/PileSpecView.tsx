import React from 'react';
import { PileSpecification, PileType, PileMethod, PileBearingType, FootingDimension } from '../../types/pile';
import { GroundCondition } from '../../types/soil';
import { calculateBearingCapacity } from '../../engine/bearingCapacity';
import { Layers, Activity, CheckCircle, Info } from 'lucide-react';

function calculateCircularSectionProperties(spec: PileSpecification): Pick<PileSpecification, 'crossSectionAreaA' | 'momentOfInertiaI'> {
  const D = spec.diameter;
  if (spec.pileType === 'cast_in_place_rc' || spec.pileType === 'phc') {
    return {
      crossSectionAreaA: (Math.PI * D ** 2) / 4.0,
      momentOfInertiaI: (Math.PI * D ** 4) / 64.0,
    };
  }

  if (spec.pileType === 'steel_pipe' || spec.pileType === 'steel_soil_cement' || spec.pileType === 'rotary_steel') {
    const wallThickness = spec.wallThickness ?? 12.0;
    const corrosionAllowance = spec.corrosionAllowance ?? 0.0;
    const effectiveThickness = Math.max(0, (wallThickness - corrosionAllowance) / 1000);
    const innerDiameter = Math.max(0, D - 2.0 * effectiveThickness);
    return {
      crossSectionAreaA: (Math.PI * (D ** 2 - innerDiameter ** 2)) / 4.0,
      momentOfInertiaI: (Math.PI * (D ** 4 - innerDiameter ** 4)) / 64.0,
    };
  }

  return {
    crossSectionAreaA: spec.crossSectionAreaA,
    momentOfInertiaI: spec.momentOfInertiaI,
  };
}

interface PileSpecViewProps {
  pileSpecs: { [id: string]: PileSpecification };
  onChangeSpecs: (specs: { [id: string]: PileSpecification }) => void;
  ground: GroundCondition;
  footing: FootingDimension;
}

export const PileSpecView: React.FC<PileSpecViewProps> = ({
  pileSpecs,
  onChangeSpecs,
  ground,
  footing,
}) => {
  const activeSpecId = Object.keys(pileSpecs)[0];
  const spec = pileSpecs[activeSpecId];

  if (!spec) return null;

  const bearingNormal = calculateBearingCapacity(spec, ground.layers, footing, false);
  const bearingSeismic = calculateBearingCapacity(spec, ground.layers, footing, true);
  const normalBearingFactor = spec.bearingType === 'friction' ? 4.0 : 3.0;
  const seismicBearingFactor = spec.bearingType === 'friction' ? 3.0 : 2.0;

  const handleUpdate = (updated: Partial<PileSpecification>) => {
    const updatedSpec = {
      ...spec,
      ...updated,
    };
    const sectionProperties = calculateCircularSectionProperties(updatedSpec);
    const newSpec = { ...updatedSpec, ...sectionProperties };

    onChangeSpecs({
      ...pileSpecs,
      [activeSpecId]: newSpec,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4">
      {/* 左側：杭基本諸元入力 (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        {/* 杭基本仕様カード */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            杭種・施工法・幾何形状
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">杭種別</label>
              <select
                value={spec.pileType}
                onChange={(e) => handleUpdate({ pileType: e.target.value as PileType })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="cast_in_place_rc">場所打ち杭 (RC)</option>
                <option value="steel_pipe">鋼管杭 (SKK)</option>
                <option value="phc">PHC杭 (既製コンクリート)</option>
                <option value="sc">SC杭 (外殻鋼管付き)</option>
                <option value="steel_soil_cement">鋼管ソイルセメント杭</option>
                <option value="rotary_steel">回転杭工法</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">施工工法</label>
              <select
                value={spec.method}
                onChange={(e) => handleUpdate({ method: e.target.value as PileMethod })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="cast_in_place">場所打ち杭工法</option>
                <option value="driven_hammer">打込み杭工法 (打撃)</option>
                <option value="pre_boring">プレボーリング杭工法</option>
                <option value="inner_excavation">中掘り杭工法</option>
                <option value="rotary">回転圧入工法</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">支持形式</label>
              <select
                value={spec.bearingType}
                onChange={(e) => handleUpdate({ bearingType: e.target.value as PileBearingType })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="end_bearing">支持杭 (先端支持)</option>
                <option value="friction">摩擦杭</option>
                <option value="semi_end_bearing">摩擦杭 (安全率同等)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">杭径 D (m)</label>
              <input
                type="number"
                step="0.1"
                value={spec.diameter}
                onChange={(e) => handleUpdate({ diameter: parseFloat(e.target.value) || 1.0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-blue-700 font-bold font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">杭長 L (m)</label>
              <input
                type="number"
                step="0.5"
                value={spec.length}
                onChange={(e) => handleUpdate({ length: parseFloat(e.target.value) || 10.0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-blue-700 font-bold font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ヤング係数 E (kN/m²)</label>
              <input
                type="number"
                value={spec.modulusE}
                onChange={(e) => handleUpdate({ modulusE: parseFloat(e.target.value) || 2.5e7 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">断面二次モーメント I (m⁴)</label>
              <input
                type="number"
                step="0.001"
                value={parseFloat(spec.momentOfInertiaI.toFixed(4))}
                onChange={(e) => handleUpdate({ momentOfInertiaI: parseFloat(e.target.value) || 0.01 })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 断面・材料強度・配筋仕様カード */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            材料強度・配筋条件 (断面計算用)
          </h3>

          {spec.pileType === 'cast_in_place_rc' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">コンクリート σck (N/mm²)</label>
                <input
                  type="number"
                  value={spec.concreteStrengthFck || 24}
                  onChange={(e) => handleUpdate({ concreteStrengthFck: parseInt(e.target.value) || 24 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">主鉄筋種類</label>
                <select
                  value={spec.rebarType || 'SD345'}
                  onChange={(e) => handleUpdate({ rebarType: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="SD345">SD345</option>
                  <option value="SD390">SD390</option>
                  <option value="SD490">SD490</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">主鉄筋径 / 本数</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={spec.rebarDiameter || 29}
                    onChange={(e) => handleUpdate({ rebarDiameter: parseInt(e.target.value) || 29 })}
                    className="w-1/2 bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500"
                    placeholder="D29"
                  />
                  <input
                    type="number"
                    value={spec.rebarCount || 24}
                    onChange={(e) => handleUpdate({ rebarCount: parseInt(e.target.value) || 24 })}
                    className="w-1/2 bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500"
                    placeholder="24本"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">かぶり厚 (mm)</label>
                <input
                  type="number"
                  value={spec.rebarCover || 120}
                  onChange={(e) => handleUpdate({ rebarCover: parseInt(e.target.value) || 120 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">鋼管肉厚 t (mm)</label>
                <input
                  type="number"
                  step="1"
                  value={spec.wallThickness ?? 12}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    handleUpdate({ wallThickness: Number.isFinite(value) ? Math.max(0, value) : 12 });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">腐食代 (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={spec.corrosionAllowance ?? 0}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    handleUpdate({ corrosionAllowance: Number.isFinite(value) ? Math.max(0, value) : 0 });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">鋼材基準強度 (N/mm²)</label>
                <input
                  type="number"
                  value={spec.allowableCompressiveStress || 140}
                  onChange={(e) => handleUpdate({ allowableCompressiveStress: parseFloat(e.target.value) || 140 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右側：支持力・地盤バネ算定結果カード (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              単杭支持力 & バネ定数 (道示IV)
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
              自動算定
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* 常時支持力 */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="text-slate-700 font-bold mb-2 flex items-center justify-between">
                <span>【常時】支持力照査値 (安全率 n={normalBearingFactor.toFixed(1)})</span>
                <span className="text-blue-700 font-bold">Normal Case</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-700 font-mono">
                <div>先端極限力 Qp: <span className="font-bold text-slate-900">{bearingNormal.qp.toLocaleString()}</span> kN</div>
                <div>周面摩擦力 Qs: <span className="font-bold text-slate-900">{bearingNormal.qs.toLocaleString()}</span> kN</div>
                <div>極限押込み Ru: <span className="font-bold text-blue-700">{bearingNormal.ru.toLocaleString()}</span> kN</div>
                <div>杭自重 Wp: <span className="font-bold text-slate-900">{bearingNormal.pileWeightWp.toLocaleString()}</span> kN</div>
                <div className="col-span-2 pt-2 border-t border-slate-200 text-sm flex justify-between">
                  <span className="text-emerald-700 font-bold">許容押込み力 Ra:</span>
                  <span className="font-bold text-emerald-700 text-base">{bearingNormal.raNormal.toLocaleString()} kN</span>
                </div>
                <div className="col-span-2 text-xs flex justify-between text-slate-600">
                  <span>許容引抜き力 Rpa:</span>
                  <span className="font-bold text-slate-800">{bearingNormal.rpaNormal.toLocaleString()} kN</span>
                </div>
              </div>
            </div>

            {/* 地震時支持力 */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="text-slate-700 font-bold mb-2 flex items-center justify-between">
                <span>【暴風時・L1地震時】支持力照査値 (安全率 n={seismicBearingFactor.toFixed(1)})</span>
                <span className="text-amber-700 font-bold">Seismic Case</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-700 font-mono">
                <div className="col-span-2 text-sm flex justify-between">
                  <span className="text-amber-700 font-bold">許容押込み力 Ra (地震):</span>
                  <span className="font-bold text-amber-700 text-base">{bearingSeismic.raSeismic.toLocaleString()} kN</span>
                </div>
                <div className="col-span-2 text-xs flex justify-between text-slate-600">
                  <span>許容引抜き力 Rpa (地震):</span>
                  <span className="font-bold text-slate-800">{bearingSeismic.rpaSeismic.toLocaleString()} kN</span>
                </div>
              </div>
            </div>

            {/* 軸方向地盤バネ Kv */}
            <div className="bg-blue-50/60 p-3.5 rounded-lg border border-blue-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-blue-950 text-xs">軸方向地盤反力係数 Kv</div>
                <div className="text-[10px] text-blue-700">Kv = a · (Ap · Ep / L)</div>
              </div>
              <div className="text-base font-bold font-mono text-blue-700">
                {bearingNormal.kv.toLocaleString()} <span className="text-xs font-normal text-slate-600">kN/m</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              杭先端深度 (GL-{(footing.depthGL + spec.length).toFixed(1)}m) に基づき、支持層の土質およびN値から先端支持力度 qd を自動算定しています。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
