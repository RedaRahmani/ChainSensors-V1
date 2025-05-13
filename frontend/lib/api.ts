// // frontend/lib/api.ts
// import axios from 'axios';
// import { auth } from './firebase';

// const api = axios.create({
//   baseURL: 'http://localhost:3003',
// });

// // Add Firebase ID token to every request
// api.interceptors.request.use(async (config) => {
//   const user = auth.currentUser;
//   if (user) {
//     const token = await user.getIdToken();
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// export default api;