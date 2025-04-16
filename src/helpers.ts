import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import "dotenv/config";
import { Readable } from "stream";
import pdfParse from "pdf-parse";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "./db";
import { candidate } from "./schema";
import { InferInsertModel } from "drizzle-orm";
import path from "path";
import mammoth from "mammoth";

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET!,
  },
});

const model = openai("gpt-4o-mini");

const resumeSchema = z.object({
  name: z.string().describe("Name of the candidate"),

  contactDetails: z.object({
    email: z.string().describe("Email address of the candidate").optional(),
    contactNumber: z
      .string()
      .describe("Contact number of the candidate")
      .optional(),
    location: z.string().describe("Location of the candidate").optional(),
    website: z
      .string()
      .describe("Personal website of the candidate")
      .optional(),
  }),

  professionalTitle: z
    .string()
    .describe("Professional role or title of the candidate")
    .optional(),

  professionalSummary: z
    .string()
    .describe("Professional summary of the candidate")
    .optional(),

  socialLinks: z
    .array(
      z.object({
        platform: z.string().optional(),
        url: z.string(),
      }),
    )
    .describe("Links to social accounts of the candidate")
    .optional(),

  projectLinks: z
    .array(
      z.object({
        title: z.string().optional(),
        url: z.string(),
        description: z.string().optional(),
      }),
    )
    .describe("Links to the projects listed by the candidate")
    .optional(),

  experience: z
    .string()
    .describe("Experience details in raw text format")
    .optional(),

  education: z
    .string()
    .describe("Education details in raw text format")
    .optional(),

  totalExperience: z
    .number()
    .describe("Total years of experience of the candidate")
    .optional(),

  exceptionalAbility: z
    .string()
    .describe("Summary of exceptional abilities of the candidate")
    .optional(),

  techStack: z
    .array(z.string())
    .describe(
      "List of tools, technologies, frameworks, or programming languages listed by the candidate",
    ),

  resumeUrl: z.string().describe("URL of the resume uploaded by the candidate"),

  resumeHash: z.string().describe("Hash of the resume content"),
});

type ResumeData = z.infer<typeof resumeSchema>;

type Candidate = InferInsertModel<typeof candidate>;

const Bucket = process.env.AWS_S3_BUCKET_NAME!;

const streamToStructuredData = async (
  stream: Readable,
  name: string,
): Promise<ResumeData> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const data = await getRawText(name, buffer);
  const structuredData = await getStructuredResumeData(data);
  return structuredData;
};

const extractorSystemPrompt = `You are a Senior Talent Acquisition Specialist responsible for analyzing resumes and extracting relevant candidate information. Your task is to carefully review the resume content and return all relevant details in structured format. Focus on extracting information such as name, contact details, professional background, experience, education, skills, links to social or project profiles, and any exceptional abilities. Ensure all data is accurate, clearly organized, and adheres strictly to the expected structure. Do not include anything outside the scope of the resume.`;

const getStructuredResumeData = async (resumeText: string) => {
  const prompt = `Extract structured resume data from the given text: ${resumeText}. Use this existing data if needed to calculate totalExperience: ${new Date().toLocaleString()}. If totalExperience is not a whole number, keep the decimal as-is. Identify any exceptional ability of the candidate, and if none is found, return "No exceptional ability could be found/noted." Return only data matching the schema.`;

  const { object } = await generateObject({
    model,
    schema: resumeSchema,
    prompt,
    schemaName: "resume",
    system: extractorSystemPrompt,
  });
  return object as ResumeData;
};

const getRawText = async (
  fileName: string,
  fileBuffer: Buffer<ArrayBuffer>,
) => {
  const ext = path.extname(fileName);
  if (ext.includes("pdf")) {
    const data = await pdfParse(fileBuffer);
    return data.text;
  } else {
    const data = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
    return data.value;
  }
};

export const processFilesWithJobId = async (jobId: string) => {
  try {
    const prefix = `${jobId}-`;

    const { Contents } = await s3Client.send(
      new ListObjectsV2Command({
        Bucket,
        Prefix: prefix,
      }),
    );

    if (!Contents || Contents.length === 0) {
      return [];
    }

    const candidates: Candidate[] = [];

    await Promise.all(
      Contents.map(async (file) => {
        const getCommand = new GetObjectCommand({
          Bucket,
          Key: file.Key,
        });

        const response = await s3Client.send(getCommand);
        const bodyStream = response.Body as Readable;
        const structuredData = await streamToStructuredData(
          bodyStream,
          file.Key!,
        );

        candidates.push({
          resumeHash: "",
          resumeUrl: file.Key!,
          contactDetails: structuredData.contactDetails,
          education: structuredData.education,
          exceptionalAbility: structuredData.exceptionalAbility,
          experience: structuredData.experience,
          name: structuredData.name,
          professionalSummary: structuredData.professionalSummary,
          professionalTitle: structuredData.professionalTitle,
          projectLinks: structuredData.projectLinks,
          socialLinks: structuredData.socialLinks,
          techStack: structuredData.techStack,
          totalExperience: structuredData.totalExperience,
        });
      }),
    );

    const insertedId = await db
      .insert(candidate)
      .values(candidates)
      .returning({ insertedId: candidate.id });

    return insertedId;
  } catch (error) {
    console.log(error);
    return [];
  }
};
