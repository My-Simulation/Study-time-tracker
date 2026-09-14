/**
 * LapTable.jsx
 * Renders the lap table with fastest/slowest color-coding.
 * Newest lap appears at top with slide-in animation.
 */

import React from 'react'

function LapRow({ lapNo, split, total, color, isNew }) {
  const textColor =
    color === 'green'
      ? 'text-green-400'
      : color === 'red'
      ? 'text-red-400'
      : 'text-white'

  return (
    <tr
      className={`border-b border-[#2a2a2a] ${textColor}`}
      style={isNew ? { animation: 'slideDown 150ms ease-out' } : {}}
    >
      <td className="py-2.5 pl-4 font-mono text-sm tabular-nums w-1/4">
        {lapNo}
      </td>
      <td className="py-2.5 font-mono text-sm tabular-nums text-center w-[38%]">
        {split}
      </td>
      <td className="py-2.5 pr-4 font-mono text-sm tabular-nums text-right w-[38%]">
        {total}
      </td>
    </tr>
  )
}

export default function LapTable({ laps }) {
  if (laps.length === 0) return null

  return (
    <div className="w-full overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#2a2a2a]">
            <th className="py-2 pl-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
              Lap No.
            </th>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[38%]">
              Split
            </th>
            <th className="py-2 pr-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[38%]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap, index) => (
            <LapRow
              key={lap.lapNo}
              lapNo={lap.lapNo}
              split={lap.split}
              total={lap.total}
              color={lap.color}
              isNew={index === 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * ReadOnlyLapTable — same visual but no animation, used in HistoryDetail.
 */
export function ReadOnlyLapTable({ laps }) {
  if (!laps || laps.length === 0) {
    return (
      <p className="text-gray-600 text-sm text-center py-4">No laps recorded.</p>
    )
  }

  // Compute min/max once outside the map — handles missing splitMs safely
  const splitValues = laps.map((l) => l.splitMs ?? 0)
  const minSplit = Math.min(...splitValues)
  const maxSplit = Math.max(...splitValues)
  const hasContrast = laps.length >= 2 && minSplit !== maxSplit

  return (
    <div className="w-full overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#2a2a2a]">
            <th className="py-2 pl-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
              Lap No.
            </th>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[38%]">
              Split
            </th>
            <th className="py-2 pr-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[38%]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap) => {
            const ms = lap.splitMs ?? 0
            const color = !hasContrast
              ? 'normal'
              : ms === minSplit
              ? 'green'
              : ms === maxSplit
              ? 'red'
              : 'normal'

            const textColor =
              color === 'green'
                ? 'text-green-400'
                : color === 'red'
                ? 'text-red-400'
                : 'text-white'

            return (
              <tr
                key={lap.lapNo}
                className={`border-b border-[#2a2a2a] ${textColor}`}
              >
                <td className="py-2.5 pl-4 font-mono text-sm tabular-nums w-1/4">
                  {lap.lapNo}
                </td>
                <td className="py-2.5 font-mono text-sm tabular-nums text-center w-[38%]">
                  {lap.split}
                </td>
                <td className="py-2.5 pr-4 font-mono text-sm tabular-nums text-right w-[38%]">
                  {lap.total}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
