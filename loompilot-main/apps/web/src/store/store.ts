import { configureStore, combineReducers, AnyAction } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import { apiSlice } from './api/apiSlice';

const appReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
});

const rootReducer = (state: any, action: AnyAction) => {
  if (action.type === 'auth/logout') {
    // Completely purge RTK Query cache and reset all queries/subscriptions on logout
    state = {
      auth: state?.auth,
      ui: state?.ui,
      [apiSlice.reducerPath]: undefined,
    };
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
