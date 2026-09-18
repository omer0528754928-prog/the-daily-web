// Shapes articles for JSON responses: raw values (English status, ISO dates, plain numbers)

function latestEditorNote(notes = []) {
  if (!notes.length) return null;
  const newest = notes.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a));
  return { text: newest.text, createdAt: newest.createdAt };
}

function toLiveVersionSummary(liveVersion) {
  return liveVersion ? { version: liveVersion.version, publishedAt: liveVersion.publishedAt } : null;
}

// For lists: no body, only the newest editor note
function toArticleSummary(article) {
  return {
    id: String(article._id),
    title: article.title,
    category: article.category,
    status: article.status,
    version: article.version,
    returnedCount: article.returnedCount,
    latestEditorNote: latestEditorNote(article.editorNotes),
    views: article.views,
    liveVersion: toLiveVersionSummary(article.liveVersion),
    updatedAt: article.updatedAt,
  };
}

// For a single article: the full working copy, all editor notes and the public version
function toArticleDetail(article) {
  const live = article.liveVersion;

  return {
    id: String(article._id),
    title: article.title,
    summary: article.summary,
    body: article.body,
    category: article.category,
    image: article.image,
    status: article.status,
    version: article.version,
    hasUnapprovedChanges: Boolean(live) && article.version > live.version,
    submittedAt: article.submittedAt ?? null,
    republishAt: article.republishAt ?? null,
    returnedCount: article.returnedCount,
    views: article.views,
    editorNotes: [...(article.editorNotes || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(note => ({
        id: String(note._id),
        text: note.text,
        by: note.by?.name ? { id: String(note.by._id), name: note.by.name } : null,
        createdAt: note.createdAt,
      })),
    liveVersion: live
      ? {
          version: live.version,
          title: live.title,
          summary: live.summary,
          body: live.body,
          category: live.category,
          image: live.image,
          publishedAt: live.publishedAt,
        }
      : null,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}

module.exports = { toArticleSummary, toArticleDetail };
