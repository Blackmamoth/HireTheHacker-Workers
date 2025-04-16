import "dotenv/config";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { processFilesWithJobId } from "./helpers";

const connection = new Redis({
  host: process.env.REDIS_HOST!,
  password: process.env.REDIS_PASS!,
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "resume-processing",
  async (job) => {
    if (job.name == "process-resume") {
      const { jobId } = job.data;
      await processFilesWithJobId(jobId);
    }
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log("Completed", job.id);
});

worker.on("failed", (job) => {
  console.log("Failed", job?.id);
});
