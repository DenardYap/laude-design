import { tool } from "ai";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  formatLintErrorsForModel,
  validateDesignFile,
} from "@/lib/ai/validate-design-file";

export interface ToolContext {
  projectId: string;
  userId: string;
  /** Pre-resolved active design id for this turn, if any. */
  activeDesignId: string | null;
  /** Session id for the current chat turn. */
  sessionId: string;
}

async function ensureProject(ctx: ToolContext) {
  const project = await db.project.findFirst({
    where: { id: ctx.projectId, userId: ctx.userId },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found or no access");
}

export function buildDesignTools(ctx: ToolContext) {
  return {
    createDesign: tool({
      description:
        "Create a new design inside the current project and write its initial /App.tsx content in one step. Use this when starting a fresh screen or when the user asks for a different design. The content is validated before being persisted.",
      inputSchema: z.object({
        name: z.string().min(1).max(80).describe("Short title for the design"),
        content: z.string().describe("Full initial content for /App.tsx"),
      }),
      execute: async ({ name, content }) => {
        await ensureProject(ctx);

        const lintErrors = validateDesignFile("/App.tsx", content);
        if (lintErrors.length > 0) {
          throw new Error(formatLintErrorsForModel("/App.tsx", lintErrors));
        }

        const design = await db.design.create({
          data: {
            projectId: ctx.projectId,
            name,
            files: {
              create: { path: "/App.tsx", content },
            },
          },
          select: { id: true, name: true },
        });
        return { designId: design.id, name: design.name };
      },
    }),

    listDesigns: tool({
      description:
        "List ALL designs in this project (including the active one and any sibling designs) with their ids and names. Use this to discover what else exists in the project — typically as the first step before reading a sibling design's content via `readDesign`.",
      inputSchema: z.object({}),
      execute: async () => {
        await ensureProject(ctx);
        const designs = await db.design.findMany({
          where: { projectId: ctx.projectId },
          select: { id: true, name: true, files: { select: { path: true } } },
          orderBy: { updatedAt: "desc" },
        });
        return { designs, activeDesignId: ctx.activeDesignId };
      },
    }),

    readDesign: tool({
      description:
        "Read the current /App.tsx content of a design. Use this before editing to know the current content, or to study a sibling design's styles before creating a new screen.",
      inputSchema: z.object({
        designId: z
          .string()
          .describe(
            "Design id. Pass the active design id to read what you're currently editing, OR the id of any sibling design from `listDesigns`.",
          ),
      }),
      execute: async ({ designId }) => {
        await ensureProject(ctx);
        const design = await db.design.findFirst({
          where: { id: designId, projectId: ctx.projectId },
          select: {
            id: true,
            name: true,
            files: { select: { content: true }, where: { path: "/App.tsx" } },
          },
        });
        if (!design) throw new Error("Design not found");
        const content = design.files[0]?.content ?? "";
        return { id: design.id, name: design.name, content };
      },
    }),

    editDesign: tool({
      description:
        "Make a targeted edit to /App.tsx by replacing a unique snippet. " +
        "`oldString` must appear EXACTLY ONCE in the current file (verbatim, including whitespace and indentation). It will be replaced with `newString`. " +
        "If the snippet appears more than once, expand `oldString` to include enough surrounding context to make it unique. " +
        "For multiple unrelated changes, call `editDesign` once per snippet. " +
        "After editing, the file is re-validated end-to-end (syntax, imports, default-export contract).",
      inputSchema: z.object({
        designId: z.string(),
        oldString: z
          .string()
          .min(1)
          .describe(
            "Exact snippet to find in /App.tsx. Must match verbatim (whitespace + indentation included) and appear EXACTLY ONCE.",
          ),
        newString: z
          .string()
          .describe(
            "Snippet to write in place of `oldString`. Use empty string to delete the snippet.",
          ),
      }),
      execute: async ({ designId, oldString, newString }) => {
        await ensureProject(ctx);
        const design = await db.design.findFirst({
          where: { id: designId, projectId: ctx.projectId },
          select: { id: true },
        });
        if (!design) throw new Error("Design not found");

        const file = await db.designFile.findUnique({
          where: { designId_path: { designId: design.id, path: "/App.tsx" } },
          select: { content: true },
        });
        if (!file) {
          throw new Error(
            "No /App.tsx found for this design. Use `createDesign` to initialise it.",
          );
        }

        if (oldString === newString) {
          throw new Error(
            "`oldString` and `newString` are identical — nothing to change.",
          );
        }

        // Uniqueness check. If the snippet doesn't appear, the model is
        // hallucinating — surface that fast so it re-reads the file and
        // tries again. If it appears multiple times, the model didn't
        // include enough surrounding context to disambiguate.
        const firstIdx = file.content.indexOf(oldString);
        if (firstIdx === -1) {
          throw new Error(
            `\`oldString\` not found in /App.tsx. The snippet must match the current file content verbatim, including whitespace and indentation. Re-read the design with \`readDesign\` and try again.`,
          );
        }
        const secondIdx = file.content.indexOf(oldString, firstIdx + 1);
        if (secondIdx !== -1) {
          throw new Error(
            `\`oldString\` matches more than one location in /App.tsx. Expand the snippet to include enough surrounding context to make it unique, then call \`editDesign\` again.`,
          );
        }

        const nextContent =
          file.content.slice(0, firstIdx) +
          newString +
          file.content.slice(firstIdx + oldString.length);

        const lintErrors = validateDesignFile("/App.tsx", nextContent);
        if (lintErrors.length > 0) {
          throw new Error(formatLintErrorsForModel("/App.tsx", lintErrors));
        }

        await db.designFile.update({
          where: { designId_path: { designId: design.id, path: "/App.tsx" } },
          data: { content: nextContent },
        });
        await db.design.update({
          where: { id: design.id },
          data: { updatedAt: new Date() },
        });

        return {
          ok: true,
          bytesBefore: file.content.length,
          bytesAfter: nextContent.length,
        };
      },
    }),

    deleteDesign: tool({
      description:
        "Permanently delete a design and its content. ALWAYS warn the user and confirm before calling this — deletion is irreversible. Only call this tool after the user has explicitly confirmed they want to delete.",
      inputSchema: z.object({
        designId: z.string().describe("The design to delete"),
      }),
      execute: async ({ designId }) => {
        await ensureProject(ctx);
        await db.design.deleteMany({
          where: { id: designId, projectId: ctx.projectId },
        });
        return { ok: true };
      },
    }),

    renameDesign: tool({
      description: "Rename a design.",
      inputSchema: z.object({
        designId: z.string(),
        name: z.string().min(1).max(80),
      }),
      execute: async ({ designId, name }) => {
        await ensureProject(ctx);
        await db.design.updateMany({
          where: { id: designId, projectId: ctx.projectId },
          data: { name },
        });
        return { ok: true };
      },
    }),

    planDesign: tool({
      description:
        "Plan the work for a new or significantly revised design BEFORE producing any files. Lay out the granular steps you'll execute (e.g. 'Define color palette', 'Layout payment form skeleton', 'Style credit card input'). MUST be called before `createDesign` / `editDesign` for any non-trivial design work. After this returns, you MUST execute one step at a time: do the work for step 1, call `completePlanStep` for step 1, do the work for step 2, call `completePlanStep` for step 2, and so on. Never batch step completions. Replaces the session's previous plan.",
      inputSchema: z.object({
        title: z
          .string()
          .min(1)
          .max(120)
          .describe(
            "Short title for the design effort, e.g. 'Checkout form' or 'Settings page redesign'.",
          ),
        steps: z
          .array(
            z.object({
              id: z
                .string()
                .min(1)
                .max(60)
                .describe(
                  "Stable short id, e.g. 'palette' or 'card-input'. Used by completePlanStep.",
                ),
              label: z
                .string()
                .min(3)
                .max(160)
                .describe("Imperative description of the step."),
            }),
          )
          .min(2)
          .max(12)
          .describe("Ordered list of granular steps. 2–12 steps."),
      }),
      execute: async ({ title, steps }) => {
        await ensureProject(ctx);

        // One active plan per session. Mark any existing active plans as
        // abandoned so the UI only ever shows the current effort.
        await db.designPlan.updateMany({
          where: { sessionId: ctx.sessionId, status: "ACTIVE" },
          data: { status: "ABANDONED" },
        });

        const plan = await db.designPlan.create({
          data: {
            sessionId: ctx.sessionId,
            title,
            steps: steps.map((s) => ({ ...s, completed: false })),
          },
          select: { id: true },
        });

        return {
          ok: true,
          planId: plan.id,
          stepCount: steps.length,
          firstStepId: steps[0].id,
          firstStepLabel: steps[0].label,
          message: `Plan saved. Workflow now: (1) do the work for step 1 ("${steps[0].label}") — call createDesign / editDesign as needed. (2) Call completePlanStep with stepId="${steps[0].id}" IMMEDIATELY after that work. (3) Then move to step 2, and so on. NEVER call completePlanStep twice in a row without doing the next step's work between. The user is watching the checklist tick off live.`,
        };
      },
    }),

    completePlanStep: tool({
      description:
        "Mark exactly one step of the active design plan as complete. CRITICAL: call this IMMEDIATELY after finishing the work for that single step and BEFORE you do any work for the next step. The user watches steps tick off live as you call this — batching multiple `completePlanStep` calls in a row at the end of your turn is a bug, not a feature. If you find yourself about to call `completePlanStep` twice with no `createDesign` / `editDesign` / other real work between them, you've already broken the contract — go back and slice your work per step.",
      inputSchema: z.object({
        stepId: z
          .string()
          .min(1)
          .max(60)
          .describe("The step id from the active plan."),
      }),
      execute: async ({ stepId }) => {
        await ensureProject(ctx);

        const plan = await db.designPlan.findFirst({
          where: { sessionId: ctx.sessionId, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          select: { id: true, steps: true },
        });
        if (!plan) {
          throw new Error(
            "No active plan. Call `planDesign` first before completing steps.",
          );
        }

        const steps = plan.steps as Array<{
          id: string;
          label: string;
          completed: boolean;
        }>;
        const idx = steps.findIndex((s) => s.id === stepId);
        if (idx === -1) {
          throw new Error(
            `Step "${stepId}" not found in the active plan. Valid ids: ${steps
              .map((s) => s.id)
              .join(", ")}.`,
          );
        }
        const stepNumber = idx + 1;
        const stepLabel = steps[idx].label;

        if (steps[idx].completed) {
          return {
            ok: true,
            alreadyComplete: true,
            stepNumber,
            stepLabel,
            remaining: steps.filter((s) => !s.completed).length,
          };
        }

        const nextSteps = steps.map((s, i) =>
          i === idx ? { ...s, completed: true } : s,
        );
        const remaining = nextSteps.filter((s) => !s.completed).length;
        const allDone = remaining === 0;
        const nextIdx = nextSteps.findIndex((s) => !s.completed);

        await db.designPlan.update({
          where: { id: plan.id },
          data: {
            steps: nextSteps,
            status: allDone ? "COMPLETED" : "ACTIVE",
            completedAt: allDone ? new Date() : null,
          },
        });

        return {
          ok: true,
          stepNumber,
          stepLabel,
          remaining,
          allDone,
          nextStepId: nextIdx === -1 ? null : nextSteps[nextIdx].id,
          nextStepNumber: nextIdx === -1 ? null : nextIdx + 1,
          nextStepLabel: nextIdx === -1 ? null : nextSteps[nextIdx].label,
          message: allDone
            ? "All steps complete. Send a brief one-liner acknowledging the design is done."
            : `Step ${stepNumber} done. Now do the work for step ${nextIdx + 1} ("${nextSteps[nextIdx].label}"), then call completePlanStep again. Do NOT call completePlanStep again until you've done that work.`,
        };
      },
    }),

    askClarifyingQuestions: tool({
      description:
        "Ask the user 1–3 short, high-leverage clarifying questions BEFORE designing. The questions render as an interactive card INLINE in the chat — the user picks answers right there, and their selections come back to you as the next user message. Do NOT write the questions in chat text — always use this tool when the request is ambiguous.",
      inputSchema: z.object({
        rationale: z
          .string()
          .max(240)
          .optional()
          .describe(
            "One short sentence explaining why you're asking before designing. Shown above the questions.",
          ),
        questions: z
          .array(
            z.object({
              id: z
                .string()
                .min(1)
                .max(40)
                .describe("Stable short id, e.g. 'audience' or 'density'"),
              prompt: z.string().min(3).max(240).describe("The question itself"),
              options: z
                .array(
                  z.object({
                    id: z.string().min(1).max(40),
                    label: z.string().min(1).max(120),
                    recommended: z.boolean().optional(),
                  }),
                )
                .min(2)
                .max(5)
                .describe("Concrete options. Mark exactly one as recommended."),
              allowFreeText: z
                .boolean()
                .optional()
                .describe("If true, render a free-text fallback under the options."),
            }),
          )
          .min(1)
          .max(3),
      }),
      execute: async ({ rationale, questions }) => {
        const set = await db.clarifyingQuestionSet.create({
          data: {
            sessionId: ctx.sessionId,
            questions: { rationale: rationale ?? null, items: questions },
          },
          select: { id: true },
        });
        return {
          ok: true,
          questionSetId: set.id,
          waitingForAnswers: true,
          message:
            "Questions rendered inline in the chat. End your turn now — do NOT call any other tools and do NOT keep narrating. The user will answer the inline card, and their selections will arrive as the next user message; resume the design then.",
        };
      },
    }),
  };
}
