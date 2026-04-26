from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, date, timedelta
import threading
import os

app = Flask(__name__)
CORS(app)

db_path = os.environ.get('DATABASE_PATH', 'finance.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
db_lock = threading.Lock()

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    type = db.Column(db.String(10), nullable=False)
    is_default = db.Column(db.Boolean, default=False)

class Transaction(db.Model):
    __tablename__ = 'transactions'
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Integer, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    category = db.relationship('Category', backref='transactions')
    type = db.Column(db.String(10), nullable=False)
    note = db.Column(db.String(200))
    date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Budget(db.Model):
    __tablename__ = 'budgets'
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=True)
    category = db.relationship('Category', backref='budgets')
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def init_db():
    with app.app_context():
        db.create_all()
        
        default_categories = [
            {'name': '餐饮', 'type': 'expense', 'is_default': True},
            {'name': '交通', 'type': 'expense', 'is_default': True},
            {'name': '购物', 'type': 'expense', 'is_default': True},
            {'name': '娱乐', 'type': 'expense', 'is_default': True},
            {'name': '医疗', 'type': 'expense', 'is_default': True},
            {'name': '教育', 'type': 'expense', 'is_default': True},
            {'name': '住房', 'type': 'expense', 'is_default': True},
            {'name': '其他支出', 'type': 'expense', 'is_default': True},
            {'name': '工资', 'type': 'income', 'is_default': True},
            {'name': '兼职', 'type': 'income', 'is_default': True},
            {'name': '投资', 'type': 'income', 'is_default': True},
            {'name': '奖金', 'type': 'income', 'is_default': True},
            {'name': '其他收入', 'type': 'income', 'is_default': True},
        ]
        
        for cat in default_categories:
            if not Category.query.filter_by(name=cat['name']).first():
                category = Category(**cat)
                db.session.add(category)
        
        db.session.commit()

def migrate_amount_to_cents():
    with app.app_context():
        try:
            from sqlalchemy import text
            
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            
            if 'transaction' in tables and 'transactions' not in tables:
                print("Migrating old 'transaction' table to 'transactions'...")
                db.session.execute(text("ALTER TABLE transaction RENAME TO transactions"))
                db.session.commit()
            
            if 'transactions' in tables:
                columns = [c['name'] for c in inspector.get_columns('transactions')]
                if 'amount' in columns:
                    transactions = Transaction.query.all()
                    for t in transactions:
                        if t.amount is not None and isinstance(t.amount, float):
                            t.amount = int(round(t.amount * 100))
                    db.session.commit()
        except Exception as e:
            print(f"Migration skipped or error: {e}")
            db.session.rollback()

def get_month_range(year: int, month: int) -> tuple[date, date]:
    first_day = date(year, month, 1)
    if month == 12:
        last_day = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last_day = date(year, month + 1, 1) - timedelta(days=1)
    return first_day, last_day

def validate_amount(amount):
    if amount is None:
        return False, '金额不能为空'
    try:
        amount = float(amount)
        if amount <= 0:
            return False, '金额必须大于0'
        amount_cents = int(round(amount * 100))
        return True, amount_cents
    except (ValueError, TypeError):
        return False, '金额格式无效'

def validate_date(date_str):
    if not date_str:
        return False, '日期不能为空'
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        return True, date_obj
    except ValueError:
        return False, '日期格式无效，应为 YYYY-MM-DD'

def format_amount(amount_cents: int) -> float:
    return round(amount_cents / 100, 2)

@app.route('/api/categories', methods=['GET'])
def get_categories():
    type_filter = request.args.get('type')
    query = Category.query
    if type_filter:
        query = query.filter_by(type=type_filter)
    categories = query.all()
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'type': c.type,
        'is_default': c.is_default
    } for c in categories])

