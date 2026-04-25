'use client'

import { useState, useEffect, useCallback } from 'react'
import { Transaction, Category, Summary } from '@/types'

const API_BASE = '/api'

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [summary, setSummary] = useState<Summary>({ income: 0, expense: 0, balance: 0 })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [transactionsRes, categoriesRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/transactions?year=${year}&month=${month}`),
        fetch(`${API_BASE}/categories`),
        fetch(`${API_BASE}/transactions/summary?year=${year}&month=${month}`),
      ])
      
      const transactionsData = await transactionsRes.json()
      const categoriesData = await categoriesRes.json()
      const summaryData = await summaryRes.json()
      
      setTransactions(transactionsData)
      setCategories(categoriesData)
      setSummary(summaryData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
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

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => handleMonthChange(-1)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            ← 上月
          </button>
          <h2 className="text-xl font-semibold">
            {year}年{month}月
          </h2>
          <button
            onClick={() => handleMonthChange(1)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            下月 →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">总收入</div>
            <div className="text-2xl font-bold text-income">
              ¥{summary.income.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">总支出</div>
            <div className="text-2xl font-bold text-expense">
              ¥{summary.expense.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">结余</div>
            <div className={`text-2xl font-bold ${
              summary.balance >= 0 ? 'text-income' : 'text-expense'
            }`}>
              ¥{summary.balance.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">流水记录</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            管理分类
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            + 添加记录
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">暂无记录，点击"添加记录"开始记账</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y">
            {transactions.map(transaction => (
              <div
                key={transaction.id}
                className="p-4 hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                      {transaction.type === 'income' ? '+' : '-'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{transaction.category_name}</div>
                    <div className="text-sm text-gray-500">
                      {transaction.date}
                      {transaction.note && ` · ${transaction.note}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4 mt-2 sm:mt-0">
                  <div className={`font-semibold ${
                    transaction.type === 'income' ? 'text-income' : 'text-expense'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toFixed(2)}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingTransaction(transaction)
                        setShowAddModal(true)
                      }}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                    >
                      编辑
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('确定要删除这条记录吗？')) {
                          await fetch(`${API_BASE}/transactions/${transaction.id}`, {
                            method: 'DELETE',
                          })
                          fetchData()
                        }
                      }}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddModal && (
        <TransactionModal
          transaction={editingTransaction}
          categories={categories}
          onClose={() => {
            setShowAddModal(false)
            setEditingTransaction(null)
          }}
          onSuccess={fetchData}
        />
      )}

      {showCategoryModal && (
        <CategoryModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}

function TransactionModal({
  transaction,
  categories,
  onClose,
  onSuccess,
}: {
  transaction: Transaction | null
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}) {
  const isEditing = !!transaction
  const [type, setType] = useState<'income' | 'expense'>(transaction?.type || 'expense')
  const [amount, setAmount] = useState(transaction?.amount.toString() || '')
  const [categoryId, setCategoryId] = useState(transaction?.category_id?.toString() || '')
  const [note, setNote] = useState(transaction?.note || '')
  const [date, setDate] = useState(transaction?.date || new Date().toISOString().split('T')[0])
  const [error, setError] = useState('')

  const filteredCategories = categories.filter(c => c.type === type)

  useEffect(() => {
    if (filteredCategories.length > 0 && !transaction) {
      setCategoryId(filteredCategories[0].id.toString())
    }
  }, [type, filteredCategories, transaction])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!amount || parseFloat(amount) <= 0) {
      setError('请输入有效的金额')
      return
    }
    if (!categoryId) {
      setError('请选择分类')
      return
    }
    if (!date) {
      setError('请选择日期')
      return
    }

    const data = {
      amount: parseFloat(amount),
      category_id: parseInt(categoryId),
      type,
      note: note || '',
      date,
    }

    try {
      let response
      if (isEditing && transaction) {
        response = await fetch(`${API_BASE}/transactions/${transaction.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      } else {
        response = await fetch(`${API_BASE}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      }

      if (!response.ok) {
        const result = await response.json()
        setError(result.error || '操作失败')
        return
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError('网络错误，请稍后重试')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            {isEditing ? '编辑记录' : '添加记录'}
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setType('expense')
                    if (categories.find(c => c.type === 'expense')) {
                      setCategoryId('')
                    }
                  }}
                  className={`flex-1 py-2 rounded-md font-medium transition-colors ${
                    type === 'expense'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  支出
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('income')
                    if (categories.find(c => c.type === 'income')) {
                      setCategoryId('')
                    }
                  }}
                  className={`flex-1 py-2 rounded-md font-medium transition-colors ${
                    type === 'income'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  收入
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                金额
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入金额"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                分类
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">请选择分类</option>
                {filteredCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日期
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                备注（可选）
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="添加备注"
              />
            </div>

            {error && (
              <div className="mb-4 text-red-600 text-sm">{error}</div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                {isEditing ? '保存' : '添加'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function CategoryModal({
  categories,
  onClose,
  onSuccess,
}: {
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'income' | 'expense'>('expense')
  const [error, setError] = useState('')

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  const handleAddCategory = async () => {
    setError('')
    if (!newName.trim()) {
      setError('请输入分类名称')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), type: newType }),
      })

      if (!response.ok) {
        const result = await response.json()
        setError(result.error || '添加失败')
        return
      }

      setNewName('')
      onSuccess()
    } catch (err) {
      setError('网络错误')
    }
  }

  const handleDeleteCategory = async (category: Category) => {
    if (category.is_default) {
      alert('不能删除默认分类')
      return
    }
    if (!confirm(`确定要删除分类"${category.name}"吗？`)) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/categories/${category.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        alert(result.error || '删除失败')
        return
      }

      onSuccess()
    } catch (err) {
      alert('网络错误')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">分类管理</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-2">添加新分类</h4>
            <div className="flex space-x-2">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setNewType('expense')}
                  className={`px-3 py-2 rounded-md text-sm ${
                    newType === 'expense'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  支出
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('income')}
                  className={`px-3 py-2 rounded-md text-sm ${
                    newType === 'income'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  收入
                </button>
              </div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="分类名称"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                添加
              </button>
            </div>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </div>

          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-2">支出分类</h4>
            <div className="flex flex-wrap gap-2">
              {expenseCategories.map(cat => (
                <div
                  key={cat.id}
                  className="flex items-center space-x-1 px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm"
                >
                  <span>{cat.name}</span>
                  {!cat.is_default && (
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="ml-1 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  )}
                  {cat.is_default && (
                    <span className="text-xs text-red-400 ml-1">(默认)</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-2">收入分类</h4>
            <div className="flex flex-wrap gap-2">
              {incomeCategories.map(cat => (
                <div
                  key={cat.id}
                  className="flex items-center space-x-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm"
                >
                  <span>{cat.name}</span>
                  {!cat.is_default && (
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="ml-1 text-green-500 hover:text-green-700"
                    >
                      ×
                    </button>
                  )}
                  {cat.is_default && (
                    <span className="text-xs text-green-400 ml-1">(默认)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
