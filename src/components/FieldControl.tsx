import { useRef, useState } from "react";
import { getFile, uploadFile, useQuery } from "wasp/client/operations";
import type { FormField, SubmissionData } from "../types";
import { formatFormulaValue } from "./builder/formula";
import { maskInput } from "../shared/mask";
import {
  errorTextClasses,
  fieldClasses,
  helpTextClasses,
  inputClasses,
  labelClasses,
  selectClasses,
  textareaClasses,
} from "../shared/styles";

interface FieldControlProps {
  field: FormField;
  value: string | number | boolean | string[] | null;
  onChange: (value: string | number | boolean | string[] | null) => void;
  allValues: SubmissionData;
  disabled?: boolean;
  error?: string | null;
  formId?: string;
  allFields?: FormField[];
}

export function FieldControl({
  field,
  value,
  onChange,
  allValues,
  disabled = false,
  error = null,
  formId,
  allFields,
}: FieldControlProps) {
  const { type, label, required, helpText, placeholder } = field;

  if (type === "hidden") {
    return null;
  }

  if (type === "section_header") {
    return (
      <div className="flex flex-col gap-1 pt-2">
        <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-neutral-800">
          {label}
        </h2>
        {field.description && (
          <p className="text-[13px] text-neutral-500">{field.description}</p>
        )}
      </div>
    );
  }

  if (type === "divider") {
    return <hr className="border-neutral-100" />;
  }

  if (type === "paragraph") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-neutral-600">{label}</p>
        {field.description && (
          <p className="text-xs text-neutral-400">{field.description}</p>
        )}
      </div>
    );
  }

  if (type === "math") {
    const computed = field.formula
      ? formatFormulaValue(field.formula, allValues, allFields, field.mathDecimals)
      : "";
    return (
      <div className={fieldClasses}>
        <div className="flex items-center gap-2">
          <label htmlFor={field.key} className={labelClasses}>
            {label}
          </label>
          <span className="rounded-full bg-primary-50 px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-primary-600">
            calculated
          </span>
        </div>
        <input
          id={field.key}
          value={computed}
          readOnly
          disabled={disabled}
          placeholder={field.formula || "Enter a formula"}
          className={`${inputClasses} font-mono`}
        />
        {helpText && (
          <span className={helpTextClasses}>{helpText}</span>
        )}
      </div>
    );
  }

  const isSystemDate = type === "created_date" || type === "modified_date";
  const isSystemUser = type === "updated_by_user";
  if ((isSystemDate || isSystemUser) && field.readonly !== false) {
    const systemValue =
      value === null || value === undefined || value === ""
        ? ""
        : String(value);
    return (
      <div className={fieldClasses}>
        <div className="flex items-center gap-2">
          <label htmlFor={field.key} className={labelClasses}>
            {label}
          </label>
          <span className="rounded-full bg-info-soft px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-info">
            system
          </span>
        </div>
        <input
          id={field.key}
          value={systemValue}
          readOnly
          disabled={disabled}
          placeholder={systemValue ? undefined : "Auto-filled on submit"}
          className={`${inputClasses} font-mono`}
        />
        {helpText && (
          <span className={helpTextClasses}>{helpText}</span>
        )}
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <div className={fieldClasses}>
        <label
          className={`group inline-flex cursor-pointer select-none items-center gap-2.5 text-[13px] font-medium text-neutral-800 ${
            disabled ? "cursor-not-allowed opacity-60" : ""
          }`}
        >
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            disabled={disabled}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="grid size-4 shrink-0 place-items-center rounded-[5px] border-[1.5px] border-neutral-400 bg-white transition-all duration-150 peer-checked:border-primary-600 peer-checked:bg-primary-600 group-hover:border-primary-600 peer-checked:after:rotate-45 after:block after:size-[4px] after:border-b-2 after:border-r-2 after:border-white after:opacity-0 after:transition-opacity peer-checked:after:opacity-100"
          />
          {label}
          {required && <span className="text-danger">*</span>}
        </label>
        {helpText && <span className={helpTextClasses}>{helpText}</span>}
        {error && <span className={errorTextClasses}>{error}</span>}
      </div>
    );
  }

  if (type === "radio") {
    const options = field.options ?? [];
    const inline = field.layout === "inline";
    return (
      <div className={fieldClasses}>
        <span className={labelClasses}>
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
        <div
          role="radiogroup"
          className={
            inline
              ? "flex flex-wrap gap-x-5 gap-y-2"
              : "flex flex-col gap-2"
          }
        >
          {options.map((option, index) => (
            <label
              key={option}
              className={`flex items-center gap-2 text-[13px] text-neutral-700 ${
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
            >
              <input
                type="radio"
                name={field.key}
                value={option}
                checked={(value as string) === option}
                onChange={() => onChange(option)}
                disabled={disabled}
                className="size-4 accent-primary-600"
              />
              <span>{field.optionLabels?.[index] ?? option}</span>
            </label>
          ))}
        </div>
        {helpText && <span className={helpTextClasses}>{helpText}</span>}
        {error && <span className={errorTextClasses}>{error}</span>}
      </div>
    );
  }

  if (type === "multi_select") {
    const options = field.options ?? [];
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const inline = field.layout === "inline";
    function toggle(option: string) {
      const next = selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option];
      onChange(next);
    }
    return (
      <div className={fieldClasses}>
        <span className={labelClasses}>
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
        <div
          className={
            inline
              ? "flex flex-wrap gap-x-5 gap-y-2"
              : "flex flex-col gap-2"
          }
        >
          {options.map((option, index) => (
            <label
              key={option}
              className={`flex items-center gap-2 text-[13px] text-neutral-700 ${
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
                disabled={disabled}
                className="size-4 rounded border-neutral-300 accent-primary-600"
              />
              <span>{field.optionLabels?.[index] ?? option}</span>
            </label>
          ))}
        </div>
        {helpText && <span className={helpTextClasses}>{helpText}</span>}
        {error && <span className={errorTextClasses}>{error}</span>}
      </div>
    );
  }

  if (type === "rating") {
    return (
      <div className={fieldClasses}>
        <span className={labelClasses}>
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
        <RatingControl
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
        {helpText && <span className={helpTextClasses}>{helpText}</span>}
        {error && <span className={errorTextClasses}>{error}</span>}
      </div>
    );
  }

  if (type === "slider") {
    return (
      <div className={fieldClasses}>
        <span className={labelClasses}>
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
        <SliderControl
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
        {helpText && <span className={helpTextClasses}>{helpText}</span>}
        {error && <span className={errorTextClasses}>{error}</span>}
      </div>
    );
  }

  if (type === "currency") {
    const numValue = typeof value === "number" ? String(value) : "";
    return (
      <div className={fieldClasses}>
        <label htmlFor={field.key} className={labelClasses}>
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
        <div className="flex items-stretch">
          {field.prefix && (
            <span className="flex items-center rounded-l-lg border border-r-0 border-neutral-300 bg-muted px-3 text-sm text-neutral-500">
              {field.prefix}
            </span>
          )}
          <input
            id={field.key}
            type="number"
            step={field.step ?? "any"}
            value={numValue}
            onChange={(event) =>
              onChange(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
            placeholder={placeholder}
            disabled={disabled}
            className={`${inputClasses} ${
              field.prefix
                ? "rounded-l-none"
                : field.suffix
                  ? "rounded-r-none"
                  : ""
            }`}
          />
          {field.suffix && (
            <span className="flex items-center rounded-r-lg border border-l-0 border-neutral-300 bg-muted px-3 text-sm text-neutral-500">
              {field.suffix}
            </span>
          )}
        </div>
        {helpText && <span className={helpTextClasses}>{helpText}</span>}
        {error && <span className={errorTextClasses}>{error}</span>}
      </div>
    );
  }

  if (type === "signature") {
    return (
      <div className={fieldClasses}>
        <span className={labelClasses}>
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
        <SignatureControl
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
        {helpText && <span className={helpTextClasses}>{helpText}</span>}
        {error && <span className={errorTextClasses}>{error}</span>}
      </div>
    );
  }

  if (type === "file_upload") {
    return (
      <div className={fieldClasses}>
        <span className={labelClasses}>
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
        <FileUploadControl
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          formId={formId}
        />
        {helpText && <span className={helpTextClasses}>{helpText}</span>}
        {error && <span className={errorTextClasses}>{error}</span>}
      </div>
    );
  }

  const renderControl = () => {
    if (type === "select" || type === "user") {
      return (
        <select
          id={field.key}
          value={(value as string) ?? ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={selectClasses}
        >
          <option value="">
            {type === "user" ? "Select a user..." : "Select..."}
          </option>
          {(field.options ?? []).map((option, index) => (
            <option key={option} value={option}>
              {field.optionLabels?.[index] ?? option}
            </option>
          ))}
        </select>
      );
    }

    if (type === "textarea") {
      return (
        <textarea
          id={field.key}
          value={(value as string) ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          disabled={disabled}
          className={textareaClasses}
        />
      );
    }

    const hasMask = Boolean(field.mask) && (type === "text" || type === "phone");
    const htmlType =
      hasMask
        ? "text"
        : type === "created_date" || type === "modified_date"
          ? "date"
          : type === "updated_by_user" || type === "phone" || type === "confirm"
            ? type === "phone"
              ? "tel"
              : "text"
            : type;

    return (
      <input
        id={field.key}
        type={htmlType}
        inputMode={
          type === "phone"
            ? "tel"
            : type === "url"
              ? "url"
              : type === "email"
                ? "email"
                : undefined
        }
        value={
          hasMask
            ? maskInput((value as string) ?? "", field.mask ?? "")
            : (value as string) ?? ""
        }
        onChange={(event) =>
          hasMask
            ? onChange(maskInput(event.target.value, field.mask ?? ""))
            : onChange(event.target.value)
        }
        placeholder={placeholder}
        disabled={disabled}
        className={inputClasses}
      />
    );
  };

  return (
    <div className={fieldClasses}>
      <label htmlFor={field.key} className={labelClasses}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {renderControl()}
      {helpText && <span className={helpTextClasses}>{helpText}</span>}
      {error && <span className={errorTextClasses}>{error}</span>}
    </div>
  );
}

function RatingControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: string | number | boolean | string[] | null;
  onChange: (value: string | number | boolean | string[] | null) => void;
  disabled: boolean;
}) {
  const count = field.starCount ?? 5;
  const current = typeof value === "number" ? value : 0;
  const [hover, setHover] = useState(0);
  const active = hover || current;

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }, (_, index) => index + 1).map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Rate ${star} of ${count}`}
          disabled={disabled}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className={`p-0.5 transition-transform ${
            disabled
              ? "cursor-not-allowed"
              : "cursor-pointer hover:scale-110"
          }`}
        >
          <StarIcon filled={star <= active} />
        </button>
      ))}
      {current > 0 && (
        <span className="ml-2 text-xs font-semibold text-neutral-600">
          {current}/{count}
        </span>
      )}
    </div>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className={`size-6 ${filled ? "text-amber-400" : "text-neutral-300"}`}
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SliderControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: string | number | boolean | string[] | null;
  onChange: (value: string | number | boolean | string[] | null) => void;
  disabled: boolean;
}) {
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const step = field.step ?? 1;
  const num = typeof value === "number" ? value : min;
  const display = Number.isInteger(num) ? String(num) : String(num);

  return (
    <div className="flex flex-col gap-1">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={num}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        className="w-full accent-primary-600 disabled:cursor-not-allowed"
      />
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>
          {min}
          {field.suffix ? ` ${field.suffix}` : ""}
        </span>
        <span className="rounded bg-muted px-2 py-0.5 font-mono font-semibold text-neutral-700">
          {display}
          {field.suffix ? ` ${field.suffix}` : ""}
        </span>
        <span>
          {max}
          {field.suffix ? ` ${field.suffix}` : ""}
        </span>
      </div>
    </div>
  );
}

function SignatureControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: string | number | boolean | string[] | null;
  onChange: (value: string | number | boolean | string[] | null) => void;
  disabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const color = field.penColor ?? "#1e293b";
  const penWidth = field.penWidth ?? 2;

  const hasSignature = typeof value === "string" && value !== "";

  function getContext() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) {
      return;
    }
    event.preventDefault();
    const ctx = getContext();
    if (!ctx) {
      return;
    }
    const { x, y } = getPoint(event);
    ctx.strokeStyle = color;
    ctx.lineWidth = penWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    try {
      canvasRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Pointer may not be active (e.g., synthetic events).
    }
    setDrawing(true);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) {
      return;
    }
    const ctx = getContext();
    if (!ctx) {
      return;
    }
    const { x, y } = getPoint(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDrawing() {
    if (!drawing) {
      return;
    }
    setDrawing(false);
    const dataUrl = canvasRef.current?.toDataURL("image/png") ?? "";
    onChange(dataUrl);
  }

  function clear() {
    const ctx = getContext();
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    onChange("");
  }

  if (hasSignature && typeof value === "string") {
    return (
      <div className="flex flex-col gap-2">
        <img
          src={value}
          alt="Signature preview"
          className="max-h-40 w-full rounded-lg border border-neutral-200 bg-white object-contain"
        />
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            className="self-start rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:text-neutral-800"
          >
            Clear signature
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={endDrawing}
        onPointerLeave={endDrawing}
        className="w-full cursor-crosshair touch-none rounded-lg border border-neutral-200 bg-white disabled:cursor-not-allowed"
      />
      {!disabled && (
        <button
          type="button"
          onClick={clear}
          className="self-start rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:text-neutral-800"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function FileUploadControl({
  field,
  value,
  onChange,
  disabled,
  formId,
}: {
  field: FormField;
  value: string | number | boolean | string[] | null;
  onChange: (value: string | number | boolean | string[] | null) => void;
  disabled: boolean;
  formId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const fileId = typeof value === "string" && value ? value : "";
  const { data: fileData } = useQuery(
    getFile,
    { fileId },
    { enabled: Boolean(fileId) },
  );

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    setUploadError(null);
    if (field.accept) {
      const accepted = field.accept
        .split(",")
        .map((item) => item.trim().toLowerCase());
      const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      const mimeOk = accepted.some(
        (item) =>
          item === file.type.toLowerCase() ||
          (item.startsWith(".") && item === ext),
      );
      if (accepted.length > 0 && !mimeOk) {
        setUploadError(`File type not allowed (${field.accept}).`);
        return;
      }
    }
    const maxBytes = (field.maxFileSizeMb ?? 5) * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(
        `File is too large (max ${field.maxFileSizeMb ?? 5}MB).`,
      );
      return;
    }
    const dataBase64 = await fileToBase64(file);
    setUploading(true);
    try {
      const result = await uploadFile({
        formId: formId ?? "",
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        dataBase64,
      });
      setUploadedName(result.originalName);
      onChange(result.id);
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setUploading(false);
    }
  }

  if (fileId) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-muted px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-neutral-700">
            <FileIcon className="size-4 shrink-0 text-neutral-400" />
            <span className="truncate">
              {fileData?.originalName ?? uploadedName ?? "Uploaded file"}
            </span>
            {fileData && (
              <span className="shrink-0 font-mono text-[11px] text-neutral-400">
                {formatBytes(fileData.sizeBytes)}
              </span>
            )}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="shrink-0 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-600 hover:border-red-300 hover:text-red-600"
            >
              Remove
            </button>
          )}
        </div>
        {uploadError && (
          <span className={errorTextClasses}>{uploadError}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-4 text-[13px] font-medium text-neutral-500 transition-colors ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700"
        }`}
      >
        <FileIcon className="size-4" />
        {uploading ? "Uploading..." : "Choose a file"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={field.accept || undefined}
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFile(file);
          }
          event.target.value = "";
        }}
        className="hidden"
      />
      {uploadError && <span className={errorTextClasses}>{uploadError}</span>}
    </div>
  );
}

function FileIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
      <path
        d="M11 2v4a1 1 0 0 0 1 1h4"
        stroke="white"
        strokeWidth={1.5}
        fill="none"
      />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
