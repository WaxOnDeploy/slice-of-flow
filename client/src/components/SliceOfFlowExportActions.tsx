import { useEffect, useRef, useState } from 'react';
import type { ResultsExportModel } from '@/lib/sliceOfFlowExportModel';
import { renderResultsPng, downloadResultsPng, shareResultsPng } from '@/lib/sliceOfFlowPng';
import { toast } from 'sonner';
import '@/lib/sliceOfFlowPrint.css';

export default function SliceOfFlowExportActions({ model }: { model: ResultsExportModel }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setBlob(null); setError(false);
    renderResultsPng({ ...model, note: `${model.note} Score percentage change: ${model.scorePercentage}.` })
      .then(image => { if (active) setBlob(image); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [model, retry]);

  function download() {
    if (!blob) return;
    try { downloadResultsPng(blob, 'slice-of-flow-results.png'); toast.success('PNG download requested. Your browser saves the file locally.'); }
    catch { toast.error('Could not download the image. Try Print / Save PDF instead.'); }
  }
  async function share() {
    if (!blob || busy) return;
    setBusy(true);
    try {
      const result = await shareResultsPng(blob, 'slice-of-flow-results.png');
      if (result === 'downloaded') toast.success('File sharing is unavailable. A local PNG download was requested.');
      // Native share completion does not prove a recipient received it; cancellation is silent.
    } catch { toast.error('Could not share the image. Use Download PNG or Print / Save PDF instead.'); }
    finally { if (mounted.current) setBusy(false); }
  }

  return (
    <div className="sof-export-actions" role="region" aria-label="Local results exports" data-testid="local-exports">
      <h2>Take your results with you</h2>
      <p>{model.privacy}</p>
      <div className="sof-export-buttons">
        <button type="button" onClick={download} disabled={!blob || busy}>Download PNG</button>
        <button type="button" onClick={share} disabled={!blob || busy}>{busy ? 'Opening sharing…' : 'Share image'}</button>
        <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
        {error && <button type="button" onClick={() => setRetry(n => n + 1)}>Retry image</button>}
      </div>
      <p role="status" aria-live="polite">{error ? 'The image could not be prepared. Printing and text sharing are still available.' : !blob ? 'Preparing your results image locally…' : 'Image ready. Print / Save PDF opens your browser’s print dialog.'}</p>
      <details className="sof-export-preview">
        <summary>Preview the data included</summary>
        <p>{model.subtitle}. {model.note}</p>
        <div className="sof-export-table-scroll"><table aria-label="Export data preview"><thead><tr>{model.headers.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{model.rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, i) => <td key={i}>{value}</td>)}</tr>)}</tbody></table></div>
        <p>Score percentage change: {model.scorePercentage}</p>
        <p>{model.footer}</p><p>{model.author}<br />{model.site}</p>
      </details>
    </div>
  );
}
