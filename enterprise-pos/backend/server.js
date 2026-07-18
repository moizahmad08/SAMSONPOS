const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const djangoHashers = require('django-hashers');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize PostgreSQL Connection Pool using database environment variables
const pool = new Pool({
    host: process.env.DB_HOST || 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: parseInt(process.env.DB_PORT || '6543'),
    user: process.env.DB_USER || 'postgres.gxpphoctlyuwoucoummy',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'postgres',
    ssl: {
        rejectUnauthorized: false
    }
});

// Authentication middleware to resolve user from Django authtoken
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ detail: "Authentication credentials were not provided." });
    }

    const token = authHeader.substring(6);
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.is_superuser 
             FROM authtoken_token t 
             JOIN auth_user u ON t.user_id = u.id 
             WHERE t.key = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ detail: "Invalid token." });
        }

        req.user = result.rows[0];
        next();
    } catch (err) {
        console.error("Auth error:", err);
        return res.status(500).json({ error: "Internal server error during authentication." });
    }
};

// --- AUTHENTICATION ENDPOINTS ---

// Login (Matches Django REST Framework obtain_auth_token behavior)
app.post('/api/auth/login/', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ non_field_errors: ["Username and password are required."] });
    }

    try {
        const result = await pool.query(
            'SELECT id, username, password FROM auth_user WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ non_field_errors: ["Unable to log in with provided credentials."] });
        }

        const user = result.rows[0];
        const isMatch = djangoHashers.checkPassword(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ non_field_errors: ["Unable to log in with provided credentials."] });
        }

        // Generate Django style 40-character hex token
        const tokenKey = crypto.randomBytes(20).toString('hex');

        // Upsert token in authtoken_token
        await pool.query(
            `INSERT INTO authtoken_token (key, user_id, created) 
             VALUES ($1, $2, NOW()) 
             ON CONFLICT (user_id) 
             DO UPDATE SET key = EXCLUDED.key, created = NOW()`,
            [tokenKey, user.id]
        );

        res.json({ token: tokenKey });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "An unexpected error occurred during login." });
    }
});

// --- INVENTORY ENDPOINTS ---

// Get current user metadata
app.get('/api/inventory/me/', authenticate, (req, res) => {
    const role = req.user.is_superuser ? 'Admin' : 'Cashier';
    res.json({
        username: req.user.username,
        user_id: req.user.id,
        role: role
    });
});

