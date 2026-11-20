export const compatibleHosts: Record<string, string> = {
  DEEPSEEK_API_KEY: "api.deepseek.com",
  GROQ_API_KEY: "api.groq.com",
  MISTRAL_API_KEY: "api.mistral.ai",
  XAI_API_KEY: "api.x.ai",
  TOGETHER_API_KEY: "api.together.xyz",
  FIREWORKS_API_KEY: "api.fireworks.ai",
  CEREBRAS_API_KEY: "api.cerebras.ai",
  PERPLEXITY_API_KEY: "api.perplexity.ai",
  SAMBANOVA_API_KEY: "api.sambanova.ai",
  NEBIUS_API_KEY: "api.nebius.com",
  SILICONFLOW_API_KEY: "api.siliconflow.com",
  MOONSHOT_API_KEY: "api.moonshot.ai",
  MINIMAX_API_KEY: "api.minimax.io",
  NOVITA_API_KEY: "api.novita.ai",
  HYPERBOLIC_API_KEY: "api.hyperbolic.xyz",
};

export const compatibleSecretNames = ["AI_COMPATIBLE_API_KEY", ...Object.keys(compatibleHosts)];
