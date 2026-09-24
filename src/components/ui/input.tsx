import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
 ({ className, type, ...props }, ref) => {
 return (
 <input
 type={type}
 className={cn(
 "flex h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.025)] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/55 transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-foreground/20 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px]",
 className,
 )}
 ref={ref}
 {...props}
 />
 );
 },
);
Input.displayName = "Input";

export { Input };
