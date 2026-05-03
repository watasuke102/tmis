"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

function Button({
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      className={cn("inline-flex items-center gap-1 border", className)}
      type={type}
      {...props}
    />
  );
}

export { Button };
