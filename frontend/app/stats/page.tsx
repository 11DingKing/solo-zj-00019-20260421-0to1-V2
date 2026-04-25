'use client'

import { useState, useEffect, useCallback } from 'react'
import { CategoryStat, TrendStat } from '@/types'
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

const API_BASE = '/api'

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#0ea5e9', '#a855f7',
]

export default function StatsPage() {
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [trendStats, setTrendStats] = useState<TrendStat[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [categoryRes, trendRes] = await Promise.all([
        fetch(`${API_BASE}/stats/category?year=${year}&month=${month}`),
        fetch(`${API_BASE}/stats/trend`),
      ])
      
      if (!categoryRes.ok || !trendRes.ok) {
        throw new Error('Failed to fetch stats')
      }
      
      const categoryData = await categoryRes.json()
      const trendData = await trendRes.json()
      
      setCategoryStats(Array.isArray(categoryData) ? categoryData : [])
      setTrendStats(Array.isArray(trendData) ? trendData : [])
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      setError('加载统计数据失败')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleMonthChange = (delta: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + delta)
      return newDate
    })
  }

  const pieData = categoryStats.map((item, index) => ({
    name: item.category,
    value: item.amount,
    fill: COLORS[index % COLORS.length],
  }))

  const totalAmount = categoryStats.reduce((sum, item) => sum + item.amount, 0)

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    return `${parseInt(month)}月`
  }

  const lineChartData = trendStats.map(item => ({
    month: formatMonth(item.month),
    收入: item.income,
    支出: item.expense,
  }))

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const percentage = totalAmount > 0 ? ((data.value / totalAmount) * 100).toFixed(1) : 0
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-800">{data.name}</p>
          <p className="text-gray-600">{`金额: ¥${data.value.toFixed(2)}`}</p>
          <p className="text-gray-600">{`占比: ${percentage}%`}</p>
        </div>
      )
    }
    return null
  }

  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-800 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ¥${entry.value.toFixed(2)}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return percent > 0.05 ? (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-500">加载统计数据中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => handleMonthChange(-1)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            ← 上月
          </button>
          <h2 className="text-xl font-semibold text-gray-800">
            {year}年{month}月 统计
          </h2>
          <button
            onClick={() => handleMonthChange(1)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            下月 →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">本月支出分类占比</h3>
          {pieData.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-gray-500">暂无支出数据</p>
                <p className="text-sm text-gray-400 mt-1">添加支出记录后这里会显示饼图</p>
              </div>
            </div>
          ) : (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={120}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-gray-700 text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">近6个月收支趋势</h3>
          {lineChartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">📈</div>
                <p className="text-gray-500">暂无趋势数据</p>
                <p className="text-sm text-gray-400 mt-1">添加多月份记录后这里会显示折线图</p>
              </div>
            </div>
          ) : (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(value) => `¥${value}`}
                  />
                  <Tooltip content={<CustomLineTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="line"
                    formatter={(value) => <span className="text-gray-700">{value}</span>}
                  />
                  <Line
                    type="monotone"
                    dataKey="收入"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7, fill: '#10b981' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="支出"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7, fill: '#ef4444' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">本月支出明细</h3>
          {categoryStats.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">暂无支出数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">分类</th>
                    <th className="text-right py-3 px-4 text-gray-600 font-medium">金额</th>
                    <th className="text-right py-3 px-4 text-gray-600 font-medium">占比</th>
                    <th className="text-right py-3 px-4 text-gray-600 font-medium w-48">进度</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryStats
                    .sort((a, b) => b.amount - a.amount)
                    .map((stat, index) => {
                      const percentage = totalAmount > 0 ? (stat.amount / totalAmount) * 100 : 0
                      return (
                        <tr key={stat.category} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center">
                              <div
                                className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="font-medium text-gray-800">{stat.category}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="font-semibold text-gray-800">
                              ¥{stat.amount.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-gray-600">
                              {percentage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className="h-3 rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(percentage, 100)}%`,
                                  backgroundColor: COLORS[index % COLORS.length],
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  <tr className="bg-gray-50 font-medium">
                    <td className="py-4 px-4 font-semibold text-gray-800">合计</td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-lg font-bold text-red-600">
                        ¥{totalAmount.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-gray-800">
                      100%
                    </td>
                    <td className="py-4 px-4"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
