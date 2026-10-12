import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * When Microsoft returns to this origin inside the MSAL sign-in popup, the
 * opener window reads the auth response from this window's URL hash. Booting
 * the app here would let routing/guards replace the URL and clear the hash
 * before MSAL reads it ("hash_empty_error"). So render nothing and leave the
 * URL untouched; the opener closes this popup once it has the response.
 */
function isMsalPopupResponse(): boolean {
  try {
    if (!window.opener || window.opener === window) return false;
    // Accessing opener.location throws if cross-origin.
    if (window.opener.location.origin !== window.location.origin) return false;
    const hash = window.location.hash;
    return /[#&](code|error)=/.test(hash) && /[#&]state=/.test(hash);
  } catch {
    return false;
  }
}

if (!isMsalPopupResponse()) {
  createRoot(document.getElementById("root")!).render(<App />);
}
