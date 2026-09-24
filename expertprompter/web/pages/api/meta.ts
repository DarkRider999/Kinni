import { apiHandler } from '@/lib/server/http';
import { TOOL_CATALOG } from '@/lib/server/services/aiRecommendationService';
import { CATEGORIES, CATEGORY_LABELS, PROMPT_STYLES } from '@/lib/server/types';

// GET /api/meta — option lists for the UI (no DB needed).
export default apiHandler({
  GET(_req, res) {
    res.json({
      categories: CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] })),
      styles: PROMPT_STYLES,
      tools: Object.values(TOOL_CATALOG),
    });
  },
});
