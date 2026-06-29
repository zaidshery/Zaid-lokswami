#!/usr/bin/env ts-node

import path from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

type AnyRecord = Record<string, unknown>;

const EMAGAZINE_GLOBAL_CITY_SLUG = 'global';
const EMAGAZINE_GLOBAL_CITY_NAME = 'Lokswami';

function loadMigrationEnvironment() {
  const projectRoot = process.cwd();
  const envFileNames = [
    '.env.hostinger',
    '.env.production',
    '.env',
    '.env.local',
    '.env.production.local',
  ];

  for (const fileName of envFileNames) {
    dotenv.config({
      path: path.join(projectRoot, fileName),
      override: false,
      quiet: true,
    });
  }
}

function asRecord(value: unknown): AnyRecord {
  return typeof value === 'object' && value !== null
    ? (value as AnyRecord)
    : {};
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeIssuePublishDate(value: unknown, publicationType: string) {
  const parsed =
    value instanceof Date
      ? value
      : new Date(
          typeof value === 'string' || typeof value === 'number'
            ? value
            : ''
        );
  if (Number.isNaN(parsed.getTime())) return value;

  if (publicationType !== 'emagazine') {
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate()
      )
    );
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
}

function normalizePages(rawPages: unknown, rawPageCount: unknown) {
  const pages = Array.isArray(rawPages) ? rawPages : [];
  const byNumber = new Map<number, AnyRecord>();
  for (const entry of pages) {
    const page = asRecord(entry);
    const pageNumber = positiveInt(page.pageNumber, 0);
    if (pageNumber > 0) byNumber.set(pageNumber, page);
  }
  const pageCount = Math.max(
    positiveInt(rawPageCount, 0),
    ...Array.from(byNumber.keys()),
    1
  );

  return Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const page = byNumber.get(pageNumber) || {};
    const imagePath = String(page.imagePath || '').trim();
    return {
      ...page,
      pageNumber,
      imagePath,
      pageType: String(page.pageType || 'editorial'),
      classificationNote: String(page.classificationNote || '').trim(),
      processingStatus: String(
        page.processingStatus || (imagePath ? 'ready' : 'pending')
      ),
      processingError: String(page.processingError || '').trim(),
      reviewStatus: String(page.reviewStatus || 'pending'),
      reviewNote: String(page.reviewNote || '').trim(),
      reviewedAt: page.reviewedAt || null,
      reviewedBy: page.reviewedBy || null,
    };
  });
}

