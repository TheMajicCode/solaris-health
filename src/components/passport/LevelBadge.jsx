/**
 * LevelBadge — the member's contribution level, color-coded by band.
 * Bronze → Silver → Gold → Platinum → Master. Shows points, a progress bar
 * toward the next band, and the total contribution count.
 * Levels reflect *attested contribution*, never money.
 */
import React from 'react';
import { Award } from 'lucide-react';
import { levelFor } from './levels.js';

export default function LevelBadge({ points = 0, contributions = null, compact = false }) {
  const lv = levelFor(points);
  return (
    <div className={`lvb ${compact ? 'compact' : ''}`}>
      <div className="lvb-top">
        <div className="lvb-badge" style={{ background: lv.soft, color: lv.ink, borderColor: lv.color }}>
          <Award size={compact ? 13 : 15} style={{ color: lv.color }} />
          <span>{lv.band}</span>
        </div>
        <div className="lvb-points">
          <span className="lvb-points-val">{lv.points.toLocaleString()}</span>
          <span className="lvb-points-lbl">level points</span>
        </div>
      </div>

      {!compact && (
        <>
          <div className="lvb-bar">
            <div className="lvb-bar-fill" style={{ width: `${Math.round(lv.progress * 100)}%`, background: lv.color }} />
          </div>
          <div className="lvb-meta">
            {lv.nextThreshold
              ? <span>{lv.pointsToNext.toLocaleString()} points to next band</span>
              : <span>Highest band reached</span>}
            {contributions != null && <span>{Number(contributions).toLocaleString()} contributions</span>}
          </div>
        </>
      )}

      <style>{`
        .luca .lvb{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px}
        .luca .lvb.compact{padding:0;background:none;border:none}
        .luca .lvb-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .luca .lvb-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:99px;
          border:1.5px solid;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;letter-spacing:.02em}
        .luca .lvb-points{display:flex;flex-direction:column;align-items:flex-end;line-height:1.1}
        .luca .lvb-points-val{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;color:var(--ink)}
        .luca .lvb-points-lbl{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
        .luca .lvb-bar{height:8px;border-radius:99px;background:var(--surface-2);margin-top:14px;overflow:hidden}
        .luca .lvb-bar-fill{height:100%;border-radius:99px;transition:width .6s var(--ease,ease)}
        .luca .lvb-meta{display:flex;align-items:center;justify-content:space-between;margin-top:8px;
          font-size:11.5px;color:var(--muted)}
      `}</style>
    </div>
  );
}
