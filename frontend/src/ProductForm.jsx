import { useState } from 'react';
import { createProduct } from '../services/api';

function ProductForm({ onProductAdded, onClose }) {
    const [formData, setFormData] = useState({ sku: '', name: '', category: '', selling_price: '', stock_quantity: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        await createProduct(formData);
        onProductAdded(); // Refresh the list
        onClose(); // Close the form
    };

    return (
        <form onSubmit={handleSubmit} className="form-card">
            <h3>Add New Product</h3>
            <input type="text" placeholder="SKU" onChange={(e) => setFormData({...formData, sku: e.target.value})} required />
            <input type="text" placeholder="Name" onChange={(e) => setFormData({...formData, name: e.target.value})} required />
            <input type="text" placeholder="Category" onChange={(e) => setFormData({...formData, category: e.target.value})} required />
            <input type="number" placeholder="Price" onChange={(e) => setFormData({...formData, selling_price: e.target.value})} required />
            <input type="number" placeholder="Stock" onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})} required />
            <button type="submit">Save Product</button>
            <button type="button" onClick={onClose}>Cancel</button>
        </form>
    );
}

export default ProductForm;