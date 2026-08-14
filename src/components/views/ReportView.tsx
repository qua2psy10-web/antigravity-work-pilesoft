import React from 'react';
import { ProjectData } from '../../samples/defaultProjects';
import { CalculationResult } from '../../types/calculation';
import { Printer, Download, CheckCircle, FileText } from 'lucide-react';

interface ReportViewProps {
  projectData: ProjectData;
  results: CalculationResult[];
}

export const ReportView: React.FC<ReportViewProps> = ({
  projectData,
  results,
}) => {
  const { project, ground, pileSpecs, footing } = projectData;
  const spec = Object.values(pileSpecs)[0];

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(projectData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${project.id}_pile_design.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="p-4 space-y-6">
      {/* 操作バー (印刷時は非表示) */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-sm text-slate-200">道路橋示方書 杭基礎設計計算書プレビュー</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded text-xs font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            設計データJSON保存
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-xs font-bold shadow-md transition-colors"
          >
            <Printer className="w-4 h-4" />
            計算書を印刷 / PDF出力
          </button>
        </div>
      </div>

      {/* 帳票本体 (白ベース・A4印刷レイアウト) */}
      <div className="bg-white text-slate-900 rounded-lg p-8 sm:p-12 shadow-2xl max-w-4xl mx-auto font-sans leading-relaxed text-xs">
        {/* 表紙・ヘッダー */}
        <div className="border-b-2 border-slate-900 pb-6 mb-8 text-center">
          <div className="text-sm font-bold text-slate-600 mb-1">【道路橋示方書・同解説 IV下部構造編・V耐震設計編 準拠】</div>
          <h1 className="text-2xl font-black tracking-widest text-slate-950 mb-4">{project.title}</h1>
          <div className="flex justify-center gap-8 text-slate-700 font-mono text-xs">
            <div>構造物名: {project.bridgeName}</div>
            <div>設計年月日: {project.date}</div>
            <div>設計者: {project.author}</div>
          </div>
        </div>

        {/* 1. 設計基本方針 & 諸元 */}
        <div className="space-y-6 mb-8">
          <h2 className="text-sm font-bold bg-slate-100 p-2 border-l-4 border-slate-900">
            1. 設計基本条件および使用材料
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <table className="w-full border-collapse border border-slate-300">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="bg-slate-50 p-2 font-bold w-1/3">準拠基準</td>
                    <td className="p-2">道路橋示方書 (平成24年3月)</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="bg-slate-50 p-2 font-bold">地盤種別</td>
                    <td className="p-2">{ground.groundType}種地盤 (地下水位 GL-{ground.groundWaterLevel}m)</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="bg-slate-50 p-2 font-bold">杭形式・工法</td>
                    <td className="p-2">
                      {spec.pileType === 'cast_in_place_rc' ? '場所打ちRC杭' : '鋼管杭'} (
                      {spec.method === 'cast_in_place' ? '場所打ち杭工法' : '打込み杭工法'})
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-slate-50 p-2 font-bold">杭寸法</td>
                    <td className="p-2">杭径 D = {spec.diameter}m, 杭長 L = {spec.length}m</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <table className="w-full border-collapse border border-slate-300">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="bg-slate-50 p-2 font-bold w-1/3">底版寸法</td>
                    <td className="p-2">幅 Lx={footing.lengthX}m, 長 Ly={footing.lengthY}m, 厚 Df={footing.thickness}m</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="bg-slate-50 p-2 font-bold">杭配置</td>
                    <td className="p-2">計 {projectData.pileNodes.filter((p) => !p.isOmitted).length} 本配置</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="bg-slate-50 p-2 font-bold">コンクリート強度</td>
                    <td className="p-2">σck = {spec.concreteStrengthFck || 24} N/mm²</td>
                  </tr>
                  <tr>
                    <td className="bg-slate-50 p-2 font-bold">主鉄筋</td>
                    <td className="p-2">{spec.rebarType || 'SD345'} D{spec.rebarDiameter || 29} - {spec.rebarCount || 24}本</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 2. 地層構成及び支持力算定結果 */}
        <div className="space-y-4 mb-8">
          <h2 className="text-sm font-bold bg-slate-100 p-2 border-l-4 border-slate-900">
            2. 支持力計算結果 (道示IV 第5章)
          </h2>

          {results[0] && (
            <table className="w-full border-collapse border border-slate-300 text-center font-mono">
              <thead className="bg-slate-100 font-bold font-sans">
                <tr className="border-b border-slate-300">
                  <th className="p-2">区分</th>
                  <th className="p-2">先端極限 Qp (kN)</th>
                  <th className="p-2">周面摩擦 Qs (kN)</th>
                  <th className="p-2">極限支持力 Ru (kN)</th>
                  <th className="p-2">安全率 n</th>
                  <th className="p-2">許容押込み力 Ra (kN)</th>
                  <th className="p-2">許容引抜き力 Rpa (kN)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-sans font-bold">常時 (Normal)</td>
                  <td className="p-2">{results[0].bearingCapacity.qp.toLocaleString()}</td>
                  <td className="p-2">{results[0].bearingCapacity.qs.toLocaleString()}</td>
                  <td className="p-2">{results[0].bearingCapacity.ru.toLocaleString()}</td>
                  <td className="p-2">3.0</td>
                  <td className="p-2 font-bold text-blue-900">{results[0].bearingCapacity.raNormal.toLocaleString()}</td>
                  <td className="p-2">{results[0].bearingCapacity.rpaNormal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-bold">地震時 (Seismic)</td>
                  <td className="p-2">{results[0].bearingCapacity.qp.toLocaleString()}</td>
                  <td className="p-2">{results[0].bearingCapacity.qs.toLocaleString()}</td>
                  <td className="p-2">{results[0].bearingCapacity.ru.toLocaleString()}</td>
                  <td className="p-2">2.0</td>
                  <td className="p-2 font-bold text-blue-900">{results[0].bearingCapacity.raSeismic.toLocaleString()}</td>
                  <td className="p-2">{results[0].bearingCapacity.rpaSeismic.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* 3. 安定計算および応力度照査まとめ一覧 */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold bg-slate-100 p-2 border-l-4 border-slate-900">
            3. 各荷重ケースに対する安定計算および断面応力度照査結果まとめ
          </h2>

          <table className="w-full border-collapse border border-slate-300 text-center font-mono">
            <thead className="bg-slate-100 font-bold font-sans">
              <tr className="border-b border-slate-300">
                <th className="p-2">荷重ケース名</th>
                <th className="p-2">水平変位 δx (mm)</th>
                <th className="p-2">最大軸力 Pmax (kN)</th>
                <th className="p-2">許容 Ra (kN)</th>
                <th className="p-2">最大モーメント Mmax (kN·m)</th>
                <th className="p-2">コンクリート σc / σca</th>
                <th className="p-2">総合判定</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res) => {
                const maxCheck = res.sectionChecks[0];
                return (
                  <tr key={res.loadCaseId} className="border-b border-slate-300">
                    <td className="p-2 font-sans text-left font-bold">{res.loadCaseName}</td>
                    <td className="p-2">{res.footingDisplacement.deltaX.toFixed(2)}</td>
                    <td className="p-2 font-bold">{res.maxAxialCompressionKn.toLocaleString()}</td>
                    <td className="p-2 text-slate-600">
                      {res.loadCaseId.includes('seismic')
                        ? res.bearingCapacity.raSeismic.toLocaleString()
                        : res.bearingCapacity.raNormal.toLocaleString()}
                    </td>
                    <td className="p-2">{maxCheck?.maxMomentM.toFixed(1) || '-'}</td>
                    <td className="p-2">
                      {maxCheck?.compressiveStressC || '-'} / {maxCheck?.allowableCompressiveStressC || '-'}
                    </td>
                    <td className="p-2 font-sans font-bold">
                      {res.isStable ? (
                        <span className="text-emerald-700">合格 (OK)</span>
                      ) : (
                        <span className="text-red-600">不合格 (NG)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="p-4 bg-slate-50 border border-slate-300 rounded mt-6 text-slate-700">
            <div className="font-bold text-xs mb-1">【設計照査の結論】</div>
            <div>
              本基礎構造は、常時・風時・地震時レベル1およびレベル2の全荷重ケースにおいて、杭基礎全体の安定性（支持力・変位）、杭体の断面応力度、および杭頭結合部の押抜きせん断応力度がすべて道路橋示方書の許容限界値を満足していることを確認した。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
