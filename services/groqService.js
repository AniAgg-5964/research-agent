const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const GROQ_MODEL = "qwen/qwen3.8-27b";

/**
 * Strip <think>...</think> tags from reasoning model responses.
 * Qwen 3.x models wrap internal reasoning in these tags.
 */
function stripThinkTags(text) {
  if (!text) return text;
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/**
 * Run a prompt through Groq with retry logic.
 * Retries up to 2 times on failure with backoff.
 */
async function runGroqPrompt(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2
      });

      const rawContent = response.choices[0]?.message?.content || "";
      const cleaned = stripThinkTags(rawContent);

      if (!cleaned) {
        console.warn(`[Groq] Empty response on attempt ${i + 1}/${retries}`);
        if (i < retries - 1) {
          await new Promise(res => setTimeout(res, 1500));
          continue;
        }
        return "Error: Groq returned an empty response after all retries.";
      }

      return cleaned;

    } catch (err) {
      console.error(`[Groq] Request failed (attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) {
        const delay = (i === 0) ? 1500 : 3000;
        await new Promise(res => setTimeout(res, delay));
      } else {
        return `Error: Groq request failed after ${retries} attempts. (${err.message})`;
      }
    }
  }
}

module.exports = {
  runGroqPrompt
};