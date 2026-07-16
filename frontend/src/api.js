import axios from 'axios';

const API = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/inventory/',
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