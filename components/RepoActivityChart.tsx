/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { RepoActivityStats, RepoCommitActivity } from '../types';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap, 
  Calendar, 
  Users, 
  GitCommit, 
  Flame, 
  BarChart3, 
  LineChart, 
  PieChart,
  Info,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface RepoActivityChartProps {
  stats: RepoActivityStats;
  repoName: string;
}

type ViewType = 'trend' | 'bars' | 'rhythm';

export const RepoActivityChart: React.FC<RepoActivityChartProps> = ({ stats, repoName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewType, setViewType] = useState<ViewType>('trend');
  const [hoveredDay, setHoveredDay] = useState<RepoCommitActivity | null>(null);
  const [selectedDay, setSelectedDay] = useState<RepoCommitActivity | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [highlightSpikesOnly, setHighlightSpikesOnly] = useState(false);

  // Set default selected day to peak day if available
  useEffect(() => {
    if (stats.spikesList.length > 0) {
      setSelectedDay(stats.spikesList[0]);
    } else if (stats.peakDay) {
      const peak = stats.timeline.find(t => t.date === stats.peakDay?.date);
      if (peak) setSelectedDay(peak);
    }
  }, [stats]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = 320;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const margin = { top: 25, right: 35, bottom: 40, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Setup Defs for Gradients & Glow Filters
    const defs = svg.append('defs');

    // Area Gradient for Trend
    const areaGradient = defs.append('linearGradient')
      .attr('id', 'repo-area-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#8b5cf6').attr('stop-opacity', 0.45);
    areaGradient.append('stop').attr('offset', '70%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.12);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.0);

    // Spike Bar Gradient
    const spikeGradient = defs.append('linearGradient')
      .attr('id', 'spike-bar-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    spikeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b');
    spikeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#d97706');

    // Normal Bar Gradient
    const normalBarGradient = defs.append('linearGradient')
      .attr('id', 'normal-bar-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    normalBarGradient.append('stop').attr('offset', '0%').attr('stop-color', '#8b5cf6');
    normalBarGradient.append('stop').attr('offset', '100%').attr('stop-color', '#4f46e5');

    // Filter for neon glow effect
    const glowFilter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-20%').attr('y', '-20%')
      .attr('width', '140%').attr('height', '140%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3.5').attr('result', 'coloredBlur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    if (viewType === 'rhythm') {
      // -------------------------------------------------------------
      // VIEW: Day-of-Week Rhythm Breakdown
      // -------------------------------------------------------------
      const dayData = stats.dayOfWeekDistribution;
      const maxCount = d3.max(dayData, d => d.count) || 1;

      const yScale = d3.scaleBand()
        .domain(dayData.map(d => d.day))
        .range([0, innerHeight])
        .padding(0.28);

      const xScale = d3.scaleLinear()
        .domain([0, maxCount * 1.15])
        .range([0, innerWidth]);

      // Subtle horizontal grid lines
      g.append('g')
        .attr('class', 'grid')
        .call(
          d3.axisBottom(xScale)
            .ticks(5)
            .tickSize(innerHeight)
            .tickFormat(() => '')
        )
        .call(g => g.select('.domain').remove())
        .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.05)'));

      // Y Axis labels
      g.append('g')
        .call(d3.axisLeft(yScale).tickSize(0))
        .call(g => g.select('.domain').remove())
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '11px')
        .attr('font-family', 'monospace')
        .attr('dx', '-8px');

      // Bars
      const barGroups = g.selectAll('.rhythm-bar')
        .data(dayData)
        .enter()
        .append('g')
        .attr('class', 'rhythm-bar cursor-pointer')
        .attr('transform', d => `translate(0, ${yScale(d.day)})`);

      // Bar Background track
      barGroups.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', innerWidth)
        .attr('height', yScale.bandwidth())
        .attr('rx', 4)
        .attr('fill', 'rgba(255,255,255,0.03)');

      // Filled bar with animated transition
      barGroups.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', yScale.bandwidth())
        .attr('rx', 4)
        .attr('fill', (d, i) => i === 0 || i === 6 ? '#64748b' : '#8b5cf6')
        .transition()
        .duration(700)
        .attr('width', d => Math.max(4, xScale(d.count)));

      // Value and percentage label
      barGroups.append('text')
        .attr('x', d => Math.max(4, xScale(d.count)) + 8)
        .attr('y', yScale.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '10.5px')
        .attr('font-family', 'monospace')
        .text(d => `${d.count} commits (${d.percentage}%)`);

      return;
    }

    // -----------------------------------------------------------------
    // VIEWS: 'trend' (Area & Line) and 'bars' (Daily Histogram with Spikes)
    // -----------------------------------------------------------------
    const timeline = stats.timeline;
    if (timeline.length === 0) return;

    // X Scale: index-based or time-based
    const parseTime = d3.timeParse('%Y-%m-%d');
    const dates = timeline.map(d => parseTime(d.date) || new Date(d.date));

    const xScale = d3.scaleTime()
      .domain(d3.extent(dates) as [Date, Date])
      .range([0, innerWidth]);

    const maxCount = d3.max(timeline, d => Math.max(d.count, d.movingAverage || 0)) || 5;
    const yScale = d3.scaleLinear()
      .domain([0, Math.ceil(maxCount * 1.25)])
      .nice()
      .range([innerHeight, 0]);

    // Grid Lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3.axisLeft(yScale)
          .ticks(4)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.06)').attr('stroke-dasharray', '2,3'));

    // X Axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(6, Math.floor(innerWidth / 90)))
      .tickFormat(d => d3.timeFormat('%b %d')(d as Date))
      .tickSizeOuter(0);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.1)'))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('dy', '10px');

    // Y Axis
    const yAxis = d3.axisLeft(yScale)
      .ticks(4)
      .tickSizeOuter(0);

    g.append('g')
      .call(yAxis)
      .call(g => g.select('.domain').remove())
      .selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Average Baseline Reference Line
    const avgY = yScale(stats.averagePerDay);
    if (avgY >= 0 && avgY <= innerHeight) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', avgY)
        .attr('y2', avgY)
        .attr('stroke', 'rgba(148, 163, 184, 0.35)')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1);

      g.append('text')
        .attr('x', innerWidth - 4)
        .attr('y', avgY - 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#94a3b8')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text(`avg: ${stats.averagePerDay}/day`);
    }

    if (viewType === 'trend') {
      // 1. Area Generator
      const area = d3.area<RepoCommitActivity>()
        .curve(d3.curveMonotoneX)
        .x((d, i) => xScale(dates[i]))
        .y0(innerHeight)
        .y1(d => yScale(d.count));

      // Append Gradient Area Fill
      g.append('path')
        .datum(timeline)
        .attr('fill', 'url(#repo-area-gradient)')
        .attr('d', area);

      // 2. Primary Activity Line
      const primaryLine = d3.line<RepoCommitActivity>()
        .curve(d3.curveMonotoneX)
        .x((d, i) => xScale(dates[i]))
        .y(d => yScale(d.count));

      g.append('path')
        .datum(timeline)
        .attr('fill', 'none')
        .attr('stroke', '#a78bfa')
        .attr('stroke-width', 2.2)
        .attr('d', primaryLine);

      // 3. Smooth Moving Average Trend Line (Dashed cyan)
      const maLine = d3.line<RepoCommitActivity>()
        .curve(d3.curveBasis)
        .defined(d => typeof d.movingAverage === 'number')
        .x((d, i) => xScale(dates[i]))
        .y(d => yScale(d.movingAverage || 0));

      g.append('path')
        .datum(timeline)
        .attr('fill', 'none')
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 1.8)
        .attr('stroke-dasharray', '5,3')
        .attr('opacity', 0.85)
        .attr('d', maLine);

      // 4. Spike Indicators (Vertical dashed line & pulse circle on spike dates)
      timeline.forEach((item, i) => {
        if (!item.isSpike) return;

        const cx = xScale(dates[i]);
        const cy = yScale(item.count);

        // Spike vertical guideline
        g.append('line')
          .attr('x1', cx)
          .attr('x2', cx)
          .attr('y1', cy)
          .attr('y2', innerHeight)
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,3')
          .attr('opacity', 0.5);

        // Outer glow halo
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 8)
          .attr('fill', '#f59e0b')
          .attr('opacity', 0.25)
          .attr('filter', 'url(#glow)');

        // Inner glowing spike pin
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 4.5)
          .attr('fill', '#fbbf24')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .attr('class', 'cursor-pointer transition-transform hover:scale-125')
          .on('click', () => setSelectedDay(item));
      });
    }

    if (viewType === 'bars') {
      // -------------------------------------------------------------
      // VIEW: Bar Chart with highlighted spikes
      // -------------------------------------------------------------
      const barWidth = Math.max(3, Math.min(14, (innerWidth / timeline.length) * 0.72));

      g.selectAll('.activity-bar')
        .data(timeline)
        .enter()
        .append('rect')
        .attr('class', 'activity-bar cursor-pointer transition-all')
        .attr('x', (d, i) => xScale(dates[i]) - barWidth / 2)
        .attr('y', d => yScale(d.count))
        .attr('width', barWidth)
        .attr('height', d => Math.max(2, innerHeight - yScale(d.count)))
        .attr('rx', 2.5)
        .attr('fill', d => {
          if (highlightSpikesOnly && !d.isSpike) return 'rgba(255,255,255,0.06)';
          return d.isSpike ? 'url(#spike-bar-gradient)' : 'url(#normal-bar-gradient)';
        })
        .attr('opacity', d => (highlightSpikesOnly && !d.isSpike ? 0.3 : 0.9))
        .on('click', (event, d) => setSelectedDay(d));
    }

    // -----------------------------------------------------------------
    // Interactive Overlay Crosshair & Hover Tooltip
    // -----------------------------------------------------------------
    const focusLine = g.append('line')
      .attr('stroke', 'rgba(255, 255, 255, 0.4)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('opacity', 0);

    const focusCircle = g.append('circle')
      .attr('r', 5)
      .attr('fill', '#a78bfa')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .style('opacity', 0);

    // Bisector for finding nearest date
    const bisectDate = d3.bisector<Date, Date>(d => d).center;

    svg
      .append('rect')
      .attr('class', 'overlay')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event, this);
        const x0 = xScale.invert(mx);
        const index = bisectDate(dates, x0, 0, dates.length - 1);
        const d = timeline[index];

        if (d) {
          const cx = xScale(dates[index]);
          const cy = yScale(d.count);

          focusLine
            .attr('x1', cx)
            .attr('x2', cx)
            .style('opacity', 1);

          focusCircle
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('fill', d.isSpike ? '#f59e0b' : '#a78bfa')
            .style('opacity', 1);

          setHoveredDay(d);
          const rect = container.getBoundingClientRect();
          setTooltipPos({
            x: Math.min(rect.width - 240, Math.max(10, cx + margin.left - 100)),
            y: Math.max(10, cy + margin.top - 70)
          });
        }
      })
      .on('mouseleave', function () {
        focusLine.style('opacity', 0);
        focusCircle.style('opacity', 0);
        setHoveredDay(null);
        setTooltipPos(null);
      })
      .on('click', function (event) {
        const [mx] = d3.pointer(event, this);
        const x0 = xScale.invert(mx);
        const index = bisectDate(dates, x0, 0, dates.length - 1);
        if (timeline[index]) {
          setSelectedDay(timeline[index]);
        }
      });

  }, [stats, viewType, highlightSpikesOnly]);

  // Velocity badge style helper
  const getVelocityBadge = () => {
    switch (stats.velocityTrend) {
      case 'increasing':
        return {
          label: 'Accelerating',
          icon: TrendingUp,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
        };
      case 'decreasing':
        return {
          label: 'Cooling Off',
          icon: TrendingDown,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
        };
      default:
        return {
          label: 'Steady Velocity',
          icon: Minus,
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/30'
        };
    }
  };

  const velocity = getVelocityBadge();
  const VelocityIcon = velocity.icon;

  return (
    <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-500/20 text-violet-300 rounded-lg border border-violet-500/30">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              Repo_History & Activity Spikes
              {stats.source === 'live_github' ? (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1 normal-case">
                  <CheckCircle2 className="w-3 h-3" /> Live GitHub Stream
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10 normal-case">
                  Cached/Correlated Architecture Velocity
                </span>
              )}
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Interactive D3 visualization tracking commit surges, release cycles, and development rhythm for{' '}
            <span className="text-violet-300 font-mono font-medium">{repoName}</span>.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setViewType('trend')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              viewType === 'trend'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Velocity & Spikes</span>
          </button>
          <button
            onClick={() => setViewType('bars')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              viewType === 'bars'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Daily Columns</span>
          </button>
          <button
            onClick={() => setViewType('rhythm')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              viewType === 'rhythm'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Weekly Rhythm</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Commits */}
        <div className="p-3 bg-slate-950/50 rounded-2xl border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="flex items-center gap-1">
              <GitCommit className="w-3.5 h-3.5 text-violet-400" /> Commits
            </span>
            <span className="text-[10px] text-slate-500">Sampled</span>
          </div>
          <div className="text-xl font-bold text-white font-mono">{stats.totalCommits}</div>
          <div className="text-[10px] text-slate-400 truncate">
            {stats.dateRange ? `${stats.dateRange.start} – ${stats.dateRange.end}` : 'Recent span'}
          </div>
        </div>

        {/* Activity Spikes */}
        <div className="p-3 bg-slate-950/50 rounded-2xl border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" /> Activity Spikes
            </span>
            <span className="text-[10px] text-amber-400 font-bold">Peak Surges</span>
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono flex items-center gap-1.5">
            {stats.spikesCount}
            <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-[10px] text-slate-400">
            {stats.spikesCount > 0 ? `Detected high-intensity days` : 'Evenly paced cadence'}
          </div>
        </div>

        {/* Daily Velocity */}
        <div className="p-3 bg-slate-950/50 rounded-2xl border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" /> Daily Cadence
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${velocity.color}`}>
              {velocity.label}
            </span>
          </div>
          <div className="text-xl font-bold text-white font-mono flex items-center gap-1">
            {stats.averagePerDay} <span className="text-xs text-slate-400 font-normal">/ day</span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <VelocityIcon className="w-3 h-3" /> Velocity: {stats.velocityTrend}
          </div>
        </div>

        {/* Peak Surge Day */}
        <div className="p-3 bg-slate-950/50 rounded-2xl border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-emerald-400" /> Peak Day
            </span>
            <span className="text-[10px] text-slate-500">{stats.activeContributors} Authors</span>
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {stats.peakDay ? `${stats.peakDay.count} commits` : '—'}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {stats.peakDay ? stats.peakDay.formattedDate : 'No activity recorded'}
          </div>
        </div>
      </div>

      {/* D3 Canvas Container */}
      <div className="relative" ref={containerRef}>
        {/* Subheader controls (Legend & Filter) */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2 px-1">
          <div className="flex items-center gap-4 flex-wrap">
            {viewType === 'trend' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-violet-400 rounded-full inline-block" />
                  <span className="text-[11px] text-slate-300">Daily Commits</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-sky-400 inline-block" />
                  <span className="text-[11px] text-slate-300">5-Day Moving Trend</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block ring-2 ring-amber-400/30" />
                  <span className="text-[11px] text-amber-300 font-bold">Activity Spike</span>
                </div>
              </>
            )}

            {viewType === 'bars' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHighlightSpikesOnly(!highlightSpikesOnly)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                    highlightSpikesOnly
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-white/5 text-slate-400 hover:text-white border-white/10'
                  }`}
                >
                  {highlightSpikesOnly ? '✓ Focusing on Spikes' : 'Highlight Spikes Only'}
                </button>
              </div>
            )}

            {viewType === 'rhythm' && (
              <span className="text-[11px] text-slate-400">
                Weekly commit distribution showing weekday vs weekend productivity rhythms
              </span>
            )}
          </div>

          <div className="text-[10px] text-slate-500 hidden sm:block">
            {viewType !== 'rhythm' ? 'Hover crosshair for details • Click point to inspect commits' : ''}
          </div>
        </div>

        {/* SVG Visualization */}
        <div className="w-full bg-slate-950/60 rounded-2xl border border-white/5 overflow-hidden">
          <svg ref={svgRef} className="w-full overflow-visible" />
        </div>

        {/* Hover Tooltip Overlay */}
        {hoveredDay && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none p-3 bg-slate-900/95 border border-violet-500/40 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono space-y-1.5 transition-transform duration-75"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              width: '230px'
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className="font-bold text-white">{hoveredDay.formattedDate}</span>
              {hoveredDay.isSpike && (
                <span className="text-[9.5px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" /> SPIKE
                </span>
              )}
            </div>

            <div className="flex items-baseline justify-between pt-0.5">
              <span className="text-slate-400">Commit Count:</span>
              <span className="font-bold text-violet-300 text-sm">{hoveredDay.count}</span>
            </div>

            {typeof hoveredDay.movingAverage === 'number' && (
              <div className="flex items-baseline justify-between text-[10px] text-slate-400">
                <span>5-Day Avg:</span>
                <span className="text-sky-300">{hoveredDay.movingAverage}</span>
              </div>
            )}

            {hoveredDay.authors.length > 0 && (
              <div className="text-[10.5px] text-slate-400 pt-0.5">
                <span className="text-slate-500">Active: </span>
                <span className="text-slate-200">{hoveredDay.authors.slice(0, 2).join(', ')}</span>
              </div>
            )}

            {hoveredDay.sampleMessages.length > 0 && (
              <div className="border-t border-white/5 pt-1 text-[10px] text-slate-400 italic line-clamp-1">
                "{hoveredDay.sampleMessages[0]}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Day / Spike Deep-Dive Card */}
      {selectedDay && (
        <div className="p-4 bg-slate-950/70 border border-white/10 rounded-2xl space-y-3 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-lg border ${
                  selectedDay.isSpike
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                }`}
              >
                {selectedDay.isSpike ? <Flame className="w-4 h-4" /> : <GitCommit className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white font-mono">
                    {selectedDay.formattedDate}
                  </h4>
                  {selectedDay.isSpike && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      HIGH INTENSITY SPIKE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  {selectedDay.count} commits recorded on this date
                  {stats.averagePerDay > 0
                    ? ` • ${(selectedDay.count / stats.averagePerDay).toFixed(1)}x repo average`
                    : ''}
                </p>
              </div>
            </div>

            {selectedDay.authors.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Contributors:</span>
                <span className="text-slate-200 font-bold">{selectedDay.authors.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Sample Commit Messages for this day */}
          {selectedDay.sampleMessages.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-violet-400" /> Key Commits During This Period:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {selectedDay.sampleMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-slate-900/60 rounded-xl border border-white/5 font-mono text-xs text-slate-300 flex items-start gap-2"
                  >
                    <GitCommit className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <span className="truncate">{msg}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 font-mono">
              Quiet day with regular maintenance or distributed pull-request merges.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default RepoActivityChart;
