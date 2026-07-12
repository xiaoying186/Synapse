import type {
  DeviceSyncImportApplyPreflight,
  DeviceSyncImportPreview,
  DeviceSyncImportReceipt,
  DeviceSyncPackage,
  DeviceSyncState,
  RelayPreview,
} from "../types";
import { useI18n } from "../i18n";

type DeviceSyncPanelProps = {
  importApplyPreflight: DeviceSyncImportApplyPreflight | null;
  importPreview: DeviceSyncImportPreview | null;
  importReceipt: DeviceSyncImportReceipt | null;
  isExporting: boolean;
  isPreflightingImport: boolean;
  isImporting: boolean;
  isPreviewingImport: boolean;
  onExport: () => void;
  onImport: () => void;
  onPackageChange: (value: string) => void;
  onPreflightImport: () => void;
  onPreviewImport: () => void;
  onPreviewRelay: () => void;
  packageJson: string;
  relayPreview: RelayPreview | null;
  state: DeviceSyncState | null;
  syncPackage: DeviceSyncPackage | null;
};

export function DeviceSyncPanel({
  importApplyPreflight,
  importPreview,
  importReceipt,
  isExporting,
  isPreflightingImport,
  isImporting,
  isPreviewingImport,
  onExport,
  onImport,
  onPackageChange,
  onPreflightImport,
  onPreviewImport,
  onPreviewRelay,
  packageJson,
  relayPreview,
  state,
  syncPackage,
}: DeviceSyncPanelProps) {
  const { text } = useI18n();

  return (
    <section className="panel device-sync-panel" data-testid="device-sync-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Multi-device sync")}</p>
          <h3>{text("Local package and relay contract")}</h3>
        </div>
        <strong>{text(importPreview?.state ?? relayPreview?.state ?? "local-first")}</strong>
      </div>
      <div className="device-sync-summary">
        <span>{state?.device_label ?? text("Unknown device")}</span>
        <strong>{state?.device_id ?? text("No device id")}</strong>
        <small>{state?.last_synced_hash ?? text("No synced hash yet")}</small>
      </div>
      <div className="memory-actions">
        <button type="button" onClick={onExport} disabled={isExporting}>
          {isExporting ? text("Exporting") : text("Export sync package")}
        </button>
        <button
          type="button"
          data-testid="device-sync-preview-import-button"
          onClick={onPreviewImport}
          disabled={isPreviewingImport || !packageJson.trim()}
        >
          {isPreviewingImport ? text("Checking") : text("Preview import")}
        </button>
        <button
          type="button"
          data-testid="device-sync-import-preflight-button"
          onClick={onPreflightImport}
          disabled={isPreflightingImport || !packageJson.trim()}
        >
          {isPreflightingImport ? text("Checking import apply") : text("Check import apply gates")}
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={isImporting || !importPreview?.can_import}
        >
          {isImporting ? text("Importing") : text("Import package")}
        </button>
        <button type="button" onClick={onPreviewRelay}>
          {text("Relay dry-run")}
        </button>
      </div>
      <textarea
        data-testid="device-sync-package-input"
        className="device-sync-package"
        value={packageJson}
        onChange={(event) => onPackageChange(event.target.value)}
        placeholder={text("Export a sync package or paste one from another device")}
      />
      {syncPackage && (
        <div className="task-run-result">
          <span>{syncPackage.package_id}</span>
          <strong>{syncPackage.content_hash}</strong>
          <small>{text("base")}: {syncPackage.base_hash ?? text("none")}</small>
        </div>
      )}
      {importPreview && (
        <div className="agent-harness-receipt" data-testid="device-sync-import-preview-result">
          <p>
            {text("incoming")}: {importPreview.incoming_hash} / {text("local")}: {importPreview.local_hash}
          </p>
          <small>
            {text("source")}: {importPreview.source_device_label} / {text("replace required")}:{" "}
            {text(importPreview.requires_explicit_replace ? "yes" : "no")}
          </small>
          <div className="policy-tiers">
            {importPreview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
        </div>
      )}
      {importApplyPreflight && (
        <div className="agent-harness-receipt" data-testid="device-sync-import-preflight-result">
          <span>{text(importApplyPreflight.state)}</span>
          <strong>
            {text("preview state")}: {text(importApplyPreflight.preview_state)}
          </strong>
          <p>
            {text("can apply")}: {text(importApplyPreflight.can_apply ? "yes" : "no")} /{" "}
            {text("import started")}: {text(importApplyPreflight.import_started ? "yes" : "no")} /{" "}
            {text("durable write started")}:{" "}
            {text(importApplyPreflight.durable_write_started ? "yes" : "no")}
          </p>
          <p>
            {text("backup required")}: {text(importApplyPreflight.backup_required ? "yes" : "no")} /{" "}
            {text("audit required")}: {text(importApplyPreflight.audit_required ? "yes" : "no")} /{" "}
            {text("cloud source of truth")}:{" "}
            {text(importApplyPreflight.cloud_source_of_truth ? "yes" : "no")}
          </p>
          <div className="policy-tiers">
            {importApplyPreflight.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <small>
            {text("Blockers")}: {importApplyPreflight.blockers.map((blocker) => text(blocker)).join(", ")}
          </small>
          <small>
            {text("Denied")}: {importApplyPreflight.denied_actions.map((action) => text(action)).join(", ")}
          </small>
        </div>
      )}
      {importReceipt && (
        <div className="task-run-result" data-testid="device-sync-import-transaction-receipt">
          <span>{text(importReceipt.preview.state)}</span>
          <strong>{importReceipt.imported.memory_items} {text("memory items")}</strong>
          <small>{text("synced hash")}: {importReceipt.state.last_synced_hash}</small>
          <small>
            {text("snapshot")}: {importReceipt.snapshot.id} / {text("audit")}: {" "}
            {importReceipt.audit_event.id}
          </small>
          <small>
            {text("transaction")}: {importReceipt.saga.id} / {text("Saga status")}: {" "}
            {text(importReceipt.saga.state)}
          </small>
        </div>
      )}
      {relayPreview && (
        <div className="agent-harness-receipt">
          <p>
            {text("enabled")}: {text(relayPreview.enabled ? "yes" : "no")} / {text("endpoint")}:{" "}
            {text(relayPreview.endpoint_valid ? "valid" : "not ready")} / {text("token")}:{" "}
            {text(relayPreview.token_present ? "present" : "missing")}
          </p>
          <small>{text("network started")}: {text(relayPreview.network_started ? "yes" : "no")}</small>
          <div className="policy-tiers">
            {relayPreview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
