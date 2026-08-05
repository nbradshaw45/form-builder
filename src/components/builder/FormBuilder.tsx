import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type { Form } from "wasp/entities";
import { createForm, updateForm } from "wasp/client/operations";
import { useNavigate } from "react-router";
import type { FieldType, FormField, FormSettings } from "../../types";
import { DEFAULT_FORM_SETTINGS } from "../../types";
import { Button, ButtonLink } from "../../shared/components/Button";
import { inputClasses } from "../../shared/styles";
import { Canvas } from "./Canvas";
import { ElementPalette } from "./ElementPalette";
import { FieldInspector } from "./FieldInspector";
import {
  createDefaultSystemFields,
  createElement,
  generateId,
  slugify,
  uniqueKey,
} from "./elementFactory";

interface FormBuilderProps {
  initialForm: Form | null;
  isInitialLoading?: boolean;
}

export function FormBuilder({
  initialForm,
  isInitialLoading = false,
}: FormBuilderProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_FORM_SETTINGS);
  const [elements, setElements] = useState<FormField[]>(() =>
    initialForm ? [] : createDefaultSystemFields([]),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastLoadedId = useRef<string | null>(null);

  useEffect(() => {
    if (initialForm && lastLoadedId.current !== initialForm.id) {
      lastLoadedId.current = initialForm.id;
      setTitle(initialForm.title);
      setDescription(initialForm.description ?? "");
      setSettings({
        ...DEFAULT_FORM_SETTINGS,
        ...((initialForm.settings as unknown as FormSettings | null) ?? {}),
      });
      setElements(
        Array.isArray(initialForm.fields)
          ? (initialForm.fields as unknown as FormField[])
          : [],
      );
      setSelectedId(null);
    }
  }, [initialForm]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function addElement(type: FieldType, index?: number) {
    const newElement = createElement(type, elements.map((e) => e.key));
    const next = [...elements];
    next.splice(index ?? next.length, 0, newElement);
    setElements(next);
    setSelectedId(newElement.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const source = active.data.current?.source;
    if (source === "palette") {
      const type = active.data.current?.type as FieldType | undefined;
      if (!type) {
        return;
      }
      let index = elements.length;
      if (over.id !== "canvas") {
        const overIndex = elements.findIndex((e) => e.id === over.id);
        if (overIndex >= 0) {
          index = overIndex;
        }
      }
      addElement(type, index);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) {
      return;
    }
    setElements((items) => {
      const oldIndex = items.findIndex((e) => e.id === activeId);
      const newIndex = items.findIndex((e) => e.id === overId);
      if (oldIndex < 0 || newIndex < 0) {
        return items;
      }
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function handleSelect(id: string) {
    setSelectedId(id);
  }

  function handleDuplicate(id: string) {
    const index = elements.findIndex((e) => e.id === id);
    if (index < 0) {
      return;
    }
    const source = elements[index];
    const copy: FormField = {
      ...source,
      id: generateId(),
      key: uniqueKey(source.key, elements.map((e) => e.key)),
    };
    const next = [...elements];
    next.splice(index + 1, 0, copy);
    setElements(next);
    setSelectedId(copy.id);
  }

  function handleDelete(id: string) {
    setElements((items) => items.filter((e) => e.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  }

  function handlePatch(id: string, patch: Partial<FormField>) {
    setElements((items) =>
      items.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }

  function handleLabelChange(element: FormField, label: string) {
    const patch: Partial<FormField> = { label };
    const previousSlug = slugify(element.label);
    if (!element.key || element.key === previousSlug) {
      patch.key = uniqueKey(
        slugify(label),
        elements.filter((e) => e.id !== element.id).map((e) => e.key),
      );
    }
    handlePatch(element.id, patch);
  }

  function handleKeyChange(element: FormField, rawKey: string) {
    handlePatch(element.id, {
      key: uniqueKey(
        slugify(rawKey),
        elements.filter((e) => e.id !== element.id).map((e) => e.key),
      ),
    });
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      if (initialForm) {
        await updateForm({
          formId: initialForm.id,
          title,
          description,
          fields: elements,
          settings,
        });
      } else {
        await createForm({
          title,
          description,
          fields: elements,
          settings,
        });
      }
      navigate("/forms");
    } catch (err) {
      setError(String(err));
      setIsSaving(false);
    }
  }

  const selectedElement =
    elements.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-5 px-8 py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Builder
          </span>
          <h1 className="font-display text-3xl font-bold tracking-[-0.028em] text-neutral-900">
            {initialForm ? "Edit form" : "Create a form"}
          </h1>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              aria-label="Form title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Form title"
              className={`${inputClasses} sm:w-72`}
            />
            <input
              aria-label="Form description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional description"
              className={`${inputClasses} sm:w-96`}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <ButtonLink to="/forms" variant="ghost">
            Cancel
          </ButtonLink>
          <Button onClick={handleSave} disabled={isSaving || isInitialLoading}>
            {isSaving ? "Saving..." : "Save form"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {isInitialLoading ? (
        <p className="py-12 text-center text-neutral-500">Loading form...</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div className="grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
            <ElementPalette onAdd={addElement} />
            <Canvas
              elements={elements}
              selectedId={selectedId}
              onSelect={handleSelect}
              onDeselect={() => setSelectedId(null)}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
            <FieldInspector
              element={selectedElement}
              allElements={elements}
              settings={settings}
              onLabelChange={handleLabelChange}
              onKeyChange={handleKeyChange}
              onPatch={handlePatch}
              onSettingsChange={(patch) =>
                setSettings((prev) => ({ ...prev, ...patch }))
              }
            />
          </div>
        </DndContext>
      )}
    </div>
  );
}
