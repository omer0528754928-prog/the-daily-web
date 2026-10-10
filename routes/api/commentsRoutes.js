const express = require('express');
const requireRole = require('../../middleware/requireRole');
const { ROLES } = require('../../models/User');
const commentsController = require('../../controllers/api/commentsController');

const router = express.Router();

// Only editors may change or delete comments. This check on the server is the real protection:
// hiding the buttons from other readers on the page is only a convenience.
router.use(requireRole(ROLES.EDITOR));

router.patch('/:id', commentsController.updateComment);
router.delete('/:id', commentsController.deleteComment);

module.exports = router;
