import React, { useEffect, useRef, useState } from 'react';
import { PileDepthStressPoint } from '../../types/calculation';

interface PileStressChartCanvasProps {
  profile: PileDepthStressPoint[];
  pileDiameter: number;
  width?: number;
  height?: number;
}

export const PileStressChartCanvas: React.FC<PileStressChartCanvasProps> = ({
  profile,
  width = 620,
  height = 580,
}) => {
  const [activeMetric, setActiveMetric] = useState<'moment' | 'shear' | 'deflection' | 'reaction'>('moment');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !profile || profile.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 背景クリア (白)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const maxDepth = profile[profile.length - 1].depthZ;
    const marginTop = 50;
    const marginBottom = 40;
    const drawHeight = height - marginTop - marginBottom;
    const scaleY = (depth: number) => marginTop + (depth / maxDepth) * drawHeight;

    const centerX = width / 2;

    // 指標に応じた値取得
    let getValue = (pt: PileDepthStressPoint) => pt.momentM;
    let unit = 'kN·m';
    let label = '曲げモーメント M(z)';
    let lineColor = '#dc2626'; // red-600
    let fillColor = 'rgba(239, 68, 68, 0.15)';

    if (activeMetric === 'shear') {
      getValue = (pt) => pt.shearForceS;
      unit = 'kN';
      label = 'せん断力 S(z)';
      lineColor = '#d97706'; // amber-600
      fillColor = 'rgba(217, 119, 6, 0.15)';
    } else if (activeMetric === 'deflection') {
      getValue = (pt) => pt.deflectionY;
      unit = 'mm';
      label = '水平変位 y(z)';
      lineColor = '#0284c7'; // sky-600
      fillColor = 'rgba(2, 132, 199, 0.15)';
    } else if (activeMetric === 'reaction') {
      getValue = (pt) => pt.soilReactionP;
      unit = 'kN/m';
      label = '地盤反力度 p(z)';
      lineColor = '#16a34a'; // emerald-600
      fillColor = 'rgba(22, 163, 74, 0.15)';
    }

    const values = profile.map(getValue);
    const maxVal = Math.max(1, ...values.map(Math.abs));
    const scaleX = (val: number) => centerX + (val / maxVal) * (width * 0.4);

    // 縦軸 (深度軸 z=0)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, marginTop - 10);
    ctx.lineTo(centerX, marginTop + drawHeight + 10);
    ctx.stroke();

    // 深度目盛線
    const depthStep = maxDepth > 20 ? 5 : 2;
    for (let d = 0; d <= maxDepth; d += depthStep) {
      const y = scaleY(d);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 40, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${d.toFixed(1)}m`, 35, y + 3);
    }

    // 分布ポリゴン塗りつぶし
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(centerX, scaleY(profile[0].depthZ));
    profile.forEach((pt) => {
      ctx.lineTo(scaleX(getValue(pt)), scaleY(pt.depthZ));
    });
    ctx.lineTo(centerX, scaleY(profile[profile.length - 1].depthZ));
    ctx.closePath();
    ctx.fill();

    // 曲線描画
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    profile.forEach((pt, idx) => {
      const x = scaleX(getValue(pt));
      const y = scaleY(pt.depthZ);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 最大値注記
    let extremeIdx = 0;
    let extremeAbs = 0;
    values.forEach((v, idx) => {
      if (Math.abs(v) > extremeAbs) {
        extremeAbs = Math.abs(v);
        extremeIdx = idx;
      }
    });

    const extremePt = profile[extremeIdx];
    const exX = scaleX(getValue(extremePt));
    const exY = scaleY(extremePt.depthZ);

    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(exX, exY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // テキストボックス
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(exX + (exX > centerX ? -145 : 10), exY - 14, 135, 26);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(exX + (exX > centerX ? -145 : 10), exY - 14, 135, 26);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Max: ${getValue(extremePt).toFixed(1)} ${unit}`,
      exX + (exX > centerX ? -137 : 18),
      exY + 3
    );

    // ヘッダー情報
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${label} 分布図 (深度方向)`, width / 2, 25);
  }, [profile, activeMetric, width, height]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-md flex flex-col items-center">
      <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
        <span className="text-xs font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
          杭体 深度別断面力ダイアグラム (Chang解)
        </span>
        <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200 gap-1">
          <button
            onClick={() => setActiveMetric('moment')}
            className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
              activeMetric === 'moment' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            M図 (曲げ)
          </button>
          <button
            onClick={() => setActiveMetric('shear')}
            className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
              activeMetric === 'shear' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            S図 (せん断)
          </button>
          <button
            onClick={() => setActiveMetric('deflection')}
            className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
              activeMetric === 'deflection' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            y図 (変位)
          </button>
          <button
            onClick={() => setActiveMetric('reaction')}
            className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
              activeMetric === 'reaction' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            p図 (地盤反力)
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="rounded border border-slate-200"
      />
    </div>
  );
};
