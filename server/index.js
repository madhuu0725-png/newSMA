import 'dotenv/config'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import { createHash, timingSafeEqual } from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

const app = express()
const port = Number(process.env.PORT || 4100)
const jwtSecret = process.env.JWT_SECRET
const reportsToken = process.env.REPORTS_TOKEN || 'local-reports-token'
const reportsUrl = process.env.REPORTS_URL || 'http://127.0.0.1:8001'

if (process.env.NODE_ENV === 'production' && (!jwtSecret || jwtSecret.length < 32)) {
  throw new Error('Set JWT_SECRET to at least 32 characters in production.')
}
if (!process.env.MONGODB_URI) {
  throw new Error('Set MONGODB_URI to a MongoDB connection string.')
}

const signingSecret = jwtSecret || 'local-development-secret-change-before-deploy'
const counterSchema = new mongoose.Schema({ _id: String, value: { type: Number, default: 0 } })
const Counter = mongoose.model('Counter', counterSchema)
const userSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'customer', 'delivery'], required: true },
  customer_id: { type: Number, default: null },
}, { timestamps: true })
const customerSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  business: { type: String, required: true, trim: true, maxlength: 160 },
  type: { type: String, default: 'Medical Store', maxlength: 60 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  email: { type: String, default: '', trim: true, lowercase: true, maxlength: 254 },
  city: { type: String, default: '', trim: true, maxlength: 100 },
  status: { type: String, default: 'Active' },
}, { timestamps: true })
const supplierSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  contact: { type: String, default: '', trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  email: { type: String, default: '', trim: true, lowercase: true, maxlength: 254 },
  city: { type: String, default: '', trim: true, maxlength: 100 },
}, { timestamps: true })
const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  brand: { type: String, default: '', trim: true, maxlength: 120 },
  category: { type: String, default: '', trim: true, maxlength: 100 },
  manufacturer: { type: String, default: '', trim: true, maxlength: 160 },
  price: { type: Number, required: true, min: 0 },
  mrp: { type: Number, default: 0, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  reorder_level: { type: Number, default: 10, min: 0 },
  unit: { type: String, default: 'pack', trim: true, maxlength: 40 },
  active: { type: Boolean, default: true },
}, { timestamps: true })
const orderLineSchema = new mongoose.Schema({
  product_id: { type: Number, required: true },
  name: { type: String, required: true },
  requested_qty: { type: Number, required: true, min: 1 },
  confirmed_qty: { type: Number, required: true, min: 0 },
  delivered_qty: { type: Number, default: 0, min: 0 },
  unit_price: { type: Number, required: true, min: 0 },
}, { _id: false })
const orderSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  customer_id: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'preparing', 'dispatched', 'delivered', 'cancelled'], default: 'pending' },
  payment_status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  total: { type: Number, default: 0, min: 0 },
  lines: { type: [orderLineSchema], default: [] },
  order_date: { type: Date, default: Date.now },
}, { timestamps: true })
const paymentSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  customer_id: { type: Number, required: true },
  order_id: { type: Number, default: null },
  amount: { type: Number, required: true, min: 0.01 },
  mode: { type: String, required: true, trim: true, maxlength: 40 },
  reference: { type: String, default: '', trim: true, maxlength: 100 },
  paid_at: { type: Date, default: Date.now },
}, { timestamps: true })

const User = mongoose.model('User', userSchema)
const Customer = mongoose.model('Customer', customerSchema)
const Supplier = mongoose.model('Supplier', supplierSchema)
const Product = mongoose.model('Product', productSchema)
const Order = mongoose.model('Order', orderSchema)
const Payment = mongoose.model('Payment', paymentSchema)

app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  next()
})

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const nextId = async (name) => {
  const counter = await Counter.findByIdAndUpdate(name, { $inc: { value: 1 } }, { new: true, upsert: true })
  return counter.value
}
const text = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const emailIsValid = (value) => emailPattern.test(value)
const hasRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'You do not have permission to perform this action.' })
  return next()
}

function signedToken(user) {
  return jwt.sign(user, signingSecret, { expiresIn: '8h', issuer: 'srinivasa-medical-agencies' })
}

