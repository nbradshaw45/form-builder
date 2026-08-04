import { useParams } from "react-router";
import { getForm, useQuery } from "wasp/client/operations";
import { FormBuilder } from "../components/builder/FormBuilder";

export function FormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const { data: form, isLoading } = useQuery(
    getForm,
    { id: id ?? "" },
    { enabled: isEdit },
  );

  return (
    <FormBuilder
      initialForm={isEdit ? (form ?? null) : null}
      isInitialLoading={isEdit && isLoading}
    />
  );
}
