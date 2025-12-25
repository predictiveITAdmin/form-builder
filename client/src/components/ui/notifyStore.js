// notifyStore.js
let listeners = [];
let state = {
  open: false,
  type: "info",
  title: "",
  message: "",
};

let timeoutId = null;

export const notifyStore = {
  get: () => state,
  set: (next) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l(state));
  },
  subscribe: (listener) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

export const notify = ({
  type = "info",
  title = "",
  message = "",
  duration = 3000,
} = {}) => {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  notifyStore.set({
    open: true,
    type,
    title,
    message,
  });

  if (duration > 0) {
    timeoutId = setTimeout(() => {
      notifyStore.set({ open: false });
      timeoutId = null;
    }, duration);
  }
};

export const dismissNotify = () => {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  notifyStore.set({ open: false });
};
