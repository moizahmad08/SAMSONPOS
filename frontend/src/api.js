import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/inventory/';

const API = axios.create({
    baseURL: API_BASE,
});

export const getProducts = async () => {
    const response = await API.get('products/');
    return response.data;
};

// Add this new function
export const createProduct = async (productData) => {
    const response = await API.post('products/', productData);
    return response.data;
};
export default API;