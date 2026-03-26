import { create } from 'zustand';

function parseHashRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return { id: 'incidents' };
  const parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'incidents' && parts.length >= 3) {
    return { id: 'incident-detail', fireYear: parts[1], incidentNumber: decodeURIComponent(parts[2]) };
  }
  const allowed = ['incidents', 'configure', 'dashboard', 'maps', 'discourse', 'weather'];
  if (allowed.includes(parts[0])) {
    return { id: parts[0] };
  }
  return { id: 'incidents' };
}

export const useRouteStore = create((set) => ({
  route: typeof window === 'undefined' ? { id: 'incidents' } : parseHashRoute(),
  setRoute: (route) => set({ route }),
}));

export function navigateTo(path) {
  window.location.hash = path.startsWith('#') ? path.slice(1) : path;
}

export function bindRouteListener() {
  const onHashChange = () => {
    useRouteStore.getState().setRoute(parseHashRoute());
  };
  window.addEventListener('hashchange', onHashChange);
  return () => window.removeEventListener('hashchange', onHashChange);
}
