import { AlertCircle, CheckCircle2, Play, Sparkles, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { getPlatformIcon } from "../../PlatformIcons";
import type { AdaptationEntry, ManualValidationEntry } from "./types";

type AdaptationEngineSectionProps = {
  t: (arabic: string, english: string) => string;
  localValidationTouched: boolean;
  localAdaptationEntries: AdaptationEntry[];
  localAdaptationSummary: { errorCount: number; warningCount: number };
  lastValidation: ManualValidationEntry[];
  onReset: () => void;
  onOpenComposer: () => void;
};

export function AdaptationEngineSection(props: AdaptationEngineSectionProps) {
  const {
    t,
    localValidationTouched,
    localAdaptationEntries,
    localAdaptationSummary,
    lastValidation,
    onReset,
    onOpenComposer,
  } = props;

  return (
    <motion.section
      className="rounded-2xl bg-white p-5"
      style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-800 inline-flex items-center gap-1.5" style={{ fontSize: "0.9rem" }}>
          <Sparkles className="w-4 h-4 text-indigo-500" />
          {t("Cross-Platform Adaptation Engine", "Cross-Platform Adaptation Engine")}
        </h3>
      </div>

      {!localValidationTouched ? (
        <p className="text-slate-400" style={{ fontSize: "0.74rem" }}>
          {t("Start composing to see adaptation diagnostics.", "Start composing to see adaptation diagnostics.")}
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full ${localAdaptationSummary.errorCount > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
              style={{ fontSize: "0.68rem" }}
            >
              {localAdaptationSummary.errorCount} {t("errors", "errors")}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700" style={{ fontSize: "0.68rem" }}>
              {localAdaptationSummary.warningCount} {t("warnings", "warnings")}
            </span>
          </div>

          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {localAdaptationEntries.map((entry) => (
              <div key={entry.platformId} className="rounded-xl bg-slate-50/80 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="inline-flex items-center gap-2" style={{ fontSize: "0.74rem" }}>
                    {getPlatformIcon(entry.platformId, 15)}
                    <span className="text-slate-700">{entry.platformName}</span>
                  </div>
                  <span className="text-slate-400" style={{ fontSize: "0.67rem" }}>
                    {entry.textLength}/{entry.maxChars}
                  </span>
                </div>

                {entry.issues.length === 0 ? (
                  <div className="inline-flex items-center gap-1 text-emerald-600" style={{ fontSize: "0.68rem" }}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t("Ready", "Ready")}</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {entry.issues.map((issue, index) => (
                      <div
                        key={`${entry.platformId}-${index}`}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${issue.level === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
                        style={{ fontSize: "0.66rem" }}
                      >
                        {issue.level === "error" ? <XCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {lastValidation.length > 0 ? (
        <div className="mt-4 pt-3 border-t border-slate-200">
          <div className="inline-flex items-center gap-1.5 text-blue-600 mb-2" style={{ fontSize: "0.72rem" }}>
            <Play className="w-3.5 h-3.5" />
            <span>{t("Server validation snapshot", "Server validation snapshot")}</span>
          </div>
          <div className="space-y-1 max-h-[180px] overflow-y-auto">
            {lastValidation.map((entry) => (
              <div key={`${entry.accountId}-${entry.platformId}`} className="rounded-lg bg-slate-50 p-2" style={{ fontSize: "0.66rem" }}>
                <div className="inline-flex items-center gap-1.5 text-slate-700">
                  {getPlatformIcon(entry.platformId, 14)}
                  <span>{entry.accountName}</span>
                </div>
                {entry.issues.length > 0 ? (
                  <div className="mt-1 text-slate-500">{entry.issues[0]?.message}</div>
                ) : (
                  <div className="mt-1 text-emerald-600">{t("No issues", "No issues")}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700"
          style={{ fontSize: "0.72rem" }}
        >
          {t("Reset", "Reset")}
        </button>
        <button
          type="button"
          onClick={onOpenComposer}
          className="px-3 py-2 rounded-lg bg-white text-slate-700"
          style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.72rem" }}
        >
          {t("Open Composer", "Open Composer")}
        </button>
      </div>
    </motion.section>
  );
}
