import React from 'react';
import { Play, Building2 } from 'lucide-react';
import { DesignProject } from '../../types/load';

interface NavbarProps {
  project: DesignProject;
  onRunCalculation: () => void;
  onResetToSample: (type: 'rc' | 'steel') => void;
  activeTab: string;
  onChangeTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  project,
  onRunCalculation,
  onResetToSample,
  activeTab,
  onChangeTab,
}) => {
  const tabs = [
    { id: 'soil', label: '1. 地盤・液状化' },
    { id: 'spec', label: '2. 杭諸元・支持力' },
    { id: 'arrangement', label: '3. 杭配置・底版' },
    { id: 'loads', label: '4. 作用荷重' },
    { id: 'stability', label: '5. 安定計算結果' },
    { id: 'stress', label: '6. 断面・杭頭照査' },
    { id: 'comparison', label: '7. 杭比較表' },
    { id: 'report', label: '8. 詳細計算書' },
  ];

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      {/* 上段：タイトル & アクションバー */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full min-w-0 items-center gap-3 lg:w-auto">
          <div className="shrink-0 bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-lg text-white shadow-md">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 text-sm sm:text-base font-black text-slate-900 tracking-wide">
                道路橋示方書 杭基礎設計システム
              </span>
              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                H24道示 / 杭基礎設計便覧
              </span>
            </div>
            <div className="max-w-full truncate text-xs font-medium text-slate-500 lg:max-w-md">
              {project.bridgeName} — {project.title}
            </div>
          </div>
        </div>

        {/* コントロールボタン群 */}
        <div className="flex w-full min-w-0 items-center gap-2.5 overflow-x-auto pb-0.5 lg:w-auto lg:justify-end">
          {/* サンプル切り替え */}
          <div className="flex shrink-0 items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => onResetToSample('rc')}
              className="px-2.5 py-1 text-slate-700 hover:text-blue-600 font-medium rounded hover:bg-white transition-all"
              title="場所打ちRC杭モデルをロード"
            >
              場所打ち杭例
            </button>
            <button
              onClick={() => onResetToSample('steel')}
              className="px-2.5 py-1 text-slate-700 hover:text-blue-600 font-medium rounded hover:bg-white transition-all"
              title="鋼管杭斜杭モデルをロード"
            >
              鋼管杭例
            </button>
          </div>

          {/* 計算実行ボタン */}
          <button
            onClick={onRunCalculation}
            className="flex shrink-0 items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md transition-all transform active:scale-95"
          >
            <Play className="w-4 h-4 fill-white" />
            一括計算実行 (F5)
          </button>
        </div>
      </div>

      {/* 下段：ナビゲーションタブバー */}
      <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto border-t border-slate-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
};
