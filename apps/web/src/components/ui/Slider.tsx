import React from 'react';

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  activeColor?: string;
  className?: string;
}

const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 100,
  onChange,
  activeColor = '#3b82f6',
  className = '',
}) => {
  const range = max - min;
  const percentage = ((value - min) / range) * 100;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  return (
    <div className={`relative flex items-center w-full h-8 group ${className}`}>
      {/* Track Background */}
      <div className="absolute w-full h-1.5 bg-slate-200/50 rounded-full" />
      
      {/* Active Track */}
      <div 
        className="absolute h-1.5 rounded-full transition-all duration-75"
        style={{ 
          width: `${percentage}%`, 
          backgroundColor: activeColor,
          left: '0'
        }}
      />
      
      {/* Range Input */}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={handleInput}
        className="
          absolute w-full h-1.5 bg-transparent appearance-none cursor-pointer z-10
          [&::-webkit-slider-thumb]:appearance-none 
          [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 
          [&::-webkit-slider-thumb]:rounded-full 
          [&::-webkit-slider-thumb]:bg-white 
          [&::-webkit-slider-thumb]:shadow-lg 
          [&::-webkit-slider-thumb]:border 
          [&::-webkit-slider-thumb]:border-slate-200/50
          [&::-webkit-slider-thumb]:active:scale-110
          [&::-webkit-slider-thumb]:transition-transform
        "
      />
    </div>
  );
};

export default Slider;
