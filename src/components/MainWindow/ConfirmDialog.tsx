import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-base border-2 border-border flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <DialogTitle className="text-left">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-left mt-2">
            {message}
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter>
          <Button onClick={onCancel} variant="neutral">
            取消
          </Button>
          <Button onClick={onConfirm} variant="destructive">
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}