@app.route('/api/categories', methods=['POST'])
def create_category():
    with db_lock:
        data = request.json
        name = data.get('name', '').strip()
        type = data.get('type')
        
        if not name:
            return jsonify({'error': '分类名称不能为空'}), 400
        if type not in ['income', 'expense']:
            return jsonify({'error': '分类类型无效'}), 400
        
        if Category.query.filter_by(name=name).first():
            return jsonify({'error': '分类已存在'}), 400
        
        category = Category(name=name, type=type, is_default=False)
        db.session.add(category)
        db.session.commit()
        
        return jsonify({
            'id': category.id,
            'name': category.name,
            'type': category.type,
            'is_default': category.is_default
        }), 201

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    with db_lock:
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': '分类不存在'}), 404
        
        if category.is_default:
            return jsonify({'error': '不能删除默认分类'}), 400
        
        if Transaction.query.filter_by(category_id=category_id).first():
            return jsonify({'error': '该分类下有交易记录，无法删除'}), 400
        
        db.session.delete(category)
        db.session.commit()
        return jsonify({'message': '删除成功'})

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    
    query = Transaction.query
    
    if year and month:
        first_day, last_day = get_month_range(year, month)
        query = query.filter(
            Transaction.date >= first_day,
            Transaction.date <= last_day
        )
    
    transactions = query.order_by(Transaction.date.desc(), Transaction.created_at.desc()).all()
    
    result = []
    for t in transactions:
        result.append({
            'id': t.id,
            'amount': format_amount(t.amount),
            'amount_cents': t.amount,
            'category_id': t.category_id,
            'category_name': t.category.name,
            'type': t.type,
            'note': t.note,
            'date': t.date.strftime('%Y-%m-%d')
        })
    
    return jsonify(result)

@app.route('/api/transactions/summary', methods=['GET'])
def get_transactions_summary():
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    
    query = Transaction.query
    
    if year and month:
        first_day, last_day = get_month_range(year, month)
        query = query.filter(
            Transaction.date >= first_day,
            Transaction.date <= last_day
        )
    
    income = query.filter_by(type='income').with_entities(db.func.sum(Transaction.amount)).scalar() or 0
    expense = query.filter_by(type='expense').with_entities(db.func.sum(Transaction.amount)).scalar() or 0
    balance = income - expense
    
    return jsonify({
        'income': format_amount(income),
        'income_cents': income,
        'expense': format_amount(expense),
        'expense_cents': expense,
        'balance': format_amount(balance),
        'balance_cents': balance
    })

@app.route('/api/transactions', methods=['POST'])
def create_transaction():
    with db_lock:
        data = request.json
        
        amount_valid, amount_result = validate_amount(data.get('amount'))
        if not amount_valid:
            return jsonify({'error': amount_result}), 400
        amount_cents = amount_result
        
        date_valid, date_result = validate_date(data.get('date'))
        if not date_valid:
            return jsonify({'error': date_result}), 400
        date_obj = date_result
        
        category_id = data.get('category_id')
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': '分类不存在'}), 400
        
        type = data.get('type')
        if type not in ['income', 'expense']:
            return jsonify({'error': '交易类型无效'}), 400
        
        transaction = Transaction(
            amount=amount_cents,
            category_id=category_id,
            type=type,
            note=data.get('note', ''),
            date=date_obj
        )
        
        db.session.add(transaction)
        db.session.commit()
        
        return jsonify({
            'id': transaction.id,
            'amount': format_amount(transaction.amount),
            'amount_cents': transaction.amount,
            'category_id': transaction.category_id,
            'category_name': category.name,
            'type': transaction.type,
            'note': transaction.note,
            'date': transaction.date.strftime('%Y-%m-%d')
        }), 201

