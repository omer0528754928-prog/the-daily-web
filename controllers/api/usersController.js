const userService = require('../../services/userService');
const { toUser } = require('../../presenters/userApiPresenter');

async function listUsers(req, res) {
  const { limit, skip } = req.pagination;
  const { items, total } = await userService.listUsers({ username: req.query.username, limit, skip });
  res.json({ data: items.map(toUser), meta: { total, limit, skip } });
}

async function getUser(req, res) {
  const user = await userService.getUser(req.params.id);
  res.json({ data: toUser(user) });
}

async function createUser(req, res) {
  const user = await userService.createUser(req.body);
  res.status(201).location(`/api/users/${user._id}`).json({ data: toUser(user) });
}

async function updateUser(req, res) {
  const user = await userService.updateUser(req.params.id, req.body);
  res.json({ data: toUser(user) });
}

async function deleteUser(req, res) {
  await userService.deleteUser(req.params.id);
  res.status(204).end();
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
