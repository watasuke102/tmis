import type * as React from "react";
import { cn } from "@/lib/utils";

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-1 rounded-xs",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