// Category CRUD
app.get('/api/inventory/categories/', authenticate, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inventory_category ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/inventory/categories/', authenticate, async (req, res) => {
    const { name, description } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO inventory_category (name, description) VALUES ($1, $2) RETURNING *',
            [name, description || '']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/inventory/categories/:id/', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM inventory_category WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Product CRUD
app.get('/api/inventory/products/', authenticate, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inventory_product ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/inventory/products/', authenticate, async (req, res) => {
    const { sku, name, category, cost_price, selling_price, stock_quantity, reorder_level } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO inventory_product 
             (sku, name, category_id, cost_price, selling_price, stock_quantity, reorder_level) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [sku, name, category, cost_price || 0.00, selling_price, stock_quantity || 0, reorder_level || 10]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/inventory/products/:id/', authenticate, async (req, res) => {
    const { id } = req.params;
    const { sku, name, category, cost_price, selling_price, stock_quantity, reorder_level } = req.body;
    try {
        const result = await pool.query(
            `UPDATE inventory_product 
             SET sku = $1, name = $2, category_id = $3, cost_price = $4, selling_price = $5, stock_quantity = $6, reorder_level = $7 
             WHERE id = $8 RETURNING *`,
            [sku, name, category, cost_price || 0.00, selling_price, stock_quantity || 0, reorder_level || 10, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/inventory/products/:id/', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM inventory_product WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Sales & Checkout
app.get('/api/inventory/sales/', authenticate, async (req, res) => {
    try {
        const salesResult = await pool.query('SELECT * FROM inventory_sale ORDER BY created_at DESC');
        const itemsResult = await pool.query(
            `SELECT si.id, si.sale_id, si.product_id, p.name AS product_name, si.quantity, si.price_at_sale 
             FROM inventory_saleitem si 
             LEFT JOIN inventory_product p ON si.product_id = p.id`
        );

        const sales = salesResult.rows.map(sale => {
            return {
                ...sale,
                items: itemsResult.rows
                    .filter(item => item.sale_id === sale.id)
                    .map(item => ({
                        id: item.id,
                        product: item.product_id,
                        product_name: item.product_name || 'Deleted Product',
                        quantity: item.quantity,
                        price_at_sale: item.price_at_sale
                    }))
            };
        });

        res.json(sales);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/inventory/checkout/', authenticate, async (req, res) => {
    const { cart, payment_method, amount_tendered, tax_rate } = req.body;
    
    if (!cart || cart.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let subtotal = 0;
        const saleItemsData = [];

        for (const item of cart) {
            const prodRes = await client.query('SELECT * FROM inventory_product WHERE id = $1 FOR UPDATE', [item.id]);
            if (prodRes.rows.length === 0) {
                throw new Error(`Product not found`);
            }
            
            const product = prodRes.rows[0];
            const qty = parseInt(item.qty);

            if (product.stock_quantity < qty) {
                throw new Error(`Insufficient stock for ${product.name}`);
            }

            // Deduct stock
            await client.query(
                'UPDATE inventory_product SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                [qty, product.id]
            );

            const lineTotal = parseFloat(product.selling_price) * qty;
            subtotal += lineTotal;

            saleItemsData.push({
                product_id: product.id,
                quantity: qty,
                price_at_sale: product.selling_price
            });
        }

        const taxAmount = subtotal * (parseFloat(tax_rate || 0) / 100);
        const totalAmount = subtotal + taxAmount;
        const changeDue = payment_method === 'Cash' ? (parseFloat(amount_tendered || 0) - totalAmount) : 0;

        // Insert Sale
        const saleRes = await client.query(
            `INSERT INTO inventory_sale 
             (total_amount, tax_amount, payment_method, amount_tendered, change_due, status, created_at) 
             VALUES ($1, $2, $3, $4, $5, 'Completed', NOW()) RETURNING id`,
            [totalAmount, taxAmount, payment_method, amount_tendered || 0, change_due]
        );
        const saleId = saleRes.rows[0].id;

        // Insert Sale Items
        for (const itemData of saleItemsData) {
            await client.query(
                `INSERT INTO inventory_saleitem (sale_id, product_id, quantity, price_at_sale) 
                 VALUES ($1, $2, $3, $4)`,
                [saleId, itemData.product_id, itemData.quantity, itemData.price_at_sale]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "Sale completed successfully!", sale_id: saleId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/inventory/refund/:sale_id/', authenticate, async (req, res) => {
    const { sale_id } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const saleRes = await client.query('SELECT * FROM inventory_sale WHERE id = $1 FOR UPDATE', [sale_id]);
        if (saleRes.rows.length === 0) {
            return res.status(404).json({ error: "Sale not found." });
        }

        const sale = saleRes.rows[0];
        if (sale.status === 'Refunded') {
            return res.status(400).json({ error: "Sale is already refunded." });
        }

        // Get sale items
        const itemsRes = await client.query('SELECT * FROM inventory_saleitem WHERE sale_id = $1', [sale_id]);

        // Return stock
        for (const item of itemsRes.rows) {
            if (item.product_id) {
                await client.query(
                    'UPDATE inventory_product SET stock_quantity = stock_quantity + $1 WHERE id = $2',
                    [item.quantity, item.product_id]
                );
            }
        }

        // Mark refunded
        await client.query("UPDATE inventory_sale SET status = 'Refunded' WHERE id = $1", [sale_id]);

        await client.query('COMMIT');
        res.json({ message: `Sale #${sale_id} successfully refunded.` });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Reports metrics endpoint
app.get('/api/inventory/reports/', authenticate, async (req, res) => {
    try {
        const prodCountRes = await pool.query('SELECT COUNT(*) FROM inventory_product');
        const lowStockRes = await pool.query(
            'SELECT COUNT(*) FROM inventory_product WHERE stock_quantity <= reorder_level'
        );
        const revenueRes = await pool.query(
            "SELECT SUM(total_amount) AS total FROM inventory_sale WHERE status = 'Completed'"
        );

        res.json({
            total_products: parseInt(prodCountRes.rows[0].count),
            low_stock: parseInt(lowStockRes.rows[0].count),
            total_revenue: parseFloat(revenueRes.rows[0].total || 0.00)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve health status
app.get('/health', (req, res) => {
    res.json({ status: "healthy" });
});

// Serve Frontend compiled static files in production
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

const PORT = 8000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on port ${PORT}`);
});

