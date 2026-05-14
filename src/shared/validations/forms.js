import { z } from "zod";

const optionalText = z.string().optional().nullable();
const optionalPhone = z
  .union([
    z.string().trim().regex(/^\(\d{3}\) \d{3}-\d{4}$/, "Use the format (555) 555-5555."),
    z.literal(""),
    z.null(),
    z.undefined(),
  ])
  .optional();
const optionalEmail = z
  .union([
    z.string().trim().email("Enter a valid email like name@example.com."),
    z.literal(""),
    z.null(),
    z.undefined(),
  ])
  .optional();

export const leadFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the client name."),
    address: optionalText,
    contact: optionalPhone,
    email: optionalEmail,
    followUpDate: optionalText,
    followUpNote: optionalText,
    followUpStatus: z.enum(["pending", "done"]).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const hasDate = Boolean(String(value.followUpDate || "").trim());
    const hasNote = Boolean(String(value.followUpNote || "").trim());

    if (hasDate && !hasNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["followUpNote"],
        message: "Add a follow-up note for the scheduled date.",
      });
    }

    if (hasNote && !hasDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["followUpDate"],
        message: "Choose the next follow-up date.",
      });
    }
  });

export const leadEditSchema = z.object({
  name: z.string().trim().min(1, "Enter the client name."),
  address: optionalText,
  contact: optionalPhone,
  email: optionalEmail,
});

export const clientFormSchema = leadFormSchema;
export const clientEditSchema = leadEditSchema;

export const followUpSchema = z.object({
  note: z.string().trim().min(1, "Enter a follow-up note."),
  nextFollowUpDate: optionalText,
  status: z.enum(["pending", "done"]),
});

export const projectFormSchema = z
  .object({
    clientMode: z.enum(["existing", "new"]),
    clientId: z.string().optional().nullable(),
    clientName: optionalText,
    clientContact: optionalPhone,
    clientEmail: optionalEmail,
    clientAddress: optionalText,
    name: z.string().trim().min(1, "Enter the project name."),
    location: optionalText,
    startDate: optionalText,
    endDate: optionalText,
    contractValue: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.clientMode === "existing" && !String(value.clientId || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientId"],
        message: "Select an existing client.",
      });
    }

    if (value.clientMode === "new" && !String(value.clientName || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientName"],
        message: "Enter the client name.",
      });
    }

    const numericBudget = Number(value.contractValue || 0);
    if (!Number.isFinite(numericBudget) || numericBudget < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contractValue"],
        message: "Enter a valid budget amount of 0 or more.",
      });
    }

    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date cannot be before start date.",
      });
    }
  });

export const projectClientEditSchema = z.object({
  clientName: z.string().trim().min(1, "Enter the client name."),
  clientContact: optionalPhone,
  clientEmail: optionalEmail,
  clientAddress: optionalText,
});

export const projectInfoEditSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the project name."),
    location: optionalText,
    startDate: optionalText,
    endDate: optionalText,
    contractValue: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
  })
  .superRefine((value, ctx) => {
    const numericBudget = Number(value.contractValue || 0);
    if (!Number.isFinite(numericBudget) || numericBudget < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contractValue"],
        message: "Enter a valid budget amount of 0 or more.",
      });
    }

    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date cannot be before start date.",
      });
    }
  });

export const staffCreateSchema = z.object({
  name: z.string().trim().min(1, "Enter the staff member name."),
  userName: z.string().trim().min(1, "Enter a username."),
  role: z.enum(["manager", "employee", "subcontractor"]),
  email: z.string().trim().email("Enter a valid email like name@example.com."),
  mobile: optionalPhone,
  hourlyRate: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
  craft: optionalText,
});

export const staffEditSchema = z.object({
  name: z.string().trim().min(1, "Enter the staff member name."),
  user_name: z.string().trim().min(1, "Enter a username."),
  email: z.string().trim().email("Enter a valid email like name@example.com."),
  mobile: optionalPhone,
  hourly_rate: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
  craft: optionalText,
  password: z
    .union([z.string().min(8, "Password must be at least 8 characters."), z.literal(""), z.undefined(), z.null()])
    .optional(),
});

export const settingsProfileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  userName: z.string().trim().min(1, "Enter a username."),
  email: z.string().trim().email("Enter a valid email like name@example.com."),
  mobile: optionalPhone,
  address: optionalText,
});

export const settingsCompanySchema = z.object({
  name: z.string().trim().min(1, "Enter the company name."),
  address: optionalText,
  contact: optionalPhone,
  email: optionalEmail,
  signatureName: optionalText,
  stampLabel: optionalText,
});

export const passwordChangeSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords must match exactly.",
      });
    }
  });

export const expenseFormSchema = z.object({
  projectId: z.string().trim().min(1, "Select the project."),
  expenseType: z.enum(["employee_labor", "subcontractor", "material", "equipment"]),
  status: z.enum(["pending", "approved", "paid"]),
  expenseDate: z.string().trim().min(1, "Choose the expense date."),
  amount: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
  quantity: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
  unitRate: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
  markupPercent: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
});

export const fieldReportFormSchema = z.object({
  projectId: z.string().trim().min(1, "Select the project."),
  reportDate: z.string().trim().min(1, "Choose the report date."),
  reportTime: optionalText,
  temperatureValue: z.union([z.string(), z.number(), z.literal(""), z.null(), z.undefined()]).optional(),
  publicCommunications: z
    .array(
      z.object({
        phoneNumber: optionalPhone,
      })
    )
    .optional(),
});

export function getValidationErrors(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (parsed.success) return {};

  const fieldErrors = parsed.error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([key, messages]) => [key, messages?.[0] || "Invalid value."])
      .filter(([, message]) => Boolean(message))
  );
}

export function focusFirstInvalidField(fieldErrors) {
  if (typeof document === "undefined") return;
  const firstField = Object.keys(fieldErrors || {})[0];
  if (!firstField) return;

  const input =
    document.querySelector(`[name="${firstField}"]`) ||
    document.querySelector(`[data-field="${firstField}"] input, [data-field="${firstField}"] textarea, [data-field="${firstField}"] select, [data-field="${firstField}"] button`) ||
    document.querySelector(`[data-field="${firstField}"]`);

  if (!input) return;
  input.scrollIntoView?.({ behavior: "smooth", block: "center" });
  input.focus?.();
}
