import React from 'react';

interface NumberKeyboardProps {
  visible: boolean;
  onClose: () => void;
  onInput: (key: string) => void;
  onDelete: () => void;
  title?: string;
}

const NumberKeyboard: React.FC<NumberKeyboardProps> = ({
  visible,
  onClose,
  onInput,
  onDelete,
  title = '数字键盘',
}) => {
  const keys = [
    '1', '2', '3', 
    '4', '5', '6', 
    '7', '8', '9', 
    '-', '0', '.',
    'delete'
  ];

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-start pointer-events-none p-4">
      {/* Backdrop for closing */}
      <div 
        className="absolute inset-0 bg-black/5 pointer-events-auto backdrop-blur-[2px]" 
        onClick={onClose}
      />
      
      {/* Keyboard Content - Floating at top */}
      <div className="relative w-full max-w-md mx-auto bg-white/90 backdrop-blur-2xl border border-white/40 rounded-[28px] shadow-2xl pointer-events-auto transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-top-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/30">
          <div className="flex flex-col">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">参数调节</span>
            <span className="text-slate-800 text-sm font-bold">{title}</span>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100/50 text-slate-600 hover:bg-slate-200/50 active:scale-90 transition-all"
          >
            <i className="ri-close-line text-xl font-bold"></i>
          </button>
        </div>

        {/* Keys Grid */}
        <div className="p-3 grid grid-cols-3 gap-2">
          {keys.map((key) => (
            <button
              key={key}
              onClick={() => key === 'delete' ? onDelete() : onInput(key)}
              className={`
                h-12 md:h-14 rounded-2xl flex items-center justify-center text-xl font-semibold transition-all active:scale-95
                ${key === 'delete' ? 'bg-red-50 text-red-500 col-span-3 h-10 text-base' : 'bg-white/80 shadow-sm border border-slate-100/50 text-slate-700 hover:bg-white'}
                ${key === '.' || key === '-' ? 'text-blue-500' : ''}
              `}
            >
              {key === 'delete' ? (
                <div className="flex items-center space-x-2">
                  <i className="ri-delete-back-2-line"></i>
                  <span className="text-xs font-bold uppercase tracking-wider">退格修改</span>
                </div>
              ) : (
                key
              )}
            </button>
          ))}
        </div>

        {/* Bottom indicator/handle */}
        <div className="flex justify-center pb-2">
           <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default NumberKeyboard;
