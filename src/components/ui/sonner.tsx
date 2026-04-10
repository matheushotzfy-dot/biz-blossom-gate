import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
 return (
 <Sonner
 theme="dark"
 position="bottom-right"
 className="toaster group"
 toastOptions={{
 style: {
 borderRadius: "1rem",
 backdropFilter: "blur(20px)",
 fontSize: "13px",
 fontFamily: "'DM Sans', sans-serif",
 fontWeight: 500,
 padding: "14px 18px",
 gap: "10px",
 boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)",
 },
 classNames: {
 toast:
 "group toast group-[.toaster]:bg-card/95 group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-xl",
 description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
 actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-xl group-[.toast]:text-xs group-[.toast]:font-semibold",
 cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-xl group-[.toast]:text-xs",
 success: "group-[.toaster]:border-primary/30 group-[.toaster]:bg-primary/10 group-[.toaster]:text-primary",
 error: "group-[.toaster]:border-destructive/30 group-[.toaster]:bg-destructive/10 group-[.toaster]:text-destructive",
 warning: "group-[.toaster]:border-warning/30 group-[.toaster]:bg-warning/10 group-[.toaster]:text-warning",
 info: "group-[.toaster]:border-info/30 group-[.toaster]:bg-info/10 group-[.toaster]:text-info",
 },
 }}
 {...props}
 />
 );
};

export { Toaster, toast };
