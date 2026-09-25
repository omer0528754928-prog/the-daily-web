const express = require('express');
const requireRole = require('../../middleware/requireRole');
const pagination = require('../../middleware/pagination');
const { ROLES } = require('../../models/User');
const usersController = require('../../controllers/api/usersController');

const router = express.Router();

router.use(requireRole(ROLES.EDITOR));

router.get('/', pagination, usersController.listUsers);
router.get('/:id', usersController.getUser);
router.post('/', usersController.createUser);
router.patch('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

module.exports = router;
