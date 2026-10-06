// "שליחה לאישור עורך" stays disabled while a published article is the same as the version
// the public already sees: there is nothing new for the editor to approve.
// The server checks this too (it answers 409), so the button only saves the reporter a trip.
(function () {
  const source = document.getElementById('live-version');
  const form = document.querySelector('form[data-autosave="on"]');
  if (!source || !form) return; // an article that was never published

  const live = JSON.parse(source.textContent);
  const button = form.querySelector('button[name="action"][value="submit"]');
  const preview = form.querySelector('[data-image-preview]');
  const TEXT_FIELDS = ['title', 'summary', 'body', 'category'];

  // The server trims the text, and line endings differ between a typed and a sent textarea
  function clean(text) {
    return String(text ?? '').replace(/\r\n/g, '\n').trim();
  }

  // The image the article has now (autosave swaps the thumbnail after an upload)
  function currentImage() {
    const box = form.querySelector('[data-image-current]');
    if (!box || box.hidden) return null;
    return new URL(preview.src, location.href).pathname;
  }

  function hasChanges() {
    if (form.elements.image?.files?.length) return true; // a new image was just chosen
    if (currentImage() !== live.image) return true;
    return TEXT_FIELDS.some(name => clean(form.elements[name].value) !== clean(live[name]));
  }

  function update() {
    const changed = hasChanges();
    button.disabled = !changed;
    button.title = changed ? '' : 'אין שינויים לשליחה';
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  preview?.addEventListener('load', update);
  update();
})();
