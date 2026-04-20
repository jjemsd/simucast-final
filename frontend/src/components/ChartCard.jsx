// ============================================================================
// ChartCard.jsx
// ============================================================================
// A reusable wrapper around Chart.js (via react-chartjs-2).
//
// Why wrap it?
//   - Consistent card styling (white bg, border, title)
//   - Chart.js needs some global setup (registering plugins) — we do it once here
//   - If we ever swap chart libraries, we only change this file
//
// Props:
//   title — heading above the chart
//   type  — 'bar' | 'line' | 'pie' | 'scatter' | 'doughnut'
//   data  — Chart.js data object: { labels, datasets: [{ data, ... }] }
//   options — Chart.js options (optional)
//
// Example usage:
//   <ChartCard
//     title="Age distribution"
//     type="bar"
//     data={{ labels: ['0-10', '10-20'], datasets: [{ data: [5, 12] }] }}
//   />
// ============================================================================

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line, Pie, Scatter, Doughnut } from 'react-chartjs-2'

// Chart.js requires us to "register" every feature we use.
// We do this once, when this file is first imported.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
)


// Map type name → component
const CHART_COMPONENTS = {
  bar: Bar,
  line: Line,
  pie: Pie,
  scatter: Scatter,
  doughnut: Doughnut,
}


export default function ChartCard({ title, type, data, options = {} }) {
  const ChartComponent = CHART_COMPONENTS[type]

  if (!ChartComponent) {
    return <div className="text-xs text-red-600">Unknown chart type: {type}</div>
  }

  // --- Default options applied to all charts ---
  // Merge with any caller-provided options (caller's options win on conflicts)
  const mergedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    ...options,
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-3.5">
      {title && <div className="text-xs font-medium mb-2.5">{title}</div>}
      <div style={{ height: 220 }}>
        <ChartComponent data={data} options={mergedOptions} />
      </div>
    </div>
  )
}
