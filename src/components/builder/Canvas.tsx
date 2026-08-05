import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import type { FormField } from "../../types";
import { gridColumnClasses, gridRowClasses, columnStyle } from "../../shared/grid";
import { CanvasElement } from "./CanvasElement";
import { PlusIcon } from "./icons";

interface CanvasProps {
  elements: FormField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function Canvas({
  elements,
  selectedId,
  onSelect,
  onDeselect,
  onDuplicate,
  onDelete,
}: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });

  return (
    <div
      ref={setNodeRef}
      onClick={onDeselect}
      className={`card flex min-h-[420px] flex-col p-2 transition-colors ${
        isOver ? "border-primary-400 bg-primary-50/50" : ""
      }`}
    >
      <SortableContext
        items={elements.map((element) => element.id)}
        strategy={rectSortingStrategy}
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
          <div className={gridRowClasses}>
            {elements.map((element) => (
              <div
                key={element.id}
                className={gridColumnClasses()}
                style={columnStyle(element.width)}
              >
                <CanvasElement
                  element={element}
                  isSelected={element.id === selectedId}
                  onSelect={onSelect}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                />
              </div>
            ))}
          </div>
        )}
      </SortableContext>
    </div>
  );
}
