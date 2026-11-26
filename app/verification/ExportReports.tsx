"use client";

import { useState } from "react";
import { post } from "../../lib/mentalist/client";

export default function ExportReports({ setId }: { setId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const reports = await post<unknown[]>({ action: "verificationExport", setId });
      if (!reports.length) {
        setMessage("No bug reports in this set yet.");
        return;
      }
      const blob = new Blob([JSON.stringify(reports, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "7math-verification-bugs.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`${reports.length} bug ${reports.length === 1 ? "report" : "reports"} exported.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not export bug reports.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="verify-export">
    <button type="button" disabled={busy} onClick={() => void download()}>Export bug reports</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
