import React, { useEffect, useRef, useState } from 'react';
import { PileNode, PileSpecification, FootingDimension } from '../../types/pile';
import { SoilLayer } from '../../types/soil';

interface PileArrangementCanvasProps {
  footing: FootingDimension;
  pileNodes: PileNode[];
  pileSpecs: { [id: string]: PileSpecification };
  layers?: SoilLayer[];
  width?: number;
  height?: number;
}

export const PileArrangementCanvas: React.FC<PileArrangementCanvasProps> = ({
  footing,
  pileNodes,
  pileSpecs,
  layers,
  width = 540,
  height = 580,
}) => {
  const [viewMode, setViewMode] = useState<'plan' | 'elevation'>('plan');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    if (viewMode === 'plan') {
      // ================= 平面図描画 =================
      const cx = width / 2;
      const cy = height / 2;

      // スケール計算
      const maxDim = Math.max(footing.lengthX, footing.lengthY) + 2.0;
      const scale = (Math.min(width, height) - 100) / maxDim;

      // グリッド線
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = -10; i <= 10; i += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + i * scale, 30);
        ctx.lineTo(cx + i * scale, height - 30);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(30, cy + i * scale);
        ctx.lineTo(width - 30, cy + i * scale);
        ctx.stroke();
      }

      // フーチング外形描画 (長方形)
      const fw = footing.lengthX * scale;
      const fh = footing.lengthY * scale;
      const fx = cx - fw / 2;
      const fy = cy - fh / 2;

      ctx.fillStyle = 'rgba(51, 65, 85, 0.4)'; // slate-700
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeStyle = '#60a5fa'; // blue-400
      ctx.lineWidth = 2;
      ctx.strokeRect(fx, fy, fw, fh);

      // 中心線 (十字)
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, fy - 20);
      ctx.lineTo(cx, fy + fh + 20);
      ctx.moveTo(fx - 20, cy);
      ctx.lineTo(fx + fw + 20, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // フーチング寸法表記
      ctx.fillStyle = '#93c5fd';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Lx = ${footing.lengthX.toFixed(2)}m`, cx, fy - 8);
      ctx.textAlign = 'left';
      ctx.fillText(`Ly = ${footing.lengthY.toFixed(2)}m`, fx + fw + 8, cy);

      // 各杭の描画 (円形)
      pileNodes.forEach((pile, index) => {
        if (pile.isOmitted) return;
        const spec = pileSpecs[pile.pileSpecId] || Object.values(pileSpecs)[0];
        const pileRadius = ((spec?.diameter || 1.0) / 2) * scale;
        const px = cx + pile.x * scale;
        const py = cy + pile.y * scale;

        // 杭円形
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(px, py, pileRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 杭番号 & 座標ラベル
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${index + 1}`, px, py);

        // 斜杭の場合矢印
        if (pile.inclinationAngle !== 0) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const arrowLen = pileRadius * 1.5;
          const dir = pile.x > 0 ? 1 : -1;
          ctx.moveTo(px, py);
          ctx.lineTo(px + dir * arrowLen, py);
          ctx.stroke();
        }
      });
    } else {
      // ================= 立面図描画 =================
      const cx = width / 2;
      const topY = 60;
      const spec = Object.values(pileSpecs)[0];
      const pileL = spec?.length || 18.0;
      const totalDepth = footing.depthGL + pileL + 2.0;

      const scaleY = (height - 120) / totalDepth;
      const scaleX = (width - 140) / (footing.lengthX + 3.0);

      // 地盤線 GL=0
      const glY = topY;
      ctx.strokeStyle = '#22c55e'; // green-500
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30, glY);
      ctx.lineTo(width - 30, glY);
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('GL ±0.0m (地表面)', 35, glY - 6);

      // フーチング
      const ftTopY = glY + (footing.depthGL - footing.thickness) * scaleY;
      const ftBottomY = glY + footing.depthGL * scaleY;
      const ftW = footing.lengthX * scaleX;
      const ftX = cx - ftW / 2;

      ctx.fillStyle = '#334155';
      ctx.fillRect(ftX, ftTopY, ftW, ftBottomY - ftTopY);
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.strokeRect(ftX, ftTopY, ftW, ftBottomY - ftTopY);

      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`フーチング Df=${footing.thickness}m`, cx, (ftTopY + ftBottomY) / 2 + 4);

      // 各杭の立面描画
      // X座標ごとにグループ化して代表描画
      const uniqueX = Array.from(new Set(pileNodes.map((p) => p.x)));
      uniqueX.forEach((xCoord) => {
        const matchingPiles = pileNodes.filter((p) => p.x === xCoord && !p.isOmitted);
        if (matchingPiles.length === 0) return;
        const pile = matchingPiles[0];
        const pSpec = pileSpecs[pile.pileSpecId] || spec;
        const pDia = (pSpec.diameter || 1.2) * scaleX;

        const pileHeadX = cx + xCoord * scaleX;
        const pileHeadY = ftBottomY;
        const pileTipY = pileHeadY + pSpec.length * scaleY;

        // 傾斜角考慮
        const thetaRad = (pile.inclinationAngle * Math.PI) / 180;
        const pileTipX = pileHeadX + Math.sin(thetaRad) * (pSpec.length * scaleY);

        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;

        // 杭柱描画
        ctx.beginPath();
        ctx.moveTo(pileHeadX - pDia / 2, pileHeadY);
        ctx.lineTo(pileTipX - pDia / 2, pileTipY);
        ctx.lineTo(pileTipX + pDia / 2, pileTipY);
        ctx.lineTo(pileHeadX + pDia / 2, pileHeadY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 杭長注記
        ctx.fillStyle = '#7dd3fc';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`L=${pSpec.length}m φ${(pSpec.diameter * 1000).toFixed(0)}`, pileHeadX, (pileHeadY + pileTipY) / 2);
      });
    }
  }, [footing, pileNodes, pileSpecs, viewMode, width, height]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-md flex flex-col items-center">
      <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <span className="text-xs font-bold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
          杭基礎 CAD図面プレビュー
        </span>
        <div className="flex bg-slate-800 p-0.5 rounded border border-slate-700">
          <button
            onClick={() => setViewMode('plan')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'plan' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            平面図 (Plan)
          </button>
          <button
            onClick={() => setViewMode('elevation')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'elevation' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            立面図 (Elevation)
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="rounded border border-slate-800"
      />
    </div>
  );
};
