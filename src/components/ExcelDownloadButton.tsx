"use client";

import { Download } from "lucide-react";

type Props = {
  onClick: () => void;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  className?: string;
};

export function ExcelDownloadButton({
  onClick,
  label = "Download Excel",
  variant = "secondary",
  disabled,
  className = "",
}: Props) {
  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "ghost"
        ? "btn-ghost"
        : "btn-secondary";

  return (
    <button
      type="button"
      className={`btn ${variantClass} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      title="Download detailed data as Excel (.xlsx)"
    >
      <Download size={16} />
      {label}
    </button>
  );
}
