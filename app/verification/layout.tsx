import { modeLayout } from "../components/ModeSurface";
import "../mentalist/trail.css";
import "./verification.css";

export const metadata = {
  title: "Verification | 7Math Arena",
  robots: { index: false },
};

const { Layout, viewport } = modeLayout("verification");
export { viewport };
export default Layout;
