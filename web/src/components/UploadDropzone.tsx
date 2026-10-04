"use client";

import { useRef, useState } from "react";
import { ImageUp, X } from "lucide-react";

interface Props {
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
}

export function UploadDropzone({ file, previewUrl, error, disabled, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(files: FileList | null) {
    if (files && files[0]) onSelect(files[0]);
  }

  if (file && previewUrl) {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm">
          <span className="truncate text-muted">{(file.size / 1024 / 1024).toFixed(2)} Mo · prêt à être analysé</span>
          <button type="button" disabled={disabled} onClick={() => onSelect(null)} className="btn-secondary !px-2.5 !py-1.5" aria-label="Retirer l'image">
            <X size={16} aria-hidden /> Retirer
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="Aperçu de l'échographie sélectionnée" className="mx-auto max-h-80 w-full bg-black object-contain" />
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="ultrasound-file"
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) pick(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
          dragging ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-primary/60"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <ImageUp size={32} className="text-primary" aria-hidden />
        <span className="font-medium">Déposez l'échographie ici ou cliquez pour parcourir</span>
        <span className="text-sm text-muted">PNG ou JPEG · 10 Mo maximum</span>
        <input
          ref={inputRef}
          id="ultrasound-file"
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          disabled={disabled}
          aria-describedby={error ? "upload-error" : undefined}
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }}
        />
      </label>
      {error && <p id="upload-error" role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
