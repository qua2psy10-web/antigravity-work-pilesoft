import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Download,
  FileJson,
  FileText,
  Printer,
} from 'lucide-react';
import { ProjectData } from '../../samples/defaultProjects';
import { CalculationResult, SectionStressCheckResult } from '../../types/calculation';

interface ReportViewProps {
  projectData: ProjectData;
  results: CalculationResult[];
}

type ChapterStatus = 'complete' | 'partial';
interface Chapter {
  id: string;
  number: number;
  label: string;
  status: ChapterStatus;
}

const chapters: Chapter[] = [
  { id: 'report-conditions', number: 1, label: '設計条件', status: 'complete' },
  { id: 'report-stability', number: 2, label: '安定計算', status: 'complete' },
  { id: 'report-section', number: 3, label: '断面計算', status: 'complete' },
  { id: 'report-summary', number: 4, label: '結果一覧', status: 'complete' },
  { id: 'report-preliminary', number: 5, label: '予備計算', status: 'complete' },
  { id: 'report-joint', number: 6, label: '杭頭結合', status: 'complete' },
  { id: 'report-l2', number: 7, label: 'レベル2地震時', status: 'partial' },
  { id: 'report-footing', number: 8, label: '底版照査', status: 'partial' },
  { id: 'report-springs', number: 9, label: '基礎バネ', status: 'complete' },
];

const fmt = (value: number | undefined, digits = 1) =>
  value === undefined || !Number.isFinite(value)
    ? '-'
    : value.toLocaleString('ja-JP', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

const pileTypeLabel: Record<string, string> = {
  cast_in_place_rc: '場所打ちRC杭',
  steel_pipe: '鋼管杭',
  phc: 'PHC杭',
  sc: 'SC杭',
  steel_soil_cement: '鋼管ソイルセメント杭',
  h_beam: 'H形鋼杭',
  rotary_steel: '回転杭',
};

const methodLabel: Record<string, string> = {
  cast_in_place: '場所打ち杭工法',
  driven_hammer: '打込み杭工法（打撃）',
  driven_vibro: '打込み杭工法（バイブロ）',
  inner_excavation: '中掘り杭工法',
  pre_boring: 'プレボーリング杭工法',
  soil_cement: '鋼管ソイルセメント杭工法',
  rotary: '回転圧入工法',
};

const soilTypeLabel: Record<string, string> = {
  sand: '砂質土',
  clay: '粘性土',
  gravel: '礫質土',
  rock: '岩盤',
};

const governingCheck = (result: CalculationResult) =>
  result.sectionChecks.reduce<SectionStressCheckResult | undefined>(
    (current, check) =>
      !current || Math.abs(check.maxMomentM) > Math.abs(current.maxMomentM) ? check : current,
    undefined
  );

const stressPair = (check: SectionStressCheckResult) =>
  check.steelStressSigma !== undefined
    ? [check.steelStressSigma, check.allowableSteelStressSigma]
    : [check.compressiveStressC, check.allowableCompressiveStressC];

const TableWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-full overflow-x-auto border border-slate-300">{children}</div>
);

