import 'server-only';

import fs from 'fs/promises';
import path from 'path';
import { isMongoAvailable } from '@/lib/db/mongoAvailability';
import PankhidaStream from '@/lib/models/PankhidaStream';
import { writeJsonFileAtomically } from '@/lib/storage/atomicStorage';
import {
  DEFAULT_PANKHIDA_CONFIG,
  normalizePankhidaConfig,
  type PankhidaConfig,
} from '@/lib/pankhida/config';

const FILE_PATH = path.join(process.cwd(), 'data', 'pankhida-2026.json');
const CONFIG_ID = 'pankhida-2026';

async function readFileConfig(): Promise<PankhidaConfig> {
  try {
    return normalizePankhidaConfig(JSON.parse(await fs.readFile(FILE_PATH, 'utf-8')));
  } catch {
    return DEFAULT_PANKHIDA_CONFIG;
  }
}

export async function readPankhidaConfig(): Promise<PankhidaConfig> {
  if (await isMongoAvailable({ label: 'Pankhida 2026 stream settings' })) {
    try {
      const record = await PankhidaStream.findById(CONFIG_ID).lean();
      if (record) return normalizePankhidaConfig(record);
    } catch (error) {
      console.error('Failed to load Pankhida stream settings from MongoDB.', error);
    }
  }
  return readFileConfig();
}

export async function writePankhidaConfig(input: PankhidaConfig): Promise<PankhidaConfig> {
  const config = { ...input, updatedAt: new Date().toISOString() };
  if (await isMongoAvailable({ label: 'Pankhida 2026 stream settings write' })) {
    await PankhidaStream.findByIdAndUpdate(CONFIG_ID, config, { upsert: true });
  } else {
    await writeJsonFileAtomically(FILE_PATH, config);
  }
  return config;
}
