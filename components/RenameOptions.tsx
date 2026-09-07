"use client";

export interface RenameConfig {
  usePrefix: boolean;
  padding: number;
  startAt: number;
  keepOriginalName: boolean;
  prefixSeparator: string;
}

export function RenameOptions({
  config,
  onChange,
}: {
  config: RenameConfig;
  onChange: (config: RenameConfig) => void;
}) {
  return (
    <div className="space-y-2.5">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={config.usePrefix}
          onChange={(e) =>
            onChange({ ...config, usePrefix: e.target.checked })
          }
          className="w-4 h-4 border-2 border-surface-border accent-primary cursor-pointer"
        />
        <span className="text-[12px] font-semibold text-ink-dark">
          Đánh số thứ tự vào đầu tên file
        </span>
      </label>

      {config.usePrefix && (
        <div className="pl-6 space-y-2.5 animate-fade-in">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Field label="Bắt đầu từ">
              <input
                type="number"
                min={0}
                value={config.startAt}
                onChange={(e) =>
                  onChange({ ...config, startAt: Number(e.target.value) })
                }
                className="w-16 rounded border border-surface-border px-2 py-1.5 text-[12px] font-mono font-bold text-ink-dark focus:outline-none focus:border-primary focus:shadow-focus transition-all"
              />
            </Field>

            <Field label="Số chữ số">
              <select
                value={config.padding}
                onChange={(e) =>
                  onChange({ ...config, padding: Number(e.target.value) })
                }
                className="rounded border border-surface-border px-2 py-1.5 text-[12px] font-mono font-bold text-ink-dark focus:outline-none focus:border-primary focus:shadow-focus transition-all"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {String(1).padStart(n, "0")} ({n} số)
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.keepOriginalName}
              onChange={(e) =>
                onChange({ ...config, keepOriginalName: e.target.checked })
              }
              className="w-4 h-4 border-2 border-surface-border accent-primary cursor-pointer"
            />
            <span className="text-[12px] text-ink-dark">
              Giữ tên gốc sau số thứ tự
            </span>
          </label>

          <p className="text-[10.5px] font-mono text-ink-medium bg-surface-tint px-2 py-1 border-l-2 border-accent-amberStrong/50">
            {previewName(config)}
          </p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-ink-medium">{label}</span>
      {children}
    </div>
  );
}

function previewName(config: RenameConfig): string {
  const padded = String(config.startAt).padStart(config.padding, "0");
  return config.keepOriginalName
    ? `${padded}_bao_cao.pdf`
    : `${padded}.pdf`;
}