'use strict';

const { body, param, validationResult } = require('express-validator');
const { getISTDateString } = require('../services/savingsEngine');

/**
 * Middleware that inspects validation results from express-validator.
 * Returns 400 with clean error messages if validation fails.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      message: errors.array().map(e => e.msg).join(', '),
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

/**
 * Validation rules for creating a goal.
 */
const validateCreateGoal = [
  body('name')
    .trim()
    .notEmpty().withMessage('Goal name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Goal name must be between 2 and 100 characters'),
  body('targetAmount')
    .isFloat({ gt: 0 }).withMessage('Target amount must be a positive number greater than 0'),
  body('deadline')
    .notEmpty().withMessage('Target deadline is required')
    .isISO8601().withMessage('Deadline must be a valid date format (ISO 8601 or YYYY-MM-DD)')
    .custom((deadlineStr) => {
      const todayStr = getISTDateString(new Date());
      const deadlineDateStr = getISTDateString(new Date(deadlineStr));
      if (deadlineDateStr <= todayStr) {
        throw new Error('Target deadline must be in the future');
      }
      return true;
    }),
  body('category')
    .optional()
    .trim()
    .isIn(['education', 'phone', 'festival', 'farming', 'home', 'emergency', 'other'])
    .withMessage('Category must be a valid option'),
  handleValidationErrors,
];

/**
 * Validation rules for updating a goal.
 */
const validateUpdateGoal = [
  param('id')
    .trim()
    .notEmpty().withMessage('Goal ID is required'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Goal name must be between 2 and 100 characters'),
  body('targetAmount')
    .optional()
    .isFloat({ gt: 0 }).withMessage('Target amount must be a positive number greater than 0'),
  body('deadline')
    .optional()
    .isISO8601().withMessage('Deadline must be a valid date format'),
  body('category')
    .optional()
    .trim()
    .isIn(['education', 'phone', 'festival', 'farming', 'home', 'emergency', 'other'])
    .withMessage('Category must be a valid option'),
  body('status')
    .optional()
    .trim()
    .isIn(['ON_TRACK', 'AT_RISK', 'BEHIND', 'COMPLETED'])
    .withMessage('Status must be ON_TRACK, AT_RISK, BEHIND, or COMPLETED'),
  handleValidationErrors,
];

/**
 * Validation rules for recording a deposit.
 */
const validateCreateDeposit = [
  body('amount')
    .isFloat({ gt: 0 }).withMessage('Deposit amount must be greater than ₹0'),
  body('date')
    .optional()
    .isISO8601().withMessage('Deposit date must be a valid ISO date format'),
  body('depositDate')
    .optional()
    .isISO8601().withMessage('Deposit date must be a valid ISO date format'),
  body('memberId')
    .optional()
    .trim(),
  body('memberName')
    .optional()
    .trim(),
  body('clientTxnId')
    .optional()
    .trim(),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Note cannot exceed 200 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Note cannot exceed 200 characters'),
  body('source')
    .optional()
    .trim(),
  handleValidationErrors,
];

/**
 * Validation rules for updating family details.
 */
const validateUpdateFamily = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Family name must be between 2 and 50 characters'),
  body('preferredLanguage')
    .optional()
    .isIn(['en', 'hi', 'mr']).withMessage('Language must be en, hi, or mr'),
  handleValidationErrors,
];

/**
 * Validation rules for adding a family member.
 */
const validateAddMember = [
  body('name')
    .trim()
    .notEmpty().withMessage('Member name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Member name must be between 2 and 50 characters'),
  body('role')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Role cannot exceed 50 characters'),
  body('phone')
    .optional()
    .trim(),
  handleValidationErrors,
];

/**
 * Validation rules for voice parser.
 */
const validateVoiceParse = [
  body('transcript')
    .trim()
    .notEmpty().withMessage('Voice transcript text is required')
    .isLength({ min: 2, max: 500 }).withMessage('Transcript must be between 2 and 500 characters'),
  handleValidationErrors,
];

/**
 * Validation rules for chat message.
 */
const validateChatMessage = [
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters'),
  body('inputMode')
    .optional()
    .isIn(['text', 'voice']).withMessage('Input mode must be text or voice'),
  body('conversationId')
    .optional()
    .trim(),
  body('appLanguage')
    .optional()
    .trim(),
  handleValidationErrors,
];

/**
 * Validation rules for chat deposit confirmation.
 */
const validateChatConfirm = [
  body('goalId')
    .trim()
    .notEmpty().withMessage('Goal ID is required'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 1, max: 1000000 }).withMessage('Amount must be a positive number up to 10,00,000'),
  body('clientTxnId')
    .optional()
    .trim(),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateCreateGoal,
  validateUpdateGoal,
  validateCreateDeposit,
  validateUpdateFamily,
  validateAddMember,
  validateVoiceParse,
  validateChatMessage,
  validateChatConfirm,
};
