// UI Slice
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UIState, TabId, ActionType } from '../../types';

const initialState: UIState = {
  currentTab: 'PORTFOLIO',
  isLoading: false,
  pendingAction: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setCurrentTab: (state, action: PayloadAction<TabId>) => {
      state.currentTab = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setPendingAction: (
      state,
      action: PayloadAction<{
        type: ActionType;
        payload: Record<string, unknown>;
      } | null>
    ) => {
      state.pendingAction = action.payload;
    },
    clearPendingAction: (state) => {
      state.pendingAction = null;
    },
  },
});

export const {
  setCurrentTab,
  setLoading,
  setPendingAction,
  clearPendingAction,
} = uiSlice.actions;

export default uiSlice.reducer;
