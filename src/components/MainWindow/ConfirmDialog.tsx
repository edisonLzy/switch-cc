import { AlertTriangle } from 'lucide-react';
import { buttonStyles, modalStyles } from '../../lib/styles';

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
  if (!isOpen) return null;

  return (
    <div className={modalStyles.backdrop} onClick={onCancel}>
      <div
        className={`${modalStyles.content} max-w-md`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {message}
          </p>
          
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className={buttonStyles.secondary}>
              取消
            </button>
            <button onClick={onConfirm} className={buttonStyles.danger}>
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}