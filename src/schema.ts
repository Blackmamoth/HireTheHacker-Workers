import { randomUUID } from "crypto";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  jsonb,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const jobDescription = pgTable("job_description", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  userId: text("user_id")
    .references(() => user.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const candidate = pgTable("candidate", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name"),
  contactDetails: jsonb("contact_details"),
  professionalTitle: text("professional_title"),
  professionalSummary: text("professional_summary"),
  socialLinks: jsonb("social_links"),
  projectLinks: jsonb("project_links"),
  experience: text("experience"),
  education: text("education"),
  totalExperience: doublePrecision("total_experience"),
  exceptionalAbility: text("exceptional_ability"),
  techStack: text("tech_stack").array(),
  resumeUrl: text("resume_url").notNull(),
  resumeHash: text("resume_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const screening = pgTable("screening", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  jd: uuid("jd")
    .references(() => jobDescription.id)
    .notNull(),
  candidate: uuid("candidate")
    .references(() => candidate.id)
    .notNull(),
  rank: integer("rank").notNull(),
  isShortlisted: boolean("is_shortlisted").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});
