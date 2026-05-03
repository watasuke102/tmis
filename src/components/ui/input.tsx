import type * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("border", className)} {...props} />;
}

export { Input };
