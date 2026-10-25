import { z } from "zod";

/**
 * Request/input schemas for every server entry point (route handlers and server
 * actions). Parsing here keeps untrusted values out of queries and caps sizes,
 * which is also the effective request-size limit for these endpoints.
 */

export const MAX_MESSAGE_LEN = 4000;
export const MAX_TITLE_LEN = 140;

/** ISO-8601 timestamp, used for the chat polling cursor. */
export const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .max(40);

/** An opaque thread/channel id. The app ids are UUIDs. */
export const uuidSchema = z.string().uuid();

export const topicCategorySchema = z.enum([
  "general",
  "order_query",
  "delivery",
  "clinical",
  "other",
]);

export const topicPrioritySchema = z.enum(["normal", "urgent"]);

export const sendPharmacyMessageSchema = z.object({
  threadId: uuidSchema,
  body: z.string().trim().min(1).max(MAX_MESSAGE_LEN),
});

export const createPharmacyThreadSchema = z.object({
  pharmacyId: uuidSchema,
  memberId: uuidSchema.nullable(),
  title: z.string().trim().min(1).max(MAX_TITLE_LEN),
  category: topicCategorySchema,
  priority: topicPrioritySchema,
  body: z.string().trim().min(1).max(MAX_MESSAGE_LEN),
});

export const pharmacyMembersSchema = z.object({ pharmacyId: uuidSchema });

export const pushSendSchema = z.object({
  mode: z.enum(["test", "check"]).default("check"),
  since: isoDateTime.nullable().optional(),
  hidden: z.boolean().optional(),
});

export const messagePollSchema = z.object({
  id: uuidSchema,
  since: isoDateTime.nullable(),
});
