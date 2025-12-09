export const aiBenchmarkingSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    insights: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 3,
    },
    suggestions: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 3,
    },
    risk: { type: 'string' },
  },
  required: ['summary', 'insights', 'suggestions', 'risk'],
  additionalProperties: false,
};
