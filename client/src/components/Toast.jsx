import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success', action = null) => {
    setToast({ message, type, action, id: Date.now() });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          action={toast.action} 
          onClose={hideToast} 
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function Toast({ message, type, action, onClose }) {
  useEffect(() => {
    if (!action) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [action, onClose]);

  const bgClass = type === 'error' ? 'bg-red-600' : 'bg-slate-800';

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded shadow-lg text-white ${bgClass}`}>
      <span className="text-sm font-medium">{message}</span>
      {action && (
        <button 
          onClick={() => { action.onClick(); onClose(); }}
          className="text-sm font-bold text-emerald-400 hover:text-emerald-300 ml-2"
        >
          {action.label}
        </button>
      )}
      <button onClick={onClose} className="opacity-75 hover:opacity-100 ml-2">
        <X size={16} />
      </button>
    </div>
  );
}
