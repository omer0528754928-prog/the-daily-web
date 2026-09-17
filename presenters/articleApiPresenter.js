// Shapes articles for JSON responses: raw values (English status, ISO dates, plain numbers)

function latestEditorNote(notes = []) {
  if (!notes.length) return null;
  const newest = notes.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a));
  return { text: newest.text, createdAt: newest.createdAt };
}

function toArticleSummary(article) {
  return {
    id: String(article._id),
    title: article.title,
    category: article.category,
    status: article.status,
    returnedCount: article.returnedCount,
    latestEditorNote: latestEditorNote(article.editorNotes),
    views: article.views,
    publishedAt: article.publishedAt ?? null,
    updatedAt: article.updatedAt,
  };
}

module.exports = { toArticleSummary };
