import { createIntakeHandler } from "../_lib/intake.js";

export const config = { runtime: "edge" };

export default createIntakeHandler({
  formType: "schedule",
  defaultReturnTo: "/schedule-service.html",
});
