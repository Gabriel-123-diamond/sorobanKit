'use strict';

const { asyncHandler } = require('../../middleware/asyncHandler');
const { parsePagination, paginatedResponse, parseCursorQuery, paginateByKeyset, cursorPaginatedResponse, keysetWhereDesc } = require('../../pagination');

module.exports = (router, adminAuth, getPrisma) => {
  // ── GET /admin/users/blocked ─────────────────────────────────────────────
  router.get('/admin/users/blocked', adminAuth, asyncHandler(async (req, res, next) => {
    const { prisma } = getPrisma();
    const { search, cursor, page } = req.query;

    const where = {
      flaggedAt: { not: null }
    };

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { address: { contains: search } }
      ];
    }

    if (cursor !== undefined || (page === undefined && cursor === undefined)) {
      // Keyset (cursor) pagination
      const { limit, cursor: parsedCursor, invalid } = parseCursorQuery(req.query);
      if (invalid) {
        return res.status(400).json({ error: 'Invalid cursor' });
      }

      if (parsedCursor) {
        where.AND = [keysetWhereDesc(parsedCursor)];
      }

      const users = await prisma.user.findMany({
        where,
        take: limit + 1,
        orderBy: [
          { createdAt: 'desc' },
          { username: 'desc' },
        ],
        select: {
          username: true,
          address: true,
          flaggedAt: true,
          createdAt: true
        }
      });

      const { rows, hasMore, nextCursor } = paginateByKeyset(users, limit);
      return res.status(200).json(cursorPaginatedResponse(rows, { limit, nextCursor, hasMore }));
    } else {
      // Offset pagination
      const { page: parsedPage, limit, skip } = parsePagination(req.query);
      
      const [totalCount, users] = await prisma.$transaction([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            username: true,
            address: true,
            flaggedAt: true,
            createdAt: true
          }
        })
      ]);
      
      return res.status(200).json(paginatedResponse(users, totalCount, { page: parsedPage, limit }));
    }
  }));

};
