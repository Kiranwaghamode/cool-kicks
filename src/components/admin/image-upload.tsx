"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { uploadImage } from "@/server/actions/admin/catalog";

const MAX = 3 * 1024 * 1024;

/** Upload with preview. Validates type/size in the browser; the server validates again and converts to WebP. */
export function ImageUpload({
  value,
  onChange,
  folder = "products",
  label = "Image",
}: {
  value: string;
  onChange: (url: string) => void;
  folder?: "products" | "categories";
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);

  function pick(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Unsupported file", "Use JPG, PNG or WebP.");
    if (file.size > MAX) return toast.error("Image too large", "Maximum size is 3 MB.");
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.set("file", file);
    fd.set("folder", folder);
    start(async () => {
      const res = await uploadImage(fd);
      if (res.ok && res.data) {
        onChange(res.data.url);
        toast.success("Image uploaded");
      } else {
        toast.error("Upload failed", res.ok ? undefined : res.error);
      }
      setPreview(null);
    });
  }

  const shown = preview ?? value;
  return (
    <div>
      <p className="mb-1.5 pl-1 text-sm font-semibold">{label}</p>
      <div className="flex items-center gap-4">
        <div className="relative size-28 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-line-strong bg-cream-50">
          {shown ? (
            shown.startsWith("blob:") ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob: previews can't go through next/image
              <img src={shown} alt="Preview" className="size-full object-cover" />
            ) : (
              <Image src={shown} alt="Preview" fill sizes="112px" className="object-cover" />
            )
          ) : (
            <ImagePlus className="absolute inset-0 m-auto size-8 text-ink-muted" aria-hidden />
          )}
          {pending && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="size-6 animate-spin text-brand" aria-label="Uploading" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={pending}
            className="rounded-full border-[1.5px] border-line-strong bg-surface px-4 py-2 text-sm font-bold hover:border-brand"
          >
            {value ? "Replace image" : "Upload image"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-danger">
              <X className="size-4" aria-hidden /> Remove
            </button>
          )}
          <p className="text-xs text-ink-muted">JPG, PNG or WebP · max 3 MB · square works best</p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={label}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
