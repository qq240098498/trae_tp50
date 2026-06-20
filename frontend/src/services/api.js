import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error.response?.data || error);
  }
);

export const petApi = {
  list: (keyword) => api.get('/pets', { params: { keyword } }),
  get: (id) => api.get(`/pets/${id}`),
  create: (data) => api.post('/pets', data),
  update: (id, data) => api.put(`/pets/${id}`, data),
  delete: (id) => api.delete(`/pets/${id}`)
};

export const boardingApi = {
  list: (params) => api.get('/boarding', { params }),
  get: (id) => api.get(`/boarding/${id}`),
  create: (data) => api.post('/boarding', data),
  update: (id, data) => api.put(`/boarding/${id}`, data),
  updateStatus: (id, status) => api.patch(`/boarding/${id}/status`, { status }),
  cancel: (id) => api.delete(`/boarding/${id}`),
  cages: (status) => api.get('/boarding/cages', { params: { status } }),
  availableCages: (check_in_date, check_out_date, exclude_booking_id) => 
    api.get('/boarding/cages/available', { params: { check_in_date, check_out_date, exclude_booking_id } })
};

export const groomingApi = {
  list: (params) => api.get('/grooming', { params }),
  get: (id) => api.get(`/grooming/${id}`),
  create: (data) => api.post('/grooming', data),
  update: (id, data) => api.put(`/grooming/${id}`, data),
  updateStatus: (id, status) => api.patch(`/grooming/${id}/status`, { status }),
  cancel: (id) => api.delete(`/grooming/${id}`),
  groomers: (status) => api.get('/grooming/groomers', { params: { status } }),
  availableGroomers: (appointment_date, exclude_booking_id) => 
    api.get('/grooming/groomers/available', { params: { appointment_date, exclude_booking_id } }),
  services: () => api.get('/grooming/services')
};

export const transactionApi = {
  list: (params) => api.get('/transactions', { params }),
  get: (id) => api.get(`/transactions/${id}`),
  checkoutPreview: (pet_id, boarding_booking_id) => 
    api.get(`/transactions/checkout/${pet_id}`, { params: { boarding_booking_id } }),
  checkout: (data) => api.post('/transactions/checkout', data),
  daily: (date) => api.get('/transactions/daily', { params: { date } })
};

export const vaccineApi = {
  alerts: () => api.get('/vaccine/alerts'),
  check: (petId) => api.get(`/vaccine/check/${petId}`),
  preExpire: () => api.get('/vaccine/pre-expire'),
  sendSms: (pet_id, reminder_type) => api.post('/vaccine/sms', { pet_id, reminder_type }),
  reminders: (pet_id) => api.get('/vaccine/reminders', { params: { pet_id } })
};

export const pickupApi = {
  list: (params) => api.get('/pickup', { params }),
  get: (id) => api.get(`/pickup/${id}`),
  create: (data) => api.post('/pickup', data),
  update: (id, data) => api.put(`/pickup/${id}`, data),
  updateStatus: (id, status) => api.patch(`/pickup/${id}/status`, { status }),
  cancel: (id) => api.delete(`/pickup/${id}`),
  pickupConfirm: (id, data) => api.post(`/pickup/${id}/pickup-confirm`, data),
  dropoffConfirm: (id, data) => api.post(`/pickup/${id}/dropoff-confirm`, data),
  areas: (status) => api.get('/pickup/areas', { params: { status } }),
  createArea: (data) => api.post('/pickup/areas', data),
  updateArea: (id, data) => api.put(`/pickup/areas/${id}`, data),
  deleteArea: (id) => api.delete(`/pickup/areas/${id}`),
  priceTiers: () => api.get('/pickup/price-tiers'),
  createPriceTier: (data) => api.post('/pickup/price-tiers', data),
  updatePriceTier: (id, data) => api.put(`/pickup/price-tiers/${id}`, data),
  deletePriceTier: (id) => api.delete(`/pickup/price-tiers/${id}`),
  calculateFee: (distance_km, area_id, area_name) => 
    api.post('/pickup/calculate-fee', { distance_km, area_id, area_name }),
  routes: (date) => api.get('/pickup/routes', { params: { date } })
};

export default api;
