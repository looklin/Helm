import { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, 
  AreaChart, Area, 
  PieChart, Pie, Cell,
  ResponsiveContainer, 
  Tooltip, XAxis, YAxis 
} from 'recharts';
import Slider from './ui/Slider';
import Stepper from './ui/Stepper';
import NumberKeyboard from './ui/NumberKeyboard';
import bgImage from '../assets/image/bg.jpg';
import { productionData, downtimeData, yieldData } from './mockData';

interface DashboardProps {
  plcConnected?: boolean;
  dbConnected?: boolean;
  plcMode?: string;
  plcState?: {
    isLightOn: boolean;
    isResetting: boolean;
    isInitializing: boolean;
    isFireEngaged: boolean;
    isRunIndicatorOn: boolean;
    isSuctionShieldOn: boolean;
    isRunning: boolean;
    deviceState: number;
  };
  onWriteTag?: (tagName: string, value: boolean | number) => Promise<void> | void;
}

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

const Dashboard = ({ 
  plcConnected = false, 
  dbConnected = false,
  plcMode = 'mock', 
  plcState, 
  onWriteTag 
}: DashboardProps) => {
  const windowSize = useWindowSize();
  const [isLightOn, setIsLightOn] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isFireEngaged, setIsFireEngaged] = useState(false);
  const [isRunIndicatorOn, setIsRunIndicatorOn] = useState(false);
  const [isSuctionShieldOn, setIsSuctionShieldOn] = useState(false);
  const [isCard1Expanded, setIsCard1Expanded] = useState(false);
  const [isCard2Expanded, setIsCard2Expanded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [deviceState, setDeviceState] = useState(1); // DM50210

  const [motorParams, setMotorParams] = useState<number[]>(Array(10).fill(0));
  const [timePresets, setTimePresets] = useState<number[]>(Array(10).fill(0));
  const [manualOps, setManualOps] = useState<boolean[]>(Array(18).fill(false));
  const [editingMotorIdx, setEditingMotorIdx] = useState<number | null>(null);
  const [editingTimeIdx, setEditingTimeIdx] = useState<number | null>(null);
  const [kbValue, setKbValue] = useState<string>('');

  const handleInputClick = (idx: number, val: number, isTime = false) => {
    if (isTime) {
      setEditingTimeIdx(idx);
      setEditingMotorIdx(null);
    } else {
      setEditingMotorIdx(idx);
      setEditingTimeIdx(null);
    }
    setKbValue(val.toString());
  };

  const onKeyboardInput = (key: string) => {
    let newValStr = kbValue;
    
    // Handle decimal point logic
    if (key === '.') {
      if (newValStr.includes('.')) return;
      if (newValStr === '' || newValStr === '-') newValStr += '0.';
      else newValStr += '.';
    } else if (key === '-') {
      // Handle minus sign logic
      if (newValStr.includes('-')) {
        newValStr = newValStr.replace('-', '');
      } else {
        newValStr = '-' + newValStr;
      }
    } else {
      // Handle digit input
      if (newValStr === '0') newValStr = key;
      else if (newValStr === '-0') newValStr = '-' + key;
      else newValStr += key;
    }
    
    setKbValue(newValStr);
    
    // Update value if it's a valid number
    const parsed = parseFloat(newValStr);
    if (!isNaN(parsed) && newValStr[newValStr.length - 1] !== '.') {
      if (editingMotorIdx !== null) {
        handleMotorChange(editingMotorIdx, Math.min(100, Math.max(-100, parsed)));
      } else if (editingTimeIdx !== null) {
        handleTimePresetChange(editingTimeIdx, Math.max(0, parsed)); // Time is usually positive
      }
    }
  };

  const onKeyboardDelete = () => {
    if (kbValue === '') return;
    
    let newValStr = kbValue.slice(0, -1);
    setKbValue(newValStr);
    
    if (newValStr === '' || newValStr === '-' || newValStr.endsWith('.')) {
      if (newValStr === '' || newValStr === '-') {
        if (editingMotorIdx !== null) handleMotorChange(editingMotorIdx, 0);
        else if (editingTimeIdx !== null) handleTimePresetChange(editingTimeIdx, 0);
      }
    } else {
      const parsed = parseFloat(newValStr);
      if (!isNaN(parsed)) {
        if (editingMotorIdx !== null) {
          handleMotorChange(editingMotorIdx, Math.min(100, Math.max(-100, parsed)));
        } else if (editingTimeIdx !== null) {
          handleTimePresetChange(editingTimeIdx, Math.max(0, parsed));
        }
      }
    }
  };

  const handleMotorChange = (idx: number, val: number) => {
    const newParams = [...motorParams];
    newParams[idx] = val;
    setMotorParams(newParams);
  };

  const handleTimePresetChange = (idx: number, val: number) => {
    const newPresets = [...timePresets];
    newPresets[idx] = val;
    setTimePresets(newPresets);
  };

  const [isAlarmCardExpanded, setIsAlarmCardExpanded] = useState(false);
  const [currentAlarmIndex, setCurrentAlarmIndex] = useState(0);
  const alarms = [
    { id: 1, time: '10:23:45', message: '吸气压力异常偏高，请检查过滤网及管道', level: 'error' },
    { id: 2, time: '10:20:12', message: '冷却水温度过高，超过预警阈值 85°C', level: 'warning' },
    { id: 3, time: '09:15:00', message: '设备通信中断，PLC未响应心跳包', level: 'error' },
  ];

  useEffect(() => {
    if (alarms.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentAlarmIndex((prev) => (prev + 1) % alarms.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [alarms.length]);

  useEffect(() => {
    if (isAlarmCardExpanded && scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [isAlarmCardExpanded]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const alarmCardRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);
  const card4Ref = useRef<HTMLDivElement>(null);
  const [isCard3Expanded, setIsCard3Expanded] = useState(false);
  const [isCard4Expanded, setIsCard4Expanded] = useState(false);

  useEffect(() => {
    if (!plcState) {
      return;
    }

    setIsLightOn(plcState.isLightOn);
    setIsResetting(plcState.isResetting);
    setIsInitializing(plcState.isInitializing);
    setIsFireEngaged(plcState.isFireEngaged);
    setIsRunIndicatorOn(plcState.isRunIndicatorOn);
    setIsSuctionShieldOn(plcState.isSuctionShieldOn);
    setIsRunning(plcState.isRunning);
    setDeviceState(plcState.deviceState);
  }, [plcState]);

  useEffect(() => {
    const targetRef = isAlarmCardExpanded ? alarmCardRef : isCard1Expanded ? card1Ref : isCard2Expanded ? card2Ref : isCard3Expanded ? card3Ref : isCard4Expanded ? card4Ref : null;
    
    if (targetRef?.current && scrollRef.current) {
      // 在 Safari 中，scrollIntoView 可能会受到 snap-type 的干扰
      // 我们改用手动计算 scrollLeft 来确保位置精确
      setTimeout(() => {
        const container = scrollRef.current;
        const element = targetRef.current;
        if (!container || !element) return;

        const containerWidth = container.offsetWidth;
        const elementWidth = element.offsetWidth;
        const elementLeft = element.offsetLeft;
        
        // 计算居中位置
        const targetScrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2);
        
        // 临时禁用 snap 以确保 scrollTo 精确
        const originalSnap = container.style.scrollSnapType;
        container.style.scrollSnapType = 'none';
        
        container.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth'
        });

        // 滚动完成后恢复 snap
        setTimeout(() => {
          if (container) container.style.scrollSnapType = originalSnap;
        }, 800);
      }, 600); 
    }
  }, [isAlarmCardExpanded, isCard1Expanded, isCard2Expanded, isCard3Expanded, isCard4Expanded]);


  const getDeviceStateConfig = (state: number) => {
    switch (state) {
      case 0: return { color: 'text-blue-500', bg: 'bg-blue-100', text: '设备未初始化', sub: 'Not Initialized' };
      case 1: return { color: 'text-emerald-500', bg: 'bg-emerald-100', text: '设备自动运转中', sub: 'Operating' };
      case 2: return { color: 'text-yellow-500', bg: 'bg-yellow-100', text: '设备停止中', sub: 'Stopped' };
      case 3: return { color: 'text-slate-500', bg: 'bg-slate-200', text: '设备初始化中', sub: 'Initializing' };
      case 4: return { color: 'text-red-500', bg: 'bg-red-100', text: '非常停止中', sub: 'Emergency Stop' };
      case 5: return { color: 'text-orange-500', bg: 'bg-orange-100', text: '异常停止中', sub: 'Error Stop' };
      default: return { color: 'text-slate-500', bg: 'bg-slate-100', text: '未知状态', sub: 'Unknown' };
    }
  };

  const deviceConfig = getDeviceStateConfig(deviceState);

  const writeBooleanTag = async (
    tagName: string,
    current: boolean,
    setter: (value: boolean) => void,
    nextValue?: boolean,
  ) => {
    const target = typeof nextValue === 'boolean' ? nextValue : !current;
    setter(target);

    try {
      await onWriteTag?.(tagName, target);
    } catch (error) {
      console.error(error);
      setter(current);
    }
  };

  const writeNumberTag = async (
    tagName: string,
    current: number,
    setter: (value: number) => void,
    nextValue: number,
  ) => {
    setter(nextValue);

    try {
      await onWriteTag?.(tagName, nextValue);
    } catch (error) {
      console.error(error);
      setter(current);
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-900 text-slate-800 overflow-hidden select-none">
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom);
        }
      `}} />
      {/* Debug Window */}
      <div className="fixed top-4 right-4 z-[9999] bg-black/80 backdrop-blur-md text-white px-3 py-2 rounded-xl border border-white/20 shadow-2xl pointer-events-none flex flex-col items-end space-y-0.5">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Viewport Width</span>
          <span className="text-sm font-mono font-bold text-emerald-400">{windowSize.width}px</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Viewport Height</span>
          <span className="text-sm font-mono font-bold text-blue-400">{windowSize.height}px</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">PLC</span>
          <span className={`text-xs font-bold ${plcConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            {plcMode.toUpperCase()} / {plcConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgImage})` }}
      >
        {/* Subtle overlay to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20"></div>
      </div>

      {/* Main Content Area */}
      <div className="absolute top-24 left-0 right-0 bottom-24 p-6 flex flex-col justify-between z-10">

        {/* Top Widgets */}
        <div className={`flex justify-between items-start w-full gap-4 mb-8 shrink-0 relative transition-[z-index] ${isCard1Expanded || isAlarmCardExpanded ? 'z-0' : 'z-10'}`}>

          {/* Card 1: 产量变化 */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 flex flex-col flex-1 h-[220px] shadow-sm border border-white/50 relative overflow-hidden">
            <div className="flex justify-between items-center mb-2 z-10">
              <span className="text-slate-500 font-medium text-sm">今日产量</span>
              <button className="bg-slate-100/80 text-slate-600 text-xs px-3 py-1.5 rounded-full font-medium hover:bg-slate-200 transition-colors">查看报表</button>
            </div>
            <div className="flex items-baseline space-x-2 mb-1 z-10">
              <span className="text-4xl font-bold text-slate-800">12,450</span>
              <span className="text-emerald-500 text-sm font-bold flex items-center"><i className="ri-arrow-up-line mr-0.5"></i> 5% <span className="text-slate-400 font-normal ml-1">较昨日</span></span>
            </div>
            <div className="flex-1 w-full z-10 -ml-4 -mr-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productionData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 2: 停机时长 */}
          <div className="bg-blue-600 rounded-3xl p-5 flex flex-col flex-1 h-[220px] shadow-md text-white relative overflow-hidden">
            <div className="flex justify-between items-center mb-2 z-10">
              <span className="text-blue-200 font-medium text-sm">停机时长 (小时)</span>
              <button className="bg-blue-500/80 text-white text-xs px-3 py-1.5 rounded-full font-medium hover:bg-blue-400 transition-colors">查看报表</button>
            </div>
            <div className="flex items-baseline space-x-2 mb-1 z-10">
              <span className="text-4xl font-bold">1.2</span>
              <span className="text-emerald-300 text-sm font-bold flex items-center"><i className="ri-arrow-down-line mr-0.5"></i> 15% <span className="text-blue-300 font-normal ml-1">较昨日</span></span>
            </div>
            <div className="flex-1 w-full z-10 -ml-4 -mr-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={downtimeData}>
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.1)'}}
                    contentStyle={{ backgroundColor: 'rgba(30, 64, 175, 0.9)', borderRadius: '12px', border: 'none', color: '#fff' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Bar 
                    dataKey="hours" 
                    fill="#fbbf24" 
                    radius={[6, 6, 0, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 3: 综合良率 */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 flex flex-col flex-1 h-[220px] shadow-sm border border-white/50 relative overflow-hidden">
            <div className="flex justify-between items-center mb-2 z-10">
              <span className="text-slate-500 font-medium text-sm">综合良品率</span>
              <button className="bg-slate-100/80 text-slate-600 text-xs px-3 py-1.5 rounded-full font-medium hover:bg-slate-200 transition-colors">查看报表</button>
            </div>
            <div className="flex items-baseline space-x-2 mb-1 z-10">
              <span className="text-4xl font-bold text-slate-800">98.5%</span>
              <span className="text-emerald-500 text-sm font-bold flex items-center"><i className="ri-arrow-up-line mr-0.5"></i> 2% <span className="text-slate-400 font-normal ml-1">较昨日</span></span>
            </div>
            <div className="flex-1 w-full z-10 flex items-center justify-center">
              <div className="relative w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={yieldData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                      startAngle={90}
                      endAngle={450}
                    >
                      {yieldData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-blue-600">98.5</span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Yield</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: 监控画面 */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl flex-1 h-[220px] shadow-sm border border-white/50 overflow-hidden relative group cursor-pointer">
            <img src="https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Factory" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent flex flex-col justify-end p-5">
              <span className="text-white font-bold text-lg tracking-wide shadow-sm">车间实况监控</span>
              <span className="text-white/90 text-sm flex items-center mt-1.5 font-medium"><i className="ri-live-fill text-red-500 mr-1.5 animate-pulse text-base"></i> 1 号生产线 - 运行中</span>
            </div>
          </div>

        </div>

        {/* Bottom Widgets Row */}
        <div
          ref={scrollRef}
          className="flex items-end overflow-x-auto custom-scrollbar gap-4 px-4 pt-16 pb-4 absolute bottom-8 left-6 right-6 z-50 snap-x snap-mandatory scroll-smooth"
        >

          {/* Card 0: 报警信息 (Alarm List) */}
          <div
            ref={alarmCardRef}
            className={`relative snap-center shrink-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-end ${isAlarmCardExpanded ? 'w-[85vw] md:w-[700px] lg:w-[800px] h-[65vh] max-h-[500px] md:h-[400px] opacity-100 mr-0 z-30' : 'w-0 h-[88px] opacity-0 -ml-4 pointer-events-none z-20'
              }`}
          >
            <div className="w-full h-full overflow-hidden rounded-3xl shadow-2xl border border-red-200 bg-white/95 backdrop-blur-2xl flex flex-col shrink-0 origin-left relative z-30">
              {/* Header */}
              <div className="flex justify-between items-center p-5 border-b border-red-100 bg-gradient-to-r from-red-50 to-white shrink-0">
                <div className="flex items-center text-red-600 font-bold text-xl">
                  <i className="ri-error-warning-fill mr-3 text-2xl"></i>
                  系统报警与异常信息
                  <span className="ml-3 bg-red-100 text-red-600 text-sm px-2.5 py-0.5 rounded-full">{alarms.length}</span>
                </div>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors relative z-40"
                  onClick={(e) => { e.stopPropagation(); setIsAlarmCardExpanded(false); }}
                >
                  <i className="ri-contract-up-down-line text-xl"></i>
                </button>
              </div>

              {/* List */}
              <div
                className="flex-1 overflow-y-auto p-3 md:p-4 custom-scrollbar space-y-3 pointer-events-auto"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {alarms.map((alarm) => (
                  <div key={alarm.id} className="flex items-center p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-red-200 hover:shadow-md transition-all cursor-pointer group">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 shrink-0 ${alarm.level === 'error' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                      <i className={`text-2xl ${alarm.level === 'error' ? 'ri-alarm-warning-fill' : 'ri-alert-fill'}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-800 font-bold text-base mb-1 truncate group-hover:text-red-600 transition-colors">{alarm.message}</div>
                      <div className="flex items-center text-slate-500 text-sm">
                        <i className="ri-time-line mr-1.5"></i>
                        {alarm.time}
                        <span className="mx-2 text-slate-300">|</span>
                        <span>设备 ID: EQ-{8000 + alarm.id}</span>
                      </div>
                    </div>
                    <div className="shrink-0 ml-4">
                      <div className={`px-3 py-1 rounded-lg text-sm font-bold border ${alarm.level === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-amber-50 border-amber-100 text-amber-600'
                        }`}>
                        {alarm.level === 'error' ? '严重报警' : '一般警告'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

            {/* Card 1: 运行控制 (Operation Control) */}
          <div
            ref={card1Ref}
            className={`relative z-20 snap-center shrink-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isCard1Expanded ? 'w-[85vw] md:w-[700px] lg:w-[800px] h-[65vh] max-h-[500px] md:h-[400px]' : 'w-full md:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.5rem)] h-[88px]'
              }`}
          >
            <div
              className={`bg-white/60 backdrop-blur-2xl rounded-3xl p-4 flex flex-col border border-white/50 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative z-20 overflow-hidden w-full h-full ${isCard1Expanded ? 'shadow-2xl bg-white/90' : 'hover:bg-white/70'
                }`}
            >
              {/* 第一排：常驻按钮 */}
              <div className="flex items-center justify-around w-full h-[56px] flex-shrink-0">
                {/* 照明 */}
                <div
                  className="flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-90"
                  onClick={() => void writeBooleanTag('device.light', isLightOn, setIsLightOn)}
                >
                  <div className={`${isLightOn ? 'text-blue-500' : 'text-slate-600'} relative mb-1 transition-colors`}>
                    <i className={`text-3xl ${isLightOn ? 'ri-lightbulb-flash-fill' : 'ri-lightbulb-line'}`}></i>
                  </div>
                  <span className="text-xs font-medium text-slate-700">照明</span>
                </div>

                {/* 复位 */}
                <div
                  className="flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-90"
                  onClick={() => void writeBooleanTag('device.resetting', isResetting, setIsResetting)}
                >
                  <div className={`${isResetting ? 'text-amber-500' : 'text-slate-600'} relative mb-1 transition-colors`}>
                    <i className={`text-3xl ${isResetting ? 'ri-restart-fill' : 'ri-restart-line'}`}></i>
                  </div>
                  <span className="text-xs font-medium text-slate-700">复位</span>
                </div>

                {/* 初始化 */}
                <div
                  className="flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-90"
                  onClick={() => void writeBooleanTag('device.initializing', isInitializing, setIsInitializing)}
                >
                  <div className={`${isInitializing ? 'text-emerald-500' : 'text-slate-600'} relative mb-1 transition-colors`}>
                    <i className={`text-3xl ${isInitializing ? 'ri-refresh-fill' : 'ri-refresh-line'}`}></i>
                  </div>
                  <span className="text-xs font-medium text-slate-700">初始化</span>
                </div>

                {/* 火烧投入 */}
                <div
                  className="flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-90"
                  onClick={() => void writeBooleanTag('device.fire', isFireEngaged, setIsFireEngaged)}
                >
                  <div className={`${isFireEngaged ? 'text-red-500' : 'text-slate-600'} relative mb-1 transition-colors`}>
                    <i className={`text-3xl ${isFireEngaged ? 'ri-fire-fill' : 'ri-fire-line'}`}></i>
                    <div className={`absolute -top-1 -right-2 text-[10px] font-bold ${isFireEngaged ? 'text-red-600' : 'text-slate-400'}`}>
                      <i className="ri-check-line"></i>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-700">火烧投入</span>
                </div>

                {/* 更多按钮 */}
                <div
                  className="flex items-center justify-center cursor-pointer h-full transition-transform active:scale-90 px-2"
                  onClick={() => setIsCard1Expanded(!isCard1Expanded)}
                >
                  <i className={`text-2xl text-slate-600 transition-transform duration-300 ${isCard1Expanded ? 'rotate-180 ri-arrow-up-s-line' : 'ri-more-fill'}`}></i>
                </div>
              </div>

              {/* 展开区域 (隐藏内容) */}
              <div
                className={`w-full transition-opacity duration-300 overflow-y-auto no-scrollbar flex-1 mt-4 ${isCard1Expanded ? 'opacity-100 pointer-events-auto delay-200' : 'opacity-0 pointer-events-none'
                  }`}
              >
                <div className="flex flex-col h-full w-full px-4 pb-4">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-lg mb-4">
                    <span>详细运行控制</span>
                    <i className="ri-arrow-right-s-line bg-slate-200/50 rounded-full text-sm p-0.5"></i>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 [&_button]:!h-20 md:[&_button]:!h-24 [&_button_i]:!text-2xl md:[&_button_i]:!text-3xl [&_button_span]:!text-xs md:[&_button_span]:!text-sm">
                    {/* 运行 */}
                    <button
                      className={`h-24 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-colors border shadow-sm ${isRunning ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'}`}
                      onClick={() => void writeBooleanTag('device.running', isRunning, setIsRunning, true)}
                    >
                      <i className="ri-play-circle-fill text-3xl"></i>
                      <span className="font-medium text-sm">运行</span>
                    </button>

                    {/* 停止 */}
                    <button
                      className={`h-24 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-colors border shadow-sm ${!isRunning ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'}`}
                      onClick={() => void writeBooleanTag('device.running', isRunning, setIsRunning, false)}
                    >
                      <i className="ri-stop-circle-fill text-3xl"></i>
                      <span className="font-medium text-sm">停止</span>
                    </button>

                    {/* 复位 */}
                    <button
                      className={`h-24 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-colors border shadow-sm ${isResetting ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'}`}
                      onClick={() => void writeBooleanTag('device.resetting', isResetting, setIsResetting)}
                    >
                      <i className="ri-restart-fill text-3xl"></i>
                      <span className="font-medium text-sm">复位</span>
                    </button>

                    {/* 初始化 */}
                    <button
                      className={`h-24 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-colors border shadow-sm ${isInitializing ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'}`}
                      onClick={() => void writeBooleanTag('device.initializing', isInitializing, setIsInitializing)}
                    >
                      <i className="ri-refresh-fill text-3xl"></i>
                      <span className="font-medium text-sm">初始化</span>
                    </button>

                    {/* 火烧投入 */}
                    <button
                      className={`h-24 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-colors border shadow-sm ${isFireEngaged ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'}`}
                      onClick={() => void writeBooleanTag('device.fire', isFireEngaged, setIsFireEngaged)}
                    >
                      <i className="ri-fire-fill text-3xl"></i>
                      <span className="font-medium text-sm">火烧投入</span>
                    </button>

                    {/* 照明灯 */}
                    <button
                      className={`h-24 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-colors border shadow-sm ${isLightOn ? 'bg-yellow-50 border-yellow-200 text-yellow-600' : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'}`}
                      onClick={() => void writeBooleanTag('device.light', isLightOn, setIsLightOn)}
                    >
                      <i className="ri-lightbulb-flash-fill text-3xl"></i>
                      <span className="font-medium text-sm">照明灯</span>
                    </button>

                    {/* 运行指示灯 */}
                    <button
                      className={`h-24 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-colors border shadow-sm ${isRunIndicatorOn ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'}`}
                      onClick={() => void writeBooleanTag('device.runIndicator', isRunIndicatorOn, setIsRunIndicatorOn)}
                    >
                      <i className="ri-alarm-warning-fill text-3xl"></i>
                      <span className="font-medium text-sm">运行指示灯</span>
                    </button>

                    {/* 吸气压力屏蔽 */}
                    <button
                      className={`h-24 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-colors border shadow-sm ${isSuctionShieldOn ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'}`}
                      onClick={() => void writeBooleanTag('device.suctionShield', isSuctionShieldOn, setIsSuctionShieldOn)}
                    >
                      <i className="ri-shield-flash-fill text-3xl"></i>
                      <span className="font-medium text-sm">吸气压力屏蔽</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Motor Parameters */}
          <div
            ref={card2Ref}
            className={`relative z-20 snap-center shrink-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isCard2Expanded ? 'w-[85vw] md:w-[700px] lg:w-[800px] h-[65vh] max-h-[500px] md:h-[400px]' : 'w-full md:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.5rem)] h-[88px]'
              }`}
          >
            <div
              className={`bg-white/60 backdrop-blur-2xl rounded-3xl p-4 flex flex-col border border-white/50 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative z-20 overflow-hidden w-full h-full ${isCard2Expanded ? 'shadow-2xl bg-white/90' : 'hover:bg-white/70'
                }`}
            >
              {/* 第一排：常驻顶部内容 */}
              <div className="flex items-center justify-between w-full h-[56px] flex-shrink-0 px-1">
                <div className="flex items-center flex-1 min-w-0">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm mr-4 flex-shrink-0 flex items-center justify-center bg-blue-100 text-blue-500">
                    <i className="ri-settings-4-fill text-3xl"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm lg:text-base text-slate-800 truncate">电机参数</div>
                    <div className="text-[10px] lg:text-[11px] text-slate-500 truncate">{isCard2Expanded ? '上下滑动调节' : '点击右侧按钮控制'}</div>
                  </div>
                </div>

                {/* 所有参数按钮 (展开/收起) */}
                <div
                  className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 cursor-pointer flex flex-col items-center justify-center text-slate-600 transition-colors ml-2 flex-shrink-0 relative active:scale-95 z-30 shadow-sm"
                  onClick={() => setIsCard2Expanded(!isCard2Expanded)}
                >
                  <i className={`transition-transform duration-300 ${isCard2Expanded ? 'ri-close-fill text-2xl' : 'ri-apps-2-fill text-xl'}`}></i>
                  {!isCard2Expanded && <span className="text-[10px] font-bold mt-0.5 tracking-wider">所有参数</span>}
                </div>
              </div>

              {/* 展开区域 (滑动条) */}
              <div
                className={`w-full transition-opacity duration-300 overflow-y-auto custom-scrollbar flex-1 mt-6 ${isCard2Expanded ? 'opacity-100 pointer-events-auto delay-200' : 'opacity-0 pointer-events-none'
                  }`}
              >
                <div className="flex flex-col h-full w-full px-2 pb-4">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-lg mb-4">
                    <span>独立调节 (-100 ~ 100)</span>
                    <i className="ri-arrow-right-s-line bg-slate-200/50 rounded-full text-sm p-0.5"></i>
                  </div>

                  <div className="flex flex-col space-y-3 w-full max-w-2xl mx-auto pb-4">
                    {motorParams.map((val, idx) => (
                      <div key={idx} className="flex items-center bg-white/50 hover:bg-white/80 transition-colors rounded-2xl p-3 md:p-4 shadow-sm border border-slate-200/60">
                        <div className="flex items-center justify-center w-10 md:w-12 shrink-0">
                          <span className="text-sm font-bold text-slate-700">M{idx + 1}</span>
                        </div>
                        
                        <div className="flex-1 mx-4 flex items-center min-w-0">
                          <Slider 
                            value={val} 
                            min={-100} 
                            max={100} 
                            onChange={(v) => handleMotorChange(idx, v)} 
                            activeColor={val > 0 ? '#10b981' : val < 0 ? '#f97316' : '#cbd5e1'}
                          />
                        </div>

                        <div className="shrink-0">
                          <Stepper 
                            value={val} 
                            min={-100} 
                            max={100} 
                            onChange={(v) => handleMotorChange(idx, v)}
                            onInputClick={() => handleInputClick(idx, val)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Card 3: Time Presets */}
          <div
            ref={card3Ref}
            className={`relative z-20 snap-center shrink-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isCard3Expanded ? 'w-[85vw] md:w-[700px] lg:w-[800px] h-[65vh] max-h-[500px] md:h-[400px]' : 'w-full md:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.5rem)] h-[88px]'
              }`}
          >
            <div
              className={`bg-white/60 backdrop-blur-2xl rounded-3xl p-4 flex flex-col border border-white/50 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative z-20 overflow-hidden w-full h-full ${isCard3Expanded ? 'shadow-2xl bg-white/90' : 'hover:bg-white/70'
                }`}
            >
              {/* 第一排：常驻顶部内容 */}
              <div className="flex items-center justify-between w-full h-[56px] flex-shrink-0 px-1">
                <div className="flex items-center flex-1 min-w-0">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm mr-4 flex-shrink-0 flex items-center justify-center bg-amber-100 text-amber-500">
                    <i className="ri-time-fill text-3xl"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm lg:text-base text-slate-800 truncate">预设值参数</div>
                    <div className="text-[10px] lg:text-[11px] text-slate-500 truncate">{isCard3Expanded ? '调节预设时间' : '点击右侧按钮控制'}</div>
                  </div>
                </div>

                {/* 展开/收起按钮 */}
                <div
                  className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 cursor-pointer flex flex-col items-center justify-center text-slate-600 transition-colors ml-2 flex-shrink-0 relative active:scale-95 z-30 shadow-sm"
                  onClick={() => setIsCard3Expanded(!isCard3Expanded)}
                >
                  <i className={`transition-transform duration-300 ${isCard3Expanded ? 'ri-close-fill text-2xl' : 'ri-timer-2-fill text-xl'}`}></i>
                  {!isCard3Expanded && <span className="text-[10px] font-bold mt-0.5 tracking-wider">时间预设</span>}
                </div>
              </div>

              {/* 展开区域 (参数列表) */}
              <div
                className={`w-full transition-opacity duration-300 overflow-y-auto custom-scrollbar flex-1 mt-6 ${isCard3Expanded ? 'opacity-100 pointer-events-auto delay-200' : 'opacity-0 pointer-events-none'
                  }`}
              >
                <div className="flex flex-col h-full w-full px-2 pb-4">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-lg mb-4">
                    <span>时间参数调节 (秒)</span>
                    <i className="ri-arrow-right-s-line bg-slate-200/50 rounded-full text-sm p-0.5"></i>
                  </div>

                  <div className="flex flex-col space-y-3 w-full max-w-2xl mx-auto pb-4">
                    {timePresets.map((val, idx) => (
                      <div key={idx} className="flex items-center bg-white/50 hover:bg-white/80 transition-colors rounded-2xl p-3 md:p-4 shadow-sm border border-slate-200/60">
                        <div className="flex items-center justify-center w-10 md:w-12 shrink-0">
                          <span className="text-sm font-bold text-slate-700">T{idx + 1}</span>
                        </div>
                        
                        <div className="flex-1 mx-4 flex items-center min-w-0">
                          <Slider 
                            value={val} 
                            min={0} 
                            max={3600} 
                            onChange={(v) => handleTimePresetChange(idx, v)} 
                            activeColor="#f59e0b"
                          />
                        </div>

                        <div className="shrink-0">
                          <Stepper 
                            value={val} 
                            min={0} 
                            max={3600} 
                            onChange={(v) => handleTimePresetChange(idx, v)}
                            onInputClick={() => handleInputClick(idx, val, true)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Manual Operations */}
          <div
            ref={card4Ref}
            className={`relative z-20 snap-center shrink-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isCard4Expanded ? 'w-[85vw] md:w-[700px] lg:w-[800px] h-[65vh] max-h-[500px] md:h-[400px]' : 'w-full md:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.5rem)] h-[88px]'
              }`}
          >
            <div
              className={`bg-white/60 backdrop-blur-2xl rounded-3xl p-4 flex flex-col border border-white/50 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative z-20 overflow-hidden w-full h-full ${isCard4Expanded ? 'shadow-2xl bg-white/90' : 'hover:bg-white/70'
                }`}
            >
              {/* 第一排：常驻顶部内容 */}
              <div className="flex items-center justify-between w-full h-[56px] flex-shrink-0 px-1">
                <div className="flex items-center flex-1 min-w-0">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm mr-4 flex-shrink-0 flex items-center justify-center bg-emerald-100 text-emerald-500">
                    <i className="ri-hand-coin-fill text-3xl"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm lg:text-base text-slate-800 truncate">手动操作</div>
                    <div className="text-[10px] lg:text-[11px] text-slate-500 truncate">{isCard4Expanded ? '点击按钮进行操作' : '点击右侧按钮控制'}</div>
                  </div>
                </div>

                {/* 展开/收起按钮 */}
                <div
                  className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 cursor-pointer flex flex-col items-center justify-center text-slate-600 transition-colors ml-2 flex-shrink-0 relative active:scale-95 z-30 shadow-sm"
                  onClick={() => setIsCard4Expanded(!isCard4Expanded)}
                >
                  <i className={`transition-transform duration-300 ${isCard4Expanded ? 'ri-close-fill text-2xl' : 'ri-list-settings-line text-xl'}`}></i>
                  {!isCard4Expanded && <span className="text-[10px] font-bold mt-0.5 tracking-wider">手动模式</span>}
                </div>
              </div>

              {/* 展开区域 (按钮网格) */}
              <div
                className={`w-full transition-opacity duration-300 overflow-y-auto custom-scrollbar flex-1 mt-6 ${isCard4Expanded ? 'opacity-100 pointer-events-auto delay-200' : 'opacity-0 pointer-events-none'
                  }`}
              >
                <div className="flex flex-col h-full w-full px-2 pb-4">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-lg mb-4">
                    <span>手动功能控制</span>
                    <i className="ri-arrow-right-s-line bg-slate-200/50 rounded-full text-sm p-0.5"></i>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pb-4">
                    {manualOps.map((isActive, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const newOps = [...manualOps];
                          newOps[idx] = !isActive;
                          setManualOps(newOps);
                        }}
                        className={`
                          h-20 rounded-2xl flex flex-col items-center justify-center space-y-1 transition-all border shadow-sm active:scale-95
                          ${isActive 
                            ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-200' 
                            : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white'
                          }
                        `}
                      >
                        <i className={`text-2xl ${isActive ? 'ri-checkbox-circle-fill' : 'ri-radio-button-line'}`}></i>
                        <span className="text-[10px] font-bold uppercase tracking-wider">操作 {idx + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Dock Navigation */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-white/20 backdrop-blur-3xl border-t border-white/20 flex items-center justify-between px-4 md:px-8 z-20 overflow-x-auto no-scrollbar">

        {/* Left: Home & Music */}
        <div className="flex items-center space-x-4 md:space-x-8 flex-shrink-0">
          <button
            className={`w-14 h-14 flex items-center justify-center rounded-2xl shadow-sm transition-all active:scale-95 ${isRunning ? 'bg-emerald-500 text-white' : 'bg-white text-slate-800'}`}
            onClick={() => void writeBooleanTag('device.running', isRunning, setIsRunning, true)}
          >
            <i className="ri-play-fill text-3xl"></i>
          </button>

          <div
            className="flex items-center space-x-4 cursor-pointer"
            onClick={() => void writeNumberTag('device.state', deviceState, setDeviceState, (deviceState + 1) % 6)}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-colors ${deviceConfig.bg} ${deviceConfig.color} flex-shrink-0`}>
              <i className="ri-store-2-line text-2xl"></i>
            </div>
            <div className="flex flex-col w-28 flex-shrink-0">
              <span className="font-bold text-sm text-slate-800 transition-colors truncate">{deviceConfig.text}</span>
              <span className="text-xs text-slate-500 transition-colors truncate">{deviceConfig.sub}</span>
            </div>
            <button
              className={`ml-4 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${!isRunning ? 'bg-red-500 text-white shadow-sm' : 'text-slate-800 hover:bg-white/10'}`}
              onClick={() => void writeBooleanTag('device.running', isRunning, setIsRunning, false)}
            >
              <i className="ri-pause-line text-xl"></i>
            </button>
          </div>
        </div>

        {/* Center: Alarm Carousel */}
        <div className="flex items-center flex-1 justify-center mx-4 overflow-hidden h-full">
          {alarms.length > 0 ? (
            <div
              className="flex items-center bg-red-50/90 backdrop-blur-md border border-red-200 text-red-600 px-6 py-2.5 rounded-2xl shadow-sm max-w-2xl w-full cursor-pointer hover:bg-red-100/90 transition-colors"
              onClick={() => setIsAlarmCardExpanded(true)}
            >
              <i className="ri-error-warning-fill text-2xl mr-4 shrink-0 animate-pulse"></i>
              <div className="flex-1 overflow-hidden relative h-7 flex items-center">
                {alarms.map((alarm, idx) => {
                  let translateY = 'translate-y-full opacity-0';
                  if (idx === currentAlarmIndex) translateY = 'translate-y-0 opacity-100';
                  else if (idx === (currentAlarmIndex - 1 + alarms.length) % alarms.length) translateY = '-translate-y-full opacity-0';

                  return (
                    <div
                      key={alarm.id}
                      className={`absolute inset-0 flex items-center transition-all duration-500 ease-in-out whitespace-nowrap ${translateY}`}
                    >
                      <span className="font-bold mr-3 text-sm bg-red-100 px-2 py-0.5 rounded-md">{alarm.time}</span>
                      <span className="font-medium truncate text-base">{alarm.message}</span>
                    </div>
                  );
                })}
              </div>
              <button className="ml-4 shrink-0 hover:bg-red-200/50 w-8 h-8 rounded-full transition-colors flex items-center justify-center">
                <i className="ri-expand-up-down-line text-xl font-bold"></i>
              </button>
            </div>
          ) : (
            <div className="flex items-center text-slate-700 font-bold text-lg">
              <i className="ri-check-double-line text-2xl mr-2 text-emerald-500"></i>
              <span>系统运行正常</span>
            </div>
          )}
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center space-x-6 md:space-x-10 text-slate-800 flex-shrink-0 pr-2">
          {/* PLC Status */}
          <div className="flex flex-col items-center hover:bg-white/10 p-2 rounded-full transition-all group cursor-pointer">
            <div className="relative">
              <i className="ri-cpu-line text-2xl font-bold text-slate-600 group-hover:text-slate-900 transition-colors"></i>
              <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${plcConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
            </div>
            <div className="flex flex-col items-center -mt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 group-hover:text-slate-900">{plcConnected ? 'PLC 在线' : 'PLC 离线'}</span>
              <span className="text-[8px] font-medium text-slate-400 -mt-0.5">{plcMode}</span>
            </div>
          </div>

          {/* Database Status */}
          <div className="flex flex-col items-center hover:bg-white/10 p-2 rounded-full transition-all group cursor-pointer">
            <div className="relative">
              <i className="ri-database-2-line text-2xl font-bold text-slate-600 group-hover:text-slate-900 transition-colors"></i>
              <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${dbConnected ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 group-hover:text-slate-900 -mt-1">数据库</span>
          </div>

          {/* Settings Button */}
          <button className="flex flex-col items-center hover:bg-white/10 p-2 rounded-full transition-all group">
            <i className="ri-settings-3-line text-2xl font-bold text-slate-600 group-hover:text-slate-900"></i>
            <span className="text-[10px] font-bold uppercase tracking-wider -mt-1">系统设置</span>
          </button>

          {/* Avatar / User */}
          <button className="flex items-center space-x-3 hover:bg-white/10 p-1.5 pr-4 rounded-full transition-all group border border-transparent hover:border-slate-200">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 flex items-center justify-center shadow-sm overflow-hidden border border-white">
               <i className="ri-user-3-fill text-2xl text-slate-400"></i>
            </div>
            <div className="hidden lg:flex flex-col items-start leading-tight">
              <span className="text-xs font-bold text-slate-800">管理员</span>
              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">Administrator</span>
            </div>
          </button>
        </div>

      </div>

      <NumberKeyboard
        visible={editingMotorIdx !== null || editingTimeIdx !== null}
        onClose={() => {
          setEditingMotorIdx(null);
          setEditingTimeIdx(null);
        }}
        onInput={onKeyboardInput}
        onDelete={onKeyboardDelete}
        title={editingMotorIdx !== null ? `调节 M${editingMotorIdx + 1} 参数` : `调节 T${(editingTimeIdx ?? 0) + 1} 时间`}
      />
    </div>
  );
};

export default Dashboard;
