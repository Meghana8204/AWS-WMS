import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-2xl'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className={`relative bg-white w-full ${maxWidth} rounded-[40px] shadow-2xl overflow-hidden animate-premium-fade`}>
        {/* Header */}
        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
           <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
           </div>
           <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
           >
             <X className="w-6 h-6" />
           </button>
        </div>

        {/* Body */}
        <div className="p-10 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
