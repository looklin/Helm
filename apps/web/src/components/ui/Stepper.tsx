import React from 'react';

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  onInputClick?: () => void;
  className?: string;
}

const Stepper: React.FC<StepperProps> = ({
  value,
  min = -100,
  max = 100,
  onChange,
  onInputClick,
  className = '',
}) => {
  const handleMinus = () => {
    if (value > min) onChange(value - 1);
  };

  const handlePlus = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div className={`flex items-center bg-slate-100/80 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-slate-200/40 ${className}`}>
      {/* Minus Button */}
      <button
        onClick={handleMinus}
        disabled={value <= min}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm text-slate-600 active:scale-90 transition-all disabled:opacity-30 disabled:active:scale-100"
      >
        <i className="ri-subtract-line font-bold"></i>
      </button>

      {/* Value Display */}
      <div 
        onClick={onInputClick}
        className="px-3 min-w-[48px] text-center font-bold text-slate-800 text-base cursor-pointer hover:bg-white/50 rounded-lg transition-colors py-1 mx-1"
      >
        {value}
      </div>

      {/* Plus Button */}
      <button
        onClick={handlePlus}
        disabled={value >= max}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm text-slate-600 active:scale-90 transition-all disabled:opacity-30 disabled:active:scale-100"
      >
        <i className="ri-add-line font-bold"></i>
      </button>
    </div>
  );
};

export default Stepper;
