import { AlertTriangle, CheckCircle2, Download, FileJson, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../lib/api";
import type { ImportSummary } from "../types";

export default function ContactsImportExportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const { blob, filename } = await api.exportContactsArchive();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export contacts.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!selectedFile) return;
    setImporting(true);
    setError(null);
    setSummary(null);
    try {
      const result = await api.importContactsArchive(selectedFile);
      setSummary(result);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Unable to import contacts.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page narrow-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Contacts</p>
          <h1>Import / Export</h1>
        </div>
      </header>

      <div className="data-strip">
        <span>Archive: Rolodexian JSON</span>
        <span>Selected: {selectedFile?.name || "none"}</span>
        <span>Mode: merge by ID</span>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="transfer-grid">
        <section className="form-section transfer-panel">
          <div className="section-heading">
            <h2>Export</h2>
            <FileJson size={18} />
          </div>
          <button className="primary-button" type="button" onClick={handleExport} disabled={exporting}>
            <Download size={17} />
            {exporting ? "Exporting" : "Export contacts"}
          </button>
          {exporting ? <div className="status-line">Preparing archive</div> : null}
        </section>

        <section className="form-section transfer-panel">
          <div className="section-heading">
            <h2>Import</h2>
            <Upload size={18} />
          </div>
          <label>
            Archive file
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
          </label>
          <button className="primary-button" type="button" onClick={handleImport} disabled={!selectedFile || importing}>
            <Upload size={17} />
            {importing ? "Importing" : "Import archive"}
          </button>
          {importing ? <div className="status-line">Restoring archive</div> : null}
        </section>
      </div>

      {summary ? (
        <section className="info-section import-result">
          <div className="section-heading">
            <h2>Import Result</h2>
            <CheckCircle2 size={18} />
          </div>
          <div className="metric-grid">
            <div>
              <span>Contacts</span>
              <strong>{summary.contacts.created} created</strong>
              <small>{summary.contacts.updated} updated</small>
            </div>
            <div>
              <span>Relationships</span>
              <strong>{summary.relationships.created} created</strong>
              <small>{summary.relationships.updated} updated</small>
            </div>
            <div>
              <span>Images</span>
              <strong>{summary.images.created} created</strong>
              <small>{summary.images.updated} updated</small>
            </div>
          </div>
          {summary.warnings.length ? (
            <div className="warning-list">
              {summary.warnings.map((warning) => (
                <p key={warning}>
                  <AlertTriangle size={15} />
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
