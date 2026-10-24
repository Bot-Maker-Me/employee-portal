"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { createPharmaClient, isPharmaConfigured } from "@/lib/pharma/client";
import {
  listPharmacyMembers,
  type PharmacyMember,
} from "@/lib/pharma/directory";
import { resolvePharmaUserId } from "@/lib/pharma/identity";
import type { PharmaMessage } from "@/lib/pharma/chat";
import type { TopicCategory, TopicPriority } from "@/lib/topics";

/** Compact, non-PHI description of a Postgres/PostgREST error. */
function describeError(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null): string {
  if (!error) return "unknown error";
  return [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" · ");
}

/** Resolves the signed-in, approved employee and their organization. */
async function requireActiveEmployee(): Promise<{
  userId: string;
  email: string | null;
  organization: string;
} | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getProfile(user.id);
  if (!profile || profile.status !== "active" || !profile.organization) {
    return null;
  }
  return {
    userId: user.id,
    email: user.email ?? null,
    organization: profile.organization,
  };
}

/** Server action: members of a pharmacy, for the picker. */
export async function listPharmacyMembersAction(
  pharmacyId: string,
): Promise<PharmacyMember[]> {
  const session = await requireActiveEmployee();
  if (!session || !isPharmaConfigured()) return [];
  try {
    return await listPharmacyMembers(pharmacyId);
  } catch {
    return [];
  }
}

/** Server action: create a new pharmacy chat + its first message. */
export async function createPharmacyThread(input: {
  pharmacyId: string;
  memberId: string | null;
  title: string;
  category: TopicCategory;
  priority: TopicPriority;
  body: string;
}): Promise<{ id: string } | { error: string; detail?: string }> {
  const session = await requireActiveEmployee();
  if (!session) return { error: "UNAUTHENTICATED" };
  if (!isPharmaConfigured()) return { error: "NOT_CONFIGURED" };

  try {
    const pharma = createPharmaClient();
    // Employee Portal ids do not exist in the Pharma project's auth.users, so
    // resolve a Pharma-side identity (or fall back to null).
    const pharmaUserId = await resolvePharmaUserId(session.email);
    const { data: thread, error: threadError } = await pharma
      .from("topic_threads")
      .insert({
        organization_id: session.userId,
        organization_name: session.organization,
        pharmacy_id: input.pharmacyId,
        created_by: pharmaUserId,
        topic: input.title,
        category: input.category,
        priority: input.priority,
        status: "open",
        assigned_user_id: input.memberId,
      })
      .select("id")
      .single();

    if (threadError || !thread) {
      console.error("[pharma] topic_threads insert failed:", threadError?.message);
      return { error: "CREATE_FAILED", detail: describeError(threadError) };
    }

    const { error: messageError } = await pharma.from("topic_messages").insert({
      thread_id: thread.id,
      sender_id: pharmaUserId,
      sender_side: "employee",
      body: input.body,
    });
    if (messageError) {
      console.error("[pharma] topic_messages insert failed:", messageError.message);
      return { error: "CREATE_FAILED", detail: `message: ${describeError(messageError)}` };
    }

    revalidatePath("/pharmacy");
    return { id: thread.id as string };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    console.error("[pharma] create thread threw:", detail);
    return { error: "CREATE_FAILED", detail };
  }
}

/** Server action: send a message on an existing thread. */
export async function sendPharmacyMessage(
  threadId: string,
  body: string,
): Promise<{ error?: string; detail?: string; message?: PharmaMessage }> {
  const text = body.trim();
  if (!text) return { error: "EMPTY" };

  const session = await requireActiveEmployee();
  if (!session) return { error: "UNAUTHENTICATED" };
  if (!isPharmaConfigured()) return { error: "NOT_CONFIGURED" };

  try {
    const pharma = createPharmaClient();

    // Authorize: the thread must belong to the caller's organization.
    const { data: thread } = await pharma
      .from("topic_threads")
      .select("organization_name, status, created_by")
      .eq("id", threadId)
      .maybeSingle();
    if (!thread || thread.organization_name !== session.organization) {
      return { error: "FORBIDDEN" };
    }
    if (thread.status === "closed") return { error: "CLOSED" };

    // Reuse the identity the thread was created with, so sending costs no extra
    // lookups and can never trip the auth.users foreign key.
    const { data: inserted, error } = await pharma
      .from("topic_messages")
      .insert({
        thread_id: threadId,
        sender_id: thread.created_by ?? null,
        sender_side: "employee",
        body: text,
      })
      .select("id, thread_id, sender_id, sender_side, body, created_at, read_at")
      .single();
    if (error || !inserted) {
      console.error("[pharma] message insert failed:", error?.message);
      return { error: "SEND_FAILED", detail: describeError(error) };
    }

    return { message: inserted as PharmaMessage };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    console.error("[pharma] send threw:", detail);
    return { error: "SEND_FAILED", detail };
  }
}
