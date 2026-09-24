import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
 "group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-[13px] font-semibold ring-offset-background transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.8]",
 {
 variants: {
 variant: {
  default: "border-primary/80 bg-primary text-primary-foreground shadow-[0_1px_0_hsl(var(--foreground)/0.08)] hover:border-primary hover:bg-primary/90",
  destructive: "border-destructive/80 bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border-border bg-card text-foreground shadow-[0_1px_0_hsl(var(--foreground)/0.04)] hover:border-foreground/20 hover:bg-accent/50",
  secondary: "border-border/70 bg-secondary text-secondary-foreground hover:border-foreground/15 hover:bg-secondary/80",
  ghost: "text-muted-foreground hover:bg-accent/55 hover:text-foreground",
 link: "text-primary underline-offset-4 hover:underline",
 },
 size: {
  default: "h-9 px-4 py-2",
  sm: "h-8 px-3 text-xs",
  lg: "h-11 px-6 text-sm",
  icon: "h-9 w-9 p-0",
 },
 },
 defaultVariants: {
 variant: "default",
 size: "default",
 },
 },
);

export interface ButtonProps
 extends React.ButtonHTMLAttributes<HTMLButtonElement>,
 VariantProps<typeof buttonVariants> {
 asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
 ({ className, variant, size, asChild = false, ...props }, ref) => {
 const Comp = asChild ? Slot : "button";
 return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
 },
);
Button.displayName = "Button";

export { Button, buttonVariants };
