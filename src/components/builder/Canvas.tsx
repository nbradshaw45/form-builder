import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { FormField } from "../../types";
import { CanvasElement } from "./CanvasElement";
import { PlusIcon } from "./icons";

interface CanvasProps {
  elements: FormField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function Canvas({
  elements,
  selectedId,
  onSelect,
  onDuplicate,
  onDelete,
}: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });

  return (
    <div
      ref={setNodeRef}
      className={`card flex min-h-[420px] flex-col gap-3 p-4 transition-colors ${
        isOver ? "border-primary-400 bg-primary-50/50" : ""
      }`}
    >
      <SortableContext
        items={elements.map((element) => element.id)}
        strategy={verticalListSortingStrategy}
      >
        {elements.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-neutral-400">
            <PlusIcon className="size-8" />
            <p className="text-sm">
              Drag elements here or click them in the palette to build your
              form.
            </p>
          </div>
        ) : (
          elements.map((element) => (
            <CanvasElement
              key={element.id}
              element={element}
              isSelected={element.id === selectedId}
              onSelect={onSelect}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))
        )}
      </SortableContext>
    </div>
  );
}
