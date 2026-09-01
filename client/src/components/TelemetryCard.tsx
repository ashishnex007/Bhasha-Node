import { Cpu, MemoryStick, HardDrive, WifiOff } from 'lucide-react';
import type { SystemStats } from '../services/api';

interface TelemetryCardProps {
  darkMode: boolean;
  stats: SystemStats;
  isLive: boolean;
}

function Metric({ label, icon, value, total, unit, percent, darkMode }: {
  label: string; icon: React.ReactNode; value: number; total: number;
  unit: string; percent: number; darkMode: boolean;
}) {
  const barColor = percent > 85 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : 'bg-indigo-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className={`text-[11px] font-medium flex items-center gap-1.5 ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
          {icon} {label}
        </span>
        <span className={`text-[10px] font-mono ${darkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {value}{unit} / {total}{unit}
        </span>
      </div>
      <div className={`w-full rounded-full h-1 ${darkMode ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`}>
        <div className={`h-1 rounded-full transition-all duration-1000 ease-out ${barColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

export default function TelemetryCard({ darkMode, stats, isLive }: TelemetryCardProps) {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <h3 className={`text-[10px] font-semibold uppercase tracking-widest ${
          darkMode ? 'text-zinc-600' : 'text-zinc-400'
        }`}>System</h3>
        {isLive ? (
          <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            LIVE
          </span>
        ) : (
          <span className={`flex items-center gap-1 text-[9px] font-semibold ${
            darkMode ? 'text-zinc-600' : 'text-zinc-400'
          }`}>
            <WifiOff size={11} /> OFFLINE
          </span>
        )}
      </div>
      <Metric label="CPU" icon={<Cpu size={14} />} value={stats.cpu_percent} total={100} unit="%" percent={stats.cpu_percent} darkMode={darkMode} />
      <Metric label="Memory" icon={<MemoryStick size={14} />} value={stats.ram_used_gb} total={stats.ram_total_gb} unit=" GB" percent={stats.ram_percent} darkMode={darkMode} />
      <Metric label="Disk" icon={<HardDrive size={14} />} value={stats.disk_used_gb} total={stats.disk_total_gb} unit=" GB" percent={stats.disk_percent} darkMode={darkMode} />
    </div>
  );
}

