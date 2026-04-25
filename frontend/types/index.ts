export interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
  is_default: boolean
}

export interface Transaction {
  id: number
  amount: number
  amount_cents: number
  category_id: number
  category_name: string
  type: 'income' | 'expense'
  note: string | null
  date: string
}

export interface Summary {
  income: number
  income_cents: number
  expense: number
  expense_cents: number
  balance: number
  balance_cents: number
}

export interface CategoryStat {
  category: string
  category_id: number
  amount: number
  amount_cents: number
  percentage: number
}

export interface TrendStat {
  month: string
  income: number
  income_cents: number
  expense: number
  expense_cents: number
}

export interface CategoryBudget {
  id: number
  category_id: number
  category_name: string | null
  year: number
  month: number
  budget: number
  budget_cents: number
  spent: number
  spent_cents: number
  remaining: number
  remaining_cents: number
  percentage: number
  is_over_budget: boolean
}

export interface TotalBudget {
  total_budget: number
  total_budget_cents: number
  total_spent: number
  total_spent_cents: number
  total_remaining: number
  total_remaining_cents: number
  total_percentage: number
  is_over_total_budget: boolean
}

export interface BudgetResponse {
  total: TotalBudget
  categories: CategoryBudget[]
}
