'use client';

import { useMemo, useState } from 'react';

export type PerformancePoint = {
  date: string;
  revenueInCents: number;
  contributions: number;
};

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);

const shortDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
    new Date(`${value}T12:00:00`),
  );

export function PerformancePanel({ data }: { data: PerformancePoint[] }) {
  const [period, setPeriod] = useState<7 | 30>(30);
  const points = useMemo(() => data.slice(-period), [data, period]);
  const total = points.reduce((sum, point) => sum + point.revenueInCents, 0);
  const contributions = points.reduce(
    (sum, point) => sum + point.contributions,
    0,
  );
  const maximum = Math.max(...points.map((point) => point.revenueInCents), 0);
  const labelIndexes = new Set(
    [0, 0.25, 0.5, 0.75, 1].map((position) =>
      Math.round((points.length - 1) * position),
    ),
  );

  return (
    <article className="panel revenue-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Performance</span>
          <h2>Receita no período</h2>
        </div>
        <select
          aria-label="Período do gráfico"
          value={period}
          onChange={(event) => setPeriod(Number(event.target.value) as 7 | 30)}
        >
          <option value="30">Últimos 30 dias</option>
          <option value="7">Últimos 7 dias</option>
        </select>
      </div>
      {contributions ? (
        <>
          <div className="chart-summary" aria-live="polite">
            <strong>{money(total)}</strong>
            <span>
              {contributions}{' '}
              {contributions === 1
                ? 'contribuição confirmada'
                : 'contribuições confirmadas'}
            </span>
          </div>
          <div
            className="chart"
            aria-label={`Receita dos últimos ${period} dias`}
          >
            <div className="chart-lines">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="bars">
              {points.map((point) => {
                const highlighted =
                  point.revenueInCents > 0 && point.revenueInCents === maximum;
                return (
                  <div
                    className={highlighted ? 'bar highlighted' : 'bar'}
                    style={{
                      height: `${maximum ? Math.max(6, (point.revenueInCents / maximum) * 100) : 0}%`,
                    }}
                    title={`${shortDate(point.date)}: ${money(point.revenueInCents)}`}
                    key={point.date}
                  >
                    <span>
                      {highlighted ? money(point.revenueInCents) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="chart-labels">
            {points.map((point, index) =>
              labelIndexes.has(index) ? (
                <span key={point.date}>{shortDate(point.date)}</span>
              ) : null,
            )}
          </div>
        </>
      ) : (
        <div className="dashboard-empty">
          <strong>Sem receita nos últimos {period} dias</strong>
          <span>O gráfico aparecerá após uma contribuição confirmada.</span>
        </div>
      )}
    </article>
  );
}
