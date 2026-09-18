const { HttpError } = require('../utils/HttpError');

// Room for a 5MB image plus the text fields
const MAX_BODY_BYTES = 6 * 1024 * 1024;

async function readBody(req) {
  const declared = Number(req.headers['content-length']);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'Request is too large');

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request is too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Reads multipart/form-data (forms with a file field) into req.body and req.file,
// using the Request.formData() parser built into Node. Other body types were already
// parsed by express.json / express.urlencoded, so they pass through unchanged.
async function parseForm(req, res, next) {
  if (!req.is('multipart/form-data')) return next();

  const request = new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': req.headers['content-type'] },
    body: await readBody(req),
  });

  let formData;
  try {
    formData = await request.formData();
  } catch {
    throw new HttpError(400, 'Form data could not be read');
  }

  req.body = {};
  for (const [name, value] of formData) {
    if (typeof value === 'string') {
      req.body[name] = value;
    } else if (value.size > 0) {
      // An empty file input is sent as a file with no content; ignore it
      req.file = { name: value.name, type: value.type, size: value.size, buffer: Buffer.from(await value.arrayBuffer()) };
    }
  }

  next();
}

module.exports = parseForm;
