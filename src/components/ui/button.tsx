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
      className={cn(
        "px-1 py-px inline-flex items-center gap-1 border hover:cursor-pointer",
        className,
      )}
      type={type}
      {...props}
    />
  );
}

export { Button };
