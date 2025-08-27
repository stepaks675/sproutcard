"use client";

import React from "react";

export function Card({ children, className = "", ...props }) {
  const base = "rounded-xl border bg-card text-card-foreground shadow";
  const cls = [base, className].filter(Boolean).join(" ");
  return (
    <div className={cls} {...props}>
      {children}
    </div>
  );
}


