import { Loader2, PencilLine, Save, Star, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import type { ManualTemplate } from "./types";

type TemplateLibrarySectionProps = {
  t: (arabic: string, english: string) => string;
  templates: ManualTemplate[];
  templatesLoading: boolean;
  selectedTemplateId: string;
  templateName: string;
  templateDescription: string;
  templateIsDefault: boolean;
  templateSaving: boolean;
  editingTemplateId: string | null;
  templateBusyId: string | null;
  onTemplateSelect: (id: string) => void;
  onTemplateNameChange: (value: string) => void;
  onTemplateDescriptionChange: (value: string) => void;
  onTemplateDefaultChange: (value: boolean) => void;
  onSaveTemplate: () => void;
  onCancelEdit: () => void;
  onEditTemplate: (template: ManualTemplate) => void;
  onSetTemplateDefault: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onApplyTemplate: (template: ManualTemplate) => void;
};

export function TemplateLibrarySection(props: TemplateLibrarySectionProps) {
  const {
    t,
    templates,
    templatesLoading,
    selectedTemplateId,
    templateName,
    templateDescription,
    templateIsDefault,
    templateSaving,
    editingTemplateId,
    templateBusyId,
    onTemplateSelect,
    onTemplateNameChange,
    onTemplateDescriptionChange,
    onTemplateDefaultChange,
    onSaveTemplate,
    onCancelEdit,
    onEditTemplate,
    onSetTemplateDefault,
    onDeleteTemplate,
    onApplyTemplate,
  } = props;

  return (
    <motion.section
      className="rounded-2xl bg-white p-5"
      style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-800" style={{ fontSize: "0.9rem" }}>
          {t("Template Library", "Template Library")}
        </h3>
        <span className="text-slate-400" style={{ fontSize: "0.68rem" }}>
          {templates.length}
        </span>
      </div>

      <select
        value={selectedTemplateId}
        onChange={(event) => onTemplateSelect(event.target.value)}
        className="w-full py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700"
        style={{ fontSize: "0.75rem" }}
      >
        <option value="">{t("Choose a template...", "Choose a template...")}</option>
        {templates.map((item) => (
          <option key={item.id} value={item.id}>
            {item.isDefault ? "★ " : ""}
            {item.name}
          </option>
        ))}
      </select>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <input
          value={templateName}
          onChange={(event) => onTemplateNameChange(event.target.value)}
          placeholder={t("Template name", "Template name")}
          className="py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700"
          style={{ fontSize: "0.74rem" }}
        />
        <input
          value={templateDescription}
          onChange={(event) => onTemplateDescriptionChange(event.target.value)}
          placeholder={t("Description (optional)", "Description (optional)")}
          className="py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700"
          style={{ fontSize: "0.74rem" }}
        />

        <label className="inline-flex items-center gap-2 text-slate-600" style={{ fontSize: "0.72rem" }}>
          <input
            type="checkbox"
            checked={templateIsDefault}
            onChange={(event) => onTemplateDefaultChange(event.target.checked)}
          />
          <span>{t("Set as default template", "Set as default template")}</span>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSaveTemplate}
            disabled={templateSaving}
            className="flex-1 px-3 py-2.5 rounded-lg bg-slate-900 text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ fontSize: "0.73rem" }}
          >
            {templateSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{editingTemplateId ? t("Update", "Update") : t("Save", "Save")}</span>
          </button>
          {editingTemplateId ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3 py-2.5 rounded-lg bg-slate-100 text-slate-700"
              style={{ fontSize: "0.73rem" }}
            >
              {t("Cancel", "Cancel")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 space-y-2 max-h-[300px] overflow-y-auto">
        {templatesLoading ? (
          <div className="py-6 flex items-center justify-center text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-slate-400" style={{ fontSize: "0.74rem" }}>
            {t("No templates yet.", "No templates yet.")}
          </p>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="rounded-xl bg-slate-50/80 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-700 truncate" style={{ fontSize: "0.74rem" }}>
                    {template.isDefault ? "★ " : ""}
                    {template.name}
                  </p>
                  {template.description ? (
                    <p className="text-slate-400 truncate" style={{ fontSize: "0.67rem" }}>
                      {template.description}
                    </p>
                  ) : null}
                </div>

                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEditTemplate(template)}
                    className="text-slate-400 hover:text-blue-600"
                    title="Edit"
                  >
                    <PencilLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTemplateDefault(template.id)}
                    disabled={templateBusyId === template.id}
                    className="text-slate-400 hover:text-amber-500 disabled:opacity-50"
                    title="Set default"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(template.id)}
                    disabled={templateBusyId === template.id}
                    className="text-slate-400 hover:text-red-500 disabled:opacity-50"
                    title="Delete"
                  >
                    {templateBusyId === template.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onApplyTemplate(template)}
                className="mt-2 w-full px-2.5 py-1.5 rounded-lg bg-white text-slate-700"
                style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.68rem" }}
              >
                {t("Apply Template", "Apply Template")}
              </button>
            </div>
          ))
        )}
      </div>
    </motion.section>
  );
}

