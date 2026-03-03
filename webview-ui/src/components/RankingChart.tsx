interface RankingChartProps {
  rankings: Array<{ model: string; averageRank: number; rankingsCount: number }>;
}

export function RankingChart({ rankings }: RankingChartProps) {
  if (rankings.length === 0) return null;

  const maxRank = Math.max(...rankings.map((r) => r.averageRank));

  return (
    <div className="ranking-chart">
      {rankings.map((r, i) => {
        const width = maxRank > 0 ? ((maxRank - r.averageRank + 1) / maxRank) * 100 : 50;
        const shortName = r.model.split("/")[0];
        return (
          <div key={r.model} className="ranking-bar-row">
            <span className="ranking-position">#{i + 1}</span>
            <span className="ranking-model">{shortName}</span>
            <div className="ranking-bar-container">
              <div
                className="ranking-bar"
                style={{ width: `${Math.max(width, 10)}%` }}
              />
            </div>
            <span className="ranking-score">{r.averageRank.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}
