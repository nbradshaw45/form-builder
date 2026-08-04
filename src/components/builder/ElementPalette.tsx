import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { FIELD_DEFINITIONS } from "./elementFactory";
import { GripIcon, PlusIcon } from "./icons";
import type { FieldType } from "../../types";

interface ElementPaletteProps {
  onAdd: (type: FieldType) => void;
}

function PaletteItem({
  type,
  name,
  description,
  onAdd,
}: {
  type: FieldType;
  name: string;
  description: string;
  onAdd: (type: FieldType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `palette-${type}`,
      data: { source: "palette", type },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li>
      <button
        type="button"
        ref={setNodeRef}
        style={style}
        onClick={() => onAdd(type)}
        {...attributes}
        {...listeners}
        className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left transition-colors duration-150 hover:border-primary-400 hover:bg-primary-50 active:cursor-grabbing"
      >
        <GripIcon className="size-4 shrink-0 text-neutral-300" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-semibold text-neutral-800">
            {name}
          </span>
          <span className="truncate text-xs text-neutral-400">
            {description}
          </span>
        </span>
        <PlusIcon className="size-4 shrink-0 text-neutral-300" />
      </button>
    </li>
  );
}

export function ElementPalette({ onAdd }: ElementPaletteProps) {
  const inputs = FIELD_DEFINITIONS.filter((def) => def.category === "input");
  const layouts = FIELD_DEFINITIONS.filter((def) => def.category === "layout");
  const systems = FIELD_DEFINITIONS.filter((def) => def.category === "system");

  return (
    <aside className="card flex flex-col gap-4 p-4">
      <div className="border-b border-neutral-100 pb-3">
        <h2 className="font-display text-sm font-bold tracking-[-0.02em] text-neutral-800">
          Elements
        </h2>
      </div>
      <section className="flex flex-col gap-1.5">
        <h3 className="px-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          Input fields
        </h3>
        <ul className="flex flex-col gap-2">
          {inputs.map((def) => (
            <PaletteItem
              key={def.type}
              type={def.type}
              name={def.name}
              description={def.description}
              onAdd={onAdd}
            />
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-1.5">
        <h3 className="px-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          Layout elements
        </h3>
        <ul className="flex flex-col gap-2">
          {layouts.map((def) => (
            <PaletteItem
              key={def.type}
              type={def.type}
              name={def.name}
              description={def.description}
              onAdd={onAdd}
            />
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-1.5">
        <h3 className="px-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          System fields
        </h3>
        <ul className="flex flex-col gap-2">
          {systems.map((def) => (
            <PaletteItem
              key={def.type}
              type={def.type}
              name={def.name}
              description={def.description}
              onAdd={onAdd}
            />
          ))}
        </ul>
      </section>
      <p className="text-xs text-neutral-400">
        Drag elements onto the canvas, or click to append.
      </p>
    </aside>
  );
}
