import { createIntakeHandler } from "../_lib/intake.js";

export const config = { runtime: "edge" };

export default createIntakeHandler({
  formType: "estimate",
  defaultReturnTo: "/request-estimate.html",
});
