import type {
  DeviceSyncImportPreview,
  DeviceSyncImportReceipt,
  DeviceSyncPackage,
  DeviceSyncState,
  RelayPreview,
} from "../types";

type DeviceSyncPanelProps = {
  importPreview: DeviceSyncImportPreview | null;
  importReceipt: DeviceSyncImportReceipt | null;
  isExporting: boolean;
  isImporting: boolean;
  isPreviewingImport: boolean;
  onExport: () => void;
  onImport: () => void;
  onPackageChange: (value: string) => void;
  onPreviewImport: () => void;
  onPreviewRelay: () => void;
  packageJson: string;
  relayPreview: RelayPreview | null;
  state: DeviceSyncState | null;
  syncPackage: DeviceSyncPackage | null;
};

export function DeviceSyncPanel({
  importPreview,
  importReceipt,
  isExporting,
  isImporting,
  isPreviewingImport,
  onExport,
  onImport,
  onPackageChange,
  onPreviewImport,
  onPreviewRelay,
  packageJson,
  relayPreview,
  state,
  syncPackage,
}: DeviceSyncPanelProps) {
  return (
    <section className="panel device-sync-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Multi-device sync</p>
          <h3>Local package and relay contract</h3>
        </div>
        <strong>{importPreview?.state ?? relayPreview?.state ?? "local-first"}</strong>
      </div>
      <div className="device-sync-summary">
        <span>{state?.device_label ?? "Unknown device"}</span>
        <strong>{state?.device_id ?? "No device id"}</strong>
        <small>{state?.last_synced_hash ?? "No synced hash yet"}</small>
      </div>
      <div className="memory-actions">
        <button type="button" onClick={onExport} disabled={isExporting}>
          {isExporting ? "Exporting" : "Export sync package"}
        </button>
        <button type="button" onClick={onPreviewImport} disabled={isPreviewingImport || !packageJson.trim()}>
          {isPreviewingImport ? "Checking" : "Preview import"}
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={isImporting || !importPreview?.can_import}
        >
          {isImporting ? "Importing" : "Import package"}
        </button>
        <button type="button" onClick={onPreviewRelay}>
          Relay dry-run
        </button>
      </div>
      <textarea
        className="device-sync-package"
        value={packageJson}
        onChange={(event) => onPackageChange(event.target.value)}
        placeholder="Export a sync package or paste one from another device"
      />
      {syncPackage && (
        <div className="task-run-result">
          <span>{syncPackage.package_id}</span>
          <strong>{syncPackage.content_hash}</strong>
          <small>base: {syncPackage.base_hash ?? "none"}</small>
        </div>
      )}
      {importPreview && (
        <div className="agent-harness-receipt">
          <p>
            incoming: {importPreview.incoming_hash} / local: {importPreview.local_hash}
          </p>
          <small>
            source: {importPreview.source_device_label} / replace required:{" "}
            {importPreview.requires_explicit_replace ? "yes" : "no"}
          </small>
          <div className="policy-tiers">
            {importPreview.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
        </div>
      )}
      {importReceipt && (
        <div className="task-run-result">
          <span>{importReceipt.preview.state}</span>
          <strong>{importReceipt.imported.memory_items} memory items</strong>
          <small>synced hash: {importReceipt.state.last_synced_hash}</small>
        </div>
      )}
      {relayPreview && (
        <div className="agent-harness-receipt">
          <p>
            enabled: {relayPreview.enabled ? "yes" : "no"} / endpoint:{" "}
            {relayPreview.endpoint_valid ? "valid" : "not ready"} / token:{" "}
            {relayPreview.token_present ? "present" : "missing"}
          </p>
          <small>network started: {relayPreview.network_started ? "yes" : "no"}</small>
          <div className="policy-tiers">
            {relayPreview.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
