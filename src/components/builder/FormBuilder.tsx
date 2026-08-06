import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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
import { FieldControl } from "../FieldControl";
import { FieldInspector } from "./FieldInspector";
import { GripIcon } from "./icons";
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

type DragTarget = {
  index: number;
  fits: boolean;
};

function simulateRows(items: FormField[]): number[] {
  const rows: number[] = [];
  let row = 0;
  let used = 0;
  for (const item of items) {
    const width = (item.width ?? 12) / 12;
    if (used > 0 && used + width > 1.0001) {
      row += 1;
      used = 0;
    }
    rows.push(row);
    used += width;
  }
  return rows;
}

function computeDragTarget(
  active: DragEndEvent["active"],
  over: DragEndEvent["over"] | null,
  elements: FormField[],
): DragTarget | null {
  if (!over) {
    return null;
  }
  const activeId = active.id as string;
  if (over.id === "canvas") {
    return { index: elements.length, fits: true };
  }
  const overId = over.id as string;
  if (activeId === overId) {
    return null;
  }
  const oldIndex = elements.findIndex((e) => e.id === activeId);
  const overIndex = elements.findIndex((e) => e.id === overId);
  if (oldIndex < 0 || overIndex < 0) {
    return null;
  }

  const translated = active.rect.current.translated;
  const overRect = over.rect;
  let insertAfter = false;
  if (translated && overRect) {
    const activeCenterX = translated.left + translated.width / 2;
    const activeCenterY = translated.top + translated.height / 2;
    const overCenterX = overRect.left + overRect.width / 2;
    const overCenterY = overRect.top + overRect.height / 2;
    insertAfter = activeCenterX > overCenterX || activeCenterY > overCenterY;
  }

  const next = [...elements];
  const [moved] = next.splice(oldIndex, 1);
  const overNewIndex = next.findIndex((e) => e.id === overId);
  const insertAt = overNewIndex + (insertAfter ? 1 : 0);
  next.splice(insertAt, 0, moved);

  const movedNewIndex = insertAt;
  const rows = simulateRows(next);
  const overNewIndex2 = next.findIndex((e) => e.id === overId);
  const fits = rows[movedNewIndex] === rows[overNewIndex2];

  return { index: insertAt, fits };
}

export function FormBuilder({
  initialForm,
  isInitialLoading = false,
}: FormBuilderProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_FORM_SETTINGS);
  const [activeDrag, setActiveDrag] = useState<{
    element: FormField;
    width: number;
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<{
    index: number;
    fits: boolean;
  } | null>(null);
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

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    if (active.data.current?.source === "palette") {
      return;
    }
    const element = elements.find((e) => e.id === active.id);
    if (!element) {
      return;
    }
    const initialRect = active.rect.current.initial;
    let width = initialRect ? initialRect.width : 0;
    if (!width) {
      const node = document.querySelector(
        `[data-element-id="${CSS.escape(element.id)}"]`,
      );
      if (node) {
        width = node.getBoundingClientRect().width;
      }
    }
    setActiveDrag({ element, width });
  }

  function handleDragMove(event: DragEndEvent) {
    if (event.active.data.current?.source === "palette") {
      return;
    }
    setDragTarget(computeDragTarget(event.active, event.over, elements));
  }

  function handleDragCancel() {
    setActiveDrag(null);
    setDragTarget(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    setDragTarget(null);
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

    const target = computeDragTarget(active, over, elements);
    if (!target) {
      return;
    }
    setElements((items) => {
      const oldIndex = items.findIndex((e) => e.id === active.id);
      if (oldIndex < 0) {
        return items;
      }
      const next = [...items];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(target.index, 0, moved);
      return next;
    });
  }

  function handleSelect(id: string) {
    setSelectedId(id);
  }

  function handleMove(id: string, direction: -1 | 1) {
    setElements((items) => {
      const index = items.findIndex((e) => e.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) {
        return items;
      }
      return arrayMove(items, index, target);
    });
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
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div
            className="grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]"
            onClick={() => setSelectedId(null)}
          >
            <ElementPalette onAdd={addElement} />
            <Canvas
              elements={elements}
              selectedId={selectedId}
              dragTarget={dragTarget}
              multiStep={settings.multiStep === true}
              onSelect={handleSelect}
              onDeselect={() => setSelectedId(null)}
              onMove={handleMove}
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
              onDeselect={() => setSelectedId(null)}
              onSettingsChange={(patch) =>
                setSettings((prev) => ({ ...prev, ...patch }))
              }
            />
          </div>
          <DragOverlay>
            {activeDrag ? (
              <DragPreview
                element={activeDrag.element}
                width={activeDrag.width}
                fits={dragTarget?.fits ?? true}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function DragPreview({
  element,
  width,
  fits,
}: {
  element: FormField;
  width: number;
  fits: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div
        className={`flex cursor-grabbing items-start gap-2 rounded-lg border bg-white p-3 shadow-lg ${
          fits ? "border-primary-600" : "border-red-400"
        }`}
        style={width > 0 ? { width } : { minWidth: 300 }}
      >
        <div className="mt-0.5 shrink-0 text-neutral-400">
          <GripIcon />
        </div>
        <div className="pointer-events-none min-w-0 flex-1">
          <FieldControl
            field={element}
            value={null}
            onChange={() => {
              /* Preview only */
            }}
            allValues={{}}
            disabled
          />
        </div>
      </div>
      {!fits && (
        <div
          className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 shadow-lg"
          style={width > 0 ? { width } : { minWidth: 300 }}
        >
          Won&apos;t sit next to this field — it will wrap to the next row.
        </div>
      )}
    </div>
  );
}
