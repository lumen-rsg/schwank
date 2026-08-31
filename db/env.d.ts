declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    AI_PROVIDER?: string;
    AI_API_KEY?: string;
    AI_MODEL?: string;
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_MODEL?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
  }
}
