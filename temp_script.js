const fs = require('fs');
const { createClient } = require("@supabase/supabase-js");

const envVars = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
      acc[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return acc;
}, {});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  // Get free plan
  const { data: plan } = await adminClient
    .from("credit_plans")
    .select("id")
    .eq("slug", "free")
    .single();

  if (!plan) {
    console.error("Free plan not found");
    return;
  }

  // Update credit plan
  console.log("Updating Free plan to 2 credits...");
  const { error: err1 } = await adminClient
    .from("credit_plans")
    .update({ credits: 2 })
    .eq("id", plan.id);
    
  if (err1) throw err1;

  // Cap all users on this plan to 2 credits
  console.log("Updating existing users on Free plan...");
  const { data: users } = await adminClient
    .from("user_credits")
    .select("user_id, credits_remaining")
    .eq("plan_id", plan.id);

  if (users) {
    for (const u of users) {
      if (u.credits_remaining === -1 || u.credits_remaining > 2) {
        await adminClient
          .from("user_credits")
          .update({ credits_remaining: 2 })
          .eq("user_id", u.user_id);
        console.log(`Updated user ${u.user_id}`);
      }
    }
  }

  console.log("Done.");
}

run().catch(console.error);