async function migrate() {
  loadMigrationEnvironment();
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    throw new Error(
      'MONGODB_URI is required. Set it in PowerShell or in .env.hostinger.'
    );
  }

  const write = process.argv.includes('--write');
  const indexesOnly = process.argv.includes('--indexes-only');
  await mongoose.connect(mongoUri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10_000,
  });

  const collection = mongoose.connection.collection('epapers');
  const documents = indexesOnly ? [] : await collection.find({}).toArray();
  let changed = 0;
  const totals = { epaper: 0, emagazine: 0 };
  const changedByType = { epaper: 0, emagazine: 0 };
  let emagazineScopeChanges = 0;
  let emagazineMonthAnchorChanges = 0;

  for (const document of documents) {
    const pages = normalizePages(document.pages, document.pageCount);
    const familyId = String(document.familyId || document._id);
    const revisionNumber = positiveInt(document.revisionNumber, 1);
    const isPublished = document.status === 'published';
    const publicationType =
      String(document.publicationType || '').trim() === 'emagazine'
        ? 'emagazine'
        : 'epaper';
    totals[publicationType] += 1;
    const citySlug = EMAGAZINE_GLOBAL_CITY_SLUG;
    const cityName = EMAGAZINE_GLOBAL_CITY_NAME;
    const publishDate = normalizeIssuePublishDate(
      document.publishDate,
      publicationType
    );
    const update: AnyRecord = {
      publicationType,
      publishDate,
      familyId,
      revisionNumber,
      isCurrentRevision:
        typeof document.isCurrentRevision === 'boolean'
          ? document.isCurrentRevision
          : true,
      publishedAt:
        document.publishedAt ||
        (isPublished ? document.updatedAt || document.publishDate || new Date() : null),
      pageCount: pages.length,
      pages,
    };
    if (publicationType === 'emagazine') {
      update.citySlug = citySlug;
      update.cityName = cityName;
    }

    const needsMagazineScopeUpdate =
      publicationType === 'emagazine' &&
      (String(document.citySlug || '').trim() !== citySlug ||
        String(document.cityName || '').trim() !== cityName);
    const needsPublishDateUpdate =
      String(document.publishDate || '') !== String(publishDate || '');
    const needsUpdate =
      String(document.publicationType || '').trim() !== publicationType ||
      needsMagazineScopeUpdate ||
      needsPublishDateUpdate ||
      String(document.familyId || '') !== familyId ||
      positiveInt(document.revisionNumber, 0) !== revisionNumber ||
      typeof document.isCurrentRevision !== 'boolean' ||
      !Array.isArray(document.pages) ||
      document.pages.some((page) => !asRecord(page).pageType);
    if (!needsUpdate) continue;

    changed += 1;
    changedByType[publicationType] += 1;
    if (needsMagazineScopeUpdate) {
      emagazineScopeChanges += 1;
    }
    if (publicationType === 'emagazine' && needsPublishDateUpdate) {
      emagazineMonthAnchorChanges += 1;
    }
    if (write) {
      await collection.updateOne({ _id: document._id }, { $set: update });
    }
  }

  if (write || indexesOnly) {
    const indexes = await collection.indexes();
    for (const index of indexes) {
      if (
        index.name === 'citySlug_1_publishDate_1' ||
        index.name === 'familyId_1_revisionNumber_1' ||
        index.name === 'citySlug_1_publishDate_1_isCurrentRevision_1' ||
        index.name === 'publicationType_1_citySlug_1_publishDate_1_isCurrentRevision_1'
      ) {
        await collection.dropIndex(index.name);
      }
    }

    await collection.createIndex(
      { familyId: 1, revisionNumber: 1 },
      {
        name: 'familyId_1_revisionNumber_1',
        unique: true,
        partialFilterExpression: {
          familyId: { $type: 'string', $gt: '' },
        },
      }
    );
    await collection.createIndex(
      { publicationType: 1, citySlug: 1, publishDate: 1, isCurrentRevision: 1 },
      {
        name: 'publicationType_1_citySlug_1_publishDate_1_isCurrentRevision_1',
        unique: true,
        partialFilterExpression: {
          status: 'published',
          isCurrentRevision: true,
        },
      }
    );
    await collection.createIndex(
      { publicationType: 1, status: 1, publishDate: -1, _id: -1 },
      {
        name: 'publicationType_1_status_1_publishDate_-1__id_-1',
      }
    );
    await collection.createIndex(
      { publicationType: 1, status: 1, citySlug: 1, publishDate: -1, _id: -1 },
      {
        name: 'publicationType_1_status_1_citySlug_1_publishDate_-1__id_-1',
      }
    );
  }

  if (indexesOnly) {
    console.log('Verified E-paper/E-magazine MongoDB indexes.');
    return;
  }

  console.log(
    `${write ? 'Migrated' : 'Dry run found'} ${changed} of ${
      documents.length
    } e-paper records requiring workflow v3 updates.`
  );
  console.log(
    `Totals: ${totals.epaper} e-paper records, ${totals.emagazine} e-magazine records.`
  );
  console.log(
    `Needs update: ${changedByType.epaper} e-paper records, ${changedByType.emagazine} e-magazine records.`
  );
  console.log(
    `E-magazine monthly/global fixes: ${emagazineScopeChanges} scope updates, ${emagazineMonthAnchorChanges} month-anchor date updates.`
  );
  if (!write) {
    console.log('Run again with --write after reviewing the dry-run count.');
  }
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
