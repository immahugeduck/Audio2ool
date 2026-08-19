import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'acoustic_audit_reports' table
export const acousticAuditReports = pgTable('acoustic_audit_reports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  peakNote: text('peak_note'),
  peakFrequencyHz: integer('peak_frequency_hz'),
  rmsDb: integer('rms_db'),
  noiseFloorDb: integer('noise_floor_db'),
  snrDb: integer('snr_db'),
  noiseCriteriaRating: text('noise_criteria_rating'),
  dominantNoiseSource: text('dominant_noise_source'),
  primarySound: text('primary_sound'),
  confidence: integer('confidence'),
  category: text('category'),
  description: text('description'),
  psychoacousticsJson: text('psychoacoustics_json'),
  recommendedFixesJson: text('recommended_fixes_json'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  reports: many(acousticAuditReports),
}));

export const acousticAuditReportsRelations = relations(acousticAuditReports, ({ one }) => ({
  user: one(users, {
    fields: [acousticAuditReports.userId],
    references: [users.id],
  }),
}));
