import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
 "group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[13px] font-bold tracking-[-0.01em] ring-offset-background transition-[transform,background-color,border-color,color,filter] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-[260ms] [&_svg]:ease-[cubic-bezier(0.22,1,0.36,1)] hover:[&_svg]:translate-x-[1px]",
 {
 variants: {
 variant: {
 default: "bg-primary text-primary-foreground hover:bg-primary/92 hover:brightness-110 active:brightness-95",
 destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/92 hover:brightness-110 active:brightness-95",
 outline: "border border-border/60 bg-card/60 hover:bg-accent hover:text-accent-foreground hover:border-primary/50",
 secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:brightness-110",
 ghost: "hover:bg-accent hover:text-accent-foreground",
 link: "text-primary underline-offset-4 hover:underline hover:-translate-y-0 active:scale-100",
 },
 size: {
 default: "h-10 px-5 py-2",
 sm: "h-9 rounded-xl px-3.5 text-[12px]",
 lg: "h-11 rounded-xl px-8",
 icon: "h-10 w-10 hover:[&_svg]:translate-x-0 hover:[&_svg]:scale-110",
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
