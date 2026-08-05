import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { useMemo } from "react";
import type { FormField } from "../../types";
import { gridRowClasses } from "../../shared/grid";
import { CanvasElement } from "./CanvasElement";
import { PlusIcon } from "./icons";

interface CanvasProps {
  elements: FormField[];
  selectedId: string | null;
  dragTarget: { index: number; fits: boolean } | null;
  multiStep?: boolean;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function Canvas({
  elements,
  selectedId,
  dragTarget,
  multiStep = false,
  onSelect,
  onDeselect,
  onMove,
  onDuplicate,
  onDelete,
}: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  const firstHeaderIndex = elements.findIndex(
    (element) => element.type === "section_header",
  );
  let stepCounter = firstHeaderIndex > 0 ? 1 : 0;

  const strategy = useMemo<SortingStrategy>(() => {
    if (!dragTarget) {
      return rectSortingStrategy;
    }
    const targetIndex = dragTarget.index;
    return ({ rects, activeIndex, index }) => {
      const newRects = arrayMove(rects, targetIndex, activeIndex);
      const oldRect = rects[index];
      const newRect = newRects[index];
      if (!newRect || !oldRect) {
        return null;
      }
      return {
        x: newRect.left - oldRect.left,
        y: newRect.top - oldRect.top,
        scaleX: newRect.width / oldRect.width,
        scaleY: newRect.height / oldRect.height,
      };
    };
  }, [dragTarget]);

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
        strategy={strategy}
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
            {elements.map((element, index) => {
              let stepNumber: number | undefined;
              if (multiStep && element.type === "section_header") {
                stepCounter += 1;
                stepNumber = stepCounter;
              }
              return (
                <CanvasElement
                  key={element.id}
                  element={element}
                  isSelected={element.id === selectedId}
                  index={index}
                  total={elements.length}
                  stepNumber={stepNumber}
                  onSelect={onSelect}
                  onMove={onMove}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                />
              );
            })}
          </div>
        )}
      </SortableContext>
    </div>
  );
}
