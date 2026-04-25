from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
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
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    category = db.relationship('Category', backref='transactions')
    type = db.Column(db.String(10), nullable=False)
    note = db.Column(db.String(200))
    date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

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

def validate_amount(amount):
    if amount is None:
        return False, '金额不能为空'
    try:
        amount = float(amount)
        if amount <= 0:
            return False, '金额必须大于0'
        return True, amount
    except (ValueError, TypeError):
        return False, '金额格式无效'

def validate_date(date_str):
    if not date_str:
        return False, '日期不能为空'
    try:
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        return True, date
    except ValueError:
        return False, '日期格式无效，应为 YYYY-MM-DD'

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
        query = query.filter(
            db.func.strftime('%Y', Transaction.date) == str(year),
            db.func.strftime('%m', Transaction.date) == f'{month:02d}'
        )
    
    transactions = query.order_by(Transaction.date.desc(), Transaction.created_at.desc()).all()
    
    result = []
    for t in transactions:
        result.append({
            'id': t.id,
            'amount': t.amount,
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
        query = query.filter(
            db.func.strftime('%Y', Transaction.date) == str(year),
            db.func.strftime('%m', Transaction.date) == f'{month:02d}'
        )
    
    income = query.filter_by(type='income').with_entities(db.func.sum(Transaction.amount)).scalar() or 0
    expense = query.filter_by(type='expense').with_entities(db.func.sum(Transaction.amount)).scalar() or 0
    balance = income - expense
    
    return jsonify({
        'income': income,
        'expense': expense,
        'balance': balance
    })

@app.route('/api/transactions', methods=['POST'])
def create_transaction():
    with db_lock:
        data = request.json
        
        amount_valid, amount_result = validate_amount(data.get('amount'))
        if not amount_valid:
            return jsonify({'error': amount_result}), 400
        amount = amount_result
        
        date_valid, date_result = validate_date(data.get('date'))
        if not date_valid:
            return jsonify({'error': date_result}), 400
        date = date_result
        
        category_id = data.get('category_id')
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': '分类不存在'}), 400
        
        type = data.get('type')
        if type not in ['income', 'expense']:
            return jsonify({'error': '交易类型无效'}), 400
        
        transaction = Transaction(
            amount=amount,
            category_id=category_id,
            type=type,
            note=data.get('note', ''),
            date=date
        )
        
        db.session.add(transaction)
        db.session.commit()
        
        return jsonify({
            'id': transaction.id,
            'amount': transaction.amount,
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
            'amount': transaction.amount,
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
        query = query.filter(
            db.func.strftime('%Y', Transaction.date) == str(year),
            db.func.strftime('%m', Transaction.date) == f'{month:02d}'
        )
    
    results = query.join(Category).with_entities(
        Category.name,
        db.func.sum(Transaction.amount).label('total')
    ).group_by(Category.name).all()
    
    return jsonify([{
        'category': r.name,
        'amount': r.total
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
        query = Transaction.query.filter(
            db.func.strftime('%Y', Transaction.date) == str(m['year']),
            db.func.strftime('%m', Transaction.date) == f'{m["month"]:02d}'
        )
        
        income = query.filter_by(type='income').with_entities(db.func.sum(Transaction.amount)).scalar() or 0
        expense = query.filter_by(type='expense').with_entities(db.func.sum(Transaction.amount)).scalar() or 0
        
        results.append({
            'month': f"{m['year']}-{m['month']:02d}",
            'income': income,
            'expense': expense
        })
    
    return jsonify(results)

with app.app_context():
    init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
