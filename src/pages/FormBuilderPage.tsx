import { useState } from "react";
import { useParams } from "react-router";
import type { AuthUser } from "wasp/auth";
import { getForm, getFormTemplates, useQuery } from "wasp/client/operations";
import { FormBuilder } from "../components/builder/FormBuilder";
import { inputClasses } from "../shared/styles";

export function FormBuilderPage({ user }: { user: AuthUser }) {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const { data: form, isLoading } = useQuery(
    getForm,
    { id: id ?? "" },
    { enabled: isEdit },
  );

  const showTemplatePicker = !isEdit && user.role !== "VIEWER";
  const { data: templates } = useQuery(getFormTemplates, undefined, {
    enabled: showTemplatePicker,
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const { data: selectedTemplate } = useQuery(
    getForm,
    { id: selectedTemplateId },
    { enabled: showTemplatePicker && Boolean(selectedTemplateId) },
  );

  const templateSeed =
    showTemplatePicker && selectedTemplateId && selectedTemplate
      ? selectedTemplate
      : null;

  return (
    <div className="flex flex-col">
      {!isEdit && templates && templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-8 pt-6">
          <label
            htmlFor="template-picker"
            className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400"
          >
            Start from a template
          </label>
          <select
            id="template-picker"
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            className={`${inputClasses} sm:w-72`}
          >
            <option value="">Blank form</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <FormBuilder
        key={isEdit ? `edit-${id}` : (templateSeed?.id ?? "blank")}
        initialForm={isEdit ? (form ?? null) : null}
        isInitialLoading={isEdit && isLoading}
        initialTemplate={templateSeed}
      />
    </div>
  );
}
