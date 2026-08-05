import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FieldControl } from "../FieldControl";
import type { FormField } from "../../types";
import { DuplicateIcon, GripIcon, TrashIcon } from "./icons";

interface CanvasElementProps {
  element: FormField;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CanvasElement({
  element,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
}: CanvasElementProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(element.id);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onSelect(element.id);
        }
      }}
      className={`group relative cursor-pointer rounded-lg border bg-white p-3 transition-shadow ${
        isSelected
          ? "border-primary-600 ring-2 ring-primary-100"
          : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={`Reorder ${element.label}`}
          className="-ml-1 mt-0.5 cursor-grab rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
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
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          aria-label={`Duplicate ${element.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate(element.id);
          }}
          className="rounded bg-white p-1 text-neutral-500 shadow-sm ring-1 ring-neutral-200 hover:bg-neutral-50 hover:text-neutral-800"
        >
          <DuplicateIcon />
        </button>
        <button
          type="button"
          aria-label={`Delete ${element.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(element.id);
          }}
          className="rounded bg-white p-1 text-red-500 shadow-sm ring-1 ring-neutral-200 hover:bg-red-50"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}
