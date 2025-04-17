import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { processFilesWithJobId, screenResumes } from "./helpers";
import { emitScreeningComplete } from "./socket";

const connection = new Redis({
  host: process.env.REDIS_HOST!,
  password: process.env.REDIS_PASS!,
  maxRetriesPerRequest: null,
});

export const resumeQueue = new Queue("resume-processing", {
  connection,
});

const worker = new Worker(
  "resume-processing",
  async (job) => {
    if (job.name == "process-resume") {
      const { jobId } = job.data;
      await processFilesWithJobId(jobId);
      await resumeQueue.add("screen-resumes", { jobId });
    } else if (job.name == "screen-resumes") {
      const { jobId } = job.data;
      await screenResumes(jobId);
    }
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log("Completed", job.id);
  emitScreeningComplete(job?.data.jobId);
});

worker.on("failed", (job) => {
  console.log("Failed", job?.id);
});