@app.route('/api/transactions/<int:transaction_id>', methods=['PUT'])
def update_transaction(transaction_id):
    with db_lock:
        transaction = Transaction.query.get(transaction_id)
        if not transaction:
            return jsonify({'error': '交易不存在'}), 404
        
        data = request.json
        
        if 'amount' in data:
            amount_valid, amount_result = validate_amount(data.get('amount'))
            if not amount_valid:
                return jsonify({'error': amount_result}), 400
            transaction.amount = amount_result
        
        if 'date' in data:
            date_valid, date_result = validate_date(data.get('date'))
            if not date_valid:
                return jsonify({'error': date_result}), 400
            transaction.date = date_result
        
        if 'category_id' in data:
            category = Category.query.get(data.get('category_id'))
            if not category:
                return jsonify({'error': '分类不存在'}), 400
            transaction.category_id = data.get('category_id')
        
        if 'type' in data:
            if data.get('type') not in ['income', 'expense']:
                return jsonify({'error': '交易类型无效'}), 400
            transaction.type = data.get('type')
        
        if 'note' in data:
            transaction.note = data.get('note', '')
        
        db.session.commit()
        
        return jsonify({
            'id': transaction.id,
            'amount': format_amount(transaction.amount),
            'amount_cents': transaction.amount,
            'category_id': transaction.category_id,
            'category_name': transaction.category.name,
            'type': transaction.type,
            'note': transaction.note,
            'date': transaction.date.strftime('%Y-%m-%d')
        })

@app.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    with db_lock:
        transaction = Transaction.query.get(transaction_id)
        if not transaction:
            return jsonify({'error': '交易不存在'}), 404
        
        db.session.delete(transaction)
        db.session.commit()
        return jsonify({'message': '删除成功'})

@app.route('/api/stats/category', methods=['GET'])
def get_category_stats():
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    type = request.args.get('type', 'expense')
    
    query = Transaction.query.filter_by(type=type)
    
    if year and month:
        first_day, last_day = get_month_range(year, month)
        query = query.filter(
            Transaction.date >= first_day,
            Transaction.date <= last_day
        )
    
    results = query.join(Category).with_entities(
        Category.name,
        Category.id,
        db.func.sum(Transaction.amount).label('total')
    ).group_by(Category.name, Category.id).all()
    
    total_amount = sum(r.total for r in results) if results else 0
    
    return jsonify([{
        'category': r.name,
        'category_id': r.id,
        'amount': format_amount(r.total),
        'amount_cents': r.total,
        'percentage': round((r.total / total_amount * 100), 2) if total_amount > 0 else 0
    } for r in results])

@app.route('/api/stats/trend', methods=['GET'])
def get_trend_stats():
    now = datetime.now()
    months = []
    
    for i in range(5, -1, -1):
        year = now.year
        month = now.month - i
        if month <= 0:
            month += 12
            year -= 1
        months.append({'year': year, 'month': month})
    
    results = []
    for m in months:
        first_day, last_day = get_month_range(m['year'], m['month'])
        query = Transaction.query.filter(
            Transaction.date >= first_day,
            Transaction.date <= last_day
        )
        
        income = query.filter_by(type='income').with_entities(db.func.sum(Transaction.amount)).scalar() or 0
        expense = query.filter_by(type='expense').with_entities(db.func.sum(Transaction.amount)).scalar() or 0
        
        results.append({
            'month': f"{m['year']}-{m['month']:02d}",
            'income': format_amount(income),
            'income_cents': income,
            'expense': format_amount(expense),
            'expense_cents': expense
        })
    
    return jsonify(results)

