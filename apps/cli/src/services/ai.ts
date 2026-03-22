import Anthropic from "@anthropic-ai/sdk";
import type { SickbayReport } from "@sickbay/core";

/**
 * AIService provides methods to generate a natural language summary of the Sickbay report and to engage in a chat conversation about the report.
 * It uses the Anthropic API to process the report data and user messages, returning insightful and actionable responses.
 */

export interface AIService {
  generateSummary(report: SickbayReport): Promise<string>;
  chat(
    message: string,
    report: SickbayReport,
    history: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<string>;
}

export function createAIService(apiKey: string): AIService {
  const client = new Anthropic({ apiKey });

  async function generateSummary(report: SickbayReport): Promise<string> {
    const prompt = `You are a code health analyst. Analyze this project health report and provide a structured summary with the following sections:

**Health Assessment**
A one-sentence overall health statement using the score (${report.overallScore}/100).

**Critical Issues**
List 2-3 most important issues to address. If none, say "No critical issues detected."

**What's Going Well**
Highlight 1-2 positive aspects or passing checks.

**Next Steps**
One actionable recommendation to improve the codebase.

Use markdown formatting (**bold** for headings). Be direct and specific.

Report:
${JSON.stringify(report, null, 2)}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock && "text" in textBlock
      ? textBlock.text
      : "Unable to generate summary.";
  }

  async function chat(
    message: string,
    report: SickbayReport,
    history: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<string> {
    const systemPrompt = `You are an expert code health assistant analyzing a project's Sickbay report.

The report contains:
- Overall score: ${report.overallScore}/100
- ${report.summary.critical} critical issues, ${report.summary.warnings} warnings, ${report.summary.info} info items
- Checks across dependencies, security, code quality, performance, and git health

Full report data:
${JSON.stringify(report, null, 2)}

Answer questions clearly and concisely. Reference specific checks, scores, and issues when relevant. Be helpful and actionable.`;

    const messages = [
      ...history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock && "text" in textBlock
      ? textBlock.text
      : "Unable to generate response.";
  }

  return { generateSummary, chat };
}
