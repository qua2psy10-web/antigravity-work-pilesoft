import React, { useEffect, useRef } from 'react';
import { SoilLayer } from '../../types/soil';

interface SoilBoringLogCanvasProps {
  layers: SoilLayer[];
  groundWaterLevel: number;
  pileTipDepth?: number;
  width?: number;
  height?: number;
}

export const SoilBoringLogCanvas: React.FC<SoilBoringLogCanvasProps> = ({
  layers,
  groundWaterLevel,
  pileTipDepth = 19.5,
  width = 540,
  height = 580,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 高DPI対応
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 背景クリア
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, width, height);

    const maxDepth = Math.max(30, ...layers.map((l) => l.depthBottom), pileTipDepth + 2);
    const marginTop = 40;
    const marginBottom = 30;
    const drawHeight = height - marginTop - marginBottom;

    const scaleY = (depth: number) => marginTop + (depth / maxDepth) * drawHeight;

    // カラム定義
    const colDepthW = 55;
    const colSoilW = 110;
    const colGraphX = colDepthW + colSoilW;
    const colGraphW = width - colGraphX - 25;

    // ヘッダー描画
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, 8, width - 20, 26);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(10, 8, width - 20, 26);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('深度(GL-m)', 10 + colDepthW / 2, 25);
    ctx.fillText('土層名・土質', 10 + colDepthW + colSoilW / 2, 25);
    ctx.fillText('N値プロット (0 〜 50)', colGraphX + colGraphW / 2, 25);

    // グリッド線 (N値 10, 20, 30, 40, 50)
    for (let n = 0; n <= 50; n += 10) {
      const gx = colGraphX + (n / 50) * colGraphW;
      ctx.strokeStyle = n === 0 ? '#475569' : '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, marginTop);
      ctx.lineTo(gx, marginTop + drawHeight);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(n.toString(), gx, marginTop - 4);
    }

    // 各土層の描画
    layers.forEach((layer) => {
      const yTop = scaleY(layer.depthTop);
      const yBottom = scaleY(layer.depthBottom);
      const layerH = yBottom - yTop;

      // 土質ごとの色設定
      let soilColor = '#334155';
      let textColor = '#e2e8f0';
      if (layer.soilType === 'clay') {
        soilColor = '#475569'; // シルト・粘土 (青灰色)
      } else if (layer.soilType === 'sand') {
        soilColor = '#854d0e'; // 砂層 (黄土色暗め)
      } else if (layer.soilType === 'gravel') {
        soilColor = '#1e3a5f'; // 礫層 (深青)
      } else if (layer.soilType === 'rock') {
        soilColor = '#3f3f46'; // 岩盤
      }

      // 土層ブロック背景
      ctx.fillStyle = soilColor;
      ctx.fillRect(10 + colDepthW, yTop, colSoilW, layerH);
      ctx.strokeStyle = '#475569';
      ctx.strokeRect(10 + colDepthW, yTop, colSoilW, layerH);

      // 液状化層ハイライト
      if (layer.isLiquefiable) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fillRect(10 + colDepthW, yTop, colSoilW, layerH);
        ctx.strokeStyle = '#ef4444';
        ctx.strokeRect(10 + colDepthW, yTop, colSoilW, layerH);
      }

      // 深度カラム
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(10, yTop, colDepthW, layerH);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(10, yTop, colDepthW, layerH);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${layer.depthBottom.toFixed(1)}m`, 10 + colDepthW / 2, yBottom - 4);

      // 土層名ラベル
      ctx.fillStyle = textColor;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      const textY = yTop + Math.min(layerH / 2 + 4, 18);
      ctx.fillText(layer.name, 15 + colDepthW, textY);

      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#cbd5e1';
      if (layerH > 35) {
        ctx.fillText(`N=${layer.nValue} γ=${layer.unitWeight}`, 15 + colDepthW, textY + 14);
      }
    });

    // N値折れ線グラフの描画
    ctx.strokeStyle = '#38bdf8'; // sky-400
    ctx.lineWidth = 2;
    ctx.beginPath();
    let isFirst = true;

    layers.forEach((layer) => {
      const midDepth = (layer.depthTop + layer.depthBottom) / 2;
      const y = scaleY(midDepth);
      const nx = colGraphX + (Math.min(50, layer.nValue) / 50) * colGraphW;

      if (isFirst) {
        ctx.moveTo(nx, y);
        isFirst = false;
      } else {
        ctx.lineTo(nx, y);
      }
    });
    ctx.stroke();

    // N値プロット点
    layers.forEach((layer) => {
      const midDepth = (layer.depthTop + layer.depthBottom) / 2;
      const y = scaleY(midDepth);
      const nx = colGraphX + (Math.min(50, layer.nValue) / 50) * colGraphW;

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(nx, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // N値数値表示
      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(` N=${layer.nValue}`, nx + 6, y + 3);
    });

    // 地下水位線 (GL - W.L)
    const gwY = scaleY(groundWaterLevel);
    ctx.strokeStyle = '#06b6d4'; // cyan-500
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(10, gwY);
    ctx.lineTo(width - 15, gwY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#06b6d4';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`▼ 地下水位 GL -${groundWaterLevel.toFixed(1)}m`, width - 20, gwY - 4);

    // 杭先端深度の表示
    if (pileTipDepth) {
      const tipY = scaleY(pileTipDepth);
      ctx.strokeStyle = '#eab308'; // yellow-500
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(10, tipY);
      ctx.lineTo(width - 15, tipY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`▲ 杭先端深度 GL -${pileTipDepth.toFixed(1)}m`, 15, tipY - 4);
    }
  }, [layers, groundWaterLevel, pileTipDepth, width, height]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-md flex flex-col items-center">
      <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <span className="text-xs font-bold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          地盤柱状図・N値プロファイル
        </span>
        <span className="text-[11px] text-slate-400">道示IV / V 準拠</span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="rounded border border-slate-800"
      />
    </div>
  );
};
