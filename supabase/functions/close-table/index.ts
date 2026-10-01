import { ApiError, handler, str } from '../_shared/http.ts'
import { loadTable, touchTable } from '../_shared/tables.ts'

Deno.serve(
  handler(async ({ db, user, body }) => {
    const table = await loadTable(db, str(body.tableId))
    if (table.owner_id !== user.id) throw new ApiError('NOT_OWNER', 403)
    await touchTable(db, table.id, { status: 'closed' })
    return { ok: true }
  }),
)
