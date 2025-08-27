"use client";

import React from "react";

export function Button({ children, className = "", type = "button", onClick, disabled = false, size = "md", variant = "default" }) {
  const base =
    "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "h-8 px-3 text-sm rounded-md",
    md: "h-10 px-4 rounded-lg",
    lg: "h-12 px-6 text-lg rounded-xl",
  };
  const variants = {
    default: "bg-primary text-primary-foreground hover:opacity-90",
    outline: "border border-border bg-transparent text-foreground hover:bg-muted",
  };
  const cls = [base, sizes[size] || sizes.md, variants[variant] || variants.default, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}


