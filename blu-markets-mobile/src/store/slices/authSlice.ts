// Auth Slice
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthState } from '../../types';

const initialState: AuthState = {
  phone: null,
  authToken: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setPhone: (state, action: PayloadAction<string>) => {
      state.phone = action.payload;
    },
    setAuthToken: (state, action: PayloadAction<string>) => {
      state.authToken = action.payload;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.phone = null;
      state.authToken = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setPhone, setAuthToken, logout } = authSlice.actions;
export default authSlice.reducer;
