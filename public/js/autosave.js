// Saves the article while the reporter types, so nothing is lost on refresh,
// on closing the browser, or when moving to another computer.
// The text is sent to the same REST API the form uses: POST creates the draft,
// PATCH saves later changes.
(function () {
  const form = document.querySelector('form[data-autosave="on"]');
  if (!form) return; // read-only view of an article waiting for the editor

  const status = form.querySelector('[data-autosave-status]');
  const fields = ['title', 'category', 'summary', 'body', 'republishAt']
    .map(name => form.elements[name])
    .filter(Boolean);
  const imageField = form.elements.image;

  // What to tell the reporter when the server refuses a field
  const PROBLEMS = {
    title: 'חובה למלא כותרת',
    category: 'יש לבחור קטגוריה מהרשימה',
    summary: 'התקציר ארוך מדי',
    body: 'גוף הכתבה ארוך מדי',
    image: 'הקובץ אינו תמונה תקינה (JPEG, PNG, GIF או WebP, עד 5MB)',
    republishAt: 'תאריך הפרסום מחדש חייב להיות תקין ובעתיד',
  };

  const IDLE_MS = 1500;       // save this long after the last keystroke
  const MIN_TITLE = 3;        // a new article is created only once it has a real title

  let articleId = form.dataset.articleId || '';
  let lastSaved = snapshot();
  let savedImageKey = '';   // the image the server already has
  let timer = null;
  let saving = false;
  let stopped = false;

  function chosenImage() {
    const file = imageField?.files?.[0];
    return file && file.size > 0 ? file : null;
  }

  function imageKey() {
    const file = chosenImage();
    return file ? `${file.name}:${file.size}:${file.lastModified}` : '';
  }

  // A fingerprint of the form: if it has not changed, there is nothing to save
  function snapshot() {
    return [...fields.map(field => `${field.name}=${field.value}`), `image=${imageKey()}`].join('\n');
  }

  function content() {
    const values = {};
    for (const field of fields) {
      // An empty date means "no change", so it is left out
      if (field.name === 'republishAt' && !field.value) continue;
      values[field.name] = field.value;
    }
    return values;
  }

  // With an image the request must be form data, which is also what the server
  // reads from the page form; without one, plain JSON is lighter
  function requestBody(withImage) {
    if (!withImage) {
      return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(content()) };
    }
    const data = new FormData();
    for (const [name, value] of Object.entries(content())) data.append(name, value);
    data.append('image', chosenImage());
    return { headers: {}, body: data };
  }

  // Keeps the thumbnail in the form in step with what the server stored
  // "בחירת תמונה" becomes "החלפת תמונה" once the article has one
  function showImageName(text) {
    const label = form.querySelector('[data-image-name]');
    if (!label) return;
    label.textContent = text;
    label.hidden = !text;
  }

  function showCurrentImage(url) {
    const box = form.querySelector('[data-image-current]');
    const img = form.querySelector('[data-image-preview]');
    if (!box || !img || !url) return;
    img.src = `${url}?v=${Date.now()}`;
    box.hidden = false;
    const button = form.querySelector('[data-image-button]');
    if (button) button.textContent = 'החלפת תמונה';
  }

  function show(text, isError) {
    if (!status) return;
    status.textContent = text;
    status.hidden = !text;
    status.classList.toggle('text-warning', Boolean(isError));
  }

  function stop(message) {
    stopped = true;
    clearTimeout(timer);
    show(message, true);
  }

  async function save({ keepalive = false } = {}) {
    if (stopped || saving) return;

    const current = snapshot();
    if (current === lastSaved) return;

    const title = form.elements.title.value.trim();
    if (!articleId && title.length < MIN_TITLE) return; // nothing worth creating yet

    // The file travels only when it was just chosen; a page-hide save carries the text alone
    const withImage = Boolean(chosenImage()) && imageKey() !== savedImageKey && !keepalive;

    saving = true;
    show(withImage ? 'שומר תמונה…' : 'שומר…');
    try {
      const { headers, body } = requestBody(withImage);
      const res = await fetch(
        articleId ? `/api/reporter/articles/${articleId}` : '/api/reporter/articles',
        { method: articleId ? 'PATCH' : 'POST', headers, body, keepalive },
      );

      if (res.status === 409) return stop('הכתבה נשלחה לעורך — השינויים האחרונים לא נשמרו');
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        const reasons = Object.keys(problem.details || {}).map(field => PROBLEMS[field] || field);
        show(reasons.length ? `לא נשמר: ${reasons.join(', ')}` : 'השמירה האוטומטית נכשלה — נסו שוב בעוד רגע', true);
        return;
      }

      const { data } = await res.json();
      lastSaved = current;
      if (withImage) {
        showCurrentImage(data.image);
        showImageName('');
        imageField.value = '';       // already uploaded; the thumbnail is the proof
        savedImageKey = '';
        lastSaved = snapshot();      // the emptied picker is the new starting point
      }

      // The draft now exists: keep editing it instead of creating another one
      if (!articleId) {
        articleId = data.id;
        form.dataset.articleId = articleId;
        form.action = `/reporter/articles/${articleId}`;
        history.replaceState(null, '', `/reporter/articles/${articleId}/edit`);
      }
      show('✓ נשמר אוטומטית');
    } catch {
      show('אין חיבור לשרת — השינויים נשמרו בדפדפן בלבד', true);
    } finally {
      saving = false;
    }
  }

  function scheduleSave() {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(save, IDLE_MS);
  }

  for (const field of fields) {
    field.addEventListener('input', scheduleSave);
    field.addEventListener('change', () => save());   // leaving a field or picking a category
  }
  // A chosen image is uploaded right away; its name is shown until the upload finishes
  imageField?.addEventListener('change', () => {
    const file = chosenImage();
    showImageName(file ? `נבחר: ${file.name} — מעלה…` : '');
    save();
  });

  // Closing the tab, switching tabs, or navigating away: send what is not saved yet
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save({ keepalive: true });
  });
  window.addEventListener('pagehide', () => save({ keepalive: true }));

  // The form is being sent normally, so let it take over
  form.addEventListener('submit', () => {
    stopped = true;
    clearTimeout(timer);
  });
})();
