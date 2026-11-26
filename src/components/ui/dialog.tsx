import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type DialogOrigin = { x: number; y: number };
let lastDialogOrigin: DialogOrigin = { x: 0, y: 0 };

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest("button, [role='button'], a");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    lastDialogOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, { capture: true });
}

const DialogMotionContext = React.createContext<{
  origin: DialogOrigin;
  setOrigin: React.Dispatch<React.SetStateAction<DialogOrigin>>;
}>({ origin: { x: 0, y: 0 }, setOrigin: () => undefined });

const Dialog = ({ children, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  const [origin, setOrigin] = React.useState<DialogOrigin>({ x: 0, y: 0 });
  
  return (
    <DialogMotionContext.Provider value={{ origin, setOrigin }}>
      <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>
    </DialogMotionContext.Provider>
  );
};

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>(({ onPointerDown, ...props }, ref) => {
  const { setOrigin } = React.useContext(DialogMotionContext);
  return (
    <DialogPrimitive.Trigger
      ref={ref}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const nextOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        lastDialogOrigin = nextOrigin;
        setOrigin(nextOrigin);
        onPointerDown?.(event);
      }}
      {...props}
    />
  );
});
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-background/75 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200 ease-out",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, style, ...props }, ref) => {
  const { origin, setOrigin } = React.useContext(DialogMotionContext);

  React.useLayoutEffect(() => {
    // For programmatic dialogs or when context origin is not yet set, 
    // sync with last known pointer position or screen center
    if (origin.x === 0 && origin.y === 0) {
      if (lastDialogOrigin.x > 0) {
        setOrigin(lastDialogOrigin);
      } else if (typeof window !== "undefined") {
        setOrigin({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      }
    }
  }, [origin.x, origin.y, setOrigin]);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "dialog-origin-motion fixed left-[50%] top-[50%] z-50 grid w-full grid-cols-[minmax(0,1fr)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/80 bg-card p-6 shadow-2xl overlay-surface rounded-xl",
          className
        )}
        style={
          {
            ...style,
            "--dialog-origin-x": origin.x === 0 ? "50vw" : `${origin.x}px`,
            "--dialog-origin-y": origin.y === 0 ? "50vh" : `${origin.y}px`,
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg h-8 w-8 flex items-center justify-center opacity-50 ring-offset-background transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-100 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
