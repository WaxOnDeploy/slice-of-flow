import type { ResultsExportModel } from '@/lib/sliceOfFlowExportModel';
import '@/lib/sliceOfFlowPrint.css';

export default function SliceOfFlowPrintSheet({ model }: { model: ResultsExportModel }) {
  return (
    <article className="sof-print-sheet" aria-label="Printable Slice of Flow debrief" data-testid="print-debrief">
      <header>
        <p className="sof-print-eyebrow">WORKSHOP DEBRIEF</p>
        <h1>{model.title}</h1>
        <p>{model.subtitle} · Score percentage change: {model.scorePercentage}</p>
        <p className="sof-print-credit">{model.author}</p>
        <p>{model.site}</p>
      </header>
      <p>{model.note}</p>
      <table aria-label="Printable results table">
        <thead><tr>{model.headers.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{model.rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, i) => <td key={i}>{value}</td>)}</tr>)}</tbody>
      </table>
      <p className="sof-print-small">{model.footer}</p>
      <section className="sof-print-score">
        <h2>Score rules</h2>
        <p>{model.scoring.formula} {model.scoring.bonusRule}</p>
        <p>{model.scoring.customerRule}</p>
      </section>
      <section>
        <h2>Observations and reflection</h2>
        <div className="sof-print-insights">{model.insights.map(item => <div key={item.title} className="sof-print-insight"><h3>{item.title}</h3><p>{item.desc}</p><p className="sof-print-small">{item.metric}</p></div>)}</div>
      </section>
      <section className="sof-print-bridge">
        <h2>The Bridge</h2>
        <p>Use these mappings to discuss your team's actual work.</p>
        <table aria-label="Printable Bridge table">
          <thead><tr><th scope="col">Pizza shop</th><th scope="col">Your team</th><th scope="col">Why it matters</th></tr></thead>
          <tbody>{model.bridge.map(row => <tr key={row.pizza}><th scope="row">{row.pizza}</th><td>{row.team}</td><td>{row.desc}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="sof-print-questions">
        <h2>Team discussion questions</h2>
        <ol>{model.questions.map(question => <li key={question}>{question}</li>)}</ol>
        <h3>Our next experiment</h3>
        <p>What will we try, how will we measure it, and when will we review it?</p>
        <div className="sof-print-writing-lines" aria-hidden="true" />
      </section>
      <footer>{model.site}<br />{model.author}<br />{model.privacy}</footer>
    </article>
  );
}
