import React from 'react';

interface TimePicker24hProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  name: string;
}

const TimePicker24h: React.FC<TimePicker24hProps> = ({ value, onChange, name }) => {
  const [hourStr, minuteStr] = value.split(':');
  const hour = parseInt(hourStr, 10) || 0;
  const minute = parseInt(minuteStr, 10) || 0;

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHour = e.target.value;
    const newTime = `${newHour}:${minute.toString().padStart(2, '0')}`;
    const syntheticEvent = {
      target: {
        name,
        value: newTime,
      }
    } as unknown as React.ChangeEvent<HTMLSelectElement>;
    onChange(syntheticEvent);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMinute = e.target.value;
    const newTime = `${hour.toString().padStart(2, '0')}:${newMinute}`;
    const syntheticEvent = {
      target: {
        name,
        value: newTime,
      }
    } as unknown as React.ChangeEvent<HTMLSelectElement>;
    onChange(syntheticEvent);
  };

  return (
    <div className="flex gap-1 items-center bg-slate-50 border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 transition-all">
      <select
        dir="ltr"
        value={hour.toString().padStart(2, '0')}
        onChange={handleHourChange}
        className="w-full appearance-none text-center bg-transparent p-2 outline-none"
      >
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="font-semibold text-slate-400">:</span>
      <select
        dir="ltr"
        value={minute.toString().padStart(2, '0')}
        onChange={handleMinuteChange}
        className="w-full appearance-none text-center bg-transparent p-2 outline-none"
      >
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
};

export default TimePicker24h;
