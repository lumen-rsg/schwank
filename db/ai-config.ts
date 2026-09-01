import { env } from 'cloudflare:workers';

export type AiProvider = 'deepseek' | 'openai';

export type AiConfiguration = {
  provider: AiProvider;
  providerName: string;
  endpoint: string;
  apiKey: string;
  model: string;
  configurationError?: string;
};

const value = (input: string | undefined) => input?.trim() || '';

export function getAiConfiguration(): AiConfiguration {
  const requestedProvider = value(env.AI_PROVIDER).toLowerCase();
  if (
    requestedProvider &&
    requestedProvider !== 'deepseek' &&
    requestedProvider !== 'openai'
  ) {
    return {
      provider: 'openai',
      providerName: 'AI',
      endpoint: '',
      apiKey: '',
      model: '',
      configurationError: `Unsupported AI_PROVIDER: ${requestedProvider}`,
    };
  }
  const provider: AiProvider =
    requestedProvider === 'deepseek' ||
    (!requestedProvider && Boolean(value(env.DEEPSEEK_API_KEY)))
      ? 'deepseek'
      : 'openai';

  if (provider === 'deepseek') {
    return {
      provider,
      providerName: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/responses',
      apiKey: value(env.AI_API_KEY) || value(env.DEEPSEEK_API_KEY),
      model:
        value(env.AI_MODEL) || value(env.DEEPSEEK_MODEL) || 'deepseek-v4-pro',
    };
  }

  return {
    provider,
    providerName: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/responses',
    apiKey: value(env.AI_API_KEY) || value(env.OPENAI_API_KEY),
    model: value(env.AI_MODEL) || value(env.OPENAI_MODEL) || 'gpt-5.4-mini',
  };
}

export function isAiConfigured() {
  const configuration = getAiConfiguration();
  return !configuration.configurationError && Boolean(configuration.apiKey);
}
