import { useCart } from "../context/CartContext";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";

export function useLogOut() {
  const { signOut } = useSession();
  const { setItemCount } = useCart();
  const showToast = useToast();

  return () => {
    signOut();
    setItemCount(0);
    showToast("Cerraste sesión.");
  };
}
