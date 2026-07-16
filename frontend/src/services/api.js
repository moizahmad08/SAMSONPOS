import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000/api/inventory/' : '/api/inventory/');
const AUTH_BASE = import.meta.env.VITE_AUTH_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000/api/auth/' : '/api/auth/');

const API = axios.create({ baseURL: API_BASE });
const AUTH_API = axios.create({ baseURL: AUTH_BASE });

// Automatically attach the login token to every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Token ${token}`;
    return config;
});

// Auth Endpoints
export const loginUser = async (credentials) => (await AUTH_API.post('login/', credentials)).data;
export const getUserRole = async () => (await API.get('me/')).data;

// Inventory Endpoints
export const getProducts = async () => (await API.get('products/')).data;
export const createProduct = async (data) => (await API.post('products/', data)).data;
export const updateProduct = async (id, data) => (await API.put(`products/${id}/`, data)).data;
export const deleteProduct = async (id) => (await API.delete(`products/${id}/`)).data;

export const getCategories = async () => (await API.get('categories/')).data;
export const createCategory = async (data) => (await API.post('categories/', data)).data;
export const deleteCategory = async (id) => (await API.delete(`categories/${id}/`)).data;

export const getSales = async () => (await API.get('sales/')).data;
export const processCheckout = async (payload) => (await API.post('checkout/', payload)).data;
export const processRefund = async (id) => (await API.post(`refund/${id}/`)).data;
export const getReports = async () => (await API.get('reports/')).data;

export default API;