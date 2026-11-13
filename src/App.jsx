import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Truck,
  Users,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import "./App.css";
const navigation = [
  { title: "Overview", items: [{ label: "Dashboard", icon: LayoutDashboard }] },
  { title: "Business", items: [
    { label: "Customers", icon: Users },
    { label: "Suppliers", icon: Building2 },
    { label: "Medicines", icon: Package },
    { label: "Categories", icon: FileText },
    { label: "Inventory", icon: Boxes },
    { label: "Warehouse / Godown", icon: Building2 },
    { label: "Purchases", icon: ShoppingBag },
    { label: "Orders", icon: ClipboardList },
    { label: "Sales", icon: CircleDollarSign },
    { label: "Deliveries", icon: Truck }
  ] },
  { title: "Finance & tools", items: [
    { label: "Invoices", icon: FileText },
    { label: "Payments", icon: CreditCard },
    { label: "Outstanding", icon: CircleDollarSign },
    { label: "Returns", icon: ArrowDownToLine },
    { label: "Notifications", icon: Bell },
    { label: "Reports", icon: FileBarChart },
    { label: "Users & access", icon: ShieldCheck },
    { label: "Settings", icon: Settings }
  ] }
];
const titles = {
  Dashboard: { heading: "Business overview", subheading: "Here\u2019s what\u2019s happening with your agency today." },
  Customers: { heading: "Customers", subheading: "Manage healthcare businesses and customer accounts." },
  Suppliers: { heading: "Suppliers", subheading: "Keep supplier contacts and purchase partners organized." },
  Medicines: { heading: "Medicines & products", subheading: "Manage your catalogue, pricing, and reorder levels." },
  Categories: { heading: "Product categories", subheading: "Review categories derived from your medicine catalogue." },
  Inventory: { heading: "Inventory", subheading: "Monitor on-hand stock, reservations, and low-stock products." },
  "Warehouse / Godown": { heading: "Warehouse & godown", subheading: "Review available, reserved, and on-hand warehouse stock." },
  Orders: { heading: "Orders", subheading: "Review customer requests and fulfilment progress." },
  Payments: { heading: "Payments", subheading: "Record customer receipts and follow payment history." },
  Deliveries: { heading: "Deliveries", subheading: "Track orders awaiting dispatch or completion." },
  Purchases: { heading: "Purchases", subheading: "Purchasing workflows are part of the next rollout." },
  Sales: { heading: "Sales", subheading: "Sales are calculated from recorded customer orders." },
  Invoices: { heading: "Invoices", subheading: "Invoice generation is part of the next rollout." },
  Outstanding: { heading: "Outstanding balances", subheading: "Balances are calculated from orders less recorded payments." },
  Returns: { heading: "Returns", subheading: "Returns processing is part of the next rollout." },
  Notifications: { heading: "Notifications", subheading: "Live reminders for stock levels, orders, and recent payments." },
  Reports: { heading: "Reports & analytics", subheading: "Review live totals from your operational records." },
  "Users & access": { heading: "Users & access", subheading: "Role-based access is enabled for admin and customer accounts." },
  Settings: { heading: "Settings", subheading: "Agency profile and application preferences." }
};
const currency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
const prettyDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "\u2014";
const requestDate = /* @__PURE__ */ new Date();
const defaultPreferences = { theme: "light", browserNotifications: false, inAppNotifications: true, sound: true };
function loadPreferences() {
  try {
    return { ...defaultPreferences, ...JSON.parse(localStorage.getItem("sma-preferences") || "{}") };
  } catch {
    return defaultPreferences;
  }
}
const request = async (path, token, options = {}) => {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...token ? { Authorization: `Bearer ${token}` } : {}, ...options.headers }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to complete the request.");
  return payload;
};
function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [page, setPage] = useState("Dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [preferences, setPreferences] = useState(loadPreferences);
  const [notice, setNotice] = useState("");
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const token = "";
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);
  const savePreferences = (next) => {
    setPreferences(next);
    localStorage.setItem("sma-preferences", JSON.stringify(next));
  };
  useEffect(() => {
    const initialize = async () => {
      try {
        const statusResponse = await fetch("/api/status");
        if (!statusResponse.ok) throw new Error("Could not read application status.");
        const status = await statusResponse.json();
        setSetupRequired(status.setupRequired);
      } catch {
        setError("Cannot connect to the SMA API. Start the application with npm run dev.");
      }
      try {
        const { user: current } = await request("/auth/me", "");
        setUser(current);
        setAuthenticated(true);
        setPage(current.role === "customer" ? "Medicines" : current.role === "delivery" ? "Deliveries" : "Dashboard");
      } catch {
        setAuthenticated(false);
      } finally {
        setAuthReady(true);
      }
    };
    void initialize();
  }, []);
  const onAuthenticated = (nextUser) => {
    setUser(nextUser);
    setAuthenticated(true);
    if (!nextUser.testing) setSetupRequired(false);
    setPage(nextUser.role === "customer" ? "Medicines" : nextUser.role === "delivery" ? "Deliveries" : "Dashboard");
  };
  const signOut = async () => {
    try {
      await request("/auth/logout", "", { method: "POST" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign out cleanly.");
      return;
    }
    setAuthenticated(false);
    setUser(null);
    setLogoutConfirm(false);
  };
  const requestLogout = () => setLogoutConfirm(true);
  if (!authReady) return <div className="auth-page"><div className="auth-brand"><div className="brand-mark"><Activity size={22} strokeWidth={2.5} /></div><div className="brand-copy"><strong>Srinivasa</strong><span>MEDICAL AGENCIES</span></div></div><div className="chart-empty">Loading secure workspace…</div></div>;
  if (!authenticated || !user) return <AuthScreen setupRequired={setupRequired} error={error} onAuthenticated={onAuthenticated} />;
  const allowedNavigation = user.role === "admin" ? navigation : user.role === "delivery" ? [{ title: "Delivery staff", items: [{ label: "Deliveries", icon: Truck }, { label: "Settings", icon: Settings }] }] : [{ title: "My account", items: [{ label: "Medicines", icon: Package }, { label: "Orders", icon: ClipboardList }, { label: "Invoices", icon: FileText }, { label: "Payments", icon: CreditCard }, { label: "Settings", icon: Settings }] }];
  const currentTitle = titles[page] || titles.Dashboard;
  return <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`} data-theme={preferences.theme}>
      {user.testing && <div className="test-mode-banner"><ShieldCheck size={14} /><strong>TEST MODE</strong><span>Changes stay in isolated sample data.</span><button onClick={requestLogout}>Exit testing mode <X size={13} /></button></div>}
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={21} strokeWidth={2.5} /></div>
          {!collapsed && <div className="brand-copy"><strong>Srinivasa</strong><span>MEDICAL AGENCIES</span></div>}
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileMenu(false)}><X size={18} /></button>
        </div>
        <div className="agency-label">{!collapsed && "WORKSPACE"}</div>
        <nav className="side-nav">
          {allowedNavigation.map((group) => <section className="nav-group" key={group.title}>
              {!collapsed && <div className="nav-heading">{group.title}</div>}
              {group.items.map(({ label, icon: Icon }) => <button key={label} title={collapsed ? label : void 0} className={`nav-link ${page === label ? "active" : ""}`} onClick={() => {
    setPage(label);
    setMobileMenu(false);
    setError("");
  }}>
                  <Icon size={18} strokeWidth={1.8} /><span>{!collapsed && label}</span>{!collapsed && page === label && <span className="active-dot" />}
                </button>)}
            </section>)}
        </nav>
        {!collapsed && <div className="sidebar-bottom"><div className="plan-badge"><div className="plan-icon"><ShieldCheck size={17} /></div><div><strong>Business workspace</strong><span>Local database connected</span></div><ChevronRight size={15} /></div></div>}
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button desktop-toggle" aria-label="Toggle sidebar" onClick={() => setCollapsed(!collapsed)}><ChevronLeft className={collapsed ? "toggle-flipped" : ""} size={19} /></button>
            <button className="icon-button mobile-toggle" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={20} /></button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{page}</strong></div>
          </div>
          <div className="topbar-right">
            <div className="date-chip"><CalendarDays size={15} /><span>{requestDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span></div>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setPage("Notifications")}><Bell size={18} /><i /></button>
            <div className="top-divider" />
            <div className="profile-menu"><div className="avatar">{user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div><div className="profile-copy"><strong>{user.name}</strong><span>{user.testing ? "Test account" : user.role === "admin" ? "Administrator" : user.role}</span></div><button className="icon-button logout-button" title="Sign out" onClick={requestLogout}><LogOut size={17} /></button></div>
          </div>
        </header>

        <main className="page-content">
          <div className="page-heading"><div><div className="eyebrow">SRINIVASA MEDICAL AGENCIES</div><h1>{currentTitle.heading}</h1><p>{currentTitle.subheading}</p></div><div className="heading-date"><span>Today</span><strong>{requestDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong></div></div>
          {error && <div className="toast-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={15} /></button></div>}
          {notice && preferences.inAppNotifications && <div className="in-app-notice" role="status"><Bell size={16} /><div><strong>New activity</strong><span>{notice}</span></div><button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={15} /></button></div>}
          {page === "Dashboard" && <DashboardPage token={token} reload={reload} onNavigate={setPage} />}
          {["Customers", "Suppliers", "Medicines", "Categories", "Inventory", "Warehouse / Godown", "Orders", "Payments", "Deliveries", "Invoices", "Outstanding", "Sales", "Reports", "Notifications"].includes(page) && <DataPage key={page} page={page} token={token} user={user} reload={reload} onChanged={() => setReload((n) => n + 1)} onError={setError} />}
          {["Purchases", "Returns"].includes(page) && <ComingSoonPage page={page} />}
          {page === "Users & access" && <AccessPage />}
          {page === "Settings" && <SettingsPage user={user} preferences={preferences} savePreferences={savePreferences} onLogout={requestLogout} onSessionExpired={signOut} onProfileUpdated={setUser} />}
        </main>
      </div>
      <NotificationWatcher enabled={authenticated} preferences={preferences} onNewNotification={setNotice} onError={setError} />
      {logoutConfirm && <div className="modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) setLogoutConfirm(false);
  }}><section className="confirm-card" role="dialog" aria-modal="true" aria-labelledby="logout-title"><div className="settings-section-icon warning-icon"><LogOut size={18} /></div><h2 id="logout-title">Are you sure you want to log out?</h2><p>Your session will end and you will return to the login page.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setLogoutConfirm(false)}>Cancel</button><button className="primary-button" onClick={() => void signOut()}>Yes, Logout</button></div></section></div>}
    </div>;
}
function AuthScreen({ setupRequired, error, onAuthenticated }) {
  const [isRegister, setIsRegister] = useState(false);
  const [isAdminRegister, setIsAdminRegister] = useState(false);
  const [role, setRole] = useState("user");
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const path = setupRequired ? "/auth/setup" : isAdminRegister ? "/auth/admin-register" : isRegister ? "/auth/register" : "/auth/login";
      const result = await request(path, "", { method: "POST", body: JSON.stringify({ name, business, phone, email, password, identifier: email, role, inviteCode }) });
      onAuthenticated(result.user);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  };
  const forgotPassword = async () => {
    try {
      await request("/auth/forgot-password", "", { method: "POST", body: JSON.stringify({ identifier: email }) });
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Password recovery is unavailable.");
    }
  };
  return <div className="auth-page">
      <div className="auth-brand"><div className="brand-mark"><Activity size={22} strokeWidth={2.5} /></div><div className="brand-copy"><strong>Srinivasa</strong><span>MEDICAL AGENCIES</span></div></div>
      <div className="auth-card">
        <div className="auth-icon"><ShieldCheck size={22} /></div>
        <div className="eyebrow">{setupRequired ? "FIRST-TIME SETUP" : "SECURE WORKSPACE"}</div>
        <h1>{setupRequired || isAdminRegister ? "Create your admin account" : isRegister ? "Create customer account" : "Welcome back"}</h1>
        <p>{setupRequired ? "Set up the administrator account for this local business workspace." : isAdminRegister ? "Create an administrator account with an invite code from your agency." : isRegister ? "Register to view your orders and account details." : role === "user" ? "Administrator access for managing agency operations and inventory." : "Sign in to browse products and track your orders."}</p>
        {!setupRequired && !isRegister && !isAdminRegister && <div className="role-picker" aria-label="Choose login type">
          <button type="button" className={role === "user" ? "selected" : ""} onClick={() => {
    setRole("user");
    setFormError("");
  }}><ShieldCheck size={18} /><span><strong>Admin Login</strong><small>Agency administrator</small></span></button>
          <button type="button" className={role === "customer" ? "selected" : ""} onClick={() => {
    setRole("customer");
    setFormError("");
  }}><Users size={18} /><span><strong>Customer Login</strong><small>Medical stores, clinics and hospitals</small></span></button>
        </div>}
        {error && <div className="form-error">{error}</div>}
        {formError && <div className="form-error">{formError}</div>}
        <form onSubmit={submit} className="auth-form">
          {(setupRequired || isRegister || isAdminRegister) && <label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" /></label>}
          {isRegister && !setupRequired && <label>Business name<input required value={business} onChange={(event) => setBusiness(event.target.value)} placeholder="Clinic or medical store" /></label>}
          {isRegister && !setupRequired && <label>Mobile number<input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Registered contact number" autoComplete="tel" /></label>}
          <label>{role === "customer" && !isRegister && !setupRequired ? "Registered email or mobile number" : role === "user" && !setupRequired && !isRegister && !isAdminRegister ? "Admin email or username" : "Email address"}<input required type={role === "customer" && !isRegister && !setupRequired || role === "user" && !isRegister && !isAdminRegister && !setupRequired ? "text" : "email"} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={role === "customer" && !isRegister && !setupRequired ? "Email or registered mobile" : role === "user" && !setupRequired && !isRegister && !isAdminRegister ? "Administrator email or username" : "you@business.com"} autoComplete="username" /></label>
          {isAdminRegister && <label>Administrator invite code<input required type="password" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Enter your invite code" autoComplete="off" /></label>}
          <label>Password<input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={isRegister || isAdminRegister || setupRequired ? "new-password" : "current-password"} /></label>
          <button className="primary-button auth-submit" disabled={submitting}>{submitting ? "Please wait\u2026" : setupRequired || isAdminRegister ? "Create admin account" : isRegister ? "Create account" : "Sign in"}<ArrowUpRight size={16} /></button>
        </form>
        {!setupRequired && !isRegister && !isAdminRegister && <button className="text-button forgot-link" onClick={() => void forgotPassword()}>Forgot password?</button>}
        {!setupRequired && role === "user" && !isRegister && <button className="text-button auth-switch" onClick={() => {
    setIsAdminRegister(!isAdminRegister);
    setFormError("");
  }}>{isAdminRegister ? "Already have an admin account? Sign in" : "Create admin account"}</button>}
        {!setupRequired && role === "customer" && !isAdminRegister && <button className="text-button auth-switch" onClick={() => {
    setIsRegister(!isRegister);
    setFormError("");
  }}>{isRegister ? "Already have an account? Sign in" : "New customer? Create an account"}</button>}
        <div className="auth-footnote"><ShieldCheck size={14} /> Your business data stays in your local database.</div>
      </div>
      <footer className="auth-footer">Srinivasa Medical Agencies <span>•</span> Miyapur, Telangana</footer>
    </div>;
}
function DashboardPage({ token, reload, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    request("/dashboard", token).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load dashboard."));
  }, [token, reload]);
  const metrics = data ? [
    { label: "Total customers", value: data.customers.toLocaleString("en-IN"), icon: Users, tone: "green", change: "Active accounts", page: "Customers" },
    { label: "Total products", value: data.products.toLocaleString("en-IN"), icon: Package, tone: "blue", change: "In catalogue", page: "Medicines" },
    { label: "Orders today", value: data.todayOrders.toLocaleString("en-IN"), icon: ClipboardList, tone: "violet", change: `${data.orders} all time`, page: "Orders" },
    { label: "Sales this month", value: currency(data.sales), icon: CircleDollarSign, tone: "amber", change: `${currency(data.todaySales)} today`, page: "Sales" },
    { label: "Stock value", value: currency(data.stockValue), icon: Boxes, tone: "teal", change: "At selling price \xB7 estimate", page: "Inventory" },
    { label: "Low stock items", value: data.lowStock.toLocaleString("en-IN"), icon: AlertTriangle, tone: "rose", change: "Need attention", page: "Inventory" },
    { label: "Pending deliveries", value: data.pendingDeliveries.toLocaleString("en-IN"), icon: Truck, tone: "blue", change: "Open orders", page: "Deliveries" },
    { label: "Outstanding", value: currency(data.outstanding), icon: CreditCard, tone: "amber", change: "Customer balances", page: "Outstanding" }
  ] : [];
  return <>
      {error && <div className="inline-error">{error}</div>}
      <section className="metric-grid">
        {metrics.map(({ label, value, icon: Icon, tone, change, page }) => <button key={label} className="metric-card" onClick={() => onNavigate(page)}><div className={`metric-icon ${tone}`}><Icon size={19} /></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">{change}<ArrowUpRight size={14} /></div></button>)}
      </section>
      <section className="dashboard-grid">
        <div className="panel sales-panel"><div className="panel-header"><div><h2>Sales overview</h2><p>Order value over the last 7 days</p></div><span className="live-tag"><i /> Live data</span></div>
          {data ? <SalesChart data={data.salesTrend} /> : <div className="chart-empty">Loading sales data…</div>}
        </div>
        <div className="panel inventory-panel"><div className="panel-header"><div><h2>Inventory health</h2><p>A quick view of your product catalogue</p></div><button className="subtle-link" onClick={() => onNavigate("Inventory")}>View stock <ChevronRight size={14} /></button></div>
          <div className="inventory-health">{[
    { label: "Suppliers", value: data?.suppliers ?? "\u2014", color: "green", icon: Building2 },
    { label: "Products needing reorder", value: data?.lowStock ?? "\u2014", color: "orange", icon: AlertTriangle },
    { label: "Orders in progress", value: data?.pendingDeliveries ?? "\u2014", color: "blue", icon: Truck }
  ].map(({ label, value, color, icon: Icon }) => <button key={label} onClick={() => onNavigate(label === "Suppliers" ? "Suppliers" : label.startsWith("Orders") ? "Deliveries" : "Inventory")} className="health-row"><div className={`health-icon ${color}`}><Icon size={17} /></div><span>{label}</span><strong>{value}</strong><ChevronRight size={15} /></button>)}</div>
          <div className="quick-actions"><div className="quick-label">QUICK ACTIONS</div><div className="quick-buttons"><button onClick={() => onNavigate("Customers")}><Plus size={15} /> Customer</button><button onClick={() => onNavigate("Medicines")}><Plus size={15} /> Product</button><button onClick={() => onNavigate("Orders")}><Plus size={15} /> Order</button></div></div>
        </div>
      </section>
      <section className="panel recent-panel"><div className="panel-header"><div><h2>Recent orders</h2><p>Latest customer activity</p></div><button className="subtle-link" onClick={() => onNavigate("Orders")}>All orders <ChevronRight size={14} /></button></div>
        <OrdersTable orders={data?.recentOrders || []} onOpen={() => onNavigate("Orders")} />
      </section>
      <div className="dashboard-note"><ShieldCheck size={15} /> All figures are calculated from your local business database.</div>
    </>;
}
function OrdersTable({ orders, onOpen }) {
  return <div className="table-scroll"><table><thead><tr><th>ORDER ID</th><th>CUSTOMER</th><th>ORDER DATE</th><th>AMOUNT</th><th>PAYMENT</th><th>STATUS</th><th /></tr></thead><tbody>
    {orders.length ? orders.map((order) => <tr key={order.id} onClick={onOpen} className="clickable-row"><td><strong className="order-id">SMA-{String(order.id).padStart(5, "0")}</strong></td><td>{order.customer}</td><td>{prettyDate(order.order_date)}</td><td><strong>{currency(order.total)}</strong></td><td><StatusBadge value={order.payment_status} /></td><td><StatusBadge value={order.status} /></td><td><ChevronRight size={16} className="row-chevron" /></td></tr>) : <EmptyRow colSpan={7} text="No orders yet. Orders will appear here when created." />}
  </tbody></table></div>;
}
function SalesChart({ data }) {
  const max = Math.max(1, ...data.map((point) => point.sales));
  const coords = data.map((point, index) => ({
    x: 34 + index * (572 / Math.max(1, data.length - 1)),
    y: 170 - point.sales / max * 122,
    ...point
  }));
  const line = coords.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `${coords.length ? `34,170 ${line} 606,170` : ""}`;
  return <div className="chart-wrap"><svg viewBox="0 0 640 214" role="img" aria-label="Sales over the last seven days" preserveAspectRatio="none">
    <defs><linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#27865f" stopOpacity=".19" /><stop offset="100%" stopColor="#27865f" stopOpacity="0" /></linearGradient></defs>
    {[48, 88, 128, 170].map((y) => <line key={y} x1="30" x2="610" y1={y} y2={y} stroke="#edf1ee" strokeWidth="1" />)}
    <polygon points={area} fill="url(#sales-fill)" />
    {coords.length > 1 && <polyline points={line} fill="none" stroke="#27865f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
    {coords.map((point) => <g key={point.day}><circle cx={point.x} cy={point.y} r="3.3" fill="#27865f" stroke="white" strokeWidth="2" /><text x={point.x} y="199" textAnchor="middle" fill="#8b9690" fontSize="10">{point.day}</text></g>)}
  </svg></div>;
}
function DataPage({ page, token, user, reload, onChanged, onError }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sqlSummary, setSqlSummary] = useState(null);
  const [sqlReportError, setSqlReportError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderCustomer, setOrderCustomer] = useState("");
  const [orderProduct, setOrderProduct] = useState("");
  const [orderQty, setOrderQty] = useState("1");
  const [paymentCustomer, setPaymentCustomer] = useState("");
  const [paymentOrder, setPaymentOrder] = useState("");
  const resourcePath = useMemo(() => ({
    Customers: "/customers",
    Suppliers: "/suppliers",
    Medicines: "/products",
    Categories: "/categories",
    Inventory: "/products",
    "Warehouse / Godown": "/products",
    Orders: "/orders",
    Deliveries: "/orders",
    Payments: "/payments",
    Invoices: "/orders",
    Outstanding: "/orders",
    Sales: "/orders",
    Reports: "/dashboard",
    Notifications: "/notifications"
  })[page] || "/dashboard", [page]);
  const refresh = useCallback(async () => {
    try {
      const result = await request(resourcePath, token);
      if (Array.isArray(result)) setRows(result);
      else {
        const report = result;
        setSummary(report);
        const values = page === "Reports" ? report.recentOrders : [];
        setRows(values);
      }
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Could not load records.");
    }
  }, [onError, page, resourcePath, token]);
  useEffect(() => {
    void refresh();
  }, [refresh, reload]);
  useEffect(() => {
    if (!["Orders", "Payments"].includes(page)) return;
    Promise.all([request("/customers", token), request("/products", token), request("/orders", token)]).then(([customerRows, productRows, orderRows]) => {
      setCustomers(customerRows);
      setProducts(productRows);
      setOrders(orderRows);
    }).catch((reason) => onError(reason instanceof Error ? reason.message : "Could not load form data."));
  }, [page, token, onError]);
  useEffect(() => {
    if (page !== "Reports" || user.role !== "admin") return;
    let active = true;
    request("/reports/summary", token).then((result) => {
      if (active) {
        setSqlSummary(result);
        setSqlReportError("");
      }
    }).catch((reason) => {
      if (active) setSqlReportError(reason instanceof Error ? reason.message : "Could not load SQL reporting data.");
    });
    return () => {
      active = false;
    };
  }, [page, reload, token, user.role]);
  const isCustomer = page === "Customers";
  const isSupplier = page === "Suppliers";
  const isProduct = ["Medicines", "Inventory", "Warehouse / Godown"].includes(page);
  const isOrder = ["Orders", "Deliveries"].includes(page);
  const isPayment = page === "Payments";
  const canCreate = user.role === "admin" && ["Customers", "Suppliers", "Medicines", "Inventory", "Orders", "Payments"].includes(page) || user.role === "customer" && page === "Orders";
  const filteredRows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    const form = new FormData(event.currentTarget);
    let path = resourcePath;
    let body = {};
    if (isCustomer) body = Object.fromEntries(["name", "business", "type", "phone", "email", "city"].map((key) => [key, String(form.get(key) || "")]));
    else if (isSupplier) body = Object.fromEntries(["name", "contact", "phone", "email", "city"].map((key) => [key, String(form.get(key) || "")]));
    else if (isProduct) body = Object.fromEntries(["name", "brand", "category", "manufacturer", "price", "mrp", "stock", "reorder_level", "unit"].map((key) => [key, ["price", "mrp", "stock", "reorder_level"].includes(key) ? Number(form.get(key)) : String(form.get(key) || "")]));
    else if (isOrder) {
      path = "/orders";
      body = { customerId: Number(orderCustomer), items: [{ productId: Number(orderProduct), quantity: Number(orderQty) }] };
    } else if (isPayment) {
      path = "/payments";
      body = { customerId: Number(paymentCustomer), orderId: paymentOrder ? Number(paymentOrder) : null, amount: Number(form.get("amount")), mode: String(form.get("mode")), reference: String(form.get("reference") || "") };
    }
    try {
      await request(path, token, { method: "POST", body: JSON.stringify(body) });
      setModal(false);
      onChanged();
      void refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Could not save this record.");
    } finally {
      setBusy(false);
    }
  };
  const action = async (orderId, status) => {
    try {
      await request(`/orders/${orderId}/status`, token, { method: "PATCH", body: JSON.stringify({ status }) });
      onChanged();
      void refresh();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Could not update order.");
    }
  };
  const columns = page === "Categories" ? [["category", "Category"], ["products", "Products"], ["stock", "On hand"], ["low_stock", "Low stock"]] : page === "Notifications" ? [["title", "Notification"], ["message", "Details"], ["created_at", "Date"], ["type", "Type"]] : isCustomer ? [["name", "Customer"], ["business", "Business"], ["type", "Type"], ["phone", "Phone"], ["email", "Email"], ["city", "City"], ["status", "Status"]] : isSupplier ? [["name", "Supplier"], ["contact", "Contact"], ["phone", "Phone"], ["email", "Email"], ["city", "City"]] : isProduct ? [["name", "Product"], ["brand", "Brand"], ["category", "Category"], ["stock", "On hand"], ["reserved", "Reserved"], ["available", "Available"], ["price", "Unit price"], ["status", "Stock status"]] : isPayment ? [["customer", "Customer"], ["amount", "Amount"], ["mode", "Mode"], ["reference", "Reference"], ["paid_at", "Date"]] : isOrder ? [["id", "Order ID"], ["customer", "Customer"], ["order_date", "Order date"], ["requested_qty", "Requested"], ["confirmed_qty", "Confirmed"], ["delivered_qty", "Delivered"], ["pending_qty", "Pending"], ["total", "Amount"], ["payment_status", "Payment"], ["status", "Order status"]] : [["id", "Order ID"], ["customer", "Customer"], ["order_date", "Order date"], ["items", "Items"], ["total", "Amount"], ["payment_status", "Payment"], ["status", "Order status"]];
  const visibleRows = page === "Outstanding" ? filteredRows.filter((row) => Number(row.total) > Number(row.paid || 0)) : page === "Deliveries" ? filteredRows.filter((row) => !["delivered", "cancelled"].includes(String(row.status))) : page === "Invoices" ? filteredRows : filteredRows;
  return <>
      {page === "Reports" && <><div className="report-cards"><div className="report-card"><AlertTriangle size={19} /><span>Products at or below reorder level</span><strong>{summary?.lowStock ?? "\u2014"}</strong></div><div className="report-card"><CreditCard size={19} /><span>Outstanding customer amount</span><strong>{currency(summary?.outstanding || 0)}</strong></div><div className="report-card"><CircleDollarSign size={19} /><span>Recorded order sales this month</span><strong>{currency(summary?.sales || 0)}</strong></div><div className="report-card"><FileBarChart size={19} /><span>Python + SQL events recorded</span><strong>{sqlSummary?.events ?? "\u2014"}</strong></div></div>{sqlReportError && <div className="inline-error">{sqlReportError}</div>}</>}
      <section className="panel data-panel">
        <div className="data-toolbar"><div className="toolbar-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${page.toLowerCase()}\u2026`} /></div><div className="toolbar-actions"><span className="record-count">{visibleRows.length} records</span>{canCreate && <button className="primary-button" onClick={() => {
    setFormError("");
    setModal(true);
  }}><Plus size={16} />{isOrder ? "Create order" : isPayment ? "Record payment" : `Add ${isCustomer ? "customer" : isSupplier ? "supplier" : "product"}`}</button>}</div></div>
        <div className="table-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key}>{label.toUpperCase()}</th>)}{isOrder && <th>ACTIONS</th>}</tr></thead><tbody>
          {visibleRows.length ? visibleRows.map((row, index) => <tr key={String(row.id || index)}>{columns.map(([key]) => <td key={key}>{renderCell(key, row)}</td>)}{isOrder && <td><div className="row-actions">{row.status !== "delivered" && row.status !== "cancelled" && <button className="mini-action" onClick={() => void action(Number(row.id), row.status === "pending" ? "preparing" : row.status === "preparing" ? "dispatched" : "delivered")}>{row.status === "pending" ? "Prepare" : row.status === "preparing" ? "Dispatch" : "Mark delivered"}</button>}</div></td>}</tr>) : <EmptyRow colSpan={columns.length + (isOrder ? 1 : 0)} text={`No ${page.toLowerCase()} found. Add your first record to get started.`} />}
        </tbody></table></div>
        <div className="table-footer"><span>Showing {visibleRows.length ? 1 : 0}–{visibleRows.length} of {visibleRows.length} results</span><div className="pagination"><button disabled aria-label="Previous page"><ChevronLeft size={15} /></button><button className="page-number">1</button><button disabled aria-label="Next page"><ChevronRight size={15} /></button></div></div>
      </section>
      {modal && <div className="modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) setModal(false);
  }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><div className="eyebrow">NEW RECORD</div><h2 id="modal-title">{isCustomer ? "Add customer" : isSupplier ? "Add supplier" : isProduct ? "Add medicine / product" : isOrder ? "Create customer order" : "Record payment"}</h2></div><button className="icon-button" onClick={() => setModal(false)} aria-label="Close"><X size={18} /></button></div>
        <form className="modal-form" onSubmit={submit}>
          {isCustomer && <><label>Customer / contact name<input name="name" required /></label><label>Business name<input name="business" required /></label><div className="form-grid"><label>Customer type<select name="type"><option>Medical Store</option><option>Clinic</option><option>Hospital</option><option>RMP Doctor</option><option>Other</option></select></label><label>Mobile number<input name="phone" required /></label></div><div className="form-grid"><label>Email<input name="email" type="email" /></label><label>City<input name="city" /></label></div></>}
          {isSupplier && <><label>Supplier / company name<input name="name" required /></label><label>Contact person<input name="contact" /></label><div className="form-grid"><label>Phone<input name="phone" required /></label><label>Email<input name="email" type="email" /></label></div><label>City<input name="city" /></label></>}
          {isProduct && <><label>Medicine / product name<input name="name" required /></label><div className="form-grid"><label>Brand<input name="brand" /></label><label>Category<input name="category" placeholder="e.g. Tablets" /></label></div><div className="form-grid"><label>Manufacturer<input name="manufacturer" /></label><label>Unit<input name="unit" defaultValue="pack" /></label></div><div className="form-grid"><label>Selling price (₹)<input name="price" type="number" min="0" step="0.01" required defaultValue="0" /></label><label>MRP (₹)<input name="mrp" type="number" min="0" step="0.01" defaultValue="0" /></label></div><div className="form-grid"><label>Opening stock<input name="stock" type="number" min="0" step="1" defaultValue="0" /></label><label>Reorder level<input name="reorder_level" type="number" min="0" step="1" defaultValue="10" /></label></div></>}
          {isOrder && <><label>Customer<select required value={orderCustomer} onChange={(event) => setOrderCustomer(event.target.value)}><option value="">Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} — {customer.business}</option>)}</select></label><label>Product<select required value={orderProduct} onChange={(event) => setOrderProduct(event.target.value)}><option value="">Select a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.stock - product.reserved} available · {currency(product.price)}</option>)}</select></label><label>Requested quantity<input type="number" min="1" step="1" required value={orderQty} onChange={(event) => setOrderQty(event.target.value)} /></label></>}
          {isPayment && <><label>Customer<select required value={paymentCustomer} onChange={(event) => {
    setPaymentCustomer(event.target.value);
    setPaymentOrder("");
  }}><option value="">Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} — {customer.business}</option>)}</select></label><label>Order (optional)<select value={paymentOrder} onChange={(event) => setPaymentOrder(event.target.value)}><option value="">Unallocated payment</option>{orders.filter((order) => !paymentCustomer || String(order.customer_id) === paymentCustomer).map((order) => <option key={order.id} value={order.id}>SMA-{String(order.id).padStart(5, "0")} · {currency(order.total)}</option>)}</select></label><div className="form-grid"><label>Amount (₹)<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Payment method<select name="mode"><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label></div><label>Reference number<input name="reference" /></label></>}
          {formError && <div className="form-error">{formError}</div>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(false)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving\u2026" : <><Check size={16} /> Save record</>}</button></div>
        </form>
      </section></div>}
    </>;
}
function renderCell(key, row) {
  if (key === "amount" || key === "total" || key === "price" || key === "mrp") return <strong>{currency(Number(row[key]))}</strong>;
  if (key === "id") return <strong className="order-id">SMA-{String(row.id).padStart(5, "0")}</strong>;
  if (key === "order_date" || key === "paid_at" || key === "created_at") return prettyDate(String(row[key] || ""));
  if (["requested_qty", "confirmed_qty", "delivered_qty", "pending_qty", "products", "low_stock"].includes(key)) return Number(row[key] || 0).toLocaleString("en-IN");
  if (key === "payment_status" || key === "status") {
    if (key === "status" && row.available !== void 0) return Number(row.available) <= 0 ? <StatusBadge value="Out of stock" /> : Number(row.available) <= Number(row.reorder_level) ? <StatusBadge value="Low stock" /> : <StatusBadge value="In stock" />;
    return <StatusBadge value={String(row[key] || "Active")} />;
  }
  if (key === "name") return <strong>{String(row.name || "\u2014")}</strong>;
  if (key === "stock") return <strong>{Number(row.stock || 0).toLocaleString("en-IN")}</strong>;
  if (key === "reserved") return Number(row.reserved || 0).toLocaleString("en-IN");
  if (key === "available") return <strong>{Number(row.available ?? Number(row.stock || 0) - Number(row.reserved || 0)).toLocaleString("en-IN")}</strong>;
  return String(row[key] ?? "\u2014");
}
function StatusBadge({ value }) {
  const normalized = value.toLowerCase().replaceAll("_", " ");
  const tone = normalized.includes("paid") || normalized.includes("delivered") || normalized === "active" || normalized === "in stock" ? "success" : normalized.includes("partial") || normalized.includes("low") || normalized.includes("prepar") ? "warning" : normalized.includes("cancel") || normalized.includes("failed") || normalized.includes("out of") || normalized.includes("overdue") ? "danger" : normalized.includes("dispatch") || normalized.includes("progress") ? "info" : "neutral";
  return <span className={`status-badge ${tone}`}><i />{value.replaceAll("_", " ")}</span>;
}
function EmptyRow({ colSpan, text }) {
  return <tr><td colSpan={colSpan} className="empty-row"><div className="empty-icon"><FileText size={20} /></div>{text}</td></tr>;
}
function ComingSoonPage({ page }) {
  return <div className="coming-panel"><div className="coming-icon">{page === "Purchases" ? <ShoppingBag size={25} /> : <ArrowDownToLine size={25} />}</div><div className="eyebrow">NEXT WORKFLOW</div><h2>{titles[page].heading}</h2><p>{titles[page].subheading} This workspace is being built in stages; this workflow is not connected yet.</p><span className="coming-tag">Not available in this release</span></div>;
}
function AccessPage() {
  return <div className="panel info-panel"><div className="info-icon"><ShieldCheck size={20} /></div><div><h2>Role-based workspace access</h2><p>Admins can manage the full workspace. Customers can register and view their own orders, invoices, and payment history. Delivery-specific accounts and staff assignment will be added with the delivery workflow.</p></div></div>;
}
function NotificationWatcher({ enabled, preferences, onNewNotification, onError }) {
  const knownIds = useRef(null);
  useEffect(() => {
    if (!enabled || !preferences.inAppNotifications && !preferences.browserNotifications) return;
    let active = true;
    const poll = async () => {
      try {
        const notifications = await request("/notifications", "");
        if (!active) return;
        const currentIds = new Set(notifications.map((item) => item.id));
        if (knownIds.current) {
          const fresh = notifications.find((item) => !knownIds.current?.has(item.id));
          if (fresh) {
            if (preferences.inAppNotifications) onNewNotification(fresh.message);
            if (preferences.browserNotifications && "Notification" in window && Notification.permission === "granted") new Notification(fresh.title, { body: fresh.message });
            if (preferences.sound && (preferences.inAppNotifications || preferences.browserNotifications)) {
              const audio = new AudioContext();
              const tone = audio.createOscillator();
              const volume = audio.createGain();
              tone.type = "sine";
              tone.frequency.value = 660;
              volume.gain.setValueAtTime(1e-4, audio.currentTime);
              volume.gain.exponentialRampToValueAtTime(0.055, audio.currentTime + 0.02);
              volume.gain.exponentialRampToValueAtTime(1e-4, audio.currentTime + 0.18);
              tone.connect(volume);
              volume.connect(audio.destination);
              tone.start();
              tone.stop(audio.currentTime + 0.2);
              tone.onended = () => {
                void audio.close();
              };
            }
          }
        }
        knownIds.current = currentIds;
      } catch (reason) {
        onError(reason instanceof Error ? reason.message : "Could not refresh notifications.");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3e4);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, onError, onNewNotification, preferences.browserNotifications, preferences.inAppNotifications, preferences.sound]);
  return null;
}
function SettingsPage({ user, preferences, savePreferences, onLogout, onSessionExpired, onProfileUpdated }) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const updateProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await request("/auth/profile", "", { method: "PUT", body: JSON.stringify({ name, email }) });
      onProfileUpdated(result.user);
      setEditingProfile(false);
      setMessage("Profile updated successfully.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  };
  const updatePassword = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await request("/auth/change-password", "", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      setMessage("Password updated. Please sign in again with your new password.");
      setCurrentPassword("");
      setNewPassword("");
      onSessionExpired();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update your password.");
    } finally {
      setSaving(false);
    }
  };
  const enableBrowserNotifications = async (enabled) => {
    setError("");
    setMessage("");
    if (enabled && "Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        setError("The browser could not request notification permission. Check this site\u2019s notification settings.");
        return;
      }
    }
    if (enabled && (!("Notification" in window) || Notification.permission !== "granted")) {
      savePreferences({ ...preferences, browserNotifications: false });
      setError("Browser notifications are blocked. Allow notifications for this site in your browser settings, then try again.");
      return;
    }
    savePreferences({ ...preferences, browserNotifications: enabled });
  };
  const testControls = import.meta.env.DEV;
  return <div className="settings-layout">
    {(message || error) && <div className={error ? "toast-error" : "settings-success"} role="status">{error || message}<button onClick={() => {
    setError("");
    setMessage("");
  }} aria-label="Dismiss"><X size={15} /></button></div>}
    <section className="settings-section">
      <div className="settings-section-heading"><div className="settings-section-icon"><Users size={18} /></div><div><h2>Account management</h2><p>View your account details and manage your profile.</p></div></div>
      <div className="account-summary"><div className="avatar large">{user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div><div className="account-details"><strong>{user.name}</strong><span>{user.email}</span><small>{user.role === "admin" ? "Agency user \xB7 Administrator" : user.role === "customer" ? "Customer account" : "Delivery staff"}</small></div><button className="secondary-button" onClick={() => {
    setEditingProfile(!editingProfile);
    setName(user.name);
    setEmail(user.email);
  }}>{editingProfile ? "Cancel editing" : "Manage profile"}</button></div>
      {editingProfile && <form className="settings-form" onSubmit={(event) => void updateProfile(event)}><label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="primary-button" disabled={saving}>{saving ? "Saving\u2026" : "Save profile"}</button></form>}
      <div className="settings-row account-logout"><div><strong>Log out</strong><span>Securely end your current session on this device.</span></div><button className="secondary-button danger-button" onClick={onLogout}><LogOut size={15} /> Logout</button></div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div className="settings-section-icon"><Sun size={18} /></div><div><h2>Appearance</h2><p>Choose how the application looks across every page.</p></div></div>
      <div className="settings-row"><div><strong>Light Mode</strong><span>White surfaces, light green accents, and readable dark text.</span></div><Switch checked={preferences.theme === "light"} label="Light Mode" onChange={() => savePreferences({ ...preferences, theme: "light" })} /><Sun size={17} className="appearance-icon" /></div>
      <div className="settings-row"><div><strong>Dark Mode</strong><span>Dark surfaces and comfortable contrast throughout the workspace.</span></div><Switch checked={preferences.theme === "dark"} label="Dark Mode" onChange={() => savePreferences({ ...preferences, theme: "dark" })} /><Moon size={17} className="appearance-icon" /></div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div className="settings-section-icon"><Bell size={18} /></div><div><h2>Notifications</h2><p>Control in-app activity updates separately from browser alerts.</p></div></div>
      <div className="settings-row"><div><strong>In-app notifications</strong><span>Show new orders, delivery updates, payments, and stock alerts in the workspace.</span></div><Switch checked={preferences.inAppNotifications} label="In-app notifications" onChange={() => savePreferences({ ...preferences, inAppNotifications: !preferences.inAppNotifications })} /></div>
      <div className="settings-row"><div><strong>Browser notifications</strong><span>{!("Notification" in window) ? "This browser does not support desktop notifications." : Notification.permission === "denied" ? "Blocked by your browser. Enable site notifications in browser settings." : "Allow important updates to appear outside the application."}</span></div><Switch checked={preferences.browserNotifications} label="Browser notifications" onChange={(value) => void enableBrowserNotifications(value)} /></div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div className="settings-section-icon"><Volume2 size={18} /></div><div><h2>Notification sound</h2><p>Play a brief sound only for newly received important activity.</p></div></div>
      <div className="settings-row"><div><strong>{preferences.sound ? "Sound ON" : "Sound OFF"}</strong><span>Sounds are silent when in-app notifications are disabled.</span></div><Switch checked={preferences.sound} label="Notification sound" onChange={() => savePreferences({ ...preferences, sound: !preferences.sound })} />{preferences.sound ? <Volume2 size={17} className="appearance-icon" /> : <VolumeX size={17} className="appearance-icon" />}</div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div className="settings-section-icon"><ShieldCheck size={18} /></div><div><h2>Security and password</h2><p>Change your password using your current credentials.</p></div></div>
      <form className="settings-form password-form" onSubmit={(event) => void updatePassword(event)}><label>Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>New password<input required type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" /></label><button className="primary-button" disabled={saving}>{saving ? "Updating\u2026" : "Change password"}</button></form>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div className="settings-section-icon"><Activity size={18} /></div><div><h2>Development / testing mode</h2><p>{testControls ? "Use sample accounts against an isolated test database." : "Testing access is disabled in this build."}</p></div></div>
      {user.testing ? <div className="testing-info"><strong>TEST MODE ACTIVE</strong><span>All changes in this session are stored separately and will not appear in business records.</span><button className="secondary-button" onClick={onLogout}>Exit Testing Mode</button></div> : <div className="settings-foot"><ShieldCheck size={15} /> {testControls ? "Test data remains isolated from business records." : "Available only while running in development mode."}</div>}
    </section>

    <div className="settings-address"><strong>Srinivasa Medical Agencies</strong><p>FIRST FLOOR, SHOP, NO.1, D.NO.1, 248/1/A, NH 65, above Sai Sohan Children Clinic, Miyapur, Telangana 500049.</p></div>
  </div>;
}
function Switch({ checked, label, onChange }) {
  return <button type="button" className={`switch ${checked ? "on" : ""}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}
var App_default = App;
export {
  App_default as default
};