function authResponse(res, user) {
  const publicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    customerId: user.customer_id ?? user.customerId ?? undefined,
  }
  const token = signedToken(publicUser)
  res.cookie('sma_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  })
  return res.json({ user: publicUser })
}

function authenticated(req, res, next) {
  const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '')
  const token = bearer || req.cookies.sma_session
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' })
  try {
    req.user = jwt.verify(token, signingSecret, { issuer: 'srinivasa-medical-agencies' })
    return next()
  } catch {
    return res.status(401).json({ error: 'Your session expired. Please sign in again.' })
  }
}

async function reportEvent(type, amount = 0, entityId = '') {
  try {
    const response = await fetch(`${reportsUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Reports-Token': reportsToken },
      body: JSON.stringify({ type, amount, entityId: String(entityId) }),
      signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) throw new Error(`report service returned ${response.status}`)
  } catch (error) {
    console.error(`Could not record ${type} in the SQL reporting service:`, error.message)
  }
}

async function formatOrders(orders) {
  if (!orders.length) return []
  const customerIds = [...new Set(orders.map((order) => order.customer_id))]
  const orderIds = orders.map((order) => order.id)
  const [customers, payments] = await Promise.all([
    Customer.find({ id: { $in: customerIds } }).select('id name').lean(),
    Payment.find({ order_id: { $in: orderIds } }).select('order_id amount').lean(),
  ])
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]))
  const paidByOrder = new Map()
  for (const payment of payments) paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) || 0) + payment.amount)
  return orders.map((order) => {
    const lines = order.lines || []
    return {
      id: order.id,
      customer_id: order.customer_id,
      customer: customerNames.get(order.customer_id) || 'Unknown customer',
      order_date: order.order_date,
      total: order.total,
      status: order.status,
      payment_status: order.payment_status,
      items: lines.map((line) => `${line.name} × ${line.requested_qty}`).join(', '),
      requested_qty: lines.reduce((sum, line) => sum + line.requested_qty, 0),
      confirmed_qty: lines.reduce((sum, line) => sum + line.confirmed_qty, 0),
      delivered_qty: lines.reduce((sum, line) => sum + line.delivered_qty, 0),
      pending_qty: lines.reduce((sum, line) => sum + line.confirmed_qty - line.delivered_qty, 0),
      paid: paidByOrder.get(order.id) || 0,
    }
  })
}

async function buildDashboard() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)
  const [customers, suppliers, products, orders, recent, monthlyOrders, dailyOrders, allOrders, weekOrders, productsForStock, payments] = await Promise.all([
    Customer.countDocuments(),
    Supplier.countDocuments(),
    Product.countDocuments({ active: true }),
    Order.countDocuments(),
    Order.find().sort({ id: -1 }).limit(6).lean(),
    Order.find({ order_date: { $gte: monthStart }, status: { $ne: 'cancelled' } }).select('total').lean(),
    Order.find({ order_date: { $gte: todayStart }, status: { $ne: 'cancelled' } }).select('total').lean(),
    Order.find().select('id total status').lean(),
    Order.find({ order_date: { $gte: weekStart }, status: { $ne: 'cancelled' } }).select('order_date total').lean(),
    Product.find({ active: true }).select('stock reserved reorder_level price').lean(),
    Payment.find().select('order_id amount').lean(),
  ])
  const paidByOrder = new Map()
  for (const payment of payments) paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) || 0) + payment.amount)
  const orderById = new Map(allOrders.map((order) => [order.id, order]))
  const salesTrend = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(todayStart)
    day.setDate(day.getDate() - offset)
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)
    const dayOrders = weekOrders.filter((order) => order.order_date >= day && order.order_date < nextDay)
    salesTrend.push({
      day: day.toLocaleDateString('en-IN', { weekday: 'short' }),
      sales: dayOrders.reduce((sum, order) => order.status === 'cancelled' ? sum : sum + order.total, 0),
    })
  }
  const allRecent = await formatOrders(recent)
  const outstanding = allOrders.reduce((sum, order) => {
    if (order.status === 'cancelled') return sum
    return sum + Math.max(0, order.total - (paidByOrder.get(order.id) || 0))
  }, 0)
  const productsAtReorder = productsForStock.filter((product) => product.stock - product.reserved <= product.reorder_level)
  return {
    customers,
    suppliers,
    products,
    orders,
    todayOrders: await Order.countDocuments({ order_date: { $gte: todayStart } }),
    sales: monthlyOrders.reduce((sum, order) => sum + order.total, 0),
    todaySales: dailyOrders.reduce((sum, order) => sum + order.total, 0),
    stockValue: productsForStock.reduce((sum, product) => sum + product.stock * product.price, 0),
    lowStock: productsAtReorder.length,
    pendingDeliveries: await Order.countDocuments({ status: { $nin: ['delivered', 'cancelled'] } }),
    outstanding,
    recentOrders: allRecent,
    salesTrend,
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
})

app.get('/api/status', asyncRoute(async (req, res) => {
  res.json({ setupRequired: await User.countDocuments() === 0, testingEnabled: false })
}))

app.post('/api/auth/setup', asyncRoute(async (req, res) => {
  if (await User.countDocuments() !== 0) return res.status(409).json({ error: 'Admin setup has already been completed.' })
  const name = text(req.body.name, 120)
  const email = text(req.body.email, 254).toLowerCase()
  const password = req.body.password
  if (!name || !emailIsValid(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Enter your name, a valid email address, and a password of at least 8 characters.' })
  }
  const user = await User.create({ id: await nextId('users'), name, email, password_hash: await bcrypt.hash(password, 12), role: 'admin' })
  return authResponse(res, user)
}))

app.post('/api/auth/admin-register', asyncRoute(async (req, res) => {
  const configuredCode = process.env.ADMIN_INVITE_CODE || ''
  if (configuredCode.length < 24) {
    return res.status(503).json({ error: 'Admin account creation is not configured. Set ADMIN_INVITE_CODE in .env.' })
  }
  const name = text(req.body.name, 120)
  const email = text(req.body.email, 254).toLowerCase()
  const password = req.body.password
  const inviteCode = typeof req.body.inviteCode === 'string' ? req.body.inviteCode : ''
  if (!name || !emailIsValid(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Enter your name, a valid email address, and a password of at least 8 characters.' })
  }
  const expected = createHash('sha256').update(configuredCode).digest()
  const received = createHash('sha256').update(inviteCode).digest()
  if (!timingSafeEqual(expected, received)) {
    return res.status(403).json({ error: 'The administrator invite code is not valid.' })
  }
  const user = await User.create({
    id: await nextId('users'), name, email,
    password_hash: await bcrypt.hash(password, 12), role: 'admin',
  })
  return authResponse(res, user)
}))

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const name = text(req.body.name, 120)
  const business = text(req.body.business, 160)
  const phone = text(req.body.phone, 30)
  const email = text(req.body.email, 254).toLowerCase()
  const password = req.body.password
  if (!name || !business || phone.length < 5 || !emailIsValid(email) ||
      typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Enter your name, business, phone, valid email, and a password of at least 8 characters.' })
  }
  const customerId = await nextId('customers')
  const customer = await Customer.create({
    id: customerId, name, business, phone, email, type: 'Medical Store',
  })
  try {
    const user = await User.create({
      id: await nextId('users'), name, email, password_hash: await bcrypt.hash(password, 12),
      role: 'customer', customer_id: customerId,
    })
    await reportEvent('customer_created', 0, customerId)
    return authResponse(res, user)
  } catch (error) {
    await Customer.deleteOne({ id: customerId })
    throw error
  }
}))

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const identifier = text(req.body.identifier, 254).toLowerCase()
  const role = req.body.role === 'customer' ? 'customer' : req.body.role === 'user' ? 'user' : ''
  const password = req.body.password
  if (!identifier || !role || typeof password !== 'string' || !password.length || password.length > 128) {
    return res.status(400).json({ error: 'Enter your email or registered mobile number and password.' })
  }
  let user
  if (role === 'customer') {
    const customer = await Customer.findOne({ phone: identifier }).select('id').lean()
    user = await User.findOne({
      role: 'customer',
      $or: [{ email: identifier }, ...(customer ? [{ customer_id: customer.id }] : [])],
    })
  } else {
    user = await User.findOne({
      role: 'admin',
      $or: [{ email: identifier }, { name: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }],
    })
  }
  if (!user || typeof user.password_hash !== 'string' || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({ error: 'The account details do not match this login type.' })
  }
  return authResponse(res, user)
}))

app.get('/api/auth/me', authenticated, (req, res) => res.json({ user: req.user }))
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('sma_session', {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/',
  })
  return res.status(204).end()
})
app.post('/api/auth/forgot-password', (req, res) => res.status(503).json({
  error: 'Password recovery email is not configured for this workspace. Please contact the agency administrator.',
}))

app.put('/api/auth/profile', authenticated, asyncRoute(async (req, res) => {
  const name = text(req.body.name, 120)
  const email = text(req.body.email, 254).toLowerCase()
  if (!name || !emailIsValid(email)) return res.status(400).json({ error: 'Enter a name and a valid email address.' })
  const updated = await User.findOneAndUpdate({ id: req.user.id }, { $set: { name, email } }, { new: true })
  if (!updated) return res.status(404).json({ error: 'Account not found.' })
  if (updated.customer_id) await Customer.updateOne({ id: updated.customer_id }, { $set: { name, email } })
  return authResponse(res, updated)
}))

app.post('/api/auth/change-password', authenticated, asyncRoute(async (req, res) => {
  const currentPassword = req.body.currentPassword
  const newPassword = req.body.newPassword
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: 'Enter the current password and a new password of at least 8 characters.' })
  }
  const user = await User.findOne({ id: req.user.id })
  if (!user || !await bcrypt.compare(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' })
  }
  user.password_hash = await bcrypt.hash(newPassword, 12)
  await user.save()
  return res.json({ message: 'Password updated. Sign in again with your new password.' })
}))

app.get('/api/dashboard', authenticated, hasRole('admin'), asyncRoute(async (req, res) => {
  res.json(await buildDashboard())
}))

app.get('/api/customers', authenticated, asyncRoute(async (req, res) => {
  if (req.user.role === 'delivery') return res.status(403).json({ error: 'You do not have permission to view customers.' })
  const customers = req.user.role === 'customer'
    ? await Customer.find({ id: req.user.customerId }).sort({ name: 1 }).lean()
    : await Customer.find().sort({ name: 1 }).lean()
  if (!customers.length) return res.json([])
  const customerIds = customers.map((customer) => customer.id)
  const [orders, payments] = await Promise.all([
    Order.find({ customer_id: { $in: customerIds } }).select('customer_id total').lean(),
    Payment.find({ customer_id: { $in: customerIds } }).select('customer_id amount').lean(),
  ])
  const totals = new Map()
  for (const order of orders) totals.set(order.customer_id, { ...(totals.get(order.customer_id) || {}), total: (totals.get(order.customer_id)?.total || 0) + order.total })
  for (const payment of payments) totals.set(payment.customer_id, { ...(totals.get(payment.customer_id) || {}), paid: (totals.get(payment.customer_id)?.paid || 0) + payment.amount })
  res.json(customers.map((customer) => ({
    id: customer.id, name: customer.name, business: customer.business, type: customer.type,
    phone: customer.phone, email: customer.email, city: customer.city, status: customer.status,
    total: totals.get(customer.id)?.total || 0, paid: totals.get(customer.id)?.paid || 0,
  })))
}))

app.post('/api/customers', authenticated, hasRole('admin'), asyncRoute(async (req, res) => {
  const name = text(req.body.name, 120)
  const business = text(req.body.business, 160)
  const type = text(req.body.type || 'Medical Store', 60)
  const phone = text(req.body.phone, 30)
  const email = text(req.body.email, 254).toLowerCase()
  const city = text(req.body.city, 100)
  if (!name || !business || phone.length < 5 || (email && !emailIsValid(email))) {
    return res.status(400).json({ error: 'Enter a name, business, phone, and valid email when provided.' })
  }
  const customer = await Customer.create({ id: await nextId('customers'), name, business, type, phone, email, city })
  await reportEvent('customer_created', 0, customer.id)
  return res.status(201).json(customer.toObject())
}))

app.get('/api/suppliers', authenticated, hasRole('admin'), asyncRoute(async (req, res) => {
  res.json(await Supplier.find().sort({ name: 1 }).lean())
}))
app.post('/api/suppliers', authenticated, hasRole('admin'), asyncRoute(async (req, res) => {
  const supplier = {
    name: text(req.body.name, 160), contact: text(req.body.contact, 120),
    phone: text(req.body.phone, 30), email: text(req.body.email, 254).toLowerCase(), city: text(req.body.city, 100),
  }
  if (!supplier.name || supplier.phone.length < 5 || (supplier.email && !emailIsValid(supplier.email))) {
    return res.status(400).json({ error: 'Enter a supplier name, phone, and valid email when provided.' })
  }
  const created = await Supplier.create({ id: await nextId('suppliers'), ...supplier })
  await reportEvent('supplier_created', 0, created.id)
  return res.status(201).json(created.toObject())
}))

app.get('/api/products', authenticated, asyncRoute(async (req, res) => {
  if (req.user.role === 'delivery') return res.status(403).json({ error: 'You do not have permission to view products.' })
  const products = await Product.find({ active: true }).sort({ name: 1 }).lean()
  res.json(products.map((product) => ({
    ...product,
    available: product.stock - product.reserved,
    status: product.stock - product.reserved <= 0 ? 'Out of stock'
      : product.stock - product.reserved <= product.reorder_level ? 'Low stock' : 'In stock',
  })))
}))

app.post('/api/products', authenticated, hasRole('admin'), asyncRoute(async (req, res) => {
  const product = {
    name: text(req.body.name, 160), brand: text(req.body.brand, 120),
    category: text(req.body.category, 100), manufacturer: text(req.body.manufacturer, 160),
    price: Number(req.body.price), mrp: Number(req.body.mrp || 0), stock: Number(req.body.stock || 0),
    reorder_level: Number(req.body.reorder_level ?? 10), unit: text(req.body.unit || 'pack', 40),
  }
  if (!product.name || !product.unit || ![product.price, product.mrp, product.stock, product.reorder_level].every(Number.isFinite) ||
      product.price < 0 || product.mrp < 0 || product.stock < 0 || !Number.isInteger(product.stock) ||
      product.reorder_level < 0 || !Number.isInteger(product.reorder_level) || (product.mrp > 0 && product.price > product.mrp)) {
    return res.status(400).json({ error: 'Check the product name, prices, stock, and reorder level.' })
  }
  const created = await Product.create({ id: await nextId('products'), ...product })
  await reportEvent('medicine_created', 0, created.id)
  return res.status(201).json(created.toObject())
}))

app.get('/api/categories', authenticated, hasRole('admin'), asyncRoute(async (req, res) => {
  const products = await Product.find({ active: true }).select('category stock reserved reorder_level').lean()
  const categories = new Map()
  for (const product of products) {
    const key = product.category || 'Uncategorized'
    const record = categories.get(key) || { category: key, products: 0, stock: 0, low_stock: 0 }
    record.products += 1
    record.stock += product.stock
    if (product.stock - product.reserved <= product.reorder_level) record.low_stock += 1
    categories.set(key, record)
  }
  res.json([...categories.values()].sort((a, b) => a.category.localeCompare(b.category)))
}))

app.get('/api/orders', authenticated, asyncRoute(async (req, res) => {
  if (req.user.role === 'delivery') return res.status(403).json({ error: 'No delivery assignment is available for this account.' })
  const filter = req.user.role === 'customer' ? { customer_id: req.user.customerId } : {}
  const orders = await Order.find(filter).sort({ id: -1 }).lean()
  res.json(await formatOrders(orders))
}))

app.post('/api/orders', authenticated, hasRole('admin', 'customer'), asyncRoute(async (req, res) => {
  const requestedCustomer = Number(req.body.customerId)
  const customerId = req.user.role === 'customer' ? req.user.customerId : requestedCustomer
  const items = req.body.items
  if (!Number.isInteger(customerId) || customerId < 1 || !Array.isArray(items) || items.length < 1 || items.length > 50) {
    return res.status(400).json({ error: 'Select a customer and at least one product.' })
  }
  if (req.user.role === 'customer' && customerId !== req.user.customerId) {
    return res.status(403).json({ error: 'You can only place orders for your own account.' })
  }
  if (new Set(items.map((item) => Number(item.productId))).size !== items.length) {
    return res.status(400).json({ error: 'A product can only be listed once per order.' })
  }
  const customer = await Customer.findOne({ id: customerId }).lean()
  if (!customer) return res.status(400).json({ error: 'Select a valid customer.' })

  const reservedProducts = []
  const lines = []
  let total = 0
  try {
    for (const item of items) {
      const productId = Number(item.productId)
      const quantity = Number(item.quantity)
      if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
        throw new Error('Check the selected product and requested quantity.')
      }
      const product = await Product.findOne({ id: productId, active: true }).lean()
      if (!product) throw new Error('A selected product is no longer available.')
      const reserved = await Product.findOneAndUpdate({
        id: productId, active: true,
        $expr: { $gt: [{ $subtract: ['$stock', '$reserved'] }, 0] },
      }, [{
        $set: { reserved: { $add: ['$reserved', { $min: [quantity, { $subtract: ['$stock', '$reserved'] }] }] } },
      }], { new: true })
      if (!reserved) throw new Error(`${product.name} is out of stock.`)
      const confirmed = reserved.reserved - product.reserved
      reservedProducts.push({ id: productId, confirmed })
      lines.push({
        product_id: productId, name: product.name, requested_qty: quantity,
        confirmed_qty: confirmed, delivered_qty: 0, unit_price: product.price,
      })
      total += confirmed * product.price
    }
    const order = await Order.create({
      id: await nextId('orders'), customer_id: customerId, lines, total,
      status: 'pending', payment_status: 'unpaid',
    })
    await reportEvent('order_created', total, order.id)
    return res.status(201).json(order.toObject())
  } catch (error) {
    await Promise.all(reservedProducts.map(({ id, confirmed }) =>
      Product.updateOne({ id }, { $inc: { reserved: -confirmed } })))
    if (error instanceof Error && (error instanceof mongoose.Error || error.name === 'Error')) {
      return res.status(400).json({ error: error.message })
    }
    throw error
  }
}))

app.patch('/api/orders/:id/status', authenticated, hasRole('admin'), asyncRoute(async (req, res) => {
  const id = Number(req.params.id)
  const status = req.body.status
  if (!Number.isInteger(id) || id < 1 || !['preparing', 'dispatched', 'delivered', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Choose a supported order status.' })
  }
  const order = await Order.findOne({ id })
  if (!order) return res.status(404).json({ error: 'Order not found.' })
  if (['delivered', 'cancelled'].includes(order.status)) return res.status(409).json({ error: 'This order is already closed.' })
  if (order.status === 'pending' && !['preparing', 'cancelled'].includes(status) ||
      order.status === 'preparing' && !['dispatched', 'cancelled'].includes(status) ||
      order.status === 'dispatched' && !['delivered', 'cancelled'].includes(status)) {
    return res.status(409).json({ error: 'Move the order through its next fulfilment status.' })
  }
  const changedProducts = []
  try {
    for (const line of order.lines) {
      const amount = line.confirmed_qty - line.delivered_qty
      if (amount <= 0) continue
      if (status === 'cancelled') {
        const result = await Product.updateOne({ id: line.product_id, reserved: { $gte: amount } }, { $inc: { reserved: -amount } })
        if (!result.matchedCount) throw new Error('Could not release reserved product stock.')
        changedProducts.push({ id: line.product_id, stock: 0, reserved: amount })
      } else if (status === 'delivered') {
        const result = await Product.updateOne(
          { id: line.product_id, stock: { $gte: amount }, reserved: { $gte: amount } },
          { $inc: { stock: -amount, reserved: -amount } },
        )
        if (!result.matchedCount) throw new Error('Product stock changed before this delivery could be completed.')
        changedProducts.push({ id: line.product_id, stock: amount, reserved: amount })
        line.delivered_qty = line.confirmed_qty
      }
    }
    order.status = status
    await order.save()
  } catch (error) {
    for (const change of changedProducts) {
      await Product.updateOne({ id: change.id }, { $inc: { stock: change.stock, reserved: change.reserved } })
    }
    throw error
  }
  await reportEvent(`order_${status}`, order.total, order.id)
  return res.json({ id: order.id, status: order.status })
}))

app.get('/api/payments', authenticated, asyncRoute(async (req, res) => {
  if (req.user.role === 'delivery') return res.status(403).json({ error: 'You do not have permission to view payments.' })
  const filter = req.user.role === 'customer' ? { customer_id: req.user.customerId } : {}
  const payments = await Payment.find(filter).sort({ id: -1 }).lean()
  const customerIds = [...new Set(payments.map((payment) => payment.customer_id))]
  const customers = await Customer.find({ id: { $in: customerIds } }).select('id name').lean()
  const names = new Map(customers.map((customer) => [customer.id, customer.name]))
  res.json(payments.map((payment) => ({ ...payment, customer: names.get(payment.customer_id) || 'Unknown customer' })))
}))

app.post('/api/payments', authenticated, hasRole('admin'), asyncRoute(async (req, res) => {
  const customerId = Number(req.body.customerId)
  const orderId = req.body.orderId == null ? null : Number(req.body.orderId)
  const amount = Number(req.body.amount)
  const mode = text(req.body.mode, 40)
  const reference = text(req.body.reference, 100)
  if (!Number.isInteger(customerId) || customerId < 1 || !(amount > 0) || !Number.isFinite(amount) ||
      !mode || (orderId !== null && (!Number.isInteger(orderId) || orderId < 1))) {
    return res.status(400).json({ error: 'Check the payment details.' })
  }
  const customer = await Customer.findOne({ id: customerId }).lean()
  if (!customer) return res.status(400).json({ error: 'Select a valid customer.' })
  let order = null
  if (orderId) {
    order = await Order.findOne({ id: orderId, customer_id: customerId })
    if (!order) return res.status(400).json({ error: 'The selected order does not belong to this customer.' })
    const priorPayments = await Payment.find({ order_id: orderId }).select('amount').lean()
    const alreadyPaid = priorPayments.reduce((sum, payment) => sum + payment.amount, 0)
    if (amount > order.total - alreadyPaid + 0.0001) return res.status(400).json({ error: 'Payment exceeds the remaining order balance.' })
  }
  const payment = await Payment.create({
    id: await nextId('payments'), customer_id: customerId, order_id: orderId,
    amount, mode, reference,
  })
  if (order) {
    const previousPayments = await Payment.find({ order_id: orderId }).select('amount').lean()
    const paid = previousPayments.reduce((sum, entry) => sum + entry.amount, 0)
    order.payment_status = paid >= order.total ? 'paid' : 'partial'
    await order.save()
  }
  await reportEvent('payment_received', amount, payment.id)
  return res.status(201).json(payment.toObject())
}))

app.get('/api/notifications', authenticated, asyncRoute(async (req, res) => {
  const notifications = []
  if (req.user.role === 'admin') {
    const products = await Product.find({ active: true }).select('id name stock reserved reorder_level').lean()
    for (const product of products.filter((item) => item.stock - item.reserved <= item.reorder_level)) {
      const available = product.stock - product.reserved
      notifications.push({
        id: `stock-${product.id}`, title: available <= 0 ? 'Product out of stock' : 'Low stock alert',
        message: `${product.name}: ${available} ${available === 1 ? 'unit' : 'units'} available.`,
        created_at: new Date().toISOString(), type: 'Inventory',
      })
    }
  }
  const orderFilter = req.user.role === 'customer' ? { customer_id: req.user.customerId } : {}
  const orders = await Order.find(orderFilter).sort({ id: -1 }).limit(20).lean()
  for (const order of orders) {
    notifications.push({
      id: `order-${order.id}-${order.status}`,
      title: req.user.role === 'customer' ? 'Order update' : 'Order activity',
      message: `SMA-${String(order.id).padStart(5, '0')} is ${order.status.replaceAll('_', ' ')}.`,
      created_at: order.order_date, type: 'Order',
    })
  }
  const customerIds = req.user.role === 'customer' ? [req.user.customerId] : null
  const orderList = await Order.find(customerIds ? { customer_id: { $in: customerIds } } : {}).lean()
  const orderIds = orderList.map((order) => order.id)
  const payments = await Payment.find({ order_id: { $in: orderIds } }).select('order_id amount').lean()
  const paidByOrder = new Map()
  for (const payment of payments) paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) || 0) + payment.amount)
  const customerMap = new Map()
  if (req.user.role === 'admin') {
    const customers = await Customer.find({ id: { $in: orderList.map((order) => order.customer_id) } }).select('id name').lean()
    for (const customer of customers) customerMap.set(customer.id, customer.name)
  }
  for (const order of orderList.filter((item) => item.total > (paidByOrder.get(item.id) || 0)).slice(-20)) {
    const customer = customerMap.get(order.customer_id) || ''
    notifications.push({
      id: `pending-payment-${order.id}-${order.payment_status}`, title: 'Pending payment',
      message: `${req.user.role === 'customer' ? 'Order ' : `${customer} · order `}SMA-${String(order.id).padStart(5, '0')} has ${(order.total - (paidByOrder.get(order.id) || 0)).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} outstanding.`,
      created_at: order.order_date, type: 'Payment',
    })
  }
  if (req.user.role === 'admin') {
    const recentPayments = await Payment.find().sort({ id: -1 }).limit(8).lean()
    const customers = await Customer.find({ id: { $in: recentPayments.map((payment) => payment.customer_id) } }).select('id name').lean()
    const names = new Map(customers.map((customer) => [customer.id, customer.name]))
    for (const payment of recentPayments) notifications.push({
      id: `payment-${payment.id}`, title: 'Payment received',
      message: `${names.get(payment.customer_id) || 'Customer'} paid ₹${Number(payment.amount).toLocaleString('en-IN')} via ${payment.mode}.`,
      created_at: payment.paid_at, type: 'Payment',
    })
  }
  return res.json(notifications.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))))
}))

app.get('/api/reports/summary', authenticated, hasRole('admin'), asyncRoute(async (req, res) => {
  const response = await fetch(`${reportsUrl}/summary`, {
    headers: { 'X-Reports-Token': reportsToken },
    signal: AbortSignal.timeout(2000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) return res.status(503).json({ error: result.error || 'The Python reporting service is unavailable.' })
  return res.json(result)
}))

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error?.code === 11000) return res.status(409).json({ error: 'An account or record with that value already exists.' })
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return res.status(400).json({ error: error.message })
  }
  console.error(error)
  return res.status(500).json({ error: 'The request could not be completed.' })
})

async function start() {
  await mongoose.connect(process.env.MONGODB_URI)
  await migrateLegacyUsers()
  app.listen(port, '127.0.0.1', () => console.log(`SMA API listening at http://127.0.0.1:${port}`))
}

async function migrateLegacyUsers() {
  const users = mongoose.connection.collection('users')
  const records = await users.find({}, {
    projection: { id: 1, password_hash: 1, passwordHash: 1, customer_id: 1, customerId: 1 },
  }).toArray()
  const highestId = records.reduce((highest, user) =>
    Number.isInteger(user.id) ? Math.max(highest, user.id) : highest, 0)
  if (highestId) await Counter.updateOne({ _id: 'users' }, { $max: { value: highestId } }, { upsert: true })

  let migrated = 0
  for (const user of records) {
    const update = {}
    if (!Number.isInteger(user.id)) update.id = await nextId('users')
    const hasLegacyPassword = typeof user.passwordHash === 'string'
    if (typeof user.password_hash !== 'string' && hasLegacyPassword) update.password_hash = user.passwordHash
    if (!Number.isInteger(user.customer_id) && Number.isInteger(user.customerId)) {
      update.customer_id = user.customerId
    }
    if (Object.keys(update).length || hasLegacyPassword) {
      const changes = { $set: update }
      if (hasLegacyPassword) changes.$unset = { passwordHash: '' }
      await users.updateOne({ _id: user._id }, changes)
      migrated += 1
    }
  }
  if (migrated) console.log(`Migrated ${migrated} existing account record(s) without changing passwords.`)
}

start().catch((error) => {
  console.error('Unable to start the SMA API:', error.message)
  process.exitCode = 1
})
