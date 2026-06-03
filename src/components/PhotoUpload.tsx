"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadImageFromBlob, loadImageFromFile } from "@/lib/imageLoad";

interface PhotoUploadProps {
  previewUrl: string | null;
  onFileSelect: (file: File, dataUrl: string, width: number, height: number) => void;
  disabled?: boolean;
}

export function PhotoUpload({ previewUrl, onFileSelect, disabled }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pasteHint, setPasteHint] = useState(false);

  const applyImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const loaded = await loadImageFromFile(file);
      onFileSelect(loaded.file, loaded.dataUrl, loaded.width, loaded.height);
    },
    [onFileSelect]
  );

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          const loaded = await loadImageFromBlob(blob);
          onFileSelect(loaded.file, loaded.dataUrl, loaded.width, loaded.height);
          setPasteHint(false);
          return;
        }
      }
    },
    [disabled, onFileSelect]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      void handlePaste(e);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handlePaste]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) void applyImage(file);
    },
    [disabled, applyImage]
  );

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl border-2 border-dashed transition-all min-h-[320px] flex flex-col items-center justify-center overflow-hidden
        ${disabled ? "opacity-60 pointer-events-none" : "cursor-pointer hover:border-niteos-electric/60 hover:shadow-glow"}
        ${previewUrl ? "border-niteos-electric/40" : "border-niteos-border"}
        ${pasteHint ? "border-niteos-electric shadow-glow" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onFocus={() => setPasteHint(true)}
      onBlur={() => setPasteHint(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void applyImage(file);
        }}
      />

      {previewUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Фасад здания"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-niteos-bg/90 via-transparent to-transparent" />
          <p className="relative z-10 mt-auto mb-4 text-sm text-niteos-muted px-4 text-center">
            Клик / перетащить / <kbd className="px-1.5 py-0.5 rounded bg-niteos-surface border border-niteos-border text-niteos-electric">Ctrl+V</kbd> для замены
          </p>
        </>
      ) : (
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-niteos-card border border-niteos-border flex items-center justify-center">
            <svg className="w-8 h-8 text-niteos-electric" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-lg font-medium mb-1">Загрузите фото здания</p>
          <p className="text-sm text-niteos-muted max-w-sm mx-auto">
            Перетащите файл, нажмите для выбора или вставьте из буфера{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-niteos-surface border border-niteos-border text-niteos-electric">Ctrl+V</kbd>
          </p>
        </div>
      )}
    </div>
  );
}
