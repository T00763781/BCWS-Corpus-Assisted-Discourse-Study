type Props = { title: string; value: number | string; note: string };

export function KpiCard({ title, value, note }: Props) {
  return (
    <div className="card">
      <div className="card-header">{title}</div>
      <div className="kpi-value">{value}</div>
      <div className="muted">{note}</div>
    </div>
  );
}
