const express = require('express');
const { StrKey } = require('@stellar/stellar-sdk');
const { PrismaClient } = require('@prisma/client');
const { ApiError } = require('../errors');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res, next) => {
  try {
    const { address, memo } = req.body || {};

    if (!address || typeof address !== 'string') {
      throw new ApiError('INVALID_INPUT', 'address is required');
    }

    if (!StrKey.isValidEd25519PublicKey(address)) {
      throw new ApiError('INVALID_INPUT', 'Invalid Stellar address');
    }

    const existing = await prisma.account.findUnique({ where: { address } });
    if (existing) {
      // Idempotent re-registration: same username+address pair already exists.
      return res.status(200).json({ ok: true, already_registered: true });
    }

    const account = await prisma.account.create({
      data: { address, memo: memo || null },
    });

    res.status(201).json({ ok: true, already_registered: false, address: account.address, memo: account.memo });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
