import { CalendarClock } from "lucide-react";
import { motion } from "motion/react";
import { getPlatformIcon } from "../../PlatformIcons";
import { formatDateTime } from "./helpers";
import type { ManualPublishResponse } from "./types";

type ExecutionResultsSectionProps = {
  t: (arabic: string, english: string) => string;
  language: string;
  lastResponse: ManualPublishResponse;
};

export function ExecutionResultsSection(props: ExecutionResultsSectionProps) {
  const { t, language, lastResponse } = props;
  if (!lastResponse.results || lastResponse.results.length === 0) return null;

  return (
    <motion.section
      className="rounded-2xl bg-white p-5 sm:p-6"
      style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="text-slate-800 mb-3" style={{ fontSize: "0.95rem" }}>
        {t("Execution Results", "Execution Results")}
      </h3>
      <div className="mb-3 text-slate-500" style={{ fontSize: "0.74rem" }}>
        {t(
          `${lastResponse.succeededCount || 0} succeeded • ${lastResponse.failedCount || 0} failed`,
          `${lastResponse.succeededCount || 0} succeeded • ${lastResponse.failedCount || 0} failed`
        )}
      </div>
      <div className="space-y-2">
        {lastResponse.results.map((result) => (
          <div key={`${result.accountId}-${result.platformId}`} className="rounded-xl bg-slate-50 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 min-w-0">
                {getPlatformIcon(result.platformId, 16)}
                <span className="text-slate-700 truncate" style={{ fontSize: "0.75rem" }}>
                  {result.accountName}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full ${result.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                style={{ fontSize: "0.65rem" }}
              >
                {result.success ? t("Success", "Success") : t("Failed", "Failed")}
              </span>
            </div>
            {result.error ? (
              <p className="text-red-600 mt-1.5" style={{ fontSize: "0.69rem" }}>
                {result.error}
              </p>
            ) : null}
            {result.scheduledFor ? (
              <p className="text-slate-400 mt-1" style={{ fontSize: "0.67rem" }}>
                <CalendarClock className="w-3 h-3 inline-block mr-1" />
                {formatDateTime(result.scheduledFor, language)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </motion.section>
  );
}
