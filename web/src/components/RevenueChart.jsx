// Charting lives in its own lazily-loaded chunk. recharts is ~374 KB, and a
// static import made the whole Dashboard wait on that download before painting
// — even for a new shop with no sales to plot.
import React from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// Longer ranges come back bucketed by week/month, so a "MM-DD" tick would be
// misleading — label those by month instead.
const tick = (d, bucket) => {
  if (bucket === 'month') {
    return new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  }
  return d.slice(5);
};

export default function RevenueChart({ series, bucket = 'day' }) {
  return (
    <ResponsiveContainer>
      <AreaChart data={series} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c831f" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#0c831f" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,31,31,0.07)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => tick(d, bucket)} fontSize={11} stroke="#999999" tickLine={false} axisLine={false} />
        <YAxis fontSize={11} stroke="#999999" tickLine={false} axisLine={false} width={44} />
        <Tooltip
          labelFormatter={(d) => tick(d, bucket)}
          formatter={(v) => [inr(v), 'Revenue']}
          contentStyle={{ border: '1px solid #e8e8e8', borderRadius: 10, fontSize: 13 }}
        />
        <Area type="monotone" dataKey="revenue" stroke="#0c831f" strokeWidth={2.5} fill="url(#revGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
