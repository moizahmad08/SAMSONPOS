import { useEffect, useState } from 'react'
import './App.css'
import { 
  getProducts, createProduct, updateProduct, deleteProduct, 
  getCategories, createCategory, deleteCategory, 
  processCheckout, getReports, getSales, processRefund,
  loginUser, getUserRole
} from './services/api'

function App() {
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  const [user, setUser] = useState({ username: '', user_id: '', role: 'Admin' })
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' })

  // Navigation State
  const [activeView, setActiveView] = useState('Sales')
  const [loading, setLoading] = useState(true)
  
  // Database Data
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [salesHistory, setSalesHistory] = useState([])
  const [reports, setReports] = useState({ total_products: 0, low_stock: 0, total_revenue: 0 })
  
  // Inventory UI State
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('') // For Inventory Tab
  const [cashierSearch, setCashierSearch] = useState('') // For Sales Tab
  const [newProduct, setNewProduct] = useState({ sku: '', name: '', category: '', selling_price: '', stock_quantity: '', reorder_level: '' })
  const [newCategory, setNewCategory] = useState({ name: '', description: '' })

  // Cart & Cashier State
  const [cart, setCart] = useState([])
  const [taxRate, setTaxRate] = useState(0) 
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [receiptData, setReceiptData] = useState(null)

  // Live Math Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.qty), 0)
  const taxAmount = subtotal * (taxRate / 100)
  const grandTotal = subtotal + taxAmount
  const changeDue = paymentMethod === 'Cash' ? (parseFloat(amountTendered || 0) - grandTotal) : 0

  // Load Data on Boot
  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true)
      const uData = await getUserRole()
      setUser(uData)
      
      const [pData, cData, rData, sData] = await Promise.all([
        getProducts(), getCategories(), getReports(), getSales()
      ])
      
      setProducts(pData)
      setCategories(cData)
      setReports(rData)
      setSalesHistory(sData)
    } catch (err) { 
      console.error(err)
      if (err.response?.status === 401) handleLogout()
    } finally { 
      setLoading(false) 
    }
  }

  useEffect(() => { loadData() }, [token, activeView])

  // --- Auth Handlers ---
  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await loginUser(loginCreds)
      localStorage.setItem('token', res.token)
      setToken(res.token)
    } catch (err) { 
      alert("Invalid Username or Password") 
    }
  }

  const handleLogout = () => { 
    localStorage.removeItem('token')
    setToken(null) 
  }

  // Sidebar Role Management
  const navItems = user.role === 'Admin' 
    ? ['Inventory', 'Sales', 'History', 'Categories', 'Reports'] 
    : ['Sales'] 

  // --- Inventory Handlers ---
  const handleProductSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = { 
        ...newProduct, 
        selling_price: parseFloat(newProduct.selling_price), 
        stock_quantity: parseInt(newProduct.stock_quantity), 
        reorder_level: parseInt(newProduct.reorder_level) 
      }
      if (editId) await updateProduct(editId, payload)
      else await createProduct(payload)
      
      setShowForm(false)
      setEditId(null)
      setNewProduct({ sku: '', name: '', category: '', selling_price: '', stock_quantity: '', reorder_level: '' })
      loadData()
    } catch (err) { 
      alert("Failed to save product.") 
    }
  }
  
  const editProduct = (prod) => { 
    setEditId(prod.id)
    setNewProduct(prod)
    setShowForm(true) 
  }

  const removeProduct = async (id) => { 
    if (window.confirm("Are you sure?")) { 
      await deleteProduct(id)
      loadData() 
    } 
  }
  
  // Search Filters
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const cashierFilteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(cashierSearch.toLowerCase()) || 
    p.sku.toLowerCase().includes(cashierSearch.toLowerCase())
  )

  // --- Cart Handlers ---
  const addToCart = (prod) => {
    const exists = cart.find(item => item.id === prod.id)
    if (exists) {
      setCart(cart.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item))
    } else {
      setCart([...cart, { ...prod, qty: 1 }])
    }
    setCashierSearch('') // Clear search bar after adding
  }

  const updateCartQty = (id, newQty) => {
    if (newQty < 1 || isNaN(newQty)) newQty = 1; 
    setCart(cart.map(item => item.id === id ? { ...item, qty: newQty } : item))
  }

  const removeCartItem = (id) => setCart(cart.filter(item => item.id !== id))
  
  const clearCart = () => { 
    setCart([])
    setAmountTendered('') 
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return alert("Cart is empty")
    if (paymentMethod === 'Cash' && changeDue < 0) return alert("Insufficient amount tendered!")
    
    try {
      const payload = { 
        cart, 
        payment_method: paymentMethod, 
        tax_rate: taxRate, 
        amount_tendered: paymentMethod === 'Cash' ? parseFloat(amountTendered) : grandTotal 
      }
      
      const res = await processCheckout(payload)
      const now = new Date()
      
      setReceiptData({ 
        ...payload, 
        subtotal, 
        taxAmount, 
        grandTotal, 
        changeDue, 
        user, 
        id: res.sale_id, 
        date: now.toLocaleDateString(), 
        time: now.toLocaleTimeString() 
      })
      
      clearCart()
      loadData()
    } catch (err) { 
      alert("Checkout failed.") 
    }
  }

  const handleRefund = async (id) => {
    if (window.confirm("Void this sale and restock items?")) { 
      await processRefund(id)
      loadData() 
    }
  }

  const handleCategorySubmit = async (e) => {
    e.preventDefault()
    await createCategory(newCategory)
    setNewCategory({ name: '', description: '' })
    loadData()
  }

  // --- Render Login Screen ---
  if (!token) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a' }}>
      <form onSubmit={handleLogin} className="table-card" style={{ width: '320px', textAlign: 'center' }}>
        <div className="brand-mark" style={{ margin: '0 auto 15px auto' }}>S</div>
        <h2>SanSons Portal</h2>
        <input 
          type="text" 
          placeholder="Username" 
          required 
          style={{ width: '100%', marginBottom: '10px', padding: '10px', boxSizing: 'border-box' }} 
          onChange={e => setLoginCreds({...loginCreds, username: e.target.value})} 
        />
        <input 
          type="password" 
          placeholder="Password" 
          required 
          style={{ width: '100%', marginBottom: '20px', padding: '10px', boxSizing: 'border-box' }} 
          onChange={e => setLoginCreds({...loginCreds, password: e.target.value})} 
        />
        <button type="submit" className="primary-btn" style={{ width: '100%' }}>Secure Login</button>
      </form>
    </div>
  )

  // --- Render Main Dashboard ---
  return (
    <div className="dashboard-shell">
      
      {/* Receipt Print Styles */}
      <style>{`
        @media print { 
          body * { visibility: hidden; } 
          #receipt-container, #receipt-container * { visibility: visible; } 
          #receipt-container { position: absolute; left: 0; top: 0; width: 80mm; padding: 10px; margin: 0; } 
          .no-print { display: none !important; } 
        }
      `}</style>
      
      {/* Sidebar */}
      <aside className="sidebar no-print">
        <div className="brand-block">
          <div className="brand-mark">S</div>
          <div>
            <h2>SanSons</h2>
            <p>{user.role} Panel</p>
          </div>
        </div>
        
        <nav className="nav-links">
          {navItems.map((item) => (
            <button 
              key={item} 
              className={activeView === item ? 'active' : ''} 
              onClick={() => setActiveView(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        
        <button 
          onClick={handleLogout} 
          style={{ position: 'absolute', bottom: '20px', left: '20px', color: '#ff7675', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ← Logout {user.username}
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-panel no-print">
        <header className="topbar">
          <h1>{activeView}</h1>
          {user.role === 'Cashier' && (
            <span style={{ background: '#e2e8f0', padding: '8px 12px', borderRadius: '20px', fontSize: '0.9rem', color: '#334155', fontWeight: 'bold' }}>
              Cashier ID: {user.user_id} | {user.username}
            </span>
          )}
        </header>

        {/* --- INVENTORY TAB --- */}
        {activeView === 'Inventory' && (
          <section className="table-card">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input 
                type="text" 
                placeholder="Search SKU or Name..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                style={{ padding: '10px', width: '300px', border: '1px solid #ccc', borderRadius: '6px' }} 
              />
              <button 
                className="primary-btn" 
                onClick={() => { 
                  setShowForm(!showForm); 
                  setEditId(null); 
                  setNewProduct({sku: '', name: '', category: '', selling_price: '', stock_quantity: '', reorder_level: ''}) 
                }}
              >
                {showForm ? 'Cancel' : '+ New product'}
              </button>
            </div>
            
            {showForm && (
              <form onSubmit={handleProductSubmit} style={{ padding: '20px', marginBottom: '20px', background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="text" placeholder="SKU" value={newProduct.sku} required onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})} style={{ padding: '10px' }} />
                  <input type="text" placeholder="Name" value={newProduct.name} required onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} style={{ padding: '10px' }} />
                  <select required value={newProduct.category} onChange={(e) => setNewProduct({...newProduct, category: e.target.value})} style={{ padding: '10px' }}>
                    <option value="">Select Category...</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  <input type="number" placeholder="Price (PKR)" value={newProduct.selling_price} required onChange={(e) => setNewProduct({...newProduct, selling_price: e.target.value})} style={{ padding: '10px' }} />
                  <input type="number" placeholder="Stock Qty" value={newProduct.stock_quantity} required onChange={(e) => setNewProduct({...newProduct, stock_quantity: e.target.value})} style={{ padding: '10px' }} />
                  <input type="number" placeholder="Reorder Level" value={newProduct.reorder_level} required onChange={(e) => setNewProduct({...newProduct, reorder_level: e.target.value})} style={{ padding: '10px' }} />
                </div>
                <button type="submit" className="primary-btn" style={{ marginTop: '15px' }}>
                  {editId ? 'Update Item' : 'Save Item'}
                </button>
              </form>
            )}
            
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td style={{ fontWeight: '500' }}>{p.name}</td>
                    <td>PKR {p.selling_price}</td>
                    <td>
                      <span style={{ color: p.stock_quantity <= p.reorder_level ? '#ef4444' : 'inherit', fontWeight: 'bold' }}>
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => editProduct(p)} style={{ cursor: 'pointer', marginRight: '5px', padding: '5px 10px' }}>Edit</button> 
                      <button onClick={() => removeProduct(p.id)} style={{ color: 'red', cursor: 'pointer', padding: '5px 10px' }}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* --- SALES (CASHIER) TAB --- */}
        {activeView === 'Sales' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: '20px' }}>
            
            {/* Left Side: Product Selection */}
            <div className="table-card" style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
              <input 
                type="text" 
                placeholder="🔍 Scan Barcode or type Product Name..." 
                value={cashierSearch} 
                onChange={(e) => setCashierSearch(e.target.value)} 
                style={{ width: '100%', marginBottom: '15px', padding: '15px', fontSize: '1.1rem', boxSizing: 'border-box', border: '2px solid #e2e8f0', borderRadius: '8px' }} 
                autoFocus 
              />
              
              <div className="product-grid">
                {cashierFilteredProducts.map(p => (
                  <button 
                    key={p.id} 
                    className="product-btn" 
                    onClick={() => addToCart(p)} 
                    disabled={p.stock_quantity < 1}
                  >
                    <strong>{p.name}</strong>
                    <span className="price">PKR {p.selling_price}</span>
                    <small style={{ color: '#64748b' }}>Stock: {p.stock_quantity}</small>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Right Side: Cart & Checkout */}
            <div className="table-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Current Bill</h2>
                <button onClick={clearCart} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                  Clear All
                </button>
              </div>
              <hr style={{ borderTop: '1px solid #e2e8f0', width: '100%', margin: '15px 0' }} />
              
              {/* Cart List */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {cart.length === 0 ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px' }}>Cart is empty. Scan an item.</p> 
                ) : (
                  cart.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed #cbd5e1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={() => removeCartItem(c.id)} style={{ color: '#ef4444', background: '#fee2e2', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>X</button>
                        <div>
                          <div style={{ fontWeight: '600' }}>{c.name}</div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>PKR {c.selling_price} each</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="number" 
                          min="1" 
                          value={c.qty} 
                          onChange={(e) => updateCartQty(c.id, parseInt(e.target.value))} 
                          style={{ width: '60px', textAlign: 'center', padding: '5px', border: '1px solid #ccc', borderRadius: '4px' }} 
                        />
                        <span style={{ fontWeight: 'bold', width: '80px', textAlign: 'right' }}>
                          PKR {(c.selling_price * c.qty).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Checkout Math */}
              <div style={{ marginTop: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '5px' }}>
                  <span>Subtotal:</span> 
                  <span>PKR {subtotal.toFixed(2)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '10px' }}>
                  <span>Tax (%): 
                    <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} style={{ width: '50px', padding: '2px 5px', marginLeft: '5px', border: '1px solid #ccc', borderRadius: '4px' }}/>
                  </span>
                  <span>PKR {taxAmount.toFixed(2)}</span>
                </div>
                
                <h2 style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 15px 0', fontSize: '1.6rem', color: '#0f172a' }}>
                  <span>Total:</span> 
                  <span>PKR {grandTotal.toFixed(2)}</span>
                </h2>
                
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '6px' }}>
                  <option value="Cash">Cash Payment</option>
                  <option value="Card">Card Payment</option>
                </select>
                
                {paymentMethod === 'Cash' && (
                  <input 
                    type="number" 
                    placeholder="Cash Given (PKR)" 
                    value={amountTendered} 
                    onChange={e => setAmountTendered(e.target.value)} 
                    style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '6px' }} 
                  />
                )}
                
                {paymentMethod === 'Cash' && amountTendered && (
                  <h3 style={{ margin: '0 0 15px 0', color: changeDue < 0 ? '#ef4444' : '#10b981' }}>
                    Change Due: PKR {changeDue.toFixed(2)}
                  </h3>
                )}
                
                <button className="success-btn" onClick={handleCheckout}>
                  COMPLETE SALE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- CATEGORIES TAB --- */}
        {activeView === 'Categories' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            <form onSubmit={handleCategorySubmit} className="table-card" style={{ height: 'fit-content' }}>
              <h3 style={{ margin: '0 0 15px 0' }}>New Category</h3>
              <input 
                type="text" 
                placeholder="Category Name" 
                value={newCategory.name} 
                required 
                onChange={e => setNewCategory({...newCategory, name: e.target.value})} 
                style={{ width: '100%', marginBottom: '15px', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '6px' }} 
              />
              <button type="submit" className="primary-btn" style={{ width: '100%' }}>Save Category</button>
            </form>
            
            <div className="table-card">
              <h3 style={{ margin: '0 0 15px 0' }}>Existing Categories</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {categories.map(c => (
                  <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                    {c.name} 
                    <button onClick={() => deleteCategory(c.id)} style={{ color: '#ef4444', background: '#fee2e2', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* --- HISTORY TAB --- */}
        {activeView === 'History' && (
          <section className="table-card">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date & Time</th>
                  <th>Method</th>
                  <th>Total (PKR)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {salesHistory.map((s) => (
                  <tr key={s.id} style={{ opacity: s.status === 'Refunded' ? 0.5 : 1 }}>
                    <td>#{s.id}</td>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                    <td>{s.payment_method}</td>
                    <td style={{ fontWeight: 'bold' }}>PKR {s.total_amount}</td>
                    <td>
                      <span style={{ 
                        background: s.status === 'Completed' ? '#dcfce7' : '#fee2e2', 
                        color: s.status === 'Completed' ? '#16a34a' : '#ef4444', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.85rem', 
                        fontWeight: 'bold' 
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      {s.status === 'Completed' && (
                        <button 
                          onClick={() => handleRefund(s.id)} 
                          style={{ border: 'none', background: '#fee2e2', color: '#ef4444', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Void Sale
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* --- REPORTS TAB --- */}
        {activeView === 'Reports' && (
          <section className="stats-grid">
            <article className="stat-card accent">
              <p>Total Products</p>
              <h2>{reports.total_products}</h2>
            </article>
            <article className="stat-card">
              <p>Low Stock Alerts</p>
              <h2 style={{ color: '#ef4444' }}>{reports.low_stock}</h2>
            </article>
            <article className="stat-card">
              <p>Gross Revenue</p>
              <h2 style={{ color: '#10b981' }}>PKR {reports.total_revenue.toLocaleString()}</h2>
            </article>
          </section>
        )}
      </main>

      {/* --- PRINTABLE RECEIPT MODAL --- */}
      {receiptData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} className="no-print">
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '350px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            <div id="receipt-container" style={{ fontFamily: 'monospace', color: 'black' }}>
              <h2 style={{ textAlign: 'center', margin: '0', fontSize: '24px' }}>SANSONS</h2>
              
              <p style={{ textAlign: 'center', margin: '10px 0', fontSize: '12px', color: '#333' }}>
                Date: {receiptData.date} | Time: {receiptData.time}<br/>
                Receipt #{receiptData.id}<br/>
                Served by: {receiptData.user.username} (ID: {receiptData.user.user_id})
              </p>
              
              <hr style={{ borderTop: '1px dashed black', margin: '15px 0' }}/>
              
              <table style={{ width: '100%', fontSize: '14px', marginBottom: '10px' }}>
                <tbody>
                  {receiptData.cart.map(i => (
                    <tr key={i.id}>
                      <td style={{ padding: '4px 0' }}>{i.qty}x {i.name}</td>
                      <td style={{ textAlign: 'right' }}>PKR {(i.selling_price * i.qty).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <hr style={{ borderTop: '1px dashed black', margin: '15px 0' }}/>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', margin: '4px 0' }}>
                <span>Subtotal:</span>
                <span>PKR {receiptData.subtotal.toFixed(2)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', margin: '4px 0' }}>
                <span>Tax:</span>
                <span>PKR {receiptData.taxAmount.toFixed(2)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', margin: '15px 0' }}>
                <span>TOTAL:</span>
                <span>PKR {receiptData.grandTotal.toFixed(2)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', margin: '4px 0' }}>
                <span>Paid ({receiptData.payment_method}):</span>
                <span>PKR {receiptData.amount_tendered.toFixed(2)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', margin: '4px 0' }}>
                <span>Change:</span>
                <span>PKR {receiptData.changeDue.toFixed(2)}</span>
              </div>
              
              <p style={{ textAlign: 'center', marginTop: '25px', fontSize: '13px', fontWeight: 'bold' }}>
                Thank you for visiting SanSons!
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
              <button className="primary-btn" style={{ flex: 1, padding: '12px' }} onClick={() => window.print()}>
                Print Receipt
              </button>
              <button onClick={() => setReceiptData(null)} style={{ flex: 1, background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', padding: '12px' }}>
                Close
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  )
}

export default App