@app.route('/api/budgets', methods=['GET'])
def get_budgets():
    year = request.args.get('year', type=int, default=datetime.now().year)
    month = request.args.get('month', type=int, default=datetime.now().month)
    
    budgets = Budget.query.filter_by(year=year, month=month).all()
    
    first_day, last_day = get_month_range(year, month)
    transactions = Transaction.query.filter(
        Transaction.date >= first_day,
        Transaction.date <= last_day,
        Transaction.type == 'expense'
    ).all()
    
    category_spending = {}
    total_spending = 0
    for t in transactions:
        category_spending[t.category_id] = category_spending.get(t.category_id, 0) + t.amount
        total_spending += t.amount
    
    result = []
    total_budget = 0
    
    for budget in budgets:
        if budget.category_id is None:
            total_budget = budget.amount
        else:
            spent = category_spending.get(budget.category_id, 0)
            result.append({
                'id': budget.id,
                'category_id': budget.category_id,
                'category_name': budget.category.name if budget.category else None,
                'year': budget.year,
                'month': budget.month,
                'budget': format_amount(budget.amount),
                'budget_cents': budget.amount,
                'spent': format_amount(spent),
                'spent_cents': spent,
                'remaining': format_amount(max(0, budget.amount - spent)),
                'remaining_cents': max(0, budget.amount - spent),
                'percentage': round((spent / budget.amount * 100), 2) if budget.amount > 0 else 0,
                'is_over_budget': spent > budget.amount
            })
    
    total_result = {
        'total_budget': format_amount(total_budget),
        'total_budget_cents': total_budget,
        'total_spent': format_amount(total_spending),
        'total_spent_cents': total_spending,
        'total_remaining': format_amount(max(0, total_budget - total_spending)),
        'total_remaining_cents': max(0, total_budget - total_spending),
        'total_percentage': round((total_spending / total_budget * 100), 2) if total_budget > 0 else 0,
        'is_over_total_budget': total_spending > total_budget if total_budget > 0 else False
    }
    
    return jsonify({
        'total': total_result,
        'categories': result
    })

@app.route('/api/budgets', methods=['POST'])
def create_budget():
    with db_lock:
        data = request.json
        
        year = data.get('year')
        month = data.get('month')
        category_id = data.get('category_id')
        amount = data.get('amount')
        
        if not year or not month:
            return jsonify({'error': '年份和月份不能为空'}), 400
        
        amount_valid, amount_result = validate_amount(amount)
        if not amount_valid:
            return jsonify({'error': amount_result}), 400
        amount_cents = amount_result
        
        if category_id is not None:
            category = Category.query.get(category_id)
            if not category:
                return jsonify({'error': '分类不存在'}), 400
            if category.type != 'expense':
                return jsonify({'error': '只能为支出分类设置预算'}), 400
        
        existing = Budget.query.filter_by(
            year=year, month=month, category_id=category_id
        ).first()
        
        if existing:
            existing.amount = amount_cents
            db.session.commit()
            budget = existing
        else:
            budget = Budget(
                year=year,
                month=month,
                category_id=category_id,
                amount=amount_cents
            )
            db.session.add(budget)
            db.session.commit()
        
        return jsonify({
            'id': budget.id,
            'category_id': budget.category_id,
            'year': budget.year,
            'month': budget.month,
            'budget': format_amount(budget.amount),
            'budget_cents': budget.amount
        }), 201

@app.route('/api/budgets/<int:budget_id>', methods=['PUT'])
def update_budget(budget_id):
    with db_lock:
        budget = Budget.query.get(budget_id)
        if not budget:
            return jsonify({'error': '预算不存在'}), 404
        
        data = request.json
        
        if 'amount' in data:
            amount_valid, amount_result = validate_amount(data.get('amount'))
            if not amount_valid:
                return jsonify({'error': amount_result}), 400
            budget.amount = amount_result
        
        db.session.commit()
        
        return jsonify({
            'id': budget.id,
            'category_id': budget.category_id,
            'year': budget.year,
            'month': budget.month,
            'budget': format_amount(budget.amount),
            'budget_cents': budget.amount
        })

@app.route('/api/budgets/<int:budget_id>', methods=['DELETE'])
def delete_budget(budget_id):
    with db_lock:
        budget = Budget.query.get(budget_id)
        if not budget:
            return jsonify({'error': '预算不存在'}), 404
        
        db.session.delete(budget)
        db.session.commit()
        return jsonify({'message': '删除成功'})

with app.app_context():
    init_db()
    migrate_amount_to_cents()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port)
