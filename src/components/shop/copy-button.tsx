"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonVariant, type ButtonSize } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied!",
  variant = "dark",
  size = "sm",
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`"${value}" copied`);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Couldn't copy", value);
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