const ReportSection: React.FC<{
  id: string;
  number: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ id, number, title, subtitle, children }) => (
  <section id={id} className="scroll-mt-28 space-y-3 print:break-before-page">
    <div className="border-b-2 border-slate-900 pb-1.5">
      <h2 className="text-[15px] font-black tracking-wide text-slate-950">
        {number}章 {title}
      </h2>
      {subtitle && <p className="mt-0.5 text-[9px] text-slate-500">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const ChapterStatus: React.FC<{ status: ChapterStatus }> = ({ status }) =>
  status === 'complete' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" /> 完了
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
      <CircleDashed className="h-3.5 w-3.5" /> 簡易
    </span>
  );

export const ReportView: React.FC<ReportViewProps> = ({ projectData, results }) => {
  const [activeChapter, setActiveChapter] = useState(chapters[0].id);
  const { project, ground, pileSpecs, footing, loadCases, pileNodes } = projectData;
  const spec = Object.values(pileSpecs)[0];
  const activePileNodes = pileNodes.filter((pile) => !pile.isOmitted);
  const allCasesPass = results.length > 0 && results.every((result) => result.isStable);
  const standardLabel =
    project.standard === 'R01_DOUJI'
      ? '道路橋示方書・同解説（令和元年版：本実装式の適合確認が必要）'
      : '道路橋示方書・同解説（平成24年3月版）';
  const l2Results = results.filter(
    (result) => result.loadCaseType === 'seismic_l2_t1' || result.loadCaseType === 'seismic_l2_t2'
  );
  const hasIncrementalAnalysis = l2Results.some(
    (result) => result.loadDisplacementCurve?.model === 'incremental_winkler'
  );
  const normalCapacity = results.find((result) => result.loadCaseType === 'normal')?.bearingCapacity;
  const seismicCapacity = results.find((result) => result.loadCaseType === 'seismic_l1')?.bearingCapacity;
  const resultRows = useMemo(
    () => results.map((result) => ({ result, governing: governingCheck(result) })),
    [results]
  );
  const coverage = Math.round(
    chapters.reduce((sum, chapter) => sum + (chapter.status === 'complete' ? 1 : 0.5), 0) /
      chapters.length * 100,
  );

  if (!spec) {
    return <div className="m-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">杭仕様が未入力です。</div>;
  }

  const handlePrint = () => window.print();
  const handleExportJSON = () => {
    const href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(projectData, null, 2))}`;
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${project.id}_pile_design.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };
  const goToChapter = (chapter: Chapter) => {
    setActiveChapter(chapter.id);
    document.getElementById(chapter.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="p-3 sm:p-4">
      <div className="no-print mb-3 flex flex-col gap-3 border border-slate-300 bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-700" />
          <div>
            <div className="text-sm font-black text-slate-900">詳細計算書プレビュー</div>
            <div className="text-[10px] text-slate-500">入力値・計算過程・判定を計算例の章構成で一体出力</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportJSON} className="inline-flex items-center gap-1.5 border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <FileJson className="h-4 w-4" /> JSON出力
          </button>
          <button onClick={handlePrint} className="inline-flex items-center gap-1.5 bg-blue-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-600">
            <Printer className="h-4 w-4" /> 印刷 / PDF出力
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)_250px] lg:items-start">
        <aside className="no-print border border-slate-300 bg-white shadow-sm lg:sticky lg:top-28">
          <div className="border-b border-slate-300 px-3 py-3 text-xs font-black">計算書章構成</div>
          <nav className="p-2" aria-label="計算書章構成">
            {chapters.map((chapter) => (
              <button key={chapter.id} onClick={() => goToChapter(chapter)} className={`flex w-full items-center gap-2 border-b border-slate-100 px-2 py-2.5 text-left last:border-b-0 ${activeChapter === chapter.id ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-black ${activeChapter === chapter.id ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white'}`}>{chapter.number}</span>
                <span className="min-w-0 flex-1 text-[11px] font-bold">{chapter.label}</span>
                <ChapterStatus status={chapter.status} />
              </button>
            ))}
          </nav>
          <p className="border-t border-slate-200 px-3 py-2 text-[9px] leading-4 text-slate-500">「簡易」は計算例の全詳細を未実装です。</p>
        </aside>

        <main className="min-w-0">
          <div className="no-print mb-2 flex items-center justify-between border border-slate-300 bg-white px-3 py-2 text-[10px] text-slate-600">
            <span>詳細計算書 / 全8章</span><span className="font-mono">A4縦・印刷倍率 100%</span>
          </div>
          <article className="mx-auto max-w-[210mm] space-y-10 bg-white px-5 py-7 text-[10px] leading-relaxed text-slate-900 shadow-xl sm:px-8 sm:py-10 print:max-w-none print:space-y-8 print:p-0 print:shadow-none">
            <header className="border-b-2 border-slate-900 pb-5 text-center">
              <p className="mb-2 text-[10px] font-bold text-slate-600">{standardLabel} 参照</p>
              <h1 className="text-xl font-black tracking-[0.22em]">杭基礎設計計算書</h1>
              <p className="mt-2 text-sm font-bold">{project.title}</p>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-left text-[9px] sm:grid-cols-3">
                <span>構造物名：{project.bridgeName}</span><span>設計年月日：{project.date}</span><span>設計者：{project.author}</span>
                <span>所在地：{project.location}</span><span>データID：{project.id}</span><span>出力区分：詳細出力</span>
              </div>
            </header>

            <ReportSection id="report-conditions" number={1} title="設計条件">
              <h3 className="font-black">1.1 一般事項・杭の条件</h3>
              <TableWrap><table className="w-full min-w-[620px] border-collapse"><tbody>
                <tr className="border-b border-slate-300"><th className="w-28 bg-slate-100 p-1.5 text-left">適用基準</th><td className="p-1.5">{standardLabel}</td><th className="w-24 bg-slate-100 p-1.5 text-left">地盤種別</th><td className="p-1.5">{ground.groundType}種地盤</td></tr>
                <tr className="border-b border-slate-300"><th className="bg-slate-100 p-1.5 text-left">杭種・工法</th><td className="p-1.5">{pileTypeLabel[spec.pileType]} / {methodLabel[spec.method]}</td><th className="bg-slate-100 p-1.5 text-left">杭本数</th><td className="p-1.5">{activePileNodes.length} 本</td></tr>
                <tr className="border-b border-slate-300"><th className="bg-slate-100 p-1.5 text-left">杭径 D</th><td className="p-1.5">{fmt(spec.diameter * 1000, 0)} mm</td><th className="bg-slate-100 p-1.5 text-left">設計杭長 L</th><td className="p-1.5">{fmt(spec.length, 2)} m</td></tr>
                <tr><th className="bg-slate-100 p-1.5 text-left">許容圧縮応力度</th><td className="p-1.5">{fmt(spec.allowableCompressiveStress, 2)} N/mm²</td><th className="bg-slate-100 p-1.5 text-left">底版寸法</th><td className="p-1.5">{footing.lengthX} × {footing.lengthY} × {footing.thickness} m</td></tr>
              </tbody></table></TableWrap>
              <h3 className="font-black">1.2 地層データ</h3>
              <TableWrap><table className="w-full min-w-[620px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5">No.</th><th className="p-1.5 text-left">層名</th><th className="p-1.5">土質</th><th className="p-1.5">深度 GL-m</th><th className="p-1.5">N値</th><th className="p-1.5">γ</th><th className="p-1.5">液状化</th></tr></thead><tbody>
                {ground.layers.map((layer, index) => <tr key={layer.id} className="border-t border-slate-200"><td className="p-1.5">{index + 1}</td><td className="p-1.5 text-left">{layer.name}</td><td className="p-1.5">{soilTypeLabel[layer.soilType]}</td><td className="p-1.5">{fmt(layer.depthTop, 1)} - {fmt(layer.depthBottom, 1)}</td><td className="p-1.5">{fmt(layer.nValue, 0)}</td><td className="p-1.5">{fmt(layer.unitWeight, 1)}</td><td className="p-1.5">{layer.isLiquefiable ? '対象' : '対象外'}</td></tr>)}
              </tbody></table></TableWrap>
              <h3 className="font-black">1.3 作用力</h3>
              <TableWrap><table className="w-full min-w-[620px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5 text-left">荷重ケース</th><th className="p-1.5">V (kN)</th><th className="p-1.5">H (kN)</th><th className="p-1.5">M (kN·m)</th><th className="p-1.5">押込み n</th><th className="p-1.5">引抜き n</th></tr></thead><tbody>
                {loadCases.map((loadCase) => <tr key={loadCase.id} className="border-t border-slate-200"><td className="p-1.5 text-left font-bold">{loadCase.name}</td><td className="p-1.5">{fmt(loadCase.verticalForceV)}</td><td className="p-1.5">{fmt(loadCase.horizontalForceH)}</td><td className="p-1.5">{fmt(loadCase.momentM)}</td><td className="p-1.5">{fmt(loadCase.safetyFactorBearing, 2)}</td><td className="p-1.5">{fmt(loadCase.safetyFactorPullout, 2)}</td></tr>)}
              </tbody></table></TableWrap>
            </ReportSection>

            <ReportSection id="report-stability" number={2} title="安定計算" subtitle="剛体フーチング・変位法による簡易線形解析">
              <TableWrap><table className="w-full min-w-[760px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5 text-left">荷重ケース</th><th className="p-1.5">K1</th><th className="p-1.5">K2</th><th className="p-1.5">K3</th><th className="p-1.5">K4</th><th className="p-1.5">δx (mm)</th><th className="p-1.5">δy (mm)</th><th className="p-1.5">α (rad)</th></tr></thead><tbody>
                {results.map((result) => <tr key={result.loadCaseId} className="border-t border-slate-200"><td className="p-1.5 text-left font-bold">{result.loadCaseName}</td><td className="p-1.5">{fmt(result.springMatrix.k1, 0)}</td><td className="p-1.5">{fmt(result.springMatrix.k2, 0)}</td><td className="p-1.5">{fmt(result.springMatrix.k3, 0)}</td><td className="p-1.5">{fmt(result.springMatrix.k4, 0)}</td><td className="p-1.5">{fmt(result.footingDisplacement.deltaX, 3)}</td><td className="p-1.5">{fmt(result.footingDisplacement.deltaY, 3)}</td><td className="p-1.5">{fmt(result.footingDisplacement.alpha, 6)}</td></tr>)}
              </tbody></table></TableWrap>
              {results.map((result) => <div key={result.loadCaseId} className="space-y-1"><h3 className="font-black">{result.loadCaseName} 杭反力</h3><TableWrap><table className="w-full min-w-[580px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1">杭No.</th><th className="p-1">X</th><th className="p-1">Y</th><th className="p-1">P (kN)</th><th className="p-1">H (kN)</th><th className="p-1">M (kN·m)</th></tr></thead><tbody>{result.pileReactions.map((reaction) => <tr key={reaction.pileNodeId} className="border-t border-slate-200"><td className="p-1">{reaction.pileNodeId}</td><td className="p-1">{fmt(reaction.x, 2)}</td><td className="p-1">{fmt(reaction.y, 2)}</td><td className="p-1">{fmt(reaction.axialForceP)}</td><td className="p-1">{fmt(reaction.shearForceH)}</td><td className="p-1">{fmt(reaction.bendingMomentM)}</td></tr>)}</tbody></table></TableWrap></div>)}
            </ReportSection>

            <ReportSection id="report-section" number={3} title="断面計算" subtitle="Changの弾性梁解による深度別断面力と杭体応力度の簡易照査">
              <TableWrap><table className="w-full min-w-[700px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5 text-left">荷重ケース</th><th className="p-1.5">杭No.</th><th className="p-1.5">Mmax</th><th className="p-1.5">深度</th><th className="p-1.5">Smax</th><th className="p-1.5">応力度 / 許容</th><th className="p-1.5">判定</th></tr></thead><tbody>
                {results.flatMap((result) => result.sectionChecks.map((check) => { const [actual, allowable] = stressPair(check); return <tr key={`${result.loadCaseId}-${check.pileNodeId}`} className="border-t border-slate-200"><td className="p-1.5 text-left font-bold">{result.loadCaseName}</td><td className="p-1.5">{check.pileNodeId}</td><td className="p-1.5">{fmt(check.maxMomentM)}</td><td className="p-1.5">{fmt(check.maxMomentDepthZ, 2)} m</td><td className="p-1.5">{fmt(check.maxShearForceS)}</td><td className="p-1.5">{fmt(actual, 2)} / {fmt(allowable, 2)}</td><td className={`p-1.5 font-black ${check.isPass ? 'text-emerald-700' : 'text-red-700'}`}>{check.isPass ? 'OK' : 'NG'}</td></tr>; }))}
              </tbody></table></TableWrap>
            </ReportSection>

            <ReportSection id="report-summary" number={4} title="基礎杭計算結果一覧表">
              <TableWrap><table className="w-full min-w-[700px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5 text-left">荷重ケース</th><th className="p-1.5">最大変位 / 許容</th><th className="p-1.5">最大圧縮 / 許容</th><th className="p-1.5">最大引抜き / 許容</th><th className="p-1.5">Mmax</th><th className="p-1.5">総合判定</th></tr></thead><tbody>
                {resultRows.map(({ result, governing }) => <tr key={result.loadCaseId} className="border-t border-slate-200"><td className="p-1.5 text-left font-bold">{result.loadCaseName}</td><td className="p-1.5">{fmt(result.maxDisplacementMm, 2)} / {fmt(result.allowableDisplacementMm, 1)} mm</td><td className="p-1.5">{fmt(result.maxAxialCompressionKn)} / {fmt(result.allowableBearingKn)} kN</td><td className="p-1.5">{fmt(Math.max(0, -result.maxAxialTensionKn))} / {fmt(result.allowablePulloutKn)} kN</td><td className="p-1.5">{fmt(governing?.maxMomentM)}</td><td className={`p-1.5 font-black ${result.isStable ? 'text-emerald-700' : 'text-red-700'}`}>{result.isStable ? '合格' : '不合格'}</td></tr>)}
              </tbody></table></TableWrap>
              <div className={`border-l-4 p-3 ${allCasesPass ? 'border-emerald-600 bg-emerald-50' : 'border-red-600 bg-red-50'}`}><div className="font-black">設計照査の結論</div><p className="mt-1">{results.length === 0 ? '計算結果がありません。' : allCasesPass ? '本アプリの自動照査対象は全荷重ケースで合格です。' : '不合格の荷重ケースがあります。入力条件と不合格項目を見直してください。'}</p></div>
            </ReportSection>

            <ReportSection id="report-preliminary" number={5} title="予備計算" subtitle="支持力、引抜き抵抗、地盤反力係数および杭軸方向バネの算定値">
              <div className="grid gap-3 sm:grid-cols-2"><div className="border border-slate-300 p-3"><h3 className="font-black">5.1 支持力算定式</h3><div className="mt-2 space-y-1 font-serif text-[11px]"><p>Qp = qd × Ap</p><p>Qs = U × Σ(fi × Li)</p><p>Ru = Qp + Qs</p><p>Ra = Ru / n</p><p>Rpa = Pu / n + W</p></div><p className="mt-2 text-[9px] text-slate-600">引抜き抵抗は地盤抵抗に安全率を適用後、杭自重を加算する。</p></div><TableWrap><table className="w-full border-collapse"><tbody><tr className="border-b border-slate-200"><th className="bg-slate-100 p-1.5 text-left">qd</th><td className="p-1.5">{fmt(normalCapacity?.qd)} kN/m²</td></tr><tr className="border-b border-slate-200"><th className="bg-slate-100 p-1.5 text-left">Ap</th><td className="p-1.5">{fmt(normalCapacity?.ap, 3)} m²</td></tr><tr className="border-b border-slate-200"><th className="bg-slate-100 p-1.5 text-left">Qp</th><td className="p-1.5">{fmt(normalCapacity?.qp)} kN</td></tr><tr className="border-b border-slate-200"><th className="bg-slate-100 p-1.5 text-left">Qs</th><td className="p-1.5">{fmt(normalCapacity?.qs)} kN</td></tr><tr><th className="bg-slate-100 p-1.5 text-left">杭自重 W</th><td className="p-1.5">{fmt(normalCapacity?.pileWeightWp)} kN</td></tr></tbody></table></TableWrap></div>
              <TableWrap><table className="w-full min-w-[620px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5">区分</th><th className="p-1.5">Ru</th><th className="p-1.5">Ra</th><th className="p-1.5">Rpa</th><th className="p-1.5">Kv</th></tr></thead><tbody><tr className="border-t border-slate-200"><th className="p-1.5 text-left">常時</th><td>{fmt(normalCapacity?.ru)}</td><td>{fmt(normalCapacity?.raNormal)}</td><td>{fmt(normalCapacity?.rpaNormal)}</td><td>{fmt(normalCapacity?.kv, 0)}</td></tr><tr className="border-t border-slate-200"><th className="p-1.5 text-left">L1地震時</th><td>{fmt(seismicCapacity?.ru)}</td><td>{fmt(seismicCapacity?.raSeismic)}</td><td>{fmt(seismicCapacity?.rpaSeismic)}</td><td>{fmt(seismicCapacity?.kv, 0)}</td></tr></tbody></table></TableWrap>
            </ReportSection>

            <ReportSection id="report-joint" number={6} title="杭頭結合計算" subtitle="杭頭とフーチング結合部の簡易応力度照査">
              <TableWrap><table className="w-full min-w-[700px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5 text-left">荷重ケース</th><th className="p-1.5">杭No.</th><th className="p-1.5">押抜き τp / 許容</th><th className="p-1.5">支圧 σb / 許容</th><th className="p-1.5">仮想RC応力比</th><th className="p-1.5">判定</th></tr></thead><tbody>{results.flatMap((result) => result.jointChecks.map((check) => <tr key={`${result.loadCaseId}-${check.pileNodeId}`} className="border-t border-slate-200"><td className="p-1.5 text-left font-bold">{result.loadCaseName}</td><td>{check.pileNodeId}</td><td>{fmt(check.punchingShearStress, 3)} / {fmt(check.allowablePunchingShear, 3)}</td><td>{fmt(check.bearingStress, 2)} / {fmt(check.allowableBearingStress, 2)}</td><td>{fmt(check.virtualRcStressRatio, 3)}</td><td className={`font-black ${check.isPass ? 'text-emerald-700' : 'text-red-700'}`}>{check.isPass ? 'OK' : 'NG'}</td></tr>))}</tbody></table></TableWrap>
            </ReportSection>

            <ReportSection id="report-l2" number={7} title="レベル2地震時の照査" subtitle="M-φ骨格・初降伏判定・荷重増分解析">
              <div className="border-l-4 border-amber-500 bg-amber-50 p-3 text-amber-950"><div className="font-black">適用範囲</div><p className="mt-1">{hasIncrementalAnalysis ? '鉛直の場所打ちRC杭は20梁要素に分割し、荷重増分ごとに区間M-φ割線EI、杭軸力および地盤反力上限を更新する。剛体底版の水平変位と回転は各増分で釣合い計算する。pHUは土質強度による簡易p-y上限のため、正式設計では適用基準の式と照合する。' : 'RC系杭はO-C-Y-Uトリリニア、鋼管系杭はMy-Mpバイリニアとし、杭ごとの死荷重時軸力で骨格を作成する。水平力と転倒モーメントを同一比率で漸増し、M-φ割線EIとChang型水平ばねのEI 1/4乗則から荷重変位曲線を推定する。地盤ばね塑性化と各増分での軸力再配分を含む厳密な全体系増分解析ではない。'}</p></div>
              {l2Results.map((result) => (
                <div key={result.loadCaseId} className="space-y-2">
                  <h3 className="font-black">7.{l2Results.indexOf(result) + 1}.1 {result.loadCaseName} M-φ照査</h3>
                  <TableWrap><table className="w-full min-w-[900px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5">杭No.</th><th className="p-1.5">モデル</th><th className="p-1.5">死荷重時N</th><th className="p-1.5">Mc</th><th className="p-1.5">My</th><th className="p-1.5">Mu / Mp</th><th className="p-1.5">応答M</th><th className="p-1.5">応答φ</th><th className="p-1.5">μφ</th><th className="p-1.5">EIeff/EI0</th><th className="p-1.5">状態</th></tr></thead><tbody>{result.momentCurvatureChecks.map((check) => { const cracking = check.points.find((point) => point.label === 'C'); const yielding = check.points.find((point) => point.label === 'Y'); const ultimate = check.points[check.points.length - 1]; return <tr key={check.pileNodeId} className="border-t border-slate-200"><td className="p-1.5 font-bold">{check.pileNodeId}</td><td>{check.modelType === 'trilinear' ? 'C-Y-U' : 'My-Mp'}</td><td>{fmt(check.axialForceForCurve)}</td><td>{fmt(cracking?.moment)}</td><td>{fmt(yielding?.moment)}</td><td>{fmt(ultimate.moment)}</td><td>{fmt(check.demandMoment)}</td><td>{check.demandCurvature.toExponential(3)}</td><td>{fmt(check.ductilityRatio, 3)}</td><td>{fmt(check.effectiveStiffnessRatio, 3)}</td><td className={`font-black ${check.isWithinUltimate && check.converged ? 'text-emerald-700' : 'text-red-700'}`}>{check.state === 'elastic' ? '弾性' : check.state === 'cracked' ? 'ひび割れ後' : check.state === 'yielded' ? '降伏後' : '終局超過'}</td></tr>; })}</tbody></table></TableWrap>
                  {result.loadDisplacementCurve ? <>
                    <h3 className="pt-2 font-black">7.{l2Results.indexOf(result) + 1}.2 荷重変位・初降伏判定</h3>
                    <TableWrap><table className="w-full min-w-[720px] border-collapse text-center"><tbody><tr className="border-b border-slate-200"><th className="bg-slate-100 p-1.5 text-left">支配杭</th><td>{result.loadDisplacementCurve.yieldCheck.governingPileNodeId}</td><th className="bg-slate-100 p-1.5 text-left">設計M / My</th><td>{fmt(result.loadDisplacementCurve.yieldCheck.designMoment)} / {fmt(result.loadDisplacementCurve.yieldCheck.yieldMoment)}</td></tr><tr className="border-b border-slate-200"><th className="bg-slate-100 p-1.5 text-left">初降伏荷重倍率 λy</th><td>{fmt(result.loadDisplacementCurve.yieldCheck.yieldLoadFactor, 3)}</td><th className="bg-slate-100 p-1.5 text-left">初降伏 H / δ</th><td>{fmt(result.loadDisplacementCurve.yieldCheck.yieldHorizontalLoad)} kN / {fmt(result.loadDisplacementCurve.yieldCheck.yieldDisplacement, 2)} mm</td></tr><tr><th className="bg-slate-100 p-1.5 text-left">終局荷重倍率 λu</th><td>{fmt(result.loadDisplacementCurve.yieldCheck.ultimateLoadFactor, 3)}</td><th className="bg-slate-100 p-1.5 text-left">設計荷重時判定</th><td className={`font-black ${result.loadDisplacementCurve.yieldCheck.isWithinUltimateAtDesignLoad ? 'text-emerald-700' : 'text-red-700'}`}>{result.loadDisplacementCurve.yieldCheck.hasYieldedAtDesignLoad ? '降伏到達' : '初降伏前'} / {result.loadDisplacementCurve.yieldCheck.isWithinUltimateAtDesignLoad ? '終局未到達' : '終局超過'}</td></tr></tbody></table></TableWrap>
                    <TableWrap><table className="w-full min-w-[820px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5">荷重倍率</th><th>H (kN)</th><th>M (kN·m)</th><th>δ (mm)</th><th>最大杭体M</th><th>深度</th><th>最大p/pHU</th><th>反復</th><th>状態</th></tr></thead><tbody>{result.loadDisplacementCurve.points.map((point) => <tr key={point.loadFactor} className="border-t border-slate-200"><td>{fmt(point.loadFactor, 2)}</td><td>{fmt(point.horizontalLoad)}</td><td>{fmt(point.overturningMoment)}</td><td>{fmt(point.displacement, 3)}</td><td>{fmt(point.maxMoment)}</td><td>{fmt(point.maxMomentDepth, 2)}</td><td>{fmt(point.soilYieldRatio, 3)}</td><td>{point.iterations ?? '-'}</td><td>{point.state === 'elastic' ? '弾性' : point.state === 'cracked' ? 'ひび割れ後' : point.state === 'yielded' ? '降伏後' : '終局超過'}</td></tr>)}</tbody></table></TableWrap>
                  </> : null}
                </div>
              ))}
              <TableWrap><table className="w-full min-w-[620px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5 text-left">ケース</th><th className="p-1.5">弾性β</th><th className="p-1.5">kH</th><th className="p-1.5">最大変位</th><th className="p-1.5">最大圧縮</th><th className="p-1.5">総合判定</th></tr></thead><tbody>{l2Results.map((result) => <tr key={result.loadCaseId} className="border-t border-slate-200"><td className="p-1.5 text-left font-bold">{result.loadCaseName}</td><td>{fmt(result.springMatrix.beta, 4)}</td><td>{fmt(result.springMatrix.kh, 0)}</td><td>{fmt(result.maxDisplacementMm, 2)} mm</td><td>{fmt(result.maxAxialCompressionKn)} kN</td><td className={`font-black ${result.isStable ? 'text-emerald-700' : 'text-red-700'}`}>{result.isStable ? 'OK' : 'NG'}</td></tr>)}</tbody></table></TableWrap>
            </ReportSection>

            <ReportSection id="report-footing" number={8} title="底版詳細照査" subtitle="柱前面曲げ・一方向せん断・柱周囲押抜きせん断">
              <TableWrap><table className="w-full min-w-[720px] border-collapse text-center"><tbody><tr className="border-b border-slate-200"><th className="bg-slate-100 p-1.5 text-left">柱寸法 X × Y</th><td>{fmt(footing.columnLengthX ?? 2, 2)} × {fmt(footing.columnLengthY ?? 2, 2)} m</td><th className="bg-slate-100 p-1.5 text-left">鉄筋降伏強度</th><td>{fmt(footing.rebarYieldStrength ?? 295, 0)} N/mm²</td></tr><tr><th className="bg-slate-100 p-1.5 text-left">上側 / 下側かぶり</th><td>{fmt(footing.topRebarCover ?? 110, 0)} / {fmt(footing.bottomRebarCover ?? 150, 0)} mm</td><th className="bg-slate-100 p-1.5 text-left">斜引張鉄筋</th><td>D{fmt(footing.shearRebarDiameter ?? 16, 0)} @ {fmt(footing.shearRebarSpacing ?? 250, 0)} mm</td></tr></tbody></table></TableWrap>
              {results.map((result, index) => <div key={result.loadCaseId} className="space-y-2"><h3 className="font-black">8.{index + 1} {result.loadCaseName}</h3><TableWrap><table className="w-full min-w-[940px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5">方向</th><th>正曲げ / My+</th><th>負曲げ / My-</th><th>必要As下 / 配筋As</th><th>必要As上 / 配筋As</th><th>曲げ比</th><th>せん断 / 耐力</th><th>せん断比</th><th>判定</th></tr></thead><tbody>{result.footingCheck.directions.map((direction) => <tr key={direction.direction} className="border-t border-slate-200"><td className="font-black">{direction.direction}</td><td>{fmt(direction.positiveMoment)} / {fmt(direction.positiveMomentCapacity)}</td><td>{fmt(direction.negativeMoment)} / {fmt(direction.negativeMomentCapacity)}</td><td>{fmt(direction.requiredBottomRebarArea, 0)} / {fmt(direction.bottomRebarArea, 0)}</td><td>{fmt(direction.requiredTopRebarArea, 0)} / {fmt(direction.topRebarArea, 0)}</td><td>{fmt(direction.flexureUtilization, 3)}</td><td>{fmt(direction.designShear)} / {fmt(direction.shearCapacity)}</td><td>{fmt(direction.shearUtilization, 3)}</td><td className={`font-black ${direction.isFlexurePass && direction.isShearPass ? 'text-emerald-700' : 'text-red-700'}`}>{direction.isFlexurePass && direction.isShearPass ? 'OK' : 'NG'}</td></tr>)}</tbody></table></TableWrap><TableWrap><table className="w-full min-w-[620px] border-collapse text-center"><tbody><tr><th className="bg-slate-100 p-1.5 text-left">押抜き設計せん断</th><td>{fmt(result.footingCheck.punching.designShear)} kN</td><th className="bg-slate-100 p-1.5 text-left">押抜き耐力</th><td>{fmt(result.footingCheck.punching.capacity)} kN</td><th className="bg-slate-100 p-1.5 text-left">照査比</th><td>{fmt(result.footingCheck.punching.utilization, 3)}</td><td className={`font-black ${result.footingCheck.punching.isPass ? 'text-emerald-700' : 'text-red-700'}`}>{result.footingCheck.punching.isPass ? 'OK' : 'NG'}</td></tr></tbody></table></TableWrap></div>)}
              <div className="border-l-4 border-amber-500 bg-amber-50 p-3 text-amber-950"><div className="font-black">適用範囲</div><p className="mt-1">矩形等厚底版の反力包絡による簡易詳細照査である。テーパー、有効幅換算、上載土・浮力の個別分解、柱間断面および局部荷重分散は別途確認する。</p></div>
            </ReportSection>

            <ReportSection id="report-springs" number={9} title="基礎バネ計算">
              <TableWrap><table className="w-full min-w-[760px] border-collapse text-center"><thead className="bg-slate-100"><tr><th className="p-1.5 text-left">荷重ケース</th><th className="p-1.5">kH</th><th className="p-1.5">β</th><th className="p-1.5">K1</th><th className="p-1.5">K2</th><th className="p-1.5">K3</th><th className="p-1.5">K4</th><th className="p-1.5">Kv</th></tr></thead><tbody>{results.map((result) => <tr key={result.loadCaseId} className="border-t border-slate-200"><td className="p-1.5 text-left font-bold">{result.loadCaseName}</td><td>{fmt(result.springMatrix.kh, 0)}</td><td>{fmt(result.springMatrix.beta, 4)}</td><td>{fmt(result.springMatrix.k1, 0)}</td><td>{fmt(result.springMatrix.k2, 0)}</td><td>{fmt(result.springMatrix.k3, 0)}</td><td>{fmt(result.springMatrix.k4, 0)}</td><td>{fmt(result.springMatrix.kv, 0)}</td></tr>)}</tbody></table></TableWrap>
              <footer className="border-t border-slate-400 pt-4 text-center text-[9px] text-slate-500">以上 — 本計算書は簡易照査システムによる出力です。入力条件、適用条項および計算モデルを設計者が確認してください。</footer>
            </ReportSection>
          </article>
        </main>

        <aside className="no-print space-y-3 lg:sticky lg:top-28">
          <section className="border border-slate-300 bg-white p-3 shadow-sm"><h2 className="text-xs font-black">総合判定</h2><div className={`mt-3 border p-4 text-center ${allCasesPass ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>{allCasesPass ? <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /> : <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />}<div className={`mt-1 text-lg font-black ${allCasesPass ? 'text-emerald-800' : 'text-red-800'}`}>{allCasesPass ? '照査OK' : 'NGあり'}</div><p className="mt-1 text-[10px] text-slate-600">{results.length === 0 ? '計算結果なし' : `${results.filter((result) => result.isStable).length} / ${results.length} ケース合格`}</p></div></section>
          <section className="border border-slate-300 bg-white p-3 shadow-sm"><h2 className="text-xs font-black">荷重ケース別判定</h2><div className="mt-2 divide-y divide-slate-200 border border-slate-200">{results.map((result) => <div key={result.loadCaseId} className="flex items-center gap-2 px-2 py-2 text-[10px]">{result.isStable ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}<span className="min-w-0 flex-1 truncate" title={result.loadCaseName}>{result.loadCaseName}</span><span className={`font-black ${result.isStable ? 'text-emerald-700' : 'text-red-700'}`}>{result.isStable ? 'OK' : 'NG'}</span></div>)}</div></section>
          <section className="border border-slate-300 bg-white p-3 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xs font-black">章構成カバー</h2><span className="text-lg font-black text-blue-700">{coverage}%</span></div><div className="mt-2 h-2 bg-slate-200"><div className="h-full bg-blue-700" style={{ width: `${coverage}%` }} /></div><p className="mt-2 text-[9px] leading-4 text-slate-500">7章は場所打ちRC杭の深度方向増分解析、8章は矩形等厚底版の反力包絡まで実装。PHC・SC・鋼管杭の増分解析とテーパー・柱間底版は今後の対象です。</p></section>
          <section className="border border-slate-300 bg-white p-3 shadow-sm"><h2 className="text-xs font-black">出力・エクスポート</h2><div className="mt-3 grid gap-2"><button onClick={handlePrint} className="flex items-center justify-between border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50"><span className="inline-flex items-center gap-2"><Printer className="h-4 w-4" /> 印刷プレビュー</span><ChevronRight className="h-4 w-4" /></button><button onClick={handlePrint} className="flex items-center justify-between bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-600"><span className="inline-flex items-center gap-2"><Download className="h-4 w-4" /> PDF出力</span><ChevronRight className="h-4 w-4" /></button><button onClick={handleExportJSON} className="flex items-center justify-between border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50"><span className="inline-flex items-center gap-2"><FileJson className="h-4 w-4" /> JSON出力</span><ChevronRight className="h-4 w-4" /></button></div></section>
          <section className="border border-red-200 bg-red-50 p-3 text-red-900 shadow-sm"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /><div><h2 className="text-xs font-black">注意事項</h2><p className="mt-1 text-[10px] leading-4">場所打ちRC杭は簡易p-y上限を用いた荷重増分解析、その他の杭種は等価割線推定、底版は矩形等厚断面の簡易詳細照査です。正式設計では基準版、材料構成則、地盤反力上限、テーパー・柱間断面を別途確認してください。</p></div></div></section>
        </aside>
      </div>
    </div>
  );
};
