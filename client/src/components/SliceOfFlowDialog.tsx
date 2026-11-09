import { useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  onDismiss?: () => void;
  onReturnFocus?: () => void;
}

/** Existing Radix dialog supplies focus containment and hides background from assistive tech. */
export default function SliceOfFlowDialog({ open, title, description, children, className = '', onDismiss, onReturnFocus }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) onDismiss?.(); }}>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        overlayClassName="sof-dialog-overlay"
        className={`sof-dialog block gap-0 border-0 p-0 bg-[#FAF7F2] max-w-xl sm:max-w-xl ${className}`}
        onOpenAutoFocus={event => {
          event.preventDefault();
          const initial = contentRef.current?.querySelector<HTMLElement>('[data-dialog-initial]');
          (initial ?? contentRef.current)?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={event => {
          if (onReturnFocus) {
            event.preventDefault();
            onReturnFocus();
          }
        }}
        onEscapeKeyDown={event => { if (!onDismiss) event.preventDefault(); }}
        onPointerDownOutside={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
