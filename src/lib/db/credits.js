import { createClient } from "@supabase/supabase-js";

export async function getUserCredits(supabase, userId) {
  const { data: creditsData, error } = await supabase
    .from("user_credits")
    .select(`
      credits_remaining,
      credits_used,
      period_start,
      period_end,
      credit_plans!inner (
        name,
        slug,
        credits
      )
    `)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !creditsData) {
    return null;
  }

  return {
    remaining: creditsData.credits_remaining,
    used: creditsData.credits_used,
    planName: creditsData.credit_plans?.name,
    planSlug: creditsData.credit_plans?.slug,
    total: creditsData.credit_plans?.credits,
    periodEnd: creditsData.period_end,
  };
}

export async function deductCredit(adminClient, userId, bannerId = null) {
  const { data, error } = await adminClient.rpc("deduct_credit", {
    p_user_id: userId,
    p_banner_id: bannerId,
  });

  if (error) {
    console.error("Failed to deduct credit via RPC:", error);
    return { success: false, remaining: 0 };
  }

  return data; // { success, remaining, is_admin }
}

export async function resetExpiredCredits(adminClient, userId) {
  // Check if period_end is in the past
  const { data: current, error } = await adminClient
    .from("user_credits")
    .select("period_end, plan_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !current) return;

  if (new Date(current.period_end) < new Date()) {
    // Get plan credits
    const { data: plan } = await adminClient
      .from("credit_plans")
      .select("credits")
      .eq("id", current.plan_id)
      .maybeSingle();
      
    if (plan) {
      await adminClient
        .from("user_credits")
        .update({
          credits_remaining: plan.credits,
          credits_used: 0,
          period_start: new Date().toISOString(),
          // approximate 1 month, postgres trigger handled it originally, here we just add 30 days
          period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("user_id", userId);
        
      await adminClient.from("credit_transactions").insert({
        user_id: userId,
        amount: plan.credits,
        reason: "monthly_reset",
      });
    }
  }
}

export async function adjustCredits(adminClient, userId, amount, reason) {
  // For refunds or manual adjustments
  // We use a raw SQL approach or read-modify-write here since it's admin/server only
  const { data: current } = await adminClient
    .from("user_credits")
    .select("credits_remaining")
    .eq("user_id", userId)
    .maybeSingle();
    
  if (current) {
    let newAmount = current.credits_remaining;
    if (newAmount !== -1) {
      newAmount += amount;
      await adminClient
        .from("user_credits")
        .update({ credits_remaining: Math.max(0, newAmount) })
        .eq("user_id", userId);
    }
  }

  await adminClient.from("credit_transactions").insert({
    user_id: userId,
    amount,
    reason,
  });
}

export async function setUserPlan(adminClient, userId, planId) {
  const { data: plan } = await adminClient
    .from("credit_plans")
    .select("credits")
    .eq("id", planId)
    .single();

  if (!plan) throw new Error("Plan not found");

  await adminClient
    .from("user_credits")
    .update({
      plan_id: planId,
      credits_remaining: plan.credits,
      credits_used: 0,
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("user_id", userId);

  await adminClient.from("credit_transactions").insert({
    user_id: userId,
    amount: plan.credits,
    reason: "plan_change",
  });
}

export async function listPlans(supabase) {
  const { data, error } = await supabase
    .from("credit_plans")
    .select("*")
    .order("credits", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createPlan(adminClient, payload) {
  const { data, error } = await adminClient
    .from("credit_plans")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlan(adminClient, id, payload) {
  const { data, error } = await adminClient
    .from("credit_plans")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlan(adminClient, id) {
  const { error } = await adminClient
    .from("credit_plans")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
