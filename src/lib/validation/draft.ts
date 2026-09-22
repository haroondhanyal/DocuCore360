import { z } from "zod";
const page = z
  .object({
    id: z.string().min(1).max(100),
    sourcePage: z.number().int().min(0).max(499).nullable(),
    rotation: z
      .number()
      .int()
      .refine((v) => [0, 90, 180, 270].includes(v)),
    width: z.number().positive().max(20000),
    height: z.number().positive().max(20000),
    overlay: z.object({
      version: z.string().max(30).optional(),
      objects: z.array(z.record(z.string(), z.unknown())).max(200),
    }),
  })
  .refine((p) => p.width * p.height <= 20_000_000);
export const draftSchema = z.object({
  name: z.string().min(1).max(180),
  source: z
    .string()
    .min(1)
    .max(35_000_000)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
  pages: z.array(page).min(1).max(500),
});
export function validateDraftObjects(value: unknown, depth = 0): void {
  if (depth > 30) throw new Error("Draft object nesting exceeds the limit.");
  if (typeof value === "string" && value.length > 8_000_000)
    throw new Error("Draft object is too large.");
  if (Array.isArray(value)) {
    if (value.length > 100000) throw new Error("Draft contains excessive coordinates.");
    for (const item of value) validateDraftObjects(item, depth + 1);
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        throw new Error("Invalid draft property.");
      if (
        (key === "src" || key === "source") &&
        (typeof v !== "string" ||
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v))
      )
        throw new Error("Draft images must be embedded PNG, JPEG or WebP data.");
      validateDraftObjects(v, depth + 1);
    }
  }
}
