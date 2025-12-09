export type AiBenchmarkResponse = {
  summary: string;
  insights: [string, string, string];
  suggestions: [string, string, string];
  risk: string;
};
