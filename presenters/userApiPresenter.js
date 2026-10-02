// Explicit fields also keep hashes out of responses after create/update.
function toUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    role: user.role,
    isDeleted: user.isDeleted === true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

module.exports = { toUser };
