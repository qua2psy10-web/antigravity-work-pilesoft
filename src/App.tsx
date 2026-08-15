import { useMemo, useState } from 'react';
import { defaultProject, steelPileSampleProject, ProjectData } from './samples/defaultProjects';
import { runFullDesignCalculation } from './engine';
import { CalculationResult } from './types/calculation';
import { Navbar } from './components/layout/Navbar';
import { SoilView } from './components/views/SoilView';
import { PileSpecView } from './components/views/PileSpecView';
import { ArrangementView } from './components/views/ArrangementView';
import { LoadCasesView } from './components/views/LoadCasesView';
import { StabilityResultView } from './components/views/StabilityResultView';
import { StressCheckView } from './components/views/StressCheckView';
import { ComparisonView } from './components/views/ComparisonView';
import { ReportView } from './components/views/ReportView';

export function App() {
  const [projectData, setProjectData] = useState<ProjectData>(defaultProject);
  const [activeTab, setActiveTab] = useState<string>('soil');
  const calculation = useMemo((): { results: CalculationResult[]; errorMessage?: string } => {
    try {
      return {
        results: runFullDesignCalculation(
          projectData.ground,
          projectData.pileSpecs,
          projectData.pileNodes,
          projectData.footing,
          projectData.loadCases
        ),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '不明な計算エラーです';
      console.error('Calculation Error:', error);
      return { results: [], errorMessage };
    }
  }, [projectData]);

  const results = calculation.results;

  const handleCalculate = () => {
    if (calculation.errorMessage) {
      alert(`計算エラーが発生しました: ${calculation.errorMessage}`);
    }
  };

  const handleResetToSample = (type: 'rc' | 'steel') => {
    if (type === 'rc') {
      setProjectData(defaultProject);
    } else {
      setProjectData(steelPileSampleProject);
    }
  };

  const pileSpec = Object.values(projectData.pileSpecs)[0];
  const pileTipDepth = projectData.footing.depthGL + (pileSpec?.length || 18.0);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans engineering-grid">
      {/* ナビゲーションバー */}
      <Navbar
        project={projectData.project}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onRunCalculation={handleCalculate}
        onResetToSample={handleResetToSample}
      />

      {/* メインコンテンツエリア */}
      <main className="flex-1 max-w-7xl w-full mx-auto pb-12">
        {activeTab === 'soil' && (
          <SoilView
            ground={projectData.ground}
            onChangeGround={(ground) => setProjectData({ ...projectData, ground })}
            pileTipDepth={pileTipDepth}
          />
        )}

        {activeTab === 'spec' && (
          <PileSpecView
            pileSpecs={projectData.pileSpecs}
            onChangeSpecs={(pileSpecs) => setProjectData({ ...projectData, pileSpecs })}
            ground={projectData.ground}
            footing={projectData.footing}
          />
        )}

        {activeTab === 'arrangement' && (
          <ArrangementView
            footing={projectData.footing}
            onChangeFooting={(footing) => setProjectData({ ...projectData, footing })}
            pileNodes={projectData.pileNodes}
            onChangePileNodes={(pileNodes) => setProjectData({ ...projectData, pileNodes })}
            pileSpecs={projectData.pileSpecs}
          />
        )}

        {activeTab === 'loads' && (
          <LoadCasesView
            loadCases={projectData.loadCases}
            onChangeLoadCases={(loadCases) => setProjectData({ ...projectData, loadCases })}
          />
        )}

        {activeTab === 'stability' && (
          <StabilityResultView
            results={results}
            pileSpecs={projectData.pileSpecs}
          />
        )}

        {activeTab === 'stress' && (
          <StressCheckView
            results={results}
            pileSpecs={projectData.pileSpecs}
          />
        )}

        {activeTab === 'comparison' && (
          <ComparisonView
            projectData={projectData}
            onApplyPreset={(type) => {
              handleResetToSample(type);
              setActiveTab('spec');
            }}
          />
        )}

        {activeTab === 'report' && (
          <ReportView
            projectData={projectData}
            results={results}
          />
        )}
      </main>

      {/* フッター (印刷時非表示) */}
      <footer className="no-print border-t border-slate-200 bg-white/90 py-3 text-center text-xs text-slate-500">
        道路橋示方書・同解説 IV下部構造編 / V耐震設計編 参照・簡易照査システム &copy; 2026
      </footer>
    </div>
  );
}

export default App;
