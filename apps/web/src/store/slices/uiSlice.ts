import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  activePortal: 'admin' | 'client' | 'supervisor';
  activeAdminTab: string;
  isChatOpen: boolean;
  isNotificationsOpen: boolean;
  unreadNotificationsCount: number;
}

const initialState: UIState = {
  activePortal: 'admin',
  activeAdminTab: 'dashboard',
  isChatOpen: false,
  isNotificationsOpen: false,
  unreadNotificationsCount: 3,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActivePortal: (state, action: PayloadAction<'admin' | 'client' | 'supervisor'>) => {
      state.activePortal = action.payload;
    },
    setActiveAdminTab: (state, action: PayloadAction<string>) => {
      state.activeAdminTab = action.payload;
    },
    toggleChat: (state) => {
      state.isChatOpen = !state.isChatOpen;
    },
    setChatOpen: (state, action: PayloadAction<boolean>) => {
      state.isChatOpen = action.payload;
    },
    toggleNotifications: (state) => {
      state.isNotificationsOpen = !state.isNotificationsOpen;
    },
    setNotificationsOpen: (state, action: PayloadAction<boolean>) => {
      state.isNotificationsOpen = action.payload;
    },
    setUnreadNotificationsCount: (state, action: PayloadAction<number>) => {
      state.unreadNotificationsCount = action.payload;
    },
  },
});

export const {
  setActivePortal,
  setActiveAdminTab,
  toggleChat,
  setChatOpen,
  toggleNotifications,
  setNotificationsOpen,
  setUnreadNotificationsCount,
} = uiSlice.actions;

export default uiSlice.reducer;

