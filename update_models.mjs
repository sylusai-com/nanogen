import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('admin_models').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  for (let i = 0; i < data.length; i++) {
    const model = data[i];
    const newLabel = `v${i + 1}`;
    console.log(`Updating ${model.label} to ${newLabel}`);
    await supabase.from('admin_models').update({ label: newLabel }).eq('id', model.id);
    
    // Also update existing banners that used this model
    await supabase.from('banners').update({ model_label: newLabel }).eq('model_id', model.model_id);
    await supabase.from('generation_results').update({ model_label: newLabel }).eq('model_id', model.model_id);
  }
  console.log('Updated models to v1, v2, etc.');
}
main();
