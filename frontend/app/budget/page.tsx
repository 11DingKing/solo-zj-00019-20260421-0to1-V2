'use client'

import { useState, useEffect, useCallback } from 'react'
import { Category, BudgetResponse, CategoryBudget } from '@/types'

const API_BASE = '/api'

function formatMoney(amount: number): string {
  return `¥${amount.toFixed(2)}`
}

export default function BudgetPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [budget, setBudget] = useState<BudgetResponse | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalBudgetAmount, setTotalBudgetAmount] = useState('')
  const [categoryBudgets, setCategoryBudgets] = useState<{ [key: number]: string }>({})
  const [saving, setSaving] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [categoriesRes, budgetRes] = await Promise.all([
        fetch(`${API_BASE}/categories?type=expense`),
        fetch(`${API_BASE}/budgets?year=${year}&month=${month}`),
      ])
      
      if (!categoriesRes.ok || !budgetRes.ok) {
        throw new Error('Failed to fetch data')
      }
      
      const categoriesData = await categoriesRes.json()
      const budgetData = await budgetRes.json()
      
      setCategories(Array.isArray(categoriesData) ? categoriesData : [])
      setBudget(budgetData)
      
      if (budgetData.total && budgetData.total.total_budget > 0) {
        setTotalBudgetAmount(budgetData.total.total_budget.toString())
      } else {
        setTotalBudgetAmount('')
      }
      
      const newCategoryBudgets: { [key: number]: string } = {}
      if (budgetData.categories && Array.isArray(budgetData.categories)) {
        budgetData.categories.forEach((cb: CategoryBudget) => {
          if (cb.category_id) {
            newCategoryBudgets[cb.category_id] = cb.budget.toString()
          }
        })
      }
      setCategoryBudgets(newCategoryBudgets)
    } catch (error) {
      console.error('Failed to fetch budget data:', error)
      setError('加载预算数据失败')
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

  const saveTotalBudget = async () => {
    if (!totalBudgetAmount || parseFloat(totalBudgetAmount) <= 0) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          category_id: null,
          amount: parseFloat(totalBudgetAmount),
        }),
      })

      if (!response.ok) {
        throw new Error('保存失败')
      }

      fetchData()
    } catch (err) {
      console.error('Failed to save total budget:', err)
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const saveCategoryBudget = async (categoryId: number) => {
    const amount = categoryBudgets[categoryId]
    if (!amount || parseFloat(amount) < 0) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          category_id: categoryId,
          amount: parseFloat(amount),
        }),
      })

      if (!response.ok) {
        throw new Error('保存失败')
      }

      fetchData()
    } catch (err) {
      console.error('Failed to save category budget:', err)
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const deleteCategoryBudget = async (categoryId: number) => {
    const existingBudget = budget?.categories.find(c => c.category_id === categoryId)
    if (!existingBudget) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/budgets/${existingBudget.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      setCategoryBudgets(prev => {
        const newBudgets = { ...prev }
        delete newBudgets[categoryId]
        return newBudgets
      })
      fetchData()
    } catch (err) {
      console.error('Failed to delete category budget:', err)
      setError('删除失败，请重试')
    }
  }

  const getCategoryBudgetInfo = (categoryId: number): CategoryBudget | undefined => {
    return budget?.categories.find(c => c.category_id === categoryId)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => handleMonthChange(-1)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            ← 上月
          </button>
          <h2 className="text-xl font-semibold text-gray-800">
            {year}年{month}月 预算设置
          </h2>
          <button
            onClick={() => handleMonthChange(1)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            下月 →
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            关闭
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">本月总预算</h3>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              总预算金额
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">¥</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={totalBudgetAmount}
                onChange={(e) => setTotalBudgetAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入总预算"
              />
            </div>
          </div>
          <button
            onClick={saveTotalBudget}
            disabled={saving || !totalBudgetAmount || parseFloat(totalBudgetAmount) <= 0}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>

        {budget && budget.total.total_budget_cents > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">预算使用情况</span>
              <span className={`text-sm font-medium ${
                budget.total.is_over_total_budget ? 'text-red-600' : 'text-gray-700'
              }`}>
                {formatMoney(budget.total.total_spent)} / {formatMoney(budget.total.total_budget)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all duration-500 ${
                  budget.total.is_over_total_budget ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.min(budget.total.total_percentage, 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>剩余: {formatMoney(budget.total.total_remaining)}</span>
              <span>{budget.total.total_percentage.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">分类预算</h3>
        
        {categories.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无支出分类</p>
        ) : (
          <div className="space-y-4">
            {categories.map(category => {
              const budgetInfo = getCategoryBudgetInfo(category.id)
              const hasBudget = budgetInfo && budgetInfo.budget_cents > 0
              const isOverBudget = budgetInfo?.is_over_budget

              return (
                <div
                  key={category.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    isOverBudget ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{category.name}</span>
                        {isOverBudget && (
                          <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                            超预算
                          </span>
                        )}
                      </div>
                      {hasBudget && budgetInfo && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>已用: {formatMoney(budgetInfo.spent)}</span>
                            <span>预算: {formatMoney(budgetInfo.budget)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                isOverBudget ? 'bg-red-500' : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min(budgetInfo.percentage, 100)}%`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>剩余: {formatMoney(budgetInfo.remaining)}</span>
                            <span>{budgetInfo.percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">¥</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={categoryBudgets[category.id] || ''}
                          onChange={(e) => {
                            setCategoryBudgets(prev => ({
                              ...prev,
                              [category.id]: e.target.value
                            }))
                          }}
                          className="w-32 pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="预算金额"
                        />
                      </div>
                      <button
                        onClick={() => saveCategoryBudget(category.id)}
                        disabled={saving || !categoryBudgets[category.id] || parseFloat(categoryBudgets[category.id] || '0') <= 0}
                        className="px-4 py-2 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        保存
                      </button>
                      {hasBudget && (
                        <button
                          onClick={() => deleteCategoryBudget(category.id)}
                          disabled={saving}
                          className="px-3 py-2 text-red-600 text-sm hover:bg-red-50 rounded-md transition-colors"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {budget && budget.categories.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">预算概览</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">分类</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">预算</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">已用</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">剩余</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {budget.categories
                  .sort((a, b) => b.percentage - a.percentage)
                  .map(item => (
                    <tr key={item.category_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {item.category_name}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        {formatMoney(item.budget)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        {formatMoney(item.spent)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={item.remaining_cents >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatMoney(item.remaining)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.is_over_budget ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                            超预算
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            正常
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
