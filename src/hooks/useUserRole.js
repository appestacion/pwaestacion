import useStore from '../store/useStore.js';

export default function useUserRole() {
  const user = useStore((state) => state.user);
  return {
    role: user?.role || null,
    isAdmin: user?.role === 'administrador',
    isSupervisor: user?.role === 'supervisor',
    userId: user?.id || null,
    userName: user?.name || '',
  };
}
