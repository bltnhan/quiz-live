// Fallback / distractor term pools per topic. Used when the host's message
// doesn't contain enough distinct keywords to build 5 fair multiple-choice
// questions, and to supply plausible wrong answers.

export const TOPICS = {
  1: "Pivot Excel",
  2: "Excel Essential",
  3: "PowerPoint Design",
};

export const TERM_BANKS = {
  1: [
    "PivotTable", "PivotChart", "Rows", "Columns", "Values", "Filters",
    "Slicer", "Timeline", "GETPIVOTDATA", "Refresh", "Group Field",
    "Calculated Field", "Subtotal", "Grand Total", "Field List",
    "Data Model", "Show Values As", "Sort", "Drill Down", "Report Layout",
  ],
  2: [
    "VLOOKUP", "XLOOKUP", "HLOOKUP", "IF", "SUMIF", "COUNTIF", "SUMIFS",
    "Conditional Formatting", "Data Validation", "Freeze Panes",
    "Named Range", "Absolute Reference", "Relative Reference", "Table",
    "Chart", "AutoFilter", "Format Cells", "Keyboard Shortcut",
    "Text to Columns", "IFERROR",
  ],
  3: [
    "Slide Master", "Layout", "Theme", "Alignment", "Contrast",
    "Whitespace", "Font Pairing", "Color Palette", "Animation",
    "Transition", "Icon", "Infographic", "Grid System", "Consistency",
    "Storytelling", "Hierarchy", "One Idea Per Slide", "Visual Balance",
    "Brand Guideline", "Call To Action",
  ],
};

// Common Vietnamese/English stop-words to ignore when picking keywords
// out of the host-provided message.
export const STOPWORDS = new Set([
  "va", "và", "la", "là", "cua", "của", "cho", "khi", "the", "de", "để",
  "trong", "ngoai", "ngoài", "voi", "với", "nhung", "những", "cac", "các",
  "mot", "một", "hay", "hoac", "hoặc", "nhu", "như", "vi", "vì", "nen",
  "nên", "duoc", "được", "khong", "không", "co", "có", "se", "sẽ", "da",
  "đã", "ban", "bạn", "tôi", "toi", "chung", "chúng", "ta", "minh", "mình",
  "day", "đây", "do", "đó", "nay", "này", "tu", "từ", "den", "đến", "theo",
  "này", "kia", "the", "this", "that", "with", "from", "your", "you",
  "and", "for", "the", "are", "was", "were", "will", "can", "should",
  "into", "onto", "than", "then", "also", "such", "each", "any", "all",
  "khi", "sau", "truoc", "trước", "tren", "trên", "duoi", "dưới", "giua",
  "giữa", "moi", "mỗi", "tat", "tất", "nhieu", "nhiều", "it", "ít",
]);
