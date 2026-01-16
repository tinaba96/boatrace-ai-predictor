import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const PREDICTIONS_DIR = path.join(__dirname, '../public/data/predictions');

const files = fs.readdirSync(PREDICTIONS_DIR).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/)).sort();
const problemDates = [];

for (const file of files) {
  const dateStr = file.replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(PREDICTIONS_DIR, file)));

  let jsonEntries = 0, jsonPreds = 0, jsonResults = 0;
  for (const race of data.races || []) {
    const players = race.predictions?.standard?.players || race.prediction?.players || [];
    jsonEntries += players.length;
    if (race.predictions) {
      if (race.predictions.standard) jsonPreds++;
      if (race.predictions.safeBet) jsonPreds++;
      if (race.predictions.upsetFocus) jsonPreds++;
    } else if (race.prediction) jsonPreds++;
    if (race.result?.finished) jsonResults++;
  }

  const { count: dbEntries } = await supabase.from('race_entries').select('*', { count: 'exact', head: true }).like('race_id', dateStr + '%');
  const { count: dbPreds } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).like('race_id', dateStr + '%');
  const { count: dbResults } = await supabase.from('race_results').select('*', { count: 'exact', head: true }).like('race_id', dateStr + '%');

  if (jsonEntries !== dbEntries || jsonPreds !== dbPreds || jsonResults !== dbResults) {
    problemDates.push(dateStr);
    console.log(`${dateStr}: entries=${dbEntries-jsonEntries}, preds=${dbPreds-jsonPreds}, results=${dbResults-jsonResults}`);
  }
}

console.log('');
console.log('欠損日付:', problemDates.join(' '));
