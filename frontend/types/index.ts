export interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
  is_default: boolean
}

export interface Transaction {
  id: number
  amount: number
  category_id: number
  category_name: string
  type: 'income' | 'expense'
  note: string | null
  date: string
}

export interface Summary {
  income: number
  expense: number
  balance: number
}

export interface CategoryStat {
  category: string
  amount: number
}

export interface TrendStat {
  month: string
  income: number
  expense: number
}
