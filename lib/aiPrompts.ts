export const AI_SYSTEM_PROMPT = `
You are the AI Benchmarking Engine for a UK carbon-reporting platform...
`;

export function AI_USER_PROMPT(data: any) {
  return `
Analyse this emissions dataset:

${JSON.stringify(data, null, 2)}

Return insights following the schema.
`;
}
