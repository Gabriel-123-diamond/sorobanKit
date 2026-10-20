'use strict';

const { once } = require('events');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { adminExportQuerySchema } = require('../../schemas');
const { logger } = require('../../logger');

const PAGE_SIZE = 500;
const DEFAULT_MAX_ROWS = 1000000;

const exportRowLimit = (limit) => {
  const value = process.env.ADMIN_EXPORT_MAX_ROWS;
  const cap = value === undefined ? DEFAULT_MAX_ROWS : Number(value);
  if ((value !== undefined && !/^[0-9]+$/.test(value)) ||
      !Number.isInteger(cap) || cap < 1 || cap > 2147483647) {
    throw new Error('ADMIN_EXPORT_MAX_ROWS must be a positive 32-bit integer');
  }
  return Math.min(limit ?? cap, cap);
};

const writeChunk = async (res, chunk) => {
  if (!res.write(chunk)) await once(res, 'drain');
};

const csvRow = (record) => Object.values(record).map((value) => {
  if (value === null || value === undefined) return '';
  const text = String(value instanceof Date ? value.toISOString() : value);
  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}).join(',') + '\n';

/**
 * @openapi
 * /admin/export:
 *   get:
 *     tags: [v1]
 *     description: Stream transactions up to the requested limit and server cap.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1 }
 *         description: Optional row limit; ADMIN_EXPORT_MAX_ROWS always applies.
 *     responses:
 *       200:
 *         description: CSV or NDJSON export
 *         headers:
 *           X-Truncated:
 *             schema: { type: boolean }
 *             description: True when additional matching rows were omitted.
 */
module.exports = (router, adminAuth, getPrisma) => {
  router.get('/admin/export', adminAuth, asyncHandler(async (req, res) => {
    const parsed = adminExportQuerySchema.shape.limit.safeParse(req.query.limit);
    if (!parsed.success) return res.status(400).json({ error: 'limit must be a positive integer' });

    let rowLimit;
    try {
      rowLimit = exportRowLimit(parsed.data);
    } catch (error) {
      logger.error(error.message);
      return res.status(500).json({ error: 'Invalid admin export configuration' });
    }

    const { format = 'csv', startDate, endDate } = req.query;
    let dateFilter;
    if (startDate || endDate) {
      const gte = startDate ? new Date(startDate) : undefined;
      const lte = endDate ? new Date(endDate) : undefined;
      if (gte && isNaN(gte.getTime())) return res.status(400).json({ error: 'Invalid startDate' });
      if (lte && isNaN(lte.getTime())) return res.status(400).json({ error: 'Invalid endDate' });
      if (gte && lte && gte > lte) return res.status(400).json({ error: 'startDate must not be after endDate' });
      dateFilter = {};
      if (gte) dateFilter.gte = gte;
      if (lte) dateFilter.lte = lte;
    }

    const { prisma } = getPrisma();
    const where = dateFilter ? { createdAt: dateFilter } : {};
    const orderBy = [{ createdAt: 'asc' }, { id: 'asc' }];
    // Probe one row beyond the boundary before the first write commits headers.
    const overflow = await prisma.payment.findMany({
      where, orderBy, skip: rowLimit, take: 1, select: { id: true },
    });
    if (overflow.length > 0) res.setHeader('X-Truncated', 'true');

    const isJson = format === 'json';
    const ext = isJson ? 'ndjson' : 'csv';
    const filename = `admin-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
    res.status(200);
    res.setHeader('Content-Type', isJson ? 'application/x-ndjson' : 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    let total = 0;
    let cursor;
    let headerWritten = false;
    try {
      while (total < rowLimit && !res.writableEnded && !res.destroyed) {
        const take = Math.min(PAGE_SIZE, rowLimit - total);
        const records = await prisma.payment.findMany({
          where, orderBy, take, ...(cursor ? { cursor, skip: 1 } : { skip: 0 }),
        });
        if (records.length === 0) break;
        for (const record of records) {
          if (res.destroyed || res.writableEnded) return;
          if (!isJson && !headerWritten) {
            await writeChunk(res, Object.keys(record).map((field) => `"${field}"`).join(',') + '\n');
            headerWritten = true;
          }
          await writeChunk(res, isJson ? JSON.stringify(record) + '\n' : csvRow(record));
          total += 1;
        }
        if (records.length < take) break;
        cursor = { id: records[records.length - 1].id };
      }
      return res.end();
    } catch (error) {
      logger.error(`[Correlation ID: ${req.correlationId}] Admin export failed`, error);
      return res.destroy(error);
    }
  }));
};
