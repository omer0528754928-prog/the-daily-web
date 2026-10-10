// An in-memory stand-in for the Comment collection, so comment tests run without MongoDB.
// It replaces the Comment model's query functions with fakes that work on a plain array.
// Every write still goes through the real schema (validate()), so the schema's rules
// (required text, max lengths, the "אורח" default) are part of what the tests check.

const mongoose = require('mongoose');
const Comment = require('../../models/Comment');

const sameId = (a, b) => String(a) === String(b);

// The fields a query returns: everything except ip, unless the query asked for ip by name
function project(doc, fields) {
  if (!doc) return null;
  const { ip, ...rest } = doc;
  return fields && fields.includes('ip') ? { ...rest, ip } : rest;
}

// A chainable fake of a Mongoose query: .select().sort().skip().limit().lean() and await
function query(run) {
  const q = {
    selected: '',
    select(fields) { q.selected = fields; return q; },
    sort(order) { q.order = order; return q; },
    skip(n) { q.skipped = n; return q; },
    limit(n) { q.limited = n; return q; },
    lean() { return q; },
    then(resolve, reject) { return Promise.resolve().then(() => run(q)).then(resolve, reject); },
  };
  return q;
}

function installFakeComments() {
  const fake = { store: [], queries: [] };
  let clock = Date.UTC(2026, 9, 1, 9, 0);

  Comment.create = async doc => {
    const comment = new Comment(doc);
    await comment.validate();
    const saved = { ...comment.toObject(), createdAt: new Date(clock += 1000) };
    fake.store.push(saved);
    return saved;
  };

  Comment.find = filter => query(q => {
    fake.queries.push(q);
    const skip = q.skipped || 0;
    return fake.store
      .filter(c => sameId(c.articleId, filter.articleId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(skip, q.limited ? skip + q.limited : undefined)
      .map(c => project(c, q.selected));
  });

  Comment.countDocuments = async filter => fake.store.filter(c => sameId(c.articleId, filter.articleId)).length;

  Comment.findById = id => query(q => project(fake.store.find(c => sameId(c._id, id)), q.selected));

  Comment.findByIdAndUpdate = (id, update) => query(async q => {
    const current = fake.store.find(c => sameId(c._id, id));
    if (!current) return null;
    await new Comment({ ...current, ...update.$set }).validate();
    Object.assign(current, update.$set);
    return project(current, q.selected);
  });

  Comment.findByIdAndDelete = id => query(q => {
    const index = fake.store.findIndex(c => sameId(c._id, id));
    return index < 0 ? null : project(fake.store.splice(index, 1)[0], q.selected);
  });

  Comment.deleteMany = async filter => {
    const before = fake.store.length;
    fake.store = fake.store.filter(c => !sameId(c.articleId, filter.articleId));
    return { deletedCount: before - fake.store.length };
  };

  // Puts comments straight into the store (for list tests)
  fake.seed = (articleId, count) => {
    for (let i = 0; i < count; i++) {
      fake.store.push({
        _id: new mongoose.Types.ObjectId(),
        articleId: new mongoose.Types.ObjectId(String(articleId)),
        authorName: `קורא ${i}`,
        text: `תגובה ${i}`,
        ip: '10.0.0.1',
        createdAt: new Date(clock += 1000),
      });
    }
  };

  fake.reset = () => { fake.store = []; fake.queries = []; };
  return fake;
}

module.exports = { installFakeComments };
